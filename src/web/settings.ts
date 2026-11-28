import type { ActionKey, Duo } from '../core/types.js';
import { closeDialogSmooth } from './ui-art.js';

export type Control = 'left' | 'right' | 'up' | 'down' | ActionKey;
export type Seat = 0 | 1;
type Bindings = Record<Control, string>;

export interface Preferences {
  bindingVersion: number;
  volume: number;
  sfxVolume: number;
  voiceVolume: number;
  bgmVolume: number;
  developerMode: boolean;
  shake: boolean;
  camera: 'wide' | 'focus';
  bindings: Duo<Bindings>;
}

const storageKey = 'meme-rumble-settings-v1';
const defaults: Duo<Bindings> = [
  { left: 'KeyA', right: 'KeyD', up: 'KeyW', down: 'KeyS', jump: 'KeyK', dash: 'KeyL', A: 'KeyJ', B: 'KeyU', C: 'KeyI', ULT: 'KeyO' },
  { left: 'ArrowLeft', right: 'ArrowRight', up: 'ArrowUp', down: 'ArrowDown',
    jump: 'Numpad2', dash: 'Numpad3', A: 'Numpad1', B: 'Numpad4', C: 'Numpad5', ULT: 'Numpad6' }
];
const seats = [0, 1] as const;
const legacyControls: Control[] = ['left', 'right', 'up', 'down', 'jump', 'dash', 'A', 'B', 'C'];
const controls: Control[] = [...legacyControls, 'ULT'];
const namedControls: Record<Control, string> = {
  left: '向左', right: '向右', up: '向上', down: '向下 / 防御',
  jump: '跳跃', dash: '冲刺', A: '普攻', B: '进攻技', C: '特色技', ULT: '大招'
};
const namedKeys: Record<string, string> = {
  ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓',
  ShiftLeft: '左 Shift', ShiftRight: '右 Shift', Enter: 'Enter', Space: '空格',
  Comma: '逗号', Period: '句号', Slash: '斜杠', Semicolon: ';', Quote: '单引号',
  BracketLeft: '[', BracketRight: ']', Minus: '-', Equal: '=', Backslash: '\\',
  NumpadAdd: '小键盘 +', NumpadSubtract: '小键盘 -', NumpadDecimal: '小键盘 .'
};

function resetBindings(): Duo<Bindings> {
  return [{ ...defaults[0] }, { ...defaults[1] }];
}

export function keyLabel(code: string): string {
  if (Object.hasOwn(namedKeys, code)) return namedKeys[code];
  if (code.startsWith('Numpad')) return '小键盘 ' + code.slice(6);
  return code.replace(/^(Key|Digit)/, '');
}

function bindable(code: unknown): code is string {
  return typeof code === 'string' && code !== 'KeyH' && code !== 'KeyR' &&
    (Object.hasOwn(namedKeys, code) || /^(Key[A-Z]|Digit[0-9]|Numpad[0-9])$/.test(code));
}

export function loadPreferences(): Preferences {
  const fresh: Preferences = { bindingVersion: 2, volume: 70, sfxVolume: 100, voiceVolume: 100, bgmVolume: 100, developerMode: false, shake: true, camera: 'wide', bindings: resetBindings() };
  try {
    const value = JSON.parse(localStorage.getItem(storageKey) ?? 'null') as Partial<Preferences> | null;
    if (!value) return fresh;
    for (const key of ['volume', 'sfxVolume', 'voiceVolume', 'bgmVolume'] as const) {
      const volume = value[key];
      if (typeof volume === 'number' && Number.isFinite(volume)) {
        fresh[key] = Math.max(0, Math.min(100, Math.round(volume)));
      }
    }
    if (typeof value.shake === 'boolean') fresh.shake = value.shake;
    if (typeof value.developerMode === 'boolean') fresh.developerMode = value.developerMode;
    if (value.camera === 'focus') fresh.camera = value.camera;
    const keys = seats.flatMap(seat => legacyControls.map(action => value.bindings?.[seat]?.[action]));
    if (keys.every(bindable) && new Set(keys).size === keys.length) {
      const used = new Set(keys);
      const retained = new Set<Seat>();
      for (const seat of seats) {
        for (const control of legacyControls) {
          fresh.bindings[seat][control] = value.bindings![seat][control];
        }
        const saved = value.bindings?.[seat]?.ULT;
        if (bindable(saved) && !used.has(saved)) {
          fresh.bindings[seat].ULT = saved;
          used.add(saved);
          retained.add(seat);
        }
      }
      const available = ['KeyP', 'BracketRight',
        ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map(letter => 'Key' + letter)];
      for (const seat of seats) {
        if (retained.has(seat)) continue;
        if (used.has(fresh.bindings[seat].ULT)) {
          const fallback = [defaults[seat].ULT, ...available].find(code => bindable(code) && !used.has(code))!;
          fresh.bindings[seat].ULT = fallback;
        }
        used.add(fresh.bindings[seat].ULT);
      }
      // Migrate the immediately preceding default pair; preserve custom pairs.
      const obsolete = [['KeyO', 'KeyI'], ['Numpad6', 'Numpad5']] as const;
      for (const seat of seats) {
        if (value.bindingVersion !== 2 && fresh.bindings[seat].C === obsolete[seat][0] && fresh.bindings[seat].ULT === obsolete[seat][1]) {
          [fresh.bindings[seat].C, fresh.bindings[seat].ULT] = [fresh.bindings[seat].ULT, fresh.bindings[seat].C];
        }
      }
    }
  } catch {
    // Local file and private browsing can disable storage. Preferences then apply for the session.
  }
  return fresh;
}

export function bindingMap(preferences: Preferences) {
  const map = new Map<string, { seat: Seat; control: Control }>();
  for (const seat of seats) {
    for (const control of controls) map.set(preferences.bindings[seat][control], { seat, control });
  }
  return map;
}

function storePreferences(preferences: Preferences) {
  try { localStorage.setItem(storageKey, JSON.stringify(preferences)); } catch { /* Session settings still work. */ }
}

function element<T extends HTMLElement>(id: string): T {
  return document.getElementById(id) as T;
}

export function renderGuide(preferences: Preferences) {
  const guideRows = [
    { title: '左右移动', controls: ['left', 'right'] },
    { title: '跳跃 / 二段跳', controls: ['jump'] },
    { title: '地面 / 空中冲刺', controls: ['dash'] },
    { title: '下穿平台', controls: ['down', 'jump'], join: ' + ' },
    { title: '防御', controls: ['down'] },
    { title: '普攻 / 空中攻击', controls: ['A'] },
    { title: '地面挑空（见招式表）', controls: ['up', 'A'], join: ' + ' },
    { title: '进攻技（远程优先）', controls: ['B'] },
    { title: '特色技', controls: ['C'] },
    { title: '代表大招', controls: ['ULT'] },
    { title: '战术大招（见招式表）', controls: ['up', 'ULT'], join: ' + ' },
    { title: '进阶大招（如 JO 觉醒）', controls: ['down', 'ULT'], join: ' + ' }
  ] as const;
  for (const seat of seats) {
    const list = element(seat === 0 ? 'guide-one' : 'guide-two');
    list.replaceChildren();
    for (const row of guideRows) {
      const pair = document.createElement('div');
      const label = document.createElement('dt');
      const keys = document.createElement('dd');
      label.textContent = row.title;
      row.controls.forEach((control, index) => {
        if (index) keys.append('join' in row ? row.join : ' ');
        const key = document.createElement('kbd');
        key.textContent = keyLabel(preferences.bindings[seat][control]);
        keys.append(key);
      });
      pair.append(label, keys);
      list.append(pair);
    }
  }
  const routes = document.getElementById('guide-routes');
  if (routes) {
    const kbd = (label: string) => {
      const node = document.createElement('kbd');
      node.textContent = label;
      return node;
    };
    const b = keyLabel(preferences.bindings[0].B);
    const c = keyLabel(preferences.bindings[0].C);
    const downUlt = keyLabel(preferences.bindings[0].down) + ' + ' + keyLabel(preferences.bindings[0].ULT);
    const title = document.createElement('strong');
    title.textContent = '上手主线（当前键位）：';
    routes.replaceChildren(
      title,
      '大肥鱼「', kbd(b), ' 投饭束缚 → ', kbd(c), ' 接旋风」 · ',
      '奶蛙「按住 ', kbd(c), ' 等对手出手 → 绕背」 · ',
      '咕咕嘎嘎「', kbd(c), ' 放炮台 → 用 ', kbd(b), ' 剑波牵制」 · ',
      '香蕉猫「按住 ', kbd(c), ' 补泪 → ', kbd(b), ' 喷射（满 3 格按 ', kbd(downUlt), ' 觉醒）」'
    );
  }
}

export function installSettings(preferences: Preferences, changed: () => void) {
  const dialog = element<HTMLDialogElement>('settings');
  const volume = element<HTMLInputElement>('volume');
  const volumeLabel = element<HTMLOutputElement>('volume-value');
  const sfxVolume = element<HTMLInputElement>('sfx-volume');
  const sfxLabel = element<HTMLOutputElement>('sfx-volume-value');
  const voiceVolume = element<HTMLInputElement>('voice-volume');
  const voiceLabel = element<HTMLOutputElement>('voice-volume-value');
  const bgmVolume = element<HTMLInputElement>('bgm-volume');
  const bgmLabel = element<HTMLOutputElement>('bgm-volume-value');
  const camera = element<HTMLSelectElement>('camera');
  const shake = element<HTMLInputElement>('shake');
  const developerMode = element<HTMLInputElement>('developer-mode');
  const status = element('binding-message');
  const save = element<HTMLButtonElement>('settings-close');
  const buttons: Array<{ seat: Seat; control: Control; node: HTMLButtonElement }> = [];
  let awaiting: (typeof buttons)[number] | undefined;
  let draft: Duo<Bindings> = [{ ...preferences.bindings[0] }, { ...preferences.bindings[1] }];

  function conflicts() {
    const counts = new Map<string, number>();
    for (const seat of seats) for (const control of controls) {
      const key = draft[seat][control];
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return new Set([...counts].filter(([, count]) => count > 1).map(([key]) => key));
  }

  function showDraftStatus() {
    const keys = [...conflicts()];
    status.textContent = keys.length
      ? '按键冲突：' + keys.map(keyLabel).join('、') + '。请修改标红的键位后保存。'
      : '键位可以保存，点击右上角「完成」。';
  }

  function render() {
    volume.value = String(preferences.volume);
    volumeLabel.value = preferences.volume + '%';
    sfxVolume.value = String(preferences.sfxVolume);
    sfxLabel.value = preferences.sfxVolume + '%';
    voiceVolume.value = String(preferences.voiceVolume);
    voiceLabel.value = preferences.voiceVolume + '%';
    bgmVolume.value = String(preferences.bgmVolume);
    bgmLabel.value = preferences.bgmVolume + '%';
    camera.value = preferences.camera;
    shake.checked = preferences.shake;
    developerMode.checked = preferences.developerMode;
    const repeated = conflicts();
    save.disabled = repeated.size > 0;
    status.dataset.conflict = String(repeated.size > 0);
    for (const { seat, control, node } of buttons) {
      const recording = node === awaiting?.node;
      const conflict = repeated.has(draft[seat][control]);
      const key = keyLabel(draft[seat][control]);
      node.textContent = recording ? '按新键…' : key;
      node.dataset.conflict = String(conflict);
      node.setAttribute('aria-label', 'P' + (seat + 1) + ' ' + namedControls[control] + '，' + key + (conflict ? '，按键冲突' : ''));
      node.setAttribute('aria-pressed', String(recording));
    }
  }

  for (const seat of seats) {
    const list = element(seat === 0 ? 'bindings-one' : 'bindings-two');
    for (const control of controls) {
      const row = document.createElement('div');
      const label = document.createElement('dt');
      label.textContent = namedControls[control];
      const key = document.createElement('dd');
      const node = document.createElement('button');
      node.type = 'button';
      node.className = 'subtle bind-key';
      const binding = { seat, control, node };
      buttons.push(binding);
      node.addEventListener('click', () => {
        awaiting = binding;
        status.textContent = '正在改 P' + (seat + 1) + ' 的「' + namedControls[control] + '」。按 Esc 取消。';
        render();
      });
      key.append(node);
      row.append(label, key);
      list.append(row);
    }
  }

  function commit() {
    storePreferences(preferences);
    render();
    changed();
  }
  volume.addEventListener('input', () => { preferences.volume = Number(volume.value); commit(); });
  sfxVolume.addEventListener('input', () => { preferences.sfxVolume = Number(sfxVolume.value); commit(); });
  voiceVolume.addEventListener('input', () => { preferences.voiceVolume = Number(voiceVolume.value); commit(); });
  bgmVolume.addEventListener('input', () => { preferences.bgmVolume = Number(bgmVolume.value); commit(); });
  camera.addEventListener('change', () => { preferences.camera = camera.value === 'focus' ? 'focus' : 'wide'; commit(); });
  shake.addEventListener('change', () => { preferences.shake = shake.checked; commit(); });
  developerMode.addEventListener('change', () => { preferences.developerMode = developerMode.checked; commit(); });
  element('reset-bindings').addEventListener('click', () => {
    awaiting = undefined;
    draft = resetBindings();
    showDraftStatus();
    render();
  });
  element('cancel-bindings').addEventListener('click', () => {
    awaiting = undefined;
    draft = [{ ...preferences.bindings[0] }, { ...preferences.bindings[1] }];
    status.textContent = '已放弃未保存的键位修改。';
    render();
  });
  save.addEventListener('click', () => {
    if (conflicts().size) { showDraftStatus(); render(); return; }
    preferences.bindings = [{ ...draft[0] }, { ...draft[1] }];
    commit();
    void closeDialogSmooth(dialog);
  });
  dialog.addEventListener('cancel', event => {
    event.preventDefault();
    void closeDialogSmooth(dialog);
  });
  dialog.addEventListener('close', () => { awaiting = undefined; });
  dialog.addEventListener('keydown', event => {
    if (!awaiting || event.repeat || event.metaKey || event.ctrlKey || event.altKey || event.code === 'Tab') return;
    event.preventDefault();
    if (event.code === 'Escape') {
      awaiting = undefined;
      if (conflicts().size) showDraftStatus();
      else status.textContent = '已取消本次按键录入。';
      render();
      return;
    }
    if (!bindable(event.code)) {
      status.textContent = '请用字母、方向、数字或常用标点。H、R、Esc 保留给游戏操作。';
      return;
    }
    const { seat, control } = awaiting;
    draft[seat][control] = event.code;
    awaiting = undefined;
    showDraftStatus();
    render();
  });

  return {
    dialog,
    open() {
      awaiting = undefined;
      draft = [{ ...preferences.bindings[0] }, { ...preferences.bindings[1] }];
      status.textContent = '点击要修改的键位，再按新键。';
      render();
      dialog.showModal();
    }
  };
}

export function keyHint(preferences: Preferences, seat: Seat, controlsToShow: Control[], divider = ' / ') {
  return controlsToShow.map(control => keyLabel(preferences.bindings[seat][control])).join(divider);
}

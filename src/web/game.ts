import { rules } from '../content/demo.js';
import { arenas } from '../content/arenas.js';
import { roster } from '../content/roster.js';
import { createMatch, step } from '../core/match.js';
import { NEUTRAL, type ActionKey, type Axis, type Duo, type InputFrame, type MatchConfig, type RoundResult, type Stick } from '../core/types.js';
import { arcadeArt, arenaArt, fighterArt } from './art.js';
import { FightAudio } from './audio.js';
import { cpuInput } from './cpu.js';
import { previewArena, Renderer } from './renderer.js';
import { bindingMap, installSettings, keyHint, loadPreferences, renderGuide, type Seat } from './settings.js';

function element<T extends HTMLElement>(id: string): T {
  return document.getElementById(id) as T;
}

function text(node: HTMLElement, value: string) {
  if (node.textContent !== value) node.textContent = value;
}

function image(src: string) {
  const img = new Image();
  img.src = src;
  img.alt = '';
  return img;
}

type Screen = 'title' | 'menu' | 'roster' | 'maps' | 'versus' | 'match' | 'pause' | 'result';
const screenIds: Screen[] = ['title', 'menu', 'roster', 'maps', 'versus', 'match', 'pause', 'result'];
const modeNames = { local: '本地双人', cpu: '人机对战', training: '自由训练' };
type Mode = keyof typeof modeNames;
const seats = [0, 1] as const;
const namesSuffix = ['one', 'two'] as const;
const reasons = { ko: '击倒', time: '超时 · 生命比例领先', tie: '超时 · 生命比例相同', 'double-ko': '双 KO' };
const previousScreen: Partial<Record<Screen, Screen>> = {
  menu: 'title', roster: 'menu', maps: 'roster', versus: 'maps', result: 'menu'
};

const stage = element('stage');
const canvas = element<HTMLCanvasElement>('arena');
const mapCanvas = element<HTMLCanvasElement>('map-canvas');
const guide = element<HTMLDialogElement>('guide');
const debugButton = element<HTMLButtonElement>('debug');
const rosterGrid = element('fighter-grid');
const arenaChoices = element('arena-choices');
const pickArena = element<HTMLButtonElement>('pick-arena');
const routeToggle = element<HTMLButtonElement>('route-preview');
const fullscreen = element<HTMLButtonElement>('fullscreen');
const trainingDummy = element<HTMLSelectElement>('training-dummy');
const trainingSpeed = element<HTMLSelectElement>('training-speed');
const roundLimit = element<HTMLSelectElement>('round-limit');
const roundWins = element<HTMLSelectElement>('round-wins');
const trainingGround = element('training-ground');
const trainingBest = element('training-best');
const announcement = element('announcement');
const readyText = document.createElement('span');
const readyMap = document.createElement('small');
announcement.append(readyText, readyMap);
const timer = element('time');
const roundLabel = element('round');
const names = namesSuffix.map(id => element('name-' + id));
const scores = namesSuffix.map(id => element('score-' + id));
const healthBars = namesSuffix.map(id => element('hp-' + id));
const guardBars = namesSuffix.map(id => element('guard-' + id));
const combos = namesSuffix.map(id => element('combo-' + id));
const portraits = namesSuffix.map(id => element<HTMLImageElement>('portrait-' + id));
const panels = namesSuffix.map(id => element('fighter-panel-' + id));
const seatButtons = namesSuffix.map(id => element('seat-' + id));
const lockButtons = namesSuffix.map(id => element('lock-' + id));
const modeButtons = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-mode]'));
const stageTabs = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-stage-tab]'));
const nav = element('preflight-nav');
const screens = Object.fromEntries(screenIds.map(id => [id, element(id + '-screen')])) as Record<Screen, HTMLElement>;

const config: MatchConfig = { rules, arena: arenas[0], fighters: [roster[0].fighter, roster[3].fighter] };
const selected: Duo<number> = [0, 3];
const confirmed: Duo<boolean> = [false, false];
const pending: Duo<Map<ActionKey, Stick>> = [new Map(), new Map()];
const held = new Set<string>();
const audio = new FightAudio();
const renderer = new Renderer(canvas, config.arena);
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const preferences = loadPreferences();

let bindings = bindingMap(preferences);
let state = createMatch(config);
let roundHistory: Array<RoundResult & { round: number }> = [];
let mode: Mode = 'local';
let screen: Screen = 'title';
let activeSeat: Seat = 0;
let arenaIndex = 0;
let routeVisible = true;
let debug = false;
let bestTier = 0;
let lastTime = 0;
let debt = 0;
let introRemaining = 0;
let fightCueUntil = 0;
let toastTimer = 0;
let windowFit = false;

const settings = installSettings(preferences, () => {
  clearInputs();
  bindings = bindingMap(preferences);
  audio.volume = preferences.volume / 100;
  audio.enableFromGesture();
  renderGuide(preferences);
  footer();
});
audio.volume = preferences.volume / 100;
renderGuide(preferences);

stage.style.setProperty('--arcade-art', 'url("' + arcadeArt + '")');
element<HTMLImageElement>('menu-backdrop').src = arenaArt.station;
element<HTMLImageElement>('menu-feature').src = fighterArt.gaga;

const tiles = roster.map((entry, index) => {
  const src = fighterArt[entry.fighter.id];
  const backdrop = document.createElement('div');
  backdrop.style.setProperty('--accent', entry.accent);
  backdrop.append(image(src));
  element('title-bg').append(backdrop);
  element('title-art').append(image(src));

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'fighter-tile';
  button.dataset.fighter = entry.fighter.id;
  button.style.setProperty('--accent', entry.accent);
  button.setAttribute('aria-label', entry.fighter.name);
  const label = document.createElement('span');
  label.className = 'tile-name';
  label.textContent = entry.fighter.name;
  const badges = document.createElement('div');
  badges.className = 'tile-badges';
  badges.setAttribute('aria-hidden', 'true');
  badges.append(document.createElement('span'), document.createElement('span'));
  button.append(image(src), label, badges);
  button.addEventListener('click', () => selectFighter(activeSeat, index));
  rosterGrid.append(button);
  return { button, badges };
});

const mapButtons = arenas.map((arena, index) => {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'map-choice';
  button.setAttribute('aria-label', arena.name);
  const thumbnail = document.createElement('canvas');
  thumbnail.width = 320;
  thumbnail.height = 180;
  thumbnail.setAttribute('aria-hidden', 'true');
  previewArena(thumbnail, arena);
  const body = document.createElement('span');
  const name = document.createElement('b');
  const terrain = document.createElement('small');
  name.textContent = arena.name;
  terrain.textContent = arena.terrain;
  body.append(name, terrain);
  button.append(thumbnail, body);
  button.addEventListener('click', () => selectArena(index));
  arenaChoices.append(button);
  return button;
});

function seatName(seat: Seat) {
  return seat === 0 ? 'P1' : mode === 'cpu' ? '电脑' : mode === 'training' ? '陪练' : 'P2';
}

function footer() {
  const fighting = screen === 'match' || screen === 'pause';
  text(element('footer-main'), fighting ? modeNames[mode] + ' · ' + config.arena.name : 'Meme 乱斗 · 抽象之王');
  const hints = screen === 'roster'
    ? 'P1 ' + keyHint(preferences, 0, ['left', 'right', 'up', 'down'], ' ') + ' 移动 · ' +
      keyHint(preferences, 0, ['A']) + ' 确认' + (mode === 'local'
        ? '　　P2 ' + keyHint(preferences, 1, ['left', 'right', 'up', 'down'], ' ') + ' 移动 · ' +
          keyHint(preferences, 1, ['A']) + ' 确认' : '')
    : screen === 'maps' ? '方向键换图 · Enter 进场 · Esc 返回'
    : screen === 'menu' ? '↑ / ↓ 选模式 · Enter 确认'
    : fighting ? 'P1 ' + keyHint(preferences, 0, ['jump']) + ' 跳 · ' +
        keyHint(preferences, 0, ['down', 'jump'], ' + ') + ' 下穿' +
        (mode === 'local' ? '　　P2 ' + keyHint(preferences, 1, ['down', 'jump'], ' + ') + ' 下穿' : '')
    : screen === 'title' ? '桌面浏览器 · 键盘操作' : 'Esc 返回';
  text(element('footer-detail'), hints);
}

function notify(message: string) {
  const node = element('ui-notice');
  text(node, message);
  node.hidden = false;
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => { node.hidden = true; }, 2200);
}

function clearInputs() {
  held.clear();
  for (const seat of seats) {
    pending[seat].clear();
    state.fighters[seat].buffer = [];
  }
}

function renderPreparationNav() {
  nav.hidden = screen !== 'menu' && screen !== 'roster' && screen !== 'maps';
  for (const tab of stageTabs) {
    const target = tab.dataset.stageTab;
    tab.disabled = (target === 'roster' && screen === 'menu') ||
      (target === 'maps' && (screen === 'menu' || !confirmed.every(Boolean)));
    if (target === screen) tab.setAttribute('aria-current', 'step');
    else tab.removeAttribute('aria-current');
  }
}

function show(next: Screen) {
  clearInputs();
  window.clearTimeout(toastTimer);
  element('ui-notice').hidden = true;
  debt = 0;
  screen = next;
  stage.dataset.screen = next;
  stage.dataset.phase = next === 'match' ? state.phase : next;
  for (const id of screenIds) {
    screens[id].hidden = id !== next && !(id === 'match' && next === 'pause');
  }
  screens.match.inert = next === 'pause';
  if (next === 'roster') renderRoster();
  if (next === 'maps') {
    text(element('map-matchup'), roster[selected[0]].fighter.name + '  VS  ' + roster[selected[1]].fighter.name);
    element('map-rules').hidden = mode === 'training';
    element('training-rule').hidden = mode !== 'training';
    selectArena(arenaIndex);
  }
  renderPreparationNav();
  footer();
}

function go(next: Screen) {
  if (next === 'roster' && screen !== 'maps' && screen !== 'roster') {
    confirmed.fill(false);
    activeSeat = 0;
  }
  show(next);
  if (next === 'title') element('enter').focus();
  if (next === 'menu') modeButtons.find(button => button.dataset.mode === mode)?.focus();
  if (next === 'roster') seatButtons[activeSeat].focus();
  if (next === 'maps') mapButtons[arenaIndex].focus();
}

function selectMode(next: Mode) {
  mode = next;
  for (const node of document.querySelectorAll<HTMLElement>('[data-mode-name]')) text(node, modeNames[mode]);
  go('roster');
}

function renderRoster() {
  for (const seat of seats) {
    const entry = roster[selected[seat]];
    const who = seatName(seat);
    seatButtons[seat].textContent = who + (seat === 1 && mode !== 'local' ? '角色' : ' 选角');
    seatButtons[seat].setAttribute('aria-pressed', String(seat === activeSeat));
    const art = panels[seat].querySelector<HTMLImageElement>('.pick-art')!;
    const src = fighterArt[entry.fighter.id];
    if (art.getAttribute('src') !== src) art.src = src;
    text(panels[seat].querySelector('h3')!, entry.fighter.name);
    const enabledSlots = new Set(entry.fighter.actions.filter(action => action.slot !== 'A').map(action => action.slot));
    text(panels[seat].querySelector('p')!,
      enabledSlots.size ? '已接入专属动作槽 ' + enabledSlots.size + ' / 2' : '专属槽 1 / 2 待接入');
    lockButtons[seat].setAttribute('aria-pressed', String(confirmed[seat]));
    text(lockButtons[seat], confirmed[seat] ? who + ' 已确认' : '确认 ' + who);
  }
  for (const [index, { button, badges }] of tiles.entries()) {
    button.dataset.p1 = String(selected[0] === index);
    button.dataset.p2 = String(selected[1] === index);
    button.setAttribute('aria-pressed', String(selected[activeSeat] === index));
    for (const seat of seats) {
      const badge = badges.children[seat] as HTMLElement;
      badge.hidden = selected[seat] !== index;
      badge.textContent = seatName(seat);
    }
  }
  const ready = confirmed.every(Boolean);
  pickArena.disabled = !ready;
  text(element('roster-help'), ready ? '双方已确认，继续选图' : '正在为 ' + seatName(activeSeat) + ' 选角');
  renderPreparationNav();
}

function selectFighter(seat: Seat, index: number) {
  activeSeat = seat;
  if (selected[seat] !== index) {
    selected[seat] = index;
    confirmed[seat] = false;
  }
  renderRoster();
}

function confirmSeat(seat: Seat) {
  const partner = seat === 0 ? 1 : 0;
  confirmed[seat] = !confirmed[seat];
  activeSeat = confirmed[seat] && !confirmed[partner] ? partner : seat;
  renderRoster();
  if (confirmed.every(Boolean)) pickArena.focus();
}

function selectArena(index: number) {
  arenaIndex = index;
  const arena = arenas[index];
  stage.dataset.arena = arena.id;
  for (const [id, button] of mapButtons.entries()) button.setAttribute('aria-pressed', String(index === id));
  text(element('map-name'), arena.name);
  text(element('map-count'), new Set(arena.platforms.map(platform => platform.tier)).size +
    ' 层 · ' + arena.platforms.length + ' 处平台');
  text(element('map-description'), arena.description);
  const routeNames = arena.route.map(id => arena.platforms.find(platform => platform.id === id)!.name);
  const routeLine = element('map-route');
  text(routeLine, ['地面', ...routeNames].join('  →  '));
  routeLine.hidden = !routeVisible;
  routeToggle.setAttribute('aria-pressed', String(routeVisible));
  previewArena(mapCanvas, arena, routeVisible);
}

function configureMatch(immediate: boolean) {
  config.arena = arenas[arenaIndex];
  config.fighters = [roster[selected[0]].fighter, roster[selected[1]].fighter];
  config.training = mode === 'training';
  config.rules = config.training ? rules : {
    ...rules,
    roundSeconds: Number(roundLimit.value),
    winsToFinish: Number(roundWins.value)
  };
  state = createMatch(config);
  roundHistory = [];
  bestTier = 0;
  fightCueUntil = 0;
  if (immediate) state.phase = 'fight';
  for (const seat of seats) {
    const def = config.fighters[seat];
    portraits[seat].dataset.fighter = def.id;
    portraits[seat].src = fighterArt[def.id];
    healthBars[seat].parentElement!.setAttribute('aria-valuemax', String(def.maxHp));
    guardBars[seat].parentElement!.setAttribute('aria-valuemax', String(rules.guardMax));
  }
  renderer.load(config.arena);
  element('training-tools').hidden = !config.training;
  element('step-training').hidden = !config.training;
  element('match-tag').hidden = Boolean(config.training);
  text(element('match-tag'), config.arena.name);
}

function enterMatch() {
  show('match');
  renderHUD();
  draw(0);
  canvas.focus();
}

function startMatch(immediate = false) {
  audio.enableFromGesture();
  configureMatch(immediate);
  if (immediate || reducedMotion.matches) {
    enterMatch();
    return;
  }
  for (const seat of seats) {
    const side = namesSuffix[seat];
    const def = config.fighters[seat];
    element<HTMLImageElement>('versus-art-' + side).src = fighterArt[def.id];
    text(element('versus-seat-' + side), seatName(seat));
    text(element('versus-fighter-' + side), def.name);
  }
  text(element('versus-title'), config.arena.name);
  const format = config.rules.winsToFinish === 1 ? '一回合决胜' : '先赢 ' + config.rules.winsToFinish + ' 回合';
  text(element('versus-rules'), config.training ? '自由训练 · 无时限' :
    modeNames[mode] + ' · ' + config.rules.roundSeconds + ' 秒 / 回合 · ' + format);
  introRemaining = 1650;
  show('versus');
  element('skip-versus').focus();
}

function pauseSummary() {
  text(element('pause-summary'), config.arena.name + (config.training
    ? ' · 第 ' + state.frame + ' 帧'
    : ' · 第 ' + state.round + ' 回合 · ' + state.wins.join(' : ')));
}

function pauseMatch() {
  show('pause');
  pauseSummary();
  element('resume').focus();
}

function endMatch() {
  const winner = state.winner;
  screens.result.classList.toggle('no-winner', winner === null);
  element('result-art-frame').hidden = winner === null;
  if (winner !== null) element<HTMLImageElement>('result-art').src = fighterArt[config.fighters[winner].id];
  text(element('result-map'), modeNames[mode] + ' · ' + config.arena.name);
  text(element('result-title'), winner === null ? '整场平局' : seatName(winner) + ' 获胜');
  text(element('result-one'), config.fighters[0].name);
  text(element('result-two'), config.fighters[1].name);
  text(element('result-score'), state.wins.join(' : '));
  text(element('result-reason'), state.result ? '最后回合 · ' + reasons[state.result.reason] : '');
  element('round-history').replaceChildren(...roundHistory.map(record => {
    const item = document.createElement('li');
    const who = record.winner === null ? '平局' : seatName(record.winner);
    text(item, '第 ' + record.round + ' 回合 · ' + who + ' · ' + reasons[record.reason]);
    item.dataset.outcome = record.winner === null ? 'draw' : String(record.winner + 1);
    return item;
  }));
  show('result');
  element('rematch').focus();
}

function toggleDebug() {
  debug = !debug;
  debugButton.setAttribute('aria-pressed', String(debug));
  if (screen === 'match') {
    draw(0);
    canvas.focus();
  }
}

function openSettings() {
  if (screen === 'match') pauseMatch();
  settings.open();
}

element('home').addEventListener('click', () => screen === 'match' ? pauseMatch() : go('title'));
element('enter').addEventListener('click', () => { audio.enableFromGesture(); go('menu'); });
for (const button of modeButtons) button.addEventListener('click', () => selectMode(button.dataset.mode as Mode));
for (const button of stageTabs) button.addEventListener('click', () => {
  const target = button.dataset.stageTab as Screen;
  if (target !== screen) go(target);
});
for (const button of document.querySelectorAll<HTMLButtonElement>('[data-go]')) {
  button.addEventListener('click', () => go(button.dataset.go as Screen));
}
for (const seat of seats) {
  seatButtons[seat].addEventListener('click', () => { activeSeat = seat; renderRoster(); });
  lockButtons[seat].addEventListener('click', () => confirmSeat(seat));
}

pickArena.addEventListener('click', () => go('maps'));
routeToggle.addEventListener('click', () => { routeVisible = !routeVisible; selectArena(arenaIndex); });
element('start').addEventListener('click', () => startMatch());
element('skip-versus').addEventListener('click', enterMatch);
element('resume').addEventListener('click', enterMatch);
element('pause').addEventListener('click', pauseMatch);
element('restart').addEventListener('click', () => startMatch(Boolean(config.training)));
element('rematch').addEventListener('click', () => startMatch());
element('reset-training').addEventListener('click', () => startMatch(true));
element('step-training').addEventListener('click', () => {
  if (screen !== 'pause' || !config.training) return;
  tick(NEUTRAL);
  renderHUD();
  stage.dataset.phase = 'pause';
  pauseSummary();
  draw(0);
});
trainingDummy.addEventListener('change', () => canvas.focus());
trainingSpeed.addEventListener('change', () => canvas.focus());
debugButton.addEventListener('click', toggleDebug);
element('guide-open').addEventListener('click', () => {
  if (screen === 'match') pauseMatch();
  guide.showModal();
});
element('guide-close').addEventListener('click', () => guide.close());
element('settings-open').addEventListener('click', openSettings);
element('pause-settings').addEventListener('click', openSettings);

function refreshDisplayButton() {
  document.documentElement.classList.toggle('window-fit', windowFit);
  fullscreen.setAttribute('aria-pressed', String(windowFit || Boolean(document.fullscreenElement)));
  text(fullscreen, document.fullscreenElement ? '退出全屏' : windowFit ? '恢复窗口' :
    document.fullscreenEnabled ? '全屏' : '放大画面');
}

fullscreen.addEventListener('click', async () => {
  if (windowFit) {
    windowFit = false;
  } else if (document.fullscreenElement) {
    await document.exitFullscreen().catch(() => notify('请用 Esc 退出系统全屏。'));
  } else if (!document.fullscreenEnabled) {
    windowFit = true;
  } else {
    try {
      await document.documentElement.requestFullscreen();
    } catch {
      windowFit = true;
      notify('已切换到窗口内放大。');
    }
  }
  refreshDisplayButton();
  if (screen === 'match') canvas.focus();
});
document.addEventListener('fullscreenchange', refreshDisplayButton);
refreshDisplayButton();

function rosterKey(event: KeyboardEvent) {
  const binding = bindings.get(event.code);
  if (!binding || (binding.seat === 1 && mode !== 'local')) return false;
  const { seat, control } = binding;
  if (control === 'A') confirmSeat(seat);
  else if (control === 'left' || control === 'right') selectFighter(seat, selected[seat] ^ 1);
  else if (control === 'up' || control === 'down') selectFighter(seat, selected[seat] ^ 2);
  else return false;
  event.preventDefault();
  return true;
}

function navigationKey(event: KeyboardEvent) {
  if (event.target instanceof HTMLSelectElement) return false;
  const direction = event.code === 'ArrowDown' || event.code === 'ArrowRight' ? 1 :
    event.code === 'ArrowUp' || event.code === 'ArrowLeft' ? -1 : 0;
  if (screen === 'menu' && direction) {
    const current = modeButtons.indexOf(document.activeElement as HTMLButtonElement);
    modeButtons[(current + direction + modeButtons.length) % modeButtons.length].focus();
  } else if (screen === 'maps' && direction) {
    selectArena((arenaIndex + direction + arenas.length) % arenas.length);
    mapButtons[arenaIndex].focus();
  } else if (screen === 'maps' && event.code === 'Enter' && mapButtons.includes(document.activeElement as HTMLButtonElement)) {
    startMatch();
  } else return false;
  event.preventDefault();
  return true;
}

function stickFor(seat: Seat): Stick {
  const codes = preferences.bindings[seat];
  return {
    x: (Number(held.has(codes.right)) - Number(held.has(codes.left))) as Axis,
    y: (Number(held.has(codes.down)) - Number(held.has(codes.up))) as Axis
  };
}

window.addEventListener('keydown', event => {
  if (guide.open || settings.dialog.open || event.metaKey || event.ctrlKey || event.altKey) return;
  if (event.code === 'Escape' && !event.repeat) {
    event.preventDefault();
    if (screen === 'match') pauseMatch();
    else if (screen === 'pause') enterMatch();
    else if (previousScreen[screen]) go(previousScreen[screen]!);
    return;
  }
  if (!event.repeat && ((screen === 'roster' && rosterKey(event)) || navigationKey(event))) return;
  if (screen !== 'match' || document.activeElement !== canvas) return;
  if (event.code === 'KeyH' && !event.repeat) toggleDebug();
  if (event.code === 'KeyR' && mode === 'training' && !event.repeat) startMatch(true);
  const binding = bindings.get(event.code);
  if (!binding) return;
  event.preventDefault();
  if (held.has(event.code) || event.repeat || (binding.seat === 1 && mode !== 'local')) return;
  held.add(event.code);
  const { seat, control } = binding;
  if ((control === 'B' || control === 'C') && !config.fighters[seat].actions.some(action => action.slot === control)) {
    notify(seatName(seat) + ' 的专属槽 ' + (control === 'B' ? '1' : '2') + ' 待接入');
    return;
  }
  if (control === 'A' || control === 'B' || control === 'C' || control === 'jump' || control === 'dash') {
    pending[seat].set(control, stickFor(seat));
  }
});
window.addEventListener('keyup', event => held.delete(event.code));
canvas.addEventListener('blur', clearInputs);
function pauseOnHide() {
  if (screen === 'match') pauseMatch();
  else clearInputs();
}
window.addEventListener('blur', pauseOnHide);
document.addEventListener('visibilitychange', () => { if (document.hidden) pauseOnHide(); });

function readInput(seat: Seat): InputFrame {
  const commands = pending[seat];
  const input = { ...stickFor(seat), pressed: [...commands.keys()], sampled: Object.fromEntries(commands) };
  commands.clear();
  return input;
}

function opponentInput(): InputFrame {
  if (mode === 'local') return readInput(1);
  if (mode === 'cpu' || trainingDummy.value === 'cpu') return cpuInput(state, config);
  return trainingDummy.value === 'guard' ? { x: 0, y: 1, pressed: [] } : NEUTRAL;
}

function setMeter(node: HTMLElement, value: number, maximum: number) {
  const bar = 'scaleX(' + value / maximum + ')';
  if (node.style.transform !== bar) {
    node.style.transform = bar;
    node.parentElement!.setAttribute('aria-valuenow', String(value));
  }
}

function renderHUD() {
  if (stage.dataset.phase !== state.phase) stage.dataset.phase = state.phase;
  text(roundLabel, config.training ? '自由训练' : '第 ' + state.round + ' 回合');
  text(timer, config.training ? '∞' : String(Math.ceil(state.remaining / rules.ticksPerSecond)).padStart(2, '0'));
  for (const seat of seats) {
    const fighter = state.fighters[seat];
    text(names[seat], seatName(seat) + ' · ' + config.fighters[seat].name);
    text(scores[seat], String(state.wins[seat]));
    setMeter(healthBars[seat], fighter.hp, config.fighters[seat].maxHp);
    setMeter(guardBars[seat], fighter.guard, rules.guardMax);
    const hits = state.fighters[seat === 0 ? 1 : 0].combo;
    combos[seat].hidden = hits < 2;
    if (hits >= 2) text(combos[seat], hits + ' 连击');
  }
  if (config.training) {
    const support = state.fighters[0].ground;
    const platform = config.arena.platforms.find(item => item.id === support);
    if (platform) bestTier = Math.max(bestTier, platform.tier);
    if (trainingGround.dataset.platform !== (support ?? 'air')) trainingGround.dataset.platform = support ?? 'air';
    text(trainingGround, platform ? platform.name : support ? '地面' : '空中');
    text(trainingBest, bestTier ? '已登第 ' + bestTier + ' 层' : '找一处低层平台起跳');
  }

  const result = state.result;
  let display = '';
  let caption = '';
  if (state.phase === 'ready') {
    display = state.phaseTicks > 65 && !config.training ? '第 ' + state.round + ' 回合' : '准备';
    caption = config.arena.name;
  } else if (state.phase === 'round-over' && result) {
    display = result.reason === 'ko' ? 'K.O.' : result.reason === 'double-ko' ? '双 K.O.' :
      result.winner === null ? '平局' : seatName(result.winner) + ' 领先';
    caption = reasons[result.reason];
  } else if (state.phase === 'fight' && state.frame < fightCueUntil) {
    display = config.training ? '开始练习' : '开战';
  }
  text(readyText, display);
  text(readyMap, caption);
  readyMap.hidden = !caption;
  announcement.hidden = !display;
}

function tick(player: InputFrame) {
  const previous = state.phase;
  const events = step(state, [player, opponentInput()], config);
  if (previous === 'ready' && state.phase === 'fight') fightCueUntil = state.frame + 30;
  if (previous === 'fight' && state.phase === 'round-over' && state.result) {
    roundHistory.push({ ...state.result, round: state.round });
  }
  renderer.add(events);
  audio.play(events);
}

function draw(elapsed: number) {
  renderer.draw(config, state, debug, elapsed, preferences.shake && !reducedMotion.matches,
    preferences.camera === 'focus' && !reducedMotion.matches);
}

function frame(now: number) {
  const elapsed = Math.min(now - (lastTime || now), 100);
  const tickMs = 1000 / rules.ticksPerSecond;
  lastTime = now;
  if (screen === 'versus' && !document.hidden && !guide.open && !settings.dialog.open) {
    introRemaining -= elapsed;
    if (introRemaining <= 0) enterMatch();
  }
  if (screen === 'match') {
    debt += elapsed * (config.training ? Number(trainingSpeed.value) : 1);
    while (debt >= tickMs) {
      tick(readInput(0));
      debt -= tickMs;
      if (state.phase === 'match-over') {
        endMatch();
        break;
      }
    }
    if (screen === 'match') {
      renderHUD();
      draw(elapsed / tickMs);
    }
  }
  requestAnimationFrame(frame);
}

go('title');
requestAnimationFrame(frame);

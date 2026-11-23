import { rules } from '../content/demo.js';
import { arenas } from '../content/arenas.js';
import { roster } from '../content/roster.js';
import { actionFor, createMatch, step } from '../core/match.js';
import {frogPowered} from '../core/frog-kit.js';
import { ENERGY_PER_STOCK, MAX_ENERGY, NEUTRAL, type ActionKey, type Axis, type Duo, type FighterDefinition, type InputFrame, type MatchConfig, type RoundResult, type Stick } from '../core/types.js';
import { arcadeArt, arenaArt, fighterArt } from './art.js';
import { FightAudio } from './audio.js';
import { cpuInput } from './cpu.js';
import { tierAt } from '../core/terrain.js';
import { previewArena, recoveryLabels, Renderer } from './renderer.js';
import { bindingMap, installSettings, keyHint, loadPreferences, renderGuide, type Control, type Seat } from './settings.js';

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
const trainingPanel = element<HTMLDetailsElement>('training-panel');
const roundLimit = element<HTMLSelectElement>('round-limit');
const roundWins = element<HTMLSelectElement>('round-wins');
const fillTrainingEnergy = element('fill-training-energy');
const trainingGround = element('training-ground');
const trainingBest = element('training-best');
const trainingReadout = element('training-readout');
const trainingStates = namesSuffix.map(id => element('training-state-' + id));
const trainingInputLine = element('training-pending');
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
const healthValues = namesSuffix.map(id => element('hp-value-' + id));
const guardValues = namesSuffix.map(id => element('guard-value-' + id));
const healthTrails = namesSuffix.map(id => element('hp-trail-' + id));
const winPips = namesSuffix.map(id => element('wins-' + id));
const energyRows = namesSuffix.map(id => element('energy-row-' + id));
const energyBars = namesSuffix.map(id => element('energy-' + id));
const energyLabels = namesSuffix.map(id => element('energy-label-' + id));
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
let lastChains: Duo<{ hits: number; until: number } | null> = [null, null];
let lifeDisplay: Duo<{ hp: number; trail: number; holdUntil: number; frame: number } | null> = [null, null];
const trainingInputs: string[] = [];
let trainingDownHeld = false;
let mode: Mode = 'local';
let screen: Screen = 'title';
let activeSeat: Seat = 0;
let arenaIndex = Math.max(0, arenas.findIndex(arena => arena.id === 'harbor'));
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
  audio.volume = new URLSearchParams(location.search).has('silent') ? 0 : preferences.volume / 100;
  audio.enableFromGesture();
  renderGuide(preferences);
  if (screen === 'roster') renderRoster();
  footer();
});
audio.volume = new URLSearchParams(location.search).has('silent') ? 0 : preferences.volume / 100;
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

function trainingSkillHints(fighter: FighterDefinition) {
  if(fighter.id==='whale')return whaleInputHints(0);
  if(fighter.id==='frog')return frogInputHints(0);
  const hints: string[] = [];
  if (acceptsSkillInput(fighter, 'ULT')) hints.push(keyHint(preferences, 0, ['ULT']) + ' 大招');
  if (fighter.guardCounter) hints.push(keyHint(preferences, 0, ['down']) + ' 精准防反');
  for (const move of fighter.actions) {
    if (!('counterTo' in move) || move.linkOnly) continue;
    const keys: string[] = [];
    if (move.direction === 'forward') keys.push('前');
    if (move.direction === 'back') keys.push('后');
    if (move.direction === 'up' || move.direction === 'down') keys.push(keyHint(preferences, 0, [move.direction]));
    keys.push(keyHint(preferences, 0, [move.slot]));
    hints.push(keys.join(' + ') + ' 防反架势');
  }
  return hints.join(' · ');
}

function frogInputHints(seat:Seat){
 return keyHint(preferences,seat,['A'])+' 五段拳脚 · '+keyHint(preferences,seat,['B'])+' 捧腹 · '+keyHint(preferences,seat,['up','B'],'＋')+' 全图冲击 · 按住'+keyHint(preferences,seat,['C'])+' 下蹲绕背 · '+keyHint(preferences,seat,['up','C'],'＋')+' 脚下钻出 · '+keyHint(preferences,seat,['ULT'])+' 天使变身';
}

function whaleInputHints(seat:Seat){
  return keyHint(preferences,seat,['A'])+' 三段尾击 · '+keyHint(preferences,seat,['B'])+' 米饭 · '+keyHint(preferences,seat,['C'])+' 旋风 · '+keyHint(preferences,seat,['ULT'])+' 开源！';
}

function footer() {
  const fighting = screen === 'match' || screen === 'pause';
  const confirmKey = keyHint(preferences, 0, ['A']);
  const backKey = keyHint(preferences, 0, ['jump']);
  const upDown = keyHint(preferences, 0, ['up', 'down']);
  const skills = screen === 'match' && mode === 'training' ? trainingSkillHints(config.fighters[0]) : '';
  text(element('footer-main'), fighting ? modeNames[mode] + ' · ' + config.arena.name : 'Meme 乱斗 · 抽象之王');
  const hints = screen === 'roster'
    ? 'P1 ' + keyHint(preferences, 0, ['left', 'right', 'up', 'down'], ' ') + ' 移动 · ' +
      keyHint(preferences, 0, ['A']) + ' 确认' + (mode === 'local'
        ? '　　P2 ' + keyHint(preferences, 1, ['left', 'right', 'up', 'down'], ' ') + ' 移动 · ' +
          keyHint(preferences, 1, ['A']) + ' 确认' : '')
    : screen === 'maps' ? upDown + ' 换图 · ' + confirmKey + ' 进场 · ' + backKey + ' 返回'
    : screen === 'menu' ? upDown + ' 选模式 · ' + confirmKey + ' 确认'
    : screen === 'title' ? confirmKey + ' 进入游戏'
    : screen === 'result' || screen === 'pause' ? upDown + ' 选择 · ' + confirmKey + ' 确认 · Esc 返回'
    : skills ? 'P1 ' + skills
    : fighting && config.fighters[0].id==='frog' ? 'P1 '+frogInputHints(0)+(mode==='local'&&config.fighters[1].id==='frog'?'　P2 '+frogInputHints(1):'')
    : fighting && config.fighters[0].id==='whale' ? 'P1 '+whaleInputHints(0)+(mode==='local'&&config.fighters[1].id==='whale'?'　P2 '+whaleInputHints(1):'')
    : fighting ? 'P1 ' + keyHint(preferences, 0, ['A']) + ' 普攻 · ' +
        keyHint(preferences, 0, ['up', 'A'], ' + ') + ' 挑空' +
        (mode === 'local' ? (config.fighters[1].id==='whale'?'　P2 '+whaleInputHints(1):'　　P2 ' + keyHint(preferences, 1, ['up', 'A'], ' + ') + ' 挑空')
          : ' · ' + keyHint(preferences, 0, ['dash']) + ' 空中冲刺')
    : 'Esc 返回';
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
  if (next !== 'match') trainingPanel.open = false;
  stage.dataset.screen = next;
  stage.dataset.phase = next === 'match' ? state.phase : next;
  for (const id of screenIds) {
    screens[id].hidden = id !== next && !(id === 'match' && next === 'pause');
  }
  screens.match.inert = next === 'pause';
  const modeLabel = screens[next].querySelector<HTMLElement>('[data-mode-name]');
  if (modeLabel) text(modeLabel, modeNames[mode]);
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
  go('roster');
}

function acceptsSkillInput(fighter: FighterDefinition, slot: 'B' | 'C' | 'ULT') {
  return fighter.actions.some(move => move.slot === slot && (!move.linkOnly || fighter.actions.some(source =>
    source.cancelOnHit?.includes(move.id) || source.cancelOnHit?.includes(slot))));
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
    const enabledSlots = (['B', 'C'] as const).filter(slot => acceptsSkillInput(entry.fighter, slot));
    const skills = enabledSlots.length ? ['可用专属槽 · ' + enabledSlots.join(' / ')] : [];
    if (entry.fighter.guardCounter) skills.push(entry.fighter.guardCounter.whileGuarding?'铁盆防反':'精准防反');
    if (acceptsSkillInput(entry.fighter, 'ULT')) {
      const cost = entry.fighter.ultimateCost ?? 0;
      skills.push('大招 ' + keyHint(preferences, seat, ['ULT']) + (cost ? ' · 消耗 ' + cost : ' · 无消耗'));
    }
    text(panels[seat].querySelector('p')!, skills.join(' · ') || '专属技能待接入');
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
  text(element('roster-help'), ready ? '双方已确认，按 ' + keyHint(preferences, 0, ['A']) + ' 选图' : '正在为 ' + seatName(activeSeat) + ' 选角');
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
  const screens = ((arena.right - arena.left) / canvas.width).toFixed(1);
  const tiers = new Set(arena.platforms.map(platform => platform.tier)).size;
  text(element('map-count'), screens + ' 屏宽 · ' + tiers + ' 层 · ' + arena.platforms.length + ' 处平台');
  text(element('start'), mode === 'training' ? '进入训练 ›' : '开始对战 ›');
  text(element('map-description'), arena.description);
  const routeLine = element('map-route');
  for (const [side, suffix] of namesSuffix.entries()) {
    const routeNames = arena.routes[side].map(id => arena.platforms.find(platform => platform.id === id)!.name);
    text(element('map-route-' + suffix), routeNames.join(' → '));
  }
  routeLine.hidden = !routeVisible;
  routeToggle.setAttribute('aria-pressed', String(routeVisible));
  previewArena(mapCanvas, arena, routeVisible);
}

function configureMatch(immediate: boolean) {
  config.randomSeed = crypto.getRandomValues(new Uint32Array(1))[0] || 1;
  config.arena = arenas[arenaIndex];
  stage.dataset.mode = mode;
  stage.dataset.arena = config.arena.id;
  config.fighters = [roster[selected[0]].fighter, roster[selected[1]].fighter];
  config.training = mode === 'training';
  config.rules = config.training ? rules : {
    ...rules,
    roundSeconds: Number(roundLimit.value),
    winsToFinish: Number(roundWins.value)
  };
  state = createMatch(config);
  roundHistory = [];
  lastChains = [null, null];
  lifeDisplay = [null, null];
  trainingInputs.length = 0;
  trainingDownHeld = false;
  bestTier = 0;
  fightCueUntil = 0;
  if (immediate) state.phase = 'fight';
  for (const seat of seats) {
    const def = config.fighters[seat];
    portraits[seat].dataset.fighter = def.id;
    portraits[seat].src = fighterArt[def.id];
    healthBars[seat].parentElement!.setAttribute('aria-valuemax', String(def.maxHp));
    guardBars[seat].parentElement!.setAttribute('aria-valuemax', String(rules.guardMax));
    winPips[seat].replaceChildren(...Array.from({ length: config.rules.winsToFinish }, () => document.createElement('span')));
  }
  renderer.load(config.arena);
  element('training-tools').hidden = !config.training;
  trainingPanel.hidden = !config.training;
  fillTrainingEnergy.hidden = !config.training;
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
    renderHUD();
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
fillTrainingEnergy.addEventListener('click', () => {
  if (screen !== 'match' || !config.training) return;
  canvas.focus();
  state.fighters[0].energy = MAX_ENERGY;
  renderHUD();
});
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
trainingPanel.addEventListener('toggle', () => {
  if (!trainingPanel.open && screen === 'match') canvas.focus();
});
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
  const seat = mode === 'local' ? binding.seat : activeSeat;
  const { control } = binding;
  if (control === 'A') {
    if (confirmed.every(Boolean) && document.activeElement === pickArena) go('maps');
    else confirmSeat(seat);
  } else if (control === 'jump') {
    if (confirmed[seat]) confirmSeat(seat);
    else if (mode !== 'local' && confirmed[0]) confirmSeat(0);
    else if (binding.seat === 0) go('menu');
  } else if (control === 'left' || control === 'right') selectFighter(seat, selected[seat] ^ 1);
  else if (control === 'up' || control === 'down') selectFighter(seat, selected[seat] ^ 2);
  else return false;
  event.preventDefault();
  return true;
}

function navigationKey(event: KeyboardEvent) {
  if (screen === 'match' || screen === 'roster' || event.target instanceof HTMLSelectElement) return false;
  const binding = bindings.get(event.code);
  const control = binding?.seat === 0 ? binding.control : undefined;
  const decrease = control === 'up' || control === 'left' || event.code === 'ArrowUp' || event.code === 'ArrowLeft';
  const increase = control === 'down' || control === 'right' || event.code === 'ArrowDown' || event.code === 'ArrowRight';
  const direction = increase ? 1 : decrease ? -1 : 0;
  const focused = document.activeElement;
  if (direction && (screen === 'menu' || screen === 'pause' || screen === 'result')) {
    const choices = screen === 'menu' ? modeButtons :
      Array.from(screens[screen].querySelectorAll<HTMLButtonElement>('button:not([disabled]):not([hidden])'));
    const current = choices.indexOf(focused as HTMLButtonElement);
    choices[(current + direction + choices.length) % choices.length].focus();
  } else if (direction && screen === 'maps') {
    selectArena((arenaIndex + direction + arenas.length) % arenas.length);
    mapButtons[arenaIndex].focus();
  } else if ((control === 'A' || event.code === 'Enter') && screen === 'maps' && mapButtons.includes(focused as HTMLButtonElement)) {
    startMatch();
  } else if (control === 'A' && focused instanceof HTMLButtonElement && screens[screen].contains(focused)) {
    focused.click();
  } else if (control === 'jump' && screen === 'pause') {
    enterMatch();
  } else if (control === 'jump' && previousScreen[screen]) {
    go(previousScreen[screen]!);
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
  if ((control === 'B' || control === 'C' || control === 'ULT') &&
      !acceptsSkillInput(config.fighters[seat], control)) {
    if (config.fighters[seat].actions.some(action => action.comboKeys?.includes(control))) return;
    const skill = control === 'ULT' ? '大招' : '专属槽 ' + control;
    notify(seatName(seat) + ' 的' + skill + '待接入');
    return;
  }
  if (control === 'A' || control === 'B' || control === 'C' || control === 'ULT' || control === 'jump' || control === 'dash') {
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
  const heldActions: ActionKey[] = [];
  for (const code of held) {
    const binding = bindings.get(code);
    if (binding?.seat === seat && ['A', 'B', 'C', 'ULT', 'jump', 'dash'].includes(binding.control)) {
      heldActions.push(binding.control as ActionKey);
    }
  }
  const input = { ...stickFor(seat), held: heldActions, pressed: [...commands.keys()], sampled: Object.fromEntries(commands) };
  commands.clear();
  return input;
}

function opponentInput(): InputFrame {
  if (mode === 'local') return readInput(1);
  if (mode === 'cpu' || trainingDummy.value === 'cpu') return cpuInput(state, config);
  if (trainingDummy.value === 'jab' && !state.freeze && state.arenaFrame % rules.ticksPerSecond === 0) {
    return { ...NEUTRAL, pressed: ['A'] };
  }
  return trainingDummy.value === 'guard' ? { x: 0, y: 1, pressed: [] } : NEUTRAL;
}

function setMeter(node: HTMLElement, value: number, maximum: number) {
  const bar = 'scaleX(' + value / maximum + ')';
  if (node.style.transform !== bar) node.style.transform = bar;
  const meter = node.parentElement!;
  if (meter.getAttribute('aria-valuenow') !== String(value)) meter.setAttribute('aria-valuenow', String(value));
}

function trainingState(seat: Seat) {
  const fighter = state.fighters[seat];
  const { recovery, attack } = fighter;
  if (recovery) {
    return recoveryLabels[recovery.phase] + (recovery.phase === 'fall' ? '' : ' · ' + recovery.remaining + ' 帧');
  }
  if (fighter.guardBreak) return '破防 · ' + fighter.guardBreak + ' 帧';
  if (fighter.hitstun) return '受击 · ' + fighter.hitstun + ' 帧';
  if (fighter.blockstun) return '格挡 · ' + fighter.blockstun + ' 帧';
  if (fighter.pendingCounter) return '防反成立';
  const action = actionFor(config, state, seat);
  if (attack && action) {
    const { frame } = attack;
    const activeEnd = action.startup + action.active;
    const activeLabel = 'counterTo' in action ? (fighter.ground ? '防反窗口' : '空中失效') : '有效';
    const phase = frame < action.startup ? '起手 ' + (frame + 1) + '/' + action.startup
      : frame < activeEnd ? activeLabel + ' ' + (frame - action.startup + 1) + '/' + action.active
        : '收招 ' + (frame - activeEnd + 1) + '/' + action.recovery;
    return (action.name ?? action.id) + ' · ' + phase;
  }
  if (fighter.dash) return '冲刺';
  if(fighter.guarding&&config.fighters[seat].guardCounter?.whileGuarding)return '铁盆防御 · 受击触发防反';
  if (fighter.guarding && fighter.guardCounterLeft) return '防反窗口 · ' + fighter.guardCounterLeft + ' 帧';
  if (fighter.guarding) return '防御';
  if (fighter.ground) return '地面可操作';
  return fighter.airActionUsed ? '空中机动已用' : '空中机动可用';
}

function renderHUD() {
  if (stage.dataset.phase !== state.phase) stage.dataset.phase = state.phase;
  text(roundLabel, config.training ? '自由训练' : '第 ' + state.round + ' 回合');
  text(timer, config.training ? '∞' : String(Math.ceil(state.remaining / config.rules.ticksPerSecond)).padStart(2, '0'));
  for (const seat of seats) {
    const fighter = state.fighters[seat];
    text(names[seat], seatName(seat) + ' · ' + config.fighters[seat].name);
    text(scores[seat], String(state.wins[seat]));
    for (const [index, pip] of Array.from(winPips[seat].children).entries()) {
      pip.setAttribute('data-won', String(index < state.wins[seat]));
    }
    setMeter(healthBars[seat], fighter.hp, config.fighters[seat].maxHp);
    const life = lifeDisplay[seat] ?? { hp: fighter.hp, trail: fighter.hp, holdUntil: 0, frame: state.frame };
    if (fighter.hp > life.hp) life.trail = fighter.hp;
    if (fighter.hp < life.hp || fighter.hitstun || fighter.recovery) life.holdUntil = state.frame + 18;
    if (state.frame > life.holdUntil) {
      life.trail = Math.max(fighter.hp, life.trail - config.fighters[seat].maxHp * .012 * Math.max(0, state.frame - life.frame));
    }
    healthTrails[seat].style.transform = 'scaleX(' + life.trail / config.fighters[seat].maxHp + ')';
    life.hp = fighter.hp;
    life.frame = state.frame;
    lifeDisplay[seat] = life;
    text(healthValues[seat], fighter.hp + ' / ' + config.fighters[seat].maxHp);
    healthValues[seat].hidden = !debug;
    setMeter(guardBars[seat], fighter.guard, rules.guardMax);
    guardBars[seat].parentElement!.dataset.low = String(fighter.guard < rules.guardMax * .3);
    guardBars[seat].parentElement!.dataset.broken = String(fighter.guardBreak > 0);
    text(guardValues[seat], fighter.guard + ' / ' + rules.guardMax);
    guardValues[seat].hidden = !debug;
    energyRows[seat].hidden = fighter.energy === undefined;
    if (fighter.energy !== undefined) {
      const energy = fighter.energy ?? 0;
      const ready = energy >= ENERGY_PER_STOCK;
      setMeter(energyBars[seat], energy, MAX_ENERGY);
      const stocks = Math.floor(energy / ENERGY_PER_STOCK);
      energyRows[seat].dataset.stocks = String(stocks);
      if (energyRows[seat].dataset.ready !== String(ready)) energyRows[seat].dataset.ready = String(ready);
      text(energyLabels[seat], frogPowered(fighter,state)?'强化 '+(((fighter.ascendUntil??0)-state.arenaFrame)/60).toFixed(1)+'s':String(stocks));
      energyBars[seat].parentElement!.setAttribute('aria-valuetext', frogPowered(fighter,state)?'强化剩余 '+(((fighter.ascendUntil??0)-state.arenaFrame)/60).toFixed(1)+' 秒':'技能能量 ' + Math.floor(energy) + ' / ' + MAX_ENERGY);
    }
    const recent = lastChains[seat];
    const hits = state.fighters[seat === 0 ? 1 : 0].combo ||
      (recent && state.frame < recent.until ? recent.hits : 0);
    combos[seat].hidden = hits < 2;
    if (hits >= 2) text(combos[seat], hits + ' 连击');
  }
  trainingReadout.hidden = !config.training || !debug;
  if (!trainingReadout.hidden) {
    for (const seat of seats) text(trainingStates[seat], trainingState(seat));
    text(trainingInputLine, trainingInputs.join('   ') || '—');
  }
  if (config.training) {
    const support = state.fighters[0].ground;
    const platform = config.arena.platforms.find(item => item.id === support);
    if (platform) bestTier = Math.max(bestTier, tierAt(config.arena, platform, state.arenaFrame));
    if (trainingGround.dataset.platform !== (support ?? 'air')) trainingGround.dataset.platform = support ?? 'air';
    text(trainingGround, platform ? platform.name : support ? '地面' : '空中');
    text(trainingBest, bestTier ? '已登第 ' + bestTier + ' 层' : '');
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
  if (state.phase === 'ready' && previous !== 'ready') lastChains = [null, null];
  for (const event of events) {
    if (event.kind === 'ultimate-no-energy') {
      notify(seatName(event.source) + ' 技能能量不足');
    }
    if (event.kind === 'dash-no-stamina') notify(seatName(event.source) + ' 耐力不足');
    if (event.kind === 'hit' && event.chain !== undefined) {
      lastChains[event.source] = event.chain > 1 ? { hits: event.chain, until: state.frame + 33 } : null;
    }
  }
  if (config.training && previous === 'fight') {
    const down = player.y === 1;
    if (down && !trainingDownHeld && !player.pressed.length) {
      trainingInputs.push(keyHint(preferences, 0, ['down']));
    }
    trainingDownHeld = down;
    for (const key of player.pressed) {
      const { x, y } = player.sampled?.[key] ?? player;
      const controls: Control[] = [];
      if (y) controls.push(y < 0 ? 'up' : 'down');
      if (x) controls.push(x < 0 ? 'left' : 'right');
      for (const heldKey of player.held ?? []) {
        if (heldKey !== key) controls.push(heldKey);
      }
      controls.push(key);
      trainingInputs.push(keyHint(preferences, 0, controls, '+'));
    }
    if (trainingInputs.length > 4) trainingInputs.splice(0, trainingInputs.length - 4);
  }
  if (previous === 'ready' && state.phase === 'fight') fightCueUntil = state.frame + 30;
  if (previous === 'fight' && state.phase === 'round-over' && state.result) {
    roundHistory.push({ ...state.result, round: state.round });
  }
  renderer.add(events, state.arenaFrame);
  audio.play(events);
}

function draw(elapsed: number) {
  const opening = state.phase === 'ready' && !config.training && !reducedMotion.matches
    ? Math.max(0, Math.min(1, (state.phaseTicks - 18) / 74)) : 0;
  renderer.draw(config, state, debug, elapsed, preferences.shake && !reducedMotion.matches,
    preferences.camera === 'focus' && !reducedMotion.matches, opening, debt / (1000 / rules.ticksPerSecond));
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

export function openPractice(practiceParams: URLSearchParams) {
  const practiceIndex = arenas.findIndex(arena => arena.id === practiceParams.get('practice'));
  if (practiceIndex < 0) return false;
  mode = 'training';
  arenaIndex = practiceIndex;
  for (const seat of seats) {
    const id = practiceParams.get('p' + (seat + 1));
    const index = roster.findIndex(entry => entry.fighter.id === id);
    if (index >= 0) selected[seat] = index;
  }
  confirmed.fill(true);
  configureMatch(true);
  enterMatch();
  window.addEventListener('keydown', () => audio.enableFromGesture(), { once: true });
  return true;
}
if (!openPractice(new URLSearchParams(location.search))) go('title');
requestAnimationFrame(frame);

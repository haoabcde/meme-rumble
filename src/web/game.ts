import { rules } from '../content/demo.js';
import { arenas } from '../content/arenas.js';
import { roster } from '../content/roster.js';
import { actionFor, clearBufferedInputs, createMatch, joAwakenInput, step, ultimateAvailability } from '../core/match.js';
import { createRelayMatch, stepRelayMatch, type RelayRoster, type RelaySession } from '../core/relay.js';
import { frogPowered, FROG_RULES } from '../core/frog-kit.js';
import { cinematicOwner } from '../core/whale-kit.js';
import { ENERGY_PER_STOCK, MAX_ENERGY, MAX_TEARS, NEUTRAL, TEAR_UNITS_PER_POINT, isAttack, type ActionKey, type Axis, type Direction, type Duo, type FighterAction, type FighterDefinition, type InputFrame, type MatchConfig, type RoundResult, type Slot, type Stick, type UltimateUnavailable } from '../core/types.js';
import { arcadeArt, comicArt, arenaArt, fighterArt } from './art.js';
import { fighterPresentation, fitPresentationArt } from './fighter-presentation.js';
import { closeDialogSmooth, inkSymbol, setRansomText } from './ui-art.js';
import { FightAudio, type SampleVoice } from './audio.js';
import { OnlineRoom, type OnlineStart } from './online-room.js';
import { cpuInput } from './cpu.js';
import { tierAt } from '../core/terrain.js';
import { entranceFor, openingFrame, openingTicks, previewArena, recoveryLabels, Renderer, seatColors } from './renderer.js';
import { bindingMap, installSettings, keyHint, loadPreferences, renderGuide, type Control, type Seat } from './settings.js';
import { Tempo, shotFading, type Cinematic, type FeatureShot } from './cinematics.js';
import { gagaVictory } from './gaga-cinematics.js';

declare const __FIGHTER_AUDIO__: Record<string, string>;

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
const modeNames = { local: '本地双人', cpu: '人机对战', training: '自由训练', online: '联机对战' };
type Mode = keyof typeof modeNames;
type BattleFormat = 'standard' | 'relay';
const seats = [0, 1] as const;
const namesSuffix = ['one', 'two'] as const;
const relayPositions = ['首发', '后援'] as const;
const fighterRoles: Record<string, string> = {
  whale: '投射封路 · 铁盆反制',
  frog: '声波控场 · 钻地绕背',
  banana: '蓄泪喷射 · 距离压制',
  gaga: '长杆进攻 · 炮台牵制'
};
const arenaTactics: Record<string, string> = {
  'broadcast-ring': '地面对攻 · 横向追击',
  harbor: '借吊盘追击',
  'dorm-roof': '跨院争夺高位',
  'night-court': '穿越中圈 · 高位换边',
  'star-station': '双塔包抄 · 追击升降'
};
type MovePrompt = { slot: Slot; direction?: Direction; label: string };
const commonMovePrompts: MovePrompt[] = [
  { slot: 'A', label: '普攻' },
  { slot: 'A', direction: 'up', label: '地面挑空' },
  { slot: 'B', label: '进攻技' },
  { slot: 'C', label: '特色技' },
  { slot: 'ULT', label: '代表大招' },
  { slot: 'ULT', direction: 'up', label: '战术大招' },
];
const thirdUltimate: MovePrompt = { slot: 'ULT', direction: 'down', label: '进阶大招' };
const ultimatePrompts = [...commonMovePrompts.filter(prompt => prompt.slot === 'ULT'), thirdUltimate];
const unavailableLabels: Record<UltimateUnavailable, string> = {
  unbound: '此大招未接入',
  ground: '落地后使用',
  air: '空中使用',
  recovery: '等当前状态结束',
  energy: '杀气不足',
  tears: '眼泪不足',
  cinematic: '演出期间无法使用',
  contested: '大招对峙，保留杀气'
};
const directionLabels: Record<Direction, string> = { up: '向上', down: '向下', forward: '向前', back: '向后' };
const moveUses: Record<string, string> = {
  rice: '投饭封路',
  'frog-laugh': '近身声波',
  'frog-crouch': '蹲守绕背',
  'banana-high-pressure-tears': '远程喷泪',
  'banana-cry-recharge': '按住回泪',
  'open-source': '水潭控场',
  'frog-ascend': '限时强化',
  'banana-tilting-tear-sea': '远程压场',
  'gaga-dijiang': '召唤俯冲'
};
const reasons = { ko: '击倒', time: '超时 · 生命比例领先', tie: '超时 · 生命比例相同', 'double-ko': '双 KO' };
const previousScreen: Partial<Record<Screen, Screen>> = {
  menu: 'title', roster: 'menu', maps: 'roster', versus: 'maps', result: 'menu'
};
// Full-screen victory shots by fighter. One freezes the match for its whole run.
const victories: Partial<Record<string, Cinematic>> = { gaga: gagaVictory };
/** Frame of the round-over countdown, counted down from 105, at which the winner takes their victory shot. */
const victoryCue = 52;

const stage = element('stage');
const screenStreak = element('screen-streak');
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
const hudFighters = namesSuffix.map(id => element('hud-fighter-' + id));
const criticalLabels = namesSuffix.map(id => element('critical-' + id));
const guardValues = namesSuffix.map(id => element('guard-value-' + id));
const healthTrails = namesSuffix.map(id => element('hp-trail-' + id));
const winPips = namesSuffix.map(id => element('wins-' + id));
const relayStatus = namesSuffix.map(id => element('relay-status-' + id));
const energyRows = namesSuffix.map(id => element('energy-row-' + id));
const energyBars = namesSuffix.map(id => element('energy-' + id));
const energyLabels = namesSuffix.map(id => element('energy-label-' + id));
const formLabels = namesSuffix.map(id => element('form-' + id));
const ultimateCueRows = namesSuffix.map(id => element('ultimate-cues-' + id));
const tearRows = namesSuffix.map(id => element('tears-row-' + id));
const tearFills = namesSuffix.map(id => element('tears-' + id));
const tearCounts = namesSuffix.map(id => element('tears-count-' + id));
const combos = namesSuffix.map(id => element('combo-' + id));
const portraits = namesSuffix.map(id => element<HTMLImageElement>('portrait-' + id));
const panels = namesSuffix.map(id => element('fighter-panel-' + id));
const seatButtons = namesSuffix.map(id => element('seat-' + id));
const seatButtonLabels = seatButtons.map(button => button.querySelector('span')!);
const lockButtons = namesSuffix.map(id => element<HTMLButtonElement>('lock-' + id));
const lockButtonLabels = lockButtons.map(button => button.querySelector('span')!);
const lineups = namesSuffix.map(id => element('lineup-' + id));
const lineupButtons = lineups.map(lineup => lineup.querySelectorAll<HTMLButtonElement>('button'));
const formatButtons = Array.from(document.querySelectorAll<HTMLButtonElement>('#battle-format [data-format]'));
const modeButtons = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-mode]'));
const stageTabs = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-stage-tab]'));
const nav = element('preflight-nav');
const screens = Object.fromEntries(screenIds.map(id => [id, element(id + '-screen')])) as Record<Screen, HTMLElement>;

let config: MatchConfig = { rules, arena: arenas[0], fighters: [roster[0].fighter, roster[3].fighter] };
const selected: Duo<number> = [0, 3];
const relayPicks: Duo<[number, number | null]> = [[0, null], [3, null]];
const activeSlots: Duo<Seat> = [0, 0];
const confirmed: Duo<boolean> = [false, false];
const pending: Duo<Map<ActionKey, Stick>> = [new Map(), new Map()];
const held = new Set<string>();
const ultimateCues: Duo<Array<{ prompt: MovePrompt; node: HTMLElement; label: HTMLElement }>> = [[], []];
const audio = new FightAudio();
const renderer = new Renderer(canvas, config.arena);
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const motions = new WeakMap<HTMLElement, Animation>();
const preferences = loadPreferences();

let bindings = bindingMap(preferences);
let state = createMatch(config);
let relay: RelaySession | null = null;
let roundHistory: Array<RoundResult & { round: number }> = [];
let lastChains: Duo<{ hits: number; until: number } | null> = [null, null];
let lifeDisplay: Duo<{ hp: number; trail: number; holdUntil: number; frame: number } | null> = [null, null];
const trainingInputs: string[] = [];
let trainingDownHeld = false;
let mode: Mode = 'local';
let onlineSeat: Seat = 0;
let lastOnlineInputAt = -Infinity;
let format: BattleFormat = 'standard';
let screen: Screen = 'title';
let activeSeat: Seat = 0;
let arenaIndex = Math.max(0, arenas.findIndex(arena => arena.id === 'broadcast-ring'));
let routeVisible = true;
let debug = false;
let bestTier = 0;
let lastTime = 0;
let lastRingPreview = 0;
let debt = 0;
let introRemaining = 0;
let fightCueUntil = 0;
let feature: FeatureShot | null = null;
let toastTimer = 0;
let windowFit = false;

function animateUI(node: HTMLElement, keyframes: Keyframe[], duration: number) {
  if (reducedMotion.matches) return;
  motions.get(node)?.cancel();
  const motion = node.animate(keyframes, { duration, easing: 'cubic-bezier(.18,.74,.23,1)' });
  motion.id = 'meme-interface';
  motions.set(node, motion);
}

reducedMotion.addEventListener('change', () => {
  if (reducedMotion.matches) {
    for (const motion of document.getAnimations()) {
      if (motion.id === 'meme-interface') motion.cancel();
    }
  }
});

const settings = installSettings(preferences, () => {
  clearInputs();
  bindings = bindingMap(preferences);
  audio.volume = new URLSearchParams(location.search).has('silent') ? 0 : preferences.volume / 100;
  audio.sfxVolume = preferences.sfxVolume / 100;
  audio.voiceVolume = preferences.voiceVolume / 100;
  audio.enableFromGesture();
  renderGuide(preferences);
  if (screen === 'roster') renderRoster();
  if (screen === 'match' || screen === 'pause') buildUltimateCues();
  footer();
});
audio.volume = new URLSearchParams(location.search).has('silent') ? 0 : preferences.volume / 100;
audio.sfxVolume = preferences.sfxVolume / 100;
audio.voiceVolume = preferences.voiceVolume / 100;
renderGuide(preferences);

stage.style.setProperty('--arcade-art', 'url("' + arcadeArt + '")');
for (const button of document.querySelectorAll('.primary, .mode')) {
  button.prepend(inkSymbol('ticket', 'button-ink'));
}
for (const button of modeButtons) button.append(inkSymbol('launch', 'mode-launch'));
setRansomText(element('menu-heading'), '选择模式', 2);
setRansomText(element('roster-heading'), '选择角色', 2);
setRansomText(element('maps-heading'), '选择地图', 2);
setRansomText(element('pause-title-text'), '已暂停', 1);
const menuFeature = element<HTMLImageElement>('menu-feature');
const modeArt = { local: fighterArt.whale, cpu: fighterArt.gaga, training: fighterArt.frog, online: fighterArt.banana };
const onlineRoom = new OnlineRoom(enterOnlineMatch, ({ state: next, events }) => {
  if (mode !== 'online' || screen !== 'match') return;
  const previous = state.phase;
  state = next;
  if (previous === 'ready' && state.phase === 'fight') fightCueUntil = state.frame + 30;
  if (previous === 'fight' && state.phase === 'round-over' && state.result) {
    roundHistory.push({ ...state.result, round: state.round });
  }
  renderer.add(events, state, config.fighters);
  audio.update(config, state, events);
  if (state.phase === 'match-over') endMatch();
}, leaveOnlineMatch);

function enterOnlineMatch(packet: OnlineStart) {
  const arena = arenas.find(candidate => candidate.id === packet.arena);
  const one = roster.find(entry => entry.fighter.id === packet.selections[0]);
  const two = roster.find(entry => entry.fighter.id === packet.selections[1]);
  if (!arena || !one || !two) {
    leaveOnlineMatch('联机配置与当前网页不一致。');
    return;
  }
  mode = 'online';
  onlineSeat = packet.seat;
  relay = null;
  config = { rules, arena, fighters: [one.fighter, two.fighter] };
  state = packet.state;
  roundHistory = [];
  stage.dataset.mode = 'online';
  stage.dataset.arena = arena.id;
  element('training-tools').hidden = true;
  trainingPanel.hidden = true;
  fillTrainingEnergy.hidden = true;
  element('step-training').hidden = true;
  element('match-tag').hidden = false;
  text(element('match-tag'), '你是 P' + (onlineSeat + 1) + ' · ' + arena.name);
  refreshCombatants();
  enterMatch();
}

function leaveOnlineMatch(notice = '') {
  onlineRoom.disconnect();
  mode = 'local';
  stage.dataset.mode = mode;
  go('menu');
  if (notice) notify(notice);
}

function previewMode(next: Mode) {
  for (const button of modeButtons) {
    button.dataset.active = String(button.dataset.mode === next);
  }
  if (screens.menu.dataset.feature === next) return;
  screens.menu.dataset.feature = next;
  menuFeature.src = modeArt[next];
  animateUI(menuFeature, [
    { translate: '6cqw 2cqw', scale: '.88', opacity: .25 },
    { translate: '-.8cqw -.3cqw', scale: '1.04', opacity: 1, offset: .64 },
    { translate: '0 0', scale: '1', opacity: 1 }
  ], 290);
}

const tiles = roster.map((entry, index) => {
  const src = fighterArt[entry.fighter.id];
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
  const badgeLabels = namesSuffix.map(side => {
    const badge = document.createElement('span');
    const caption = document.createElement('span');
    badge.append(inkSymbol('seat-' + side, 'seat-ink'), caption);
    badges.append(badge);
    return caption;
  });
  button.append(image(src), inkSymbol('selection', 'selection-ink'), label, badges);
  button.addEventListener('click', () => selectFighter(activeSeat, index));
  rosterGrid.append(button);
  return { button, badgeLabels };
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
  const badges = document.createElement('span');
  const tactic = document.createElement('small');
  const axes = new Set(arena.platforms.flatMap(platform => platform.travel ? [platform.travel.axis ?? 'x'] : []));
  const mover = axes.size > 1 ? '移动平台' : axes.has('x') ? '横移平台' : axes.has('y') ? '升降平台' : '';
  name.textContent = arena.name;
  badges.className = 'map-badges';
  badges.id = 'map-tags-' + arena.id;
  const tags = [arena.platforms.length ? '多层' : '单层', mover].filter(Boolean);
  badges.append(...tags.map(tag => {
    const badge = document.createElement('span');
    badge.textContent = tag;
    return badge;
  }));
  tactic.className = 'map-tactic';
  tactic.id = 'map-tactic-' + arena.id;
  tactic.textContent = arenaTactics[arena.id] ?? arena.terrain;
  button.setAttribute('aria-describedby', badges.id + ' ' + tactic.id);
  body.append(name, badges, tactic);
  button.append(thumbnail, body, inkSymbol('selection', 'selection-ink'));
  button.addEventListener('click', () => selectArena(index));
  arenaChoices.append(button);
  return button;
});

function seatName(seat: Seat) {
  return seat === 0 ? 'P1' : mode === 'cpu' ? '电脑' : mode === 'training' ? '陪练' : 'P2';
}

function setBattleFormat(next: BattleFormat) {
  format = next;
  for (const button of formatButtons) {
    button.setAttribute('aria-pressed', String(button.dataset.format === next));
  }
  stage.dataset.format = screen === 'menu' ? format : relaySelected() ? 'relay' : 'standard';
}

function relaySelected() {
  return mode !== 'training' && mode !== 'online' && format === 'relay';
}

function modeTitle() {
  return modeNames[mode] + (relaySelected() ? ' · 双角色车轮战' : '');
}

function pickedFighter(seat: Seat) {
  return relaySelected() ? relayPicks[seat][activeSlots[seat]] : selected[seat];
}

function relayTeam(seat: Seat): RelayRoster[Seat] {
  const [lead, reserve] = relayPicks[seat];
  if (reserve === null) throw new Error('Relay lineup requires a reserve');
  return [roster[lead].fighter, roster[reserve].fighter];
}

function remainingFighters(session: RelaySession): Duo<number> {
  return [2 - session.eliminated[0], 2 - session.eliminated[1]];
}

function editRelaySlot(seat: Seat, slot: Seat) {
  activeSeat = seat;
  activeSlots[seat] = slot;
  renderRoster();
}

function commandHint(seat: Seat, move: MovePrompt, comboKeys: Slot[] = []) {
  const keys: Control[] = [...comboKeys, move.slot];
  if (move.direction === 'up' || move.direction === 'down') keys.unshift(move.direction);
  const prefix = move.direction === 'forward' ? '前+' : move.direction === 'back' ? '后+' : '';
  return prefix + keyHint(preferences, mode === 'online' && seat === onlineSeat ? 0 : seat, keys, '+');
}

function directMoves(fighter: FighterDefinition, move: MovePrompt) {
  return fighter.actions.filter(action => !action.linkOnly && !action.comboKeys?.length &&
    (isAttack(action) && action.awakenJo
      ? move.slot === joAwakenInput.slot && move.direction === joAwakenInput.direction
      : action.slot === move.slot && action.direction === move.direction));
}

function costHint(action: FighterAction) {
  const qi = isAttack(action) ? (action.energyCost ?? 0) : 0;
  const tears = isAttack(action) ? (action.tearCost ?? 0) : 0;
  const energy = qi ? (qi / ENERGY_PER_STOCK) + ' 格气' : '0 气';
  if (tears) return energy + ' · ' + tears + ' 泪';
  return energy;
}

function postureHint(action: FighterAction) {
  if (isAttack(action) && (action.frog === 'laugh' || action.frog === 'global') && action.posture === 'any') {
    return '地面／强化可空中';
  }
  return action.posture === 'any' ? '地空' : action.posture === 'ground' ? '地面' : '空中';
}

function moveDetail(action: FighterAction, fighter: FighterDefinition) {
  const notes = [moveUses[action.id], postureHint(action), costHint(action)];
  if (isAttack(action)) {
    if (action.requiresJo) notes.push('觉醒后');
    const variants = [action.joReplacement, action.joDetonateReplacement]
      .filter(Boolean).map(id => fighter.actions.find(move => move.id === id)?.name).filter(Boolean);
    if (variants.length) notes.push('觉醒后 ' + variants.join(' → '));
  } else {
    const counter = fighter.actions.find(move => move.id === action.counterTo);
    if (counter?.name) notes.push('防反成功 → ' + counter.name);
  }
  return notes.filter(Boolean).join(' · ');
}

function makeMoveRow(seat: Seat, prompt: MovePrompt, title: string, detail?: string, comboKeys?: Slot[]) {
  const row = document.createElement('div');
  const keyCell = document.createElement('dt');
  const key = document.createElement('kbd');
  const value = document.createElement('dd');
  key.textContent = commandHint(seat, prompt, comboKeys);
  keyCell.append(key);
  value.append(title);
  if (detail) {
    const note = document.createElement('small');
    note.textContent = detail;
    value.append(note);
  } else {
    row.toggleAttribute('data-unavailable', true);
  }
  row.append(keyCell, value);
  return row;
}

function renderMoveList(list: HTMLElement, fighter: FighterDefinition, seat: Seat, detailed: boolean) {
  if (detailed) {
    const rows = (['A', 'B', 'C', 'ULT'] as const).flatMap(slot =>
      fighter.actions.filter(action => !action.linkOnly).flatMap(action => {
        const input = isAttack(action) && action.awakenJo ? joAwakenInput : action;
        if (input.slot !== slot) return [];
        const label = action.name ?? (input.direction ? directionLabels[input.direction] + '变招' : '招式');
        return [makeMoveRow(seat, { slot, direction: input.direction, label }, label, moveDetail(action, fighter), action.comboKeys)];
      })
    );
    list.replaceChildren(...rows);
    return;
  }
  const prompts = [...commonMovePrompts];
  if (directMoves(fighter, thirdUltimate).length) prompts.push(thirdUltimate);
  if (fighter.actions.some(action => isAttack(action) && action.awakenJo)) {
    prompts.push({ ...joAwakenInput, label: '觉醒' });
  }
  const visible = prompts.filter(prompt => prompt.slot !== 'A');
  const rows = visible.flatMap(prompt => {
    const moves = directMoves(fighter, prompt);
    if (!moves.length) return [];
    const action = moves[0];
    const usage = action.name ?? prompt.label;
    const name = prompt.slot === 'C' && moves.length > 1 && fighter.id === 'gaga' ? '部署炮台' : moveUses[action.id] ?? usage;
    const sharedCost = moves.every(move => costHint(move) === costHint(action));
    const detail = moves.length === 1 ? postureHint(action) + ' · ' + costHint(action)
      : sharedCost ? '地空 · ' + costHint(action)
      : moves.map(move => (move.posture === 'air' ? '空' : '地') + ' ' + costHint(move)).join('／');
    return [makeMoveRow(seat, prompt, name, detail)];
  });
  list.replaceChildren(...rows);
}

function renderMoveGuide() {
  for (const seat of seats) {
    const fighter = config.fighters[seat];
    const panel = element('move-guide-panel-' + namesSuffix[seat]);
    text(panel.querySelector('h3')!, seatName(seat) + ' · ' + fighter.name);
    const chain = panel.querySelector('.move-chain')!;
    const attack = commandHint(seat, commonMovePrompts[0]);
    const lift = commandHint(seat, commonMovePrompts[1]);
    const jump = keyHint(preferences, seat, ['jump']);
    const launcher = directMoves(fighter, commonMovePrompts[1])[0];
    const hasChase = launcher && isAttack(launcher) && launcher.cancelOnHit?.includes('jump');
    const startsCombo = fighter.actions.some(action => action.slot === 'A' && !action.direction && isAttack(action) &&
      launcher && action.cancelOnHit?.includes(launcher.id));
    text(chain as HTMLElement, '命中连段 ' + attack + ' → ' + lift + ' → ' + jump + ' → 空中 ' + attack +
      (hasChase && startsCombo ? '' : '（本角色的接续未完整接入）'));
    renderMoveList(panel.querySelector('dl')!, fighter, seat, true);
  }
}

function buildUltimateCues() {
  for (const seat of seats) {
    ultimateCues[seat] = ultimatePrompts.filter(prompt => directMoves(config.fighters[seat], prompt).length).map(prompt => {
      const node = document.createElement('span');
      const key = document.createElement('kbd');
      const label = document.createElement('span');
      node.className = 'ultimate-cue';
      label.className = 'cue-label';
      key.textContent = commandHint(seat, prompt);
      node.append(inkSymbol('ready', 'ready-ink'), key, label);
      return { prompt, node, label };
    });
    ultimateCueRows[seat].replaceChildren(...ultimateCues[seat].map(cue => cue.node));
    renderUltimateCues(seat);
  }
}

function renderUltimateCues(seat: Seat) {
  for (const { prompt, node, label } of ultimateCues[seat]) {
    const direction = prompt.direction === 'up' || prompt.direction === 'down' ? prompt.direction : undefined;
    const { action, cost, reason } = ultimateAvailability(state, config, seat, direction);
    const available = screen === 'match' && action !== undefined && !reason;
    if (node.dataset.available !== String(available)) {
      node.dataset.available = String(available);
      if (available) animateUI(node, [{ scale: '.91' }, { scale: '1.12', offset: .59 }, { scale: '1' }], 180);
      else motions.get(node)?.cancel();
    }
    text(label, available ? '可用' : cost ? cost / ENERGY_PER_STOCK + ' 格' : prompt.label);
    const status = available ? '可用' : reason ? unavailableLabels[reason] : '暂停中';
    const title = (action?.name ?? prompt.label) + ' · ' + status;
    if (node.title !== title) node.title = title;
  }
}

function footer() {
  const fighting = screen === 'match' || screen === 'pause';
  const confirmKey = keyHint(preferences, 0, ['A']);
  const backKey = keyHint(preferences, 0, ['jump']);
  const upDown = keyHint(preferences, 0, ['up', 'down']);
  const onlineRole = mode === 'online' ? ' · 你是 P' + (onlineSeat + 1) : '';
  text(element('footer-main'), fighting
    ? (relay ? '双角色车轮战' : modeNames[mode]) + ' · ' + config.arena.name + onlineRole
    : 'Meme 乱斗 · 抽象之王');
  const playing = screen === 'match';
  element('fight-key-hints').hidden = !playing;
  element('footer-detail').hidden = playing;
  if (playing) {
    for (const seat of seats) {
      const node = element('fight-keys-' + namesSuffix[seat]);
      const fighter = config.fighters[seat];
      const hints = commonMovePrompts.filter(prompt =>
        (prompt.slot === 'B' || prompt.slot === 'C') && directMoves(fighter, prompt).length);
      node.hidden = !hints.length || (mode === 'online' ? seat !== onlineSeat : seat === 1 && mode !== 'local');
      node.replaceChildren(seatName(seat), ...hints.map(prompt => {
        const hint = document.createElement('span');
        const key = document.createElement('kbd');
        hint.className = 'fight-key';
        key.textContent = commandHint(seat, prompt);
        hint.append(key, ' ' + prompt.label);
        return hint;
      }));
    }
    return;
  }
  const hints = screen === 'roster'
    ? 'P1 ' + keyHint(preferences, 0, ['left', 'right', 'up', 'down'], ' ') + ' 移动 · ' +
      keyHint(preferences, 0, ['A']) + ' 确认' + (relaySelected() ? ' · ' + keyHint(preferences, 0, ['B']) + ' 切换首发/后援' : '') +
      (mode === 'local'
        ? '　　P2 ' + keyHint(preferences, 1, ['left', 'right', 'up', 'down'], ' ') + ' 移动 · ' +
          keyHint(preferences, 1, ['A']) + ' 确认' + (relaySelected() ? ' · ' + keyHint(preferences, 1, ['B']) + ' 切换首发/后援' : '') : '')
    : screen === 'maps' ? upDown + ' 换图 · ' + confirmKey + ' 进场 · ' + backKey + ' 返回'
    : screen === 'menu' ? upDown + ' 选模式 · ' + confirmKey + ' 确认'
    : screen === 'title' ? confirmKey + ' 进入游戏'
    : screen === 'result' || screen === 'pause' ? upDown + ' 选择 · ' + confirmKey + ' 确认 · Esc 返回'
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
  for (const commands of pending) commands.clear();
  clearBufferedInputs(state);
  trainingDownHeld = false;
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
  const changed = next !== screen;
  if (next === 'match' || next === 'pause') audio.setPaused(next === 'pause');
  else audio.stopAll();
  clearInputs();
  window.clearTimeout(toastTimer);
  element('ui-notice').hidden = true;
  debt = 0;
  screen = next;
  if (next !== 'match') trainingPanel.open = false;
  stage.dataset.screen = next;
  stage.dataset.phase = next === 'match' ? state.phase : next;
  stage.dataset.format = next === 'menu' ? format : relaySelected() ? 'relay' : 'standard';
  for (const id of screenIds) {
    screens[id].hidden = id !== next && !(id === 'match' && next === 'pause');
  }
  screens.match.inert = next === 'pause';
  const modeLabel = screens[next].querySelector<HTMLElement>('[data-mode-name]');
  if (modeLabel) text(modeLabel, modeTitle());
  if (next === 'menu') previewMode(mode);
  if (next === 'roster') renderRoster();
  if (next === 'maps') {
    text(element('map-matchup'), seats.map(seat => relaySelected()
      ? relayPicks[seat].map(index => index === null ? '待选' : roster[index].fighter.name).join(' → ')
      : roster[selected[seat]].fighter.name).join('  VS  '));
    element('map-rules').hidden = mode === 'training';
    element('training-rule').hidden = mode !== 'training';
    element('round-wins-rule').hidden = relaySelected();
    roundWins.disabled = relaySelected();
    element('relay-rules').hidden = !relaySelected();
    text(element('round-limit-label'), relaySelected() ? '单场时限' : '时限');
    roundLimit.setAttribute('aria-label', relaySelected() ? '车轮战单场时限' : '单回合时限');
    selectArena(arenaIndex);
  }
  renderPreparationNav();
  footer();
  if (changed) motions.get(screenStreak)?.cancel();
  if (changed && next !== 'match' && next !== 'pause') {
    animateUI(screenStreak, [
      { translate: '0 0', opacity: 1 },
      { translate: '160% 0', opacity: 1, offset: .45 },
      { translate: '340% 0', opacity: 0 }
    ], 340);
  }
}

function go(next: Screen) {
  if (mode === 'online' && next !== 'match' && next !== 'result') {
    onlineRoom.disconnect();
    mode = 'local';
    stage.dataset.mode = mode;
  }
  if (next === 'roster' && screen !== 'maps' && screen !== 'roster') {
    confirmed.fill(false);
    activeSlots.fill(0);
    activeSeat = 0;
  }
  show(next);
  if (next === 'title') element('enter').focus();
  if (next === 'menu') modeButtons.find(button => button.dataset.mode === mode)?.focus();
  if (next === 'roster') seatButtons[activeSeat].focus();
  if (next === 'maps') mapButtons[arenaIndex].focus();
}

function selectMode(next: Mode) {
  if (next === 'online') {
    audio.enableFromGesture();
    onlineRoom.show();
    return;
  }
  mode = next;
  go('roster');
}

function acceptsSkillInput(fighter: FighterDefinition, slot: 'B' | 'C' | 'ULT') {
  return fighter.actions.some(move => move.slot === slot && (!move.linkOnly || fighter.actions.some(source =>
    source.cancelOnHit?.includes(move.id) || source.cancelOnHit?.includes(slot))));
}

function renderRoster() {
  const choosingRelay = relaySelected();
  text(element('roster-rule'), choosingRelay ? '每队选 2 名不同角色（首发 + 后援）' : '双方可选同一角色');
  for (const seat of seats) {
    const index = pickedFighter(seat);
    const entry = index === null ? undefined : roster[index];
    const who = seatName(seat);
    text(seatButtonLabels[seat], who + (seat === 1 && mode !== 'local' ? '角色' : ' 选角'));
    seatButtons[seat].setAttribute('aria-pressed', String(seat === activeSeat));
    const art = panels[seat].querySelector<HTMLImageElement>('.pick-art')!;
    art.style.visibility = entry ? '' : 'hidden';
    if (entry && art.getAttribute('src') !== fighterArt[entry.fighter.id]) art.src = fighterArt[entry.fighter.id];
    text(panels[seat].querySelector('h3')!, entry?.fighter.name ?? '待选后援');
    text(panels[seat].querySelector('.pick-role')!, entry ? (fighterRoles[entry.fighter.id] ?? '') : '从中间名单点击或用方向键选择');
    const moveList = panels[seat].querySelector('dl')!;
    if (entry) renderMoveList(moveList, entry.fighter, seat, false);
    else moveList.replaceChildren();
    lineups[seat].hidden = !choosingRelay;
    lineups[seat].setAttribute('aria-label', who + ' 出场顺序');
    for (const slot of seats) {
      const pick = relayPicks[seat][slot];
      const button = lineupButtons[seat][slot];
      text(button.querySelector('strong')!, pick === null ? '待选' : roster[pick].fighter.name);
      button.setAttribute('aria-pressed', String(activeSeat === seat && activeSlots[seat] === slot));
    }
    const incomplete = choosingRelay && relayPicks[seat][1] === null;
    lineupButtons[seat][2].disabled = incomplete;
    lineupButtons[seat][2].setAttribute('aria-label', '调换 ' + who + ' 出场顺序');
    lockButtons[seat].setAttribute('aria-pressed', String(confirmed[seat]));
    lockButtons[seat].disabled = incomplete;
    text(lockButtonLabels[seat], confirmed[seat] ? who + ' 已确认' : '确认 ' + who);
  }
  for (const [index, { button, badgeLabels }] of tiles.entries()) {
    const positions = seats.map(seat => choosingRelay ? relayPicks[seat].indexOf(index) : selected[seat] === index ? 0 : -1);
    button.dataset.p1 = String(positions[0] >= 0);
    button.dataset.p2 = String(positions[1] >= 0);
    button.setAttribute('aria-pressed', String(pickedFighter(activeSeat) === index));
    button.disabled = choosingRelay && relayPicks[activeSeat][1 - activeSlots[activeSeat]] === index;
    for (const seat of seats) {
      const caption = badgeLabels[seat];
      caption.parentElement!.hidden = positions[seat] < 0;
      text(caption, seatName(seat) + (choosingRelay && positions[seat] >= 0 ? ' ' + relayPositions[positions[seat]] : ''));
    }
  }
  const ready = confirmed.every(Boolean);
  pickArena.disabled = !ready;
  text(element('roster-help'), ready ? '双方已确认，按 ' + keyHint(preferences, 0, ['A']) + ' 选图'
    : choosingRelay ? '正在选择 ' + seatName(activeSeat) + ' 的' + relayPositions[activeSlots[activeSeat]]
      : '正在为 ' + seatName(activeSeat) + ' 选角');
  const jab = commandHint(activeSeat, commonMovePrompts[0]);
  const lift = commandHint(activeSeat, commonMovePrompts[1]);
  text(element('roster-basics'), jab + ' 普攻 · ' + lift + ' 地面挑空');
  renderPreparationNav();
}

function selectFighter(seat: Seat, index: number) {
  let changed = false;
  activeSeat = seat;
  if (relaySelected()) {
    const slot = activeSlots[seat];
    if (relayPicks[seat][1 - slot] !== index && relayPicks[seat][slot] !== index) {
      relayPicks[seat][slot] = index;
      confirmed[seat] = false;
      changed = true;
    }
  } else if (selected[seat] !== index) {
    selected[seat] = index;
    confirmed[seat] = false;
    changed = true;
  }
  renderRoster();
  if (changed) {
    const art = panels[seat].querySelector<HTMLImageElement>('.pick-art')!;
    animateUI(art, [
      { translate: (seat === 0 ? '-4.5cqw' : '4.5cqw') + ' 1.2cqw', scale: '.84', opacity: .35 },
      { translate: (seat === 0 ? '.7cqw' : '-.7cqw') + ' -.4cqw', scale: '1.05', opacity: 1, offset: .64 },
      { translate: '0 0', scale: '1', opacity: 1 }
    ], 240);
    animateUI(tiles[index].button, [
      { scale: '.92' },
      { scale: '1.07', offset: .52 },
      { scale: '1' }
    ], 210);
  }
}

function confirmSeat(seat: Seat) {
  if (relaySelected() && relayPicks[seat][1] === null) {
    editRelaySlot(seat, 1);
    lineupButtons[seat][1].focus();
    return;
  }
  const partner = seat === 0 ? 1 : 0;
  confirmed[seat] = !confirmed[seat];
  activeSeat = confirmed[seat] && !confirmed[partner] ? partner : seat;
  renderRoster();
  if (confirmed[seat]) {
    animateUI(lockButtons[seat], [{ scale: '.96' }, { scale: '1.075', offset: .52 }, { scale: '1' }], 170);
  }
  if (confirmed.every(Boolean)) pickArena.focus();
}

function selectArena(index: number) {
  const offset = index - arenaIndex;
  arenaIndex = index;
  const arena = arenas[index];
  stage.dataset.arena = arena.id;
  for (const [id, button] of mapButtons.entries()) button.setAttribute('aria-pressed', String(index === id));
  text(element('map-name'), arena.name);
  const screens = ((arena.right - arena.left) / canvas.width).toFixed(1);
  const tiers = new Set(arena.platforms.map(platform => platform.tier)).size;
  const hasRoutes = arena.routes.some(route => route.length > 0);
  text(element('map-count'), screens + ' 屏宽 · ' + (arena.platforms.length
    ? tiers + ' 层 · ' + arena.platforms.length + ' 处平台' : '单层地面'));
  text(element('start-label'), mode === 'training' ? '进入训练' : '开始对战');
  text(element('map-description'), arena.description);
  const routeLine = element('map-route');
  for (const [side, suffix] of namesSuffix.entries()) {
    const routeNames = arena.routes[side].map(id => arena.platforms.find(platform => platform.id === id)!.name);
    text(element('map-route-' + suffix), routeNames.join(' → '));
  }
  routeLine.hidden = !hasRoutes || !routeVisible;
  routeToggle.hidden = !hasRoutes;
  routeToggle.setAttribute('aria-pressed', String(routeVisible));
  previewArena(mapCanvas, arena, hasRoutes && routeVisible);
  if (offset) {
    const direction = Math.sign(offset);
    animateUI(mapCanvas, [
      { translate: (direction * 16) + 'px 0', opacity: .72 },
      { translate: (-direction * 3) + 'px 0', opacity: 1, offset: .74 },
      { translate: '0 0', opacity: 1 }
    ], 200);
  }
}

function configureMatch(immediate: boolean) {
  finishFeature();
  const training = mode === 'training';
  config = {
    arena: arenas[arenaIndex],
    fighters: [roster[selected[0]].fighter, roster[selected[1]].fighter],
    rules: training ? rules : {
      ...rules,
      roundSeconds: Number(roundLimit.value),
      winsToFinish: Number(roundWins.value)
    },
    training,
    randomSeed: crypto.getRandomValues(new Uint32Array(1))[0] || 1
  };
  relay = null;
  if (relaySelected()) {
    const teams: RelayRoster = [relayTeam(0), relayTeam(1)];
    relay = createRelayMatch(config, teams);
    config = relay.config;
  }
  state = relay?.state ?? createMatch(config);
  stage.dataset.mode = mode;
  stage.dataset.arena = config.arena.id;
  roundHistory = [];
  trainingInputs.length = 0;
  trainingDownHeld = false;
  bestTier = 0;
  if (immediate) state.phase = 'fight';
  else if (!reducedMotion.matches && !relay) state.phaseTicks = openingTicks(config.fighters);
  refreshCombatants();
  element('training-tools').hidden = !training;
  trainingPanel.hidden = !training;
  fillTrainingEnergy.hidden = !training;
  element('step-training').hidden = !training;
  element('match-tag').hidden = training;
  text(element('match-tag'), config.arena.name);
}

function refreshCombatants() {
  audio.configure([
    roster.find(entry => entry.fighter.id === config.fighters[0].id)?.audio,
    roster.find(entry => entry.fighter.id === config.fighters[1].id)?.audio
  ], __FIGHTER_AUDIO__);
  renderer.load(config.arena);
  lastChains = [null, null];
  lifeDisplay = [null, null];
  fightCueUntil = 0;
  for (const seat of seats) {
    const def = config.fighters[seat];
    portraits[seat].dataset.fighter = def.id;
    portraits[seat].src = fighterArt[def.id];
    healthBars[seat].parentElement!.setAttribute('aria-valuemax', String(def.maxHp));
    guardBars[seat].parentElement!.setAttribute('aria-valuemax', String(rules.guardMax));
    winPips[seat].hidden = Boolean(relay);
    relayStatus[seat].hidden = !relay;
    scores[seat].hidden = Boolean(relay);
    winPips[seat].replaceChildren(...Array.from(
      { length: relay ? 0 : config.rules.winsToFinish }, () => inkSymbol('round', 'round-ink')));
    if (relay) {
      for (const slot of seats) {
        const status = relayStatus[seat].children[slot] as HTMLElement;
        const thumb = status.querySelector('img')!;
        const fighter = relay.teams[seat][slot];
        const eliminated = slot < relay.eliminated[seat];
        const label = eliminated ? '出局' : slot === relay.indices[seat] ? '在场' : '后援';
        status.dataset.status = eliminated ? 'out' : slot === relay.indices[seat] ? 'active' : 'reserve';
        status.title = fighter.name + ' · ' + label;
        status.setAttribute('aria-label', status.title);
        thumb.src = fighterArt[fighter.id];
        thumb.dataset.fighter = fighter.id;
      }
    }
  }
  buildUltimateCues();
}

function enterMatch() {
  show('match');
  element('pause').firstChild!.textContent = mode === 'online' ? '离开房间 ' : '暂停 ';
  buildUltimateCues();
  renderHUD();
  draw(0);
  canvas.focus();
}

function startMatch(immediate = false) {
  if (relaySelected() && !confirmed.every(Boolean)) return;
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
    text(element('versus-fighter-' + side), relay ? relay.teams[seat].map(fighter => fighter.name).join(' → ') : def.name);
  }
  text(element('versus-title'), config.arena.name);
  const winRule = config.rules.winsToFinish === 1 ? '一回合决胜' : '先赢 ' + config.rules.winsToFinish + ' 回合';
  text(element('versus-rules'), config.training ? '自由训练 · 无时限' :
    relay ? '双角色车轮战 · 每场 ' + config.rules.roundSeconds + ' 秒' :
      modeNames[mode] + ' · ' + config.rules.roundSeconds + ' 秒 / 回合 · ' + winRule);
  introRemaining = 1650;
  show('versus');
  element('skip-versus').focus();
}

function pauseSummary() {
  text(element('pause-summary'), config.arena.name + (config.training
    ? ' · 第 ' + state.frame + ' 帧'
    : relay ? ' · 第 ' + (relay.generation + 1) + ' 场 · ' + config.fighters.map(fighter => fighter.name).join(' VS ')
    : ' · 第 ' + state.round + ' 回合 · ' + state.wins.join(' : ')));
}

function pauseMatch() {
  if (mode === 'online') {
    clearInputs();
    onlineRoom.sendInput(NEUTRAL);
    if (window.confirm('离开房间会结束本场联机对战。确定离开吗？')) leaveOnlineMatch();
    return;
  }
  // Pausing ends a character shot, so its sound never plays on over a frozen frame.
  finishFeature();
  show('pause');
  renderHUD();
  pauseSummary();
  element('resume').focus();
}

function startFeature() {
  if (config.training || relay || reducedMotion.matches ||
      state.phase !== 'round-over' || state.phaseTicks !== victoryCue) return false;
  const seat = state.result?.winner;
  if (seat == null) return false;
  const fighter = config.fighters[seat];
  const cinematic = victories[fighter.id];
  if (!cinematic) return false;
  const shot: FeatureShot = {
    frame: 0, frames: cinematic.frames, fade: cinematic.fade, name: fighter.name,
    seat: seatName(seat), color: seatColors[seat],
    skip: keyHint(preferences, 0, ['A']) + ' 跳过',
    tempo: new Tempo(cinematic.beatFrom ?? 0),
    paint: ctx => cinematic.paint(ctx, shot)
  };
  feature = shot;
  return true;
}

function finishFeature() {
  if (!feature) return;
  feature = null;
  state.phaseTicks = Math.min(state.phaseTicks, 18);
  clearInputs();
}

function renderVictoryArt(fighterId: string) {
  const art = element<HTMLImageElement>('result-art');
  const fallback = fighterArt[fighterId];
  const layer = fighterPresentation[fighterId]?.victoryArt;
  delete art.dataset.custom;
  art.onerror = null;
  if (!layer) {
    art.src = fallback;
    return;
  }
  const { x, y, scale, scaleX } = fitPresentationArt(layer, 'right');
  art.dataset.custom = 'true';
  art.style.setProperty('--art-anchor', x * 100 + '% ' + y * 100 + '%');
  art.style.setProperty('--art-scale', scaleX + ' ' + scale);
  art.onerror = () => {
    art.onerror = null;
    delete art.dataset.custom;
    art.src = fallback;
  };
  art.src = layer.src;
}

function endMatch() {
  const winner = relay ? relay.winner : state.winner;
  screens.result.dataset.outcome = winner === null ? 'draw' : winner === 0 ? 'p1' : 'p2';
  screens.result.classList.toggle('no-winner', winner === null);
  element('result-art-frame').hidden = winner === null;
  if (winner !== null) {
    const champion = relay ? relay.teams[winner][relay.eliminated[winner]] : config.fighters[winner];
    renderVictoryArt(champion.id);
  }
  element('result-medal-ink').setAttribute('href', winner === null ? '#ink-split' : '#ink-victory');
  text(element('result-map'), (relay ? '双角色车轮战' : modeNames[mode]) + ' · ' + config.arena.name);
  setRansomText(element('result-title'), winner === null ? '整场平局' : seatName(winner) + (relay ? ' 队获胜' : ' 获胜'), winner === null ? 2 : 0);
  if (relay) renderRelayResult(relay);
  else renderStandardResult();
  show('result');
  element('rematch').hidden = mode === 'online';
  (mode === 'online' ? screens.result.querySelector<HTMLButtonElement>('[data-go="menu"]') : element('rematch'))?.focus();
}

function renderStandardResult() {
  for (const seat of seats) text(element('result-' + namesSuffix[seat]), config.fighters[seat].name);
  element('result-score').removeAttribute('aria-label');
  text(element('result-score'), state.wins.join(' : '));
  element('result-reason').hidden = false;
  text(element('result-reason'), state.result ? '最后回合 · ' + reasons[state.result.reason] : '');
  element('round-history').setAttribute('aria-label', '回合记录');
  element('round-history').replaceChildren(...roundHistory.map(record => {
    const item = document.createElement('li');
    const who = record.winner === null ? '平局' : seatName(record.winner);
    text(item, '第 ' + record.round + ' 回合 · ' + who + ' · ' + reasons[record.reason]);
    item.dataset.outcome = record.winner === null ? 'draw' : String(record.winner + 1);
    return item;
  }));
}

function renderRelayResult(session: RelaySession) {
  for (const seat of seats) text(element('result-' + namesSuffix[seat]), seatName(seat) + ' 队');
  element('result-score').setAttribute('aria-label', '双方剩余角色数');
  text(element('result-score'), remainingFighters(session).join(' : '));
  element('result-reason').hidden = true;
  const history = element('round-history');
  history.setAttribute('aria-label', '车轮战对局记录');
  const compactReasons = { ko: 'KO', time: '超时', tie: '平局', 'double-ko': '双 KO' };
  history.replaceChildren(...session.history.map(({ indices, result }) => {
    const item = document.createElement('li');
    const pairing = seats.map(seat => session.teams[seat][indices[seat]].name).join(' VS ');
    const outcome = result.winner === null ? '双方出局' : seatName(result.winner === 0 ? 1 : 0) + ' 出局';
    text(item, pairing + ' · ' + compactReasons[result.reason] + ' · ' + outcome);
    item.dataset.outcome = result.winner === null ? 'draw' : String(result.winner + 1);
    return item;
  }));
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
  if (screen === 'match' && mode !== 'online') pauseMatch();
  else clearInputs();
  settings.open();
}

element('home').addEventListener('click', () => screen === 'match' ? pauseMatch() : go('title'));
element('enter').addEventListener('click', () => { audio.enableFromGesture(); go('menu'); });
for (const button of formatButtons) {
  button.addEventListener('click', () => setBattleFormat(button.dataset.format as BattleFormat));
}
for (const button of modeButtons) {
  const next = button.dataset.mode as Mode;
  button.addEventListener('focus', () => previewMode(next));
  button.addEventListener('pointerenter', () => previewMode(next));
  button.addEventListener('click', () => selectMode(next));
}
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
  for (const slot of seats) lineupButtons[seat][slot].addEventListener('click', () => editRelaySlot(seat, slot));
  lineupButtons[seat][2].addEventListener('click', () => {
    const [lead, reserve] = relayPicks[seat];
    if (reserve === null) return;
    relayPicks[seat] = [reserve, lead];
    confirmed[seat] = false;
    editRelaySlot(seat, 0);
  });
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
  audio.enableFromGesture();
  canvas.focus();
  state.fighters[0].energy = MAX_ENERGY;
  renderHUD();
});
element('step-training').addEventListener('click', () => {
  if (screen !== 'pause' || !config.training) return;
  tick(NEUTRAL);
  renderHUD();
  pauseSummary();
  draw(0);
});
trainingDummy.addEventListener('change', () => canvas.focus());
trainingSpeed.addEventListener('change', () => canvas.focus());
trainingPanel.addEventListener('toggle', () => {
  if (!trainingPanel.open && screen === 'match') canvas.focus();
});
debugButton.addEventListener('click', toggleDebug);
function openGuide(moves: boolean) {
  if (screen === 'match' && mode !== 'online') pauseMatch();
  clearInputs();
  text(element('guide-title'), moves ? '招式表' : '操作说明');
  element('guide-controls').hidden = moves;
  element('guide-moves').hidden = !moves;
  if (moves) renderMoveGuide();
  guide.showModal();
  guide.scrollTop = 0;
}
element('guide-open').addEventListener('click', () => openGuide(false));
element('pause-moves').addEventListener('click', () => openGuide(true));
element('guide-close').addEventListener('click', () => { void closeDialogSmooth(guide); });
guide.addEventListener('cancel', event => {
  event.preventDefault();
  void closeDialogSmooth(guide);
});
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
  } else if (control === 'B' && relaySelected()) {
    const slot = activeSlots[seat] === 0 ? 1 : 0;
    editRelaySlot(seat, slot);
    lineupButtons[seat][slot].focus();
  } else {
    const horizontal = control === 'left' || control === 'right';
    if (!horizontal && control !== 'up' && control !== 'down') return false;
    const current = pickedFighter(seat) ?? relayPicks[seat][0];
    const candidate = current ^ (horizontal ? 1 : 2);
    const unavailable = relaySelected() && relayPicks[seat][1 - activeSlots[seat]] === candidate;
    selectFighter(seat, unavailable ? candidate ^ 3 : candidate);
  }
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
  const focusedMap = mapButtons.indexOf(focused as HTMLButtonElement);
  if (direction && (screen === 'menu' || screen === 'pause' || screen === 'result')) {
    const choices = screen === 'menu' ? modeButtons :
      Array.from(screens[screen].querySelectorAll<HTMLButtonElement>('button:not([disabled]):not([hidden])'));
    const current = choices.indexOf(focused as HTMLButtonElement);
    choices[(current + direction + choices.length) % choices.length].focus();
  } else if (direction && screen === 'maps') {
    const current = focusedMap >= 0 ? focusedMap : arenaIndex;
    selectArena((current + direction + arenas.length) % arenas.length);
    mapButtons[arenaIndex].focus();
  } else if ((control === 'A' || event.code === 'Enter') && screen === 'maps' && focusedMap >= 0) {
    if (focusedMap !== arenaIndex) selectArena(focusedMap);
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
  if (guide.open || settings.dialog.open || onlineRoom.open || event.metaKey || event.ctrlKey || event.altKey) return;
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
  if (relay && state.phase !== 'fight') return;
  if (held.has(event.code) || event.repeat || (binding.seat === 1 && mode !== 'local')) return;
  audio.enableFromGesture();
  held.add(event.code);
  const { seat, control } = binding;
  const actor = mode === 'online' ? onlineSeat : seat;
  if ((control === 'B' || control === 'C' || control === 'ULT') &&
      !acceptsSkillInput(config.fighters[actor], control)) {
    if (config.fighters[actor].actions.some(action => action.comboKeys?.includes(control))) return;
    const skill = control === 'ULT' ? '大招' : control === 'B' ? '进攻技' : '特色技';
    notify(seatName(seat) + ' 的' + skill + '待接入');
    return;
  }
  if (control === 'A' || control === 'B' || control === 'C' || control === 'ULT' || control === 'jump' || control === 'dash') {
    pending[seat].set(control, stickFor(seat));
  }
});
window.addEventListener('keyup', event => held.delete(event.code));
canvas.addEventListener('blur', clearInputs);
canvas.addEventListener('click', () => { audio.enableFromGesture(); finishFeature(); });
canvas.addEventListener('pointerdown', () => audio.enableFromGesture());
function pauseOnHide() {
  if (screen === 'match' && mode === 'online') {
    clearInputs();
    onlineRoom.sendInput(NEUTRAL);
  } else if (screen === 'match') pauseMatch();
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
  if (fighter.launched) return '击飞 · 等待落地';
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
  if (screen === 'match' && stage.dataset.phase !== state.phase) stage.dataset.phase = state.phase;
  text(roundLabel, config.training ? '自由训练' : relay ? '第 ' + (relay.generation + 1) + ' 场' : '第 ' + state.round + ' 回合');
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
    const damaged = fighter.hp < life.hp;
    const critical = fighter.hp > 0 && fighter.hp <= config.fighters[seat].maxHp * .25;
    hudFighters[seat].toggleAttribute('data-critical', critical);
    const criticalLabel = criticalLabels[seat];
    const justEnteredCritical = critical && criticalLabel.hidden;
    criticalLabel.hidden = !critical;
    if (justEnteredCritical) {
      animateUI(criticalLabel, [{ scale: '.83' }, { scale: '1.09', offset: .66 }, { scale: '1' }], 220);
    }
    if (damaged) {
      const impact = seat === 0 ? '-4px' : '4px';
      animateUI(healthBars[seat].parentElement!, [
        { translate: impact + ' 0', filter: 'brightness(1.14)' },
        { translate: '0 0', filter: 'brightness(1)' }
      ], 150);
    }
    if (fighter.hp > life.hp) life.trail = fighter.hp;
    if (damaged || (state.phase === 'fight' && (fighter.hitstun || fighter.recovery))) {
      life.holdUntil = state.frame + 18;
    }
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
    const tearUnits = fighter.tearUnits;
    tearRows[seat].hidden = tearUnits === undefined;
    if (tearUnits !== undefined) {
      const tears = Math.floor(tearUnits / TEAR_UNITS_PER_POINT);
      setMeter(tearFills[seat], tears, MAX_TEARS);
      text(tearCounts[seat], tears + ' / ' + MAX_TEARS);
    }
    energyRows[seat].hidden = fighter.energy === undefined;
    if (fighter.energy !== undefined) {
      const energy = frogPowered(fighter,state) ? MAX_ENERGY * Math.max(0,fighter.ascendUntil!-state.arenaFrame) / FROG_RULES.buffTicks : fighter.energy;
      setMeter(energyBars[seat], energy, MAX_ENERGY);
      const stocks = Math.floor(energy / ENERGY_PER_STOCK);
      energyRows[seat].dataset.stocks = String(stocks);
      text(energyLabels[seat], String(stocks));
    }
    const powered = frogPowered(fighter, state);
    formLabels[seat].hidden = !powered;
    if (powered) text(formLabels[seat], '强化 ' + ((fighter.ascendUntil! - state.arenaFrame) / config.rules.ticksPerSecond).toFixed(1) + ' 秒');
    renderUltimateCues(seat);
    const recent = lastChains[seat];
    const hits = state.fighters[seat === 0 ? 1 : 0].combo ||
      (recent && state.frame < recent.until ? recent.hits : 0);
    const combo = combos[seat];
    const reappeared = combo.hidden;
    combo.hidden = hits < 2;
    if (hits >= 2 && (reappeared || combo.textContent !== hits + ' 连击')) {
      text(combo, hits + ' 连击');
      animateUI(combo, [
        { scale: '.72', translate: (seat === 0 ? '-1.4cqw' : '1.4cqw') + ' 0' },
        { scale: '1.18', translate: '0 0', offset: .54 },
        { scale: '1', translate: '0 0' }
      ], 210);
    }
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
  let cue = '';
  if (state.phase === 'ready') {
    const previousBout = relay?.history.at(-1);
    if (relay && previousBout) {
      const { indices } = relay;
      cue = 'round';
      display = '后援接战';
      caption = seats.filter(seat => indices[seat] !== previousBout.indices[seat])
        .map(seat => seatName(seat) + ' · ' + config.fighters[seat].name).join('　 /　 ');
    } else {
      const round = state.phaseTicks > 65 && !config.training;
      cue = round ? 'round' : 'ready';
      display = round ? (relay ? '第 1 场' : '第 ' + state.round + ' 回合') : '准备';
      caption = config.arena.name;
    }
  } else if (state.phase === 'round-over' && result) {
    cue = result.reason === 'ko' || result.reason === 'double-ko' ? 'ko' : 'decision';
    display = result.reason === 'ko' ? 'K.O.' : result.reason === 'double-ko' ? '双 K.O.' :
      result.winner === null ? '平局' : seatName(result.winner) + ' 领先';
    caption = result.reason === 'ko' && result.winner !== null
      ? seatName(result.winner) + ' 击倒对手' : reasons[result.reason];
  } else if (state.phase === 'fight' && state.frame < fightCueUntil) {
    cue = 'fight';
    display = config.training ? '开始练习' : '开战';
  }
  text(readyText, display);
  text(readyMap, caption);
  readyMap.hidden = !caption;
  announcement.hidden = !display;
  if (announcement.dataset.cue !== cue) {
    announcement.dataset.cue = cue;
    if (cue) animateUI(readyText, [
      { translate: (cue === 'ko' ? '-3cqw' : '5cqw') + ' 0', scale: '.86', opacity: .12 },
      { translate: '-.45cqw 0', scale: '1.07', opacity: 1, offset: .72 },
      { translate: '0 0', scale: '1', opacity: 1 }
    ], cue === 'ko' ? 295 : 212);
  }
}

function tick(player: InputFrame) {
  const previous = state.phase;
  const generation = relay?.generation;
  const inputs: Duo<InputFrame> = relay && previous !== 'fight' ? [NEUTRAL, NEUTRAL] : [player, opponentInput()];
  const events = relay ? stepRelayMatch(relay, inputs) : step(state, inputs, config);
  if (relay && relay.generation !== generation) {
    state = relay.state;
    config = relay.config;
    clearInputs();
    window.clearTimeout(toastTimer);
    element('ui-notice').hidden = true;
    refreshCombatants();
    footer();
    return;
  }
  if (state.phase !== previous) clearInputs();
  if (state.phase === 'ready' && previous !== 'ready') {
    lastChains = [null, null];
    if (!relay && !reducedMotion.matches) state.phaseTicks = openingTicks(config.fighters);
  }
  if (previous === 'fight' && state.phase === 'round-over' && !relay && !config.training &&
      !reducedMotion.matches && state.result?.winner != null &&
      config.fighters[state.result.winner].id === 'banana') state.phaseTicks = 192;
  const notices: string[] = [];
  for (const event of events) {
    if (event.source === 0 || mode === 'local') {
      const who = seatName(event.source);
      if (event.kind === 'ultimate-no-energy') {
        notices.push(who + (event.amount ? ' 需要 ' + event.amount / ENERGY_PER_STOCK + ' 格气' : ' 杀气不足'));
      } else if (event.kind === 'tears-short') {
        notices.push(who + (event.amount ? ' 需要 ' + event.amount + ' 点眼泪' : ' 眼泪不足'));
      } else if (event.kind === 'skill-unavailable') {
        const name = config.fighters[event.source].actions.find(action => action.id === event.actionId)?.name ?? '进攻技';
        const requirement = event.requirement === 'ground' ? '落地后使用' : '等当前状态结束后使用';
        notices.push(who + ' ' + requirement + '「' + name + '」');
      } else if (event.ultimateReason) {
        notices.push(who + ' ' + unavailableLabels[event.ultimateReason]);
      } else if (event.kind === 'dash-no-stamina') {
        notices.push(who + ' 耐力不足');
      }
    }
    if (event.kind === 'hit' && event.chain !== undefined) {
      lastChains[event.source] = event.chain > 1 ? { hits: event.chain, until: state.frame + 33 } : null;
    }
  }
  if (notices.length) notify([...new Set(notices)].join(' · '));
  if (config.training && previous === 'fight') {
    const down = player.y === 1;
    if (down && !trainingDownHeld && !player.pressed.length) {
      trainingInputs.push(keyHint(preferences, 0, ['down']));
    }
    trainingDownHeld = down;
    for (const [index, key] of player.pressed.entries()) {
      const sampled = player.sampled;
      const { x, y } = (Array.isArray(sampled) ? sampled[index] :
        (sampled as Partial<Record<ActionKey, Stick>> | undefined)?.[key]) ?? player;
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
  if (!relay && previous === 'fight' && state.phase === 'round-over' && state.result) {
    roundHistory.push({ ...state.result, round: state.round });
  }
  renderer.add(events, state, config.fighters);
  const openingEvents = [...events];
  const entrance = reducedMotion.matches ? -1 : openingFrame(state, config.fighters);
  if (entrance >= 0) {
    for (const seat of seats) {
      const fighter = state.fighters[seat];
      for (const { at, sound } of entranceFor(config.fighters[seat])?.cues ?? []) {
        if (at === entrance) openingEvents.push({ ...sound, source: seat, x: fighter.x, y: fighter.y });
      }
    }
  }
  audio.update(config, state, openingEvents);
}

function draw(elapsed: number) {
  stage.toggleAttribute('data-cinematic', Boolean(state.cutIn) || state.summon?.phase === 'cut-in' ||
    cinematicOwner(state) !== undefined || Boolean(feature && !shotFading(feature)));
  const opening = state.phase === 'ready' && !config.training && !reducedMotion.matches
    ? Math.max(0, Math.min(1, (state.phaseTicks - 18) / 74)) : 0;
  const presentationState = relay ? { ...state, wins: remainingFighters(relay) } : state;
  renderer.draw(config, presentationState, debug, elapsed, preferences.shake && !reducedMotion.matches,
    preferences.camera === 'focus' && !reducedMotion.matches, reducedMotion.matches, opening, debt / (1000 / rules.ticksPerSecond), feature ?? undefined);
}

function frame(now: number) {
  if (screen === 'maps' && arenas[arenaIndex].theme === 'ring' && !reducedMotion.matches &&
    !document.hidden && now - lastRingPreview >= 85) {
    previewArena(mapCanvas, arenas[arenaIndex], false, Math.floor(now * .06));
    lastRingPreview = now;
  }
  const elapsed = Math.min(now - (lastTime || now), 100);
  const tickMs = 1000 / rules.ticksPerSecond;
  lastTime = now;
  if (screen === 'versus' && !document.hidden && !guide.open && !settings.dialog.open) {
    introRemaining -= elapsed;
    if (introRemaining <= 0) enterMatch();
  }
  if (screen === 'match' && mode === 'online') {
    if (now - lastOnlineInputAt >= tickMs - 1) {
      onlineRoom.sendInput(readInput(0));
      lastOnlineInputAt = now;
    }
    renderHUD();
    draw(elapsed / tickMs);
  } else if (screen === 'match') {
    debt += elapsed * (config.training ? Number(trainingSpeed.value) : 1);
    while (debt >= tickMs) {
      debt -= tickMs;
      if (feature) {
        feature.tempo.hear(undefined, feature.frame);
        if (++feature.frame >= feature.frames) finishFeature();
        continue;
      }
      if (startFeature()) continue;
      tick(readInput(0));
      if (relay ? relay.phase === 'finished' : state.phase === 'match-over') {
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
  return true;
}
const launchParams = new URLSearchParams(location.search);
if (!openPractice(launchParams)) {
  if (launchParams.get('format') === 'relay') {
    setBattleFormat('relay');
    go('menu');
  } else go('title');
}
requestAnimationFrame(frame);

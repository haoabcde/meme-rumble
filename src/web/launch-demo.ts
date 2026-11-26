import { arenas } from '../content/arenas.js';
import { rules } from '../content/demo.js';
import { basicAttack, defineFighter } from '../content/fighter-kit.js';
import { roster } from '../content/roster.js';
import { createMatch, step } from '../core/match.js';
import { NEUTRAL, type ActionDefinition, type ArenaDefinition, type InputFrame, type MatchConfig } from '../core/types.js';
import { motionArt, sprites } from './art.js';
import { Renderer } from './renderer.js';

const court = arenas.find(({ id }) => id === 'night-court')!;
const arena: ArenaDefinition = {
  ...court, platforms: [], routes: [[], []], spawn: [court.width / 2 - 48, court.width / 2 + 48]
};
const attacker = roster.find(({ fighter }) => fighter.id === 'whale')!;
const dummy = roster.find(({ fighter }) => fighter.id === 'banana')!.fighter;
const hitFrames = [8, 14, 20] as const;
const actionId = 'training-chain-launch';
const submitInput: InputFrame = { ...NEUTRAL, pressed: ['B'] };
const tickMs = 1000 / rules.ticksPerSecond;

function byId<T extends HTMLElement = HTMLElement>(id: string) {
  return document.getElementById(id) as T;
}

const form = byId<HTMLFormElement>('launch-tuning');
const fields = hitFrames.map((_, index) => byId<HTMLInputElement>('lift-' + (index + 1)));
const outcomes = hitFrames.map((_, index) => byId<HTMLOutputElement>('hit-' + (index + 1)));
const pause = byId<HTMLButtonElement>('pause-trial');
const advance = byId<HTMLButtonElement>('step-trial');
const speed = byId<HTMLSelectElement>('trial-speed');
const boxes = byId<HTMLInputElement>('show-boxes');
const status = byId('trial-status');
const parameterStatus = byId('parameter-status');
const hitsReadout = byId('try-hits');
const heightReadout = byId('current-height');
const peakReadout = byId('peak-height');
const renderer = new Renderer(byId<HTMLCanvasElement>('launch-arena'), arena);
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

function trialConfig(lifts: number[]): MatchConfig {
  const move: ActionDefinition & { slot: 'B' } = {
    ...basicAttack, id: actionId, name: '三段击飞', slot: 'B',
    startup: hitFrames[0], active: hitFrames[2] - hitFrames[0] + 1, recovery: 14,
    advance: 0, push: 0, lift: 0, stop: 4, cancelOnHit: [], damage: 30, hitstun: 20,
    hitTimeline: hitFrames.map((frame, index) => ({
      from: frame, to: frame + 1, group: 'lift-' + (index + 1), lift: lifts[index],
      // A wider vertical reach on follow-ups makes tuning possible across the full input range.
      boxes: [{ ...basicAttack.hitbox, x: 8, w: 137, y: -115 - index * 180, h: 115 + index * 180 }]
    })),
    animation: [
      { frame: 0, cell: 77 }, { frame: 8, cell: 4 },
      { frame: 14, cell: 5 }, { frame: 20, cell: 6 }
    ],
    feedback: { color: '#ffda77' }
  };
  const { fighter } = defineFighter({
    id: attacker.fighter.id, name: '出招训练体', art: attacker.art, accent: attacker.accent, height: attacker.height,
    signatureMoves: [move]
  });
  return { arena, rules, fighters: [fighter, dummy], training: true };
}

function trialStart(config: MatchConfig) {
  const match = createMatch(config);
  match.phase = 'fight';
  return match;
}

let config = trialConfig(fields.map(field => field.valueAsNumber));
let state = trialStart(config);
let mode: 'ready' | 'playing' | 'paused' | 'done' = 'ready';
let nextHit = 0;
let landed = 0;
let peak = 0;
let debt = 0;
let previousTime = 0;
let newInput: InputFrame = NEUTRAL;

const heightLabel = (height: number) => String(Math.round(height * 10) / 10);

function draw(elapsed = 0) {
  renderer.draw(config, state, boxes.checked, elapsed, false, false, reducedMotion.matches, 0, debt / tickMs);
}

function setMode(value: typeof mode) {
  mode = value;
  pause.disabled = advance.disabled = value === 'ready' || value === 'done';
  pause.textContent = value === 'paused' ? '继续' : '暂停';
  if (value === 'playing') status.textContent = '试招中';
  if (value === 'paused') status.textContent = '已暂停';
  if (value === 'done') status.textContent = '试招结束 · 命中 ' + landed + ' 段';
}

function tick() {
  const events = step(state, [newInput, NEUTRAL], config);
  newInput = NEUTRAL;
  renderer.add(events, state, config.fighters);
  const target = state.fighters[1];
  const height = Math.max(0, arena.floor - target.y);
  peak = Math.max(peak, height);
  heightReadout.textContent = heightLabel(height);
  peakReadout.textContent = heightLabel(peak);
  if (nextHit < hitFrames.length && state.fighters[0].attack?.frame === hitFrames[nextHit]) {
    const outcome = outcomes[nextHit++];
    const hit = events.some(event => event.kind === 'hit' && event.source === 0 && event.actionId === actionId);
    if (hit) {
      landed++;
      hitsReadout.textContent = landed + ' / ' + hitFrames.length;
    }
    outcome.parentElement!.dataset.hit = hit ? 'yes' : 'no';
    const velocity = (target.vy > 0 ? '向下速度 ' : '向上速度 ') + heightLabel(Math.abs(target.vy));
    outcome.textContent = hit ? '命中 · ' + velocity : '未命中';
  }
  if (!state.fighters[0].attack && !target.launched && !target.recovery) setMode('done');
}

function reset(lifts: number[]) {
  config = trialConfig(lifts);
  state = trialStart(config);
  renderer.resetPresentation();
  nextHit = landed = peak = debt = 0;
  hitsReadout.textContent = '0 / ' + hitFrames.length;
  heightReadout.textContent = peakReadout.textContent = '0';
  for (const outcome of outcomes) {
    delete outcome.parentElement!.dataset.hit;
    outcome.textContent = '等待命中';
  }
  newInput = submitInput;
  parameterStatus.textContent = '本次试招使用 ' + lifts.join(' → ') + '。';
  setMode('playing');
  draw();
}

form.addEventListener('submit', event => {
  event.preventDefault();
  reset(fields.map(field => field.valueAsNumber));
});
form.addEventListener('input', () => {
  parameterStatus.textContent = '调整后的数值将在下次试招生效。';
});
form.addEventListener('reset', () => {
  parameterStatus.textContent = '数值已恢复为 ' + fields.map(field => field.defaultValue).join(' → ') + '。点「试招」应用。';
});
window.addEventListener('keydown', event => {
  if (event.code !== 'KeyU' || event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
  event.preventDefault();
  form.requestSubmit();
});
pause.addEventListener('click', () => {
  debt = 0;
  setMode(mode === 'playing' ? 'paused' : 'playing');
});
advance.addEventListener('click', () => {
  debt = 0;
  setMode('paused');
  tick();
  draw(1);
});
boxes.addEventListener('change', () => draw());
reducedMotion.addEventListener('change', () => draw());
void Promise.allSettled([motionArt.whale.decode(), motionArt.banana.decode(), sprites.banana.decode()])
  .then(() => draw());

function frame(now: number) {
  const elapsed = previousTime ? Math.min(80, now - previousTime) : 0;
  previousTime = now;
  if (mode === 'playing') {
    debt += elapsed * Number(speed.value);
    while (mode === 'playing' && debt >= tickMs) {
      debt -= tickMs;
      tick();
    }
    draw(elapsed / tickMs);
  }
  requestAnimationFrame(frame);
}

draw();
requestAnimationFrame(frame);

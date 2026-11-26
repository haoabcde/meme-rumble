import { floorImpact, landingImpact, segmentBoxTime } from './projectile.js';
import { damageTurret, deployTurret, opposingTurrets, stepTurrets, turretBox } from './turret.js';
import { aimSummon, dijiangTip, summonArea, summonCatchRadius, summonCutInFrames, summonFallFrames,
  summonImpactFrames } from './summon.js';
import type {
  ActionDefinition, ArenaDefinition, Attack, Box, Command, CombatEvent, Direction, Duo, FighterAction, FighterDefinition, FighterState,
  HitWindow, InputFrame, MatchConfig, MatchState, Recovery, RoundResult, Ruleset, Side, Projectile, Stick, Summon,
  UltimateUnavailable, ImpactTier
} from './types.js';
import { platformAt, platformContact, platformOffset } from './terrain.js';
import { DEFAULT_KNOCKDOWN_FRAMES, DEFAULT_RISE_FRAMES, isAttack, MAX_ENERGY, MAX_TEARS, NEUTRAL, TEAR_UNITS_PER_POINT } from './types.js';
import { updateActorPresentation } from './actor-presentation.js';
import { entityContacts, resolveContactEntity, updateEntities, spawnEntities } from './entities.js';
import {startWhale} from './whale-kit.js';
import {frogAction,frogCanStart,startFrog,finishAscension,tickAscension,frogPowered,frogCrouching,warpFrog,settleFrogWarp,startFrogDodge,FROG_RULES} from './frog-kit.js';

const seats = [0, 1] as const;
const slotPriority = ['ULT', 'C', 'B', 'A'] as const;
const roundOverLandingHold = 12;
const roundOverMaxExtraTicks = 60;
const other = (seat: 0 | 1) => seat === 0 ? 1 : 0;
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const buildWave = {
  id: 'turret-build-wave', damage: 45, hitstun: 18, blockstun: 12, guardCost: 12,
  push: 18, lift: 0, stop: 3, impact: 'medium'
} as const;
type Position = Pick<FighterState, 'x' | 'y'>;
const cryUnitsPerTick = 20;
const sprayUnitsPerTick = 10;
const sprayHitInterval = 18;
const spraySpeed = .45;
const slowedSpeed = .55;

function addTearUnits(fighter: FighterState, change: number) {
  if (fighter.tearUnits === undefined) return;
  fighter.tearUnits = clamp(fighter.tearUnits + change, 0, MAX_TEARS * TEAR_UNITS_PER_POINT);
}

function isHeld(input: InputFrame, key: ActionDefinition['slot']) {
  return input.held?.includes(key) ?? input.pressed.includes(key);
}

function carriedBySummon(state: MatchState, seat: 0 | 1) {
  const summon = state.summon;
  return Boolean(summon?.carry && summon.source !== seat && (summon.phase === 'fall' || summon.frame === 0));
}

function spawn(config: MatchConfig, seat: 0 | 1, round: number): FighterState {
  const side = round % 2 ? seat : other(seat);
  const definition = config.fighters[seat];
  return {
    x: config.arena.spawn[side], y: config.arena.floor, vy: 0, facing: side === 0 ? 1 : -1,
    ground: 'floor', ignorePlatform: null, hp: definition.maxHp,
    energy: 0, slow: 0,
    ...(definition.usesTears ? { tearUnits: 60 * TEAR_UNITS_PER_POINT } : {}),
    guard: config.rules.guardMax, guardWait: 0, guardBreak: 0, hitstun: 0, blockstun: 0,
    push: 0, dash: 0, dashActive: false, airActionUsed: false, guarding: false, attack: null, buffer: [], combo: 0, controlled: 0,
    recovery: null, moving: false
  };
}

export function createMatch(config: MatchConfig): MatchState {
  return {
    randomState: (config.randomSeed ?? 0x6d2b79f5) >>> 0 || 1,
    frame: 0, arenaFrame: 0, remaining: config.rules.roundSeconds * config.rules.ticksPerSecond,
    freeze: 0, comboFreeze: 0, phase: 'ready', phaseTicks: 120, round: 1,
    wins: [0, 0], draws: 0, fighters: [spawn(config, 0, 1), spawn(config, 1, 1)],
    projectiles: [], turrets: { bolt: null, howitzer: null },
    result: null, winner: null
  };
}

export function actionFor(config: MatchConfig, state: MatchState, seat: 0 | 1) {
  const id = state.fighters[seat].attack?.id;
  return frogAction(config.fighters[seat].actions.find(action => action.id === id),state.fighters[seat],state);
}

export function isActiveFrame(action: FighterAction, frame: number) {
  return frame >= action.startup && frame < action.startup + action.active;
}

function hitWindowsFor(action: ActionDefinition, frame: number): HitWindow[] {
  return action.hitTimeline?.filter(window => frame >= window.from && frame < window.to) ??
    [{ from: action.startup, to: action.startup + action.active, group: '', boxes: [action.hitbox] }];
}

export function hitRegionsFor(action: FighterAction | undefined, frame: number): Box[] {
  if (!action || 'counterTo' in action || !isActiveFrame(action, frame)) return [];
  return hitWindowsFor(action, frame).flatMap(window => window.boxes);
}

export function hurtRegionsFor(definition: FighterDefinition, action: FighterAction | undefined, frame: number): Box[] {
  if (!action?.hurtTimeline || frame < 0 || frame >= action.startup + action.active + action.recovery) {
    return [definition.hurtbox];
  }
  return action.hurtTimeline.flatMap(window => frame >= window.from && frame < window.to ? window.boxes : []);
}

export function worldBox(box: Box, x: number, y: number, facing: Side): Box {
  return {
    x: x + (facing === 1 ? box.x : -box.x - box.w),
    y: y + box.y,
    w: box.w, h: box.h
  };
}

function overlap(a: Box, b: Box) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function attackFor(config: MatchConfig, state: MatchState, seat: 0 | 1) {
  const action = actionFor(config, state, seat);
  return isAttack(action) ? action : undefined;
}

function queueInputs(state: MatchState, inputs: Duo<InputFrame>, config: MatchConfig) {
  for (const seat of seats) {
    if (carriedBySummon(state, seat)) continue;
    const fighter = state.fighters[seat];
    const input = inputs[seat];
    const action = attackFor(config, state, seat);
    if (!input.pressed.length) continue;
    const keys = [...new Set([...(input.held ?? []), ...input.pressed])];
    for (const [index, key] of input.pressed.entries()) {
      const sampled = input.sampled;
      const { x, y } = (Array.isArray(sampled) ? sampled[index] :
        (sampled as Partial<Record<Command['key'], Stick>> | undefined)?.[key]) ?? input;
      if (action?.channel && fighter.attack!.frame < action.startup + action.active &&
          (key === action.slot || key === 'dash')) continue;
      const directions: Direction[] = [];
      if (y) directions.push(y === -1 ? 'up' : 'down');
      else if (x) directions.push(x === fighter.facing ? 'forward' : 'back');
      fighter.buffer.push({
        key, keys, x, directions, down: y === 1, sampledAt: state.frame, remaining: config.rules.inputBuffer
      });
    }
    bufferChain(fighter, action, config.fighters[seat].actions);
  }
}

function matchesCommand(action: FighterAction, command: Command) {
  return action.slot === command.key &&
    (!action.direction || command.directions.includes(action.direction)) &&
    action.comboKeys?.every(key => command.keys?.includes(key)) !== false;
}

function bufferChain(f: FighterState, action: ActionDefinition | undefined, moves: FighterAction[]) {
  const attack = f.attack;
  if (!attack || !action?.chain || attack.frame >= action.chain.close || !f.ground) return;
  const queued = attack.queuedChain ?? [];
  const last = queued.length ? moves.find(move => move.id === queued.at(-1)) : action;
  const directional = moves.filter(move => move.direction && move.posture !== 'air' && !move.linkOnly);
  let link = isAttack(last) ? last.chain : undefined;
  while (link) {
    const { actionId } = link;
    const next = moves.find(move => move.id === actionId);
    if (!next) break;
    const index = f.buffer.findIndex(command => command.key === next.slot &&
      !directional.some(move => matchesCommand(move, command)));
    if (index < 0) break;
    f.buffer.splice(index, 1);
    queued.push(next.id);
    link = isAttack(next) ? next.chain : undefined;
  }
  if (queued.length) attack.queuedChain = queued;
}

function emitSwing(f: FighterState, action: ActionDefinition, seat: 0 | 1, events: CombatEvent[]) {
  events.push({ kind: 'swing', source: seat, x: f.x, y: f.y, actionId: action.id, facing: f.facing });
}

function cancelControl(fighter: FighterState) {
  fighter.attack = null;
  delete fighter.frogFollowup;
  fighter.dash = 0;
  fighter.dashActive = false;
  fighter.guarding = false;
  fighter.moving = false;
  fighter.buffer = [];
  delete fighter.pendingCounter;
}

export function clearBufferedInputs(state: MatchState) {
  for (const fighter of state.fighters) {
    fighter.buffer = [];
    delete fighter.pendingCounter;
    if (fighter.attack) delete fighter.attack.queuedChain;
  }
}

function startLaunched(fighter: FighterState) {
  cancelControl(fighter);
  fighter.launched = true;
}

function startKnockdown(fighter: FighterState, recovery: Recovery = { phase: 'fall' }) {
  const facing = recovery.facing ?? fighter.reaction?.facing ?? fighter.facing;
  cancelControl(fighter);
  delete fighter.launched;
  delete fighter.reaction;
  fighter.recovery = { ...recovery, facing };
  fighter.hitstun = 0;
  fighter.blockstun = 0;
  fighter.combo = 0;
  fighter.controlled = 0;
}

export function recoveryDuration(frames: number | undefined, defaultFrames: number) {
  return frames && Number.isInteger(frames) && frames > 0 ? frames : defaultFrames;
}

function landKnockdown(fighter: FighterState, seat: 0 | 1, rules: Ruleset, events: CombatEvent[], fromAir = false) {
  startKnockdown(fighter, { facing: fighter.recovery?.facing, phase: 'down', remaining: recoveryDuration(rules.knockdownFrames, DEFAULT_KNOCKDOWN_FRAMES) });
  fighter.push = 0;
  delete fighter.pushAccent;
  events.push({ kind: 'knockdown', source: seat, x: fighter.x, y: fighter.y, ...(fromAir && { reaction: 'air' as const }) });
}

function advanceRecovery(fighter: FighterState, seat: 0 | 1, rules: Ruleset, events: CombatEvent[]) {
  const recovery = fighter.recovery;
  if (!recovery) return false;
  if (recovery.phase === 'fall' || --recovery.remaining > 0) return true;
  if (recovery.phase === 'down') {
    fighter.recovery = { ...recovery, phase: 'rise', remaining: recoveryDuration(rules.riseFrames, DEFAULT_RISE_FRAMES) };
    events.push({ kind: 'rise', source: seat, x: fighter.x, y: fighter.y });
    return true;
  }
  fighter.recovery = null;
  return false;
}

function startAction(f: FighterState, action: FighterAction, seat: 0 | 1, events: CombatEvent[],
  energyCost = 0, queuedChain?: string[]) {
  const attack = isAttack(action) ? action : undefined;
  const tearCost = attack?.tearCost ?? 0;
  if (tearCost > 0 && (f.tearUnits ?? 0) < tearCost * TEAR_UNITS_PER_POINT) {
    events.push({ kind: 'tears-short', source: seat, x: f.x, y: f.y, actionId: action.id, amount: tearCost });
    return false;
  }
  f.energy -= energyCost;
  if (tearCost) addTearUnits(f, -tearCost * TEAR_UNITS_PER_POINT);
  f.attack = { id: action.id, frame: 0, connected: false, landed: false,
    ...(attack?.cinematicFreeze && { cinematicFreezeUntil: attack.startup }) };
  if (queuedChain?.length) f.attack.queuedChain = queuedChain;
  f.guarding = false;
  f.dash = 0;
  delete f.reaction;
  if (action.slot !== 'ULT' && (!attack?.swingOnActive || attack.startup <= (attack.swingLead ?? 0))) {
    events.push({ kind: 'swing', source: seat, x: f.x, y: f.y, actionId: action.id, facing: f.facing });
  }
  return true;
}

function advanceAttack(fighter: FighterState, attack: Attack, action: ActionDefinition, input: InputFrame) {
  const end = action.startup + action.active;
  if (action.channel && attack.frame < end) {
    if (!isHeld(input, action.slot)) attack.released = true;
    if (!attack.released && attack.frame === end - 1) {
      if (action.channel === 'cry') return;
      addTearUnits(fighter, -sprayUnitsPerTick);
      if (fighter.tearUnits) {
        attack.sustainedFrames = (attack.sustainedFrames ?? 0) + 1;
        if (attack.sustainedFrames % sprayHitInterval === 0) {
          attack.connected = false;
          delete attack.connectedGroups;
        }
        return;
      }
    }
  }
  attack.frame++;
}

function summonEvent(summon: Summon, kind: CombatEvent['kind']): CombatEvent {
  const { source, x, y, facing, actionId } = summon;
  return { kind, source, x, y, facing, actionId };
}

function cinematicEntrance(state: MatchState, config: MatchConfig) {
  for (const seat of seats) {
    const action = attackFor(config, state, seat);
    if (action?.cinematicFreeze && state.fighters[seat].attack!.frame < action.startup) return { seat, action };
  }
}

export type UltimateDirection = 'up' | 'down';

export interface UltimateAvailability {
  action?: ActionDefinition;
  cost: number;
  reason?: UltimateUnavailable;
}

const postureMatches = (action: FighterAction, fighter: FighterState) =>
  action.posture === 'any' || (action.posture === 'ground') === Boolean(fighter.ground);

const exclusiveUltimate = (action: ActionDefinition) => action.cinematicFreeze || action.cutIn || action.summon;

export function ultimateAvailability(state: MatchState, config: MatchConfig, seat: 0 | 1,
  direction?: UltimateDirection, keys: readonly Command['key'][] = []): UltimateAvailability {
  const fighter = state.fighters[seat];
  const definition = config.fighters[seat];
  const matching = definition.actions.filter(isAttack).filter(action => action.slot === 'ULT' &&
    action.direction === direction && action.comboKeys?.every(key => keys.includes(key)) !== false);
  const action = matching.find(move => postureMatches(move, fighter)) ?? matching[0];
  if (!action) return { cost: 0, reason: 'unbound' };
  const cost = action.energyCost ?? definition.ultimateCost ?? 0;
  const check = { action, cost };
  if (state.cutIn || state.summon?.phase === 'cut-in' || cinematicEntrance(state, config)) {
    return { ...check, reason: 'cinematic' };
  }
  if (!postureMatches(action, fighter)) return { ...check, reason: action.posture === 'air' ? 'air' : 'ground' };
  const current = attackFor(config, state, seat);
  const canCancel = fighter.attack?.landed && (current?.cancelOnHit?.includes(action.id) ||
    current?.cancelOnHit?.includes('ULT'));
  const canCancelCry = action.cutIn && current?.channel === 'cry';
  if (state.phase !== 'fight' || state.freeze > 0 || fighter.hp <= 0 || fighter.launched || fighter.hitstun ||
      fighter.blockstun || fighter.guardBreak || fighter.recovery || fighter.pendingCounter ||
      carriedBySummon(state, seat) || (fighter.attack ? !canCancel && !canCancelCry : action.linkOnly) ||
      ((action.cutIn || action.summon) && (fighter.dash || fighter.push)) || !frogCanStart(action, fighter, state)) {
    return { ...check, reason: 'recovery' };
  }
  if ((action.cutIn || action.summon) && (state.summon || seats.some(source => {
    const pending = attackFor(config, state, source)?.cutIn;
    return pending && state.fighters[source].attack!.frame < pending.at;
  }))) return { ...check, reason: 'cinematic' };
  if (fighter.energy < cost) return { ...check, reason: 'energy' };
  if ((fighter.tearUnits ?? 0) < (action.tearCost ?? 0) * TEAR_UNITS_PER_POINT) {
    return { ...check, reason: 'tears' };
  }
  return check;
}

function rejectUltimate(fighter: FighterState, seat: 0 | 1, events: CombatEvent[],
  reason: UltimateUnavailable, action?: ActionDefinition, cost?: number) {
  const detail = { source: seat, x: fighter.x, y: fighter.y, actionId: action?.id, ultimateReason: reason };
  if (reason === 'energy') events.push({ ...detail, kind: 'ultimate-no-energy', amount: cost });
  else if (reason === 'tears') events.push({ ...detail, kind: 'tears-short', amount: action?.tearCost });
  else if (action?.cutIn && (reason === 'ground' || reason === 'recovery')) {
    events.push({ ...detail, kind: 'wave-unavailable', requirement: reason });
  } else events.push({ ...detail, kind: 'ultimate-unavailable' });
}

function startUltimates(state: MatchState, config: MatchConfig, events: CombatEvent[]) {
  const requests = seats.flatMap(seat => {
    const fighter = state.fighters[seat];
    const command = fighter.buffer.find(item => item.key === 'ULT');
    if (!command) return [];
    const direction = command.directions.find((item): item is UltimateDirection => item === 'up' || item === 'down');
    const { action, cost, reason } = ultimateAvailability(state, config, seat, direction, command.keys);
    // Retain a buffered command briefly while waiting for an ordinary cancel window.
    if (reason === 'recovery' && action && !exclusiveUltimate(action) && command.remaining > 1) return [];
    fighter.buffer = fighter.buffer.filter(item => item !== command);
    if (reason) {
      if (action || config.fighters[seat].actions.some(move => move.slot === 'ULT')) {
        rejectUltimate(fighter, seat, events, reason, action, cost);
      }
      return [];
    }
    return action ? [{ seat, fighter, command, action, cost }] : [];
  });

  let selected = requests;
  if (requests.length === 2 && requests.some(({ action }) => exclusiveUltimate(action))) {
    // A higher-cost request claims an exclusive entrance. Equal costs clash and neither pays.
    const [first, second] = requests;
    selected = first.cost === second.cost ? [] : [first.cost > second.cost ? first : second];
    for (const request of requests) {
      if (!selected.includes(request)) rejectUltimate(request.fighter, request.seat, events, 'contested', request.action);
    }
  }
  for (const { seat, fighter, command, action, cost } of selected) {
    const target = state.fighters[other(seat)];
    faceOpponentWhenFree(fighter, target);
    startAction(fighter, action, seat, events, cost);
    startFrog(action, fighter, state, config, seat);
    fighter.buffer = fighter.buffer.filter(item => item.sampledAt !== command.sampledAt);
    fighter.moving = false;
    if (exclusiveUltimate(action)) {
      delete fighter.walk;
      clearBufferedInputs(state);
    }
    const { facing, x, y } = fighter;
    if (action.cutIn) events.push({ kind: 'wave-windup', source: seat, actionId: action.id, x, y, facing });
    if (action.summon) {
      state.summon = {
        source: seat, actionId: action.id, ...aimSummon(config.arena, target, facing, state.arenaFrame),
        phase: 'cut-in', frame: 0
      };
      events.push(summonEvent(state.summon, 'summon-start'));
    }
    events.push({ kind: 'ultimate', source: seat, x, y, actionId: action.id, impactTier: 'ultimate' });
    for (const cue of action.audioTimeline ?? []) {
      if (cue.frame === 0) events.push({ kind: 'action-audio', source: seat, x, y,
        actionAudio: { attack: fighter.attack!, cue } });
    }
  }
  return { started: selected.map(request => request.seat), paused: selected.some(request => exclusiveUltimate(request.action)) };
}

function beginActionCutIn(state: MatchState, config: MatchConfig, events: CombatEvent[]) {
  for (const source of seats) {
    const fighter = state.fighters[source];
    const action = attackFor(config, state, source);
    if (!action?.cutIn || fighter.attack?.frame !== action.cutIn.at) continue;
    state.cutIn = { source, frame: 0, duration: action.cutIn.duration };
    clearBufferedInputs(state);
    events.push({ kind: 'wave-cut-in', source, actionId: action.id, x: fighter.x, y: fighter.y,
      facing: fighter.facing });
    return;
  }
}

function updateGuardWindow(fighter: FighterState, input: InputFrame, windowFrames: number) {
  if (input.y !== 1) {
    delete fighter.guardCounterLeft;
  } else if (!fighter.guarding || fighter.blockstun > 0) {
    fighter.guardCounterLeft = 0;
  } else {
    fighter.guardCounterLeft = fighter.guardCounterLeft === undefined
      ? windowFrames : Math.max(0, fighter.guardCounterLeft - 1);
  }
}

function faceOpponentWhenFree(fighter: FighterState, opponent: FighterState) {
  if (fighter.hitstun || fighter.launched || fighter.blockstun || fighter.guardBreak || fighter.recovery ||
      fighter.attack || fighter.dash || fighter.guarding || fighter.x === opponent.x) return;
  fighter.facing = fighter.x < opponent.x ? 1 : -1;
}

function updateControl(
  state: MatchState, config: MatchConfig, seat: 0 | 1, input: InputFrame, events: CombatEvent[], justStarted: boolean
) {
  const f = state.fighters[seat];
  const opponent = state.fighters[other(seat)];
  const definition = config.fighters[seat];
  const wasMoving=f.moving;
  f.moving = false;
  if(f.hp<=0){f.attack=null;f.guarding=false;f.dash=0;return;}
  for (const counter of ['hitstun', 'blockstun', 'guardWait', 'slow'] as const) {
    if (f[counter] > 0) f[counter]--;
  }
  if (f.guardBreak > 0 && --f.guardBreak === 0) {
    f.guard = Math.ceil(config.rules.guardMax / 2);
    f.guardWait = config.rules.guardDelay;
  }
  if (advanceRecovery(f, seat, config.rules, events)) return;
  if (justStarted) return;

  const locked = f.launched || f.hitstun > 0 || f.blockstun > 0 || f.guardBreak > 0;
  if (locked && f.combo > 0 && ++f.controlled >= config.rules.comboControlLimit) {
    startKnockdown(f);
    f.vy = Math.max(0, f.vy);
    return;
  }
  if (f.reaction) {
    f.reaction.elapsed++;
    const landing = f.reaction.landedAt;
    if ((!f.hitstun && f.ground && (landing === undefined || f.reaction.elapsed - landing >= 5))) {
      delete f.reaction;
    }
  }

  if (f.launched) return;
  if (!locked) {
    f.combo = 0;
    f.controlled = 0;
  }
  if (f.pendingCounter) {
    const counter = definition.actions.find(action => action.id === f.pendingCounter);
    if (counter) startAction(f, counter, seat, events);
    delete f.pendingCounter;
    return;
  }


  let previousAction = actionFor(config, state, seat);
  if(f.attack?.id==='frog-crouch'){
    if(!locked&&f.ground&&input.held?.includes('C')){f.push=0;f.guarding=false;return;}
    f.attack=null;previousAction=undefined;
  }
  if (f.attack && previousAction) {
    const oldFrame = f.attack.frame;
    if (isAttack(previousAction)) {
      advanceAttack(f, f.attack, previousAction, input);
      if (previousAction.swingOnActive && f.attack.frame !== oldFrame &&
        f.attack.frame === previousAction.startup - (previousAction.swingLead ?? 0)) {
        emitSwing(f, previousAction, seat, events);
      }
    } else {
      f.attack.frame++;
    }
    const special = isAttack(previousAction) && (previousAction.summon || previousAction.projectile || previousAction.channel);
    if (!special && f.attack.frame >= previousAction.startup + previousAction.active && !f.attack.connected) {
      events.push({ kind: 'whiff', source: seat, x: f.x, y: f.y });
      f.attack.connected = true;
    }
    if (f.attack.frame >= previousAction.startup + previousAction.active + previousAction.recovery) {
      f.attack = null;
      previousAction = undefined;
    }
  }

  if(f.frogFollowup){
    if(locked||!frogPowered(f,state)){delete f.frogFollowup;}
    else if(!f.attack||(f.attack.id==='frog-evade'&&f.attack.frame>=12)){
      delete f.frogFollowup;
      const laugh=definition.actions.find(a=>'frog' in a&&a.frog==='laugh') as ActionDefinition;
      f.buffer=[];startFrog(laugh,f,state,config,seat);startAction(f,laugh,seat,events);return;
    }
  }

  faceOpponentWhenFree(f, opponent);
  if (locked) {
    f.guarding = f.blockstun > 0 && f.guardBreak === 0 && f.hitstun === 0;
    return;
  }

  const chain = isAttack(previousAction) ? previousAction.chain : undefined;
  const currentAttack = f.attack;
  if (f.ground && currentAttack && chain && currentAttack.frame >= chain.open &&
    currentAttack.frame <= chain.close && currentAttack.queuedChain?.[0] === chain.actionId) {
    const next = definition.actions.find(action => action.id === chain.actionId);
    if (next && startAction(f, next, seat, events, 0, currentAttack.queuedChain.slice(1))) return;
    delete currentAttack.queuedChain;
  }

  const cancels = f.attack?.landed ? previousAction?.cancelOnHit : undefined;
  const canChain = f.attack && isAttack(previousAction) && (f.attack.guardLinked ||
    (previousAction.chainAfter !== undefined && f.attack.frame >= previousAction.chainAfter));
  const postureMoves = definition.actions.filter(action =>
    action.slot !== 'ULT' && !(isAttack(action) && (action.summon || action.cutIn)) && postureMatches(action, f));
  const candidates = postureMoves.filter(action =>
    (f.attack ? cancels?.includes(action.id) || cancels?.includes(action.slot) ||
      (canChain && action.linkOnly && action.slot === previousAction?.slot && previousAction.cancelOnHit?.includes(action.id))
      : !action.linkOnly)
  );
  candidates.sort((a, b) => (b.comboKeys?.length ?? 0) - (a.comboKeys?.length ?? 0) ||
    Number(Boolean(b.direction)) - Number(Boolean(a.direction)) ||
    slotPriority.indexOf(a.slot) - slotPriority.indexOf(b.slot));
  for (const action of candidates) {
    const chordSize = action.comboKeys?.length ?? 0;
    const command = f.buffer.find(item => matchesCommand(action, item) &&
      (action.direction || !postureMoves.some(move => move.direction && !move.linkOnly &&
        (move.comboKeys?.length ?? 0) >= chordSize && matchesCommand(move, item))));
    if (!command) continue;
    if (!frogCanStart(action,f,state)) {
      events.push({ kind: 'skill-unavailable', source: seat, x: f.x, y: f.y, actionId: action.id,
        requirement: f.ground ? 'recovery' : 'ground' });
      f.buffer = f.buffer.filter(item => item.sampledAt !== command.sampledAt);
      return;
    }
    const selectedId = isAttack(action) ? startWhale(action, f, state) : action.id;
    const selectedAction = definition.actions.find(move => move.id === selectedId) ?? action;
    if (!startAction(f, selectedAction, seat, events)) {
      f.buffer = f.buffer.filter(item => item !== command);
      continue;
    }
    if (definition.id === 'frog' && isAttack(action)) startFrog(action, f, state, config, seat);
    const attack = isAttack(action) ? action : undefined;
    if (attack?.channel && !isHeld(input, action.slot)) f.attack!.released = true;
    f.buffer = f.buffer.filter(item => item !== command &&
      (item.sampledAt !== command.sampledAt || (attack?.chain && item.key === action.slot)));
    bufferChain(f, attack, definition.actions);
    return;
  }
  const bound=(f.bindUntil??0)>state.arenaFrame;
  const jump = bound ? undefined : f.buffer.find(command => command.key === 'jump');
  const dropping = Boolean(jump?.down && f.ground && f.ground !== 'floor');
  if (f.ground && jump && (!f.attack || (!dropping && cancels?.includes('jump')))) {
    f.buffer = f.buffer.filter(item => item.sampledAt !== jump.sampledAt);
    f.attack = null;
    delete f.reaction;
    f.ignorePlatform = dropping ? f.ground : null;
    f.vy = dropping ? 2 : -definition.jump;
    f.jumpCount=dropping?0:1;f.secondApex=false;f.jumpOriginY=f.y;
    events.push({ kind: dropping ? 'drop' : 'jump', source: seat, x: f.x, y: f.y });
    f.ground = null;
    f.guarding = false;
    f.dash = 0;
    return;
  }
  if (f.attack) return;

  const airborne = !f.ground;
  if (jump && airborne && !jump.down && !f.dash && !f.airActionUsed && definition.airJump) {
    f.buffer = f.buffer.filter(item => item.sampledAt !== jump.sampledAt);
    f.airActionUsed = true;
    f.vy = -definition.airJump;
    f.jumpCount=2;f.secondApex=false;
    events.push({ kind: 'air-jump', source: seat, x: f.x, y: f.y });
    return;
  }
  const dash = !bound && f.buffer.find(command => command.key === 'dash');
  if (dash && !f.dash && (!airborne || (definition.airDash && !f.airActionUsed))) {
    f.buffer = f.buffer.filter(item => item.sampledAt !== dash.sampledAt);
    const cost = config.rules.dashGuardCost?.[airborne ? 'air' : 'ground'] ?? 0;
    if (f.guard < cost) {
      events.push({ kind: 'dash-no-stamina', source: seat, x: f.x, y: f.y });
    } else {
      if (cost > 0) {
        f.guard -= cost;
        f.guardWait = config.rules.guardDelay;
      }
      f.facing = dash.x || f.facing;
      f.dash = airborne ? 6 : 8;
      if(definition.id==='frog')startFrogDodge(f,state);
      if (airborne) f.airActionUsed = true;
      f.guarding = false;
      events.push({ kind: 'dash', source: seat, x: f.x, y: f.y, direction: f.facing });
      return;
    }
  }
  f.guarding = Boolean(f.ground && input.y === 1 && !f.dash);
  if (!f.guarding && f.guardWait === 0 && state.frame % 3 === 0) {
    f.guard = Math.min(config.rules.guardMax, f.guard + 1);
  }
  f.moving = !f.guarding && Boolean(input.x || f.dash);
  if(wasMoving&&!f.moving)f.poseEvent={kind:'brake',tick:state.arenaFrame};
}

function releaseUnsupportedGround(fighter: FighterState, arena: ArenaDefinition, frame: number) {
  if (!fighter.ground || fighter.ground === 'floor') return;
  const support = arena.platforms.find(platform => platform.id === fighter.ground);
  if (support) {
    const deck = platformAt(support, frame);
    if (fighter.x >= deck.left && fighter.x <= deck.right) return;
  }
  fighter.ground = null;
  fighter.guarding = false;
  fighter.vy = 0;
  if (fighter.hitstun > 0 && !fighter.recovery) startLaunched(fighter);
}

function landingPlatform(arena: ArenaDefinition, fighter: FighterState, from: Position, frame: number, previousFrame: number) {
  let first: ReturnType<typeof platformContact>;
  for (const platform of arena.platforms) {
    if (platform.id === fighter.ignorePlatform) continue;
    const contact = platformContact(platform, frame, from, fighter, previousFrame);
    if (!contact || (first && contact.time >= first.time)) continue;
    if (fighter.x >= contact.surface.left && fighter.x <= contact.surface.right) first = contact;
  }
  return first?.surface;
}

function motion(
  state: MatchState, config: MatchConfig, seat: 0 | 1, input: InputFrame, events: CombatEvent[],
  previousArenaFrame = state.arenaFrame - 1
) {
  const f = state.fighters[seat];
  const definition = config.fighters[seat];
  const arena = config.arena;
  const action = attackFor(config, state, seat);
  const speedScale=frogPowered(f,state)?FROG_RULES.poweredSpeed:1;
  // Airborne laughter holds the caster, but interruption or rice binding still releases them.
  if (!f.ground && action && 'frog' in action && (action.frog==='laugh'||action.frog==='global') &&
      !f.hitstun && !f.recovery && (f.bindUntil??0)<=state.arenaFrame) {
    f.vy=0;f.push=0;f.moving=false;return false;
  }
  let move = 0;
  let walking = false;
  const speedFactor = f.slow && !f.push ? slowedSpeed : 1;
  const accent = f.pushAccent ?? 0;
  delete f.pushAccent;
  if (f.push !== 0) {
    move = f.push + Math.sign(f.push) * accent;
    if (accent > 0) f.pushAccent = -accent;
    f.push -= Math.sign(f.push) * Math.min(1, Math.abs(f.push));
  } else if (f.dash > 0) {
    move = definition.dash * f.facing * (definition.id==='frog'&&frogPowered(f,state)?2:1);
    f.dash--;
  } else if (f.attack && action) {
    const frame = f.attack.frame;
    if (frame >= (action.advanceFrom ?? 0) && frame < (action.advanceUntil ?? action.startup)) {
      move = f.facing * action.advance;
    }
    if (frame >= action.startup && frame < action.startup + action.active) {
      move = f.facing * (action.activeAdvance ?? 0);
    }
    if (!f.ground) move += Math.round(definition.airSpeed * (action.airControl ?? 0)) * speedScale * input.x;
    if (action.channel === 'spray' && frame < action.startup + action.active) {
      move = input.x * (f.ground ? definition.run : definition.airSpeed) * spraySpeed * speedScale;
      walking = Boolean(f.ground && move);
    }
  } else if (!f.hitstun && !f.launched && !f.blockstun && !f.guardBreak && !f.guarding && !f.recovery && !f.attack) {
    move = input.x * (f.ground ? definition.run : definition.airSpeed) * speedScale;
    walking = Boolean(f.ground && move);
  }
  const previousX = f.x;
  if ((f.bindUntil ?? 0) > state.arenaFrame) {
    move = 0; f.push = 0; f.moving = false; walking = false;
    delete f.pushAccent;
    if (!f.ground) f.vy = Math.max(6, f.vy);
  }
  f.x = clamp(f.x + move * speedFactor, arena.left, arena.right);
  releaseUnsupportedGround(f, arena, state.arenaFrame);
  if (f.ground) return walking;
  const previousY = f.y;
  if (!(config.rules.airDashPauseGravity && f.dashActive && f.airActionUsed)) {
    f.vy += 1;
    f.y += f.vy;
    if(f.jumpCount===2&&Math.abs(f.vy)<=1)f.secondApex=true;
  }
  const platform = landingPlatform(arena, f, { x: previousX, y: previousY }, state.arenaFrame, previousArenaFrame);
  if (platform || (f.vy > 0 && f.y >= arena.floor)) {
    if (f.vy >= 5 && !f.recovery && !f.launched) events.push({
      kind: 'land', source: seat, x: f.x, y: platform?.y ?? arena.floor,
      ...(f.reaction?.kind === 'air' ? { reaction: 'air' as const } : {})
    });
    f.ground = platform?.id ?? 'floor';
    f.y = platform?.y ?? arena.floor;
    f.vy = 0;
    f.ignorePlatform = null;
    f.airActionUsed = false;
    f.jumpCount=0;f.secondApex=false;
    if (f.launched || f.recovery?.phase === 'fall') landKnockdown(f, seat, config.rules, events, true);
    if (f.reaction?.kind === 'air') f.reaction.landedAt = f.reaction.elapsed;
  }
  return false;
}

function separate(state: MatchState, config: MatchConfig, previous: Duo<Position>, waking: Duo<boolean>) {
  const [a, b] = state.fighters;
  if([a,b].some(f=>f.attack?.id==='frog-burrow'&&f.attack.frame<FROG_RULES.warpHidden))return;
  if (config.rules.dashPassThrough && (a.dashActive || b.dashActive)) return;
  const arena = config.arena;
  const width = (config.fighters[0].bodyWidth + config.fighters[1].bodyWidth) / 2;
  if (Math.abs(a.y - b.y) >= 82 ||
      (a.recovery && a.recovery.phase !== 'fall') || (b.recovery && b.recovery.phase !== 'fall')) return;
  const leftSeat = previous[0].x < previous[1].x ? 0 : previous[0].x > previous[1].x ? 1 : a.facing === 1 ? 0 : 1;
  const left = state.fighters[leftSeat];
  const right = state.fighters[other(leftSeat)];
  const penetration = width - (right.x - left.x);
  if (penetration <= 0) return;
  if (waking[0] || waking[1]) {
    // Restore body collision without shoving the recovering fighter off its support.
    if (waking[0] && waking[1]) return;
    const recovered = waking[leftSeat] ? left : right;
    const standing = waking[leftSeat] ? right : left;
    const distance = waking[leftSeat] ? width : -width;
    const x = recovered.x + distance;
    standing.x = clamp(x < arena.left || x > arena.right ? recovered.x - distance : x, arena.left, arena.right);
    return;
  }
  left.x = clamp(left.x - penetration / 2, arena.left, arena.right - width);
  right.x = clamp(right.x + penetration / 2, arena.left + width, arena.right);
  left.x = Math.min(left.x, right.x - width);
  right.x = Math.max(right.x, left.x + width);
}

type HitProfile = Pick<ActionDefinition, 'id' | 'damage' | 'hitstun' | 'blockstun' | 'guardCost' |
  'push' | 'lift' | 'stop' | 'impact' | 'unblockable' | 'slow' | 'hitTimeline' | 'knockdown' | 'feedback' | 'guardHitsToBreak' | 'fixedDamage'> &
  Partial<Pick<ActionDefinition, 'slot' | 'pose'>>;

interface Contact {
  entityId?: number;
  source: 0 | 1;
  target: 0 | 1;
  action: HitProfile;
  attack?: Attack;
  group?: string;
  earnsTears?: boolean;
  blocked: boolean;
  counterAction?: string;
  facing: Side;
  x: number;
  y: number;
}

function counterForContact(state: MatchState, config: MatchConfig, seat: 0 | 1) {
  const defender = state.fighters[seat];
  if (!defender.ground) return;
  const counter=config.fighters[seat].guardCounter;
  if (defender.guarding && (counter?.whileGuarding || defender.guardCounterLeft)) return counter?.actionId;
  const stance = actionFor(config, state, seat);
  if (stance && 'counterTo' in stance && defender.attack && isActiveFrame(stance, defender.attack.frame)) {
    return stance.counterTo;
  }
}

function contactHurtboxes(state: MatchState, config: MatchConfig, seat: 0 | 1) {
  const fighter = state.fighters[seat];
  return hurtRegionsFor(config.fighters[seat], actionFor(config, state, seat), fighter.attack?.frame ?? 0)
    .map(box => worldBox(box, fighter.x, fighter.y, fighter.facing));
}

function protectedFromHit(state: MatchState, config: MatchConfig, seat: 0 | 1) {
  const fighter = state.fighters[seat];
  return Boolean(fighter.recovery || (config.rules.dashInvulnerable && fighter.dashActive) ||
    carriedBySummon(state, seat));
}

function collectContacts(state: MatchState, config: MatchConfig, events: CombatEvent[]): Contact[] {
  return seats.flatMap(source => {
    const target = other(source);
    const f = state.fighters[source];
    const defender = state.fighters[target];
    const action = actionFor(config, state, source);
    const attack = f.attack;
    if (!isAttack(action) || !attack || !isActiveFrame(action, attack.frame)) return [];
    const windows = hitWindowsFor(action, attack.frame);
    for (const turret of opposingTurrets(state, source)) {
      if (attack.hitTurrets?.includes(turret.kind) || !windows.some(window => window.boxes.some(box =>
        overlap(worldBox(box, f.x, f.y, f.facing), turretBox(turret))))) continue;
      (attack.hitTurrets ??= []).push(turret.kind);
      damageTurret(state, turret, events);
    }
    if ((attack.connected && !attack.connectedGroups) || protectedFromHit(state, config, target)) return [];
    const hurtboxes = contactHurtboxes(state, config, target);
    const facing = action.radial ? (defender.x < f.x ? -1 : 1) : f.facing;
    const frontal = !action.unblockable && defender.facing === -facing;
    const counterAction = frontal ? counterForContact(state, config, target) : undefined;
    for (const window of windows) {
      if (attack.connectedGroups?.includes(window.group)) continue;
      for (const box of window.boxes) {
        const hitbox = worldBox(box, f.x, f.y, f.facing);
        const hurtbox = hurtboxes.find(hurt => overlap(hitbox, hurt) && (!action.radial ||
          Math.hypot(Math.max(hurt.x,Math.min(f.x,hurt.x+hurt.w))-f.x,Math.max(hurt.y,Math.min(f.y-65,hurt.y+hurt.h))-(f.y-65))<=action.hitbox.w/2));
        if (!hurtbox) continue;
        return [{
          source, target, attack, group: window.group, earnsTears: action.slot === 'A',
          action: {
            ...action,
            damage: window.damage ?? action.damage,
            hitstun: window.hitstun ?? action.hitstun,
            blockstun: window.blockstun ?? action.blockstun,
            guardCost: window.guardCost ?? action.guardCost,
            push: window.push ?? action.push,
            lift: window.lift ?? action.lift,
            stop: window.stop ?? action.stop,
            knockdown: window.knockdown ?? action.knockdown
          },
          facing, counterAction, blocked: frontal && defender.guarding,
          x: (Math.max(hitbox.x, hurtbox.x) + Math.min(hitbox.x + hitbox.w, hurtbox.x + hurtbox.w)) / 2,
          y: (Math.max(hitbox.y, hurtbox.y) + Math.min(hitbox.y + hitbox.h, hurtbox.y + hurtbox.h)) / 2
        }];
      }
    }
    return [];
  });
}

function advanceSummon(state: MatchState, config: MatchConfig, previous: Duo<Position>,
  events: CombatEvent[]): Contact | undefined {
  const summon = state.summon;
  if (!summon || summon.phase === 'cut-in') return;
  summon.frame++;
  if (summon.phase === 'impact') {
    if (summon.frame >= summonImpactFrames) delete state.summon;
    return;
  }
  const { source, actionId, x, y } = summon;
  const target = other(source);
  const defender = state.fighters[target];
  const tip = dijiangTip(summon, summon.frame / summonFallFrames);
  if (!summon.carry && defender.y < y && !protectedFromHit(state, config, target)) {
    const from = dijiangTip(summon, (summon.frame - 1) / summonFallFrames);
    // Test the sweep in the defender's moving frame of reference.
    from.x += defender.x - previous[target].x;
    from.y += defender.y - previous[target].y;
    if (contactHurtboxes(state, config, target).some(box =>
      segmentBoxTime(from, tip, box, summonCatchRadius) !== undefined)) {
      summon.carry = { x: defender.x, y: defender.y, frame: summon.frame };
      defender.ground = null;
      defender.ignorePlatform = null;
      defender.attack = null;
      defender.buffer = [];
      defender.dash = 0;
      defender.push = 0;
      defender.vy = 0;
      defender.moving = false;
      defender.guarding = false;
      delete defender.walk;
      defender.reaction = { kind: 'air', elapsed: 0, facing: summon.facing === 1 ? -1 : 1 };
      events.push({ ...summonEvent(summon, 'summon-catch'), x: defender.x, y: defender.y - 54 });
    }
  }
  const carried = summon.carry;
  if (summon.frame < summonFallFrames) {
    if (carried) {
      const start = dijiangTip(summon, carried.frame / summonFallFrames);
      const progress = (tip.y - start.y) / (y - start.y);
      const nextY = carried.y + (y - carried.y) * progress;
      defender.x = carried.x + (x - carried.x) * progress;
      defender.vy = nextY - defender.y;
      defender.y = nextY;
      if (defender.reaction) defender.reaction.elapsed = summon.frame - carried.frame;
    }
    return;
  }
  if (carried) {
    defender.x = x;
    defender.y = y;
    defender.vy = 0;
    defender.ground = 'floor';
  }
  summon.phase = 'impact';
  summon.frame = 0;
  events.push(summonEvent(summon, 'summon-impact'));
  const action = config.fighters[source].actions.filter(isAttack).find(move => move.id === actionId);
  if (!action || (!carried && protectedFromHit(state, config, target)) || (defender.ground && defender.ground !== 'floor') ||
    Math.abs(defender.x - x) > summonArea.halfWidth ||
    defender.y < y - summonArea.above || defender.y > y + summonArea.below) return;
  const facing = defender.x === x ? summon.facing : defender.x > x ? 1 : -1;
  return { source, target, action: carried ? { ...action, lift: 0 } : action,
    blocked: false, facing, x: defender.x, y: defender.y - 62 };
}

function closestPoint(box: Box, x: number, y: number) {
  return { x: clamp(x, box.x, box.x + box.w), y: clamp(y, box.y, box.y + box.h) };
}

function blastCenterY(event: CombatEvent) {
  return event.kind === 'tear-splash' && !event.surface ? event.y : event.y - 7;
}

function collectBlastContact(state: MatchState, config: MatchConfig, event: CombatEvent, action: HitProfile,
  contacts: Contact[]) {
  const { source, x, y, radius = 0 } = event;
  const target = other(source);
  const defender = state.fighters[target];
  if (protectedFromHit(state, config, target)) return;
  const centerY = blastCenterY(event);
  const grenade = event.kind === 'grenade-impact';
  const candidates = contactHurtboxes(state, config, target).map(box => {
    const point = closestPoint(box, x, centerY);
    return { point, distance: Math.hypot((grenade ? defender.x : point.x) - x, point.y - centerY) };
  });
  candidates.sort((a, b) => a.distance - b.distance);
  const { point, distance } = candidates[0] ?? { point: { x, y }, distance: Infinity };
  if (distance >= radius) return;
  const facing = defender.x === x ? event.facing ?? 1 : defender.x > x ? 1 : -1;
  contacts.push({
    source, target, facing, ...point, earnsTears: event.kind === 'tear-splash',
    counterAction: !action.unblockable && defender.facing === -facing ? counterForContact(state, config, target) : undefined,
    blocked: !action.unblockable && defender.guarding && defender.facing === -facing,
    action: grenade ? { ...action, damage: Math.round(action.damage * (1 - .8 * distance / radius)) } : action
  });
}

function explodeProjectile(state: MatchState, config: MatchConfig, action: ActionDefinition, event: CombatEvent,
  contacts: Contact[], events: CombatEvent[]) {
  events.push(event);
  collectBlastContact(state, config, event, action, contacts);
  const centerY = blastCenterY(event);
  for (const tower of opposingTurrets(state, event.source)) {
    const point = closestPoint(turretBox(tower), event.x, centerY);
    if (Math.hypot(point.x - event.x, point.y - centerY) < (event.radius ?? 0)) damageTurret(state, tower, events);
  }
}

function advanceProjectile(state: MatchState, config: MatchConfig, projectile: Projectile,
  action: ActionDefinition, nextX: number, nextY: number, contacts: Contact[], events: CombatEvent[]) {
  const { arena } = config;
  const { source, facing } = projectile;
  const next = { x: clamp(nextX, arena.left, arena.right), y: nextY };
  const { kind, radius, halfWidth, turret, blastRadius } = action.projectile!;
  const impact = kind === 'crate' || kind === 'grenade' || kind === 'tear'
    ? landingImpact(arena, projectile, next, radius, state.arenaFrame, turret === 'howitzer' || kind === 'tear')
    : floorImpact(arena, projectile, next);
  const explodesOnLanding = kind === 'grenade' || kind === 'tear';
  const disappearsOnHit = kind === 'bolt';
  const travel = impact?.time ?? 1;
  const target = other(source);
  const defender = state.fighters[target];
  let hit: { box: Box; time: number } | undefined;
  if (kind !== 'grenade' && !projectile.connected && !protectedFromHit(state, config, target)) {
    for (const box of contactHurtboxes(state, config, target)) {
      const time = segmentBoxTime(projectile, next, box, radius, halfWidth);
      if (time !== undefined && (!hit || time < hit.time)) hit = { box, time };
    }
  }
  const crossedTurrets = explodesOnLanding ? [] : opposingTurrets(state, source)
    .filter(tower => !projectile.hitTurrets?.includes(tower.kind))
    .map(tower => ({ tower, time: segmentBoxTime(projectile, next, turretBox(tower), radius, halfWidth) ?? Infinity }))
    .sort((a, b) => a.time - b.time);
  for (const { tower, time } of crossedTurrets) {
    if (time > travel || (disappearsOnHit && time > (hit?.time ?? 1))) break;
    (projectile.hitTurrets ??= []).push(tower.kind);
    damageTurret(state, tower, events);
    if (disappearsOnHit) return false;
  }
  if (hit && hit.time <= travel) {
    const { box: hurtbox, time: hitTime } = hit;
    const contact = closestPoint(hurtbox, projectile.x + (next.x - projectile.x) * hitTime,
      projectile.y + (next.y - projectile.y) * hitTime);
    if (kind === 'tear') {
      explodeProjectile(state, config, action, { kind: 'tear-splash', source, ...contact, facing,
        radius: blastRadius ?? radius, actionId: action.id }, contacts, events);
      return false;
    }
    projectile.connected = true;
    contacts.push({
      source, target, action, facing, earnsTears: action.slot === 'A',
      counterAction: !action.unblockable && defender.facing === -facing ? counterForContact(state, config, target) : undefined,
      blocked: !action.unblockable && defender.guarding && defender.facing === -facing,
      ...contact
    });
    if (disappearsOnHit) return false;
  }
  if (impact) {
    if (kind === 'crate' && turret) {
      const support = arena.platforms.find(platform => platform.travel && platform.id === impact.surface.id);
      deployTurret(state, turret, source, impact.x, impact.surface.y, facing, events, support?.id);
    } else if (explodesOnLanding && blastRadius) {
      const event: CombatEvent = { kind: kind === 'tear' ? 'tear-splash' : 'grenade-impact', source, x: impact.x, y: impact.surface.y,
        facing, radius: blastRadius, actionId: action.id };
      if (kind === 'tear') event.surface = { left: impact.surface.left, right: impact.surface.right };
      explodeProjectile(state, config, action, event, contacts, events);
    } else if (kind !== 'bolt') {
      const { y, left, right } = impact.surface;
      events.push({ kind: 'pole-impact', source, x: impact.x, y, actionId: action.id, facing, surface: { left, right } });
      if (!projectile.connected) events.push({ kind: 'whiff', source, x: impact.x, y, actionId: action.id, facing });
    }
    return false;
  }
  if ((kind === 'bolt' || kind === 'wave') && (next.x !== nextX || nextY < 0 || nextY > arena.floor)) return false;
  projectile.x = next.x;
  projectile.y = next.y;
  if (next.x !== nextX) projectile.vx = 0;
  return true;
}

function moveProjectiles(state: MatchState, config: MatchConfig, contacts: Contact[], events: CombatEvent[]) {
  state.projectiles = state.projectiles.filter(projectile => {
    const action = config.fighters[projectile.source].actions.filter(isAttack).find(move => move.id === projectile.actionId);
    if (!action?.projectile) return false;
    const flies = advanceProjectile(state, config, projectile, action,
      projectile.x + projectile.vx, projectile.y + projectile.vy, contacts, events);
    projectile.vy += action.projectile.gravity;
    if (action.projectile.life !== undefined) {
      projectile.age = (projectile.age ?? 0) + 1;
      return flies && projectile.age < action.projectile.life;
    }
    return flies;
  });
  for (const source of seats) {
    const fighter = state.fighters[source];
    const action = attackFor(config, state, source);
    const throwData = action?.projectile;
    if (!action || !throwData || fighter.attack?.frame !== action.startup || fighter.attack.projectileSpawned) continue;
    fighter.attack.projectileSpawned = true;
    const { facing } = fighter;
    const projectile: Projectile = {
      actionId: action.id, source, facing, connected: false,
      x: clamp(fighter.x + facing * throwData.x, config.arena.left, config.arena.right),
      y: fighter.y + throwData.y, vx: facing * throwData.vx, vy: throwData.vy
    };
    if (throwData.life !== undefined) projectile.age = 0;
    if (throwData.reach === 0) {
      state.projectiles.push(projectile);
      continue;
    }
    const scale = throwData.reach / Math.hypot(projectile.vx, projectile.vy);
    if (advanceProjectile(state, config, projectile, action,
      projectile.x + projectile.vx * scale, projectile.y + projectile.vy * scale, contacts, events)) {
      state.projectiles.push(projectile);
    }
  }
}

type LandedTier = Exclude<ImpactTier, 'guard' | 'guard-break' | 'parry'>;
const impactRank: Record<LandedTier, number> = { light: 1, medium: 2, heavy: 3, launch: 4, ultimate: 5 };
const stopRange: Record<ImpactTier, readonly [number, number]> = {
  light: [2, 3], medium: [3, 4], heavy: [4, 5], launch: [4, 6], ultimate: [5, 6],
  guard: [1, 2], 'guard-break': [4, 4], parry: [1, 3]
};

function landedTier(action: HitProfile): LandedTier {
  if (action.slot === 'ULT') return 'ultimate';
  if (action.lift) return 'launch';
  if (action.knockdown || action.pose === 'finish') return 'heavy';
  return action.impact ?? (Math.abs(action.push) >= 12 ? 'heavy'
    : Math.abs(action.push) >= 7 || action.damage >= 80 ? 'medium' : 'light');
}

function contactStop(tier: ImpactTier, authored: number) {
  // Zero- and single-frame packets are intentionally soft, including late hits in sustained supers.
  if (authored < 2 && tier !== 'guard-break') return authored;
  return clamp(authored, ...stopRange[tier]);
}

function reactionKind(tier: LandedTier, airborne: boolean): 'air' | 'heavy' | 'light' {
  return airborne ? 'air' : impactRank[tier] >= impactRank.heavy ? 'heavy' : 'light';
}

function applyLandedResponse(defender: FighterState, landed: Contact[], frame: number) {
  // Keep the strongest physical reaction without allowing a weaker overlapping contact to erase stun.
  landed.sort((a, b) =>
    Number(Boolean(b.action.knockdown)) - Number(Boolean(a.action.knockdown)) ||
    Math.abs(b.action.lift) - Math.abs(a.action.lift) ||
    impactRank[landedTier(b.action)] - impactRank[landedTier(a.action)] ||
    Math.abs(b.action.push) - Math.abs(a.action.push) ||
    b.action.hitstun - a.action.hitstun ||
    Number(b.facing !== defender.facing) - Number(a.facing !== defender.facing));
  const { action, facing } = landed[0];
  const tier = landedTier(action);
  defender.hitstun = Math.max(...landed.map(hit => hit.action.hitstun));
  defender.blockstun = 0;
  defender.guarding = false;
  defender.moving = false;
  defender.push = facing * action.push;
  // Front-load strong recoil on the first playable tick, then repay it on the next.
  // This gives the impact a sharper start while preserving unobstructed travel.
  if (impactRank[tier] >= impactRank.heavy && Math.abs(action.push) >= 6) {
    defender.pushAccent = Math.min(4, Math.abs(action.push) / 4);
  } else {
    delete defender.pushAccent;
  }
  if (action.lift) {
    defender.ground = null;
    defender.vy = -action.lift;
  }
  const airborne = !defender.ground;
  const reaction = reactionKind(tier, airborne);
  defender.poseEvent = { kind: action.lift ? 'launch' : reaction === 'heavy' ? 'heavy' : 'hurt', tick: frame };
  defender.reaction = { kind: reaction, elapsed: 0, facing: facing === 1 ? -1 : 1 };
  if (action.knockdown) startKnockdown(defender);
  else if (airborne && !defender.recovery) startLaunched(defender);
}

function settle(state: MatchState, config: MatchConfig, contacts: Contact[], events: CombatEvent[]) {
  const contactStart = events.length;
  const evaded=new Set<0|1>();
  for(const contact of contacts){
    const {target,source}=contact,defender=state.fighters[target];
    if(!evaded.has(target)&&config.fighters[target].id==='frog'&&frogCrouching(defender)){
      warpFrog(state,config,target,source,'behind');evaded.add(target);
      events.push({kind:'parry',source:target,x:contact.x,y:contact.y,direction:defender.facing,impactTier:'parry'});
    }
  }
  for (const contact of contacts) {
    if (contact.entityId !== undefined) {
      continue;
    }
    const attack = contact.attack;
    if (!attack) continue;
    attack.connected = true;
    if (contact.action.hitTimeline) (attack.connectedGroups ??= []).push(contact.group!);
    if (evaded.has(contact.target) || contact.counterAction) continue;
    if (!contact.blocked) attack.landed = true;
    if (contact.blocked && contact.action.guardHitsToBreak) attack.guardLinked = true;
  }
  let maxStop = 0;
  const landed: Duo<Contact[]> = [[], []];
  const guards: Duo<{ push: number; stun: number } | undefined> = [undefined, undefined];
  for (const contact of contacts) {
    const { source, target, action, blocked, counterAction, facing, x, y, entityId, earnsTears } = contact;
    const defender = state.fighters[target];
    if(evaded.has(target)){
      if(entityId!==undefined)resolveContactEntity(state,entityId,target,false,true);
      continue;
    }
    if(entityId!==undefined)resolveContactEntity(state,entityId,target,blocked,Boolean(counterAction));
    defender.dash = 0;
    if (defender.guardCounterLeft !== undefined) defender.guardCounterLeft = 0;
    if (counterAction) {
      maxStop = Math.max(maxStop, contactStop('parry', action.stop));
      defender.pendingCounter = counterAction;
      events.push({ kind: 'parry', source: target, x, y, direction: defender.facing, impactTier: 'parry' });
      continue;
    }
    defender.attack = null;
    delete defender.frogFollowup;
    if (blocked) {
      if(action.guardHitsToBreak){
        const previous=defender.guardChain;
        const count=previous?.source===source&&previous.until>=state.arenaFrame?previous.count+1:1;
        defender.guardChain={source,count,until:state.arenaFrame+90};
        defender.guard=count>=action.guardHitsToBreak?0:Math.max(1,defender.guard-action.guardCost);
      }else defender.guard = Math.max(0, defender.guard - action.guardCost);
      defender.guardWait = config.rules.guardDelay;
      const push = facing * (action.guardHitsToBreak ? 1.15 : Math.ceil(action.push / 2));
      const prior = guards[target];
      guards[target] = { push: prior && Math.abs(prior.push) > Math.abs(push) ? prior.push : push,
        stun: Math.max(prior?.stun ?? 0, action.blockstun) };
      maxStop = Math.max(maxStop, contactStop('guard', action.stop));
      events.push({ kind: 'block', source, x, y, direction: facing, facing, actionId: action.id,
        impactTier: 'guard', ...(action.feedback && { feedback: action.feedback }) });
      if (defender.guard === 0 && defender.guardBreak === 0) {
        maxStop = Math.max(maxStop, contactStop('guard-break', action.stop));
        defender.guardBreak = config.rules.guardBreak;
        defender.guarding = false;
        defender.buffer = [];
        events.push({ kind: 'break', source, x, y, direction: facing, impactTier: 'guard-break' });
      }
      continue;
    }
    const tier = landedTier(action);
    maxStop = Math.max(maxStop, contactStop(tier, action.stop));
    landed[target].push(contact);
    defender.buffer = [];
    const rawDamage=action.fixedDamage?action.damage:Math.floor(action.damage * Math.max(35, 100 - 8 * defender.combo) / 100);
    const resisted=frogPowered(defender,state);
    const amount = Math.min(defender.hp,resisted?Math.round(rawDamage*FROG_RULES.incomingDamage*1000)/1000:rawDamage);
    defender.hp = Math.round((defender.hp-amount)*1000)/1000;
    if (amount > 0) {
      const attacker = state.fighters[source];
      if (action.slot && action.slot !== 'ULT') {
        attacker.energy = Math.min(MAX_ENERGY, attacker.energy + (config.fighters[source].ultimateGain?.onHit ?? 20));
      }
      defender.energy = Math.min(MAX_ENERGY, defender.energy + (config.fighters[target].ultimateGain?.onHurt ?? 10));
      addTearUnits(defender, 5 * TEAR_UNITS_PER_POINT);
      if (earnsTears) addTearUnits(attacker, 8 * TEAR_UNITS_PER_POINT);
      if (action.slow) defender.slow = Math.max(defender.slow, action.slow);
    }
    if (config.training && defender.hp === 0) defender.hp = config.fighters[target].maxHp;
    const chain = ++defender.combo;
    // Preserve the per-contact damage and combo ordering while reactions are resolved once below.
    if (action.knockdown) {
      defender.combo = 0;
      defender.controlled = 0;
    }
    events.push({
      kind: 'hit', source, x, y, amount, chain, direction: facing, facing, actionId: action.id,
      reaction: reactionKind(tier, !defender.ground || Boolean(action.lift)), impactTier: tier,
      impact: action.impact, heavy: impactRank[tier] >= impactRank.heavy, ...(action.feedback && { feedback: action.feedback })
    });
  }
  for (const seat of seats) {
    const fighter = state.fighters[seat];
    const guard = guards[seat];
    if (landed[seat].length) applyLandedResponse(fighter, landed[seat], state.arenaFrame);
    else if (guard) {
      fighter.push = guard.push;
      fighter.blockstun = guard.stun;
      delete fighter.pushAccent;
      delete fighter.reaction;
    }
    if (fighter.hitstun > 0 || fighter.launched || fighter.recovery) delete fighter.pendingCounter;
  }
  state.freeze = Math.min(maxStop, Math.max(0, 60 - state.comboFreeze));
  state.comboFreeze += state.freeze;
  const collisionEvents = events.slice(contactStart);
  const traded = seats.every(seat => collisionEvents.some(event => event.source === seat && event.kind === 'hit' && (event.amount ?? 0) > 0));
  for (const event of collisionEvents) {
    if (!event.impactTier) continue;
    event.hitstop = state.freeze;
    if (traded && event.kind === 'hit' && (event.amount ?? 0) > 0) event.trade = true;
  }
}

function rampToNextRound(state: MatchState, config: MatchConfig) {
  state.round++;
  state.arenaFrame = 0;
  state.remaining = config.rules.roundSeconds * config.rules.ticksPerSecond;
  state.fighters = [spawn(config, 0, state.round), spawn(config, 1, state.round)];
  delete state.entities;
  delete state.nextEntityId;
  state.projectiles = [];
  state.turrets = { bolt: null, howitzer: null };
  delete state.summon;
  delete state.cutIn;
  state.freeze = 0;
  state.comboFreeze = 0;
  state.result = null;
  state.phase = 'ready';
  state.phaseTicks = 120;
}

function roundResult(state: MatchState, config: MatchConfig): RoundResult | null {
  const [a, b] = state.fighters;
  if (!a.hp && !b.hp) return { winner: null, reason: 'double-ko' };
  if (!a.hp || !b.hp) return { winner: a.hp ? 0 : 1, reason: 'ko' };
  if (state.remaining > 0) return null;
  const difference = a.hp * config.fighters[1].maxHp - b.hp * config.fighters[0].maxHp;
  if (difference === 0) return { winner: null, reason: 'tie' };
  return { winner: difference > 0 ? 0 : 1, reason: 'time' };
}

function advanceArena(state: MatchState, config: MatchConfig) {
  state.arenaFrame = (state.arenaFrame ?? 0) + 1;
  for (const fighter of [...state.fighters, ...Object.values(state.turrets).filter(turret => turret !== null)]) {
    const support = 'ground' in fighter ? fighter.ground : fighter.support;
    const ride = config.arena.platforms.find(platform => platform.travel && platform.id === support);
    if (ride) {
      const shift = platformOffset(ride, state.arenaFrame) - platformOffset(ride, state.arenaFrame - 1);
      if (ride.travel?.axis === 'y') fighter.y += shift;
      else fighter.x = clamp(fighter.x + shift, config.arena.left, config.arena.right);
    }
  }
}

function isFallingAfterRound(fighter: FighterState) {
  return !fighter.ground && (fighter.launched || fighter.recovery?.phase === 'fall' || fighter.hp === 0);
}

function advanceRoundOverMotion(state: MatchState, config: MatchConfig, events: CombatEvent[]) {
  if (state.freeze > 0) {
    state.freeze--;
    return state.fighters.some(isFallingAfterRound);
  }

  if (state.fighters.some(isFallingAfterRound)) advanceArena(state, config);
  for (const seat of seats) {
    const fighter = state.fighters[seat];
    if (fighter.hp === 0 && !fighter.launched && !fighter.recovery) startKnockdown(fighter);
    if (isFallingAfterRound(fighter)) {
      motion(state, config, seat, NEUTRAL, events);
    } else if (fighter.ground && fighter.recovery?.phase === 'fall') {
      landKnockdown(fighter, seat, config.rules, events);
    }
  }
  const falling = state.fighters.some(isFallingAfterRound);
  if (!falling && events.some(event => event.kind === 'knockdown')) {
    // Leave the final landing visible even on unusually long falls.
    state.phaseTicks = Math.max(state.phaseTicks, roundOverLandingHold + 1);
  }
  return falling;
}

// Mutates only the supplied state. A structured clone of state is a restorable snapshot.
export function step(state: MatchState, inputs: Duo<InputFrame>, config: MatchConfig): CombatEvent[] {
  const events: CombatEvent[] = [];
  if (state.phase === 'match-over') return events;
  if (state.cutIn) {
    if (++state.cutIn.frame >= state.cutIn.duration) delete state.cutIn;
    return events;
  }
  const summon = state.summon;
  if (summon?.phase === 'cut-in') {
    summon.frame++;
    if (summon.frame === 29) events.push(summonEvent(summon, 'summon-confirm'));
    if (summon.frame >= summonCutInFrames) {
      summon.phase = 'fall';
      summon.frame = 0;
      events.push(summonEvent(summon, 'summon-drop'));
    }
    return events;
  }
  state.frame++;
  if (state.phase !== 'fight') {
    const stillFalling = state.phase === 'round-over' && advanceRoundOverMotion(state, config, events);
    if (--state.phaseTicks > 0 || (stillFalling && state.phaseTicks > -roundOverMaxExtraTicks)) return events;
    if (state.phase === 'ready') {
      state.phase = 'fight';
    } else if (state.winner !== null || state.draws >= (config.rules.drawsToFinish ?? 2)) {
      state.phase = 'match-over';
    } else {
      rampToNextRound(state, config);
    }
    return events;
  }

  const entrance = cinematicEntrance(state, config);
  if (entrance) {
    // Presentation advances, simulation clocks, statuses, entities and inputs do not.
    const { seat, action } = entrance;
    const fighter = state.fighters[seat];
    const attack=fighter.attack!;
    attack.frame++;
    for(const cue of action.audioTimeline??[])if(cue.frame===attack.frame)events.push({kind:'action-audio',source:seat,x:fighter.x,y:fighter.y,actionAudio:{attack,cue}});
    if (attack.frame === action.startup) {
      spawnEntities(state,config);
      if (action.frog === 'ascend') finishAscension(fighter,state);
      fighter.attack = null;
    }
    return events;
  }
  queueInputs(state, inputs, config);
  if (state.freeze > 0) {
    state.freeze--;
    return events;
  }

  const ultimates = startUltimates(state, config, events);
  if (ultimates.paused) return events;
  const previous: Duo<Position> = state.fighters.map(fighter => ({ x: fighter.x, y: fighter.y })) as Duo<Position>;
  const waking: Duo<boolean> = [false, false];
  advanceArena(state, config);
  const walkStart: Duo<number> = [state.fighters[0].x, state.fighters[1].x];
  for (const seat of seats) {
    if (carriedBySummon(state, seat)) continue;
    const fighter = state.fighters[seat];
    tickAscension(fighter,state);
    const lastAttack = fighter.attack;
    const lastFrame = lastAttack?.frame;
    const wasRising = fighter.recovery?.phase === 'rise';
    updateControl(state, config, seat, inputs[seat], events, ultimates.started.includes(seat));
    const attack = fighter.attack;
    if (attack && (attack !== lastAttack || attack.frame !== lastFrame)) {
      const timeline = actionFor(config, state, seat)?.audioTimeline;
      for (const cue of timeline ?? []) {
        if (cue.frame === attack.frame) {
          events.push({ kind: 'action-audio', source: seat, x: fighter.x, y: fighter.y, actionAudio: { attack, cue } });
        }
      }
    }
    waking[seat] = wasRising && !fighter.recovery;
    if (fighter.attack?.frame === 0 && !fighter.attack.released && attackFor(config, state, seat)?.channel === 'cry') {
      addTearUnits(fighter, cryUnitsPerTick);
    }
    const guardCounter = config.fighters[seat].guardCounter;
    if (guardCounter) updateGuardWindow(fighter, inputs[seat], guardCounter.windowFrames);
    // A queued command gets its full lifetime in playable frames, through hitstop.
    fighter.buffer = fighter.buffer.filter(command => --command.remaining > 0);
  }
  if (state.fighters.every(fighter => fighter.combo === 0 && fighter.blockstun === 0)) {
    state.comboFreeze = 0;
  }
  const walking = seats.map(seat => {
    const fighter = state.fighters[seat];
    fighter.dashActive = fighter.dash > 0;
    return !carriedBySummon(state, seat) && motion(state, config, seat, inputs[seat], events);
  });
  if (!seats.some(seat => carriedBySummon(state, seat))) separate(state, config, previous, waking);
  for (const fighter of state.fighters) settleFrogWarp(fighter, state);
  for (const fighter of state.fighters) releaseUnsupportedGround(fighter, config.arena, state.arenaFrame);
  for (const seat of seats) faceOpponentWhenFree(state.fighters[seat], state.fighters[other(seat)]);
  const summonContact = advanceSummon(state, config, previous, events);
  updateEntities(state, config);
  const contacts = collectContacts(state, config, events);
  for (const contact of entityContacts(state, config)) {
    if (carriedBySummon(state, contact.target)) continue;
    const defender = state.fighters[contact.target];
    const sourceX=contact.entity.definition.behavior==='frog-global'?(contact.entity.originX??contact.entity.x):contact.entity.x;
    const frontal = (sourceX - defender.x) * defender.facing > 0;
    contacts.push({
      ...contact, entityId: contact.entity.id,
      blocked: frontal && defender.guarding,
      counterAction: frontal ? counterForContact(state, config, contact.target) : undefined
    });
  }
  const beforeTurrets = events.length;
  stepTurrets(state, config, events);
  for (const event of events.slice(beforeTurrets)) {
    if (event.kind === 'turret-ready') collectBlastContact(state, config, event, buildWave, contacts);
  }
  moveProjectiles(state, config, contacts, events);
  if (summonContact) contacts.push(summonContact);
  settle(state, config, contacts, events);
  for (const seat of seats) {
    const fighter = state.fighters[seat];
    if (!fighter.recovery) continue;
    if (!fighter.ground) {
      if (fighter.recovery.phase !== 'fall') fighter.recovery = { phase: 'fall', facing: fighter.recovery.facing };
    } else if (fighter.recovery.phase === 'fall') landKnockdown(fighter, seat, config.rules, events);
  }

  for (const seat of seats) {
    const f = state.fighters[seat];
    const delta = f.x - walkStart[seat];
    if (!walking[seat] || !f.ground || f.hitstun || f.blockstun || delta * inputs[seat].x <= 0) {
      delete f.walk;
      continue;
    }
    const direction = delta * f.facing > 0 ? 'forward' : 'back';
    const distance = f.walk?.direction === direction ? f.walk.distance : 0;
    f.walk = { direction, distance: distance + Math.abs(delta) };
  }

  for(const event of events)if(['jump','air-jump','land','dash','knockdown','rise'].includes(event.kind))state.fighters[event.source].poseEvent={kind:event.kind,tick:state.arenaFrame};
  updateActorPresentation(state, config);
  if (!config.training) state.remaining--;
  const result = config.training ? null : roundResult(state, config);
  if (!result) {
    beginActionCutIn(state, config, events);
    return events;
  }
  state.result = result;
  if (result.winner === null) state.draws++;
  else {
    state.draws = 0;
    state.wins[result.winner]++;
    if (state.wins[result.winner] === config.rules.winsToFinish) state.winner = result.winner;
  }
  if (result.reason === 'ko' || result.reason === 'double-ko') {
    events.push({ kind: 'ko', source: result.winner ?? 0, x: 0, y: 0 });
  }
  clearBufferedInputs(state);
  for (const seat of seats) {
    const fighter = state.fighters[seat];
    if (attackFor(config, state, seat)?.channel) fighter.attack = null;
  }
  state.projectiles = [];
  state.turrets = { bolt: null, howitzer: null };
  delete state.summon;
  delete state.cutIn;
  delete state.entities;
  state.phase = 'round-over';
  state.phaseTicks = 105;
  return events;
}

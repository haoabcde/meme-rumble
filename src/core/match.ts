import { floorImpact, landingImpact, segmentBoxTime } from './projectile.js';
import { platformAt, platformContact, platformOffset } from './terrain.js';
import { damageTurret, deployTurret, opposingTurrets, stepTurrets, turretBox } from './turret.js';
import { aimSummon, dijiangTip, summonArea, summonCatchRadius, summonCutInFrames, summonFallFrames,
  summonImpactFrames } from './summon.js';
import { ENERGY_PER_BAR, MAX_ENERGY, MAX_TEARS, TEAR_UNITS_PER_POINT } from './types.js';
import type {
  ActionDefinition, ArenaDefinition, Attack, Box, CombatEvent, Command, Direction, Duo, FighterState,
  InputFrame, MatchConfig, MatchState, Projectile, RoundResult, Side, Summon
} from './types.js';

const seats = [0, 1] as const;
const slotPriority = ['C', 'B', 'A'] as const;
const energyCosts = { A: 0, B: ENERGY_PER_BAR, C: MAX_ENERGY };
const hitEnergy = 12;
const hurtEnergy = 18;
const buildWave = {
  id: 'turret-build-wave', damage: 45, hitstun: 18, blockstun: 12, guardCost: 12,
  push: 18, lift: 0, stop: 3, impact: 'medium'
} as const;
const other = (seat: 0 | 1) => seat === 0 ? 1 : 0;
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
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
  return {
    x: config.arena.spawn[side], y: config.arena.floor, vy: 0, facing: side === 0 ? 1 : -1,
    ground: 'floor', ignorePlatform: null, hp: config.fighters[seat].maxHp,
    energy: 0, slow: 0,
    ...(config.fighters[seat].usesTears ? { tearUnits: 60 * TEAR_UNITS_PER_POINT } : {}),
    guard: config.rules.guardMax, guardWait: 0, guardBreak: 0, hitstun: 0, blockstun: 0,
    push: 0, dash: 0, guarding: false, attack: null, buffer: [], combo: 0, controlled: 0,
    protection: 0, moving: false
  };
}

export function createMatch(config: MatchConfig): MatchState {
  return {
    frame: 0, arenaFrame: 0, remaining: config.rules.roundSeconds * config.rules.ticksPerSecond,
    freeze: 0, comboFreeze: 0, phase: 'ready', phaseTicks: 120, round: 1,
    wins: [0, 0], draws: 0, fighters: [spawn(config, 0, 1), spawn(config, 1, 1)], projectiles: [],
    turrets: { bolt: null, howitzer: null },
    result: null, winner: null
  };
}

export function actionFor(config: MatchConfig, state: MatchState, seat: 0 | 1) {
  const id = state.fighters[seat].attack?.id;
  return config.fighters[seat].actions.find(action => action.id === id);
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

function queueInputs(state: MatchState, inputs: Duo<InputFrame>, config: MatchConfig) {
  for (const seat of seats) {
    if (carriedBySummon(state, seat)) continue;
    const fighter = state.fighters[seat];
    const input = inputs[seat];
    const action = actionFor(config, state, seat);
    fighter.buffer = fighter.buffer.filter(command => command.expires > state.frame);
    for (const [index, key] of input.pressed.entries()) {
      const sampled = Array.isArray(input.sampled) ? input.sampled[index] : input.sampled?.[key];
      const { x, y } = sampled ?? input;
      const cryToWave = action?.channel === 'cry' && key === 'C' && y === 1;
      if (action?.channel && fighter.attack!.frame < action.startup + action.active &&
        (key === action.slot || key === 'dash') && !cryToWave) continue;
      const directions: Direction[] = [];
      if (y) directions.push(y === -1 ? 'up' : 'down');
      if (x) directions.push(x === fighter.facing ? 'forward' : 'back');
      fighter.buffer.push({
        key, x, directions, down: y === 1, expires: state.frame + config.rules.inputBuffer
      });
    }
    bufferChain(fighter, action, config.fighters[seat].actions);
  }
}

function matchesCommand(action: ActionDefinition, command: Command, directional: boolean) {
  return action.slot === command.key && Boolean(action.direction) === directional &&
    (!action.direction || command.directions.includes(action.direction));
}

function bufferChain(f: FighterState, action: ActionDefinition | undefined, moves: ActionDefinition[]) {
  const attack = f.attack;
  if (!attack || !action?.chain || attack.frame >= action.chain.close || !f.ground) return;
  const queued = attack.queuedChain ?? [];
  const last = queued.length ? moves.find(move => move.id === queued.at(-1)) : action;
  const directional = moves.filter(move => move.direction && move.posture !== 'air' && !move.followUpOnly);
  let link = last?.chain;
  while (link) {
    const { actionId } = link;
    const next = moves.find(move => move.id === actionId);
    if (!next) break;
    const index = f.buffer.findIndex(command => command.key === next.slot &&
      !directional.some(move => matchesCommand(move, command, true)));
    if (index < 0) break;
    f.buffer.splice(index, 1);
    queued.push(next.id);
    link = next.chain;
  }
  if (queued.length) attack.queuedChain = queued;
}

function emitSwing(f: FighterState, action: ActionDefinition, seat: 0 | 1, events: CombatEvent[]) {
  events.push({ kind: 'swing', source: seat, x: f.x, y: f.y, actionId: action.id, facing: f.facing });
}

function startAttack(f: FighterState, action: ActionDefinition, seat: 0 | 1, events: CombatEvent[],
  queuedChain?: string[]) {
  const tearCost = action.tearCost;
  if (tearCost !== undefined && (f.tearUnits ?? 0) < tearCost * TEAR_UNITS_PER_POINT) {
    events.push({ kind: 'tears-short', source: seat, x: f.x, y: f.y, actionId: action.id, amount: tearCost });
    return false;
  }
  const cost = action.energyCost !== undefined ? action.energyCost * ENERGY_PER_BAR
    : tearCost === undefined ? energyCosts[action.slot] : 0;
  if (f.energy < cost) {
    events.push({ kind: 'energy-short', source: seat, x: f.x, y: f.y, actionId: action.id, amount: cost });
    return false;
  }
  f.energy -= cost;
  if (tearCost) addTearUnits(f, -tearCost * TEAR_UNITS_PER_POINT);
  f.attack = { id: action.id, frame: 0, connected: false, landed: false };
  if (queuedChain?.length) f.attack.queuedChain = queuedChain;
  f.guarding = false;
  f.dash = 0;
  delete f.reaction;
  if (!action.summon && (!action.swingOnActive || action.startup <= (action.swingLead ?? 0))) {
    emitSwing(f, action, seat, events);
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
        if (attack.sustainedFrames % sprayHitInterval === 0) attack.connected = false;
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

function tryStartCinematic(state: MatchState, config: MatchConfig, events: CombatEvent[]) {
  const priority = state.round % 2 === 1 ? seats : [1, 0] as const;
  for (const seat of priority) {
    const action = config.fighters[seat].actions.find(move => move.summon || move.cutIn);
    if (!action) continue;
    const fighter = state.fighters[seat];
    const command = fighter.buffer.find(item => matchesCommand(action, item, true));
    if (!command) continue;
    fighter.buffer = fighter.buffer.filter(item => item !== command);
    const canCancelCry = action.cutIn && actionFor(config, state, seat)?.channel === 'cry';
    const pendingCutIn = seats.some(source => {
      const pending = actionFor(config, state, source)?.cutIn;
      return pending && state.fighters[source].attack!.frame < pending.at;
    });
    if (state.summon || pendingCutIn || !fighter.ground || (fighter.attack && !canCancelCry) || fighter.dash || fighter.push ||
      fighter.hitstun || fighter.blockstun || fighter.guardBreak || fighter.protection) {
      if (action.cutIn) events.push({ kind: 'wave-unavailable', source: seat, x: fighter.x, y: fighter.y,
        actionId: action.id, requirement: fighter.ground ? 'recovery' : 'ground' });
      continue;
    }
    const target = state.fighters[other(seat)];
    if (!startAttack(fighter, action, seat, events)) continue;
    const facing = target.x === fighter.x ? fighter.facing : target.x > fighter.x ? 1 : -1;
    fighter.facing = facing;
    fighter.moving = false;
    delete fighter.walk;
    for (const player of state.fighters) player.buffer = [];
    if (action.cutIn) {
      events.push({ kind: 'wave-windup', source: seat, actionId: action.id,
        x: fighter.x, y: fighter.y, facing });
    } else {
      state.summon = {
        source: seat, actionId: action.id, ...aimSummon(config.arena, target, facing, state.arenaFrame),
        phase: 'cut-in', frame: 0
      };
      events.push(summonEvent(state.summon, 'summon-start'));
    }
    return true;
  }
  return false;
}

function beginActionCutIn(state: MatchState, config: MatchConfig, events: CombatEvent[]) {
  for (const source of seats) {
    const fighter = state.fighters[source];
    const action = actionFor(config, state, source);
    if (!action?.cutIn || fighter.attack?.frame !== action.cutIn.at) continue;
    state.cutIn = { source, frame: 0, duration: action.cutIn.duration };
    for (const player of state.fighters) player.buffer = [];
    events.push({ kind: 'wave-cut-in', source, actionId: action.id, x: fighter.x, y: fighter.y,
      facing: fighter.facing });
    return;
  }
}

function updateControl(
  state: MatchState, config: MatchConfig, seat: 0 | 1, input: InputFrame, events: CombatEvent[]
) {
  const f = state.fighters[seat];
  const opponent = state.fighters[other(seat)];
  const definition = config.fighters[seat];
  f.moving = false;
  for (const counter of ['hitstun', 'blockstun', 'protection', 'guardWait', 'slow'] as const) {
    if (f[counter] > 0) f[counter]--;
  }
  if (f.guardBreak > 0 && --f.guardBreak === 0) {
    f.guard = Math.ceil(config.rules.guardMax / 2);
    f.guardWait = config.rules.guardDelay;
  }

  const locked = f.hitstun > 0 || f.blockstun > 0 || f.guardBreak > 0;
  if (locked && f.combo > 0 && ++f.controlled >= config.rules.comboControlLimit) {
    f.hitstun = 0;
    f.protection = 32;
    f.attack = null;
  }
  if (!locked || f.protection) {
    f.combo = 0;
    f.controlled = 0;
  }
  if (f.reaction) {
    f.reaction.elapsed++;
    const landing = f.reaction.landedAt;
    if (f.protection || (!f.hitstun && f.ground && (landing === undefined || f.reaction.elapsed - landing >= 5))) {
      delete f.reaction;
    }
  }

  let previousAction = actionFor(config, state, seat);
  if (f.attack && previousAction) {
    const oldFrame = f.attack.frame;
    advanceAttack(f, f.attack, previousAction, input);
    if (previousAction.swingOnActive && f.attack.frame !== oldFrame &&
      f.attack.frame === previousAction.startup - (previousAction.swingLead ?? 0)) {
      emitSwing(f, previousAction, seat, events);
    }
    if (!previousAction.summon && !previousAction.projectile && !previousAction.channel &&
      f.attack.frame >= previousAction.startup + previousAction.active && !f.attack.connected) {
      events.push({ kind: 'whiff', source: seat, x: f.x, y: f.y });
      f.attack.connected = true;
    }
    if (f.attack.frame >= previousAction.startup + previousAction.active + previousAction.recovery) {
      f.attack = null;
      previousAction = undefined;
    }
  }

  if (!locked && !f.attack && !f.dash && !f.guarding && f.x !== opponent.x) {
    f.facing = f.x < opponent.x ? 1 : -1;
  }
  if (locked || f.protection) {
    f.guarding = f.blockstun > 0 && f.guardBreak === 0 && f.hitstun === 0;
    return;
  }

  const currentAttack = f.attack;
  const chain = previousAction?.chain;
  if (f.ground && currentAttack && chain && currentAttack.frame >= chain.open &&
    currentAttack.frame <= chain.close && currentAttack.queuedChain?.[0] === chain.actionId) {
    const next = definition.actions.find(action => action.id === chain.actionId);
    if (next) {
      if (startAttack(f, next, seat, events, currentAttack.queuedChain.slice(1))) return;
      delete currentAttack.queuedChain;
    }
  }
  const candidates = definition.actions.filter(action => {
    if (action.summon || action.cutIn) return false;
    if (action.posture !== 'any' && (action.posture === 'ground') !== Boolean(f.ground)) return false;
    if (!currentAttack) return !action.followUpOnly;
    return currentAttack.landed && !action.followUpOnly && previousAction?.cancelOnHit?.includes(action.slot);
  });
  for (const useDirection of [true, false]) {
    for (const slot of slotPriority) {
      const commands = f.buffer.filter(command => command.key === slot);
      const action = candidates.find(candidate => commands.some(command => matchesCommand(candidate, command, useDirection)));
      if (!action) continue;
      // A single accepted command consumes competing actions from the same sampled frame.
      const command = commands.find(item => matchesCommand(action, item, useDirection))!;
      if (!startAttack(f, action, seat, events)) {
        f.buffer = f.buffer.filter(item => item !== command);
        continue;
      }
      if (action.channel && !isHeld(input, action.slot)) f.attack!.released = true;
      f.buffer = f.buffer.filter(item => item !== command &&
        (item.expires !== command.expires || (action.chain && item.key === action.slot)));
      bufferChain(f, action, definition.actions);
      return;
    }
  }
  if (f.attack) return;

  const jump = f.buffer.find(command => command.key === 'jump');
  if (f.ground && jump) {
    f.buffer = f.buffer.filter(item => item.expires !== jump.expires);
    const dropping = jump.down && f.ground !== 'floor';
    if (!jump.down || dropping) {
      delete f.reaction;
      f.ignorePlatform = dropping ? f.ground : null;
      f.vy = dropping ? 2 : -definition.jump;
      events.push({ kind: dropping ? 'drop' : 'jump', source: seat, x: f.x, y: f.y });
      f.ground = null;
      f.guarding = false;
      f.dash = 0;
      return;
    }
  }
  const dash = f.buffer.find(command => command.key === 'dash');
  if (dash && f.ground && !f.dash) {
    f.buffer = f.buffer.filter(item => item.expires !== dash.expires);
    f.facing = dash.x || f.facing;
    f.dash = 8;
    f.guarding = false;
    events.push({ kind: 'dash', source: seat, x: f.x, y: f.y });
    return;
  }
  f.guarding = Boolean(f.ground && input.y === 1 && !f.dash);
  if (!f.guarding && f.guardWait === 0 && state.frame % 3 === 0) {
    f.guard = Math.min(config.rules.guardMax, f.guard + 1);
  }
  f.moving = !f.guarding && Boolean(input.x || f.dash);
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
}

function landingPlatform(arena: ArenaDefinition, fighter: FighterState, from: Position, frame: number) {
  let first: ReturnType<typeof platformContact>;
  for (const platform of arena.platforms) {
    if (platform.id === fighter.ignorePlatform) continue;
    const contact = platformContact(platform, frame, from, fighter);
    if (!contact || (first && contact.time >= first.time)) continue;
    if (fighter.x >= contact.surface.left && fighter.x <= contact.surface.right) first = contact;
  }
  return first?.surface;
}

function motion(
  state: MatchState, config: MatchConfig, seat: 0 | 1, input: InputFrame, events: CombatEvent[]
) {
  const f = state.fighters[seat];
  const definition = config.fighters[seat];
  const arena = config.arena;
  const action = actionFor(config, state, seat);
  let move = 0;
  let walking = false;
  const speedFactor = f.slow && !f.push ? slowedSpeed : 1;
  if (f.push !== 0) {
    move = f.push;
    f.push -= Math.sign(f.push);
  } else if (f.dash > 0) {
    move = definition.dash * f.facing;
    f.dash--;
  } else if (f.attack && action) {
    const frame = f.attack.frame;
    if (frame >= (action.advanceFrom ?? 0) && frame < (action.advanceUntil ?? action.startup)) {
      move = f.facing * action.advance;
    }
    if (frame >= action.startup && frame < action.startup + action.active) {
      move = f.facing * (action.activeAdvance ?? 0);
    }
    if (action.channel === 'spray' && frame < action.startup + action.active) {
      move = input.x * (f.ground ? definition.run : definition.airSpeed) * spraySpeed;
      walking = Boolean(f.ground && move);
    }
  } else if (!f.hitstun && !f.blockstun && !f.guardBreak && !f.guarding && !f.protection) {
    move = input.x * (f.ground ? definition.run : definition.airSpeed);
    walking = Boolean(f.ground && move);
  }
  const previousX = f.x;
  f.x = clamp(f.x + move * speedFactor, arena.left, arena.right);
  releaseUnsupportedGround(f, arena, state.arenaFrame);
  if (f.ground) return walking;
  const previousY = f.y;
  f.vy += 1;
  f.y += f.vy;
  const platform = landingPlatform(arena, f, { x: previousX, y: previousY }, state.arenaFrame);
  if (platform || (f.vy > 0 && f.y >= arena.floor)) {
    if (f.vy >= 5) events.push({
      kind: 'land', source: seat, x: f.x, y: platform?.y ?? arena.floor,
      ...(f.reaction?.kind === 'air' ? { reaction: 'air' as const } : {})
    });
    f.ground = platform?.id ?? 'floor';
    f.y = platform?.y ?? arena.floor;
    f.vy = 0;
    f.ignorePlatform = null;
    if (f.reaction?.kind === 'air') f.reaction.landedAt = f.reaction.elapsed;
  }
  return false;
}

function separate(state: MatchState, config: MatchConfig, previous: Duo<Position>) {
  const [a, b] = state.fighters;
  const arena = config.arena;
  const width = (config.fighters[0].bodyWidth + config.fighters[1].bodyWidth) / 2;
  if (Math.abs(a.y - b.y) >= 82) return;
  const leftSeat = previous[0].x < previous[1].x ? 0 : previous[0].x > previous[1].x ? 1 : a.facing === 1 ? 0 : 1;
  const left = state.fighters[leftSeat];
  const right = state.fighters[other(leftSeat)];
  const penetration = width - (right.x - left.x);
  if (penetration <= 0) return;
  left.x = clamp(left.x - penetration / 2, arena.left, arena.right - width);
  right.x = clamp(right.x + penetration / 2, arena.left + width, arena.right);
  left.x = Math.min(left.x, right.x - width);
  right.x = Math.max(right.x, left.x + width);
}

type HitProfile = Pick<ActionDefinition, 'id' | 'damage' | 'hitstun' | 'blockstun' | 'guardCost' |
  'push' | 'lift' | 'stop' | 'impact' | 'unblockable' | 'slow' | 'energyOnHit'>;

interface Contact {
  source: 0 | 1;
  target: 0 | 1;
  action: HitProfile;
  attack?: Attack;
  earnsEnergy?: boolean;
  blocked: boolean;
  facing: Side;
  x: number;
  y: number;
}

function collectContacts(state: MatchState, config: MatchConfig, events: CombatEvent[]): Contact[] {
  return seats.flatMap(source => {
    const target = other(source);
    const f = state.fighters[source];
    const defender = state.fighters[target];
    const action = actionFor(config, state, source);
    const attack = f.attack;
    if (!action || action.summon || action.projectile || action.channel === 'cry' || !attack || attack.frame < action.startup ||
      attack.frame >= action.startup + action.active) return [];
    const hitbox = worldBox(action.hitbox, f.x, f.y, f.facing);
    for (const turret of opposingTurrets(state, source)) {
      if (attack.hitTurrets?.includes(turret.kind) || !overlap(hitbox, turretBox(turret))) continue;
      (attack.hitTurrets ??= []).push(turret.kind);
      damageTurret(state, turret.kind, events);
    }
    if (attack.connected || defender.protection || carriedBySummon(state, target)) return [];
    const hurtbox = worldBox(config.fighters[target].hurtbox, defender.x, defender.y, defender.facing);
    if (!overlap(hitbox, hurtbox)) return [];
    const facing: Side = defender.x === f.x ? f.facing : defender.x > f.x ? 1 : -1;
    return [{
      source, target, action, attack, earnsEnergy: action.slot === 'A', facing,
      blocked: !action.unblockable && defender.guarding && defender.facing === -facing,
      x: (Math.max(hitbox.x, hurtbox.x) + Math.min(hitbox.x + hitbox.w, hurtbox.x + hurtbox.w)) / 2,
      y: (Math.max(hitbox.y, hurtbox.y) + Math.min(hitbox.y + hitbox.h, hurtbox.y + hurtbox.h)) / 2
    }];
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
  if (!summon.carry && defender.y < y) {
    const from = dijiangTip(summon, (summon.frame - 1) / summonFallFrames);
    // Test the sweep in the defender's moving frame of reference.
    from.x += defender.x - previous[target].x;
    from.y += defender.y - previous[target].y;
    const hurtbox = worldBox(config.fighters[target].hurtbox, defender.x, defender.y, defender.facing);
    if (segmentBoxTime(from, tip, hurtbox, summonCatchRadius) !== undefined) {
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
  const action = config.fighters[source].actions.find(move => move.id === actionId);
  if (!action || (defender.ground && defender.ground !== 'floor') ||
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
  if (defender.protection || carriedBySummon(state, target)) return;
  const centerY = blastCenterY(event);
  const point = closestPoint(worldBox(config.fighters[target].hurtbox, defender.x, defender.y, defender.facing), x, centerY);
  const grenade = event.kind === 'grenade-impact';
  const distance = Math.hypot((grenade ? defender.x : point.x) - x, point.y - centerY);
  if (distance >= radius) return;
  const facing = defender.x === x ? event.facing ?? 1 : defender.x > x ? 1 : -1;
  contacts.push({
    source, target, facing, ...point, earnsEnergy: grenade || event.kind === 'tear-splash',
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
    if (Math.hypot(point.x - event.x, point.y - centerY) < (event.radius ?? 0)) damageTurret(state, tower.kind, events);
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
  const hurtbox = worldBox(config.fighters[target].hurtbox, defender.x, defender.y, defender.facing);
  const hitTime = kind === 'grenade' || projectile.connected || defender.protection || carriedBySummon(state, target) ? undefined
    : segmentBoxTime(projectile, next, hurtbox, radius, halfWidth);
  const crossedTurrets = explodesOnLanding ? [] : opposingTurrets(state, source)
    .filter(tower => !projectile.hitTurrets?.includes(tower.kind))
    .map(tower => ({ tower, time: segmentBoxTime(projectile, next, turretBox(tower), radius, halfWidth) ?? Infinity }))
    .sort((a, b) => a.time - b.time);
  for (const { tower, time } of crossedTurrets) {
    if (time > travel || (disappearsOnHit && time > (hitTime ?? 1))) break;
    (projectile.hitTurrets ??= []).push(tower.kind);
    damageTurret(state, tower.kind, events);
    if (disappearsOnHit) return false;
  }
  if (hitTime !== undefined && hitTime <= travel) {
    const contact = closestPoint(hurtbox, projectile.x + (next.x - projectile.x) * hitTime,
      projectile.y + (next.y - projectile.y) * hitTime);
    if (kind === 'tear') {
      explodeProjectile(state, config, action, { kind: 'tear-splash', source, ...contact, facing,
        radius: blastRadius ?? radius, actionId: action.id }, contacts, events);
      return false;
    }
    projectile.connected = true;
    contacts.push({
      source, target, action, facing, earnsEnergy: action.slot === 'A' || kind === 'bolt',
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
    const action = config.fighters[projectile.source].actions.find(move => move.id === projectile.actionId);
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
    const action = actionFor(config, state, source);
    const throwData = action?.projectile;
    if (!action || !throwData || fighter.attack?.frame !== action.startup) continue;
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

function settle(state: MatchState, config: MatchConfig, contacts: Contact[], events: CombatEvent[]) {
  for (const { attack, blocked } of contacts) {
    if (!attack) continue;
    attack.connected = true;
    attack.landed = !blocked;
  }
  let maxStop = 0;
  for (const { source, target, action, blocked, facing, x, y, earnsEnergy } of contacts) {
    const defender = state.fighters[target];
    defender.attack = null;
    defender.dash = 0;
    if (blocked) {
      delete defender.reaction;
      defender.guard = Math.max(0, defender.guard - action.guardCost);
      defender.guardWait = config.rules.guardDelay;
      defender.push = Math.sign(facing) * Math.ceil(action.push / 2);
      defender.blockstun = action.blockstun;
      events.push({ kind: 'block', source, x, y, actionId: action.id, facing });
      if (defender.guard === 0) {
        defender.guardBreak = config.rules.guardBreak;
        defender.guarding = false;
        events.push({ kind: 'break', source, x, y });
      }
      maxStop = Math.max(maxStop, Math.min(3, action.stop));
      continue;
    }
    const amount = Math.min(defender.hp, Math.floor(action.damage * Math.max(35, 100 - 8 * defender.combo) / 100));
    defender.hp -= amount;
    if (amount > 0) {
      defender.energy = Math.min(MAX_ENERGY, defender.energy + hurtEnergy);
      addTearUnits(defender, 5 * TEAR_UNITS_PER_POINT);
      if (earnsEnergy || action.energyOnHit) {
        const attacker = state.fighters[source];
        attacker.energy = Math.min(MAX_ENERGY, attacker.energy + hitEnergy);
        if (earnsEnergy) addTearUnits(attacker, 8 * TEAR_UNITS_PER_POINT);
      }
      if (action.slow) defender.slow = Math.max(defender.slow, action.slow);
    }
    if (config.training && defender.hp === 0) defender.hp = config.fighters[target].maxHp;
    defender.combo++;
    defender.hitstun = action.hitstun;
    defender.blockstun = 0;
    defender.guarding = false;
    defender.push = facing * action.push;
    if (action.lift) {
      defender.ground = null;
      defender.vy = -action.lift;
    }
    defender.reaction = {
      kind: !defender.ground ? 'air' : action.impact === 'heavy' || action.push >= 12 ? 'heavy' : 'light',
      elapsed: 0, facing: facing === 1 ? -1 : 1
    };
    const impact = action.impact ? { impact: action.impact } : {};
    events.push({ kind: 'hit', source, x, y, amount, actionId: action.id, facing,
      reaction: defender.reaction.kind, ...impact });
    maxStop = Math.max(maxStop, Math.min(6, action.stop));
  }
  state.freeze = Math.min(maxStop, 60 - state.comboFreeze);
  state.comboFreeze += state.freeze;
}

function rampToNextRound(state: MatchState, config: MatchConfig) {
  state.round++;
  state.arenaFrame = 0;
  state.remaining = config.rules.roundSeconds * config.rules.ticksPerSecond;
  state.fighters = [spawn(config, 0, state.round), spawn(config, 1, state.round)];
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
    if (--state.phaseTicks > 0) return events;
    if (state.phase === 'ready') {
      state.phase = 'fight';
    } else if (state.winner !== null || state.draws >= 2) {
      state.phase = 'match-over';
    } else {
      rampToNextRound(state, config);
    }
    return events;
  }

  queueInputs(state, inputs, config);
  if (state.freeze > 0) {
    state.freeze--;
    return events;
  }
  if (tryStartCinematic(state, config, events)) return events;

  const [a, b] = state.fighters;
  const previous: Duo<Position> = [{ x: a.x, y: a.y }, { x: b.x, y: b.y }];
  state.arenaFrame = (state.arenaFrame ?? 0) + 1;
  const walkStart: Duo<number> = [a.x, b.x];
  for (const platform of config.arena.platforms) {
    if (!platform.travel) continue;
    const offset = platformOffset(platform, state.arenaFrame) - platformOffset(platform, state.arenaFrame - 1);
    for (const seat of seats) {
      const fighter = state.fighters[seat];
      if (fighter.ground !== platform.id) continue;
      if (platform.travel.axis === 'y') fighter.y += offset;
      else fighter.x = clamp(fighter.x + offset, config.arena.left, config.arena.right);
      walkStart[seat] = fighter.x;
    }
    for (const turret of Object.values(state.turrets)) {
      if (turret?.support !== platform.id) continue;
      if (platform.travel.axis === 'y') turret.y += offset;
      else turret.x += offset;
    }
  }
  for (const seat of seats) {
    if (carriedBySummon(state, seat)) continue;
    updateControl(state, config, seat, inputs[seat], events);
    const fighter = state.fighters[seat];
    if (fighter.attack?.frame === 0 && !fighter.attack.released && actionFor(config, state, seat)?.channel === 'cry') {
      addTearUnits(fighter, cryUnitsPerTick);
    }
  }
  if (state.fighters.every(fighter => fighter.combo === 0 && fighter.blockstun === 0)) {
    state.comboFreeze = 0;
  }
  const walking = seats.map(seat => !carriedBySummon(state, seat) && motion(state, config, seat, inputs[seat], events));
  if (!seats.some(seat => carriedBySummon(state, seat))) separate(state, config, previous);
  for (const fighter of state.fighters) releaseUnsupportedGround(fighter, config.arena, state.arenaFrame);
  const summonContact = advanceSummon(state, config, previous, events);
  const contacts = collectContacts(state, config, events);
  const beforeTurrets = events.length;
  stepTurrets(state, config, events);
  for (const event of events.slice(beforeTurrets)) {
    if (event.kind === 'turret-ready') collectBlastContact(state, config, event, buildWave, contacts);
  }
  moveProjectiles(state, config, contacts, events);
  if (summonContact) contacts.push(summonContact);
  settle(state, config, contacts, events);
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
  for (const seat of seats) {
    const fighter = state.fighters[seat];
    fighter.buffer = [];
    if (actionFor(config, state, seat)?.channel) fighter.attack = null;
  }
  state.projectiles = [];
  state.turrets = { bolt: null, howitzer: null };
  delete state.summon;
  delete state.cutIn;
  state.freeze = 0;
  state.phase = 'round-over';
  state.phaseTicks = 105;
  return events;
}

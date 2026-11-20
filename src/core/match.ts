import { floorImpact, landingImpact, segmentBoxTime } from './projectile.js';
import { damageTurret, deployTurret, opposingTurrets, stepTurrets, turretBox } from './turret.js';
import { ENERGY_PER_BAR, MAX_ENERGY } from './types.js';
import type {
  ActionDefinition, ArenaDefinition, Attack, Box, CombatEvent, Command, Direction, Duo, FighterState,
  InputFrame, MatchConfig, MatchState, Projectile, RoundResult, Side
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

function spawn(config: MatchConfig, seat: 0 | 1, round: number): FighterState {
  const side = round % 2 ? seat : other(seat);
  return {
    x: config.arena.spawn[side], y: config.arena.floor, vy: 0, facing: side === 0 ? 1 : -1,
    ground: 'floor', ignorePlatform: null, hp: config.fighters[seat].maxHp,
    energy: 0,
    guard: config.rules.guardMax, guardWait: 0, guardBreak: 0, hitstun: 0, blockstun: 0,
    push: 0, dash: 0, guarding: false, attack: null, buffer: [], combo: 0, controlled: 0,
    protection: 0, moving: false
  };
}

export function createMatch(config: MatchConfig): MatchState {
  return {
    frame: 0, remaining: config.rules.roundSeconds * config.rules.ticksPerSecond,
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
    const fighter = state.fighters[seat];
    const input = inputs[seat];
    fighter.buffer = fighter.buffer.filter(command => command.expires > state.frame);
    for (const [index, key] of input.pressed.entries()) {
      const sampled = Array.isArray(input.sampled) ? input.sampled[index] : input.sampled?.[key];
      const { x, y } = sampled ?? input;
      const directions: Direction[] = [];
      if (y) directions.push(y === -1 ? 'up' : 'down');
      if (x) directions.push(x === fighter.facing ? 'forward' : 'back');
      fighter.buffer.push({
        key, x, directions, down: y === 1, expires: state.frame + config.rules.inputBuffer
      });
    }
    bufferChain(fighter, actionFor(config, state, seat), config.fighters[seat].actions);
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
  const cost = action.energyCost === undefined ? energyCosts[action.slot] : action.energyCost * ENERGY_PER_BAR;
  if (f.energy < cost) {
    events.push({ kind: 'energy-short', source: seat, x: f.x, y: f.y, actionId: action.id, amount: cost });
    return false;
  }
  f.energy -= cost;
  f.attack = { id: action.id, frame: 0, connected: false, landed: false };
  if (queuedChain?.length) f.attack.queuedChain = queuedChain;
  f.guarding = false;
  f.dash = 0;
  delete f.reaction;
  if (!action.swingOnActive || action.startup <= (action.swingLead ?? 0)) {
    emitSwing(f, action, seat, events);
  }
  return true;
}

function updateControl(
  state: MatchState, config: MatchConfig, seat: 0 | 1, input: InputFrame, events: CombatEvent[]
) {
  const f = state.fighters[seat];
  const opponent = state.fighters[other(seat)];
  const definition = config.fighters[seat];
  f.moving = false;
  for (const counter of ['hitstun', 'blockstun', 'protection', 'guardWait'] as const) {
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
    f.attack.frame++;
    if (previousAction.swingOnActive && f.attack.frame === previousAction.startup - (previousAction.swingLead ?? 0)) {
      emitSwing(f, previousAction, seat, events);
    }
    if (!previousAction.projectile && f.attack.frame >= previousAction.startup + previousAction.active && !f.attack.connected) {
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

function releaseUnsupportedGround(fighter: FighterState, arena: ArenaDefinition) {
  if (!fighter.ground || fighter.ground === 'floor') return;
  const support = arena.platforms.find(platform => platform.id === fighter.ground);
  if (support && fighter.x >= support.left && fighter.x <= support.right) return;
  fighter.ground = null;
  fighter.guarding = false;
  fighter.vy = 0;
}

function landingPlatform(arena: ArenaDefinition, fighter: FighterState, previousX: number, previousY: number) {
  const distanceY = fighter.y - previousY;
  if (distanceY <= 0) return;
  let next: ArenaDefinition['platforms'][number] | undefined;
  for (const platform of arena.platforms) {
    if (platform.id === fighter.ignorePlatform || platform.y < previousY || platform.y > fighter.y ||
      fighter.x < platform.left || fighter.x > platform.right || (next && next.y <= platform.y)) continue;
    const atX = previousX + (fighter.x - previousX) * ((platform.y - previousY) / distanceY);
    if (atX >= platform.left && atX <= platform.right) next = platform;
  }
  return next;
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
  } else if (!f.hitstun && !f.blockstun && !f.guardBreak && !f.guarding && !f.protection) {
    move = input.x * (f.ground ? definition.run : definition.airSpeed);
    walking = Boolean(f.ground && move);
  }
  const previousX = f.x;
  f.x = clamp(f.x + move, arena.left, arena.right);
  releaseUnsupportedGround(f, arena);
  if (f.ground) return walking;
  const previousY = f.y;
  f.vy += 1;
  f.y += f.vy;
  if (f.vy <= 0) return false;
  const platform = landingPlatform(arena, f, previousX, previousY);
  if (platform || f.y >= arena.floor) {
    if (f.vy >= 5) events.push({ kind: 'land', source: seat, x: f.x, y: platform?.y ?? arena.floor });
    f.ground = platform?.id ?? 'floor';
    f.y = platform?.y ?? arena.floor;
    f.vy = 0;
    f.ignorePlatform = null;
    if (f.reaction?.kind === 'air') f.reaction.landedAt = f.reaction.elapsed;
  }
  return false;
}

function separate(state: MatchState, config: MatchConfig, previous: Duo<number>) {
  const [a, b] = state.fighters;
  const arena = config.arena;
  const width = (config.fighters[0].bodyWidth + config.fighters[1].bodyWidth) / 2;
  if (Math.abs(a.y - b.y) >= 82) return;
  const leftSeat = previous[0] < previous[1] ? 0 : previous[0] > previous[1] ? 1 : a.facing === 1 ? 0 : 1;
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
  'push' | 'lift' | 'stop' | 'impact'>;

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
    if (!action || action.projectile || !attack || attack.frame < action.startup ||
      attack.frame >= action.startup + action.active) return [];
    const hitbox = worldBox(action.hitbox, f.x, f.y, f.facing);
    for (const turret of opposingTurrets(state, source)) {
      if (attack.hitTurrets?.includes(turret.kind) || !overlap(hitbox, turretBox(turret))) continue;
      (attack.hitTurrets ??= []).push(turret.kind);
      damageTurret(state, turret.kind, events);
    }
    if (attack.connected || defender.protection) return [];
    const hurtbox = worldBox(config.fighters[target].hurtbox, defender.x, defender.y, defender.facing);
    if (!overlap(hitbox, hurtbox)) return [];
    return [{
      source, target, action, attack, earnsEnergy: action.slot === 'A', facing: f.facing, blocked: defender.guarding &&
        (f.x - defender.x) * defender.facing > 0,
      x: (Math.max(hitbox.x, hurtbox.x) + Math.min(hitbox.x + hitbox.w, hurtbox.x + hurtbox.w)) / 2,
      y: (Math.max(hitbox.y, hurtbox.y) + Math.min(hitbox.y + hitbox.h, hurtbox.y + hurtbox.h)) / 2
    }];
  });
}

function closestPoint(box: Box, x: number, y: number) {
  return { x: clamp(x, box.x, box.x + box.w), y: clamp(y, box.y, box.y + box.h) };
}

function collectBlastContact(state: MatchState, config: MatchConfig, event: CombatEvent, action: HitProfile,
  contacts: Contact[]) {
  const { source, x, y, radius = 0 } = event;
  const target = other(source);
  const defender = state.fighters[target];
  if (defender.protection) return;
  const point = closestPoint(worldBox(config.fighters[target].hurtbox, defender.x, defender.y, defender.facing), x, y - 7);
  const grenade = event.kind === 'grenade-impact';
  const distance = Math.hypot((grenade ? defender.x : point.x) - x, point.y - (y - 7));
  if (distance >= radius) return;
  const facing = defender.x === x ? event.facing ?? 1 : defender.x > x ? 1 : -1;
  contacts.push({
    source, target, facing, ...point, earnsEnergy: grenade,
    blocked: defender.guarding && defender.facing === -facing,
    action: grenade ? { ...action, damage: Math.round(action.damage * (1 - .8 * distance / radius)) } : action
  });
}

function advanceProjectile(state: MatchState, config: MatchConfig, projectile: Projectile,
  action: ActionDefinition, nextX: number, nextY: number, contacts: Contact[], events: CombatEvent[]) {
  const { arena } = config;
  const { source, facing } = projectile;
  const next = { x: clamp(nextX, arena.left, arena.right), y: nextY };
  const { kind, radius, halfWidth, turret, blastRadius } = action.projectile!;
  const impact = kind === 'crate' || kind === 'grenade'
    ? landingImpact(arena, projectile, next, radius, turret === 'howitzer')
    : floorImpact(arena, projectile, next);
  const travel = impact?.time ?? 1;
  const target = other(source);
  const defender = state.fighters[target];
  const hurtbox = worldBox(config.fighters[target].hurtbox, defender.x, defender.y, defender.facing);
  const hitTime = kind === 'grenade' || projectile.connected || defender.protection ? undefined
    : segmentBoxTime(projectile, next, hurtbox, radius, halfWidth);
  const crossedTurrets = kind === 'grenade' ? [] : opposingTurrets(state, source)
    .filter(tower => !projectile.hitTurrets?.includes(tower.kind))
    .map(tower => ({ tower, time: segmentBoxTime(projectile, next, turretBox(tower), radius, halfWidth) ?? Infinity }))
    .sort((a, b) => a.time - b.time);
  for (const { tower, time } of crossedTurrets) {
    if (time > travel || (kind === 'bolt' && time > (hitTime ?? 1))) break;
    (projectile.hitTurrets ??= []).push(tower.kind);
    damageTurret(state, tower.kind, events);
    if (kind === 'bolt') return false;
  }
  if (hitTime !== undefined && hitTime <= travel) {
    projectile.connected = true;
    contacts.push({
      source, target, action, facing, earnsEnergy: action.slot === 'A' || kind === 'bolt',
      blocked: defender.guarding && defender.facing === -facing,
      x: clamp(projectile.x + (next.x - projectile.x) * hitTime, hurtbox.x, hurtbox.x + hurtbox.w),
      y: clamp(projectile.y + (next.y - projectile.y) * hitTime, hurtbox.y, hurtbox.y + hurtbox.h)
    });
    if (kind === 'bolt') return false;
  }
  if (impact) {
    if (kind === 'crate' && turret) {
      deployTurret(state, turret, source, impact.x, impact.surface.y, facing, events);
    } else if (kind === 'grenade' && blastRadius) {
      const event: CombatEvent = { kind: 'grenade-impact', source, x: impact.x, y: impact.surface.y,
        facing, radius: blastRadius, actionId: action.id };
      events.push(event);
      collectBlastContact(state, config, event, action, contacts);
      for (const tower of opposingTurrets(state, source)) {
        const point = closestPoint(turretBox(tower), event.x, event.y - 7);
        if (Math.hypot(point.x - event.x, point.y - (event.y - 7)) < blastRadius) damageTurret(state, tower.kind, events);
      }
    } else if (kind !== 'bolt') {
      const { y, left, right } = impact.surface;
      events.push({ kind: 'pole-impact', source, x: impact.x, y, actionId: action.id, facing, surface: { left, right } });
      if (!projectile.connected) events.push({ kind: 'whiff', source, x: impact.x, y, actionId: action.id, facing });
    }
    return false;
  }
  if (kind === 'bolt' && (next.x !== nextX || nextY < 0 || nextY > arena.floor)) return false;
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
      if (earnsEnergy) {
        const attacker = state.fighters[source];
        attacker.energy = Math.min(MAX_ENERGY, attacker.energy + hitEnergy);
      }
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
    events.push({ kind: 'hit', source, x, y, amount, actionId: action.id, facing, ...impact });
    maxStop = Math.max(maxStop, Math.min(6, action.stop));
  }
  state.freeze = Math.min(maxStop, 60 - state.comboFreeze);
  state.comboFreeze += state.freeze;
}

function rampToNextRound(state: MatchState, config: MatchConfig) {
  state.round++;
  state.remaining = config.rules.roundSeconds * config.rules.ticksPerSecond;
  state.fighters = [spawn(config, 0, state.round), spawn(config, 1, state.round)];
  state.projectiles = [];
  state.turrets = { bolt: null, howitzer: null };
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

  const previous: Duo<number> = [state.fighters[0].x, state.fighters[1].x];
  for (const seat of seats) updateControl(state, config, seat, inputs[seat], events);
  if (state.fighters.every(fighter => fighter.combo === 0 && fighter.blockstun === 0)) {
    state.comboFreeze = 0;
  }
  const walking = seats.map(seat => motion(state, config, seat, inputs[seat], events));
  separate(state, config, previous);
  for (const fighter of state.fighters) releaseUnsupportedGround(fighter, config.arena);
  const contacts = collectContacts(state, config, events);
  const beforeTurrets = events.length;
  stepTurrets(state, config, events);
  for (const event of events.slice(beforeTurrets)) {
    if (event.kind === 'turret-ready') collectBlastContact(state, config, event, buildWave, contacts);
  }
  moveProjectiles(state, config, contacts, events);
  settle(state, config, contacts, events);
  for (const seat of seats) {
    const f = state.fighters[seat];
    const delta = f.x - previous[seat];
    if (!walking[seat] || !f.ground || f.hitstun || f.blockstun || delta * inputs[seat].x <= 0) {
      delete f.walk;
      continue;
    }
    const direction = delta * f.facing > 0 ? 'forward' : 'back';
    const distance = f.walk?.direction === direction ? f.walk.distance : 0;
    f.walk = { direction, distance: distance + Math.abs(delta) };
  }

  if (config.training) return events;
  state.remaining--;
  const result = roundResult(state, config);
  if (!result) return events;
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
  for (const fighter of state.fighters) fighter.buffer = [];
  state.projectiles = [];
  state.turrets = { bolt: null, howitzer: null };
  state.phase = 'round-over';
  state.phaseTicks = 105;
  return events;
}

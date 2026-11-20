import type {
  ActionDefinition, ArenaDefinition, Box, CombatEvent, Direction, Duo, FighterState,
  InputFrame, MatchConfig, MatchState, RoundResult, Side
} from './types.js';
import { platformOffset } from './terrain.js';

const seats = [0, 1] as const;
const slotPriority = ['C', 'B', 'A'] as const;
const downFrames = 18;
const riseFrames = 12;
const other = (seat: 0 | 1) => seat === 0 ? 1 : 0;
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function spawn(config: MatchConfig, seat: 0 | 1, round: number): FighterState {
  const side = round % 2 ? seat : other(seat);
  return {
    x: config.arena.spawn[side], y: config.arena.floor, vy: 0, facing: side === 0 ? 1 : -1,
    ground: 'floor', ignorePlatform: null, hp: config.fighters[seat].maxHp,
    guard: config.rules.guardMax, guardWait: 0, guardBreak: 0, hitstun: 0, blockstun: 0,
    push: 0, dash: 0, airActionUsed: false, guarding: false, attack: null, buffer: [], combo: 0, controlled: 0,
    recovery: null, moving: false
  };
}

export function createMatch(config: MatchConfig): MatchState {
  return {
    frame: 0, arenaFrame: 0, remaining: config.rules.roundSeconds * config.rules.ticksPerSecond,
    freeze: 0, comboFreeze: 0, phase: 'ready', phaseTicks: 120, round: 1,
    wins: [0, 0], draws: 0, fighters: [spawn(config, 0, 1), spawn(config, 1, 1)],
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
    for (const key of input.pressed) {
      const { x, y } = input.sampled?.[key] ?? input;
      const directions: Direction[] = [];
      if (y) directions.push(y === -1 ? 'up' : 'down');
      if (x) directions.push(x === fighter.facing ? 'forward' : 'back');
      fighter.buffer.push({
        key, x, directions, down: y === 1, sampledAt: state.frame, remaining: config.rules.inputBuffer
      });
    }
  }
}

function startKnockdown(fighter: FighterState) {
  fighter.recovery = { phase: 'fall' };
  fighter.hitstun = 0;
  fighter.blockstun = 0;
  fighter.attack = null;
  fighter.dash = 0;
  fighter.guarding = false;
  fighter.moving = false;
  fighter.buffer = [];
  fighter.combo = 0;
  fighter.controlled = 0;
}

function advanceRecovery(fighter: FighterState, seat: 0 | 1, events: CombatEvent[]) {
  const recovery = fighter.recovery;
  if (!recovery) return false;
  if (recovery.phase === 'fall' || --recovery.remaining > 0) return true;
  if (recovery.phase === 'down') {
    fighter.recovery = { phase: 'rise', remaining: riseFrames };
    events.push({ kind: 'rise', source: seat, x: fighter.x, y: fighter.y });
    return true;
  }
  fighter.recovery = null;
  return false;
}

function updateControl(
  state: MatchState, config: MatchConfig, seat: 0 | 1, input: InputFrame, events: CombatEvent[]
) {
  const f = state.fighters[seat];
  const opponent = state.fighters[other(seat)];
  const definition = config.fighters[seat];
  f.moving = false;
  for (const counter of ['hitstun', 'blockstun', 'guardWait'] as const) {
    if (f[counter] > 0) f[counter]--;
  }
  if (f.guardBreak > 0 && --f.guardBreak === 0) {
    f.guard = Math.ceil(config.rules.guardMax / 2);
    f.guardWait = config.rules.guardDelay;
  }
  if (advanceRecovery(f, seat, events)) return;

  const locked = f.hitstun > 0 || f.blockstun > 0 || f.guardBreak > 0;
  if (locked && f.combo > 0 && ++f.controlled >= config.rules.comboControlLimit) {
    startKnockdown(f);
    f.vy = Math.max(0, f.vy);
    return;
  }
  if (!locked) {
    f.combo = 0;
    f.controlled = 0;
  }

  let previousAction = actionFor(config, state, seat);
  if (f.attack && previousAction) {
    f.attack.frame++;
    if (f.attack.frame >= previousAction.startup + previousAction.active && !f.attack.connected) {
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
  if (locked) {
    f.guarding = f.blockstun > 0 && f.guardBreak === 0 && f.hitstun === 0;
    return;
  }

  const cancels = f.attack?.landed ? previousAction?.cancelOnHit : undefined;
  const candidates = definition.actions.filter(action =>
    (action.posture === 'any' || (action.posture === 'ground') === Boolean(f.ground)) &&
    (f.attack ? cancels?.includes(action.id) || cancels?.includes(action.slot) : !action.linkOnly)
  );
  for (const useDirection of [true, false]) {
    for (const slot of slotPriority) {
      const action = candidates.find(candidate => candidate.slot === slot &&
        Boolean(candidate.direction) === useDirection &&
        f.buffer.some(command => command.key === slot &&
          (!candidate.direction || command.directions.includes(candidate.direction))));
      if (!action) continue;
      // A single accepted command consumes competing actions from the same sampled frame.
      const command = f.buffer.find(item => item.key === slot &&
        (!action.direction || item.directions.includes(action.direction)))!;
      f.buffer = f.buffer.filter(item => item.sampledAt !== command.sampledAt);
      f.attack = { id: action.id, frame: 0, connected: false, landed: false };
      f.guarding = false;
      f.dash = 0;
      events.push({ kind: 'swing', source: seat, x: f.x, y: f.y });
      return;
    }
  }
  const jump = f.buffer.find(command => command.key === 'jump');
  if (f.ground && jump && (!f.attack || (!jump.down && cancels?.includes('jump')))) {
    f.buffer = f.buffer.filter(item => item.sampledAt !== jump.sampledAt);
    const dropping = jump.down && f.ground !== 'floor';
    if (!jump.down || dropping) {
      f.attack = null;
      f.ignorePlatform = dropping ? f.ground : null;
      f.vy = dropping ? 2 : -definition.jump;
      events.push({ kind: dropping ? 'drop' : 'jump', source: seat, x: f.x, y: f.y });
      f.ground = null;
      f.guarding = false;
      f.dash = 0;
      return;
    }
  }
  if (f.attack) return;

  const airborne = !f.ground;
  if (jump && airborne && !jump.down && !f.dash && !f.airActionUsed && definition.airJump) {
    f.buffer = f.buffer.filter(item => item.sampledAt !== jump.sampledAt);
    f.airActionUsed = true;
    f.vy = -definition.airJump;
    events.push({ kind: 'air-jump', source: seat, x: f.x, y: f.y });
    return;
  }
  const dash = f.buffer.find(command => command.key === 'dash');
  if (dash && !f.dash && (!airborne || (definition.airDash && !f.airActionUsed))) {
    f.buffer = f.buffer.filter(item => item.sampledAt !== dash.sampledAt);
    f.facing = dash.x || f.facing;
    f.dash = airborne ? 6 : 8;
    if (airborne) f.airActionUsed = true;
    f.guarding = false;
    events.push({ kind: 'dash', source: seat, x: f.x, y: f.y, direction: f.facing });
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
    const x = fighter.x - platformOffset(support, frame);
    if (x >= support.left && x <= support.right) return;
  }
  fighter.ground = null;
  fighter.guarding = false;
  fighter.vy = 0;
}

function landingPlatform(arena: ArenaDefinition, fighter: FighterState, previousX: number, previousY: number, frame: number) {
  const distanceY = fighter.y - previousY;
  if (distanceY <= 0) return;
  let next: ArenaDefinition['platforms'][number] | undefined;
  for (const platform of arena.platforms) {
    if (platform.id === fighter.ignorePlatform || platform.y < previousY || platform.y > fighter.y ||
      (next && next.y <= platform.y)) continue;
    const endX = fighter.x - platformOffset(platform, frame);
    if (endX < platform.left || endX > platform.right) continue;
    const startX = previousX - platformOffset(platform, frame - 1);
    const atX = startX + (endX - startX) * ((platform.y - previousY) / distanceY);
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
  if (f.push !== 0) {
    move = f.push;
    f.push -= Math.sign(f.push);
  } else if (f.dash > 0) {
    move = definition.dash * f.facing;
    f.dash--;
  } else if (f.attack && action) {
    move = f.attack.frame < action.startup ? f.facing * action.advance : 0;
    if (!f.ground) move += Math.round(definition.airSpeed * (action.airControl ?? 0)) * input.x;
  } else if (!f.hitstun && !f.blockstun && !f.guardBreak && !f.guarding && !f.recovery) {
    move = input.x * (f.ground ? definition.run : definition.airSpeed);
  }
  const previousX = f.x;
  f.x = clamp(f.x + move, arena.left, arena.right);
  releaseUnsupportedGround(f, arena, state.arenaFrame);
  if (f.ground) return;
  const previousY = f.y;
  f.vy += 1;
  f.y += f.vy;
  if (f.vy <= 0) return;
  const platform = landingPlatform(arena, f, previousX, previousY, state.arenaFrame);
  if (platform || f.y >= arena.floor) {
    if (f.vy >= 5 && !f.recovery) events.push({ kind: 'land', source: seat, x: f.x, y: platform?.y ?? arena.floor });
    f.ground = platform?.id ?? 'floor';
    f.y = platform?.y ?? arena.floor;
    f.vy = 0;
    f.ignorePlatform = null;
    f.airActionUsed = false;
  }
}

function separate(state: MatchState, config: MatchConfig, previous: Duo<number>) {
  const [a, b] = state.fighters;
  const arena = config.arena;
  const width = (config.fighters[0].bodyWidth + config.fighters[1].bodyWidth) / 2;
  if (Math.abs(a.y - b.y) >= 82 || a.recovery?.phase === 'down' || b.recovery?.phase === 'down') return;
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

interface Contact {
  source: 0 | 1;
  target: 0 | 1;
  action: ActionDefinition;
  blocked: boolean;
  facing: Side;
  x: number;
  y: number;
}

function collectContacts(state: MatchState, config: MatchConfig): Contact[] {
  return seats.flatMap(source => {
    const target = other(source);
    const f = state.fighters[source];
    const defender = state.fighters[target];
    const action = actionFor(config, state, source);
    const attack = f.attack;
    if (!action || !attack || attack.connected || attack.frame < action.startup ||
      attack.frame >= action.startup + action.active || defender.recovery) return [];
    const hitbox = worldBox(action.hitbox, f.x, f.y, f.facing);
    const hurtbox = worldBox(config.fighters[target].hurtbox, defender.x, defender.y, defender.facing);
    if (!overlap(hitbox, hurtbox)) return [];
    return [{
      source, target, action, facing: f.facing, blocked: defender.guarding &&
        (f.x - defender.x) * defender.facing > 0,
      x: (Math.max(hitbox.x, hurtbox.x) + Math.min(hitbox.x + hitbox.w, hurtbox.x + hurtbox.w)) / 2,
      y: (Math.max(hitbox.y, hurtbox.y) + Math.min(hitbox.y + hitbox.h, hurtbox.y + hurtbox.h)) / 2
    }];
  });
}

function settle(state: MatchState, config: MatchConfig, contacts: Contact[], events: CombatEvent[]) {
  for (const contact of contacts) {
    const attack = state.fighters[contact.source].attack!;
    attack.connected = true;
    attack.landed = !contact.blocked;
  }
  let maxStop = 0;
  for (const { source, target, action, blocked, facing, x, y } of contacts) {
    const defender = state.fighters[target];
    defender.attack = null;
    defender.dash = 0;
    if (blocked) {
      defender.guard = Math.max(0, defender.guard - action.guardCost);
      defender.guardWait = config.rules.guardDelay;
      defender.push = Math.sign(facing) * Math.ceil(action.push / 2);
      defender.blockstun = action.blockstun;
      events.push({ kind: 'block', source, x, y, direction: facing });
      if (defender.guard === 0) {
        defender.guardBreak = config.rules.guardBreak;
        defender.guarding = false;
        events.push({ kind: 'break', source, x, y, direction: facing });
      }
      maxStop = Math.max(maxStop, Math.min(3, action.stop));
      continue;
    }
    const amount = Math.min(defender.hp, Math.floor(action.damage * Math.max(35, 100 - 8 * defender.combo) / 100));
    defender.hp -= amount;
    if (config.training && defender.hp === 0) defender.hp = config.fighters[target].maxHp;
    const chain = ++defender.combo;
    defender.hitstun = action.hitstun;
    defender.blockstun = 0;
    defender.guarding = false;
    defender.push = facing * action.push;
    if (action.lift) {
      defender.ground = null;
      defender.vy = -action.lift;
    }
    if (action.knockdown) startKnockdown(defender);
    events.push({
      kind: 'hit', source, x, y, amount, chain, direction: facing,
      heavy: action.pose === 'rise' || action.pose === 'finish'
    });
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
  state.arenaFrame = (state.arenaFrame ?? 0) + 1;
  for (const seat of seats) {
    const fighter = state.fighters[seat];
    const ride = config.arena.platforms.find(platform => platform.travel && platform.id === fighter.ground);
    if (ride) fighter.x = clamp(fighter.x + platformOffset(ride, state.arenaFrame) -
      platformOffset(ride, state.arenaFrame - 1), config.arena.left, config.arena.right);
  }
  for (const seat of seats) {
    updateControl(state, config, seat, inputs[seat], events);
    const fighter = state.fighters[seat];
    // A queued command gets its full lifetime in playable frames, through hitstop.
    fighter.buffer = fighter.buffer.filter(command => --command.remaining > 0);
  }
  if (state.fighters.every(fighter => fighter.combo === 0 && fighter.blockstun === 0)) {
    state.comboFreeze = 0;
  }
  for (const seat of seats) motion(state, config, seat, inputs[seat], events);
  separate(state, config, previous);
  for (const fighter of state.fighters) releaseUnsupportedGround(fighter, config.arena, state.arenaFrame);
  const contacts = collectContacts(state, config);
  settle(state, config, contacts, events);
  for (const seat of seats) {
    const fighter = state.fighters[seat];
    if (!fighter.recovery) continue;
    if (!fighter.ground) {
      if (fighter.recovery.phase !== 'fall') fighter.recovery = { phase: 'fall' };
    } else if (fighter.recovery.phase === 'fall') {
      fighter.recovery = { phase: 'down', remaining: downFrames };
      fighter.push = 0;
      events.push({ kind: 'knockdown', source: seat, x: fighter.x, y: fighter.y });
    }
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
  state.phase = 'round-over';
  state.phaseTicks = 105;
  return events;
}

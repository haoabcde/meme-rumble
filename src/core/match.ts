import type {
  ActionDefinition, ArenaDefinition, Box, CombatEvent, Direction, Duo, FighterState,
  InputFrame, MatchConfig, MatchState, RoundResult, Side
} from './types.js';

const seats = [0, 1] as const;
const slotPriority = ['C', 'B', 'A'] as const;
const other = (seat: 0 | 1) => seat === 0 ? 1 : 0;
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function spawn(config: MatchConfig, seat: 0 | 1, round: number): FighterState {
  const side = round % 2 ? seat : other(seat);
  return {
    x: config.arena.spawn[side], y: config.arena.floor, vy: 0, facing: side === 0 ? 1 : -1,
    ground: 'floor', ignorePlatform: null, hp: config.fighters[seat].maxHp,
    guard: config.rules.guardMax, guardWait: 0, guardBreak: 0, hitstun: 0, blockstun: 0,
    push: 0, dash: 0, guarding: false, attack: null, buffer: [], combo: 0, controlled: 0,
    protection: 0, moving: false
  };
}

export function createMatch(config: MatchConfig): MatchState {
  return {
    frame: 0, remaining: config.rules.roundSeconds * config.rules.ticksPerSecond,
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
    fighter.buffer = fighter.buffer.filter(command => command.expires > state.frame);
    for (const key of input.pressed) {
      const { x, y } = input.sampled?.[key] ?? input;
      const directions: Direction[] = [];
      if (y) directions.push(y === -1 ? 'up' : 'down');
      if (x) directions.push(x === fighter.facing ? 'forward' : 'back');
      fighter.buffer.push({
        key, x, directions, down: y === 1, expires: state.frame + config.rules.inputBuffer
      });
    }
  }
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
  if (locked || f.protection) {
    f.guarding = f.blockstun > 0 && f.guardBreak === 0 && f.hitstun === 0;
    return;
  }

  const candidates = definition.actions.filter(action =>
    (action.posture === 'any' || (action.posture === 'ground') === Boolean(f.ground)) &&
    (!f.attack || (f.attack.landed && previousAction?.cancelOnHit?.includes(action.slot)))
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
      f.buffer = f.buffer.filter(item => item.expires !== command.expires);
      f.attack = { id: action.id, frame: 0, connected: false, landed: false };
      f.guarding = false;
      f.dash = 0;
      events.push({ kind: 'swing', source: seat, x: f.x, y: f.y });
      return;
    }
  }
  if (f.attack) return;

  const jump = f.buffer.find(command => command.key === 'jump');
  if (f.ground && jump) {
    f.buffer = f.buffer.filter(item => item.expires !== jump.expires);
    const dropping = jump.down && f.ground !== 'floor';
    if (!jump.down || dropping) {
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
  if (f.push !== 0) {
    move = f.push;
    f.push -= Math.sign(f.push);
  } else if (f.dash > 0) {
    move = definition.dash * f.facing;
    f.dash--;
  } else if (f.attack && action) {
    move = f.attack.frame < action.startup ? f.facing * action.advance : 0;
  } else if (!f.hitstun && !f.blockstun && !f.guardBreak && !f.guarding && !f.protection) {
    move = input.x * (f.ground ? definition.run : definition.airSpeed);
  }
  const previousX = f.x;
  f.x = clamp(f.x + move, arena.left, arena.right);
  releaseUnsupportedGround(f, arena);
  if (f.ground) return;
  const previousY = f.y;
  f.vy += 1;
  f.y += f.vy;
  if (f.vy <= 0) return;
  const platform = landingPlatform(arena, f, previousX, previousY);
  if (platform || f.y >= arena.floor) {
    if (f.vy >= 5) events.push({ kind: 'land', source: seat, x: f.x, y: platform?.y ?? arena.floor });
    f.ground = platform?.id ?? 'floor';
    f.y = platform?.y ?? arena.floor;
    f.vy = 0;
    f.ignorePlatform = null;
  }
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
      attack.frame >= action.startup + action.active || defender.protection) return [];
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
      events.push({ kind: 'block', source, x, y });
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
    events.push({ kind: 'hit', source, x, y, amount });
    maxStop = Math.max(maxStop, Math.min(6, action.stop));
  }
  state.freeze = Math.min(maxStop, 60 - state.comboFreeze);
  state.comboFreeze += state.freeze;
}

function rampToNextRound(state: MatchState, config: MatchConfig) {
  state.round++;
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
  for (const seat of seats) updateControl(state, config, seat, inputs[seat], events);
  if (state.fighters.every(fighter => fighter.combo === 0 && fighter.blockstun === 0)) {
    state.comboFreeze = 0;
  }
  for (const seat of seats) motion(state, config, seat, inputs[seat], events);
  separate(state, config, previous);
  for (const fighter of state.fighters) releaseUnsupportedGround(fighter, config.arena);
  const contacts = collectContacts(state, config);
  settle(state, config, contacts, events);

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

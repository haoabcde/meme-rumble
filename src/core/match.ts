import type {
  ActionDefinition, ArenaDefinition, Box, CombatEvent, Direction, Duo, FighterAction, FighterDefinition, FighterState,
  HitWindow, InputFrame, MatchConfig, MatchState, RoundResult, Side
} from './types.js';
import { platformAt, platformOffset } from './terrain.js';
import { MAX_ENERGY } from './types.js';
import { entityContacts, resolveContactEntity, updateEntities, spawnEntities } from './entities.js';
import {startWhale,cinematicOwner,WHALE_RULES} from './whale-kit.js';
import {frogAction,frogCanStart,startFrog,finishAscension,tickAscension,frogPowered} from './frog-kit.js';

const seats = [0, 1] as const;
const slotPriority = ['ULT', 'C', 'B', 'A'] as const;
const downFrames = 18;
const riseFrames = 12;
const other = (seat: 0 | 1) => seat === 0 ? 1 : 0;
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function spawn(config: MatchConfig, seat: 0 | 1, round: number): FighterState {
  const side = round % 2 ? seat : other(seat);
  const definition = config.fighters[seat];
  return {
    x: config.arena.spawn[side], y: config.arena.floor, vy: 0, facing: side === 0 ? 1 : -1,
    ground: 'floor', ignorePlatform: null, hp: definition.maxHp,
    energy: 0,
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

function queueInputs(state: MatchState, inputs: Duo<InputFrame>, config: MatchConfig) {
  for (const seat of seats) {
    const fighter = state.fighters[seat];
    const input = inputs[seat];
    if (!input.pressed.length) continue;
    const keys = [...new Set([...(input.held ?? []), ...input.pressed])];
    for (const key of input.pressed) {
      const { x, y } = input.sampled?.[key] ?? input;
      const directions: Direction[] = [];
      if (y) directions.push(y === -1 ? 'up' : 'down');
      if (x) directions.push(x === fighter.facing ? 'forward' : 'back');
      fighter.buffer.push({
        key, keys, x, directions, down: y === 1, sampledAt: state.frame, remaining: config.rules.inputBuffer
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

function startAction(fighter: FighterState, id: string, seat: 0 | 1, events: CombatEvent[], ultimate = false) {
  fighter.attack = { id, frame: 0, connected: false, landed: false };
  fighter.guarding = false;
  fighter.dash = 0;
  events.push({ kind: ultimate ? 'ultimate' : 'swing', source: seat, x: fighter.x, y: fighter.y });
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
  if (fighter.hitstun || fighter.blockstun || fighter.guardBreak || fighter.recovery ||
      fighter.attack || fighter.dash || fighter.guarding || fighter.x === opponent.x) return;
  fighter.facing = fighter.x < opponent.x ? 1 : -1;
}

function updateControl(
  state: MatchState, config: MatchConfig, seat: 0 | 1, input: InputFrame, events: CombatEvent[]
) {
  const f = state.fighters[seat];
  const opponent = state.fighters[other(seat)];
  const definition = config.fighters[seat];
  const wasMoving=f.moving;
  f.moving = false;
  if(f.hp<=0){f.attack=null;f.guarding=false;f.dash=0;return;}
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
  if (f.pendingCounter) {
    startAction(f, f.pendingCounter, seat, events);
    delete f.pendingCounter;
    return;
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

  faceOpponentWhenFree(f, opponent);
  if (locked) {
    f.guarding = f.blockstun > 0 && f.guardBreak === 0 && f.hitstun === 0;
    return;
  }

  const cancels = f.attack && (f.attack.landed || (previousAction && 'chainAfter' in previousAction && previousAction.chainAfter!==undefined && f.attack.frame>=previousAction.chainAfter)) ? previousAction?.cancelOnHit : undefined;
  const candidates = definition.actions.filter(action =>
    (action.posture === 'any' || (action.posture === 'ground') === Boolean(f.ground)) &&
    (f.attack ? cancels?.includes(action.id) || cancels?.includes(action.slot) : !action.linkOnly)
  );
  candidates.sort((a, b) => (b.comboKeys?.length ?? 0) - (a.comboKeys?.length ?? 0) ||
    Number(Boolean(b.direction)) - Number(Boolean(a.direction)) ||
    slotPriority.indexOf(a.slot) - slotPriority.indexOf(b.slot));
  for (const action of candidates) {
    const command = f.buffer.find(item => item.key === action.slot &&
      (!action.direction || item.directions.includes(action.direction)) &&
      action.comboKeys?.every(key => item.keys?.includes(key)) !== false);
    if (!command) continue;
    if(!frogCanStart(action,f,state)){f.buffer=f.buffer.filter(item=>item.sampledAt!==command.sampledAt);return;}
    const legacyCost = action.slot === 'ULT' ? definition.ultimateCost ?? 0 : 0;
    const cost = 'counterTo' in action ? 0 : action.energyCost ?? legacyCost;
    if ((f.energy ?? 0) < cost) {
      events.push({ kind: 'ultimate-no-energy', source: seat, x: f.x, y: f.y });
      f.buffer = f.buffer.filter(item => item !== command);
      continue;
    }
    if (cost) f.energy = (f.energy ?? 0) - cost;
    // A single accepted command consumes competing actions from the same sampled frame.
    f.buffer = f.buffer.filter(item => item.sampledAt !== command.sampledAt);
    if(!('counterTo' in action))startFrog(action,f,state);
    startAction(f, 'counterTo' in action?action.id:startWhale(action,f,state), seat, events, action.slot === 'ULT');
    return;
  }
  const bound=(f.bindUntil??0)>state.arenaFrame;
  const jump = !bound && f.buffer.find(command => command.key === 'jump');
  if (f.ground && jump && (!f.attack || (!jump.down && cancels?.includes('jump')))) {
    f.buffer = f.buffer.filter(item => item.sampledAt !== jump.sampledAt);
    const dropping = jump.down && f.ground !== 'floor';
    if (!jump.down || dropping) {
      f.attack = null;
      f.ignorePlatform = dropping ? f.ground : null;
      f.vy = dropping ? 2 : -definition.jump;
      f.jumpCount=dropping?0:1;f.secondApex=false;f.jumpOriginY=f.y;
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
}

function landingPlatform(arena: ArenaDefinition, fighter: FighterState, previousX: number, previousY: number, frame: number) {
  let next: ArenaDefinition['platforms'][number] | undefined;
  let first = Infinity;
  for (const raw of arena.platforms) {
    if (raw.id === fighter.ignorePlatform) continue;
    const end = platformAt(raw, frame);
    if (fighter.x < end.left || fighter.x > end.right || fighter.y < end.y) continue;
    const start = platformAt(raw, frame - 1);
    const gap = start.y - previousY;
    const closing = gap + fighter.y - end.y;
    if (gap < 0 || closing <= 0) continue;
    const fraction = gap / closing;
    const startX = previousX - start.left;
    const endX = fighter.x - end.left;
    const contactX = startX + fraction * (endX - startX);
    if (fraction < first && contactX >= 0 && contactX <= end.right - end.left) {
      next = end;
      first = fraction;
    }
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
    f.push -= Math.sign(f.push) * Math.min(1, Math.abs(f.push));
  } else if (f.dash > 0) {
    move = definition.dash * f.facing;
    f.dash--;
  } else if (f.attack && action) {
    if (!('counterTo' in action)) {
      move = f.attack.frame < action.startup ? f.facing * action.advance : 0;
      if (!f.ground) move += Math.round(definition.airSpeed * (action.airControl ?? 0)) * input.x;
    }
  } else if (!f.hitstun && !f.blockstun && !f.guardBreak && !f.guarding && !f.recovery) {
    move = input.x * (f.ground ? definition.run : definition.airSpeed);
  }
  const previousX = f.x;
  if((f.bindUntil??0)>state.arenaFrame){move=0;f.push=0;f.moving=false;if(!f.ground)f.vy=Math.max(6,f.vy);}
  f.x = clamp(f.x + move, arena.left, arena.right);
  releaseUnsupportedGround(f, arena, state.arenaFrame);
  if (f.ground) return;
  const previousY = f.y;
  // An air dash uses the air action budget; a ground dash off a ledge still falls.
  if (!(config.rules.airDashPauseGravity && f.dashActive && f.airActionUsed)) {
    f.vy += 1;
    f.y += f.vy;
    if(f.jumpCount===2&&Math.abs(f.vy)<=1)f.secondApex=true;
  }
  const platform = landingPlatform(arena, f, previousX, previousY, state.arenaFrame);
  if (platform || (f.vy > 0 && f.y >= arena.floor)) {
    if (f.vy >= 5 && !f.recovery) events.push({ kind: 'land', source: seat, x: f.x, y: platform?.y ?? arena.floor });
    f.ground = platform?.id ?? 'floor';
    f.y = platform?.y ?? arena.floor;
    f.vy = 0;
    f.ignorePlatform = null;
    f.airActionUsed = false;
    f.jumpCount=0;f.secondApex=false;
  }
}

function separate(state: MatchState, config: MatchConfig, previous: Duo<number>) {
  const [a, b] = state.fighters;
  if (config.rules.dashPassThrough && (a.dashActive || b.dashActive)) return;
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
  entityId?: number;
  source: 0 | 1;
  target: 0 | 1;
  action: ActionDefinition;
  group: string;
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

function collectContacts(state: MatchState, config: MatchConfig): Contact[] {
  return seats.flatMap(source => {
    const target = other(source);
    const f = state.fighters[source];
    const defender = state.fighters[target];
    const action = actionFor(config, state, source);
    const attack = f.attack;
    if (!action || 'counterTo' in action || !attack || (attack.connected && !attack.connectedGroups) ||
        !isActiveFrame(action, attack.frame) || defender.recovery ||
        (config.rules.dashInvulnerable && defender.dashActive)) return [];
    const hurtboxes = hurtRegionsFor(config.fighters[target], actionFor(config, state, target), defender.attack?.frame ?? 0)
      .map(box => worldBox(box, defender.x, defender.y, defender.facing));
    const frontal = (f.x - defender.x) * defender.facing > 0;
    const counterAction = frontal ? counterForContact(state, config, target) : undefined;
    for (const window of hitWindowsFor(action, attack.frame)) {
      if (attack.connectedGroups?.includes(window.group)) continue;
      for (const box of window.boxes) {
        const hitbox = worldBox(box, f.x, f.y, f.facing);
        const hurtbox = hurtboxes.find(hurt => overlap(hitbox, hurt) && (!action.radial ||
          Math.hypot(Math.max(hurt.x,Math.min(f.x,hurt.x+hurt.w))-f.x,Math.max(hurt.y,Math.min(f.y-65,hurt.y+hurt.h))-(f.y-65))<=action.hitbox.w/2));
        if (!hurtbox) continue;
        return [{
          source, target, group: window.group,
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
          facing: action.radial?(defender.x<f.x?-1:1):f.facing, counterAction, blocked: frontal && defender.guarding,
          x: (Math.max(hitbox.x, hurtbox.x) + Math.min(hitbox.x + hitbox.w, hurtbox.x + hurtbox.w)) / 2,
          y: (Math.max(hitbox.y, hurtbox.y) + Math.min(hitbox.y + hitbox.h, hurtbox.y + hurtbox.h)) / 2
        }];
      }
    }
    return [];
  });
}

function settle(state: MatchState, config: MatchConfig, contacts: Contact[], events: CombatEvent[]) {
  for (const contact of contacts) {
    if (contact.entityId !== undefined) {
      continue;
    }
    const attack = state.fighters[contact.source].attack!;
    attack.connected = true;
    if (contact.action.hitTimeline) (attack.connectedGroups ??= []).push(contact.group);
    attack.landed ||= (!contact.blocked && !contact.counterAction) || Boolean(contact.action.guardHitsToBreak && contact.blocked && !contact.counterAction);
  }
  let maxStop = 0;
  for (const { source, target, action, blocked, counterAction, facing, x, y,entityId } of contacts) {
    const defender = state.fighters[target];
    if(entityId!==undefined)resolveContactEntity(state,entityId,target,blocked,Boolean(counterAction));
    defender.dash = 0;
    if (defender.guardCounterLeft !== undefined) defender.guardCounterLeft = 0;
    maxStop = Math.max(maxStop, Math.min(blocked || counterAction ? 3 : 6, action.stop));
    if (counterAction) {
      defender.pendingCounter = counterAction;
      events.push({ kind: 'parry', source: target, x, y, direction: defender.facing });
      continue;
    }
    defender.attack = null;
    if (blocked) {
      if(action.guardHitsToBreak){
        const previous=defender.guardChain;
        const count=previous?.source===source&&previous.until>=state.arenaFrame?previous.count+1:1;
        defender.guardChain={source,count,until:state.arenaFrame+90};
        defender.guard=count>=action.guardHitsToBreak?0:Math.max(1,defender.guard-action.guardCost);
      }else defender.guard = Math.max(0, defender.guard - action.guardCost);
      defender.guardWait = config.rules.guardDelay;
      defender.push = Math.sign(facing) * (action.guardHitsToBreak?1.15:Math.ceil(action.push / 2));
      defender.blockstun = action.blockstun;
      events.push({ kind: 'block', source, x, y, direction: facing, ...(action.feedback && { feedback: action.feedback }) });
      if (defender.guard === 0 && defender.guardBreak === 0) {
        defender.guardBreak = config.rules.guardBreak;
        defender.guarding = false;
        events.push({ kind: 'break', source, x, y, direction: facing });
      }
      continue;
    }
    const amount = Math.min(defender.hp, action.fixedDamage?action.damage:Math.floor(action.damage * Math.max(35, 100 - 8 * defender.combo) / 100));
    defender.hp -= amount;
    if (amount > 0) {
      const attacker = state.fighters[source];
      if (attacker.energy !== undefined && action.slot !== 'ULT' && !frogPowered(attacker,state)) {
        attacker.energy = Math.min(MAX_ENERGY, attacker.energy + (config.fighters[source].ultimateGain?.onHit ?? 20));
      }
      if (defender.energy !== undefined && !frogPowered(defender,state)) {
        defender.energy = Math.min(MAX_ENERGY, defender.energy + (config.fighters[target].ultimateGain?.onHurt ?? 10));
      }
    }
    if (config.training && defender.hp === 0) defender.hp = config.fighters[target].maxHp;
    const chain = ++defender.combo;
    defender.hitstun = action.hitstun;
    defender.poseEvent={kind:action.lift?'launch':action.damage>=80?'heavy':'hurt',tick:state.arenaFrame};
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
      heavy: action.pose === 'rise' || action.pose === 'finish', ...(action.feedback && { feedback: action.feedback })
    });
  }
  for (const fighter of state.fighters) {
    if (fighter.hitstun > 0 || fighter.recovery) delete fighter.pendingCounter;
  }
  state.freeze = Math.min(maxStop, 60 - state.comboFreeze);
  state.comboFreeze += state.freeze;
}

function rampToNextRound(state: MatchState, config: MatchConfig) {
  state.round++;
  state.arenaFrame = 0;
  state.remaining = config.rules.roundSeconds * config.rules.ticksPerSecond;
  state.fighters = [spawn(config, 0, state.round), spawn(config, 1, state.round)];
  delete state.entities;
  delete state.nextEntityId;
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

  const cinematic=cinematicOwner(state);
  if(cinematic!==undefined){
    // Presentation advances, simulation clocks, statuses, entities and inputs do not.
    const attack=state.fighters[cinematic].attack!;
    if(++attack.frame===WHALE_RULES.cinematic){spawnEntities(state,config);finishAscension(state.fighters[cinematic],state);state.fighters[cinematic].attack=null;}
    for(const fighter of state.fighters)fighter.buffer=[];
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
    if (ride) {
      const shift = platformOffset(ride, state.arenaFrame) - platformOffset(ride, state.arenaFrame - 1);
      if (ride.travel?.axis === 'y') fighter.y += shift;
      else fighter.x = clamp(fighter.x + shift, config.arena.left, config.arena.right);
    }
  }
  for (const seat of seats) {
    tickAscension(state.fighters[seat],state);
    updateControl(state, config, seat, inputs[seat], events);
    if(cinematicOwner(state)!==undefined){for(const fighter of state.fighters)fighter.buffer=[];return events;}
    const fighter = state.fighters[seat];
    const guardCounter = config.fighters[seat].guardCounter;
    if (guardCounter) updateGuardWindow(fighter, inputs[seat], guardCounter.windowFrames);
    // A queued command gets its full lifetime in playable frames, through hitstop.
    fighter.buffer = fighter.buffer.filter(command => --command.remaining > 0);
  }
  if (state.fighters.every(fighter => fighter.combo === 0 && fighter.blockstun === 0)) {
    state.comboFreeze = 0;
  }
  for (const seat of seats) {
    const fighter = state.fighters[seat];
    fighter.dashActive = fighter.dash > 0;
    motion(state, config, seat, inputs[seat], events);
  }
  separate(state, config, previous);
  for (const fighter of state.fighters) releaseUnsupportedGround(fighter, config.arena, state.arenaFrame);
  // Keep the next input sample and the visible facing aligned after crossing sides.
  for (const seat of seats) faceOpponentWhenFree(state.fighters[seat], state.fighters[other(seat)]);
  updateEntities(state, config);
  const contacts = collectContacts(state, config);
  for (const contact of entityContacts(state, config)) {
    const defender = state.fighters[contact.target];
    const sourceX=contact.entity.definition.behavior==='frog-global'?(contact.entity.originX??contact.entity.x):contact.entity.x;
    const frontal = (sourceX - defender.x) * defender.facing > 0;
    contacts.push({
      ...contact, entityId: contact.entity.id, group: String(contact.entity.id),
      blocked: frontal && defender.guarding,
      counterAction: frontal ? counterForContact(state, config, contact.target) : undefined
    });
  }
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

  for(const event of events)if(['jump','air-jump','land','dash','knockdown','rise'].includes(event.kind))state.fighters[event.source].poseEvent={kind:event.kind,tick:state.arenaFrame};
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
  delete state.entities;
  state.phaseTicks = 105;
  return events;
}

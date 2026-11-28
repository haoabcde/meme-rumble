import { isAttack, type CombatEvent, type MatchConfig, type MatchState, type PowerPylon, type Side, type Turret, type TurretKind,
  type TurretSlot } from './types.js';

export const turretBuildTicks = 20;
const buildWaveRadius = 112;
const turretKeyframes = [0, 3, 7, 11, 16, turretBuildTicks];
export const turretHealth = 90;
export const pylonHealth = 110;
const turretIntervalSeconds = 2;
const turretLifetimeSeconds = 30;
const turretSlots = ['bolt', 'howitzer', 'bolt-second', 'howitzer-second'] as const;

export function turretBoosted(state: MatchState, turret: Turret): PowerPylon | undefined {
  const pylon = state.powerPylons?.[turret.owner];
  if (!pylon || pylon.remaining <= 0) return undefined;
  return Math.hypot(turret.x - pylon.x, turret.y - pylon.y) <= pylon.radius ? pylon : undefined;
}

export function pylonBox(pylon: PowerPylon) {
  return { x: pylon.x - 28, y: pylon.y - 108, w: 56, h: 108 };
}

export function opposingPylon(state: MatchState, owner: 0 | 1): PowerPylon | undefined {
  const pylon = state.powerPylons?.[1 - owner];
  return pylon && pylon.remaining > 0 && pylon.hp > 0 ? pylon : undefined;
}

export function plantPowerPylon(state: MatchState, source: 0 | 1, x: number, y: number, facing: Side,
  radius: number, duration: number, events: CombatEvent[], support?: string) {
  state.powerPylons ??= [null, null];
  const old = state.powerPylons[source];
  if (old) {
    events.push({ kind: 'pylon-expire', source, x: old.x, y: old.y, radius: old.radius });
  }
  state.powerPylons[source] = {
    owner: source, x, y, facing, age: 0, remaining: duration, radius,
    hp: pylonHealth, maxHp: pylonHealth, ...(support && { support })
  };
  events.push({ kind: 'pylon-plant', source, x, y, facing, radius });
}

export function damagePowerPylon(state: MatchState, pylon: PowerPylon, events: CombatEvent[], amount = 45) {
  pylon.hp = Math.max(0, pylon.hp - Math.max(1, Math.round(amount)));
  if (pylon.hp === 0 && state.powerPylons?.[pylon.owner] === pylon) {
    state.powerPylons[pylon.owner] = null;
    events.push({ kind: 'pylon-expire', source: pylon.owner, x: pylon.x, y: pylon.y, radius: pylon.radius });
  }
}

export function stepPowerPylons(state: MatchState, events: CombatEvent[]) {
  if (!state.powerPylons) return;
  for (const seat of [0, 1] as const) {
    const pylon = state.powerPylons[seat];
    if (!pylon) continue;
    pylon.age++;
    if (--pylon.remaining <= 0) {
      state.powerPylons[seat] = null;
      events.push({ kind: 'pylon-expire', source: seat, x: pylon.x, y: pylon.y, radius: pylon.radius });
    }
  }
}

export function turretFrame(age: number) {
  let frame = turretKeyframes.length - 1;
  while (age < turretKeyframes[frame]) frame--;
  return frame;
}

export function turretBox(turret: Turret) {
  const frame = turretFrame(turret.age);
  const height = (turret.kind === 'howitzer' ? [48, 57, 73, 90, 113, 121] : [42, 47, 61, 95, 120, 128])[frame];
  const width = turret.kind === 'howitzer' ? 73 : 66;
  return { x: turret.x - width / 2, y: turret.y - height, w: width, h: height };
}

export function opposingTurrets(state: MatchState, owner: 0 | 1) {
  return turretSlots.map(slot => state.turrets[slot])
    .filter((turret): turret is Turret => Boolean(turret && turret.owner !== owner));
}

function clearTurret(state: MatchState, slot: TurretSlot, events: CombatEvent[]) {
  const turret = state.turrets[slot];
  if (!turret) return;
  state.turrets[slot] = null;
  events.push({ kind: 'turret-burst', source: turret.owner, turretKind: turret.kind, x: turret.x, y: turret.y, facing: turret.facing });
}

export function deployTurret(state: MatchState, kind: TurretKind, source: 0 | 1, x: number, y: number,
  facing: Side, events: CombatEvent[], support?: string) {
  const second = `${kind}-second` as const;
  const slots = [kind, second] as const;
  const slot = slots.find(key => state.turrets[key]?.owner === source) ??
    slots.find(key => !state.turrets[key]);
  if (!slot) return;
  clearTurret(state, slot, events);
  state.turrets[slot] = { kind, owner: source, x, y, facing, age: 0, hp: turretHealth, maxHp: turretHealth, charge: 0, ...(support && { support }) };
  events.push({ kind: 'turret-land', source, turretKind: kind, x, y, facing });
}

export function damageTurret(state: MatchState, turret: Turret, events: CombatEvent[], amount = 45) {
  const slot = turretSlots.find(key => state.turrets[key] === turret);
  if (!slot) return;
  turret.hp = Math.max(0, turret.hp - Math.max(1, Math.round(amount)));
  if (turret.hp === 0) clearTurret(state, slot, events);
}

export function fireTurretShot(state: MatchState, config: MatchConfig, turret: Turret, events: CombatEvent[]) {
  const source = turret.owner;
  const target = state.fighters[1 - source];
  const dx = target.x - turret.x;
  turret.facing = dx === 0 ? turret.facing : dx > 0 ? 1 : -1;
  const projectileKind = turret.kind === 'bolt' ? 'bolt' : 'grenade';
  const shot = config.fighters[source].actions.filter(isAttack).find(move => move.linkOnly && move.projectile?.kind === projectileKind);
  const data = shot?.projectile;
  if (!shot || !data) return false;
  const x = turret.x + Math.min(Math.abs(dx) * .5, data.x) * turret.facing;
  const y = turret.y + data.y;
  let vx: number;
  let vy: number;
  if (projectileKind === 'grenade') {
    const initial = data.vy - data.gravity / 2;
    const fall = config.arena.floor - y - data.radius;
    const flight = (-initial + Math.sqrt(initial ** 2 + 2 * data.gravity * fall)) / data.gravity;
    vx = turret.facing * Math.min(data.vx, Math.abs(target.x - x) / flight);
    vy = data.vy;
  } else {
    const dy = target.y - 62 - y;
    const distance = Math.hypot(target.x - x, dy);
    const speed = data.vx / (distance || 1);
    vx = (target.x - x) * speed;
    vy = distance === 0 ? data.vx : dy * speed;
  }
  state.projectiles.push({ actionId: shot.id, source, facing: turret.facing, x, y,
    vx, vy, connected: false });
  events.push({ kind: 'turret-fire', source, turretKind: turret.kind, x, y, actionId: shot.id, facing: turret.facing });
  return true;
}

export function stepTurrets(state: MatchState, config: MatchConfig, events: CombatEvent[]) {
  const { ticksPerSecond } = config.rules;
  const fireIntervalTicks = turretIntervalSeconds * ticksPerSecond;
  for (const slot of turretSlots) {
    const turret = state.turrets[slot];
    if (!turret) continue;
    const { kind, owner: source } = turret;
    turret.age++;
    const readyAge = turret.age - turretBuildTicks;
    if (turret.age >= turretLifetimeSeconds * ticksPerSecond) {
      clearTurret(state, slot, events);
      continue;
    }
    const target = state.fighters[1 - source];
    const dx = target.x - turret.x;
    turret.facing = dx === 0 ? turret.facing : dx > 0 ? 1 : -1;
    if (readyAge === 0) {
      events.push({ kind: 'turret-ready', source, turretKind: kind, x: turret.x, y: turret.y,
        facing: turret.facing, radius: buildWaveRadius });
    }
    if (readyAge <= 0) continue;
    turret.charge ??= Math.max(0, readyAge - 1) % fireIntervalTicks;
    turret.charge += turretBoosted(state, turret) ? 2 : 1;
    if (turret.charge < fireIntervalTicks) continue;
    turret.charge -= fireIntervalTicks;
    fireTurretShot(state, config, turret, events);
  }
}

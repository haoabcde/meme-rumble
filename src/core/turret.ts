import { turretKinds, type CombatEvent, type MatchConfig, type MatchState, type Side, type Turret, type TurretKind } from './types.js';

export const turretBuildTicks = 20;
const buildWaveRadius = 112;
const turretKeyframes = [0, 3, 7, 11, 16, turretBuildTicks];
const turretHealth = 2;
const turretIntervalSeconds = 2;
const turretLifetimeSeconds = 30;

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
  return turretKinds.map(kind => state.turrets[kind])
    .filter((turret): turret is Turret => turret !== null && turret.owner !== owner);
}

function clearTurret(state: MatchState, kind: TurretKind, events: CombatEvent[]) {
  const turret = state.turrets[kind];
  if (!turret) return;
  state.turrets[kind] = null;
  events.push({ kind: 'turret-burst', source: turret.owner, turretKind: kind, x: turret.x, y: turret.y, facing: turret.facing });
}

export function deployTurret(state: MatchState, kind: TurretKind, source: 0 | 1, x: number, y: number,
  facing: Side, events: CombatEvent[]) {
  clearTurret(state, kind, events);
  state.turrets[kind] = { kind, owner: source, x, y, facing, age: 0, hp: turretHealth };
  events.push({ kind: 'turret-land', source, turretKind: kind, x, y, facing });
}

export function damageTurret(state: MatchState, kind: TurretKind, events: CombatEvent[]) {
  const turret = state.turrets[kind];
  if (turret && --turret.hp === 0) clearTurret(state, kind, events);
}

export function stepTurrets(state: MatchState, config: MatchConfig, events: CombatEvent[]) {
  const { ticksPerSecond } = config.rules;
  for (const kind of turretKinds) {
    const turret = state.turrets[kind];
    if (!turret) continue;
    const source = turret.owner;
    turret.age++;
    const readyAge = turret.age - turretBuildTicks;
    if (turret.age >= turretLifetimeSeconds * ticksPerSecond) {
      clearTurret(state, kind, events);
      continue;
    }
    const target = state.fighters[1 - source];
    const dx = target.x - turret.x;
    turret.facing = dx === 0 ? turret.facing : dx > 0 ? 1 : -1;
    if (readyAge === 0) {
      events.push({ kind: 'turret-ready', source, turretKind: kind, x: turret.x, y: turret.y,
        facing: turret.facing, radius: buildWaveRadius });
    }
    if (readyAge <= 0 || readyAge % (turretIntervalSeconds * ticksPerSecond) !== 0) continue;
    const projectileKind = kind === 'bolt' ? 'bolt' : 'grenade';
    const shot = config.fighters[source].actions.find(move => move.projectile?.kind === projectileKind);
    const data = shot?.projectile;
    if (!shot || !data) continue;
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
    events.push({ kind: 'turret-fire', source, turretKind: kind, x, y, actionId: shot.id, facing: turret.facing });
  }
}

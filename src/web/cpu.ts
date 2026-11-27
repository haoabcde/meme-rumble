import { bananaActionIds } from '../content/fighters/banana.js';
import { turretBoosted } from '../core/turret.js';
import { isAttack, MAX_ENERGY, MAX_TEARS, TEAR_UNITS_PER_POINT } from '../core/types.js';
import { NEUTRAL, type Axis, type InputFrame, type MatchConfig, type MatchState } from '../core/types.js';
import { actionFor } from '../core/match.js';
import { approachPlatform } from './navigation.js';

const toward = (from: number, to: number) => Math.sign(to - from) as Axis;

export function cpuInput(state: MatchState, config: MatchConfig): InputFrame {
  if (state.phase !== 'fight' || state.cutIn || state.summon?.phase === 'cut-in') return NEUTRAL;
  const [opponent, cpu] = state.fighters;
  if (cpu.hitstun || cpu.guardBreak || cpu.recovery) return NEUTRAL;
  const distance = Math.abs(opponent.x - cpu.x);
  const direction = toward(cpu.x, opponent.x);
  const higher = cpu.y - opponent.y;
  const beat = state.frame % 48;
  const { actions, airDash, airJump } = config.fighters[1];

  const tears = (cpu.tearUnits ?? 0) / TEAR_UNITS_PER_POINT;
  const bananaMoves = cpu.tearUnits === undefined ? [] : config.fighters[1].actions.filter(isAttack);
  const pressure = bananaMoves.find(action => action.id === bananaActionIds.pressure)?.hitbox;
  const uppercut = bananaMoves.find(action => action.id === bananaActionIds.uppercut)?.hitbox;
  const sprayReach = pressure ? pressure.x + pressure.w : 0;
  if (cpu.attack?.id === bananaActionIds.pressure && distance < sprayReach + 22 && direction === cpu.facing && Math.abs(higher) < 80) {
    return { x: distance > 135 ? direction : 0, y: 0, pressed: [], held: ['B'] };
  }
  if (cpu.attack?.id === bananaActionIds.recharge && distance >= 240 && tears < MAX_TEARS) {
    return { x: 0, y: 0, pressed: [], held: ['C'] };
  }
  if (cpu.attack) {
    if (!cpu.attack.landed || state.freeze !== 1 || distance > 160) return NEUTRAL;
    const links = actionFor(config, state, 1)?.cancelOnHit;
    if (cpu.ground && links?.includes('jump')) return { x: direction, y: 0, pressed: ['jump'] };
    const followUps = actions.filter(action => links?.includes(action.id));
    const launch = followUps.find(action => action.direction === 'up');
    const next = Math.floor(state.frame / 90) % 3 === 0 && launch
      ? launch : followUps.find(action => !action.direction);
    return next ? { x: direction, y: next.direction === 'up' ? -1 : 0, pressed: [next.slot] } : NEUTRAL;
  }
  if (state.freeze) return NEUTRAL;
  if (opponent.recovery) return distance > 134 ? { x: direction, y: 0, pressed: [] } : NEUTRAL;
  if (cpu.blockstun) {
    const canRetaliate = cpu.blockstun === Math.min(4, config.rules.inputBuffer) &&
      distance < 112 && Math.abs(higher) < 55;
    return canRetaliate ? { x: direction, y: 0, pressed: ['A'] } : NEUTRAL;
  }
  if (cpu.dash) {
    return distance < 116 && Math.abs(higher) < 72 && !opponent.guarding
      ? { x: direction, y: 0, pressed: ['A'] } : NEUTRAL;
  }
  if (opponent.attack && opponent.attack.frame >= 3 && distance < 140 && cpu.ground && beat < 18) {
    return { x: 0, y: 1, pressed: [] };
  }
  if (!cpu.ground && distance < 127 && higher > -95 && higher < 92 && (opponent.hitstun > 0 || beat % 9 === 2)) {
    return { x: direction, y: 0, pressed: ['A'] };
  }
  if (config.fighters[1].id === 'gaga') {
    if (cpu.ground && opponent.attack && opponent.attack.frame >= 2 && distance < 145 && beat % 16 === 6) {
      return { x: 0, y: 1, pressed: ['B'] };
    }
    if (cpu.ground && opponent.crystalMark?.source === 1 && beat % 8 === 2) {
      return { x: direction, y: -1, pressed: ['B'] };
    }
    if (cpu.ground && higher > 50 && higher < 210 && distance >= 70 && distance <= 215 && beat % 14 === 5) {
      return { x: direction, y: -1, pressed: ['B'] };
    }
    if (!cpu.ground && higher < -70 && distance < 165 && beat % 11 === 4) {
      return { x: direction, y: 0, pressed: ['B'] };
    }
    if (cpu.ground && distance >= 130 && distance < 580 && Math.abs(higher) < 150 && beat % 18 === 9) {
      return { x: direction, y: 0, pressed: ['B'] };
    }
    const ownedTurret = [state.turrets.bolt, state.turrets.howitzer].find(t => t && t.owner === 1 && !turretBoosted(state, t));
    if (cpu.ground && ownedTurret && Math.abs(cpu.x - ownedTurret.x) < 420 && Math.abs(cpu.y - ownedTurret.y) < 160 && beat % 18 === 5) {
      return { x: direction, y: 0, pressed: ['C'], sampled: { C: { x: direction, y: -1 } } };
    }
  }
  if (cpu.tearUnits !== undefined && cpu.ground) {
    if (cpu.energy >= MAX_ENERGY && distance < 840 && higher > -41 && higher < 150 && beat % 12 === 3) {
      return { x: 0, y: 0, pressed: ['ULT'] };
    }
    if (!cpu.joAwakened && cpu.energy >= MAX_ENERGY && distance >= 310 && beat % 18 === 6) {
      return { x: 0, y: -1, pressed: ['C'] };
    }
    if (tears < 40 && distance >= 310) return { x: 0, y: 0, pressed: ['C'], held: ['C'] };
    if (tears >= 35 && uppercut && higher > 60 && higher < -uppercut.y - 25 && distance < 110 && beat % 8 === 0) {
      return { x: 0, y: -1, pressed: ['B'] };
    }
    if (tears >= 20 && Math.abs(higher) < 54 && distance >= 105 && distance <= sprayReach - 8 && beat % 12 === 0) {
      return { x: 0, y: 0, pressed: ['B'], held: ['B'] };
    }
  }
  const route = approachPlatform(state, config);
  if (route) return route;
  if (!cpu.ground) {
    if (!cpu.airActionUsed && airJump && cpu.vy >= -3 && higher > 60 && higher < 131 &&
      distance < 164 && beat % 9 === 2) {
      return { x: direction, y: 0, pressed: ['jump'] };
    }
    if (airDash && !cpu.airActionUsed && distance > 150 && distance < 340 &&
      Math.abs(higher) < 110 && beat % 9 === 2) {
      return { x: direction, y: 0, pressed: ['dash'] };
    }
  }
  if (cpu.ground && distance < 113 && higher > 30 && higher < 134 && beat % 12 === 4) {
    return { x: direction, y: -1, pressed: ['A'] };
  }
  if (higher < -64 && cpu.ground && cpu.ground !== 'floor' && beat % 19 === 8) {
    return { x: direction, y: 1, pressed: ['jump'] };
  }
  if (distance > 260 && cpu.ground === 'floor' && beat % 24 === 0) {
    return { x: direction, y: 0, pressed: ['dash'] };
  }
  if (cpu.ground && distance < 113 && Math.abs(higher) < 87 && beat % 11 === 7) {
    return { x: 0, y: 0, pressed: ['A'] };
  }
  return { x: distance > 76 ? direction : 0, y: 0, pressed: [] };
}

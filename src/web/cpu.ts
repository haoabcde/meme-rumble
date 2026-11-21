import { approachPlatform } from './navigation.js';
import { bananaActionIds } from '../content/banana.js';
import { MAX_ENERGY, MAX_TEARS, NEUTRAL, TEAR_UNITS_PER_POINT, type Axis, type InputFrame, type MatchConfig, type MatchState } from '../core/types.js';

const toward = (from: number, to: number) => Math.sign(to - from) as Axis;

export function cpuInput(state: MatchState, config: MatchConfig): InputFrame {
  if (state.phase !== 'fight' || state.freeze || state.cutIn) return NEUTRAL;
  const [opponent, cpu] = state.fighters;
  if (cpu.hitstun || cpu.blockstun || cpu.dash || cpu.guardBreak || cpu.protection) return NEUTRAL;
  const distance = Math.abs(opponent.x - cpu.x);
  const direction = toward(cpu.x, opponent.x);
  const higher = cpu.y - opponent.y;
  const beat = state.frame % 48;
  const tears = (cpu.tearUnits ?? 0) / TEAR_UNITS_PER_POINT;
  const bananaMoves = cpu.tearUnits === undefined ? [] : config.fighters[1].actions;
  const pressure = bananaMoves.find(action => action.id === bananaActionIds.pressure)?.hitbox;
  const uppercut = bananaMoves.find(action => action.id === bananaActionIds.uppercut)?.hitbox;
  const sprayReach = pressure ? pressure.x + pressure.w : 0;
  if (cpu.attack?.id === bananaActionIds.pressure && distance < sprayReach + 22 && direction === cpu.facing && Math.abs(higher) < 80) {
    return { x: distance > 135 ? direction : 0, y: 0, pressed: [], held: ['B'] };
  }
  if (cpu.attack?.id === bananaActionIds.recharge && distance >= 240 && tears < MAX_TEARS) {
    return { x: 0, y: 0, pressed: [], held: ['C'] };
  }
  if (cpu.attack) return NEUTRAL;

  if (opponent.attack && opponent.attack.frame >= 3 && distance < 140 && cpu.ground && beat < 18) {
    return { x: 0, y: 1, pressed: [] };
  }
  if (cpu.tearUnits !== undefined && cpu.ground) {
    if (cpu.energy >= MAX_ENERGY && distance < 840 && higher > -41 && higher < 150 && beat % 12 === 3) {
      return { x: 0, y: 1, pressed: ['C'] };
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
  if (higher < -64 && cpu.ground && cpu.ground !== 'floor' && beat % 19 === 8) {
    return { x: direction, y: 1, pressed: ['jump'] };
  }
  if (distance > 260 && cpu.ground === 'floor' && beat % 24 === 0) {
    return { x: direction, y: 0, pressed: ['dash'] };
  }
  if (distance < 113 && Math.abs(higher) < 87 && beat % 11 === 7) {
    return { x: 0, y: 0, pressed: ['A'] };
  }
  return { x: distance > 76 ? direction : 0, y: 0, pressed: [] };
}

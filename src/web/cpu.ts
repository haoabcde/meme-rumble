import { NEUTRAL, type Axis, type InputFrame, type MatchConfig, type MatchState } from '../core/types.js';

const toward = (from: number, to: number) => Math.sign(to - from) as Axis;
const gapTo = (x: number, left: number, right: number) => Math.max(left - x, x - right, 0);

export function cpuInput(state: MatchState, config: MatchConfig): InputFrame {
  if (state.phase !== 'fight' || state.freeze) return NEUTRAL;
  const [opponent, cpu] = state.fighters;
  if (cpu.attack || cpu.hitstun || cpu.blockstun || cpu.dash || cpu.guardBreak || cpu.protection) return NEUTRAL;
  const distance = Math.abs(opponent.x - cpu.x);
  const direction = toward(cpu.x, opponent.x);
  const higher = cpu.y - opponent.y;
  const beat = state.frame % 48;

  if (opponent.attack && opponent.attack.frame >= 3 && distance < 140 && cpu.ground && beat < 18) {
    return { x: 0, y: 1, pressed: [] };
  }
  if (higher > 72 && cpu.ground) {
    const { jump, airSpeed } = config.fighters[1];
    const maxRise = jump * (jump - 1) / 2;
    const support = config.arena.platforms.find(platform => platform.id === cpu.ground);
    const options = config.arena.platforms
      .filter(platform => platform.y < cpu.y - 16 && cpu.y - platform.y < maxRise - 5)
      .map(platform => ({
        platform,
        startGap: gapTo(cpu.x, platform.left + 18, platform.right - 18),
        score: gapTo(opponent.x, platform.left, platform.right) + Math.abs(platform.y - opponent.y) * .8
      }));
    options.sort((a, b) => a.score + a.startGap * .5 - b.score - b.startGap * .5);
    const next = options[0];
    if (next) {
      const { left, right, y } = next.platform;
      const target = Math.min(right - 18, Math.max(left + 18, opponent.x));
      const jumpRun = Math.sqrt(2 * (maxRise - (cpu.y - y))) * airSpeed + jump * airSpeed;
      const heading = toward(cpu.x, target);
      if (next.startGap <= jumpRun * .72 && beat % 7 < 2) {
        return { x: heading, y: 0, pressed: ['jump'] };
      }
      if (!support || (cpu.x + heading * 12 > support.left && cpu.x + heading * 12 < support.right)) {
        return { x: heading, y: 0, pressed: [] };
      }
    }
  }
  if (higher < -64 && cpu.ground && cpu.ground !== 'floor' && beat % 19 === 8) {
    return { x: direction, y: 1, pressed: ['jump'] };
  }
  if (distance > 220 && cpu.ground === 'floor' && beat === 0) {
    return { x: direction, y: 0, pressed: ['dash'] };
  }
  if (distance < 113 && Math.abs(higher) < 87 && beat % 11 === 7) {
    return { x: 0, y: 0, pressed: ['A'] };
  }
  return { x: distance > 76 ? direction : 0, y: 0, pressed: [] };
}

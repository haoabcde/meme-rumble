import type { ArenaDefinition, FighterState, Side, Summon } from './types.js';
import { platformAt } from './terrain.js';

export const summonCutInFrames = 48;
export const summonFallFrames = 36;
export const summonImpactFrames = 12;
export const summonArea = { halfWidth: 180, above: 148, below: 22 };
export const dijiangPitch = Math.PI / 5;
export const summonCatchRadius = 32;

export function aimSummon(arena: ArenaDefinition, target: FighterState, preferred: Side, frame = 0) {
  const y = arena.floor;
  const height = (feet: number) => Math.min(y, Math.max(0, feet - 54));
  const descent = (aimY: number) => Math.max(arena.height * .42, y - aimY + 450);
  let aimY = target.ground === 'floor' ? y : height(target.y);
  let targetX = target.x;
  const support = arena.platforms.find(platform => platform.travel && platform.id === target.ground);
  if (support) {
    const start = platformAt(support, frame);
    for (let i = 0; i < 3; i++) {
      const progress = (1 - (y - aimY) / descent(aimY)) ** (1 / 1.55);
      const intercept = platformAt(support, frame + Math.round(summonFallFrames * progress));
      targetX = target.x + intercept.left - start.left;
      aimY = height(target.y + intercept.y - start.y);
    }
  }
  const run = (y - aimY) / Math.tan(dijiangPitch);
  const facing = run <= (preferred === 1 ? arena.right - targetX : targetX - arena.left)
    ? preferred : targetX < (arena.left + arena.right) / 2 ? 1 : -1;
  const x = Math.max(arena.left, Math.min(arena.right, targetX + facing * run));
  return { x, y, facing, rise: descent(aimY) };
}

export function dijiangTip({ x, y, facing, rise }: Pick<Summon, 'x' | 'y' | 'facing' | 'rise'>, progress: number) {
  const remaining = (1 - Math.max(0, Math.min(1, progress)) ** 1.55) * rise;
  return { x: x - facing * remaining / Math.tan(dijiangPitch), y: y - remaining };
}

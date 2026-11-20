import { platformAt } from '../core/terrain.js';
import type { Axis, InputFrame, MatchConfig, MatchState, Platform } from '../core/types.js';

const inset = 18;
const nearest = (x: number, p: Platform) => Math.max(p.left + inset, Math.min(p.right - inset, x));
const heading = (x: number, target: number, speed: number): Axis =>
  Math.abs(target - x) <= speed / 2 ? 0 : target > x ? 1 : -1;

// n ticks of the simulation move the feet by n*vy + n*(n+1)/2.
function descendingTicks(y: number, vy: number, target: number) {
  const initial = vy + .5;
  const discriminant = initial * initial + 2 * (target - y);
  if (discriminant < 0) return 0;
  return Math.max(0, Math.ceil(-initial + Math.sqrt(discriminant)));
}

export function approachPlatform(state: MatchState, config: MatchConfig): InputFrame | undefined {
  const [target, cpu] = state.fighters;
  const arena = config.arena;
  const destination = arena.platforms.find(p => p.id === target.ground);
  if (!destination || cpu.ground === destination.id || (cpu.ground && target.y - cpu.y > 40)) return;
  const { jump, airSpeed, run } = config.fighters[1];
  const raw = arena.platforms.filter(p => !p.travel || p.id === destination.id || p.id === cpu.ground);
  const surfaces = raw.map(p => platformAt(p, state.arenaFrame));
  const goal = surfaces.find(p => p.id === destination.id)!;
  const support = surfaces.find(p => p.id === cpu.ground);
  const costs = new Map<Platform, number>([[goal, 0]]);
  const pending = new Set(surfaces);

  // Work backwards from the occupied roof. There can be a useful first jump away from the opponent.
  while (pending.size) {
    let next: Platform | undefined;
    let cost = Infinity;
    for (const p of pending) {
      const candidate = costs.get(p) ?? Infinity;
      if (candidate < cost) { next = p; cost = candidate; }
    }
    if (!next) break;
    pending.delete(next);
    for (const p of pending) {
      if (next.y > p.y + 40) continue;
      const ticks = descendingTicks(p.y, -jump, next.y);
      const gap = Math.max(p.left - next.right, next.left - p.right, -2 * inset) + 2 * inset;
      if (!ticks || gap > (ticks - 2) * airSpeed) continue;
      const approach = Math.abs(p.left + p.right - next.left - next.right) / (2 * run);
      const total = cost + ticks + approach;
      if (total < (costs.get(p) ?? Infinity)) costs.set(p, total);
    }
  }

  let best: { x: number; jumpNow: boolean } | undefined;
  let bestTime = Infinity;
  for (const [i, p] of surfaces.entries()) {
    const remaining = costs.get(p);
    if (remaining === undefined || p === support || p.id === cpu.ignorePlatform) continue;
    if (support && p.y > support.y + 40) continue;
    const ticks = descendingTicks(cpu.y, cpu.ground ? -jump : cpu.vy, p.y);
    if (!ticks) continue;
    const landing = p.travel ? platformAt(raw[i], state.arenaFrame + ticks) : p;
    const entry = nearest(cpu.x, landing);
    const launch = support ? nearest(entry, support) : entry;
    const reach = Math.max(0, ticks - 1) * airSpeed;
    const gap = Math.abs(entry - cpu.x);
    if (cpu.ground ? Math.abs(entry - launch) > reach : gap > reach + airSpeed) continue;
    const walk = Math.max(0, gap - reach);
    const finishX = nearest(target.x, landing);
    const time = walk / run + ticks + remaining + Math.abs(entry - finishX) / run;
    if (time >= bestTime) continue;
    bestTime = time;
    best = { x: cpu.ground && walk > 0 ? launch : finishX, jumpNow: Boolean(cpu.ground && walk <= 0) };
  }
  if (!best) return;
  return { x: heading(cpu.x, best.x, cpu.ground ? run : airSpeed), y: 0, pressed: best.jumpNow ? ['jump'] : [] };
}

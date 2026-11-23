import type { ArenaDefinition, Platform } from './types.js';

type Point = { x: number; y: number };

// The dwell at each end gives riders time to board. Positions are integral and replayable.
export function platformOffset(platform: Platform, frame = 0) {
  const travel = platform.travel;
  if (!travel) return 0;
  const t = ((frame + travel.phase) % travel.period + travel.period) % travel.period;
  const half = travel.period / 2;
  const outward = t < half ? t : travel.period - t;
  const progress = Math.min(1, Math.max(0, (outward - travel.dwell / 2) / (half - travel.dwell)));
  return Math.round(travel.distance * progress);
}

export function platformAt(platform: Platform, frame: number): Platform {
  if (!platform.travel) return platform;
  const offset = platformOffset(platform, frame);
  return platform.travel.axis === 'y'
    ? { ...platform, y: platform.y + offset }
    : { ...platform, left: platform.left + offset, right: platform.right + offset };
}

export function platformContact(platform: Platform, frame: number, from: Point, to: Point, previousFrame = frame - 1) {
  const start = platformAt(platform, previousFrame);
  const surface = platformAt(platform, frame);
  const gap = start.y - from.y;
  const closing = gap + to.y - surface.y;
  if (gap < 0 || closing <= 0 || gap > closing) return;
  const time = gap / closing;
  const offset = from.x - start.left + time * (to.x - surface.left - (from.x - start.left));
  if (offset < 0 || offset > surface.right - surface.left) return;
  return { time, x: offset + surface.left, surface };
}

export function tierAt(arena: ArenaDefinition, platform: Platform, frame: number) {
  if (platform.travel?.axis !== 'y') return platform.tier;
  const height = platformAt(platform, frame).y;
  const stops = arena.routes[0].map(id => arena.platforms.find(p => p.id === id)!);
  return stops.reduce((nearest, p) => Math.abs(p.y - height) < Math.abs(nearest.y - height) ? p : nearest).tier;
}

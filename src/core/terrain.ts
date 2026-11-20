import type { Platform } from './types.js';

// The dwell at each end gives riders time to board. Positions are integral and replayable.
export function platformOffset(platform: Platform, frame = 0) {
  const travel = platform.travel;
  if (!travel) return 0;
  const t = (frame + travel.phase) % travel.period;
  const half = travel.period / 2;
  const outward = t < half ? t : travel.period - t;
  const progress = Math.min(1, Math.max(0, (outward - travel.dwell / 2) / (half - travel.dwell)));
  return Math.round(travel.distance * progress);
}

export function platformAt(platform: Platform, frame: number): Platform {
  if (!platform.travel) return platform;
  const dx = platformOffset(platform, frame);
  return { ...platform, left: platform.left + dx, right: platform.right + dx };
}

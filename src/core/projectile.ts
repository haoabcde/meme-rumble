import type { ArenaDefinition, Box } from './types.js';
import { platformContact } from './terrain.js';

interface Point {
  x: number;
  y: number;
}

export function segmentBoxTime(from: Point, to: Point, box: Box, padding: number, horizontalPadding = padding) {
  let enter = 0;
  let exit = 1;
  for (const [start, delta, min, max] of [
    [from.x, to.x - from.x, box.x - horizontalPadding, box.x + box.w + horizontalPadding],
    [from.y, to.y - from.y, box.y - padding, box.y + box.h + padding]
  ]) {
    if (delta === 0) {
      if (start < min || start > max) return undefined;
      continue;
    }
    const a = (min - start) / delta;
    const b = (max - start) / delta;
    enter = Math.max(enter, Math.min(a, b));
    exit = Math.min(exit, Math.max(a, b));
    if (enter > exit) return undefined;
  }
  return enter;
}

export function floorImpact(arena: ArenaDefinition, from: Point, to: Point) {
  const { floor: y, left, right } = arena;
  if (to.y < y || from.y > y || to.y <= from.y) return undefined;
  const time = (y - from.y) / (to.y - from.y);
  return { x: from.x + (to.x - from.x) * time, time, surface: { id: 'floor', y, left, right } };
}

export function landingImpact(arena: ArenaDefinition, from: Point, to: Point, height: number, frame: number,
  floorOnly = false) {
  const base = { x: from.x, y: from.y + height };
  const next = { x: to.x, y: to.y + height };
  let impact = floorImpact(arena, base, next);
  if (floorOnly) return impact;
  for (const platform of arena.platforms) {
    const contact = platformContact(platform, frame, base, next);
    if (contact && (!impact || contact.time < impact.time)) impact = contact;
  }
  return impact;
}

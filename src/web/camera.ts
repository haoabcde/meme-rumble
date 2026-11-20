import type { ArenaDefinition, Duo } from '../core/types.js';

export interface CameraView {
  x: number;
  y: number;
  zoom: number;
}

type Size = Pick<ArenaDefinition, 'width' | 'height'>;
type Subject = { x: number; y: number; height: number };

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function frameCamera(
  arena: Size, viewport: Size, subjects: Duo<Subject>,
  previous: CameraView | null, elapsed: number, focus: boolean
): CameraView {
  const [a, b] = subjects;
  const { width, height } = viewport;
  const left = Math.max(0, Math.min(a.x, b.x) - 96);
  const right = Math.min(arena.width, Math.max(a.x, b.x) + 96);
  const head = Math.min(a.y - a.height, b.y - b.height) - 32;
  const feet = Math.max(a.y, b.y);
  const hud = height * .19;
  const bottom = height * .09;
  const fullStage = Math.max(width / arena.width, height / arena.height);
  const fit = Math.max(fullStage, Math.min(width / (right - left), (height - hud - bottom) / (feet - head)));
  const close = 1 - Math.min(1, Math.abs(a.x - b.x) / 820);
  const preferred = Math.min(fit, 1.06 + (focus ? .26 * close : 0));
  const ease = 1 - Math.exp(-elapsed * .2);
  // Pull back immediately when the previous zoom would crop a fighter.
  const zoom = previous ? clamp(previous.zoom + (preferred - previous.zoom) * ease, fullStage, fit) : preferred;
  const visibleWidth = width / zoom;
  const visibleHeight = height / zoom;
  const maxX = Math.max(0, arena.width - visibleWidth);
  const maxY = Math.max(0, arena.height - visibleHeight);
  const minX = clamp(right - visibleWidth, 0, maxX);
  const minY = clamp(feet - (height - bottom) / zoom, 0, maxY);
  const targetX = (a.x + b.x - visibleWidth) / 2;
  const targetY = feet - height * .82 / zoom;
  const lastX = previous ? previous.x + (width / previous.zoom - visibleWidth) / 2 : targetX;
  const lastY = previous ? previous.y + (height / previous.zoom - visibleHeight) / 2 : targetY;

  return {
    x: clamp(lastX + (targetX - lastX) * ease, minX, clamp(left, minX, maxX)),
    y: clamp(lastY + (targetY - lastY) * ease, minY, clamp(head - hud / zoom, minY, maxY)),
    zoom
  };
}

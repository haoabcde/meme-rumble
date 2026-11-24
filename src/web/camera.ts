import { dijiangPitch } from '../core/summon.js';
import type { ArenaDefinition, Duo } from '../core/types.js';

export interface CameraView {
  x: number;
  y: number;
  zoom: number;
}

export function frameDijiangLength(viewport: Size, camera: CameraView) {
  return viewport.width * 1.36 / camera.zoom;
}

export function dijiangBurialTip(
  length: number, target: Pick<Subject, 'x' | 'y'>,
  facing: -1 | 1, progress: number
) {
  const time = clamp(progress, 0, 1);
  const distance = length * 1.2 * time * (.42 + .58 * time);
  return {
    x: target.x + facing * distance * Math.cos(dijiangPitch),
    y: target.y + distance * Math.sin(dijiangPitch)
  };
}

type Size = Pick<ArenaDefinition, 'width' | 'height'>;
type Subject = { x: number; y: number; height: number };

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function frameDijiangImpact(
  arena: Size, viewport: Size, camera: CameraView, target: Pick<Subject, 'x' | 'y'>, age: number
): CameraView {
  if (age >= 25) return camera;
  const weight = (1 - age / 25) ** 2;
  const zoom = camera.zoom * (1 + .08 * weight);
  const anchor = 1 - camera.zoom / zoom;
  const x = camera.x + (target.x - camera.x) * anchor + Math.sin(age * 1.16) * 24 * weight / zoom;
  const y = camera.y + (target.y - camera.y) * anchor + Math.cos(age * .79) * 42 * weight / zoom;
  return {
    x: clamp(x, 0, Math.max(0, arena.width - viewport.width / zoom)),
    y: clamp(y, 0, Math.max(0, arena.height - viewport.height / zoom)),
    zoom
  };
}

export function frameEntrance(
  arena: Size, viewport: Size, camera: CameraView, subjects: Duo<Subject>, amount: number
): CameraView {
  // Room for a fighter's own width either side, and clear air above the taller one.
  const [a, b] = subjects;
  const zoom = Math.min(viewport.width / (Math.abs(a.x - b.x) + 168),
    viewport.height * .76 / (Math.max(a.height, b.height) + 44));
  const visibleWidth = viewport.width / zoom, visibleHeight = viewport.height / zoom;
  const x = clamp((a.x + b.x - visibleWidth) / 2, 0, Math.max(0, arena.width - visibleWidth));
  const y = clamp(Math.max(a.y, b.y) - viewport.height * .84 / zoom, 0, Math.max(0, arena.height - visibleHeight));
  return {
    x: camera.x + (x - camera.x) * amount,
    y: camera.y + (y - camera.y) * amount,
    zoom: camera.zoom + (zoom - camera.zoom) * amount
  };
}

export function frameCamera(
  arena: Size, viewport: Size, subjects: Duo<Subject>,
  previous: CameraView | null, elapsed: number, focus: boolean, opening = 0, anchor?: Pick<Subject, 'x' | 'y'>,
  effectEdges: ReadonlyArray<Pick<Subject, 'x' | 'y'>> = []
): CameraView {
  const [a, b] = subjects;
  const { width, height } = viewport;
  const left = Math.max(0, Math.min(a.x - 96, b.x - 96, anchor ? anchor.x - 158 : Infinity,
    ...effectEdges.map(edge => edge.x - 38)));
  const right = Math.min(arena.width, Math.max(a.x + 96, b.x + 96, anchor ? anchor.x + 158 : -Infinity,
    ...effectEdges.map(edge => edge.x + 38)));
  const head = Math.min(a.y - a.height, b.y - b.height, anchor?.y ?? Infinity,
    ...effectEdges.map(edge => edge.y)) - 32;
  const feet = Math.max(a.y, b.y, anchor?.y ?? -Infinity);
  const hud = height * .19;
  const bottom = height * .09;
  const fullStage = Math.max(width / arena.width, height / arena.height);
  const fit = Math.max(fullStage, Math.min(width / (right - left), (height - hud - bottom) / (feet - head)));
  const close = 1 - Math.min(1, Math.abs(a.x - b.x) / 820);
  const combatZoom = Math.min(fit, 1.06 + (focus ? .26 : .09) * close);
  const blend = opening * opening * (3 - 2 * opening);
  const preferred = combatZoom + (Math.min(combatZoom, width / (arena.width * .56)) - combatZoom) * blend;
  const ease = 1 - Math.exp(-elapsed * .15);
  // Pull back immediately when the previous zoom would crop a fighter.
  const zoom = previous && !opening ? clamp(previous.zoom + (preferred - previous.zoom) * ease, fullStage, fit) : clamp(preferred, fullStage, fit);
  const visibleWidth = width / zoom;
  const visibleHeight = height / zoom;
  const maxX = Math.max(0, arena.width - visibleWidth);
  const maxY = Math.max(0, arena.height - visibleHeight);
  const minX = clamp(right - visibleWidth, 0, maxX);
  const minY = clamp(feet - (height - bottom) / zoom, 0, maxY);
  const targetX = (a.x + b.x - visibleWidth) / 2;
  const targetY = (a.y + b.y) / 2 - height * (.79 - .04 * blend) / zoom;
  const lastX = previous ? previous.x + (width / previous.zoom - visibleWidth) / 2 : targetX;
  const lastY = previous ? previous.y + (height / previous.zoom - visibleHeight) / 2 : targetY;

  const followX = clamp(lastX, targetX - 20 / zoom, targetX + 20 / zoom);
  const followY = clamp(lastY, targetY - 44 / zoom, targetY + 44 / zoom);
  return {
    x: clamp(opening ? targetX : lastX + (followX - lastX) * ease, minX, clamp(left, minX, maxX)),
    y: clamp(opening ? targetY : lastY + (followY - lastY) * ease, minY, clamp(head - hud / zoom, minY, maxY)),
    zoom
  };
}

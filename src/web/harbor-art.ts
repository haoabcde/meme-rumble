import { platformAt } from '../core/terrain.js';
import type { ArenaDefinition, Platform } from '../core/types.js';
import { backgrounds, harborProps, harborGantry } from './art.js';

// Source rectangles and measured walk lines in the hand-painted port atlas.
// The ferry's walkable cabin roof is shorter than its hull.
type Prop = Exclude<NonNullable<Platform['prop']>, 'bridge' | 'gallery'>;
interface Sprite {
  box: [number, number, number, number];
  lip: [number, number, number];
}
const atlas: Record<Prop, Sprite> = {
  container: { box: [38, 32, 725, 259], lip: [43, 757, 67] },
  trailer:   { box: [869, 26, 582, 289], lip: [892, 1378, 51] },
  catwalk:   { box: [17, 366, 745, 277], lip: [21, 756, 450] },
  ferry:     { box: [786, 394, 734, 243], lip: [848, 1467, 407] },
  pallet:    { box: [66, 654, 661, 343], lip: [74, 717, 923] },
  office:    { box: [811, 701, 700, 303], lip: [818, 1506, 715] }
};
const railRise = 725;

function drawProp(ctx: CanvasRenderingContext2D, p: Platform, floor: number) {
  if (p.prop === 'bridge') {
    if (!harborGantry.naturalWidth) return;
    const scale = (p.right - p.left) / (1898 - 272);
    const depth = scale * 1.78;
    const x = (source: number) => p.left + (source - 272) * scale;
    const y = (source: number) => p.y + (source - 554) * depth;
    for (const post of [273, 1779]) {
      ctx.drawImage(harborGantry, post, 682, 116, 39, x(post), y(680), 116 * scale, floor - y(680));
    }
    ctx.drawImage(harborGantry, 261, 480, 1653, 244, x(261), y(480), 1653 * scale, 244 * depth);
    return;
  }
  if (!p.prop || !harborProps.naturalWidth) return;
  if (p.prop === 'gallery') {
    // These galleries hang from the gantry's underside. The floor below stays completely open.
    const scale = (p.right - p.left) / 735;
    const beam = floor - railRise - 2;
    ctx.fillStyle = '#59515a';
    for (const x of [p.left + 13, p.right - 13]) ctx.fillRect(x - 2, beam, 4, p.y - beam + 4);
    ctx.save();
    ctx.filter = 'saturate(.28)';
    ctx.drawImage(harborProps, 17, 366, 745, 159,
      p.left - 4 * scale, p.y - 84 * scale, 745 * scale, 159 * scale);
    ctx.restore();
    return;
  }
  const { box: [sx, sy, sw, sh], lip: [left, right, y] } = atlas[p.prop];
  const scale = (p.right - p.left) / (right - left);
  const x = p.left - (left - sx) * scale;
  const bottom = sy + sh;
  if (p.prop === 'office' || p.prop === 'catwalk') {
    // Stretch only the open steel legs. The rail, room, braces and footings keep their proportions.
    const joint = p.prop === 'office' ? 954 : 538;
    const foot = p.prop === 'office' ? 979 : 597;
    const top = p.y - (y - sy) * scale;
    const jointY = p.y + (joint - y) * scale;
    const baseY = Math.max(floor - (bottom - foot) * scale, jointY + (foot - joint) * scale);
    const slice = (from: number, to: number, destY: number, height: number) => {
      ctx.drawImage(harborProps, sx, from, sw, to - from, x, destY, sw * scale, height);
    };
    slice(sy, joint, top, jointY - top);
    slice(joint, foot, jointY, baseY - jointY);
    slice(foot, bottom, baseY, (bottom - foot) * scale);
    return;
  }
  const scaleY = p.travel ? scale : (floor - p.y + 4) / (bottom - y);
  ctx.drawImage(harborProps, sx, sy, sw, sh, x, p.y - (y - sy) * scaleY, sw * scale, sh * scaleY);
}

export function drawQuay(ctx: CanvasRenderingContext2D, arena: ArenaDefinition, viewCenter = arena.width / 2) {
  const { width, height, floor } = arena;
  const image = backgrounds.harbor;
  if (!image.naturalWidth) {
    ctx.fillStyle = '#797992';
    ctx.fillRect(0, 0, width, height);
    return;
  }
  // Only the distant water and skyline have parallax. The pavement stays under the fighters' feet.
  const offset = (viewCenter - width / 2) * .43;
  const band = (start: number, end: number, top: number, bottom: number, x = 0) =>
    ctx.drawImage(image, 0, start, image.naturalWidth, end - start, x, top, width, bottom - top);
  const skyTop = floor - 56 - 591 * width / image.naturalWidth;
  const sky = ctx.createLinearGradient(0, 0, 0, skyTop);
  sky.addColorStop(0, '#655777');
  sky.addColorStop(1, '#b18091');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, skyTop + 1);
  band(0, 591, skyTop, floor - 56, offset);
  const haze = ctx.createLinearGradient(0, skyTop, 0, skyTop + 245);
  haze.addColorStop(0, '#b18091');
  haze.addColorStop(1, '#b1809100');
  ctx.fillStyle = haze;
  ctx.fillRect(0, skyTop, width, 245);
  band(591, 622, floor - 56, floor);
  const quayEdge = floor + (image.naturalHeight - 622) * 2;
  band(622, image.naturalHeight, floor, quayEdge);
  const concrete = ctx.createLinearGradient(0, quayEdge, 0, height);
  concrete.addColorStop(0, '#514454');
  concrete.addColorStop(1, '#2b2e43');
  ctx.fillStyle = concrete;
  ctx.fillRect(0, quayEdge, width, height - quayEdge);
}

export function drawHarborScenery(ctx: CanvasRenderingContext2D, arena: ArenaDefinition) {
  const { floor } = arena;
  const rail = floor - railRise;
  if (harborGantry.naturalWidth) {
    const x = 1008;
    const width = 2336;
    const wheels = floor - 40 - 71;
    ctx.save();
    ctx.globalAlpha = .78;
    ctx.filter = 'saturate(.62)';
    // Keep the girder and its wheels rigid. Only the lattice leg span follows the port's height.
    ctx.drawImage(harborGantry, 0, 0, 2172, 149, x, rail - 149, width, 149);
    ctx.drawImage(harborGantry, 0, 149, 2172, 259, x, rail, width, wheels - rail);
    ctx.drawImage(harborGantry, 0, 408, 2172, 71, x, wheels, width, 71);
    ctx.restore();
  }
  const scenery = arena.platforms.filter(p => !p.travel).sort((a, b) => a.y - b.y);
  for (const p of scenery) drawProp(ctx, p, floor);
  // Pier-end bollards mark the stop at each end of the playable quay.
  for (const end of [arena.left - 8, arena.right + 8]) {
    ctx.fillStyle = '#3f4149';
    ctx.fillRect(end - 15, floor - 34, 30, 38);
    ctx.fillStyle = '#e6b25b';
    ctx.fillRect(end - 20, floor - 34, 40, 8);
    ctx.fillRect(end - 15, floor - 21, 30, 4);
    ctx.fillStyle = '#555157';
    ctx.fillRect(end - 21, floor - 3, 42, 7);
  }
}

export function drawHarborLift(ctx: CanvasRenderingContext2D, arena: ArenaDefinition, frame: number) {
  const lift = arena.platforms.find(p => p.travel);
  if (!lift) return;
  const p = platformAt(lift, frame);
  const center = (p.left + p.right) / 2;
  const rail = arena.floor - railRise;
  const hookY = p.y - (923 - 654) * (p.right - p.left) / (717 - 74);
  ctx.fillStyle = '#454751';
  for (const offset of [-5, 5]) ctx.fillRect(center + offset - 1.5, rail - 1, 3, hookY - rail + 3);
  ctx.fillStyle = '#39404e';
  ctx.fillRect(center - 23, rail - 10, 46, 15);
  ctx.fillStyle = '#db9c4f';
  ctx.fillRect(center - 17, rail - 8, 34, 7);
  drawProp(ctx, p, arena.floor);
}

import dormArt from '../../assets/arenas/dorm-rooftop-illustrated.webp';
import courtArt from '../../assets/arenas/court-illustrated.webp';
import harborArt from '../../assets/arenas/harbor-illustrated.webp';
import stationArt from '../../assets/arenas/station-illustrated.webp';
import broadcastArt from '../../assets/arenas/broadcast-long-master.webp';
import type { ArenaDefinition } from '../core/types.js';
import { paintTheatre } from './theatre-layout.js';

type Point = readonly [number, number];
type Pin = { source: Point; world: Point };
type Lip = readonly [platform: string, left: number, right: number, y: number];
type ArtBand = { row: number; rise: number; lips?: readonly Lip[] };
type Shaft = { id: string; left: number; right: number; inset: number };
type Illustration = { bands: readonly ArtBand[]; shaft?: Shaft; image: HTMLImageElement; ready: Promise<void> };

function illustration(source: string, bands: readonly ArtBand[], shaft?: Shaft): Illustration {
  const image = new Image();
  image.src = source;
  return { bands, shaft, image, ready: image.decode().catch(() => {}) };
}

// Pins mark the painted upper edges in source pixels. Their destinations are
// read from the collision surfaces, including both ends of every ledge.
const scenes = new Map<string, Illustration>([
  ['dorm-roof', illustration(dormArt, [
    { row: 271, rise: 704 },
    { row: 440, rise: 362, lips: [['tank', 1215, 1442, 440]] },
    { row: 507, rise: 244, lips: [['bridge', 360, 1719, 507]] },
    { row: 573, rise: 122, lips: [['west', 128, 918, 573], ['east', 1153, 1996, 573]] },
    { row: 645, rise: 0 }
  ])],
  // The painted stands are already registered to the arena on a 16:9 master.
  ['night-court', illustration(courtArt, [])],
  ['harbor', illustration(harborArt, [
    { row: 184, rise: 730 },
    { row: 294, rise: 456 },
    { row: 399, rise: 386, lips: [['west-gallery', 248, 726, 399], ['east-gallery', 1373, 1831, 399]] },
    { row: 473, rise: 256, lips: [['gangway', 381, 1698, 473]] },
    { row: 540, rise: 128, lips: [['loading', 155, 896, 540], ['east-loading', 1189, 1936, 540]] },
    { row: 611, rise: 0 }
  ])],
  ['star-station', illustration(stationArt, [
    { row: 193, rise: 770 },
    { row: 292, rise: 600 },
    { row: 341, rise: 510, lips: [['coil-left', 447, 882, 341], ['coil-right', 1197, 1631, 341]] },
    { row: 406, rise: 382, lips: [['upper-left', 289, 800, 406], ['upper-right', 1278, 1792, 406]] },
    { row: 475, rise: 254, lips: [['relay-left', 449, 979, 475], ['relay-right', 1100, 1631, 475]] },
    { row: 547, rise: 126, lips: [['dock-left', 376, 979, 547], ['dock-right', 1100, 1707, 547]] },
    { row: 620, rise: 0 }
  ], { id: 'service-lift', left: 986, right: 1093, inset: 18 })],
  ['broadcast-ring', illustration(broadcastArt, [])]
]);

const sceneCache = new Map<ArenaDefinition, HTMLCanvasElement>();

export async function prepareArenaArt() {
  await Promise.all([...scenes.values()].map(({ image }) => {
    image.fetchPriority = 'high';
    return image.decode();
  }));
}
const mix = (a: number, b: number, t: number) => a + (b - a) * t;

function makeRow(arena: ArenaDefinition, width: number, band: ArtBand, shaft?: Shaft): Pin[] {
  const defaultY = arena.floor - band.rise;
  const points: Pin[] = [];
  for (const [id, left, right, y] of band.lips ?? []) {
    const p = arena.platforms.find(p => p.id === id)!;
    points.push({ source: [left, y], world: [p.left, p.y] }, { source: [right, y], world: [p.right, p.y] });
  }
  if (shaft) {
    const p = arena.platforms.find(p => p.id === shaft.id)!;
    points.push({ source: [shaft.left, band.row], world: [p.left + shaft.inset, defaultY] },
      { source: [shaft.right, band.row], world: [p.right - shaft.inset, defaultY] });
  }
  points.sort((a, b) => a.world[0] - b.world[0]);
  const first = points[0], last = points[points.length - 1];
  return [
    { source: [0, first?.source[1] ?? band.row], world: [0, first?.world[1] ?? defaultY] },
    ...points,
    { source: [width, last?.source[1] ?? band.row], world: [arena.width, last?.world[1] ?? defaultY] }
  ];
}

function atX(row: readonly Pin[], x: number): Pin {
  const i = row.findIndex(p => p.world[0] >= x);
  const to = row[i];
  if (to.world[0] === x) return to;
  const from = row[i - 1];
  const t = (x - from.world[0]) / (to.world[0] - from.world[0]);
  return {
    source: [mix(from.source[0], to.source[0], t), mix(from.source[1], to.source[1], t)],
    world: [x, mix(from.world[1], to.world[1], t)]
  };
}

function lockVerticalLines(rows: Pin[][]): Pin[][] {
  const byWorldX = new Map<number, number>();
  for (const row of rows) {
    for (const { source: [sourceX], world: [worldX] } of row) {
      const previous = byWorldX.get(worldX);
      if (previous !== undefined && previous !== sourceX) return rows;
      byWorldX.set(worldX, sourceX);
    }
  }
  const columns = [...byWorldX].sort((a, b) => a[0] - b[0]);
  // A single continuous horizontal registration keeps the painted posts straight
  // whenever the artwork and collision edges agree on their left-to-right order.
  if (!columns.every(([, sourceX], i) => i === 0 || sourceX > columns[i - 1][1])) return rows;
  return rows.map(row => columns.map(([worldX, sourceX]) => {
    const pin = atX(row, worldX);
    return { source: [sourceX, pin.source[1]], world: pin.world };
  }));
}

function paintTriangle(ctx: CanvasRenderingContext2D, image: HTMLImageElement, p: Pin, q: Pin, r: Pin) {
  const [sx, sy] = p.source, [dx, dy] = p.world;
  const ux = q.source[0] - sx, uy = q.source[1] - sy;
  const vx = r.source[0] - sx, vy = r.source[1] - sy;
  const wx = q.world[0] - dx, wy = q.world[1] - dy;
  const zx = r.world[0] - dx, zy = r.world[1] - dy;
  const determinant = ux * vy - uy * vx;
  const a = (wx * vy - zx * uy) / determinant;
  const b = (wy * vy - zy * uy) / determinant;
  const c = (zx * ux - wx * vx) / determinant;
  const d = (zy * ux - wy * vx) / determinant;

  ctx.save();
  // Overlap the clips slightly so filtering the cached artwork creates no grid seams.
  const centerX = (dx + q.world[0] + r.world[0]) / 3;
  const centerY = (dy + q.world[1] + r.world[1]) / 3;
  ctx.beginPath();
  for (const [i, point] of [p.world, q.world, r.world].entries()) {
    const x = point[0] - centerX;
    const y = point[1] - centerY;
    const distance = Math.hypot(x, y);
    const edgeX = point[0] + 2 * x / distance, edgeY = point[1] + 2 * y / distance;
    if (i === 0) ctx.moveTo(edgeX, edgeY);
    else ctx.lineTo(edgeX, edgeY);
  }
  ctx.closePath();
  ctx.clip();
  ctx.transform(a, b, c, d, dx - a * sx - c * sy, dy - b * sx - d * sy);
  ctx.drawImage(image, 0, 0);
  ctx.restore();
}

function registerScene(arena: ArenaDefinition, { image, bands, shaft }: Illustration) {
  const canvas = document.createElement('canvas');
  // Keep the registered stage at world resolution: the previous 75% cache
  // softened every platform and made seams more visible on close cameras.
  canvas.width = arena.width;
  canvas.height = arena.height;
  const ctx = canvas.getContext('2d', { alpha: false })!;
  ctx.scale(canvas.width / arena.width, canvas.height / arena.height);
  const rows = lockVerticalLines([
    { row: 0, rise: arena.floor },
    ...bands,
    { row: image.naturalHeight, rise: arena.floor - arena.height }
  ].map(band => makeRow(arena, image.naturalWidth, band, shaft)));

  for (let y = 1; y < rows.length; y++) {
    const top = rows[y - 1], bottom = rows[y];
    const columns = [...new Set([...top, ...bottom].map(p => p.world[0]))].sort((a, b) => a - b);
    for (let x = 1; x < columns.length; x++) {
      const left = columns[x - 1], right = columns[x];
      const tl = atX(top, left), tr = atX(top, right);
      const bl = atX(bottom, left), br = atX(bottom, right);
      paintTriangle(ctx, image, tl, tr, bl);
      paintTriangle(ctx, image, br, bl, tr);
    }
  }
  return canvas;
}

export function drawIllustratedArena(ctx: CanvasRenderingContext2D, arena: ArenaDefinition) {
  const art = scenes.get(arena.id);
  if (!art?.image.naturalWidth) return false;
  if (arena.id === 'broadcast-ring') {
    paintTheatre(ctx, art.image, arena);
    return true;
  }
  if (!art.bands.length) {
    const scale = Math.max(arena.width / art.image.naturalWidth, arena.height / art.image.naturalHeight);
    const width = art.image.naturalWidth * scale, height = art.image.naturalHeight * scale;
    ctx.drawImage(art.image, (arena.width - width) / 2, (arena.height - height) / 2, width, height);
    return true;
  }
  let scene = sceneCache.get(arena);
  if (!scene) {
    // Demo arenas can reuse an id with a different set of platforms.
    const hasPlatform = (id: string) => arena.platforms.some(p => p.id === id);
    if ((art.shaft && !hasPlatform(art.shaft.id)) ||
      art.bands.some(band => band.lips?.some(([id]) => !hasPlatform(id)))) return false;
    scene = registerScene(arena, art);
    if (sceneCache.size === 2) sceneCache.delete(sceneCache.keys().next().value!);
    sceneCache.set(arena, scene);
  }
  ctx.drawImage(scene, 0, 0, arena.width, arena.height);
  return true;
}

export function drawIllustrationPreview(ctx: CanvasRenderingContext2D, arena: ArenaDefinition) {
  const image = scenes.get(arena.id)?.image;
  if (!image?.naturalWidth) return false;
  const { width, height } = ctx.canvas;
  const scale = Math.min(width / image.naturalWidth, height / image.naturalHeight);
  const artWidth = image.naturalWidth * scale;
  const artHeight = image.naturalHeight * scale;
  ctx.fillStyle = '#111725';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(image, (width - artWidth) / 2, (height - artHeight) / 2, artWidth, artHeight);
  return true;
}

export function redrawWhenIllustrationReady(arena: ArenaDefinition, redraw: () => void) {
  const art = scenes.get(arena.id);
  if (art && !art.image.naturalWidth) void art.ready.then(redraw);
}

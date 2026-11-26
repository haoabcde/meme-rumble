import frogScenes from '../../assets/fighters/unified-handdrawn-v1/motion/frog-reference-v2/scenes.png';
import bananaActions from '../../assets/fighters/unified-handdrawn-v1/motion/banana/registered/banana-arcade-actions.webp';
import { platformAt } from '../core/terrain.js';
import type { ArenaDefinition, MatchConfig, MatchState, Platform } from '../core/types.js';
import { sprites } from './art.js';

type Theme = ArenaDefinition['theme'];
type Point = [number, number];

type Colors = {
  sky: string; haze: string; shadow: string; structure: string; face: string;
  rim: string; signal: string; paper: string; mat: string;
};

const palettes: Record<Theme, Colors> = {
  broadcast: { sky: '#1b1135', haze: '#642653', shadow: '#170f29', structure: '#362148', face: '#613161',
    rim: '#f17594', signal: '#6bddd1', paper: '#f9d8ae', mat: '#4e2e60' },
  harbor: { sky: '#4b354e', haze: '#d88a6c', shadow: '#202638', structure: '#3f4149', face: '#975543',
    rim: '#ecaa5a', signal: '#75c6b8', paper: '#f8d29d', mat: '#545063' },
  dorm: { sky: '#785a68', haze: '#e3a480', shadow: '#383241', structure: '#5b424e', face: '#ab675c',
    rim: '#e8b080', signal: '#94b7a3', paper: '#ffe2ac', mat: '#825353' },
  court: { sky: '#131c38', haze: '#324660', shadow: '#182138', structure: '#2d3a50', face: '#465672',
    rim: '#8caacb', signal: '#e4a46d', paper: '#d3e0db', mat: '#263e5a' },
  station: { sky: '#1d1e3f', haze: '#62537b', shadow: '#192039', structure: '#303952', face: '#51466c',
    rim: '#a99acb', signal: '#74cbb3', paper: '#ded4eb', mat: '#454763' }
};

function poly(ctx: CanvasRenderingContext2D, fill: string | CanvasGradient, points: Point[]) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.moveTo(...points[0]);
  for (const point of points.slice(1)) ctx.lineTo(...point);
  ctx.closePath();
  ctx.fill();
}

function bar(ctx: CanvasRenderingContext2D, fill: string, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = fill;
  ctx.fillRect(x, y, w, h);
}

function line(ctx: CanvasRenderingContext2D, color: string, width: number, points: Point[]) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(...points[0]);
  for (const point of points.slice(1)) ctx.lineTo(...point);
  ctx.stroke();
}

function disc(ctx: CanvasRenderingContext2D, fill: string, x: number, y: number, rx: number, ry = rx) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
}

function light(ctx: CanvasRenderingContext2D, color: string, x: number, y: number, spread: number, drop: number, lean = 0) {
  const glow = ctx.createLinearGradient(0, y, 0, y + drop);
  glow.addColorStop(0, color + '77');
  glow.addColorStop(.3, color + '27');
  glow.addColorStop(1, color + '00');
  poly(ctx, glow, [[x - 25, y], [x + 25, y], [x + spread + lean, y + drop], [x - spread + lean, y + drop]]);
}

function lattice(ctx: CanvasRenderingContext2D, color: string, x: number, y: number, w: number, h: number, interval: number) {
  bar(ctx, color, x, y, w, 4);
  bar(ctx, color, x, y + h - 4, w, 4);
  const count = Math.max(1, Math.round(w / interval));
  ctx.beginPath();
  for (let i = 0; i < count; i++) {
    const from = x + w * i / count;
    const to = x + w * (i + 1) / count;
    ctx.moveTo(from, y + (i % 2 ? h : 0));
    ctx.lineTo(to, y + (i % 2 ? 0 : h));
  }
  ctx.strokeStyle = color;
  ctx.lineWidth = 4;
  ctx.stroke();
}

function hatch(ctx: CanvasRenderingContext2D, ink: string, x: number, y: number, w: number, h: number, step = 24) {
  ctx.beginPath();
  for (let u = x; u + h < x + w; u += step) {
    ctx.moveTo(u, y + h);
    ctx.lineTo(u + h, y);
  }
  ctx.strokeStyle = ink;
  ctx.lineWidth = 3;
  ctx.stroke();
}

function city(ctx: CanvasRenderingContext2D, w: number, horizon: number, color: string, pitch: number, phase: number) {
  for (let i = -1; i * pitch < w; i++) {
    const x = i * pitch + phase;
    const rise = 110 + (i * i * 29 + i * 57 + 660) % 235;
    const wid = pitch * (.46 + ((i + 9) % 4) * .08);
    const y = horizon - rise;
    poly(ctx, color, [[x, horizon], [x, y + 15], [x + wid * .21, y], [x + wid * .73, y], [x + wid, y + 18], [x + wid, horizon]]);
    bar(ctx, color, x + wid * .46, y - 23, 7, 27);
    for (let row = 0; row < 5; row++) {
      for (let col = 0; col < 3; col++) {
        if ((i * 3 + row * 7 + col * 2) % 5 < 2) continue;
        bar(ctx, '#f8bc8030', x + 15 + wid * .22 * col, y + 29 + row * 22, 9, 5);
      }
    }
  }
}

function relayTower(ctx: CanvasRenderingContext2D, ink: string, x: number, y: number, h: number) {
  const top = y - h;
  line(ctx, ink, 6, [[x - 43, y], [x, top], [x + 43, y]]);
  for (let i = 0; i < 4; i++) {
    const at = top + h * (.19 + i * .14);
    const span = 18 + i * 8;
    line(ctx, ink, 4, [[x - span, at], [x + span, at]]);
    line(ctx, ink, 4, [[x - span * .6, at], [x + span * .7, at + h * .14]]);
  }
  poly(ctx, ink, [[x - 22, top + 29], [x, top - 12], [x + 22, top + 29]]);
}

const frogAudience = new Image();
frogAudience.src = frogScenes;
const bananaAudience = new Image();
bananaAudience.src = bananaActions;
const broadcastGuests = {
  host: { image: sprites.gaga, crop: [3, 3, 402, 420], alpha: .86, facing: 1 },
  frog: { image: frogAudience, crop: [529, 460, 270, 421], alpha: .63, facing: 1 },
  banana: { image: bananaAudience, crop: [475, 389, 174, 297], alpha: .64, facing: -1 }
} as const;

function broadcastGuest(ctx: CanvasRenderingContext2D, name: keyof typeof broadcastGuests,
  x: number, bottom: number, height: number) {
  const { image, crop, alpha, facing } = broadcastGuests[name];
  if (!image.naturalWidth) return;
  const [left, top, sourceWidth, sourceHeight] = crop;
  const width = height * sourceWidth / sourceHeight;
  ctx.save();
  ctx.translate(x, bottom);
  ctx.scale(facing, 1);
  ctx.globalAlpha *= alpha;
  ctx.filter = 'saturate(.68) brightness(.87)';
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(image, left, top, sourceWidth, sourceHeight, -width / 2, -height, width, height);
  ctx.restore();
}

function broadcast(ctx: CanvasRenderingContext2D, { width: w, floor }: ArenaDefinition, c: Colors) {
  for (let x = 248; x < w; x += 533) {
    poly(ctx, c.structure, [[x - 39, floor - 1050], [x + 49, floor - 1050], [x + 104, floor], [x + 27, floor]]);
    bar(ctx, c.rim + '4c', x + 40, floor - 900, 6, 548);
  }
  for (let i = 0; i < 3; i++) {
    const y = floor - 342 + i * 86;
    bar(ctx, c.shadow, 0, y, w, 64);
    bar(ctx, c.face, 0, y + 5, w, 12);
    const step = 79;
    const firstSeat = 20 + i * 19;
    const frogSeat = Math.round((w / 2 - 380 - firstSeat) / step);
    const bananaSeat = Math.round((w / 2 + 400 - firstSeat) / step);
    for (let x = firstSeat; x < w; x += step) {
      const j = Math.floor(x / step);
      if (i === 1 && j === frogSeat && frogAudience.naturalWidth) {
        line(ctx, c.signal + '8a', 5, [[x - 6, y - 29], [x - 31, y - 48]]);
        broadcastGuest(ctx, 'frog', x, y + 5, 66);
        continue;
      }
      if (i === 1 && j === bananaSeat && bananaAudience.naturalWidth) {
        broadcastGuest(ctx, 'banana', x, y + 5, 62);
        line(ctx, c.rim + 'a1', 5, [[x - 15, y - 22], [x - 32, y - 48]]);
        continue;
      }
      const head = 14 + j % 4 * 4;
      const body = (j + i) % 5 === 0 ? c.face : (j + i) % 3 === 0 ? '#435071' : '#2e2945';
      disc(ctx, body, x, y - 14, head);
      poly(ctx, body, [[x - 30, y + 4], [x - 19, y - 15], [x + 20, y - 15], [x + 30, y + 4]]);
      if ((j + i) % 3 === 0) bar(ctx, (i % 2 ? c.signal : c.rim) + '91', x - 9, y - 18, 6, 3);
    }
    for (let x = 12; x < w; x += 202) bar(ctx, (i % 2 ? c.signal : c.rim) + '71', x, y + 23, 110, 5);
  }
  bar(ctx, c.shadow, 0, floor - 558, w, 48);
  lattice(ctx, c.face, 0, floor - 550, w, 31, 101);
  for (let x = 327; x < w; x += 439) {
    bar(ctx, c.structure, x - 4, floor - 556, 8, 83);
    light(ctx, x % 3 === 0 ? c.rim : c.signal, x, floor - 462, 130, 437, 23);
    poly(ctx, c.shadow, [[x - 22, floor - 488], [x + 25, floor - 488], [x + 44, floor - 465], [x - 39, floor - 465]]);
    bar(ctx, c.paper + 'ce', x - 29, floor - 465, 58, 5);
  }
  const x = w / 2;
  const y = floor - 488;
  poly(ctx, c.shadow, [[x - 296, y + 46], [x - 248, y], [x + 295, y], [x + 295, y + 198], [x + 250, y + 239], [x - 296, y + 239]]);
  poly(ctx, '#873451', [[x - 277, y + 50], [x - 239, y + 16], [x + 277, y + 16], [x + 277, y + 190], [x + 241, y + 222], [x - 277, y + 222]]);
  poly(ctx, '#281d3d', [[x - 268, y + 56], [x - 232, y + 24], [x + 267, y + 24], [x + 267, y + 181], [x + 233, y + 210], [x - 268, y + 210]]);
  hatch(ctx, '#e56a7234', x - 221, y + 35, 480, 164, 26);
  const desk = x - 142;
  bar(ctx, '#413355', desk - 82, y + 56, 164, 127);
  hatch(ctx, '#6bddd12b', desk - 76, y + 64, 152, 91, 20);
  broadcastGuest(ctx, 'host', desk - 12, y + 180, 116);
  line(ctx, '#b48ea5', 5, [[desk + 58, y + 164], [desk + 58, y + 141], [desk + 44, y + 130]]);
  disc(ctx, '#92b8bd', desk + 41, y + 126, 9, 6);
  poly(ctx, '#211731', [[desk - 86, y + 161], [desk + 86, y + 161], [desk + 75, y + 190], [desk - 75, y + 190]]);
  bar(ctx, c.rim + 'ad', desk - 86, y + 161, 172, 5);
  for (let sy = y + 58; sy < y + 190; sy += 6) bar(ctx, '#17112b39', desk - 82, sy, 164, 2);
  disc(ctx, '#f48a87', x + 14, y + 117, 14);
  ctx.font = '900 63px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = c.paper;
  ctx.fillText('ON AIR', x + 144, y + 140);
  bar(ctx, c.structure, 0, floor - 25, w, 26);
}

function dorm(ctx: CanvasRenderingContext2D, { width: w, floor }: ArenaDefinition, c: Colors) {
  disc(ctx, '#f5bc917e', w * .54, floor - 602, 164);
  city(ctx, w, floor - 156, '#965e6b', 214, 30);
  city(ctx, w, floor - 38, '#654956', 269, 80);
  for (let x = 254; x < w; x += 750) {
    const y = floor - 396 - (x % 3) * 38;
    poly(ctx, '#705360', [[x - 87, floor], [x - 87, y + 17], [x + 38, y - 14], [x + 437, y - 14], [x + 514, y + 31], [x + 514, floor]]);
    bar(ctx, '#9b6d66', x - 67, y + 30, 499, 28);
    for (let i = 0; i < 6; i++) {
      const wx = x - 37 + i * 73;
      bar(ctx, '#4e4052', wx, y + 100, 49, 67);
      if (i % 3 !== 1) bar(ctx, '#e8b48866', wx + 6, y + 106, 35, 40);
      bar(ctx, '#573a47', wx - 4, y + 158, 57, 7);
    }
  }
  lattice(ctx, '#493849', 0, floor - 114, w, 62, 94);
  bar(ctx, '#b98c786d', 0, floor - 116, w, 6);
  for (let x = 171; x < w; x += 357) {
    const height = 74 + Math.floor(x / 357) % 4 * 23;
    for (let j = 0; j < 4; j++) {
      const y = floor - 121 - j * height * .2;
      poly(ctx, j % 2 ? '#718275' : '#506c66', [[x + 18, y + 22], [x - 34 + j * 6, y - 6],
        [x - 19 + j * 5, y - 25], [x + 16, y - 15], [x + 28 + j * 6, y - 39], [x + 53, y - 18]]);
    }
  }
}

function court(ctx: CanvasRenderingContext2D, { width: w, floor }: ArenaDefinition, c: Colors) {
  disc(ctx, '#d9eded7a', w * .53, floor - 704, 73);
  disc(ctx, '#d9eded22', w * .53, floor - 704, 106);
  city(ctx, w, floor - 103, '#31415b', 182, 55);
  city(ctx, w, floor - 20, '#26374b', 265, 14);
  for (let x = 165; x < w; x += 588) {
    const y = floor - 541 + x % 3 * 29;
    line(ctx, '#16243a', 13, [[x + 111, floor], [x, y], [x + 153, y - 37]]);
    const lean = x < w / 2 ? 105 : -105;
    light(ctx, '#b0cfe2', x + 80, y + 4, 166, floor - y, lean);
    poly(ctx, '#192944', [[x - 19, y - 20], [x + 137, y - 52], [x + 162, y - 15], [x + 4, y + 18]]);
    for (let lamp = 0; lamp < 4; lamp++) bar(ctx, '#e1e7bfba', x + lamp * 37, y - lamp * 8, 25, 11);
  }
  for (const x of [w / 2 - 355, w / 2 + 287]) {
    line(ctx, '#294253', 16, [[x, floor], [x, floor - 247], [x + 63, floor - 281]]);
    poly(ctx, '#6f99ba9a', [[x + 24, floor - 311], [x + 119, floor - 317], [x + 125, floor - 248], [x + 33, floor - 241]]);
    line(ctx, c.signal, 5, [[x + 61, floor - 244], [x + 110, floor - 249]]);
    lattice(ctx, '#7892a769', x + 67, floor - 244, 38, 25, 10);
  }
  for (let x = 0; x < w; x += 47) {
    line(ctx, '#57688338', 2, [[x, floor - 220], [x + 190, floor - 8]]);
    line(ctx, '#57688338', 2, [[x + 190, floor - 220], [x, floor - 8]]);
  }
  for (const offset of [9, 220]) bar(ctx, c.structure, 0, floor - offset, w, 5);
}

function station(ctx: CanvasRenderingContext2D, { width: w, floor }: ArenaDefinition, c: Colors) {
  const center = w / 2;
  disc(ctx, '#c3b2dc74', center, floor - 688, 106);
  hatch(ctx, '#935ead86', center - 190, floor - 645, 410, 74, 20);
  for (let layer = 0; layer < 2; layer++) {
    const points: Point[] = [[0, floor]];
    for (let i = 0; i <= 16; i++) points.push([w * i / 16, floor - 95 - (i * i * 51 + i * 23) % (231 - layer * 69) - (1 - layer) * 119]);
    points.push([w, floor]);
    poly(ctx, layer ? '#343654' : '#4b466b', points);
  }
  for (let x = 249; x < w; x += 548) {
    const h = 378 + x % 5 * 49;
    relayTower(ctx, '#32324d', x, floor - 24, h);
    line(ctx, '#393452', 6, [[x + 15, floor - h + 45], [x + 279, floor - 257], [x + 566, floor - h + 54]]);
  }
  for (const side of [-1, 1]) {
    const x = center + side * 284;
    light(ctx, c.signal, x, floor - 551, 104, 463, -side * 57);
    poly(ctx, '#343851', [[x - 113, floor], [x - 59, floor - 463], [x - 26, floor - 492], [x + 34, floor - 492], [x + 77, floor - 463], [x + 116, floor]]);
    for (let i = 0; i < 9; i++) bar(ctx, i % 3 ? '#665e825e' : c.signal + '5c', x - 47, floor - 466 + i * 45, 93, 7);
  }
}

function harbor(ctx: CanvasRenderingContext2D, { width: w, floor }: ArenaDefinition, c: Colors) {
  const ocean = floor - 235;
  disc(ctx, '#ffd69b9d', w * .55, ocean - 164, 132);
  disc(ctx, '#ffc98b32', w * .55, ocean - 164, 157);
  for (let i = 0; i < 10; i++) {
    const y = ocean - 123 + i * 13;
    poly(ctx, '#69446044', [[w * .1, y], [w * .52, y - 6], [w * .87, y - 2], [w * .68, y + 7], [w * .34, y + 7]]);
  }
  poly(ctx, '#62495c', [[0, ocean + 12], [0, ocean - 111], [w * .13, ocean - 75], [w * .19, ocean - 116],
    [w * .34, ocean - 42], [w * .61, ocean - 17], [w * .74, ocean - 68], [w * .91, ocean - 111], [w, ocean - 68], [w, ocean + 19]]);
  const water = ctx.createLinearGradient(0, ocean - 15, 0, floor);
  water.addColorStop(0, '#487981'); water.addColorStop(1, '#304f66');
  ctx.fillStyle = water; ctx.fillRect(0, ocean, w, floor - ocean);
  for (let j = 0; j < 9; j++) {
    const y = ocean + j * 24;
    for (let x = 42 + j * 75; x < w; x += 249) {
      line(ctx, j % 3 === 0 ? '#a7ae9870' : '#7db9ba45', 3 + j % 3,
        [[x, y], [x + 98, y - 5], [x + 173, y - 2]]);
    }
  }
  for (let x = 478; x < w; x += 887) {
    const y = ocean - 146 - x % 3 * 62;
    line(ctx, '#593f4e', 10, [[x, ocean - 3], [x, y], [x + 229, y - 58]]);
    line(ctx, '#593f4e', 5, [[x + 144, y - 32], [x + 144, ocean - 21]]);
    lattice(ctx, '#765260', x - 87, y + 30, 272, 26, 53);
  }
  bar(ctx, c.structure, 0, floor - 38, w, 41);
  bar(ctx, c.signal + '6a', 0, floor - 40, w, 4);
}

const backgrounds = { broadcast, dorm, court, station, harbor };
const backdrops = new Map<ArenaDefinition, HTMLCanvasElement>();
let broadcastBackdropLoad: Promise<void> | undefined = Promise.allSettled(
  Object.values(broadcastGuests).map(({ image }) => image.decode())
).then(() => {
  for (const arena of backdrops.keys()) {
    if (arena.theme === 'broadcast') backdrops.delete(arena);
  }
  broadcastBackdropLoad = undefined;
});

export function redrawWhenBackdropReady(arena: ArenaDefinition, redraw: () => void) {
  if (arena.theme === 'broadcast') void broadcastBackdropLoad?.then(redraw);
}

export function drawInkBackdrop(ctx: CanvasRenderingContext2D, arena: ArenaDefinition, viewCenter: number) {
  let image = backdrops.get(arena);
  const top = arena.floor - 1130;
  const overflow = 170;
  const c = palettes[arena.theme];
  if (!image) {
    image = document.createElement('canvas');
    image.width = arena.width + overflow * 2;
    image.height = 1135;
    const art = image.getContext('2d')!;
    art.translate(overflow, -top);
    const sky = art.createLinearGradient(0, top, 0, arena.floor);
    sky.addColorStop(0, c.sky);
    sky.addColorStop(.72, c.haze);
    sky.addColorStop(1, c.structure);
    art.fillStyle = sky;
    art.fillRect(-overflow, top, image.width, image.height);
    backgrounds[arena.theme](art, arena, c);
    const veil = art.createLinearGradient(0, top, 0, arena.floor);
    veil.addColorStop(0, '#0d122232');
    veil.addColorStop(.47, '#10132273');
    veil.addColorStop(1, '#10132288');
    art.fillStyle = veil;
    art.fillRect(-overflow, top, image.width, image.height);
    if (backdrops.size === 2) backdrops.delete(backdrops.keys().next().value!);
    backdrops.set(arena, image);
  }
  bar(ctx, c.sky, 0, 0, arena.width, top + 1);
  const drift = arena.theme === 'broadcast' ? 0 : (viewCenter - arena.width / 2) * .055;
  ctx.drawImage(image, -overflow + drift, top);
}

const truss: ReadonlySet<Platform['prop']> = new Set(['skywalk', 'laundry', 'camera-deck', 'conduit', 'catwalk', 'bridge', 'gallery', 'pallet', 'elevator']);

function platformArt(ctx: CanvasRenderingContext2D, arena: ArenaDefinition, p: Platform) {
  const c = palettes[arena.theme];
  const { left: x, y, right } = p;
  const w = right - x;
  const h = truss.has(p.prop) ? 36 : p.prop === 'scoreboard' ? 101 : Math.min(103, arena.floor - y - 4);
  const open = truss.has(p.prop);
  const moving = p.travel !== undefined;
  const fill = moving ? c.rim : c.face;
  const depth = moving ? 29 : h;
  poly(ctx, c.shadow, [[x, y], [right, y], [right, y + depth - 12],
    [right - 18, y + depth], [x + 18, y + depth], [x, y + depth - 12]]);
  poly(ctx, fill, [[x + 7, y + 10], [right - 7, y + 10], [right - 7, y + depth - 15],
    [right - 21, y + depth - 5], [x + 21, y + depth - 5], [x + 7, y + depth - 15]]);
  if (moving) return;
  if (p.prop === 'laundry') {
    lattice(ctx, c.rim + '86', x + 7, y - 41, w - 14, 31, 72);
    for (let sx = x + 23; sx < right - 54; sx += 84) {
      const tilt = sx % 3 * 5;
      poly(ctx, sx % 2 ? '#ac8b9bad' : '#a7b9a7bf', [[sx, y - 26], [sx + 57, y - 25],
        [sx + 51 + tilt, y + 6], [sx + 12, y + 13]]);
    }
  }
  if (open) {
    bar(ctx, c.shadow, x + 13, y + 11, w - 26, h - 16);
    lattice(ctx, moving ? c.rim : c.signal + 'b5', x + 14, y + 11, w - 28, h - 17, 46);
    if (!moving && p.prop !== 'laundry') lattice(ctx, c.rim + '7f', x + 7, y - 41, w - 14, 31, 64);
  } else if (p.prop === 'scoreboard') {
    bar(ctx, '#141f35', x + 15, y + 11, w - 30, h - 24);
    for (const cut of [.37, .63]) bar(ctx, c.rim + '49', x + w * cut, y + 26, 4, h - 47);
  } else if (p.prop === 'shelter' || p.prop === 'sunroom' || p.prop === 'office' || p.prop === 'press-box' || p.prop === 'control-room') {
    for (let cell = 0; cell < 4; cell++) {
      const sx = x + 26 + cell * (w - 52) / 4;
      const sw = (w - 64) / 4;
      bar(ctx, c.shadow, sx, y + 16, sw, h - 37);
      poly(ctx, c.signal + '80', [[sx + 4, y + 21], [sx + sw - 8, y + 21], [sx + sw - 17, y + h - 27], [sx + 3, y + h - 27]]);
      if (cell % 2 === 0) hatch(ctx, c.paper + '42', sx + 8, y + 25, sw - 10, h - 56, 23);
    }
  } else if (p.prop === 'inductor' || p.prop === 'water-tank') {
    const switchColor = p.prop === 'inductor' ? c.signal : c.paper;
    for (let row = 0; row < 4; row++) {
      poly(ctx, row % 2 ? c.structure : switchColor + 'c3', [[x + 14 + row * 6, y + 14 + row * 17],
        [right - 14 - row * 6, y + 14 + row * 17], [right - 29 - row * 6, y + 25 + row * 17], [x + 30 + row * 6, y + 25 + row * 17]]);
    }
  } else if (p.prop === 'bleachers' || p.prop === 'bench-seat') {
    for (let row = 0; row < 3; row++) {
      bar(ctx, c.structure, x + 16, y + 15 + 24 * row, w - 32, 16);
      for (let sx = x + 23; sx + 25 < right - 17; sx += 42) bar(ctx, c.rim + 'b5', sx, y + 15 + 24 * row, 25, 5);
    }
  } else if (p.prop === 'penthouse') {
    for (let row = 0; row < 4; row++) {
      for (let sx = x + 14 + row % 2 * 30; sx + 26 < right - 8; sx += 63) {
        bar(ctx, row % 2 ? '#d28c718e' : '#633d465f', sx, y + 15 + row * 20, 55, 14);
      }
    }
    bar(ctx, c.shadow, x + w * .64, y + 25, w * .22, h - 35);
    hatch(ctx, c.rim + '88', x + w * .65, y + 29, w * .2, h - 45, 11);
  } else if (p.prop === 'transformer') {
    for (let sx = x + 27; sx + 24 < right - 20; sx += 39) {
      bar(ctx, c.shadow, sx, y + 18, 23, h - 35);
      for (let vent = 0; vent < 4; vent++) bar(ctx, c.signal + '91', sx + 4, y + 24 + vent * 13, 14, 4);
    }
  } else if (p.prop === 'planter') {
    bar(ctx, '#596a59', x + 10, y + 12, w - 20, 26);
    for (let sx = x + 32; sx < right - 20; sx += 59) {
      poly(ctx, c.signal + 'a9', [[sx - 13, y + 40], [sx - 16, y + 17], [sx + 4, y + 21], [sx + 12, y + 13], [sx + 24, y + 37]]);
    }
  } else {
    for (let sx = x + 20; sx < right - 16; sx += 28) bar(ctx, c.rim + '75', sx, y + 13, 4, h - 27);
    if (p.prop === 'ferry' || p.prop === 'trailer') {
      poly(ctx, c.paper + 'c7', [[x + 8, y + h - 32], [right - 11, y + h - 32], [right - 30, y + h - 15], [x + 27, y + h - 15]]);
    }
  }
}

function track(ctx: CanvasRenderingContext2D, arena: ArenaDefinition, p: Platform) {
  if (!p.travel) return;
  const c = palettes[arena.theme];
  const start: Point = [(p.left + p.right) / 2, p.y + 17];
  const end: Point = [...start];
  end[p.travel.axis === 'y' ? 1 : 0] += p.travel.distance;
  ctx.save();
  line(ctx, '#101322b8', 13, [start, end]);
  ctx.setLineDash([17, 15]);
  line(ctx, c.paper + 'a3', 4, [start, end]);
  ctx.restore();
  for (const [x, y] of [start, end]) {
    disc(ctx, '#101322', x, y, 12);
    disc(ctx, '#f8cf68', x, y, 8);
    disc(ctx, '#101322', x, y, 4);
  }
}

export function drawInkScenery(ctx: CanvasRenderingContext2D, arena: ArenaDefinition) {
  for (const p of arena.platforms) if (p.travel) track(ctx, arena, p);
  for (const p of arena.platforms.filter(p => !p.travel).sort((a, b) => a.y - b.y)) platformArt(ctx, arena, p);
}

export function drawInkMechanism(ctx: CanvasRenderingContext2D, arena: ArenaDefinition, frame: number,
  state?: MatchState, config?: MatchConfig) {
  const c = palettes[arena.theme];
  for (const start of arena.platforms) {
    if (start.travel) platformArt(ctx, arena, platformAt(start, frame));
    if (start.prop !== 'scoreboard') continue;
    const w = start.right - start.left;
    const remaining = state && config && !config.training ? String(Math.ceil(state.remaining / config.rules.ticksPerSecond)).padStart(2, '0') : '– –';
    ctx.save();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = '900 48px ui-monospace, monospace';
    for (const [i, value] of [String(state?.wins[0] ?? 0), remaining, String(state?.wins[1] ?? 0)].entries()) {
      ctx.fillStyle = [c.rim, c.paper, c.signal][i];
      ctx.fillText(value, start.left + w * (.23 + i * .27), start.y + 56);
    }
    ctx.restore();
  }
}

function paintFloor(ctx: CanvasRenderingContext2D, { floor, theme, width, height, left, right }: ArenaDefinition) {
  const c = palettes[theme];
  const x = width / 2;
  const fascia = ctx.createLinearGradient(0, floor, 0, floor + 220);
  fascia.addColorStop(0, c.mat); fascia.addColorStop(.6, c.structure); fascia.addColorStop(1, c.shadow);
  ctx.fillStyle = fascia;
  ctx.fillRect(0, floor, width, height - floor);
  bar(ctx, c.shadow, 0, floor + 43, width, 14);
  if (theme === 'dorm') {
    for (let row = 0; row < 3; row++) {
      const y = floor + 12 + row * 44;
      for (let sx = -80 + row % 2 * 50; sx < width; sx += 113) {
        const shift = row * 12;
        poly(ctx, row % 2 ? '#c37a6359' : '#ca86636b', [[sx, y], [sx + 103, y], [sx + 107 + shift, y + 35], [sx - 11 + shift, y + 35]]);
        line(ctx, '#dca17b55', 2, [[sx + 11, y + 34], [sx + 91 + shift, y + 34]]);
      }
    }
  } else if (theme === 'harbor') {
    for (const y of [floor + 20, floor + 90]) {
      for (let sx = 0; sx < width; sx += 128) bar(ctx, '#874c48ad', sx + 6, y - 14, 40, 38);
      bar(ctx, c.shadow, 0, y - 5, width, 15);
      bar(ctx, c.rim + 'b9', 0, y, width, 4);
    }
    for (let sx = 138; sx < width; sx += 302) {
      poly(ctx, c.signal + '8c', [[sx, floor + 115], [sx + 123, floor + 115], [sx + 103, floor + 128], [sx - 15, floor + 128]]);
    }
  } else if (theme === 'broadcast') {
    for (let sx = x % 484 - 484; sx < width; sx += 484) {
      poly(ctx, c.face, [[sx, floor + 58], [sx + 460, floor + 58], [sx + 418, floor + 130], [sx + 23, floor + 130]]);
      poly(ctx, c.shadow, [[sx + 25, floor + 74], [sx + 239, floor + 74], [sx + 211, floor + 107], [sx + 40, floor + 107]]);
      poly(ctx, c.rim + 'af', [[sx + 258, floor + 74], [sx + 424, floor + 74], [sx + 407, floor + 84], [sx + 249, floor + 84]]);
      bar(ctx, c.signal + 'b3', sx + 48, floor + 86, 134, 5);
    }
  } else {
    for (let sx = x % 412 - 412; sx < width; sx += 412) {
      poly(ctx, c.face, [[sx + 7, floor + 59], [sx + 402, floor + 59], [sx + 352, floor + 123], [sx + 17, floor + 123]]);
      poly(ctx, c.shadow, [[sx + 20, floor + 63], [sx + 347, floor + 63], [sx + 328, floor + 105], [sx + 41, floor + 105]]);
      hatch(ctx, c.rim + '74', sx + 21, floor + 70, 298, 31);
      bar(ctx, c.signal + 'a0', sx + 155, floor + 85, 139, 5);
    }
  }
  if (theme === 'court') {
    ctx.strokeStyle = c.signal;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.ellipse(x, floor + 12, 294, 36, 0, 0, Math.PI * 2);
    ctx.stroke();
    line(ctx, c.signal + 'b8', 5, [[x, floor], [x, floor + 49]]);
  } else if (theme === 'station') {
    for (const side of [-1, 1]) {
      line(ctx, c.signal, 4, [[x + side * 33, floor + 12], [x + side * 142, floor + 12], [x + side * 163, floor + 31], [x + side * 278, floor + 31]]);
    }
    poly(ctx, c.signal, [[x, floor + 12], [x + 16, floor + 23], [x, floor + 37], [x - 16, floor + 23]]);
  } else if (theme === 'broadcast') {
    for (const side of [-1, 1]) poly(ctx, c.rim + 'b3', [[x + side * 55, floor + 13], [x + side * 258, floor + 13],
      [x + side * 287, floor + 31], [x + side * 72, floor + 31]]);
  }
  for (const end of [left, right]) {
    bar(ctx, c.shadow, end - 16, floor - 31, 32, 34);
    bar(ctx, c.rim, end - 18, floor - 30, 36, 7);
  }
}

const floors = new WeakMap<ArenaDefinition, HTMLCanvasElement>();

export function drawInkFloor(ctx: CanvasRenderingContext2D, arena: ArenaDefinition) {
  let floor = floors.get(arena);
  const top = arena.floor - 40;
  if (!floor) {
    floor = document.createElement('canvas');
    floor.width = arena.width;
    floor.height = arena.height - top;
    const art = floor.getContext('2d')!;
    art.translate(0, -top);
    paintFloor(art, arena);
    floors.set(arena, floor);
  }
  ctx.drawImage(floor, 0, top);
}

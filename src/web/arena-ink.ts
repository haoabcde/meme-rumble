import frogScenes from '../../assets/fighters/unified-handdrawn-v1/motion/frog-reference-v2/scenes.png';
import bananaActions from '../../assets/fighters/unified-handdrawn-v1/motion/banana/registered/banana-arcade-actions.webp';
import dormCampusArt from '../../assets/arenas/dorm-campus-dusk.webp';
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
    rim: '#a99acb', signal: '#74cbb3', paper: '#ded4eb', mat: '#454763' },
  ring: { sky: '#1b1135', haze: '#642653', shadow: '#170f29', structure: '#362148', face: '#613161',
    rim: '#f17594', signal: '#6bddd1', paper: '#f9d8ae', mat: '#4e2e60' }
};

const dormCampus = new Image();
dormCampus.src = dormCampusArt;
const backdropDepth = 1130;
const backdropBleed = 170;

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
  if (dormCampus.naturalWidth) {
    const sceneWidth = w + backdropBleed * 2;
    const sourceHeight = dormCampus.naturalWidth * backdropDepth / sceneWidth;
    const top = (dormCampus.naturalHeight - sourceHeight) * .50;
    ctx.drawImage(dormCampus, 0, top, dormCampus.naturalWidth, sourceHeight,
      -backdropBleed, floor - backdropDepth, sceneWidth, backdropDepth);
  } else {
    disc(ctx, '#f5bc917e', w * .54, floor - 602, 164);
    city(ctx, w, floor - 156, '#965e6b', 214, 30);
    city(ctx, w, floor - 38, '#654956', 269, 80);
  }
  lattice(ctx, '#493849', 0, floor - 114, w, 62, 94);
  bar(ctx, '#b98c786d', 0, floor - 116, w, 6);
  for (let x = 330; x < w; x += 850) {
    const y = floor - 66;
    bar(ctx, '#454450', x - 53, y, 106, 24);
    disc(ctx, '#4a645f', x - 36, y - 18, 23);
    disc(ctx, '#57746a', x, y - 27, 34);
    disc(ctx, '#4a645f', x + 39, y - 14, 23);
    disc(ctx, '#719183', x - 7, y - 43, 18);
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

const backgrounds = { broadcast, dorm, court, station, harbor, ring: broadcast };
const backdrops = new Map<ArenaDefinition, HTMLCanvasElement>();
let dormBackdropLoad: Promise<void> | undefined = dormCampus.decode().then(() => {
  for (const arena of backdrops.keys()) if (arena.theme === 'dorm') backdrops.delete(arena);
}, () => {}).then(() => { dormBackdropLoad = undefined; });
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
  if (arena.theme === 'dorm') void dormBackdropLoad?.then(redraw);
}

export function drawInkBackdrop(ctx: CanvasRenderingContext2D, arena: ArenaDefinition, viewCenter: number) {
  let image = backdrops.get(arena);
  const top = arena.floor - backdropDepth;
  const overflow = backdropBleed;
  const c = palettes[arena.theme];
  if (!image) {
    image = document.createElement('canvas');
    image.width = arena.width + overflow * 2;
    image.height = backdropDepth + 5;
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
    veil.addColorStop(0, arena.theme === 'dorm' ? '#24263d16' : '#0d122232');
    veil.addColorStop(.47, arena.theme === 'dorm' ? '#28263e33' : '#10132273');
    veil.addColorStop(1, arena.theme === 'dorm' ? '#27223855' : '#10132288');
    art.fillStyle = veil;
    art.fillRect(-overflow, top, image.width, image.height);
    if (backdrops.size === 2) backdrops.delete(backdrops.keys().next().value!);
    backdrops.set(arena, image);
  }
  bar(ctx, c.sky, 0, 0, arena.width, top + 1);
  const drift = arena.theme === 'broadcast' ? 0 : (viewCenter - arena.width / 2) * .055;
  ctx.drawImage(image, -overflow + drift, top);
}

function pilaster(ctx: CanvasRenderingContext2D, c: Colors, x: number, top: number, base: number, width: number) {
  if (base <= top + 8) return;
  bar(ctx, c.shadow, x - width / 2, top, width, base - top);
  bar(ctx, c.structure, x - width / 2 + 4, top + 3, width - 11, base - top - 3);
  bar(ctx, c.rim + '56', x - width / 2 + 5, top + 4, 4, base - top - 7);
  bar(ctx, c.shadow, x - width / 2 - 7, base - 9, width + 14, 9);
}

function eave(ctx: CanvasRenderingContext2D, p: Platform, cap: string, shade: string, depth = 16) {
  const { left, right, y } = p;
  poly(ctx, shade, [[left, y], [right, y], [right - 8, y + depth],
    [left + 8, y + depth]]);
  bar(ctx, cap, left, y, right - left, 4);
  bar(ctx, cap + '64', left + 7, y + 6, right - left - 14, 3);
}

function windows(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number,
  frame: string, glass: string, warm: string) {
  const count = Math.max(1, Math.round(width / 114));
  const bay = width / count;
  for (let i = 0; i < count; i++) {
    const left = x + i * bay;
    bar(ctx, frame, left, y, bay - 14, height);
    bar(ctx, i % 4 === 1 ? warm : glass, left + 4, y + 4, bay - 23, height - 8);
    line(ctx, '#ffecd233', 3, [[left + 13, y + height - 12], [left + 37, y + 10]]);
    bar(ctx, frame, left + (bay - 14) / 2, y + 2, 4, height - 4);
  }
}

function dormArchitecture(ctx: CanvasRenderingContext2D, arena: ArenaDefinition) {
  const c = palettes.dorm;
  const bridge = arena.platforms.find(p => p.prop === 'skywalk')!;
  const tank = arena.platforms.find(p => p.prop === 'water-tank')!;
  const buildings = arena.platforms.filter(p => p.tier === 1);
  const floor = arena.floor;

  // The beams and arch springings belong to the same roof line as the walkable corridor.
  const span = bridge.right - bridge.left;
  const bayCount = 9;
  const bay = span / bayCount;
  for (let i = 0; i <= bayCount; i++) {
    const pier = bridge.left + i * bay;
    const footing = buildings.find(p => pier > p.left + 22 && pier < p.right - 22)?.y ?? floor;
    pilaster(ctx, c, pier, bridge.y + 10, footing, 37);
  }
  for (let i = 0; i < bayCount; i++) {
    const left = bridge.left + i * bay;
    const y = bridge.y;
    ctx.fillStyle = '#78546b';
    ctx.beginPath();
    ctx.moveTo(left, y + 13);
    ctx.lineTo(left + bay, y + 13);
    ctx.lineTo(left + bay, y + 88);
    ctx.bezierCurveTo(left + bay * .77, y + 32, left + bay * .23, y + 32, left, y + 88);
    ctx.closePath();
    ctx.fill();
    bar(ctx, '#ac7780', left + 19, y + 24, bay - 38, 10);
  }
  for (const p of buildings) {
    const { left, right, y } = p;
    const w = right - left;
    bar(ctx, '#533b51', left + 9, y + 9, w - 18, floor - y - 9);
    bar(ctx, '#9c6670', left + 14, y + 18, w - 28, floor - y - 18);
    if (p.prop === 'sunroom') {
      windows(ctx, left + 29, y + 25, w - 44, floor - y - 37, '#3c465b', '#557577', '#ae8f6d');
    } else if (p.prop === 'penthouse') {
      windows(ctx, left + 34, y + 35, w - 50, 49, '#574259', '#715a73', '#be8769');
      bar(ctx, '#745265', left + 22, floor - 20, w - 44, 6);
    } else {
      for (let x = left + 40; x < right - 35; x += 88) {
        disc(ctx, '#546d69', x, y + 40, 31, 17);
        disc(ctx, '#718779', x - 7, y + 34, 19, 13);
      }
      bar(ctx, '#a37b72', left + 18, y + 50, w - 36, 17);
      bar(ctx, '#75556a', left + 18, y + 85, w - 36, 5);
    }
    bar(ctx, '#514258', left - 4, floor - 8, w + 8, 8);
    eave(ctx, p, '#ebcaa1', '#755060', 20);
  }
  eave(ctx, bridge, '#ebc69f', '#704c63', 22);

  const { left, right, y } = tank;
  for (const leg of [left + 61, right - 61]) pilaster(ctx, c, leg, y + 54, bridge.y, 35);
  const tankWidth = right - left;
  ctx.fillStyle = '#354553';
  ctx.beginPath();
  ctx.roundRect(left + 15, y + 5, tankWidth - 30, 82, 28);
  ctx.fill();
  ctx.fillStyle = '#507476';
  ctx.beginPath();
  ctx.roundRect(left + 21, y + 10, tankWidth - 42, 62, 22);
  ctx.fill();
  bar(ctx, '#88a098', left + 73, y + 26, tankWidth - 146, 8);
  for (const seam of [left + 78, right - 79]) {
    bar(ctx, '#334b58', seam, y + 16, 10, 66);
    bar(ctx, '#799491', seam + 2, y + 22, 3, 51);
  }
  line(ctx, '#543f56', 14, [[right - 52, y + 64], [right - 28, y + 64], [right - 28, bridge.y]]);
  eave(ctx, tank, '#ead2a9', '#445b66');
}

function courtArchitecture(ctx: CanvasRenderingContext2D, arena: ArenaDefinition) {
  const c = palettes.court;
  const score = arena.platforms.find(p => p.prop === 'scoreboard')!;
  for (const x of [score.left + 124, score.right - 124]) {
    pilaster(ctx, c, x, score.y + 35, arena.floor, 58);
    line(ctx, c.structure, 17, [[x, score.y + 177], [x < arena.width / 2 ? x + 95 : x - 95, score.y + 95]]);
  }
  for (const p of arena.platforms.filter(p => p !== score)) {
    const { left, right, y } = p;
    const bleachers = p.prop === 'bleachers';
    const body = bleachers ? 75 : 46;
    const rise = arena.floor - y;
    for (let x = left + 58; x < right - 24; x += bleachers ? 128 : 210) {
      pilaster(ctx, c, x, y + body - 8, arena.floor, bleachers ? 50 : 24);
    }
    poly(ctx, bleachers ? '#344c67' : '#536172',
      [[left + 8, y], [right - 8, y], [right - 22, y + body], [left + 22, y + body]]);
    if (bleachers) {
      for (let row = 0; row < 3; row++) {
        const rowY = y + 19 + row * 18;
        bar(ctx, '#17283e', left + 20 + row * 9, rowY + 8, right - left - 40 - row * 18, 7);
        for (let x = left + 27 + row * 9; x < right - 51 - row * 9; x += 48) {
          bar(ctx, row % 2 ? '#6b8fa5' : '#4d7d9a', x, rowY, 36, 9);
        }
      }
      for (const x of [left + 91, right - 92]) line(ctx, '#22344c', 11, [[x, y + 26], [x, y + rise]]);
    } else {
      bar(ctx, '#818789', left + 18, y + 16, right - left - 36, 9);
    }
    eave(ctx, p, '#b3c4cb', bleachers ? '#335574' : '#697984', 14);
  }

  const { left, right, y } = score;
  poly(ctx, '#465975', [[left, y], [right, y], [right - 15, y + 90],
    [right - 38, y + 109], [left + 38, y + 109], [left + 15, y + 90]]);
  bar(ctx, '#101e34', left + 24, y + 16, right - left - 48, 77);
  for (const x of [left + (right - left) * .365, left + (right - left) * .635]) {
    bar(ctx, '#506779', x, y + 26, 4, 53);
  }
  eave(ctx, score, '#cad5dc', '#536883', 14);
}

function harborArchitecture(ctx: CanvasRenderingContext2D, arena: ArenaDefinition) {
  const c = palettes.harbor;
  const galleries = arena.platforms.filter(p => p.prop === 'gallery');
  const crane = arena.platforms.find(p => p.travel)!;
  const railY = crane.y - 104;
  const start = galleries[0].left + 170;
  const end = galleries[1].right - 170;
  for (const tower of galleries) {
    const column = tower.left === galleries[0].left ? tower.right - 154 : tower.left + 154;
    for (const x of [column - 69, column + 69]) pilaster(ctx, c, x, railY - 9, arena.floor, 35);
    lattice(ctx, '#755560', column - 69, railY + 29, 138, arena.floor - railY - 35, 46);
    const outside = tower.left === galleries[0].left ? tower.left + 121 : tower.right - 121;
    pilaster(ctx, c, outside, tower.y + 26, arena.floor, 47);
    line(ctx, '#6c5363', 18, [[outside, tower.y + 118], [outside + Math.sign(column - outside) * 76, tower.y + 32]]);
  }
  bar(ctx, '#423348', start, railY - 17, end - start, 55);
  lattice(ctx, '#9c6a62', start + 13, railY - 9, end - start - 26, 36, 134);
  bar(ctx, '#c29a7a', start, railY - 17, end - start, 4);

  for (const p of arena.platforms.filter(p => !p.travel).sort((a, b) => a.y - b.y)) {
    const { left, right, y } = p;
    const width = right - left;
    if (p.prop === 'ferry') {
      poly(ctx, '#574650', [[left + 32, y + 16], [right - 24, y + 16],
        [right - 24, arena.floor - 25], [left + 109, arena.floor - 25]]);
      windows(ctx, left + 63, y + 37, width - 115, 36, '#594450', '#687889', '#ab886d');
      poly(ctx, '#325465', [[left - 13, arena.floor - 26], [right + 22, arena.floor - 26],
        [right - 40, arena.floor - 4], [left + 77, arena.floor - 4]]);
      eave(ctx, p, '#d2bca4', '#846468', 23);
    } else if (p.prop === 'container' || p.prop === 'trailer') {
      const panel = p.prop === 'container' ? '#8c6158' : '#57727a';
      bar(ctx, '#493d50', left + 8, y + 8, width - 16, arena.floor - y - 8);
      bar(ctx, panel, left + 14, y + 20, width - 28, arena.floor - y - 28);
      for (let rib = left + 37; rib < right - 26; rib += 39) {
        bar(ctx, '#39384a66', rib, y + 24, 6, arena.floor - y - 41);
      }
      eave(ctx, p, '#c9ad8e', '#654955', 18);
    } else if (p.prop === 'bridge') {
      for (const x of [left + 86, right - 86]) pilaster(ctx, c, x, y + 41, arena.floor - 24, 24);
      poly(ctx, '#325869', [[left, y + 5], [right, y + 5],
        [right - 28, y + 55], [left + 28, y + 55]]);
      for (let x = left + 75; x < right - 37; x += 125) {
        disc(ctx, '#212e43', x, y + 37, 16);
        disc(ctx, '#687b76', x, y + 37, 8);
      }
      eave(ctx, p, '#abc6bb', '#517983', 18);
    } else {
      const upper = p.prop === 'gallery';
      if (!upper) {
        for (const x of [left + 83, right - 112]) pilaster(ctx, c, x, y + 8, arena.floor, 39);
      }
      bar(ctx, '#3e4154', left + 10, y + 10, width - 20, upper ? 37 : 48);
      lattice(ctx, '#917375', left + 17, y + 17, width - 34, upper ? 25 : 34, 105);
      eave(ctx, p, '#ddba91', '#674e5e', 17);
    }
  }
}

function stationArchitecture(ctx: CanvasRenderingContext2D, arena: ArenaDefinition) {
  const c = palettes.station;
  for (const route of arena.routes) {
    const [dock, conduit, room, coil] = route.map(id => arena.platforms.find(p => p.id === id)!);
    const x = (Math.max(dock.left, conduit.left, room.left, coil.left) +
      Math.min(dock.right, conduit.right, room.right, coil.right)) / 2;
    const base = arena.floor;
    poly(ctx, '#33334d', [[x - 83, coil.y + 24], [x + 83, coil.y + 24],
      [x + 153, base], [x - 153, base]]);
    for (const off of [-55, 55]) {
      line(ctx, '#53687e', 13, [[x + off, coil.y + 47], [x + off, base - 12]]);
      line(ctx, '#71949b81', 3, [[x + off - 3, coil.y + 50], [x + off - 3, base - 15]]);
    }

    const crown = coil.right - coil.left;
    poly(ctx, '#39485f', [[coil.left + 10, coil.y], [coil.right - 10, coil.y], [coil.right - 67, coil.y + 58],
      [x + 84, room.y], [x - 84, room.y], [coil.left + 67, coil.y + 58]]);
    bar(ctx, '#558983', coil.left + 26, coil.y + 22, crown - 52, 10);
    bar(ctx, '#76aba0', coil.left + 44, coil.y + 40, crown - 88, 8);
    eave(ctx, coil, '#bacbd8', '#4d6379', 17);

    for (const column of [room.left + 96, room.right - 72]) {
      const footing = column >= conduit.left && column <= conduit.right ? conduit.y : base;
      pilaster(ctx, c, column, room.y + 47, footing, 41);
    }
    bar(ctx, '#4a4a68', room.left + 11, room.y + 8, room.right - room.left - 22, 87);
    windows(ctx, room.left + 37, room.y + 26, room.right - room.left - 60, 43, '#32374e', '#57818e', '#ae907a');
    eave(ctx, room, '#b5c2d5', '#4b5371');

    for (const column of [conduit.left + 67, conduit.right - 82]) {
      const footing = column >= dock.left && column <= dock.right ? dock.y : base;
      pilaster(ctx, c, column, conduit.y + 24, footing, 35);
    }
    bar(ctx, '#394759', conduit.left + 8, conduit.y + 10, conduit.right - conduit.left - 16, 35);
    line(ctx, '#507688', 12, [[conduit.left + 21, conduit.y + 15], [conduit.left + 61, conduit.y + 56],
      [conduit.right - 62, conduit.y + 56], [conduit.right - 21, conduit.y + 15]]);
    eave(ctx, conduit, '#afd0d5', '#486779');

    bar(ctx, '#454b66', dock.left + 10, dock.y + 11, dock.right - dock.left - 20, base - dock.y - 11);
    for (let vent = dock.left + 45; vent + 28 < dock.right - 32; vent += 48) {
      bar(ctx, '#2e4056', vent, dock.y + 28, 24, 67);
      bar(ctx, '#719b9f', vent + 5, dock.y + 32, 5, 56);
    }
    eave(ctx, dock, '#a5c8cd', '#526c7c');
  }

  const lift = arena.platforms.find(p => p.travel)!;
  const top = lift.y + lift.travel!.distance - 80;
  for (const x of [lift.left + 18, lift.right - 18]) {
    pilaster(ctx, c, x, top, arena.floor, 24);
    bar(ctx, '#777389', x - 4, top, 7, arena.floor - top - 10);
  }
  bar(ctx, '#4f536a', lift.left - 2, top - 13, lift.right - lift.left + 4, 27);
  disc(ctx, '#c2a374', (lift.left + lift.right) / 2, top, 13);
}

const architecture = { dorm: dormArchitecture, court: courtArchitecture, harbor: harborArchitecture, station: stationArchitecture };

export function drawInkScenery(ctx: CanvasRenderingContext2D, arena: ArenaDefinition) {
  if (!arena.platforms.length || arena.theme === 'broadcast' || arena.theme === 'ring') return;
  // Paint the fixed surfaces together with the buildings that carry them.
  architecture[arena.theme](ctx, arena);
}

function drawTravelingDeck(ctx: CanvasRenderingContext2D, start: Platform, frame: number) {
  const p = platformAt(start, frame);
  const { left, right, y } = p;
  const vertical = start.travel?.axis === 'y';
  const pulley = (left + right) / 2;
  if (vertical) {
    line(ctx, '#70768c', 5, [[pulley, start.y + start.travel!.distance - 80], [pulley, y + 8]]);
  } else {
    const rail = start.y - 104;
    bar(ctx, '#493747', pulley - 37, rail + 20, 74, 24);
    for (const offset of [-26, 26]) {
      disc(ctx, '#e4ae78', pulley + offset, rail + 32, 8);
      line(ctx, '#5d414d', 5, [[pulley + offset, rail + 38], [pulley + offset * 4, y + 6]]);
    }
  }
  poly(ctx, vertical ? '#404961' : '#6d4b52',
    [[left, y], [right, y], [right - 16, y + 33], [left + 16, y + 33]]);
}

export function drawInkMechanism(ctx: CanvasRenderingContext2D, arena: ArenaDefinition, frame: number,
  state?: MatchState, config?: MatchConfig) {
  const c = palettes[arena.theme];
  for (const start of arena.platforms) {
    if (start.travel) drawTravelingDeck(ctx, start, frame);
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
    bar(ctx, '#817986', 0, floor + 7, width, 41);
    bar(ctx, '#aaa0aa', 0, floor + 46, width, 4);
    bar(ctx, '#423e50', 0, floor + 50, width, 14);
    bar(ctx, '#635867', 0, floor + 64, width, 55);
    bar(ctx, '#514757', 0, floor + 119, width, 7);
    for (let seam = 325; seam < width; seam += 675) {
      line(ctx, '#5c5869', 3, [[seam, floor + 10], [seam + 16, floor + 44]]);
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

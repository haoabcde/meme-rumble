import { platformAt } from '../core/terrain.js';
import type { ArenaDefinition, MatchConfig, MatchState, Platform } from '../core/types.js';
import { backgrounds, stageKits } from './art.js';

type CampusTheme = Exclude<ArenaDefinition['theme'], 'harbor' | 'ring'>;
type Prop = NonNullable<Platform['prop']>;
interface Sprite {
  box: [number, number, number, number];
  lip: [number, number, number];
  posts: number[];
}

// Broadcast pieces use their native 1536px atlas; the shared painter uses a 900px reference.
function broadcastPiece(box: Sprite['box'], lip: Sprite['lip'], posts: number[]): Sprite {
  const scale = 900 / 1536;
  return { box: box.map(n => n * scale) as Sprite['box'],
    lip: lip.map(n => n * scale) as Sprite['lip'], posts: posts.map(n => n * scale) };
}
// Coordinates in the 900 by 600 reference view of each high-resolution sheet.
const pieces: Partial<Record<Prop, Sprite>> = {
  planter:       { box: [18, 54, 422, 131], lip: [22, 435, 103], posts: [57, 384] },
  sunroom:       { box: [468, 34, 414, 151], lip: [471, 877, 43], posts: [495, 848] },
  skywalk:       { box: [14, 226, 427, 151], lip: [19, 435, 246], posts: [51, 411] },
  penthouse:     { box: [459, 235, 426, 140], lip: [464, 880, 244], posts: [487, 854] },
  'water-tank':  { box: [16, 409, 420, 175], lip: [34, 405, 447], posts: [65, 364] },
  laundry:       { box: [459, 397, 428, 189], lip: [464, 881, 487], posts: [480, 862] },
  'bench-seat':  { box: [18, 82, 415, 119], lip: [23, 426, 137], posts: [45, 401] },
  shelter:       { box: [472, 44, 404, 154], lip: [479, 869, 52], posts: [495, 846] },
  bleachers:     { box: [7, 234, 436, 148], lip: [17, 433, 265], posts: [26, 145, 303, 422] },
  'press-box':   { box: [463, 239, 425, 139], lip: [468, 882, 249], posts: [486, 862] },
  scoreboard:    { box: [5, 434, 440, 130], lip: [9, 439, 445], posts: [] },
  'camera-deck': { box: [471, 400, 407, 188], lip: [480, 868, 487], posts: [497, 848] },
  transformer:   { box: [8, 25, 446, 167], lip: [30, 432, 35], posts: [64, 398] },
  'control-room':{ box: [477, 16, 414, 184], lip: [483, 884, 26], posts: [536, 832] },
  conduit:       { box: [8, 249, 499, 148], lip: [23, 493, 284], posts: [30, 480] },
  inductor:      { box: [530, 215, 313, 189], lip: [535, 837, 253], posts: [659, 712] },
  elevator:      { box: [21, 431, 422, 152], lip: [28, 435, 524], posts: [] },
  stair:         { box: [484, 424, 394, 162], lip: [490, 727, 487], posts: [509, 704] },
  'audience-step': broadcastPiece([48,184,686,106], [62,718,209], [83,700]),
  'audience-deck': broadcastPiece([791,95,712,206], [805,1489,119], [818,1474]),
  'broadcast-booth': broadcastPiece([38,386,696,236], [51,719,405], [72,694]),
  'lighting-bridge': broadcastPiece([784,393,727,200], [799,1496,406], [817,1479]),
  'led-screen': broadcastPiece([38,686,696,319], [57,715,699], [158,607]),
  'show-lift': broadcastPiece([803,682,686,298], [885,1411,911], [])
};
const tones = {
  dorm: { sky: '#8e7b99', haze: '#c29296', edge: '#634c51', post: '#695b58', trim: '#a08c79', horizon: 578, feet: 624, parallax: .2 },
  court: { sky: '#0c1e38', haze: '#20375b', edge: '#22283c', post: '#364154', trim: '#687182', horizon: 611, feet: 658, parallax: 0 },
  station: { sky: '#393662', haze: '#68558c', edge: '#38384c', post: '#3c4056', trim: '#787b93', horizon: 615, feet: 648, parallax: .32 },
  broadcast: { sky: '#140b2b', haze: '#392351', edge: '#21183b', post: '#38235e', trim: '#a562d0', horizon: 740, feet: 790, parallax: .08 }
};

export function drawStageBackdrop(ctx: CanvasRenderingContext2D, arena: ArenaDefinition, center: number, overview = false) {
  const { floor, width, height } = arena;
  const style = tones[arena.theme as CampusTheme];
  const img = backgrounds[arena.theme];
  ctx.fillStyle = style.sky;
  ctx.fillRect(0, 0, width, height);
  if (!img.naturalWidth) return;
  if (arena.theme === 'broadcast') {
    // The physical floor meets the mat's front lip. Crowd, rails and screen stay behind the fight.
    const imageWidth = overview ? width : 1000;
    const scale = imageWidth / img.naturalWidth;
    const top = floor - 830 * scale;
    const imageHeight = img.naturalHeight * scale;
    const x = (width - imageWidth) / 2 + (center - width / 2) * style.parallax;
    const sourceWing = img.naturalWidth / 4;
    const wing = imageWidth / 4;
    const paintWing = (sourceX: number, left: number, mirrored: boolean) => {
      ctx.save();
      ctx.translate(left + (mirrored ? wing : 0), top);
      if (mirrored) ctx.scale(-1, 1);
      ctx.drawImage(img, sourceX, 0, sourceWing, img.naturalHeight, 0, 0, wing, imageHeight);
      ctx.restore();
    };
    let mirrored = true;
    for (let left = x - wing; left > -wing; left -= wing) {
      paintWing(0, left, mirrored);
      mirrored = !mirrored;
    }
    mirrored = true;
    for (let right = x + imageWidth; right < width; right += wing) {
      paintWing(img.naturalWidth * .75, right, mirrored);
      mirrored = !mirrored;
    }
    ctx.drawImage(img, x, top, imageWidth, imageHeight);
    const edge = top + imageHeight;
    ctx.fillStyle = style.edge;
    ctx.fillRect(0, edge, width, height - edge);
    return;
  }
  const scale = width / img.naturalWidth;
  const top = floor - style.feet * scale;
  const seam = top + style.horizon * scale;
  const offset = (center - width / 2) * style.parallax;
  ctx.drawImage(img, 0, 0, img.naturalWidth, style.horizon, offset, top, width, seam - top);
  ctx.drawImage(img, 0, style.horizon, img.naturalWidth, img.naturalHeight - style.horizon,
    0, seam, width, (img.naturalHeight - style.horizon) * scale);
  const gradient = ctx.createLinearGradient(0, 0, 0, top + 180);
  gradient.addColorStop(0, style.sky);
  gradient.addColorStop(Math.max(0, Math.min(1, top / (top + 180))), style.haze);
  gradient.addColorStop(1, style.haze + '00');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, top + 180);
  const edge = top + img.naturalHeight * scale;
  ctx.fillStyle = style.edge;
  ctx.fillRect(0, edge, width, height - edge);
}

function supportHeight(arena: ArenaDefinition, p: Platform, x: number) {
  return arena.platforms.reduce((below, other) => !other.travel && other.y >= p.y + 70 &&
    x >= other.left && x <= other.right ? Math.min(below, other.y) : below, arena.floor);
}

function drawPiece(ctx: CanvasRenderingContext2D, arena: ArenaDefinition, p: Platform) {
  const sprite = p.prop && pieces[p.prop];
  const atlas = stageKits[arena.theme];
  if (!sprite || !atlas?.naturalWidth) return;
  const [sx, sy, sw, sh] = sprite.box;
  const [l, r, lip] = sprite.lip;
  const scale = (p.right - p.left) / (r - l);
  const x = (u: number) => p.left + (u - l) * scale;
  const anchors = sprite.posts.map(u => ({ x: x(u), y: supportHeight(arena, p, x(u)) }));
  const bottom = sy + sh - lip;
  const available = Math.min(arena.floor, ...anchors.map(a => a.y)) - p.y;
  const depth = anchors.length ? Math.min(available / bottom, scale * 1.34) : scale;
  const bodyEnd = p.y + bottom * depth;
  const tone = tones[arena.theme as CampusTheme];
  const thickness = p.prop === 'inductor' ? 27 : Math.max(9, Math.min(23, 16 * scale));
  if (p.prop === 'water-tank') {
    // A steel saddle spans the two roofs. Its feet leave the courtyard below clear.
    const [west, east] = anchors;
    ctx.fillStyle = '#534d4b';
    ctx.fillRect(west.x - 11, bodyEnd - 9, east.x - west.x + 22, 9);
    ctx.fillStyle = '#9a816b';
    ctx.fillRect(west.x - 12, bodyEnd - 3, east.x - west.x + 24, 3);
  }
  for (const anchor of anchors) {
    if (anchor.y <= bodyEnd + 1) continue;
    if (p.prop === 'press-box' && anchor.y === arena.floor) {
      // The booth cantilevers out from the grandstand. Keep the center circle open on both sides.
      const stands = anchors.find(a => a.y < arena.floor);
      if (stands) {
        const inner = anchor.x + (stands.x - anchor.x) * .22;
        const outer = anchor.x + (stands.x - anchor.x) * .85;
        ctx.strokeStyle = tone.post;
        ctx.lineWidth = 7;
        ctx.beginPath();
        ctx.moveTo(inner, bodyEnd - 5);
        ctx.lineTo(outer, bodyEnd + 42);
        ctx.lineTo(outer, bodyEnd - 5);
        ctx.stroke();
        continue;
      }
    }
    ctx.fillStyle = tone.post;
    ctx.fillRect(anchor.x - thickness / 2, bodyEnd - 8, thickness, anchor.y - bodyEnd + 8);
    ctx.fillStyle = tone.trim;
    ctx.fillRect(anchor.x - thickness / 2 + 2, bodyEnd - 7, 2, anchor.y - bodyEnd + 7);
    ctx.fillRect(anchor.x - thickness / 2 - 3, anchor.y - 5, thickness + 6, 5);
  }
  const factor = atlas.naturalWidth / 900;
  ctx.drawImage(atlas, sx * factor, sy * factor, sw * factor, sh * factor,
    x(sx), p.y + (sy - lip) * depth, sw * scale, sh * depth);
}

function scoreboardRig(ctx: CanvasRenderingContext2D, arena: ArenaDefinition, p: Platform) {
  const cap = arena.floor - 738;
  const masts = [p.left - 248, p.right + 248];
  ctx.strokeStyle = '#546375';
  ctx.lineWidth = 7;
  ctx.beginPath();
  for (const x of masts) { ctx.moveTo(x, cap); ctx.lineTo(x, arena.floor - 46); }
  ctx.stroke();
  ctx.strokeStyle = '#647281';
  ctx.lineWidth = 4;
  ctx.beginPath();
  for (const [i, x] of masts.entries()) {
    ctx.moveTo(x, cap + 3);
    ctx.lineTo(i ? p.right - 29 : p.left + 29, p.y + 12);
    ctx.moveTo(x, cap + 30);
    ctx.lineTo(i ? p.right - 48 : p.left + 48, p.y + 12);
  }
  ctx.stroke();
  for (const [i, x] of masts.entries()) {
    ctx.fillStyle = '#303e51'; ctx.fillRect(x - 16, cap - 10, 32, 14);
    ctx.fillStyle = i ? '#f0b777' : '#8edcf2'; ctx.fillRect(x - 12, cap - 10, 24, 6);
  }
}

function liftShaft(ctx: CanvasRenderingContext2D, arena: ArenaDefinition, p: Platform) {
  const top = arena.floor - 642;
  for (const x of [p.left + 12, p.right - 12]) {
    ctx.fillStyle = '#414456'; ctx.fillRect(x - 5, top, 10, arena.floor - top);
    ctx.fillStyle = '#858597'; ctx.fillRect(x - 2, top, 2, arena.floor - top);
    ctx.fillStyle = '#384153'; ctx.fillRect(x - 12, arena.floor - 9, 24, 9);
    for (let y = top + 75; y < arena.floor - 15; y += 93) {
      ctx.fillStyle = '#76818f'; ctx.fillRect(x - 7, y, 14, 3);
    }
  }
  ctx.fillStyle = '#444859'; ctx.fillRect(p.left, top - 9, p.right - p.left, 12);
  ctx.fillStyle = '#9b8975'; ctx.fillRect(p.left + 6, top - 9, p.right - p.left - 12, 3);
}

export function drawStageScenery(ctx: CanvasRenderingContext2D, arena: ArenaDefinition) {
  const board = arena.platforms.find(p => p.prop === 'scoreboard');
  if (board) scoreboardRig(ctx, arena, board);
  const lift = arena.platforms.find(p => p.prop === 'elevator');
  if (lift) liftShaft(ctx, arena, lift);
  const fixed = arena.platforms.filter(p => !p.travel).sort((a, b) => a.y - b.y);
  for (const p of fixed) drawPiece(ctx, arena, p);
}

function boardDisplay(ctx: CanvasRenderingContext2D, p: Platform, state?: MatchState, config?: MatchConfig) {
  const w = p.right - p.left;
  const y = p.y + w * .139;
  const seconds = state && config && !config.training
    ? String(Math.ceil(state.remaining / config.rules.ticksPerSecond)).padStart(2, '0') : '– –';
  ctx.save();
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = 'bold ' + Math.round(w * .108) + 'px ui-monospace, monospace';
  const scores = [String(state?.wins[0] ?? 0), seconds, String(state?.wins[1] ?? 0)];
  for (const [i, value] of scores.entries()) {
    ctx.fillStyle = ['#7eddf4', '#ffca70', '#ff9d98'][i];
    ctx.fillText(value, p.left + w * (.24 + i * .26), y);
  }
  ctx.restore();
}

export function drawStageMechanism(ctx: CanvasRenderingContext2D, arena: ArenaDefinition, frame: number,
  state?: MatchState, config?: MatchConfig) {
  const board = arena.platforms.find(p => p.prop === 'scoreboard');
  if (board) boardDisplay(ctx, board, state, config);
  const lift = arena.platforms.find(p => p.prop === 'elevator');
  if (!lift) {
    const showLift = arena.platforms.find(p => p.prop === 'show-lift');
    if (showLift) drawPiece(ctx, arena, platformAt(showLift, frame));
    return;
  }
  const p = platformAt(lift, frame);
  const shaft = arena.floor - 642;
  ctx.fillStyle = '#383948';
  for (const x of [p.left + 23, p.right - 23]) ctx.fillRect(x, shaft, 3, p.y - shaft);
  const weight = shaft + 41 + lift.y - p.y;
  ctx.fillStyle = '#535667'; ctx.fillRect(p.left - 7, weight, 17, 55);
  ctx.fillStyle = '#c68a58'; ctx.fillRect(p.left - 5, weight + 10, 13, 6);
  drawPiece(ctx, arena, p);
}

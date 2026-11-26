import type { ArenaDefinition } from '../core/types.js';
import { backgrounds, ringPerformers } from './art.js';

// Each exposure selects a separately drawn cel and holds it for this many game ticks.
type Exposure = readonly [column: number, duration: number];
const speech: Exposure[] = [[0, 23], [1, 6], [2, 9], [3, 7], [0, 6], [1, 8], [2, 16], [3, 9], [0, 18]];
const wave: Exposure[] = [[0, 22], [1, 7], [2, 16], [3, 7], [1, 5], [2, 10], [3, 8], [0, 16]];
const vote: Exposure[] = [[0, 42], [1, 9], [2, 48], [3, 11], [0, 24]];
const clap: Exposure[] = [[0, 14], [1, 6], [2, 5], [3, 8], [1, 5], [2, 5], [3, 17]];

function columnAt(tick: number, exposures: Exposure[]) {
  let phase = tick % exposures.reduce((total, [, duration]) => total + duration, 0);
  for (const [column, duration] of exposures) {
    if (phase < duration) return column;
    phase -= duration;
  }
  return 0;
}

function drawCel(ctx: CanvasRenderingContext2D, row: number, column: number, cx: number, bottom: number,
  size: number, faceLeft = false) {
  const sheet = ringPerformers;
  const left = Math.floor(column * sheet.naturalWidth / 4);
  const top = Math.floor(row * sheet.naturalHeight / 4);
  const w = Math.floor((column + 1) * sheet.naturalWidth / 4) - left;
  const h = Math.floor((row + 1) * sheet.naturalHeight / 4) - top;
  ctx.save();
  ctx.translate(cx, bottom);
  if (faceLeft) ctx.scale(-1, 1);
  ctx.drawImage(sheet, left, top, w, h, -size / 2, -size, size, size);
  ctx.restore();
}

function drawStand(ctx: CanvasRenderingContext2D, tick: number, right: boolean) {
  // Clip at the painted handrail so the spectators remain seated behind it.
  ctx.save();
  ctx.beginPath();
  if (right) {
    ctx.moveTo(1129, 167); ctx.lineTo(1672, 167); ctx.lineTo(1672, 403); ctx.lineTo(1129, 450);
  } else {
    ctx.moveTo(0, 167); ctx.lineTo(544, 167); ctx.lineTo(544, 450); ctx.lineTo(0, 403);
  }
  ctx.closePath();
  ctx.clip();
  const x = (left: number) => right ? 1672 - left : left;
  // Keep the lettering on the foam fingers upright on both sides.
  drawCel(ctx, 1, columnAt(tick + (right ? 47 : 0), wave), x(102), 429, 202);
  drawCel(ctx, 2, columnAt(tick + (right ? 18 : 76), vote), x(274), 447, 164, right);
  drawCel(ctx, 3, columnAt(tick + (right ? 31 : 5), clap), x(446), 464, 170, right);
  ctx.restore();
}

export const ringLayers = {
  backdrop(ctx: CanvasRenderingContext2D, arena: ArenaDefinition) {
    ctx.fillStyle = '#241739';
    ctx.fillRect(0, 0, arena.width, arena.height);
    if (backgrounds.ring.naturalWidth) ctx.drawImage(backgrounds.ring, 0, 0, arena.width, arena.height);
  },
  scenery() {}, // The lighting, ring and handrails are painted into the clean plate.
  mechanism(ctx: CanvasRenderingContext2D, arena: ArenaDefinition, frame: number) {
    if (!ringPerformers.naturalWidth || !backgrounds.ring.naturalWidth) return;
    ctx.save();
    ctx.scale(arena.width / 1672, arena.height / 941);
    ctx.imageSmoothingEnabled = false;
    drawStand(ctx, frame, false);
    drawStand(ctx, frame, true);
    ctx.beginPath();
    ctx.rect(560, 106, 551, 238);
    ctx.clip();
    drawCel(ctx, 0, columnAt(frame, speech), 755, 357, 284);
    ctx.restore();
  }
};

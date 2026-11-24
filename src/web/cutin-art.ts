import { noise, type FeatureShot } from './cinematics.js';

const ink = '#060a1c';

let tint: HTMLCanvasElement | null = null;

/** Flat-coloured copy of one atlas cell, for the two frames where a new pose lands. */
export function drawPoseFlash(ctx: CanvasRenderingContext2D, image: HTMLImageElement,
  region: readonly [number, number, number, number], x: number, y: number, width: number, height: number, color: string) {
  if (!image.naturalWidth) return;
  // Half resolution is enough for a two-frame flash and keeps the copy cheap.
  const w = Math.ceil(width / 2), h = Math.ceil(height / 2);
  tint ??= document.createElement('canvas');
  const layer = tint.getContext('2d')!;
  if (tint.width !== w || tint.height !== h) {
    tint.width = w;
    tint.height = h;
  } else {
    layer.clearRect(0, 0, w, h);
  }
  layer.globalCompositeOperation = 'source-over';
  layer.drawImage(image, ...region, 0, 0, w, h);
  layer.globalCompositeOperation = 'source-in';
  layer.fillStyle = color;
  layer.fillRect(0, 0, w, h);
  ctx.drawImage(tint, 0, 0, w, h, x, y, width, height);
}

/** Tapered lines running in from the edges towards the subject. */
export function drawFocusLines(ctx: CanvasRenderingContext2D, cx: number, cy: number, amount: number, seed: number, unit: number) {
  if (amount <= 0) return;
  const { width, height } = ctx.canvas;
  const reach = Math.hypot(width, height) * .62;
  ctx.save();
  ctx.fillStyle = '#ffffff';
  for (let i = 0; i < 40; i++) {
    const angle = i / 40 * Math.PI * 2 + noise(i + seed) * .16;
    const length = (150 + noise(i * 3 + seed) * 300) * unit * amount;
    const half = (2.5 + noise(i * 5 + seed) * 6) * unit;
    const along = Math.cos(angle), across = Math.sin(angle);
    ctx.globalAlpha = (.25 + noise(i * 7 + seed) * .45) * amount;
    ctx.beginPath();
    ctx.moveTo(cx + along * (reach - length), cy + across * (reach - length));
    ctx.lineTo(cx + along * reach - across * half, cy + across * reach + along * half);
    ctx.lineTo(cx + along * reach + across * half, cy + across * reach - along * half);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

/** Letterboxes a shot, marks whose it is and, once it has made its point, shows how to skip it. */
export function drawShotBars(ctx: CanvasRenderingContext2D, shot: FeatureShot) {
  const { width, height } = ctx.canvas;
  const unit = height / 720;
  ctx.fillStyle = ink;
  ctx.fillRect(0, 0, width, height * .065);
  ctx.fillRect(0, height * .86, width, height * .14);

  ctx.font = `900 ${26 * unit}px system-ui`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const box = ctx.measureText(shot.seat).width + 44 * unit;
  const row = 40 * unit, cut = 12 * unit;
  const x = width - 44 * unit - box, y = height * .065 + 22 * unit;
  ctx.fillStyle = shot.color;
  ctx.beginPath();
  ctx.moveTo(x + cut, y);
  ctx.lineTo(x + box, y);
  ctx.lineTo(x + box - cut, y + row);
  ctx.lineTo(x, y + row);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = ink;
  ctx.fillText(shot.seat, x + box / 2, y + row / 2 + unit);

  if (shot.frame >= 12) {
    ctx.font = `800 ${22 * unit}px system-ui`;
    ctx.textAlign = 'right';
    ctx.fillStyle = '#c9d6ee';
    ctx.fillText(shot.skip, width - 44 * unit, height - 17 * unit);
  }
}

/** Four-point sparkle, drawn with its points upright. */
export function drawSparkle(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number) {
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const angle = i * Math.PI / 4 - Math.PI / 2;
    const reach = i % 2 ? radius * .3 : radius;
    ctx.lineTo(x + Math.cos(angle) * reach, y + Math.sin(angle) * reach);
  }
  ctx.closePath();
  ctx.fill();
}

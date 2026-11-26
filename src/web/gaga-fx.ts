import type { FighterState, Projectile } from '../core/types.js';
import { sparkle } from './hit-burst.js';

function drawFacetedCrystal(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, angle: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.beginPath();
  ctx.moveTo(0, -radius * 1.35);
  ctx.lineTo(radius * .88, -radius * .25);
  ctx.lineTo(radius * .62, radius * 1.15);
  ctx.lineTo(0, radius * 1.4);
  ctx.lineTo(-radius * .62, radius * 1.15);
  ctx.lineTo(-radius * .88, -radius * .25);
  ctx.closePath();

  const grad = ctx.createLinearGradient(-radius, -radius, radius, radius);
  grad.addColorStop(0, '#fff4b8');
  grad.addColorStop(.42, '#fbbf24');
  grad.addColorStop(1, '#b45309');
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.strokeStyle = '#1f1624';
  ctx.lineWidth = Math.max(1.5, radius * .14);
  ctx.stroke();

  // Inner dark Grand Vision prism ridge.
  ctx.fillStyle = '#241a29';
  ctx.beginPath();
  ctx.moveTo(0, -radius * .75);
  ctx.lineTo(radius * .34, 0);
  ctx.lineTo(0, radius * .82);
  ctx.lineTo(-radius * .34, 0);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#fef3c7';
  ctx.beginPath();
  ctx.moveTo(-radius * .26, -radius * .52);
  ctx.lineTo(0, -radius * .95);
  ctx.lineTo(radius * .14, -radius * .48);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

export function drawOriginiumCrystalMark(ctx: CanvasRenderingContext2D, fighter: FighterState, tick: number) {
  if (!fighter.crystalMark) return;
  const ratio = Math.max(0, Math.min(1, fighter.crystalMark.remaining / 240));
  const spin = tick * .07;
  ctx.save();
  ctx.translate(fighter.x, fighter.y - 72);

  // Thin amber countdown ring behind the target.
  ctx.strokeStyle = '#241a29c8';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(0, 0, 34, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = ratio < .25 ? '#f97316' : '#fbbf24';
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.arc(0, 0, 34, -Math.PI * .5, -Math.PI * .5 + Math.PI * 2 * ratio);
  ctx.stroke();

  for (let i = 0; i < 3; i++) {
    const theta = spin + (i * Math.PI * 2) / 3;
    const ox = Math.cos(theta) * 32;
    const oy = Math.sin(theta) * 14 - 4;
    const size = 8.5 + Math.sin(theta) * 2.2;
    drawFacetedCrystal(ctx, ox, oy, size, Math.sin(theta) * .35);
  }
  ctx.restore();
}

export function drawCrystalPlant(ctx: CanvasRenderingContext2D, age: number, life: number) {
  const t = age / Math.max(1, life);
  ctx.save();
  ctx.globalAlpha = Math.max(0, 1 - t ** 1.4);
  ctx.strokeStyle = '#fbbf24';
  ctx.lineWidth = 3 * (1 - t) + 1;
  const r = 14 + t * 38;
  ctx.beginPath();
  ctx.moveTo(0, -r);
  ctx.lineTo(r, 0);
  ctx.lineTo(0, r);
  ctx.lineTo(-r, 0);
  ctx.closePath();
  ctx.stroke();
  if (age < 8) sparkle(ctx, 26 * (1 - t), '#f59e0b', '#fef3c7');
  ctx.restore();
}

export function drawCrystalShatter(ctx: CanvasRenderingContext2D, age: number, life: number, reducedMotion: boolean) {
  const t = age / Math.max(1, life);
  ctx.save();
  ctx.globalAlpha = Math.max(0, 1 - t ** 1.3);
  const spread = 24 + t * 145;
  ctx.strokeStyle = '#fef3c7';
  ctx.lineWidth = 6 * (1 - t) + 1;
  ctx.beginPath();
  ctx.arc(0, 0, spread, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 4 * (1 - t) + 1;
  ctx.beginPath();
  ctx.arc(0, 0, spread * .72, 0, Math.PI * 2);
  ctx.stroke();

  const shards = reducedMotion ? 5 : 11;
  for (let i = 0; i < shards; i++) {
    const angle = (i / shards) * Math.PI * 2 + .25;
    const dist = 16 + t * (92 + (i % 3) * 28);
    const sx = Math.cos(angle) * dist;
    const sy = Math.sin(angle) * dist + t * t * 24;
    drawFacetedCrystal(ctx, sx, sy, (11 - (i % 3) * 2) * (1 - t * .45), angle + t * 4);
  }
  ctx.restore();
}

export function drawXiraniteBurstEffect(ctx: CanvasRenderingContext2D, age: number, life: number,
  facing = 1, reducedMotion = false) {
  const t = age / Math.max(1, life);
  ctx.save();
  ctx.scale(facing, 1);
  ctx.globalAlpha = Math.max(0, 1 - t ** 1.3);

  // Ground liquid ripple.
  ctx.strokeStyle = '#38f2c9';
  ctx.lineWidth = 4.5 * (1 - t) + 1;
  ctx.beginPath();
  ctx.ellipse(28 + t * 65, -4, 34 + t * 92, 10 + t * 14, 0, 0, Math.PI * 2);
  ctx.stroke();

  // Surging teal liquid needles shooting forward.
  const count = reducedMotion ? 4 : 8;
  for (let i = 0; i < count; i++) {
    const spreadY = -92 + (i / (count - 1)) * 78;
    const reach = 42 + t * (135 + (i % 3) * 24);
    const tail = Math.max(12, reach - 54 * (1 - t * .4));
    ctx.fillStyle = i % 2 ? '#5eead4' : '#10b981';
    ctx.beginPath();
    ctx.moveTo(tail, spreadY - 5 * (1 - t));
    ctx.lineTo(reach, spreadY);
    ctx.lineTo(tail, spreadY + 5 * (1 - t));
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

export function drawOverclockArc(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number,
  age: number, life: number) {
  const t = age / Math.max(1, life);
  ctx.save();
  ctx.globalAlpha = Math.max(0, 1 - t ** 1.2);
  const dx = x2 - x1;
  const dy = y2 - y1;
  const steps = 6;
  for (const [color, width] of [['#0ea5e9', 6], ['#fef08a', 2.6]] as const) {
    ctx.strokeStyle = color;
    ctx.lineWidth = width * (1 - t * .5);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    for (let i = 1; i < steps; i++) {
      const f = i / steps;
      const jitter = Math.sin(age * 1.9 + i * 2.7) * 14 * (1 - t);
      ctx.lineTo(dx * f, dy * f - Math.sin(f * Math.PI) * 26 + jitter);
    }
    ctx.lineTo(dx, dy);
    ctx.stroke();
  }
  // Overclock ring around the turret itself.
  ctx.strokeStyle = '#5bd9ff';
  ctx.lineWidth = 3 * (1 - t) + 1;
  ctx.beginPath();
  ctx.arc(dx, dy, 16 + t * 52, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

export function drawSparkProjectile(ctx: CanvasRenderingContext2D, p: Projectile) {
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.scale(p.facing, 1);
  ctx.fillStyle = '#38bdf888';
  ctx.beginPath();
  ctx.ellipse(-6, 0, 20, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fbbf24';
  ctx.beginPath();
  ctx.moveTo(14, 0);
  ctx.lineTo(0, -7);
  ctx.lineTo(-10, 0);
  ctx.lineTo(0, 7);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#fffbeb';
  ctx.beginPath();
  ctx.arc(3, 0, 3.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function drawDiveLandImpact(ctx: CanvasRenderingContext2D, age: number, life: number, reducedMotion: boolean) {
  const t = age / Math.max(1, life);
  ctx.save();
  ctx.globalAlpha = Math.max(0, 1 - t ** 1.3);
  ctx.strokeStyle = '#fbbf24';
  ctx.lineWidth = 5 * (1 - t) + 1;
  ctx.beginPath();
  ctx.ellipse(0, -3, 24 + t * 116, 6 + t * 18, 0, 0, Math.PI * 2);
  ctx.stroke();
  const count = reducedMotion ? 4 : 8;
  for (let i = 0; i < count; i++) {
    const dir = i % 2 ? 1 : -1;
    const dist = 12 + t * (48 + i * 11);
    const py = -4 - t * (34 + (i % 3) * 16) + t * t * 38;
    if (py <= 2) drawFacetedCrystal(ctx, dir * dist, py, 6.5 * (1 - t * .4), dir * (t * 4 + i));
  }
  ctx.restore();
}

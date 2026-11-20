import { gagaActionIds } from '../content/gaga.js';
import type { CombatEvent } from '../core/types.js';

export type PoleSwing = 'sweep' | 'reverse' | 'launch';

export function poleSwingFor(event: CombatEvent): PoleSwing | undefined {
  if (event.kind !== 'swing') return undefined;
  if (event.actionId === gagaActionIds.poleSweep) return 'sweep';
  if (event.actionId === gagaActionIds.poleBacksweep) return 'reverse';
  if (event.actionId === gagaActionIds.poleLaunch) return 'launch';
}

export const poleDustLife = 25;
export const poleImpactLife = 58;
const onGrid = (value: number) => Math.round(value / 2) * 2;

// Dust and grit rhythms adapted from the Pixelfx Spear Sweep and Uppercut effects.
export function drawPoleDust(ctx: CanvasRenderingContext2D, swing: PoleSwing, age: number, facing = 1) {
  const rising = swing === 'launch';
  const travel = swing === 'reverse' ? -1 : 1;
  const alpha = ctx.globalAlpha;
  ctx.scale(facing, 1);
  for (let i = 0; i < 8; i++) {
    const tick = age - i * .54;
    if (tick < 0 || tick >= 20) continue;
    const offset = rising ? 7 + i * 9 : 103 + travel * (i * 27 - 77);
    const speed = rising ? (i - 3) * .55 : travel * (.95 + (i % 3) * .6);
    const x = onGrid(offset + speed * tick);
    const y = onGrid(-4 - tick * (.45 + (i % 4) * (rising ? .5 : .26)));
    const width = onGrid(12 + i % 3 * 4 + tick * 1.1);
    const height = onGrid(6 + i % 4 * 2 + tick * .44);
    const opacity = Math.min(1, (tick + 1) / 4) * (1 - tick / 20);

    ctx.globalAlpha = alpha * opacity * .82;
    ctx.fillStyle = '#8e776b';
    ctx.fillRect(x - width / 2, y - height / 2, width, height);
    ctx.fillRect(x - width / 2 - 4, y - 2, 6, 4);
    ctx.fillRect(x + width / 2 - 2, y - 2, 6, 4);
    ctx.fillStyle = '#d4bba3';
    ctx.fillRect(x - width / 2 + 4, y - height / 2 - 2, width - 8, 4);
    ctx.fillRect(x - width / 2 + 2, y, 4, 2);

    const gritY = -(1.8 + (i % 5) * (rising ? .82 : .55)) * tick + .115 * tick * tick;
    if (gritY < -2) {
      ctx.globalAlpha = alpha * opacity;
      ctx.fillStyle = '#f0d2a8';
      ctx.fillRect(onGrid(offset + speed * tick * 2), onGrid(gritY), i % 2 ? 4 : 2, 2);
    }
  }
}

const fissures = [
  [[-56, 6], [-40, 3], [-27, 8], [-14, 5], [0, 2], [17, 5], [28, 3], [44, 9]],
  [[-27, 8], [-30, 13], [-41, 15]],
  [[-14, 5], [-20, -3], [-35, -4]],
  [[8, 4], [15, 12], [30, 15]],
  [[28, 3], [35, -2], [49, 0]]
];

export function drawPoleGroundMark(ctx: CanvasRenderingContext2D, age: number, left: number, right: number) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(left, -10, right - left, 33);
  ctx.clip();
  ctx.globalAlpha = .78 * Math.min(1, (poleImpactLife - age) / 19);
  ctx.fillStyle = '#886443';
  ctx.beginPath();
  ctx.ellipse(1, 6, 52, 9, .025, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineCap = 'square';
  ctx.lineJoin = 'bevel';
  for (const [index, path] of fissures.entries()) {
    ctx.beginPath();
    for (const [x, y] of path) ctx.lineTo(x, y);
    ctx.strokeStyle = '#c89d6b';
    ctx.lineWidth = index === 0 ? 5 : 3;
    ctx.stroke();
    ctx.strokeStyle = '#39271f';
    ctx.lineWidth = index === 0 ? 2.8 : 1.5;
    ctx.stroke();
  }
  for (const [x, y, size] of [[-45, -1, 6], [-34, 11, 4], [-19, 14, 5], [13, -4, 7], [32, 9, 7], [48, 6, 5]]) {
    ctx.fillStyle = '#5d4030';
    ctx.fillRect(x, y, size, 3);
    ctx.fillStyle = '#c5a07a';
    ctx.fillRect(x + 1, y - 1, size - 2, 2);
  }
  ctx.restore();
}

export function drawPoleEarthBurst(ctx: CanvasRenderingContext2D, age: number, facing = 1) {
  if (age >= 27) return;
  const opacity = 1 - age / 27;
  ctx.scale(facing, 1);
  if (age < 6) {
    ctx.globalAlpha = 1 - age / 6;
    ctx.fillStyle = '#ffdc9b';
    ctx.beginPath();
    ctx.moveTo(-29, -1);
    ctx.lineTo(-10, -8);
    ctx.lineTo(-16, -24);
    ctx.lineTo(1, -12);
    ctx.lineTo(14, -31);
    ctx.lineTo(11, -10);
    ctx.lineTo(30, -6);
    ctx.lineTo(9, 1);
    ctx.closePath();
    ctx.fill();
  }
  for (let i = 0; i < 10; i++) {
    const side = i % 2 ? 1 : -1;
    const tick = Math.max(0, age - i * .3);
    const x = onGrid(side * (5 + i * 3 + (1.8 + i % 4 * .9) * tick) + tick * .4);
    const y = onGrid(-3 - tick * (.8 + i % 3 * .44));
    const w = onGrid(9 + i % 3 * 5 + tick * 1.1);
    const h = onGrid(6 + i % 3 * 3 + tick * .64);
    ctx.globalAlpha = opacity * (.62 + i % 3 * .09);
    ctx.fillStyle = '#937055';
    ctx.fillRect(x - w / 2, y - h / 2, w, h);
    ctx.fillRect(x - w / 2 - 5, y - h / 4, w + 10, h / 2);
    ctx.fillStyle = '#cfad85';
    ctx.fillRect(x - w / 2 + 3, y - h / 2 - 3, w - 6, h * .36 + 3);
  }
  for (let i = 0; i < 11; i++) {
    const side = i % 2 ? 1 : -1;
    const x = onGrid(side * (3 + (2.3 + i * .45) * age));
    const y = onGrid(-(3.2 + i % 6 * .83) * age + .34 * age * age);
    if (y > 0) continue;
    const size = 3 + (i % 4) * 2;
    ctx.globalAlpha = opacity ** .55;
    ctx.fillStyle = '#573c30';
    ctx.fillRect(x, y, size, size - 1);
    ctx.fillStyle = '#d3a778';
    ctx.fillRect(x + 1, y, size - 2, 2);
  }
}

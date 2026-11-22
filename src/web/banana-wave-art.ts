import { bananaWaveTitle } from '../content/fighters/banana.js';
import type { CutIn } from '../core/types.js';
import sprites from '../../assets/fighters/banana-wave-actions.webp';
import expressions from '../../assets/fighters/banana-wave-expressions.webp';
import { drawPixelEffect } from './pixelfx.js';

const sheet = new Image();
sheet.src = sprites;
const portraits = new Image();
portraits.src = expressions;

const tile = { w: 384, h: 352, x: 176, y: 334, scale: .5 };
const hands = [[26, -40], [14, -11], [11, -43], [50, -85], [83, -63], [12, -20]] as const;
const portraitTile = { w: 544, h: 576 };
const portraitsAt = [
  { x: 90, y: 73, zoom: 1.02, hands: [319, 470], eyes: [[285, 363], [424, 363]] },
  { x: 78, y: 58, zoom: 1.07, hands: [345, 512], eyes: [[287, 377], [430, 378]] },
  { x: 72, y: 30, zoom: 1.14, hands: [378, 422], eyes: [[224, 275], [373, 238]] }
] as const;

function drawKeyframe(ctx: CanvasRenderingContext2D, pose: number) {
  const column = pose % 3;
  const row = Math.floor(pose / 3);
  ctx.drawImage(sheet, column * tile.w, row * tile.h, tile.w, tile.h,
    -tile.x * tile.scale, -tile.y * tile.scale, tile.w * tile.scale, tile.h * tile.scale);
}

function drawGatheringWater(ctx: CanvasRenderingContext2D, anchor: readonly [number, number], tick: number, amount: number) {
  if (amount <= 0) return;
  const [x, y] = anchor;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(amount, amount);
  const water = ctx.createRadialGradient(-4, -5, 2, 0, 0, 19);
  water.addColorStop(0, '#e4faffc8');
  water.addColorStop(.55, '#60d5f8df');
  water.addColorStop(1, '#237cd692');
  ctx.beginPath();
  ctx.ellipse(0, 0, 18, 14, -.18, 0, Math.PI * 2);
  ctx.fillStyle = water;
  ctx.fill();
  const ring = tick * .27;
  ctx.strokeStyle = '#9aefff';
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  for (let i = 0; i < 3; i++) {
    const angle = ring + i * 2.09;
    ctx.beginPath();
    ctx.ellipse(0, 0, 27 + i * 2.5, 12 + i * 3, -.2, angle, angle + .94);
    ctx.stroke();
  }
  ctx.fillStyle = '#e0fcff';
  for (let i = 0; i < 9; i++) {
    const angle = ring - i * .78;
    const radius = 23 + i % 3 * 7;
    ctx.beginPath();
    ctx.ellipse(Math.cos(angle) * radius, Math.sin(angle) * radius * .60,
      1.6 + i % 3 * .48, 1.1 + i % 3 * .36, angle, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

export function drawBananaWaveMotion(ctx: CanvasRenderingContext2D, frame: number, startup: number,
  cutInFrame: number, reducedMotion: boolean) {
  if (!sheet.naturalWidth) return false;
  const age = frame - startup;
  const pose = age >= 15 ? 0 : age >= 4 ? 5 : age >= 0 ? 4
    : frame >= cutInFrame ? 3 : frame >= 4 ? 1 : 0;
  ctx.save();
  ctx.shadowBlur = 0;
  // Ease a few pixels of follow-through inside each authored ground pose.
  const recoil = reducedMotion ? 0 : age >= 0 ? Math.max(0, 1 - age / 12) : 0;
  ctx.translate(recoil * 6, 0);
  if (pose === 1 && !reducedMotion) {
    const dip = Math.max(0, Math.min(1, (frame - 4) / (cutInFrame - 4)));
    ctx.scale(1 + .04 * dip, 1 - .07 * dip);
  }
  if (frame >= 4 && age < 0) {
    const swell = Math.min(1, (frame - 3) / 14);
    ctx.save();
    ctx.globalAlpha = .65 * swell;
    drawPixelEffect(ctx, 'whirlpool', reducedMotion ? 4 : frame * 1.13, 26, -4, .5 + swell * .93, .26 + swell * .36);
    ctx.restore();
  }
  drawKeyframe(ctx, pose);
  if (frame >= 4 && age < 0) {
    const amount = Math.min(1, (frame - 2) / 14);
    drawGatheringWater(ctx, hands[pose], reducedMotion ? 0 : frame, amount);
  } else if (age >= 0 && age < 7) {
    ctx.globalAlpha = 1 - age / 7;
    ctx.strokeStyle = '#abf2ff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(54, -54);
    ctx.quadraticCurveTo(88 + age * 7, -82, 122 + age * 12, -22);
    ctx.stroke();
  }
  ctx.restore();
  return true;
}

export function drawBananaWaveCutIn(ctx: CanvasRenderingContext2D, cutIn: CutIn, reducedMotion: boolean) {
  const { width, height } = ctx.canvas;
  const frame = cutIn.frame;
  const phase = frame / cutIn.duration;
  const scoop = phase < .23;
  const lift = phase >= .59;
  const expression = scoop ? 0 : lift ? 2 : 1;
  const shot = portraitsAt[expression];
  const travel = reducedMotion ? 0 : Math.min(1, phase * 2);
  ctx.resetTransform();
  ctx.save();
  ctx.scale(width / 1280, height / 720);
  ctx.fillStyle = '#121936';
  ctx.fillRect(0, 0, 1280, 720);
  ctx.fillStyle = lift ? '#24587f' : '#203b66';
  ctx.fillRect(0, 46, 1280, 630);
  ctx.save();
  ctx.globalAlpha = lift ? .75 : .42;
  for (let i = 0; i < 8; i++) {
    const x = i * 190 + (reducedMotion ? 0 : frame * 7) % 190 - 560;
    ctx.fillStyle = i % 2 ? '#31b9cf' : '#356ea6';
    ctx.fill(new Path2D(`M${x} 635 L${x + 620} 45 H${x + 675 + (i % 3) * 25} L${x + 62} 635Z`));
  }
  ctx.restore();

  const swell = 100 + 350 * phase;
  ctx.fillStyle = '#319bc8';
  ctx.fill(new Path2D(`M0 652 C412 689 609 ${627 - swell * .56} 814 ${633 - swell} C975 ${618 - swell * 1.1} 1151 ${688 - swell * .49} 1280 ${514 - swell * .62} V720 H0Z`));
  ctx.fillStyle = '#a9f1f7';
  ctx.fill(new Path2D(`M0 677 C375 690 572 ${662 - swell * .44} 828 ${624 - swell} C1002 ${617 - swell * .87} 1124 ${700 - swell * .48} 1280 ${541 - swell * .64} C1127 ${708 - swell * .30} 989 ${640 - swell * .60} 830 ${677 - swell * .75} C634 533 385 714 0 705Z`));

  ctx.save();
  ctx.globalAlpha = lift ? .94 : .62;
  drawPixelEffect(ctx, 'whirlpool', reducedMotion ? 8 : (frame * 1.35) % 45, 845, lift ? 374 : 475,
    5.3 + phase * 2, 2.7 + phase * 2);
  if (lift) drawPixelEffect(ctx, 'waveCrash', 9 + (phase - .59) * 68, 876, 591, 4.5, 5.5);
  ctx.restore();
  if (portraits.naturalWidth) {
    ctx.save();
    ctx.translate(shot.x + travel * 13, shot.y);
    ctx.scale(shot.zoom + travel * .035, shot.zoom + travel * .035);
    ctx.drawImage(portraits, expression * portraitTile.w, 0, portraitTile.w, portraitTile.h,
      0, 0, portraitTile.w, portraitTile.h);
    for (const [i, [x, y]] of shot.eyes.entries()) {
      const side = i ? 1 : -1;
      const run = 18 + phase * 29;
      ctx.strokeStyle = '#8eeeff';
      ctx.lineWidth = 3 + phase * 4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + side * run * .65, y + 7, x + side * run, y + run * .82);
      ctx.stroke();
    }
    drawGatheringWater(ctx, shot.hands, reducedMotion ? 0 : frame,
      scoop ? 1.0 : lift ? 2.65 : 1.55 + phase);
    ctx.restore();
  }

  if (!scoop) {
    ctx.fillStyle = '#172746';
    ctx.fill(new Path2D('M650 402 L1280 329 V588 L691 650Z'));
    ctx.textAlign = 'right';
    ctx.font = '900 99px "Microsoft YaHei", sans-serif';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 16;
    ctx.strokeStyle = '#172746';
    ctx.strokeText(bananaWaveTitle, 1214, 541);
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#5dd0ea';
    ctx.strokeText(bananaWaveTitle, 1214, 541);
    ctx.fillStyle = '#efffff';
    ctx.fillText(bananaWaveTitle, 1214, 541);
  }
  ctx.fillStyle = '#131634';
  ctx.fillRect(0, 0, 1280, 46);
  ctx.fillRect(0, 674, 1280, 46);
  ctx.restore();
}

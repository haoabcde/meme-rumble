import type { CombatEvent, FighterState } from '../core/types.js';
import { bananaActionIds } from '../content/fighters/banana.js';
import sprites from '../../assets/fighters/unified-handdrawn-v1/motion/banana/registered/banana-hit-reactions.webp';
import { drawPixelEffect } from './pixelfx.js';

const sheet = new Image();
sheet.src = sprites;
const tile = { width: 384, height: 352, x: 176, y: 334, scale: .5 };

export function drawBananaHurt(ctx: CanvasRenderingContext2D, fighter: FighterState, reducedMotion: boolean) {
  const reaction = fighter.reaction;
  if (!reaction || !fighter.hp || !sheet.naturalWidth) return false;
  const landingAge = reaction.landedAt === undefined ? -1 : reaction.elapsed - reaction.landedAt;
  const heavy = reaction.kind === 'heavy';
  const airborne = !fighter.ground;
  const pose = airborne ? 2 : landingAge >= 0 ? 3 : heavy ? (reaction.elapsed < 13 ? 1 : 3) : 0;
  if ((landingAge >= 9 && !fighter.hitstun) || (pose === 0 && reaction.elapsed >= 11) ||
    (pose === 3 && heavy && reaction.elapsed >= 24)) return false;
  const kick = Math.max(0, 1 - reaction.elapsed / (heavy ? 15 : 8));
  const settle = landingAge >= 0 ? Math.max(0, 1 - landingAge / 9) : 0;

  ctx.save();
  ctx.shadowBlur = 0;
  if (reaction.facing !== fighter.facing) ctx.scale(-1, 1);
  if (!reducedMotion && reaction.elapsed < 2) ctx.filter = 'brightness(1.42) saturate(.82)';
  if (!reducedMotion) {
    if (airborne) {
      ctx.translate(0, -10);
      ctx.rotate(Math.max(-.20, Math.min(.18, fighter.vy * .009)));
    } else {
      ctx.translate(-(heavy ? 7 : 4) * kick, 0);
      ctx.scale(1 + settle * .045, 1 - (pose === 3 ? .065 * settle : .028 * kick));
    }
  }
  ctx.drawImage(sheet, pose % 2 * tile.width, Math.floor(pose / 2) * tile.height, tile.width, tile.height,
    -tile.x * tile.scale, -tile.y * tile.scale, tile.width * tile.scale, tile.height * tile.scale);
  ctx.restore();
  return true;
}

// One burst shape at three weights. `reach` is the half-length of the flash, `hold` is how many frames it stays
// whole (matching the hit stop of the moves in that weight) before it breaks into shards that travel `run`.
const bursts = {
  light: { reach: 66, hold: 2, shards: 8, run: 96, ring: false },
  medium: { reach: 78, hold: 3, shards: 10, run: 132, ring: false },
  heavy: { reach: 88, hold: 4, shards: 12, run: 172, ring: true },
  launch: { reach: 96, hold: 4, shards: 12, run: 188, ring: true }
};
const rim = '#2a2a4e';
const shardColors = ['#ffb340', '#fff3c2', '#bfefff'];

/** Four-point sparkle: long along the blow, short across it. */
export function flare(ctx: CanvasRenderingContext2D, long: number, short: number) {
  ctx.beginPath();
  ctx.moveTo(long, 0);
  ctx.quadraticCurveTo(long * .14, short * .14, 0, short);
  ctx.quadraticCurveTo(-long * .14, short * .14, -long, 0);
  ctx.quadraticCurveTo(-long * .14, -short * .14, 0, -short);
  ctx.quadraticCurveTo(long * .14, -short * .14, long, 0);
}

/** Two-tone sparkle with a dark rim, so it reads over pale fur, white bellies and bright skies alike. */
export function sparkle(ctx: CanvasRenderingContext2D, reach: number, outer: string, inner: string) {
  ctx.lineJoin = 'round';
  ctx.strokeStyle = rim;
  ctx.lineWidth = 4;
  ctx.fillStyle = outer;
  flare(ctx, reach, reach * .54);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = inner;
  flare(ctx, reach * .84, reach * .44);
  ctx.fill();
  ctx.fillStyle = '#fffdf6';
  flare(ctx, reach * .68, reach * .36);
  ctx.fill();
}

/** Flying sliver: a pointed tail trails back toward the impact and the broad end leads, so it reads as leaving
 *  rather than as a spike growing out of the fighter. */
export function shard(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, length: number,
  width: number, outline = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.beginPath();
  ctx.moveTo(-length * .5, 0);
  ctx.lineTo(length * .5, -width);
  ctx.lineTo(length * .5, width);
  ctx.closePath();
  ctx.fill();
  if (outline) {
    ctx.lineWidth = outline;
    ctx.stroke();
  }
  ctx.restore();
}

export function drawBananaImpact(ctx: CanvasRenderingContext2D, event: CombatEvent, age: number, life: number,
  reducedMotion: boolean) {
  if (event.kind === 'land') {
    const scale = 1.22;
    drawPixelEffect(ctx, 'heavyLanding', age * 1.15, 0, 0, scale, scale * .88);
    return;
  }
  const launch = event.reaction === 'air';
  const weight = event.impact ?? (event.reaction === 'heavy' ? 'heavy' : 'light');
  const { reach, hold, shards, run, ring } = launch ? bursts.launch : bursts[weight];
  const size = reach / 66 * (reducedMotion ? .74 : 1);
  const spread = Math.min(1, age / life);
  const travel = 1 - (1 - spread) ** 2;
  const flash = age < hold ? 1 : Math.max(0, 1 - (age - hold + 1) / 3);
  ctx.save();
  ctx.scale(event.facing ?? 1, 1);
  if (ring && age < 11) {
    ctx.save();
    const grow = 1 - (1 - age / 11) ** 2;
    ctx.globalAlpha *= 1 - age / 11;
    for (const [color, extra] of [[rim, 2.6], ['#fff1b8', 0]] as const) {
      ctx.strokeStyle = color;
      ctx.lineWidth = 6 * (1 - grow) + 1.2 + extra;
      ctx.beginPath();
      ctx.ellipse(0, 4, (26 + 96 * grow) * size, (26 + 96 * grow) * size * .48, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }
  ctx.save();
  if (launch || event.actionId === bananaActionIds.lift) ctx.rotate(launch ? -1.1 : -.9);
  // Shards leave the moment the blow lands but sit inside the flash until it breaks apart.
  ctx.save();
  ctx.globalAlpha *= (1 - spread) ** .7;
  ctx.strokeStyle = rim;
  for (let i = 0; i < shards; i++) {
    const angle = (i / (shards - 1) - .5) * 3.5 + Math.sin(i * 12.99) * .12;
    const distance = 10 + run * travel * (.55 + .45 * (i * 7 % 5) / 4);
    ctx.fillStyle = shardColors[i % 3];
    shard(ctx, Math.cos(angle) * distance, Math.sin(angle) * distance, angle,
      (34 + i % 3 * 12) * size * (1 - spread * .7), 3.2 * size * (1 - spread * .8), 1.6);
  }
  ctx.restore();
  // The sprite's brightest frame holds through the hit stop; afterwards its sparks run out along the blow.
  const sprite = reach / 40 * size;
  drawPixelEffect(ctx, 'hitSpark', age < hold ? 0 : 1 + age - hold, 0, 0, sprite, sprite, true);
  if (flash > 0) {
    ctx.save();
    ctx.globalAlpha *= flash;
    // Shrinking as it thins out keeps the collapse from leaving a large translucent sheet over the fighters.
    sparkle(ctx, reach * size * (age === 0 ? .88 : 1 + Math.min(3, age) * .03) * (.35 + .65 * flash),
      '#ffab2e', '#ffe27a');
    ctx.restore();
  }
  ctx.restore();
  ctx.restore();
}

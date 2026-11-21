import type { CombatEvent, FighterState } from '../core/types.js';
import sprites from '../../assets/fighters/banana-hit-reactions.webp';
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

export function drawBananaImpact(ctx: CanvasRenderingContext2D, event: CombatEvent, age: number) {
  if (event.kind === 'land') {
    const scale = 1.22;
    drawPixelEffect(ctx, 'heavyLanding', age * 1.15, 0, 0, scale, scale * .88);
    return;
  }
  const heavy = event.reaction === 'heavy' || event.impact === 'heavy';
  const air = event.reaction === 'air';
  const strength = air ? 1.38 : heavy ? 1.45 : 1.02;
  ctx.save();
  ctx.scale(event.facing ?? 1, 1);
  if (air) ctx.rotate(-.47);
  drawPixelEffect(ctx, 'hitSpark', age * .84, 0, 0, strength);
  ctx.restore();
}

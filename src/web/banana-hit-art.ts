import type { CombatEvent, FighterState } from '../core/types.js';
import { bananaActionIds } from '../content/fighters/banana.js';
import sprites from '../../assets/fighters/banana-hit-reactions.webp';
import joCombatSprites from '../../assets/fighters/banana-jo-combat.webp';
import { burstScale, burstWeights, drawBurst, hitWeight, type BurstPalette } from './hit-burst.js';
import { drawPixelEffect } from './pixelfx.js';

const sheet = new Image();
sheet.src = sprites;
const joSheet = new Image();
joSheet.src = joCombatSprites;
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
  if (fighter.joAwakened && joSheet.naturalWidth) {
    // Cell 7 (col 3, row 1) is the JOJO muscular knockback recoil sprite.
    ctx.drawImage(joSheet, 3 * tile.width, tile.height, tile.width, tile.height,
      -tile.x * tile.scale, -tile.y * tile.scale, tile.width * tile.scale, tile.height * tile.scale);
  } else {
    ctx.drawImage(sheet, pose % 2 * tile.width, Math.floor(pose / 2) * tile.height, tile.width, tile.height,
      -tile.x * tile.scale, -tile.y * tile.scale, tile.width * tile.scale, tile.height * tile.scale);
  }
  ctx.restore();
  return true;
}

const palette: BurstPalette = {
  outer: '#ffab2e', inner: '#ffe27a', ring: '#fff1b8', shards: ['#ffb340', '#fff3c2', '#bfefff']
};

const joPalette: BurstPalette = {
  outer: '#c026d3', inner: '#fde047', ring: '#f5d0fe', shards: ['#d946ef', '#fde047', '#ffffff']
};

const joMangaSfx: Partial<Record<string, readonly string[]>> = {
  [bananaActionIds.joJab]: ['ドドッ!', 'バキッ!'],
  [bananaActionIds.joCross]: ['バキィ!!', 'ドゴォ!'],
  [bananaActionIds.joPounce]: ['ズバァッ!', 'ゴゴゴ!'],
  [bananaActionIds.joUppercut]: ['ドガァ!!', 'ゴゴゴ!'],
  [bananaActionIds.joLift]: ['昇龍!!', 'ドガァ!!'],
  [bananaActionIds.joSlide]: ['ズバァ!!', 'バキッ!'],
  [bananaActionIds.joSheerHeart]: ['ドォォン!!', 'コッチヲ見ロ!!'],
  [bananaActionIds.joAntiAir]: ['オラァ!', 'オラオラ!!'],
  [bananaActionIds.joOra]: ['オラァ!', 'オラッ!', 'ドォォン!!'],
  [bananaActionIds.joAirDive]: ['ドォォン!!', 'オラァ!!'],
  [bananaActionIds.joAwaken]: ['ゴゴゴゴ!!']
};

export function drawBananaImpact(ctx: CanvasRenderingContext2D, event: CombatEvent, age: number, life: number,
  reducedMotion: boolean) {
  if (event.kind === 'land') {
    const scale = 1.22;
    drawPixelEffect(ctx, 'heavyLanding', age * 1.15, 0, 0, scale, scale * .88);
    return;
  }
  const launch = event.reaction === 'air';
  const sfxList = event.actionId ? joMangaSfx[event.actionId] : undefined;
  const isFinalOra = event.actionId === bananaActionIds.joOra && (event.amount ?? 0) >= 80;
  const burst = isFinalOra ? burstWeights.heavy : burstWeights[hitWeight(event)];
  const sprite = burst.size / 40 * burstScale(burst, reducedMotion);
  const tilt = launch ? -1.1 : event.actionId === bananaActionIds.lift ? -.9 : 0;
  ctx.save();
  ctx.scale(event.facing ?? 1, 1);
  // The sprite's brightest frame holds through the hit stop; afterwards its sparks run out along the blow.
  drawBurst(ctx, burst, age, life, sfxList ? joPalette : palette, tilt, reducedMotion, () =>
    drawPixelEffect(ctx, 'hitSpark', age < burst.hold ? 0 : 1 + age - burst.hold, 0, 0, sprite, sprite, true));
  ctx.restore();

  if (sfxList && event.kind === 'hit') {
    const progress = Math.min(1, age / Math.max(1, life));
    const text = isFinalOra ? 'ドォォォン!!' : sfxList[Math.abs(Math.round(event.x)) % sfxList.length];
    const rise = reducedMotion ? 0 : progress * 34;
    const pop = isFinalOra ? 1.35 : 1;
    ctx.save();
    ctx.globalAlpha = Math.max(0, 1 - progress * progress);
    ctx.translate((event.facing ?? 1) * 14, -36 - rise);
    ctx.rotate((event.facing ?? 1) * -.12);
    ctx.scale(pop, pop);
    ctx.font = '900 28px "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'center';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#1e0638';
    ctx.lineWidth = 7;
    ctx.strokeText(text, 0, 0);
    ctx.fillStyle = isFinalOra ? '#fde047' : '#f0abfc';
    ctx.fillText(text, 0, 0);
    ctx.restore();
  }
}

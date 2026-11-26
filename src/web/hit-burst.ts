// Shared shape of a hit burst: a two-tone sparkle that holds through the hit stop, then breaks into shards
// that fly along the blow. Each fighter sizes it by weight and colours it with their own palette.
import type { CombatEvent } from '../core/types.js';

export interface Burst {
  /**
   * Relative size, 66 for a light hit. The flash's half-length is size² / 66 world units, so heavier weights
   * grow faster than the shards do: 66 / 78 / 88 / 96 give a flash about 132 / 184 / 235 / 279 wide.
   */
  size: number;
  /** Frames the flash stays whole, matching the hit stop of moves at this weight. */
  hold: number;
  shards: number;
  /** How far the shards travel. */
  run: number;
  ring: boolean;
}

export interface BurstPalette {
  outer: string;
  inner: string;
  ring: string;
  shards: readonly string[];
}

// Public weights, shared by every fighter so that a medium hit reads the same whoever lands it.
export const burstWeights: Record<'light' | 'medium' | 'heavy' | 'launch', Burst> = {
  light: { size: 66, hold: 2, shards: 8, run: 96, ring: false },
  medium: { size: 78, hold: 3, shards: 10, run: 132, ring: false },
  heavy: { size: 88, hold: 4, shards: 12, run: 172, ring: true },
  launch: { size: 96, hold: 4, shards: 12, run: 188, ring: true }
};

export const rim = '#2a2a4e';

export type Weight = keyof typeof burstWeights;

/** The public weight of a landed hit: the move's own when it names one, otherwise read from the reaction. */
export function hitWeight(event: CombatEvent): Weight {
  if (event.reaction === 'air') return 'launch';
  return event.impact ?? (event.reaction === 'heavy' ? 'heavy' : 'light');
}

/** Scale of the shards, ring and accents relative to a light hit. Reduced motion keeps the feedback but calms it down. */
export function burstScale(burst: Burst, reducedMotion: boolean) {
  return burst.size / 66 * (reducedMotion ? .74 : 1);
}

/** Four-point sparkle: long along the blow, short across it. */
function flare(ctx: CanvasRenderingContext2D, long: number, short: number) {
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
function shard(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, length: number,
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

/**
 * Draws at the contact point; the caller mirrors the frame with the attacker's facing. `tilt` turns the flash
 * and its shards along the blow while the shock ring stays flat on the ground. `beneathFlash` is drawn between
 * the shards and the flash, for a fighter's own accent, and receives the flash's current half-length, or zero
 * once it has collapsed.
 */
export function drawBurst(ctx: CanvasRenderingContext2D, burst: Burst, age: number, life: number,
  palette: BurstPalette, tilt: number, reducedMotion: boolean, beneathFlash: (reach: number) => void = () => {}) {
  const scale = burstScale(burst, reducedMotion);
  const spread = Math.min(1, age / life);
  const travel = 1 - (1 - spread) ** 2;
  const flash = age < burst.hold ? 1 : Math.max(0, 1 - (age - burst.hold + 1) / 3);
  // Shrinking as it thins out keeps the collapse from leaving a large translucent sheet over the fighters.
  const reach = burst.size * scale * (age === 0 ? .88 : 1 + Math.min(3, age) * .03) * (.35 + .65 * flash);
  if (burst.ring && age < 11) {
    ctx.save();
    const grow = 1 - (1 - age / 11) ** 2;
    ctx.globalAlpha *= 1 - age / 11;
    for (const [color, extra] of [[rim, 2.6], [palette.ring, 0]] as const) {
      ctx.strokeStyle = color;
      ctx.lineWidth = 6 * (1 - grow) + 1.2 + extra;
      ctx.beginPath();
      ctx.ellipse(0, 4, (26 + 96 * grow) * scale, (26 + 96 * grow) * scale * .48, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }
  ctx.save();
  ctx.rotate(tilt);
  // Shards leave the moment the blow lands but sit inside the flash until it breaks apart.
  ctx.save();
  ctx.globalAlpha *= (1 - spread) ** .7;
  ctx.strokeStyle = rim;
  for (let i = 0; i < burst.shards; i++) {
    const angle = (i / (burst.shards - 1) - .5) * 3.5 + Math.sin(i * 12.99) * .12;
    const distance = 10 + burst.run * travel * (.55 + .45 * (i * 7 % 5) / 4);
    ctx.fillStyle = palette.shards[i % palette.shards.length];
    shard(ctx, Math.cos(angle) * distance, Math.sin(angle) * distance, angle,
      (34 + i % 3 * 12) * scale * (1 - spread * .7), 3.2 * scale * (1 - spread * .8), 1.6);
  }
  ctx.restore();
  beneathFlash(flash > 0 ? reach : 0);
  if (flash > 0) {
    ctx.save();
    ctx.globalAlpha *= flash;
    sparkle(ctx, reach, palette.outer, palette.inner);
    ctx.restore();
  }
  ctx.restore();
}

import { gagaActionIds } from '../content/fighters/gaga.js';
import type { CombatEvent } from '../core/types.js';
import { burstWeights, drawBurst, rim, sparkle, type Burst, type BurstPalette } from './hit-burst.js';

// Her own body and the pole hit in lavender, the pole scattering a few yellow sparks from its lines. The
// hardware she fields sparks in its own colour.
const lavender: BurstPalette = {
  outer: '#9b5dff', inner: '#cfa8ff', ring: '#e3d0ff', shards: ['#b98cff', '#e9dcff', '#9fd6ff']
};
const pole: BurstPalette = { ...lavender, shards: ['#b98cff', '#e9dcff', '#ffd84d'] };
const hardware: BurstPalette = {
  outer: '#2fa6f0', inner: '#9fdcff', ring: '#c4ecff', shards: ['#6fcbff', '#dff6ff', '#ffffff']
};
const explosive: BurstPalette = {
  outer: '#ff7f2a', inner: '#ffd08a', ring: '#ffdca6', shards: ['#ff9a3c', '#ffe2a6', '#fff4d6']
};

interface Strike {
  burst: Burst;
  palette: BurstPalette;
  /** Angle of the blow in radians: negative lifts, positive drives down. */
  tilt: number;
}

// Every move of hers that connects gets the shared burst by weight, turned along the blow.
const strikes: Record<string, Strike> = {
  [gagaActionIds.jab]: { burst: burstWeights.light, palette: lavender, tilt: 0 },
  [gagaActionIds.backhand]: { burst: burstWeights.light, palette: lavender, tilt: .3 },
  [gagaActionIds.poleSweep]: { burst: burstWeights.medium, palette: pole, tilt: 0 },
  [gagaActionIds.poleBacksweep]: { burst: burstWeights.light, palette: pole, tilt: -.15 },
  [gagaActionIds.poleLaunch]: { burst: burstWeights.launch, palette: pole, tilt: -1.1 },
  [gagaActionIds.lift]: { burst: burstWeights.launch, palette: lavender, tilt: -.9 },
  [gagaActionIds.slide]: { burst: burstWeights.heavy, palette: lavender, tilt: 0 },
  [gagaActionIds.airThrow]: { burst: burstWeights.heavy, palette: pole, tilt: .6 },
  [gagaActionIds.turret]: { burst: burstWeights.medium, palette: hardware, tilt: 1.1 },
  [gagaActionIds.howitzer]: { burst: burstWeights.medium, palette: hardware, tilt: 1.1 },
  [gagaActionIds.turretBolt]: { burst: { size: 54, hold: 2, shards: 7, run: 80, ring: false }, palette: hardware, tilt: 0 },
  [gagaActionIds.grenade]: { burst: burstWeights.heavy, palette: explosive, tilt: 0 }
};

/** The burst for a hit Gaga lands, or undefined when the move keeps its own feedback (the summon). */
export function gagaStrike(event: CombatEvent): Strike | undefined {
  if (event.kind !== 'hit' || !event.amount || !event.actionId || !Object.hasOwn(strikes, event.actionId)) return;
  return strikes[event.actionId];
}

// A block is a blow that stopped: the same flash without the burst, cold-coloured, behind a shield arc.
const guard: Burst = { size: 46, hold: 2, shards: 0, run: 0, ring: false };
const guardPalette: BurstPalette = { outer: '#4fb8f0', inner: '#d6f3ff', ring: '#aee6ff', shards: [] };

/** Hit bursts for strikes from `gagaStrike`, and the guard flash for any block Gaga is part of. */
export function drawGagaImpact(ctx: CanvasRenderingContext2D, event: CombatEvent, age: number, life: number,
  reducedMotion: boolean) {
  const strike = gagaStrike(event);
  ctx.save();
  ctx.scale(event.facing ?? 1, 1);
  if (strike) {
    // A second sparkle turned 45 degrees makes hers an eight-point star where Banana Cat's has four.
    drawBurst(ctx, strike.burst, age, life, strike.palette, strike.tilt, reducedMotion, reach => {
      if (reach <= 0) return;
      ctx.save();
      ctx.rotate(Math.PI / 4);
      sparkle(ctx, reach * .5, strike.palette.outer, strike.palette.inner);
      ctx.restore();
    });
  } else {
    const phase = Math.min(1, age / 13);
    ctx.globalAlpha *= 1 - phase ** 2;
    ctx.lineCap = 'round';
    // The arc bulges back toward the attacker, on the side the blow came from.
    for (const [color, width] of [[rim, 7.5], ['#8fe0ff', 4.5]] as const) {
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.beginPath();
      ctx.ellipse(-4, 0, 28 + age * 1.6, 38 + age * 2.1, 0, Math.PI * .5, Math.PI * 1.5);
      ctx.stroke();
    }
    drawBurst(ctx, guard, age, 13, guardPalette, 0, reducedMotion);
  }
  ctx.restore();
}

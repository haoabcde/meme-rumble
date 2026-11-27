import type { CombatEvent, ImpactTier } from '../core/types.js';

type Point = [number, number];
const palette = {
  light: { reach: 20, shards: 2, ink: '#34283a', key: '#f3c683' },
  medium: { reach: 35, shards: 3, ink: '#382539', key: '#ffb388' },
  heavy: { reach: 50, shards: 4, ink: '#3e2138', key: '#ff8e79' },
  launch: { reach: 45, shards: 4, ink: '#272d4e', key: '#c8d8ff' },
  guard: { reach: 31, shards: 3, ink: '#20384d', key: '#8ce3ee' },
  'guard-break': { reach: 44, shards: 5, ink: '#442738', key: '#ff9d75' },
  parry: { reach: 29, shards: 3, ink: '#392a4b', key: '#f2f0a4' },
  ultimate: { reach: 58, shards: 5, ink: '#3c263b', key: '#ffca7c' }
} satisfies Record<ImpactTier, { reach: number; shards: number; ink: string; key: string }>;

function shape(ctx: CanvasRenderingContext2D, fill: string, points: Point[]) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.moveTo(...points[0]);
  for (const point of points.slice(1)) ctx.lineTo(...point);
  ctx.closePath();
  ctx.fill();
}

function shield(ctx: CanvasRenderingContext2D, tier: ImpactTier, key: string, ink: string, p: number) {
  const broken = tier === 'guard-break';
  const gap = broken ? p * .22 + .06 : 0;
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.scale(1, side);
    ctx.translate(gap * .8, gap);
    shape(ctx, ink, [[-.48, .01], [-.32, -.62], [.03, -.98], [.43, -.75], [.84, -.12], [.64, .03],
      [.48, -.13], [.27, -.59], [.04, -.68], [-.16, -.37], [-.24, .01]]);
    shape(ctx, key, [[-.36, -.02], [-.23, -.58], [.04, -.78], [.31, -.66], [.67, -.12], [.53, -.17],
      [.21, -.54], [.04, -.58], [-.17, -.3], [-.22, -.02]]);
    if (broken || tier === 'parry') {
      shape(ctx, '#f6edd3', [[.22, -.11], [.51, -.35], [.43, -.12], [.71, -.01], [.36, -.04]]);
    }
    ctx.restore();
  }
}

export function drawImpactInk(ctx: CanvasRenderingContext2D, event: CombatEvent, tier: ImpactTier, progress: number,
  reducedMotion: boolean, compact: boolean) {
  if (progress < 0 || progress >= 1) return;
  const { reach, shards, ink, key } = palette[tier];
  const quiet = event.hitstop !== undefined && event.hitstop <= 1 && event.kind !== 'ultimate';
  const size = reach * (compact ? .74 : 1) * (quiet ? .65 : 1) * (event.trade ? .73 : 1);
  const main = (tier === 'guard' || tier === 'parry' || tier === 'guard-break') ? key : event.feedback?.color ?? key;
  const accent = reducedMotion ? main : '#fff0ce';
  const ground = event.kind === 'ultimate' || event.kind === 'summon-impact';
  const launch = tier === 'launch';
  const guarded = tier === 'guard' || tier === 'guard-break' || tier === 'parry';
  ctx.save();
  ctx.globalAlpha *= (1 - progress) * (reducedMotion ? .81 : 1);
  ctx.scale(size * (event.direction ?? event.facing ?? 1), size);
  if (ground) {
    const spread = 1 + progress * .44;
    for (const side of [-1, 1]) {
      ctx.save(); ctx.scale(side * spread, 1);
      shape(ctx, ink, [[0, .21], [.91, .23], [1.36, -.17], [.73, -.10], [.41, -.32], [.25, -.11]]);
      shape(ctx, main, [[0, .15], [.84, .12], [1.22, -.14], [.66, -.02], [.41, -.28], [.27, -.05]]);
      ctx.restore();
    }
  } else if (guarded) {
    shield(ctx, tier, main, ink, progress);
  } else {
    if (launch) ctx.rotate(-1.03);
    const spread = 1 + .35 * progress;
    ctx.scale(spread, 1);
    const cut = tier === 'light' ? .22 : tier === 'medium' ? .35 : .49;
    shape(ctx, ink, [[-1.10, .34], [-.54, -.18], [-.62, -cut], [-.16, -.32], [.18, -.52],
      [.38, -.27], [1.16, -.44], [.62, -.05], [1.33, .04], [.64, .19], [.31, .53], [.08, .26], [-.35, .63], [-.23, .26]]);
    shape(ctx, main, [[-.9, .28], [-.4, -.13], [-.47, -.36], [-.14, -.23], [.13, -.37], [.32, -.21],
      [1.01, -.37], [.48, -.04], [1.12, .02], [.52, .13], [.3, .39], [.08, .18], [-.2, .44], [-.15, .16]]);
    shape(ctx, accent, [[-.63, .18], [-.07, -.18], [.18, -.12], [.69, -.24], [.33, .01], [.58, .07], [.19, .17], [-.21, .19]]);
  }
  const n = reducedMotion || quiet ? Math.min(2, shards) : shards;
  for (let i = 0; i < n; i++) {
    const angle = -1.5 + 3.15 * i / (n - 1);
    const r = (ground ? 1.54 : 1.02) + progress * .42 + (i % 2) * .11;
    const x = Math.cos(angle) * r, y = Math.sin(angle) * r * .7;
    shape(ctx, i % 2 ? accent : main, [[x, y], [x + Math.cos(angle) * .21, y + Math.sin(angle) * .24],
      [x + .09, y + .09], [x - .02, y + .11]]);
  }
  ctx.restore();
}

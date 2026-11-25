import type { WalkState } from '../core/types.js';

interface Foot {
  x: number;
  y: number;
}

interface WalkPose {
  frame: number;
  rear: Foot;
  lead: Foot;
  lean: number;
  bodyY: number;
}

const neutral: WalkPose = { frame: 0, rear: { x: -41, y: 0 }, lead: { x: 27, y: 0 }, lean: 0, bodyY: 0 };
const mix = (from: number, to: number, t: number) => from + (to - from) * t;
const ease = (t: number) => t * t * (3 - 2 * t);

function stridePose(walk: WalkState): WalkPose {
  const forward = walk.direction === 'forward';
  const direction = forward ? 1 : -1;
  const stride = forward ? 64 : 56;
  const step = Math.floor(walk.distance / stride);
  const progress = (walk.distance % stride) / stride;
  const reach = stride / 2;
  // The support boot moves back relative to the body at the same rate the body moves over it.
  const planted = direction * (reach - stride * progress);
  const swinging = direction * (-reach + stride * ease(progress));
  const height = -(forward ? 7 : 4) * Math.sin(Math.PI * progress) ** 2;
  const leadSupports = (step % 2 === 0) === forward;
  return {
    frame: (leadSupports ? 0 : 2) + (progress < .32 ? 0 : 1),
    rear: { x: -16 + (leadSupports ? swinging : planted), y: leadSupports ? height : 0 },
    lead: { x: 16 + (leadSupports ? planted : swinging), y: leadSupports ? 0 : height },
    lean: forward ? .06 : -.04,
    bodyY: -3 - 1.8 * Math.sin(Math.PI * progress) ** 2
  };
}

export class GagaWalk {
  private direction?: WalkState['direction'];
  private current = neutral;
  private from = neutral;
  private transition = 1;

  sample(walk: WalkState | undefined, elapsed: number) {
    if (walk?.direction !== this.direction) {
      this.direction = walk?.direction;
      this.from = this.current;
      this.transition = 0;
    }
    this.transition = Math.min(1, this.transition + elapsed / 4);
    const target = walk ? stridePose(walk) : neutral;
    const t = ease(this.transition);
    this.current = {
      frame: t < .5 ? this.from.frame : target.frame,
      rear: { x: mix(this.from.rear.x, target.rear.x, t), y: mix(this.from.rear.y, target.rear.y, t) },
      lead: { x: mix(this.from.lead.x, target.lead.x, t), y: mix(this.from.lead.y, target.lead.y, t) },
      lean: mix(this.from.lean, target.lean, t),
      bodyY: mix(this.from.bodyY, target.bodyY, t)
    };
    return walk || this.transition < 1 ? this.current : undefined;
  }

  reset() {
    this.direction = undefined;
    this.current = neutral;
    this.from = neutral;
    this.transition = 1;
  }
}

export const gagaMovement = { dash: 4, jump: 5, fall: 6, guard: 7 } as const;

export function drawGagaMovement(ctx: CanvasRenderingContext2D, sheet: HTMLImageElement,
  height: number, frame: number, walk?: WalkPose) {
  const size = 432;
  const scale = height / 378;
  ctx.save();
  if (walk) ctx.rotate(walk.lean * .45);
  ctx.drawImage(sheet, frame % 4 * size, Math.floor(frame / 4) * size, size, size,
    -216 * scale, -416 * scale, size * scale, size * scale);
  ctx.restore();
}

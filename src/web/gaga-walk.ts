import type { WalkState } from '../core/types.js';

interface Foot {
  x: number;
  y: number;
}

interface WalkPose {
  rear: Foot;
  lead: Foot;
  lean: number;
  bodyY: number;
}

const neutral: WalkPose = { rear: { x: -41, y: 0 }, lead: { x: 27, y: 0 }, lean: 0, bodyY: 0 };
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

// Source-space cuts on gaga-arcade.webp. The boots tuck under the overlap at the hem.
let masks: { body: Path2D; rearBoot: Path2D; leadBoot: Path2D } | undefined;

function drawPart(ctx: CanvasRenderingContext2D, image: HTMLImageElement, part: Path2D,
  scale: number, anchorX: number, anchorY: number) {
  ctx.save();
  ctx.scale(scale, scale);
  ctx.translate(-anchorX, -anchorY);
  ctx.clip(part);
  ctx.drawImage(image, 0, 0);
  ctx.restore();
}

function drawLeg(ctx: CanvasRenderingContext2D, foot: Foot, hip: number) {
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(hip, -21);
  ctx.quadraticCurveTo(mix(hip, foot.x, .35), -13, foot.x, foot.y - 8);
  ctx.strokeStyle = '#100e17';
  ctx.lineWidth = 15;
  ctx.stroke();
  ctx.strokeStyle = '#433b50';
  ctx.lineWidth = 9;
  ctx.stroke();
}

export function drawGagaWalk(ctx: CanvasRenderingContext2D, sprite: HTMLImageElement, height: number, pose: WalkPose) {
  masks ??= {
    body: new Path2D('M0 0 H408 V460 H337 Q322 459 304 465 L257 476 L244 487 H217 L197 478 H151 L135 484 L99 480 L73 469 L46 465 H0 Z'),
    rearBoot: new Path2D('M0 493 L24 478 L45 467 L62 467 L92 478 L113 488 L121 516 L108 520 H0 Z'),
    leadBoot: new Path2D('M241 498 L263 478 L299 468 Q313 463 329 467 L357 475 L378 501 V520 H240 Z')
  };
  const scale = height / sprite.naturalHeight;
  ctx.save();
  ctx.shadowBlur = 0;
  drawLeg(ctx, pose.rear, -14);
  ctx.save();
  ctx.translate(pose.rear.x, pose.rear.y);
  drawPart(ctx, sprite, masks.rearBoot, scale, 55, 520);
  ctx.restore();
  drawLeg(ctx, pose.lead, 15);
  ctx.save();
  ctx.translate(pose.lead.x, pose.lead.y);
  drawPart(ctx, sprite, masks.leadBoot, scale, 309, 518);
  ctx.restore();
  ctx.translate(0, -20 + pose.bodyY);
  ctx.rotate(pose.lean);
  ctx.translate(0, 20);
  drawPart(ctx, sprite, masks.body, scale, sprite.naturalWidth * .51, sprite.naturalHeight);
  ctx.restore();
}

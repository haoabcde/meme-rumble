import banana from '../../assets/fighters/unified-handdrawn-v1/motion/banana/registered/banana-knockdown.webp';
import gaga from '../../assets/fighters/unified-handdrawn-v1/motion/gaga/registered/gaga-knockdown.webp';
import type { FighterState } from '../core/types.js';
import { drawPixelEffect } from './pixelfx.js';

function load(src: string) {
  const image = new Image();
  image.src = src;
  return image;
}

const sheets: Partial<Record<string, HTMLImageElement>> = {
  banana: load(banana),
  gaga: load(gaga)
};
const tile = { width: 320, height: 280, anchorX: 160, anchorY: 260 };

export function knockdownPose(id: string, fighter: FighterState, riseProgress: number) {
  const { recovery, facing, ground, hp, vy } = fighter;
  const image = sheets[id];
  if ((!recovery && hp) || !image?.naturalWidth) return;
  const phase = recovery?.phase ?? (ground ? 'down' : 'fall');
  const index = phase === 'fall' ? 0 : phase === 'down' ? 1 : riseProgress < .5 ? 2 : 3;
  return { image, index, facing: recovery?.facing ?? facing, tilt: index === 0 ? vy * .009 : 0 };
}

export function drawKnockdownPose(ctx: CanvasRenderingContext2D, pose: NonNullable<ReturnType<typeof knockdownPose>>,
  height: number, reducedMotion: boolean) {
  const { image, index, tilt } = pose;
  const { width, height: tileHeight, anchorX, anchorY } = tile;
  const scale = height / 210;
  if (index === 0 && !reducedMotion) {
    ctx.translate(0, -height * .32);
    ctx.rotate(Math.max(-.16, Math.min(.18, tilt)));
    ctx.translate(0, height * .32);
  }
  ctx.drawImage(image, index % 2 * width, Math.floor(index / 2) * tileHeight, width, tileHeight,
    -anchorX * scale, -anchorY * scale, width * scale, tileHeight * scale);
}

export function drawKnockdownDust(ctx: CanvasRenderingContext2D, age: number) {
  drawPixelEffect(ctx, 'heavyLanding', age * 1.15, 0, 0, 1.28, 1.06);
}

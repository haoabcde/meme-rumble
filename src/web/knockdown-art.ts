import banana from '../../assets/fighters/banana-knockdown.webp';
import bananaJo from '../../assets/fighters/banana-jo-combat.webp';
import gaga from '../../assets/fighters/gaga-knockdown.webp';
import { RISE_FRAMES, type FighterState } from '../core/types.js';
import { drawPixelEffect } from './pixelfx.js';

function load(src: string) {
  const image = new Image();
  image.src = src;
  return image;
}

const sheets: Partial<Record<string, HTMLImageElement>> = {
  banana: load(banana),
  bananaJo: load(bananaJo),
  gaga: load(gaga)
};
const tile = { width: 320, height: 280, anchorX: 160, anchorY: 260 };
const joTile = { width: 384, height: 352, anchorX: 176, anchorY: 334 };

export function knockdownPose(id: string, fighter: FighterState) {
  const { recovery, facing, vy } = fighter;
  const isJo = id === 'banana' && Boolean(fighter.joAwakened) && Boolean(sheets.bananaJo?.naturalWidth);
  const image = isJo ? sheets.bananaJo : sheets[id];
  if (!recovery || !image?.naturalWidth) return;
  const index = recovery.phase === 'fall' ? 0 : recovery.phase === 'down' ? 1
    : recovery.remaining > RISE_FRAMES / 2 ? 2 : 3;
  return { image, index, isJo, facing: recovery.facing ?? facing, tilt: index === 0 ? vy * .009 : 0 };
}

export function drawKnockdownPose(ctx: CanvasRenderingContext2D, pose: NonNullable<ReturnType<typeof knockdownPose>>,
  height: number, reducedMotion: boolean) {
  const { image, index, isJo, tilt } = pose;
  if (isJo) {
    const scale = .5;
    const cell = index <= 1 ? 7 : 6;
    const col = cell % 4;
    const row = Math.floor(cell / 4);
    ctx.save();
    if (index === 1) {
      ctx.translate(0, -18);
      ctx.rotate(-.95);
    } else if (index === 0 && !reducedMotion) {
      ctx.translate(0, -height * .32);
      ctx.rotate(Math.max(-.22, Math.min(.24, tilt)));
      ctx.translate(0, height * .32);
    }
    ctx.drawImage(image, col * joTile.width, row * joTile.height, joTile.width, joTile.height,
      -joTile.anchorX * scale, -joTile.anchorY * scale, joTile.width * scale, joTile.height * scale);
    ctx.restore();
    return;
  }
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

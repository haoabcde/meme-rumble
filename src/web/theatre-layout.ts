import type { ArenaDefinition } from '../core/types.js';

type Theatre = Pick<ArenaDefinition, 'width' | 'height' | 'floor' | 'left' | 'right'>;

// The gilded caps at either end of the apron mark the stops. The fighting
// plane runs between the back rail (row 777) and the gold front lip (849).
const endInset = 42 / 1672;
const floorRow = 812 / 941;

export function placeTheatre(arena: Theatre, imageWidth: number, imageHeight: number) {
  const scale = (arena.right - arena.left) / ((1 - 2 * endInset) * imageWidth);
  const left = arena.left - endInset * imageWidth * scale;
  const width = imageWidth * scale;
  const height = imageHeight * scale;
  const top = arena.floor - height * floorRow;
  return { left, top, width, height, bottom: top + height };
}

export function paintTheatre(ctx: CanvasRenderingContext2D, image: HTMLImageElement, arena: Theatre) {
  const stage = placeTheatre(arena, image.naturalWidth, image.naturalHeight);
  // At maximum pullback the lowest part of the frame looks under the apron.
  if (stage.bottom < arena.height) {
    const shadow = ctx.createLinearGradient(0, stage.bottom, 0, arena.height);
    shadow.addColorStop(0, '#292129');
    shadow.addColorStop(1, '#16121a');
    ctx.fillStyle = shadow;
    ctx.fillRect(0, stage.bottom - 1, arena.width, arena.height - stage.bottom + 1);
  }
  ctx.drawImage(image, stage.left, stage.top, stage.width, stage.height);
}

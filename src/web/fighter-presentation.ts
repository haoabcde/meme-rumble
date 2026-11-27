export type ArtFacing = 'left' | 'right';

export interface FighterArtLayer {
  src: string;
  /** Focal point in source-image coordinates, normalized to [0, 1]. */
  anchor?: { x: number; y: number };
  scale?: number;
  /** The direction the character faces in the source art. */
  facing?: ArtFacing;
  /** Rectangle of essential details in normalized source-image coordinates. */
  safeArea?: { x: number; y: number; width: number; height: number };
}

export interface FighterPresentation {
  victoryArt?: FighterArtLayer;
}

export const fighterPresentation: Readonly<Partial<Record<string, FighterPresentation>>> = {};

function safeAxisScale(anchor: number, start: number, end: number, mirror = false) {
  // Mirroring around the focal point exchanges each edge's distance from the anchor.
  const lower = mirror ? anchor - end : start - anchor;
  const upper = mirror ? anchor - start : end - anchor;
  return Math.min(lower < 0 ? anchor / -lower : Infinity, upper > 0 ? (1 - anchor) / upper : Infinity);
}

export function fitPresentationArt(layer: FighterArtLayer, facing: ArtFacing) {
  const { x, y } = layer.anchor ?? { x: .5, y: .5 };
  const mirror = layer.facing !== undefined && layer.facing !== facing;
  const area = layer.safeArea;
  const scale = Math.min(layer.scale ?? 1, area ? safeAxisScale(x, area.x, area.x + area.width, mirror) : Infinity,
    area ? safeAxisScale(y, area.y, area.y + area.height) : Infinity);
  return { x, y, scale, scaleX: mirror ? -scale : scale };
}

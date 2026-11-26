import type { ArenaDefinition, CombatEvent, ImpactTier } from '../core/types.js';

type Theme = ArenaDefinition['theme'];
type Point = [number, number];

export const comicPalettes = {
  broadcast: { ink: '#201430', paper: '#ffe6bc', key: '#f06b9b', fill: '#79daed', rake: .62 },
  dorm: { ink: '#37283b', paper: '#fff0ba', key: '#ea9f67', fill: '#c6d39d', rake: .36 },
  court: { ink: '#101e37', paper: '#dce8fa', key: '#8aabe6', fill: '#ffb97b', rake: .76 },
  harbor: { ink: '#23263c', paper: '#ffddb0', key: '#e6a174', fill: '#78cbbb', rake: .23 },
  station: { ink: '#211d3e', paper: '#d9dafb', key: '#bc9dea', fill: '#6cdccb', rake: 1.25 }
} satisfies Record<Theme, { ink: string; paper: string; key: string; fill: string; rake: number }>;

function shape(ctx: CanvasRenderingContext2D, color: string | CanvasGradient | CanvasPattern, points: Point[]) {
  ctx.beginPath();
  ctx.moveTo(...points[0]);
  for (let i = 1; i < points.length; i++) ctx.lineTo(...points[i]);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

const dotTiles = new Map<string, HTMLCanvasElement>();
const dotPatterns = new WeakMap<CanvasRenderingContext2D, Map<string, CanvasPattern>>();

function dots(ctx: CanvasRenderingContext2D, color: string) {
  let patterns = dotPatterns.get(ctx);
  if (!patterns) {
    patterns = new Map();
    dotPatterns.set(ctx, patterns);
  }
  const cached = patterns.get(color);
  if (cached) return cached;
  let paper = dotTiles.get(color);
  if (!paper) {
    paper = document.createElement('canvas');
    paper.width = paper.height = 48;
    const tile = paper.getContext('2d')!;
    tile.fillStyle = color;
    for (let row = 0; row < 6; row++) {
      for (let column = 0; column < 6; column++) {
        const radius = (row + column) % 4 === 0 ? 1.7 : 1.15;
        tile.beginPath();
        tile.arc(2 + column * 8 + (row % 2) * 3, 4 + row * 8, radius, 0, Math.PI * 2);
        tile.fill();
      }
    }
    dotTiles.set(color, paper);
  }
  const pattern = ctx.createPattern(paper, 'repeat')!;
  patterns.set(color, pattern);
  return pattern;
}

export function drawComicAtmosphere(ctx: CanvasRenderingContext2D, arena: ArenaDefinition, center: number, span: number) {
  const { ink, key, fill, paper, rake } = comicPalettes[arena.theme];
  const reach = span * .66;
  const y = arena.floor;
  const top = y - Math.min(650, span * .56);
  const left = center - reach;
  const right = center + reach;
  const crowd = arena.theme === 'broadcast';
  ctx.save();
  if (span >= arena.width) ctx.globalAlpha *= .68;
  // Shape the distant print planes before drawing walkable props, which stay crisp.
  const tint = ctx.createLinearGradient(left, top, right, y);
  tint.addColorStop(0, ink + 'bb');
  tint.addColorStop(.48, key + '12');
  tint.addColorStop(1, fill + '3d');
  shape(ctx, tint, [[left, top - 90], [left + reach * .88, top], [right, y - 122], [right, y + 18], [left, y + 18]]);

  const slope = Math.min(reach * .45, (y - top) * rake);
  const cut: Point[] = [[left, y - 126], [left, top - 98], [left + reach * (crowd ? .30 : .43), top - 98],
    [left + reach * .4 + slope * (crowd ? .36 : .66), y - 232]];
  shape(ctx, ink + '4c', cut);
  shape(ctx, dots(ctx, paper + (crowd ? '32' : '48')), cut);
  const other: Point[] = [[right, top - 120], [right - reach * .26, top - 76],
    [right - reach * (crowd ? .32 : .39) - slope * (crowd ? .28 : .49), y - 108], [right, y - 179]];
  shape(ctx, key + '25', other);
  shape(ctx, dots(ctx, ink + '69'), other);

  const beam = ctx.createLinearGradient(0, top - 95, 0, y);
  beam.addColorStop(0, paper + '10');
  beam.addColorStop(.52, key + (crowd ? '35' : '38'));
  beam.addColorStop(1, key + '00');
  const anchor = (arena.spawn[0] + arena.spawn[1]) / 2;
  const lamp = (anchor - center) * .16 + center;
  shape(ctx, beam, [[lamp - 270, top - 120], [lamp - 204, top - 120], [lamp + rake * 94, y], [lamp - 351, y]]);
  const bounceX = lamp + Math.min(350, span * .32);
  const bounceY = y - 199;
  const bounce = ctx.createRadialGradient(bounceX, bounceY, 8, bounceX, bounceY, 170);
  bounce.addColorStop(0, fill + '3d');
  bounce.addColorStop(1, fill + '00');
  ctx.fillStyle = bounce;
  ctx.fillRect(bounceX - 170, bounceY - 170, 340, 340);
  ctx.restore();
}

export function drawComicFloor(ctx: CanvasRenderingContext2D, arena: ArenaDefinition) {
  const { ink, paper, key, fill, rake } = comicPalettes[arena.theme];
  const { floor, left, right, height, spawn } = arena;
  const center = (spawn[0] + spawn[1]) * .5;
  const depth = Math.min(222, height - floor);
  const bottom = floor + depth;
  const bevel = floor + 46;
  const apron = ctx.createLinearGradient(0, floor + 12, 0, bottom);
  apron.addColorStop(0, ink + '00');
  apron.addColorStop(.48, ink + '7e');
  apron.addColorStop(1, ink + 'e9');
  ctx.fillStyle = apron;
  ctx.fillRect(left, floor + 12, right - left, depth - 12);
  const band: Point[] = [[left, bevel + 24], [center - 148, bevel + 12],
    [center + 115, bevel + 36], [right, bevel + 18], [right, bottom], [left, bottom]];
  shape(ctx, key + '32', band);
  shape(ctx, dots(ctx, paper + '46'), band);

  if (arena.theme === 'court') {
    ctx.save();
    ctx.strokeStyle = paper + 'b0';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.ellipse(center, floor + 57, 219, 43, 0, .05, Math.PI - .05);
    ctx.stroke();
    ctx.strokeStyle = fill + '8b';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(center, floor + 56, 252, 57, 0, .1, Math.PI - .1);
    ctx.stroke();
    ctx.restore();
    return;
  }
  if (arena.theme === 'dorm') {
    for (const side of [-1, 1]) {
      const x = center + side * 199;
      const y = floor + 62;
      shape(ctx, key + '45', [[x - 125, y], [x + 119, y], [x + 82, y + 45], [x - 162, y + 45]]);
      for (let i = 0; i < 4; i++) {
        const mark = x - 98 + i * 58;
        shape(ctx, paper + '55', [[mark, y + 13], [mark + 26, y + 13], [mark + 8, y + 31], [mark - 17, y + 31]]);
      }
    }
    return;
  }
  if (arena.theme === 'harbor') {
    const y = floor + 74;
    for (const side of [-1, 1]) {
      const x = center + side * 137;
      shape(ctx, ink + 'b3', [[x - 85, y], [x + 105, y], [x + 91, y + 29], [x - 99, y + 29]]);
      for (let i = 0; i < 5; i++) {
        const left = x - 66 + i * 35;
        shape(ctx, paper + 'a5', [[left, y + 5], [left + 15, y + 5], [left + 2, y + 23], [left - 13, y + 23]]);
      }
    }
    return;
  }
  if (arena.theme === 'station') {
    const y = floor + 59;
    ctx.save();
    ctx.strokeStyle = fill + '9d';
    ctx.lineWidth = 3;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(center + side * 46, y);
      ctx.lineTo(center + side * 110, y);
      ctx.lineTo(center + side * 163, y + 36);
      ctx.lineTo(center + side * 303, y + 36);
      ctx.stroke();
      shape(ctx, paper + 'af', [[center + side * 303, y + 30], [center + side * 317, y + 36],
        [center + side * 303, y + 42], [center + side * 288, y + 36]]);
    }
    shape(ctx, ink + 'c3', [[center - 65, y + 8], [center + 65, y + 8], [center, y + 65]]);
    shape(ctx, key + 'bf', [[center - 23, y + 18], [center + 23, y + 18], [center, y + 37]]);
    ctx.restore();
    return;
  }

  // Offset plates read as printed foreground faces, below the support line.
  const plateWidth = 320;
  const slant = 44 + rake * 18;
  const leftEdge = center - plateWidth;
  const rightEdge = center + plateWidth;
  shape(ctx, ink + 'c2', [[leftEdge, bevel + 22], [rightEdge, bevel + 22],
    [rightEdge - slant, bevel + 75], [leftEdge - slant, bevel + 75]]);
  shape(ctx, fill + '96', [[leftEdge, bevel + 22], [rightEdge, bevel + 22],
    [rightEdge - 9, bevel + 34], [leftEdge - 9, bevel + 34]]);
  for (const side of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      const x = center + side * (plateWidth - 41 - i * 35);
      shape(ctx, key + (i === 0 ? 'b0' : '78'), [[x - 10, bevel + 37], [x + 12, bevel + 37],
        [x - 12, bevel + 65], [x - 34, bevel + 65]]);
    }
  }
  ctx.fillStyle = paper + '8b';
  ctx.fillRect(center - 72, bevel + 44, 144, 3);
  ctx.fillStyle = fill + '76';
  ctx.fillRect(center - 42, bevel + 55, 84, 3);
}

type CombatBeat = { strength: number; age: number; direction: -1 | 0 | 1; color: string };

const panelWeights: Partial<Record<ImpactTier, number>> = {
  medium: .22, heavy: .73, launch: .57, guard: .16, 'guard-break': .66, parry: .31, ultimate: 1
};

export function comicBeat(event: CombatEvent, tier: ImpactTier, age: number, reducedMotion: boolean): CombatBeat | undefined {
  const weight = panelWeights[tier];
  if (!weight || reducedMotion || age < 0 || age >= 8 || (event.hitstop !== undefined && event.hitstop <= 1)) return;
  const strength = weight * (1 - age / 8) ** 1.7 * (event.trade ? .63 : 1);
  const direction = event.trade ? 0 : event.direction ?? event.facing ?? 0;
  const color = tier === 'guard' ? '#8de9ff' : tier === 'ultimate' ? '#ffde95' : event.feedback?.color ?? '#ffce8c';
  return { strength, age, direction, color };
}

export function drawComicImpactPanel(ctx: CanvasRenderingContext2D, x: number, y: number, beat: CombatBeat,
  theme: Theme) {
  const { ink } = comicPalettes[theme];
  const { width, height } = ctx.canvas;
  const { strength, age, direction, color } = beat;
  const impactX = Math.max(width * .18, Math.min(width * .82, x));
  const impactY = Math.max(height * .28, Math.min(height * .84, y));
  ctx.save();
  ctx.resetTransform();
  // Keep the high-contrast shapes to the inset panel margins, behind the fighters.
  const edge = (right: boolean) => {
    const edgeX = right ? width : 0;
    const side = right ? -1 : 1;
    const flare = direction === 0 || direction === side ? 1 : .47;
    const length = (48 + 160 * strength) * flare;
    ctx.globalAlpha = .48 * strength;
    shape(ctx, ink, [[edgeX, height * .11], [edgeX + side * length, height * .34],
      [edgeX + side * length * .5, height * .52], [edgeX + side * length * 1.24, height * .8], [edgeX, height * .93]]);
    ctx.globalAlpha = .83 * strength;
    for (let i = 0; i < 5; i++) {
      const originY = height * (.24 + i * .139);
      const reach = length * (.6 + (i * 7 % 4) * .15);
      const tipX = edgeX + side * reach;
      const tipY = originY + (impactY - originY) * (reach / Math.abs(impactX - edgeX));
      shape(ctx, i % 2 === 0 ? color : ink, [[edgeX, originY - 3], [tipX, tipY], [edgeX, originY + 6 + age * .1]]);
    }
  };
  edge(false);
  edge(true);
  ctx.restore();
}

const frames = new Map<string, HTMLCanvasElement>();

export function drawComicFrame(ctx: CanvasRenderingContext2D, theme: Theme, speed: -1 | 0 | 1) {
  const { width, height } = ctx.canvas;
  const { ink, key, fill } = comicPalettes[theme];
  const cacheKey = theme + ':' + width + ':' + height;
  let panel = frames.get(cacheKey);
  if (!panel) {
    panel = document.createElement('canvas');
    panel.width = width;
    panel.height = height;
    const trim = panel.getContext('2d')!;
    const lower = height - 74;
    for (const side of [-1, 1]) {
      const edge = side < 0 ? width : 0;
      shape(trim, ink + 'db', [[edge, height * .3], [edge + side * 15, height * .49],
        [edge + side * 8, lower - 8], [edge + side * 76, height - 24], [edge + side * 118, height], [edge, height]]);
      shape(trim, (side > 0 ? fill : key) + 'bb', [[edge, height * .61], [edge + side * 8, height * .7],
        [edge + side * 6, lower - 5], [edge + side * 72, height - 18], [edge + side * 56, height - 19], [edge, lower]]);
      const field: Point[] = [[edge, height * .51], [edge + side * 30, height * .68],
        [edge + side * 60, height - 25], [edge, height]];
      shape(trim, dots(trim, (side > 0 ? fill : key) + '92'), field);
    }
    frames.set(cacheKey, panel);
  }
  ctx.drawImage(panel, 0, 0);
  if (!speed) return;
  const x = speed > 0 ? 0 : width;
  const color = speed > 0 ? fill : key;
  for (const [i, y] of [height * .31, height * .51, height * .66].entries()) {
    shape(ctx, color + '84', [[x, y], [x + speed * (95 - 15 * i), y + 33], [x, y + 6]]);
  }
}

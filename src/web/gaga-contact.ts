import { gagaActionIds } from '../content/fighters/gaga.js';
import type { CombatEvent, MatchConfig } from '../core/types.js';

export type GagaContact = 'light' | 'medium' | 'heavy' | 'pole' | 'lift' | 'slide' | 'guard';
/** Contacts still drawn as motion lines. Blocks get their own feedback in gaga-hit-art.ts. */
type Streak = Exclude<GagaContact, 'guard'>;

export function gagaContact(event: CombatEvent, fighters: MatchConfig['fighters']): GagaContact | undefined {
  const fromGaga = fighters[event.source].id === 'gaga';
  if (event.kind === 'block' && (fromGaga || fighters[1 - event.source].id === 'gaga')) return 'guard';
  if (event.kind !== 'hit' || !fromGaga) return undefined;
  if (event.actionId === gagaActionIds.lift || event.actionId === gagaActionIds.poleLaunch) return 'lift';
  if (event.actionId === gagaActionIds.poleSweep || event.actionId === gagaActionIds.poleBacksweep) return 'pole';
  if (event.actionId === gagaActionIds.slide) return 'slide';
  return event.impact ?? 'light';
}

const look: Record<Streak, { color: string; width: number; height: number; spread: number }> = {
  light: { color: '#ffdc91', width: 27, height: 19, spread: 39 },
  medium: { color: '#ffd08c', width: 43, height: 31, spread: 60 },
  heavy: { color: '#ffae61', width: 63, height: 40, spread: 90 },
  pole: { color: '#ffd477', width: 54, height: 22, spread: 63 },
  lift: { color: '#85e3ff', width: 31, height: 56, spread: 69 },
  slide: { color: '#ffcf8d', width: 69, height: 16, spread: 81 }
};

function streak(ctx: CanvasRenderingContext2D, x: number, y: number, length: number, width: number, angle: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.beginPath();
  ctx.moveTo(-length * .72, 0);
  ctx.lineTo(0, -width);
  ctx.lineTo(length * .28, 0);
  ctx.lineTo(0, width);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** Motion lines for contacts outside the burst table, such as the summon catch. */
export function drawGagaContact(ctx: CanvasRenderingContext2D, cue: Streak, age: number, facing = 1) {
  if (age >= 13) return;
  const { color, width, height, spread } = look[cue];
  const phase = age / 13;
  ctx.save();
  ctx.globalAlpha = (1 - phase) ** 1.35;
  ctx.scale(facing, 1);
  ctx.fillStyle = color;

  const angle = cue === 'lift' ? -1.5 : cue === 'slide' ? -.07 : -.23;
  const pop = .75 + phase * .48;
  streak(ctx, 0, -age * (cue === 'lift' ? 1.5 : .2), Math.max(width, height) * 1.85 * pop, Math.min(width, height) * .38, angle);
  streak(ctx, 0, 0, Math.min(width, height) * 1.32 * pop, Math.max(width, height) * .09, angle + Math.PI / 2);
  if (age < 4) {
    ctx.fillStyle = '#fff8df';
    streak(ctx, 0, 0, Math.max(width, height) * .9, Math.min(width, height) * .2, angle);
    ctx.fillStyle = color;
  }

  if (cue === 'heavy' || cue === 'medium') {
    ctx.strokeStyle = color;
    ctx.lineWidth = cue === 'heavy' ? 4 - phase * 2 : 2.5;
    ctx.beginPath();
    ctx.ellipse(0, 0, width * (.62 + phase), height * (.65 + phase * .84), -.14, 0, Math.PI * 2);
    ctx.stroke();
  }

  const angles = cue === 'lift' ? [-2.08, -1.66, -1.2, -.83] :
    cue === 'slide' ? [-.4, -.17, .14, .34, 2.95] : [-2.8, -1.15, -.57, .31, 1.16, 2.6];
  for (const [index, angle] of angles.entries()) {
    const radius = spread * (.22 + phase * (.8 + index * .035));
    const x = radius * Math.cos(angle);
    const y = radius * Math.sin(angle) * (cue === 'slide' ? .52 : 1);
    streak(ctx, x, y, (9 + index * 2) * (1 - phase * .55), 2 * (1 - phase), angle);
  }
  ctx.restore();
}

export function drawGagaReceive(ctx: CanvasRenderingContext2D, age: number, facing = 1) {
  if (age >= 9) return;
  const phase = age / 9;
  ctx.save();
  ctx.globalAlpha = (1 - phase) * .72;
  ctx.scale(facing, 1);
  ctx.fillStyle = '#c6bcff';
  streak(ctx, 14 + age * 3, -13 - age, 19 - age, 2.8, -.62);
  streak(ctx, 23 + age * 3.4, 10 + age, 17 - age, 2.2, .34);
  ctx.restore();
}

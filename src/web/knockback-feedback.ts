import type { FighterState } from '../core/types.js';

// A small motion cue stays behind the victim, so it reinforces the actual
// knockback direction without covering the character or the HUD.
export function drawKnockbackStreak(ctx: CanvasRenderingContext2D, fighter: FighterState,
  bodyWidth: number, reducedMotion: boolean, bounds: { left: number; right: number }) {
  const push = fighter.push;
  if (reducedMotion || !fighter.hp || Math.abs(push) < 3 ||
      (push < 0 && fighter.x <= bounds.left) || (push > 0 && fighter.x >= bounds.right) ||
      (!fighter.hitstun && !fighter.launched && fighter.recovery?.phase !== 'fall')) return;
  const direction = Math.sign(push);
  const distance = Math.min(45, 14 + Math.abs(push) * 2);
  const start = fighter.x - direction * (bodyWidth * .55 + 8);
  ctx.save();
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#fff1ca';
  ctx.globalAlpha = .36;
  for (let i = 0; i < 2; i++) {
    const y = fighter.y - 12 - i * 10;
    ctx.lineWidth = i ? 2 : 3;
    ctx.beginPath();
    ctx.moveTo(start, y);
    ctx.lineTo(start - direction * distance * (i ? .7 : 1), y);
    ctx.stroke();
  }
  ctx.restore();
}

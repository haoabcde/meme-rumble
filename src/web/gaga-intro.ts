import { gagaIntroBeats, gagaIntroPose } from './art.js';
import { gagaActionIds } from '../content/fighters/gaga.js';
import { easeIn, easeOut, type FighterIntro } from './cinematics.js';

// The opening countdown runs this long whenever a fighter brings an entrance.
const frames = 192;
// The last stretch walked in from behind the opening mark, and how long the walk takes.
const walkIn = 150, arriving = 34;
// The camera settles on the two-shot over these frames, then hands back to the play camera from this one.
const settling = 24, leaving = 150;

const shift = (frame: number) => -walkIn * (1 - easeOut(frame / arriving));

/** Gaga reports in: walks the last stretch into place, reaches for the terminal, presses it and points at the opponent. */
export const gagaIntro: FighterIntro = {
  frames,
  pose: gagaIntroPose,
  shift,
  travelled: frame => walkIn + shift(frame),
  close: frame => Math.min(easeOut(frame / settling), 1 - easeIn((frame - leaving) / (frames - leaving))),
  cues: [
    { at: 12, sound: { kind: 'land' } }, { at: 26, sound: { kind: 'land' } },
    { at: gagaIntroBeats.press + 8, sound: { kind: 'summon-confirm' } },
    // The calling sample goes with the pointing pose, which is the one with the mouth open.
    { at: gagaIntroBeats.point, sound: { kind: 'swing', actionId: gagaActionIds.slide } }
  ],
  effect(ctx, frame, fighter) {
    ctx.save();
    // Marks are authored facing right from the feet.
    ctx.translate(fighter.x + shift(frame) * fighter.facing, fighter.y);
    ctx.scale(fighter.facing, 1);
    const pressed = frame - (gagaIntroBeats.press + 7);
    if (pressed >= 0 && pressed < 16) {
      // A ring runs out from where the lit screen sits on the pressed pose.
      const reach = easeOut(pressed / 16);
      if (pressed < 6) {
        const flash = ctx.createRadialGradient(9, -67, 0, 9, -67, 40);
        flash.addColorStop(0, `rgba(225, 255, 255, ${.9 * (1 - pressed / 6)})`);
        flash.addColorStop(1, '#5bd9ff00');
        ctx.fillStyle = flash;
        ctx.fillRect(-31, -107, 80, 80);
      }
      ctx.globalAlpha = (1 - reach) ** 1.2;
      ctx.strokeStyle = '#5bd9ff';
      ctx.lineWidth = 5 * (1 - reach) + 1;
      ctx.beginPath();
      ctx.arc(9, -67, 12 + reach * 46, 0, Math.PI * 2);
      ctx.stroke();
    }
    const shout = frame - gagaIntroBeats.point;
    if (shout >= 0 && shout < 20) {
      // Speed lines off the pointing flipper.
      const reach = easeOut(shout / 7);
      ctx.globalAlpha = 1 - shout / 20;
      ctx.strokeStyle = '#fff1c0';
      ctx.lineCap = 'round';
      ctx.lineWidth = 4;
      for (let line = -1; line <= 1; line++) {
        ctx.beginPath();
        ctx.moveTo(82, -93 + line * 8);
        ctx.lineTo(82 + (32 + 26 * reach) * (line ? .72 : 1), -93 + line * (8 + 14 * reach));
        ctx.stroke();
      }
    }
    ctx.restore();
  }
};

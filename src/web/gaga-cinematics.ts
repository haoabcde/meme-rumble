import { sprites } from './art.js';
import { summonAtlas, summonPoses } from './dijiang.js';
import { beatFrames, easeIn, easeOut, fadeSince, noise, type Cinematic, type FeatureShot } from './cinematics.js';
import { drawFocusLines, drawPoseFlash, drawShotBars, drawSparkle } from './cutin-art.js';

const gold = '#ffe387';
const ink = '#060a1c';
const candy = ['#ffffff', '#ff4f86', '#2f8fff', '#8a5cff', '#12b981'];
const syllables = ['#ff4f86', '#2f8fff', '#8a5cff', '#ff7a1f', '#12b981'];

// The victory opens on a title card, then hands over to the sing-along through a widening circle.
const card = 34, iris = 28;

function drawWinCard(ctx: CanvasRenderingContext2D, shot: FeatureShot) {
  const { width, height } = ctx.canvas;
  const unit = height / 720;
  const { frame } = shot;
  const middle = width / 2;
  const rattle = fadeSince(frame, 11, 5) * 4 * unit;
  ctx.save();
  ctx.translate(Math.sin(frame * 9.7) * rattle, Math.cos(frame * 8.3) * rattle);
  ctx.fillStyle = '#2a1a4d';
  ctx.fillRect(-20, -20, width + 40, height + 40);
  ctx.save();
  ctx.translate(middle, height / 2);
  ctx.rotate(-.42);
  const slide = frame * 22 * unit;
  ctx.fillStyle = '#3a2668';
  for (let x = -width * 1.7; x < width * 1.7; x += 230 * unit) {
    ctx.fillRect(x - slide, -height * 1.7, 104 * unit, height * 3.4);
  }
  ctx.restore();
  drawFocusLines(ctx, width * .36, height * .40, fadeSince(frame, 2, 10), 300, unit);

  // The word takes the left of the card and the fighter the right, so both stay readable.
  const slam = easeOut((frame - 3) / 8);
  ctx.save();
  ctx.translate(width * .36, height * .38);
  ctx.scale(3 - 2 * slam, 3 - 2 * slam);
  ctx.globalAlpha = Math.max(0, Math.min(1, (frame - 3) / 2));
  ctx.font = `italic 1000 ${260 * unit}px system-ui`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 30 * unit;
  ctx.strokeStyle = ink;
  ctx.strokeText('WIN', 0, 0);
  const sheen = ctx.createLinearGradient(0, -130 * unit, 0, 130 * unit);
  sheen.addColorStop(0, '#fff8cf');
  sheen.addColorStop(.5, gold);
  sheen.addColorStop(1, '#f0ad35');
  ctx.fillStyle = sheen;
  ctx.fillText('WIN', 0, 0);
  ctx.restore();

  if (summonAtlas.naturalWidth) {
    const [sx, sy, sw, sh] = summonPoses[3];
    const scale = (1.9 - .38 * easeOut((frame - 2) / 9)) * unit;
    const w = sw * scale, h = sh * scale;
    const x = width * .66 - w / 2, y = (height - h) * .40 + 20 * unit;
    if (frame === 2) drawPoseFlash(ctx, summonAtlas, summonPoses[3], x, y, w, h, shot.color);
    else ctx.drawImage(summonAtlas, sx, sy, sw, sh, x, y, w, h);
  }

  const title = shot.seat + ' · ' + shot.name + ' 获胜';
  ctx.font = `900 ${40 * unit}px system-ui`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 9 * unit;
  ctx.strokeStyle = ink;
  ctx.strokeText(title, middle, height * .932);
  ctx.fillStyle = '#fff8e2';
  ctx.fillText(title, middle, height * .932);
  ctx.restore();
}

function drawSingAlong(ctx: CanvasRenderingContext2D, shot: FeatureShot, local: number) {
  const { width, height } = ctx.canvas;
  const unit = height / 720;
  const { frame, tempo } = shot;
  const pulse = tempo.pulse(frame);
  const middle = width / 2;

  ctx.fillStyle = '#ffcf33';
  ctx.fillRect(0, 0, width, height);
  const reach = Math.hypot(width, height) * .64 * (1 + pulse * .04);
  ctx.save();
  ctx.translate(middle, height * .46);
  ctx.fillStyle = '#ffb01f';
  for (let i = 0; i < 32; i += 2) {
    const angle = local * .0045 + i / 32 * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, reach, angle, angle + Math.PI * 2 / 32);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
  if (pulse > 0) {
    ctx.globalAlpha = pulse * .3;
    ctx.fillStyle = '#fffbe0';
    ctx.fillRect(0, 0, width, height);
    ctx.globalAlpha = 1;
  }
  const halo = ctx.createRadialGradient(middle, height * .5, 0, middle, height * .5, height * .5);
  halo.addColorStop(0, '#fff3b84d');
  halo.addColorStop(1, '#fff3b800');
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, width, height);

  // Confetti is already in the air when the sing-along opens.
  for (let i = 0; i < 70; i++) {
    const speed = (3.2 + noise(i + 11) * 3.4) * unit;
    const y = ((local + 40) * speed + noise(i + 3) * height * 1.2) % (height * 1.16) - height * .08;
    const size = (11 + noise(i + 5) * 12) * unit;
    ctx.save();
    ctx.translate(noise(i + 1) * width + Math.sin(local * .045 + i * 1.9) * 34 * unit, y);
    ctx.rotate(noise(i + 7) * 6 + local * (.04 + noise(i + 9) * .08));
    ctx.scale(Math.cos(local * .13 + i * 2.3), 1);
    ctx.fillStyle = candy[i % candy.length];
    ctx.fillRect(-size / 2, -size * .3, size, size * .6);
    ctx.restore();
  }

  const sprite = sprites.gaga;
  if (sprite.naturalWidth) {
    const h = height * .70, w = h * sprite.naturalWidth / sprite.naturalHeight;
    const footX = middle, footY = height * .81;
    const hop = pulse ** .7 * 30 * unit;
    ctx.save();
    // Each beat sends a ring out along the floor.
    ctx.lineCap = 'round';
    for (const at of tempo.beats) {
      const age = frame - at;
      if (age < 0 || age >= 16) continue;
      const spread = easeOut(age / 16);
      ctx.globalAlpha = (1 - spread) * .85;
      ctx.strokeStyle = '#fff6cf';
      ctx.lineWidth = 7 * unit * (1 - spread) + 1;
      ctx.beginPath();
      ctx.ellipse(footX, footY, spread * w * .8, spread * w * .14, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = .32;
    ctx.fillStyle = '#b35900';
    ctx.beginPath();
    ctx.ellipse(footX, footY + 6 * unit, w * .36 * (1 - pulse * .22), 15 * unit * (1 - pulse * .2), 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.globalAlpha = 1;
    // Land stretched tall on the beat and settle back, leaning the other way each time.
    const stretch = Math.sin(pulse * Math.PI);
    ctx.save();
    ctx.translate(footX, footY - hop);
    ctx.rotate(tempo.sway(frame) * .11);
    ctx.scale(1 - .085 * stretch, 1 + .115 * stretch);
    ctx.drawImage(sprite, -w / 2, -h, w, h);
    ctx.restore();

    const mouthX = footX - w / 2 + w * .576, mouthY = footY - hop - h * .53;
    const first = tempo.count - tempo.beats.length;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    for (const [index, at] of tempo.beats.entries()) {
      const age = frame - at;
      if (age < 0 || age > 60) continue;
      const beat = first + index;
      const life = age / 60;
      const side = beat % 2 ? 1 : -1;
      const pop = Math.min(1, age / 4);
      const x = mouthX + side * (46 + life * 150) * unit + Math.sin(age * .18) * 16 * unit;
      const y = mouthY - 20 * unit - life * 250 * unit;
      // Every sung syllable leaves the mouth as a bouncing character of its own.
      ctx.globalAlpha = (1 - life ** 2.2) * pop;
      ctx.font = `900 italic ${(58 + 26 * pop) * unit * (1 - life * .3)}px system-ui`;
      ctx.lineWidth = 9 * unit;
      ctx.strokeStyle = '#5a2a00';
      ctx.strokeText('啦', x, y);
      ctx.fillStyle = syllables[beat % syllables.length];
      ctx.fillText('啦', x, y);
      const twinkle = fadeSince(age, 0, 22);
      ctx.fillStyle = '#ffffff';
      for (let k = 0; k < 3; k++) {
        const angle = noise(beat * 7 + k) * Math.PI * 2;
        const distance = w * (.5 + noise(beat * 13 + k) * .3);
        ctx.globalAlpha = twinkle * pop;
        drawSparkle(ctx, footX + Math.cos(angle) * distance, footY - h * .5 + Math.sin(angle) * distance * .8,
          (10 + noise(beat * 17 + k) * 12) * unit * (.5 + twinkle * .5));
      }
    }
    ctx.globalAlpha = 1;
  }
}

function drawLyrics(ctx: CanvasRenderingContext2D, shot: FeatureShot) {
  const { width, height } = ctx.canvas;
  const unit = height / 720;
  const { tempo } = shot;
  const count = 7;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let i = 0; i < count; i++) {
    // The syllable struck by the latest beat bounces; the others wait their turn.
    const live = tempo.count > 0 && (tempo.count - 1) % count === i;
    const lift = live ? tempo.pulse(shot.frame) : 0;
    ctx.globalAlpha = live ? 1 : .6;
    ctx.font = `900 italic ${(38 + lift * 24) * unit}px system-ui`;
    ctx.fillStyle = live ? syllables[(tempo.count - 1) % syllables.length] : '#fff8e2';
    ctx.fillText('啦', width / 2 + (i - (count - 1) / 2) * 76 * unit, height * .932 - lift * 12 * unit);
  }
  ctx.globalAlpha = .6;
  ctx.font = `900 italic ${40 * unit}px system-ui`;
  ctx.fillStyle = '#fff8e2';
  ctx.fillText('～', width / 2 + count / 2 * 76 * unit + 6 * unit, height * .925);
  ctx.globalAlpha = 1;
}

function drawVictory(ctx: CanvasRenderingContext2D, shot: FeatureShot) {
  const { width, height } = ctx.canvas;
  const { frame } = shot;
  ctx.save();
  ctx.resetTransform();
  if (frame < 2) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
  } else {
    if (frame >= iris) drawSingAlong(ctx, shot, frame - card);
    const open = easeIn((frame - iris) / (card - iris));
    if (open < 1) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, width, height);
      ctx.arc(width / 2, height * .44, open * Math.hypot(width, height) * .62, 0, Math.PI * 2, true);
      ctx.clip('evenodd');
      drawWinCard(ctx, shot);
      ctx.restore();
    }
    drawShotBars(ctx, shot);
    drawLyrics(ctx, shot);
  }
  ctx.restore();
}

/** The victory shot: a WIN card, then a sing-along that moves to the voice recording. */
export const gagaVictory: Cinematic = {
  // Six syllables at the stand-in tempo; a voice recording sets the length instead.
  frames: card + 6 * beatFrames + 18, fade: 18,
  sound: 'victory-lalala', soundAt: card, beatFrom: card,
  cues: [{ at: 11, sound: 'summon-catch' }],
  paint: drawVictory
};

import portrait from '../../assets/fighters/gaga-original-handdrawn-v1/motion/registered/gaga-dijiang.webp';
import ship from '../../assets/props/dijiang-impact.webp';
import { dijiangPitch, dijiangTip, summonArea, summonFallFrames, summonImpactFrames } from '../core/summon.js';
import type { Summon } from '../core/types.js';
import { dijiangBurialTip } from './camera.js';

export const dijiangImpactLife = 84;

export const summonAtlas = new Image();
summonAtlas.src = portrait;
const shipArt = new Image();
shipArt.src = ship;

const portraits = [
  [160, 8, 445, 393], [920, 8, 437, 386], [163, 520, 464, 387], [932, 516, 431, 382]
] as const;

export function drawSummonCutIn(ctx: CanvasRenderingContext2D, frame: number, reducedMotion: boolean) {
  const { width, height } = ctx.canvas;
  const unit = height / 720;
  const actionShot = frame >= 16;
  const pose = frame < 10 ? 0 : frame < 29 ? 1 : frame < 38 ? 2 : 3;
  ctx.save();
  ctx.resetTransform();
  ctx.fillStyle = '#060a1cf5';
  ctx.fillRect(0, 0, width, height);

  const light = ctx.createRadialGradient(width / 2, height * .45, 0, width / 2, height * .45, height * .7);
  light.addColorStop(0, actionShot ? '#2086a7a3' : '#273f7eb3');
  light.addColorStop(1, '#080d23');
  ctx.fillStyle = light;
  ctx.fillRect(0, 0, width, height);
  if (!reducedMotion) {
    ctx.strokeStyle = '#5bd9ff37';
    ctx.lineWidth = 2 * unit;
    for (const side of [-1, 1]) {
      for (let n = 0; n < 7; n++) {
        const y = height * (.14 + n * .112);
        const offset = ((frame * 11 + n * 29) % 145) * unit;
        const x = width / 2 + side * (width * .29 + offset);
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + side * (42 + n * 6) * unit, y - 21 * unit);
        ctx.stroke();
      }
    }
  }
  if (summonAtlas.naturalWidth) {
    const [sx, sy, sw, sh] = portraits[pose];
    const scale = Math.min((actionShot ? 1.62 : 1.35) * unit, width * .83 / sw);
    const drift = reducedMotion ? 0 : Math.min(frame % 16, 7) * .45 * unit;
    ctx.drawImage(summonAtlas, sx, sy, sw, sh,
      (width - sw * scale) / 2, (height - sh * scale) * .45 + drift, sw * scale, sh * scale);
  }
  ctx.fillStyle = '#030718';
  ctx.fillRect(0, 0, width, height * .065);
  ctx.fillRect(0, height * .86, width, height * .14);
  ctx.fillStyle = '#e6f8ff';
  ctx.font = `900 ${38 * unit}px system-ui`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('召唤 · 帝江号', width / 2, height * .933);
  ctx.restore();
}

export function drawDijiangPressure(ctx: CanvasRenderingContext2D, x: number, y: number,
  progress: number, reducedMotion: boolean, fade = 1) {
  const { width, height } = ctx.canvas;
  const view = ctx.getTransform();
  const targetX = view.a * x + view.e;
  const targetY = view.d * y + view.f;
  const strength = fade * (.32 + progress * .68) * (reducedMotion ? .62 : 1);

  ctx.save();
  ctx.resetTransform();
  ctx.globalAlpha = strength;
  const shadow = ctx.createRadialGradient(targetX, targetY - height * .16, height * .08,
    targetX, targetY - height * .16, Math.max(width, height) * .65);
  shadow.addColorStop(0, '#1e1b4366');
  shadow.addColorStop(.44, '#100f33b9');
  shadow.addColorStop(1, '#070819ee');
  ctx.fillStyle = shadow;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1, .17);
  ctx.globalAlpha = strength;
  const radius = 260 + (1 - progress) * 140;
  const floorShadow = ctx.createRadialGradient(0, 0, radius * .12, 0, 0, radius);
  floorShadow.addColorStop(0, '#100d1bf9');
  floorShadow.addColorStop(.55, '#100d1bc4');
  floorShadow.addColorStop(1, '#100d1b00');
  ctx.fillStyle = floorShadow;
  ctx.fillRect(-radius, -radius, radius * 2, radius * 2);
  ctx.restore();
}

function drawDiveWind(ctx: CanvasRenderingContext2D, tip: { x: number; y: number },
  length: number, facing: -1 | 1, progress: number, reducedMotion: boolean) {
  ctx.save();
  ctx.translate(tip.x, tip.y);
  ctx.scale(facing, 1);
  ctx.rotate(dijiangPitch);
  for (const side of [-1, 1]) {
    for (let i = 0; i < (reducedMotion ? 3 : 10); i++) {
      const drift = reducedMotion ? i * .065 : (i * .079 - progress * .85 + 1) % .55;
      const x = length * (-.04 - drift);
      const y = side * length * (.036 + i % 3 * .022 + drift * .12);
      const width = length * (.06 + i % 4 * .029) * (.65 + progress * .55);
      ctx.globalAlpha = (.36 + progress * .50) * (1 - drift * 1.3);
      ctx.fillStyle = i % 3 === 0 ? '#e7fbff' : '#91d4f3';
      ctx.beginPath();
      ctx.moveTo(x + width * .16, y);
      ctx.lineTo(x - width * .25, y + side * (3 + i % 3 * 2));
      ctx.lineTo(x - width, y + side * width * .085);
      ctx.lineTo(x - width * .22, y - side);
      ctx.closePath();
      ctx.fill();
    }
  }
  if (progress > .3) {
    const span = length * (.041 + progress * .023);
    ctx.globalAlpha = Math.min(1, (progress - .3) * 2) * (reducedMotion ? .52 : .93);
    const bow = ctx.createLinearGradient(-span * 1.28, 0, -span * .24, 0);
    bow.addColorStop(0, '#a2dcff00');
    bow.addColorStop(.6, '#a2dcff9c');
    bow.addColorStop(1, '#f0f9ff');
    ctx.strokeStyle = bow;
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(-span * 1.28, -span);
    ctx.quadraticCurveTo(span * .95, 0, -span * 1.28, span);
    ctx.stroke();
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-span * .77, -span * .76);
    ctx.quadraticCurveTo(span * .60, 0, -span * .77, span * .76);
    ctx.stroke();
  }
  ctx.restore();
}

export function drawDijiang(ctx: CanvasRenderingContext2D, summon: Summon,
  length: number, debug: boolean, reducedMotion: boolean) {
  if (summon.phase === 'cut-in') return;
  const { x, y, frame, phase, facing } = summon;
  const falling = phase === 'fall';
  const progress = frame / (falling ? summonFallFrames : summonImpactFrames);
  const tip = falling ? dijiangTip(summon, progress) : dijiangBurialTip(length, summon, facing, progress);
  ctx.save();
  if (falling) {
    ctx.fillStyle = '#db512c28';
    ctx.strokeStyle = '#ff8e57';
    ctx.lineWidth = 2 + progress * 3;
    ctx.beginPath();
    ctx.ellipse(x, y - 2, summonArea.halfWidth, 14, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = '#f9d492';
    ctx.setLineDash([20, 15]);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(x, y - 2, summonArea.halfWidth + 13, 19, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  if (debug) {
    ctx.strokeStyle = '#ff5d82';
    ctx.strokeRect(x - summonArea.halfWidth, y - summonArea.above,
      summonArea.halfWidth * 2, summonArea.above + summonArea.below);
  }
  if (shipArt.naturalWidth) {
    if (!falling) {
      // The locked landing surface occludes the part of the ship that has gone underground.
      const extent = length * 2;
      ctx.beginPath();
      ctx.rect(x - extent, y - extent, extent * 2, extent);
      ctx.clip();
    }
    ctx.translate(tip.x, tip.y);
    ctx.scale(facing, 1);
    ctx.rotate(dijiangPitch - Math.PI);
    const scale = length / (shipArt.naturalWidth - 32);
    ctx.drawImage(shipArt, -16 * scale, -283 * scale,
      shipArt.naturalWidth * scale, shipArt.naturalHeight * scale);
  }
  ctx.restore();
  if (falling) drawDiveWind(ctx, tip, length, facing, progress, reducedMotion);
}

function drawBlastShape(ctx: CanvasRenderingContext2D, width: number, height: number) {
  ctx.beginPath();
  ctx.moveTo(-width, 2);
  ctx.lineTo(-width * .58, -height * .24);
  ctx.lineTo(-width * .78, -height * .55);
  ctx.lineTo(-width * .27, -height * .35);
  ctx.lineTo(-width * .22, -height * .83);
  ctx.lineTo(width * .04, -height * .63);
  ctx.lineTo(width * .26, -height);
  ctx.lineTo(width * .31, -height * .41);
  ctx.lineTo(width * .81, -height * .59);
  ctx.lineTo(width * .64, -height * .21);
  ctx.lineTo(width, 2);
  ctx.lineTo(width * .43, 9);
  ctx.lineTo(-width * .45, 7);
  ctx.closePath();
  ctx.fill();
}

const dustOutline: [number, number][] = [
  [-1, .12], [-1, -.16], [-.74, -.16], [-.74, -.47], [-.46, -.47], [-.46, -.69],
  [.10, -.69], [.10, -.87], [.54, -.87], [.54, -.63], [.8, -.63], [.8, -.39],
  [1, -.39], [1, .08], [.73, .08], [.73, .25], [-.59, .25], [-.59, .12]
];

function drawImpactDust(ctx: CanvasRenderingContext2D, age: number, reducedMotion: boolean) {
  const opacity = ctx.globalAlpha;
  for (const side of [-1, 1]) {
    for (let i = 0; i < (reducedMotion ? 6 : 12); i++) {
      const time = age - 3 - i * 1.1;
      if (time < 0) continue;
      const x = side * (12 + i * 7 + Math.sqrt(time) * i * 7.2);
      const y = -8 - Math.sqrt(time) * (5 + (i % 4) * 9) + time * .65;
      const size = 17 + i % 3 * 12 + Math.sqrt(time) * 7.8;
      ctx.globalAlpha = opacity * Math.min(1, time / 6) * Math.max(0, 1 - time / 71) ** 1.35 * .82;
      ctx.fillStyle = i % 3 === 0 ? '#9c7667' : i % 3 === 1 ? '#d6b394' : '#67495a';
      ctx.beginPath();
      dustOutline.forEach(([px, py], index) => {
        const cornerX = Math.round(x + side * px * size);
        const cornerY = Math.round(y + py * size);
        if (index === 0) ctx.moveTo(cornerX, cornerY);
        else ctx.lineTo(cornerX, cornerY);
      });
      ctx.closePath();
      ctx.fill();
    }
  }
  ctx.globalAlpha = opacity;
}

const groundCracks = [
  [[0, 3], [-.24, 7], [-.40, 4], [-.63, 11], [-.91, 7]],
  [[-.24, 7], [-.34, 19], [-.55, 23], [-.61, 31]],
  [[-.63, 11], [-.72, 20], [-.85, 23]],
  [[0, 3], [.17, 13], [.41, 11], [.63, 19], [1, 15]],
  [[.17, 13], [.24, 26], [.47, 36], [.59, 33]],
  [[.63, 19], [.77, 29], [.81, 39]]
];

export function drawDijiangGround(ctx: CanvasRenderingContext2D, age: number, left: number, right: number) {
  const span = 57 + 174 * Math.min(1, age / 11);
  ctx.save();
  ctx.beginPath();
  ctx.rect(left, -2, right - left, 48);
  ctx.clip();
  ctx.globalAlpha *= Math.min(1, (dijiangImpactLife - age) / 22);
  ctx.fillStyle = '#472c3eaf';
  ctx.beginPath();
  ctx.ellipse(0, 6, span * .68, 11, 0, 0, Math.PI * 2);
  ctx.fill();
  for (const [index, crack] of groundCracks.entries()) {
    ctx.beginPath();
    ctx.moveTo(crack[0][0] * span, crack[0][1]);
    for (const [x, y] of crack.slice(1)) ctx.lineTo(x * span, y);
    const trunk = index % 3 === 0;
    ctx.strokeStyle = '#c89571';
    ctx.lineWidth = trunk ? 7 : 4;
    ctx.stroke();
    ctx.strokeStyle = '#382325';
    ctx.lineWidth = trunk ? 5 : 3;
    ctx.stroke();
  }
  ctx.restore();
}

export function drawDijiangImpact(ctx: CanvasRenderingContext2D, age: number, reducedMotion: boolean) {
  ctx.save();
  const opacity = ctx.globalAlpha;
  if (age < 15) {
    const glow = ctx.createRadialGradient(0, -32, 12, 0, -32, 285 + age * 10);
    glow.addColorStop(0, '#fff0b8de');
    glow.addColorStop(.46, '#f38b4060');
    glow.addColorStop(1, '#ed634700');
    ctx.globalAlpha = opacity * (1 - age / 15) * (reducedMotion ? .36 : .88);
    ctx.fillStyle = glow;
    ctx.fillRect(-450, -492, 900, 900);
  }
  for (const delay of [0, 4]) {
    const wave = (age - delay) / 21;
    if (wave < 0 || wave >= 1) continue;
    const spread = 65 + (delay ? 452 : 604) * (1 - (1 - wave) ** 2);
    ctx.globalAlpha = opacity * (1 - wave) ** 1.3 * (delay ? .52 : 1);
    ctx.strokeStyle = delay ? '#e99d64' : '#ffe9b6';
    ctx.lineWidth = (delay ? 5 : 10) * (1 - wave) + 1;
    ctx.beginPath();
    ctx.ellipse(0, -2, spread, 9 + spread * .072, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.globalAlpha = opacity;
  drawImpactDust(ctx, age, reducedMotion);
  if (age < 17) {
    const burst = age / 17;
    const width = 140 + 175 * (1 - (1 - burst) ** 2);
    const height = 154 + 124 * burst;
    ctx.globalAlpha = opacity * (1 - burst) ** .9 * (reducedMotion ? .68 : 1);
    ctx.fillStyle = '#9b4440';
    drawBlastShape(ctx, width * 1.12, height * .81);
    ctx.fillStyle = '#e87538';
    drawBlastShape(ctx, width, height);
    ctx.fillStyle = '#ffbf59';
    drawBlastShape(ctx, width * .76, height * .84);
    ctx.fillStyle = '#fff0c0';
    drawBlastShape(ctx, width * .47, height * .61);
  }
  if (age < 44) {
    for (const side of [-1, 1]) {
      for (let i = 0; i < (reducedMotion ? 7 : 17); i++) {
        const time = age - i % 4 * 1.25;
        const x = side * (16 + i * 9 + time * (3.8 + i * .79));
        const y = -11 - time * (5.2 + (i % 7) * 2.66) + time * time * .43;
        if (time < 0 || y > 6) continue;
        ctx.globalAlpha = opacity * (1 - age / 44);
        const size = 3 + i % 5 * 2;
        ctx.save();
        ctx.translate(Math.round(x), Math.round(y));
        ctx.rotate(side * (i + time * .26));
        ctx.fillStyle = i % 3 === 0 ? '#ffdf9f' : '#56323b';
        ctx.fillRect(0, 0, size * 1.6, size);
        ctx.fillStyle = '#e7aa71';
        ctx.fillRect(0, 0, size * 1.6, 2);
        ctx.restore();
      }
    }
  }
  ctx.restore();
}

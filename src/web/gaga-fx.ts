import type { FighterState, PowerPylon, Projectile, ProjectileDefinition, Turret } from '../core/types.js';
import { drawCrystalSpireSprite, drawPowerPylonPole, drawSwordWaveSprite, POWER_PYLON_HEIGHT } from './art.js';
import { sparkle } from './hit-burst.js';
import { drawPixelFx } from './pixel-fx.mjs';

function drawFacetedCrystal(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, angle: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.beginPath();
  ctx.moveTo(0, -radius * 1.35);
  ctx.lineTo(radius * .88, -radius * .25);
  ctx.lineTo(radius * .62, radius * 1.15);
  ctx.lineTo(0, radius * 1.4);
  ctx.lineTo(-radius * .62, radius * 1.15);
  ctx.lineTo(-radius * .88, -radius * .25);
  ctx.closePath();

  const grad = ctx.createLinearGradient(-radius, -radius, radius, radius);
  grad.addColorStop(0, '#fff4b8');
  grad.addColorStop(.42, '#fbbf24');
  grad.addColorStop(1, '#b45309');
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.strokeStyle = '#1f1624';
  ctx.lineWidth = Math.max(1.5, radius * .14);
  ctx.stroke();

  // Inner dark Grand Vision prism ridge.
  ctx.fillStyle = '#241a29';
  ctx.beginPath();
  ctx.moveTo(0, -radius * .75);
  ctx.lineTo(radius * .34, 0);
  ctx.lineTo(0, radius * .82);
  ctx.lineTo(-radius * .34, 0);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#fef3c7';
  ctx.beginPath();
  ctx.moveTo(-radius * .26, -radius * .52);
  ctx.lineTo(0, -radius * .95);
  ctx.lineTo(radius * .14, -radius * .48);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

export function drawOriginiumCrystalMark(ctx: CanvasRenderingContext2D, fighter: FighterState, tick: number) {
  if (!fighter.crystalMark) return;
  const ratio = Math.max(0, Math.min(1, fighter.crystalMark.remaining / 240));
  const spin = tick * .07;
  ctx.save();
  ctx.translate(fighter.x, fighter.y - 72);

  // Thin amber countdown ring behind the target.
  ctx.strokeStyle = '#241a29c8';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(0, 0, 34, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = ratio < .25 ? '#f97316' : '#fbbf24';
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.arc(0, 0, 34, -Math.PI * .5, -Math.PI * .5 + Math.PI * 2 * ratio);
  ctx.stroke();

  for (let i = 0; i < 3; i++) {
    const theta = spin + (i * Math.PI * 2) / 3;
    const ox = Math.cos(theta) * 32;
    const oy = Math.sin(theta) * 14 - 4;
    const size = 8.5 + Math.sin(theta) * 2.2;
    drawFacetedCrystal(ctx, ox, oy, size, Math.sin(theta) * .35);
  }
  ctx.restore();
}

export function drawCrystalPlant(ctx: CanvasRenderingContext2D, age: number, life: number) {
  const t = age / Math.max(1, life);
  ctx.save();
  ctx.globalAlpha = Math.max(0, 1 - t ** 1.4);
  ctx.strokeStyle = '#fbbf24';
  ctx.lineWidth = 3 * (1 - t) + 1;
  const r = 14 + t * 38;
  ctx.beginPath();
  ctx.moveTo(0, -r);
  ctx.lineTo(r, 0);
  ctx.lineTo(0, r);
  ctx.lineTo(-r, 0);
  ctx.closePath();
  ctx.stroke();
  if (age < 8) sparkle(ctx, 26 * (1 - t), '#f59e0b', '#fef3c7');
  ctx.restore();
}

export function drawCrystalLockOnBeam(ctx: CanvasRenderingContext2D, frame: number, startup: number) {
  const ratio = Math.max(0, Math.min(1, frame / Math.max(1, startup - 1)));
  ctx.save();
  if (!drawCrystalSpireSprite(ctx, 0, 240, .55 + .45 * ratio, .85 + .22 * ratio, .88 + .12 * ratio)) {
    ctx.globalAlpha = .55 + .35 * ratio;
    ctx.fillStyle = '#fbbf24';
    ctx.fillRect(-3, -240, 6, 240);
  }
  ctx.restore();
}

export function drawCrystalShatter(ctx: CanvasRenderingContext2D, age: number, life: number, reducedMotion: boolean) {
  const t = age / Math.max(1, life);
  ctx.save();

  // Ground-anchored Originium crystal eruption + shattering embers (match.ts emits crystal-shatter at y - 68).
  const frameIndex = age < 10 ? 2 : 3;
  const spriteAlpha = frameIndex === 2 ? 1 : Math.max(0, 1 - (age - 10) / Math.max(1, life - 10));
  const scalePulse = age < 3 ? .85 + age * .07 : 1;
  ctx.save();
  ctx.translate(0, 68);
  drawCrystalSpireSprite(ctx, frameIndex, 236, spriteAlpha, scalePulse, scalePulse);
  ctx.restore();

  ctx.globalAlpha = Math.max(0, 1 - t ** 1.3);
  const spread = 24 + t * 145;
  ctx.strokeStyle = '#fef3c7';
  ctx.lineWidth = 5 * (1 - t) + 1;
  ctx.beginPath();
  ctx.arc(0, 0, spread, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 3.5 * (1 - t) + 1;
  ctx.beginPath();
  ctx.arc(0, 0, spread * .72, 0, Math.PI * 2);
  ctx.stroke();

  const shards = reducedMotion ? 5 : 10;
  for (let i = 0; i < shards; i++) {
    const angle = (i / shards) * Math.PI * 2 + .25;
    const dist = 16 + t * (92 + (i % 3) * 28);
    const sx = Math.cos(angle) * dist;
    const sy = Math.sin(angle) * dist + t * t * 24;
    drawFacetedCrystal(ctx, sx, sy, (10 - (i % 3) * 2) * (1 - t * .45), angle + t * 4);
  }
  ctx.restore();
}

function drawXiraniteShard(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, angle: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.beginPath();
  ctx.moveTo(0, -radius * 1.45);
  ctx.lineTo(radius * .82, -radius * .2);
  ctx.lineTo(radius * .52, radius * 1.15);
  ctx.lineTo(0, radius * 1.45);
  ctx.lineTo(-radius * .52, radius * 1.15);
  ctx.lineTo(-radius * .82, -radius * .2);
  ctx.closePath();

  const grad = ctx.createLinearGradient(-radius, -radius, radius, radius);
  grad.addColorStop(0, '#ecfdf5');
  grad.addColorStop(.45, '#38f2c9');
  grad.addColorStop(1, '#047857');
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.strokeStyle = '#064e3b';
  ctx.lineWidth = Math.max(1.4, radius * .15);
  ctx.stroke();

  ctx.fillStyle = '#d1fae5';
  ctx.beginPath();
  ctx.moveTo(-radius * .22, -radius * .55);
  ctx.lineTo(0, -radius * 1.05);
  ctx.lineTo(radius * .16, -radius * .48);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

export function drawXiraniteStanceEffect(ctx: CanvasRenderingContext2D, frame: number, startup: number, active: number,
  reducedMotion = false) {
  const end = startup + active;
  const isActive = frame >= startup && frame < end;
  const fade = frame < startup
    ? .45 + .55 * (frame / Math.max(1, startup))
    : frame < end
      ? 1
      : Math.max(0, 1 - (frame - end) / 10);
  if (fade <= 0) return;

  const pulse = reducedMotion ? 0 : Math.sin(frame * .48);
  ctx.save();
  ctx.globalAlpha = fade;

  // Ground Xiranite puddle and Endfield containment arc around her planted feet.
  ctx.fillStyle = isActive ? 'rgba(6, 78, 59, 0.42)' : 'rgba(6, 78, 59, 0.28)';
  ctx.beginPath();
  ctx.ellipse(20, 0, isActive ? 74 + pulse * 3 : 50, isActive ? 15 : 10, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = '#38f2c9';
  ctx.lineWidth = isActive ? 2.6 : 2;
  ctx.beginPath();
  ctx.ellipse(20, 0, isActive ? 74 + pulse * 3 : 50, isActive ? 15 : 10, 0, 0, Math.PI * 2);
  ctx.stroke();

  if (isActive) {
    // Segmented rotating telemetry arc at ground level.
    ctx.strokeStyle = 'rgba(167, 243, 208, 0.8)';
    ctx.lineWidth = 1.6;
    ctx.setLineDash([14, 10]);
    ctx.lineDashOffset = reducedMotion ? 0 : -frame * 2.2;
    ctx.beginPath();
    ctx.ellipse(20, 0, 82, 18, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Luminous frontal liquid dome aura framing the Xiranite barrier.
    ctx.save();
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(56, 242, 201, 0.34)';
    ctx.lineWidth = 11 + pulse * 2;
    ctx.beginPath();
    ctx.ellipse(16, -60, 74, 82, 0, -1.32, 1.15);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(209, 250, 229, 0.85)';
    ctx.lineWidth = 2.6;
    const sweepStart = reducedMotion ? -.85 : -1.1 + ((frame - startup) % 10) * .11;
    ctx.beginPath();
    ctx.ellipse(16, -60, 75, 83, 0, sweepStart, sweepStart + .78);
    ctx.stroke();
    ctx.restore();

    // Activation snap hex-ring on the first 4 active frames.
    const snap = frame - startup;
    if (snap < 4 && !reducedMotion) {
      const st = snap / 4;
      const hr = 48 + st * 48;
      ctx.save();
      ctx.translate(22, -62);
      ctx.globalAlpha = (1 - st) * .9;
      ctx.strokeStyle = '#ecfdf5';
      ctx.lineWidth = 3 * (1 - st) + 1;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + .22;
        const hx = Math.cos(a) * hr;
        const hy = Math.sin(a) * hr;
        if (i === 0) ctx.moveTo(hx, hy);
        else ctx.lineTo(hx, hy);
      }
      ctx.closePath();
      ctx.stroke();
      ctx.restore();
    }

    // Orbiting liquid droplets and floating Xiranite motes.
    const motes = reducedMotion ? 2 : 4;
    for (let i = 0; i < motes; i++) {
      const phase = ((frame * .14 + i * .78) % 1);
      const mx = 48 + i * 11 + Math.sin(frame * .25 + i) * 6;
      const my = -16 - phase * 92;
      ctx.fillStyle = i % 2 ? '#a7f3d0' : '#38f2c9';
      ctx.beginPath();
      ctx.arc(mx, my, 3.2 * (1 - phase * .55), 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

export function drawXiraniteParryFlash(ctx: CanvasRenderingContext2D, age: number, life: number,
  facing = 1, reducedMotion = false) {
  const t = Math.min(1, age / Math.max(1, life));
  ctx.save();
  ctx.scale(facing, 1);
  ctx.globalAlpha = Math.max(0, 1 - t ** 1.45);

  // Expanding radial flash core.
  if (t < .45) {
    const g = ctx.createRadialGradient(0, 0, 2, 0, 0, 56 + t * 90);
    g.addColorStop(0, 'rgba(236, 253, 245, 0.92)');
    g.addColorStop(.45, 'rgba(56, 242, 201, 0.52)');
    g.addColorStop(1, 'rgba(16, 185, 129, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, 56 + t * 90, 0, Math.PI * 2);
    ctx.fill();
  }

  // Hexagonal Endfield deflect barrier lattice.
  const hexR = 26 + t * 96;
  ctx.save();
  ctx.rotate(t * .22);
  ctx.strokeStyle = '#064e3b';
  ctx.lineWidth = 6 * (1 - t) + 2;
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const x = Math.cos(a) * hexR;
    const y = Math.sin(a) * hexR;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.stroke();
  ctx.strokeStyle = '#5eead4';
  ctx.lineWidth = 3 * (1 - t) + 1;
  ctx.stroke();
  ctx.restore();

  // Sharp forward liquid-deflect crescent arcs.
  ctx.lineCap = 'round';
  for (const [color, width] of [['#064e3b', 8], ['#38f2c9', 5], ['#ecfdf5', 2]] as const) {
    ctx.strokeStyle = color;
    ctx.lineWidth = width * (1 - t * .5);
    ctx.beginPath();
    ctx.ellipse(-6, 0, 32 + t * 52, 46 + t * 66, 0, -Math.PI * .46, Math.PI * .46);
    ctx.stroke();
  }

  if (age < 7) sparkle(ctx, (1 - t) * 44, '#38f2c9', '#ecfdf5');

  if (!reducedMotion) {
    const drops = 6;
    for (let i = 0; i < drops; i++) {
      const a = -1.2 + (i / (drops - 1)) * 2.4;
      const dist = 28 + t * (82 + (i % 2) * 22);
      ctx.fillStyle = i % 2 ? '#a7f3d0' : '#38f2c9';
      ctx.beginPath();
      ctx.arc(Math.cos(a) * dist, Math.sin(a) * dist, 4 * (1 - t * .6), 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

function drawCrystalSpike(ctx: CanvasRenderingContext2D, ox: number, oy: number, angle: number,
  length: number, halfWidth: number, skew: number) {
  ctx.save();
  ctx.translate(ox, oy);
  ctx.rotate(angle);

  const shX1 = length * .22;
  const shY1 = -halfWidth * (.84 + skew);
  const shX2 = length * .26;
  const shY2 = halfWidth * (.76 - skew * .5);

  ctx.beginPath();
  ctx.moveTo(0, -halfWidth);
  ctx.lineTo(shX1, shY1);
  ctx.lineTo(length, 0);
  ctx.lineTo(shX2, shY2);
  ctx.lineTo(0, halfWidth);
  ctx.closePath();

  const bodyGrad = ctx.createLinearGradient(0, 0, length, 0);
  bodyGrad.addColorStop(0, '#047857');
  bodyGrad.addColorStop(.45, '#10b981');
  bodyGrad.addColorStop(1, '#5eead4');
  ctx.fillStyle = bodyGrad;
  ctx.fill();

  // Bright upper crystalline facet catching the counter flash.
  ctx.beginPath();
  ctx.moveTo(0, -halfWidth);
  ctx.lineTo(shX1, shY1);
  ctx.lineTo(length, 0);
  ctx.lineTo(0, 0);
  ctx.closePath();
  const topGrad = ctx.createLinearGradient(0, -halfWidth, length, 0);
  topGrad.addColorStop(0, '#38f2c9');
  topGrad.addColorStop(.55, '#a7f3d0');
  topGrad.addColorStop(1, '#ecfdf5');
  ctx.fillStyle = topGrad;
  ctx.fill();

  // Sharp dark crystal outline so every spike separates crisply.
  ctx.beginPath();
  ctx.moveTo(0, -halfWidth);
  ctx.lineTo(shX1, shY1);
  ctx.lineTo(length, 0);
  ctx.lineTo(shX2, shY2);
  ctx.lineTo(0, halfWidth);
  ctx.closePath();
  ctx.strokeStyle = '#052e2b';
  ctx.lineWidth = 2;
  ctx.lineJoin = 'miter';
  ctx.stroke();

  // Crisp luminous center ridge edge.
  ctx.strokeStyle = '#ecfdf5';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(length * .06, 0);
  ctx.lineTo(length - 2, 0);
  ctx.stroke();
  ctx.restore();
}

export function drawXiraniteBurstEffect(ctx: CanvasRenderingContext2D, age: number, life: number,
  facing = 1, reducedMotion = false) {
  const t = Math.min(1, age / Math.max(1, life));
  // Explosive eruption curve: shoots out to full spike length within the first ~4 frames.
  const erupt = 1 - (1 - Math.min(1, t / .18)) ** 3;
  const settle = t < .22 ? erupt : 1 - ((t - .22) / .78) * .18;
  const drift = 1 - (1 - t) ** 2.4;
  ctx.save();
  ctx.scale(facing, 1);

  // Brief bright turquoise shatter flash at the shield burst point.
  if (t < .35) {
    const f = 1 - t / .35;
    const bloom = ctx.createRadialGradient(34, -56, 2, 34, -56, 68 + (1 - f) * 55);
    bloom.addColorStop(0, `rgba(236, 253, 245, ${(.88 * f).toFixed(2)})`);
    bloom.addColorStop(.5, `rgba(56, 242, 201, ${(.48 * f).toFixed(2)})`);
    bloom.addColorStop(1, 'rgba(16, 185, 129, 0)');
    ctx.fillStyle = bloom;
    ctx.beginPath();
    ctx.arc(34, -56, 68 + (1 - f) * 55, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.globalAlpha = Math.max(0, 1 - t ** 1.6);

  // Crisp fractured floor pool & Xiranite crackle along the counter range.
  ctx.fillStyle = 'rgba(4, 120, 87, 0.36)';
  ctx.beginPath();
  ctx.ellipse(78 + drift * 34, -1, 56 + drift * 78, 11 + drift * 7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#38f2c9';
  ctx.lineWidth = 3 * (1 - t) + 1;
  ctx.stroke();

  // Sharp forward-erupting crystal shock spikes fanning radially out from the shield.
  const radialSpikes = [
    { ox: 26, oy: -72, angle: -1.08, len: 122, w: 8.5, skew: .14 },
    { ox: 30, oy: -66, angle: -.74, len: 158, w: 11, skew: -.08 },
    { ox: 32, oy: -60, angle: -.44, len: 186, w: 12.5, skew: .12 },
    { ox: 34, oy: -54, angle: -.18, len: 198, w: 13.5, skew: -.10 },
    { ox: 32, oy: -48, angle: .05, len: 174, w: 11.5, skew: .08 },
    { ox: 30, oy: -42, angle: .24, len: 138, w: 9, skew: -.12 },
    { ox: 28, oy: -68, angle: -.90, len: 92, w: 6, skew: .15 },
    { ox: 36, oy: -50, angle: -.30, len: 118, w: 6.5, skew: -.14 },
    { ox: 34, oy: -44, angle: .14, len: 102, w: 6, skew: .10 }
  ] as const;

  const radialCount = reducedMotion ? 5 : radialSpikes.length;
  for (let i = 0; i < radialCount; i++) {
    const s = radialSpikes[i];
    drawCrystalSpike(ctx, s.ox, s.oy, s.angle, s.len * settle, s.w * (1 - t * .45), s.skew);
  }

  // Ground-anchored Xiranite crystal spikes jutting explosively upward & forward from the floor.
  const groundSpikes = [
    { ox: 42, angle: -1.24, len: 96, w: 10, skew: .12 },
    { ox: 66, angle: -1.04, len: 132, w: 12.5, skew: -.10 },
    { ox: 94, angle: -.86, len: 146, w: 13, skew: .08 },
    { ox: 124, angle: -.68, len: 118, w: 10.5, skew: -.12 },
    { ox: 152, angle: -.54, len: 88, w: 8.5, skew: .10 }
  ] as const;

  const groundCount = reducedMotion ? 3 : groundSpikes.length;
  for (let i = 0; i < groundCount; i++) {
    const g = groundSpikes[i];
    drawCrystalSpike(ctx, g.ox, 2, g.angle, g.len * settle, g.w * (1 - t * .42), g.skew);
  }

  // Crisp single expanding shock ring around the burst point (after the spikes punch out).
  if (t > .04) {
    ctx.strokeStyle = 'rgba(167, 243, 208, 0.72)';
    ctx.lineWidth = 3.2 * (1 - t) + .8;
    ctx.beginPath();
    ctx.ellipse(36 + drift * 42, -54, 24 + drift * 78, 38 + drift * 46, -.12, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Flying sharp crystal splinters shooting outward from the spike tips.
  const shards = reducedMotion ? 4 : 8;
  for (let i = 0; i < shards; i++) {
    const angle = -.96 + (i / Math.max(1, shards - 1)) * 1.18;
    const dist = 58 + drift * (118 + (i % 3) * 34);
    const sx = 30 + Math.cos(angle) * dist;
    const sy = -54 + Math.sin(angle) * dist + t * t * 28;
    drawXiraniteShard(ctx, sx, sy, (8 - (i % 3) * 1.8) * (1 - t * .45), angle + Math.PI * .5);
  }

  if (!reducedMotion) {
    for (let i = 0; i < 6; i++) {
      const a = -.95 + (i / 5) * 1.15;
      const dist = 62 + drift * (122 + (i % 2) * 28);
      ctx.fillStyle = i % 2 ? '#ecfdf5' : '#38f2c9';
      ctx.beginPath();
      ctx.arc(32 + Math.cos(a) * dist, -54 + Math.sin(a) * dist + t * t * 38, 3.4 * (1 - t * .6), 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

export function drawPowerPylonField(ctx: CanvasRenderingContext2D, pylon: PowerPylon, tick: number,
  reducedMotion: boolean, casterHolding = false) {
  const expand = Math.min(1, (pylon.age + 1) / 8);
  const fadeOut = Math.min(1, pylon.remaining / 18);
  const radius = pylon.radius * expand;
  const durationRatio = Math.max(0, Math.min(1, pylon.remaining / 720));
  const pulse = reducedMotion ? 0 : Math.sin(tick * .12) * .08;

  ctx.save();
  ctx.translate(pylon.x, pylon.y);
  ctx.globalAlpha = fadeOut;

  // Translucent Endfield pylon force-field dome spanning full 520px radius with luminous rim.
  const domeH = Math.min(340, radius * .65);
  const domeGrad = ctx.createRadialGradient(0, -10, radius * .15, 0, -10, radius);
  domeGrad.addColorStop(0, 'rgba(56, 189, 248, 0.06)');
  domeGrad.addColorStop(.78, 'rgba(56, 189, 248, 0.14)');
  domeGrad.addColorStop(1, 'rgba(56, 189, 248, 0.28)');
  ctx.fillStyle = domeGrad;
  ctx.beginPath();
  ctx.ellipse(0, 0, radius, domeH, 0, Math.PI, Math.PI * 2);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = `rgba(125, 211, 252, ${(.48 + pulse).toFixed(2)})`;
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.ellipse(0, 0, radius, domeH, 0, Math.PI, Math.PI * 2);
  ctx.stroke();

  // Floor force-field boundary ellipse & rotating cyan telemetry ring at full radius.
  ctx.strokeStyle = `rgba(56, 189, 248, ${(.82 + pulse).toFixed(2)})`;
  ctx.lineWidth = 3.2;
  ctx.beginPath();
  ctx.ellipse(0, 0, radius, 44, 0, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = `rgba(186, 230, 253, ${(.62 + pulse).toFixed(2)})`;
  ctx.lineWidth = 1.8;
  ctx.setLineDash([18, 12]);
  ctx.lineDashOffset = reducedMotion ? 0 : -tick * 1.4;
  ctx.beginPath();
  ctx.ellipse(0, 0, radius * .97, 39, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  if (!casterHolding) {
    // Planted tripod shadow centered under the 3 sunken tripod legs + 3x towering pole.
    ctx.fillStyle = '#08091cd4';
    ctx.beginPath();
    ctx.ellipse(0, 2, 68, 17, 0, 0, Math.PI * 2);
    ctx.fill();

    const settle = Math.max(0, 7 - pylon.age);
    const rise = 1 - settle * .04;
    const squash = 1 + settle * .03;
    if (!drawPowerPylonPole(ctx, squash, rise)) {
      ctx.fillStyle = '#cbd5e1';
      ctx.fillRect(-12, -(POWER_PYLON_HEIGHT - 11), 24, POWER_PYLON_HEIGHT - 11);
    }

    // Glowing power transmitter crown & remaining-field timer ring at mast top.
    const crownY = -(POWER_PYLON_HEIGHT - 11);
    ctx.fillStyle = 'rgba(56, 189, 248, 0.38)';
    ctx.beginPath();
    ctx.arc(0, crownY, 17 + pulse * 20, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e0f2fe';
    ctx.beginPath();
    ctx.arc(0, crownY, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(0, crownY, 11.5, -Math.PI * .5, -Math.PI * .5 + Math.PI * 2 * durationRatio);
    ctx.stroke();
  }

  ctx.restore();
}

export function drawTurretSpeedBoost(ctx: CanvasRenderingContext2D, pylon: PowerPylon, turret: Turret, tick: number) {
  const x1 = pylon.x;
  const y1 = pylon.y - (POWER_PYLON_HEIGHT - 11);
  const x2 = turret.x;
  const y2 = turret.y - (turret.kind === 'bolt' ? 92 : 84);
  const dx = x2 - x1;
  const dy = y2 - y1;
  ctx.save();
  ctx.translate(x1, y1);
  ctx.globalAlpha = .72 + Math.sin(tick * .25) * .22;
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  const steps = 6;
  for (let i = 1; i < steps; i++) {
    const f = i / steps;
    const wave = Math.sin(tick * .45 + i * 2.1) * 9;
    ctx.lineTo(dx * f, dy * f - Math.sin(f * Math.PI) * 14 + wave);
  }
  ctx.lineTo(dx, dy);
  ctx.stroke();

  ctx.strokeStyle = '#e0f2fe';
  ctx.lineWidth = 1.6;
  ctx.stroke();

  // "2x" fast-fire badge & chevron above the boosted turret.
  const badgeY = (turret.y - (turret.kind === 'bolt' ? 158 : 152)) - y1;
  ctx.fillStyle = '#0f172ad9';
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(dx - 17, badgeY - 12, 34, 16, 4);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#fef08a';
  ctx.font = 'bold 11px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('2x ⚡', dx, badgeY - 4);
  ctx.restore();
}

export function drawPylonPlantEffect(ctx: CanvasRenderingContext2D, age: number, life: number, radius = 520) {
  const t = age / Math.max(1, life);
  ctx.save();
  ctx.globalAlpha = Math.max(0, 1 - t ** 1.2);
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 4 * (1 - t) + 1;
  ctx.beginPath();
  ctx.ellipse(0, 0, 48 + t * (radius - 48), 10 + t * 34, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

export function drawPylonExpireEffect(ctx: CanvasRenderingContext2D, age: number, life: number) {
  const t = age / Math.max(1, life);
  ctx.save();
  ctx.globalAlpha = Math.max(0, 1 - t);
  for (let i = 0; i < 6; i++) {
    const x = Math.cos(i * 1.1) * (14 + t * 38);
    const y = -30 - i * 18 - t * 28;
    ctx.fillStyle = i % 2 ? '#38bdf8' : '#fef08a';
    ctx.fillRect(x - 3, y - 3, 6 * (1 - t * .5), 6 * (1 - t * .5));
  }
  ctx.restore();
}

export function drawSparkProjectile(ctx: CanvasRenderingContext2D, p: Projectile) {
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.scale(p.facing, 1);
  ctx.fillStyle = '#38bdf888';
  ctx.beginPath();
  ctx.ellipse(-6, 0, 20, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fbbf24';
  ctx.beginPath();
  ctx.moveTo(14, 0);
  ctx.lineTo(0, -7);
  ctx.lineTo(-10, 0);
  ctx.lineTo(0, 7);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#fffbeb';
  ctx.beginPath();
  ctx.arc(3, 0, 3.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function drawDiveLandImpact(ctx: CanvasRenderingContext2D, age: number, life: number, reducedMotion: boolean) {
  const t = age / Math.max(1, life);
  ctx.save();
  ctx.globalAlpha = Math.max(0, 1 - t ** 1.3);
  ctx.strokeStyle = '#fbbf24';
  ctx.lineWidth = 5 * (1 - t) + 1;
  ctx.beginPath();
  ctx.ellipse(0, -3, 24 + t * 116, 6 + t * 18, 0, 0, Math.PI * 2);
  ctx.stroke();
  const count = reducedMotion ? 4 : 8;
  for (let i = 0; i < count; i++) {
    const dir = i % 2 ? 1 : -1;
    const dist = 12 + t * (48 + i * 11);
    const py = -4 - t * (34 + (i % 3) * 16) + t * t * 38;
    if (py <= 2) drawFacetedCrystal(ctx, dir * dist, py, 6.5 * (1 - t * .4), dir * (t * 4 + i));
  }
  ctx.restore();
}

export function drawSwordChargeGlint(ctx: CanvasRenderingContext2D, frame: number, startup: number) {
  const t = Math.min(1, frame / Math.max(1, startup));
  ctx.save();
  ctx.translate(-74, -45);
  const pulse = 1 + Math.sin(frame * 1.4) * .18;
  const r = (10 + 18 * t) * pulse;
  ctx.globalAlpha = .45 + .5 * t;
  const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 1.8);
  glow.addColorStop(0, '#fffbeb');
  glow.addColorStop(.45, '#fbbf24b0');
  glow.addColorStop(1, '#f59e0b00');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(0, 0, r * 1.8, 0, Math.PI * 2);
  ctx.fill();
  sparkle(ctx, r, '#fbbf24', '#fffbeb');
  ctx.restore();
}

export function drawSwordReleaseSlash(ctx: CanvasRenderingContext2D, age: number, life: number,
  facing = 1, reducedMotion = false) {
  const t = age / Math.max(1, life);
  ctx.save();
  ctx.scale(facing, 1);

  // Open-source PixelFX golden thrust shock burst right at Gaga's blade height.
  if (!reducedMotion && age < 14) {
    drawPixelFx(ctx, 'thrust', age / 56, 34, -76, 2.2, 'both', true, Math.max(0, 1 - t * .9));
  }

  // Sweeping two-fighter-tall amber-gold crescent slash arc centered at y = -134 (matching the wave [-268..0]).
  const arcFade = Math.max(0, 1 - t ** 1.35);
  ctx.globalAlpha = arcFade;
  const centerY = -134;
  const halfSpan = 132 + t * 8;
  const topY = centerY - halfSpan;
  const botY = Math.min(-2, centerY + halfSpan);
  const backX = -16 + t * 18;
  const tipX = 68 + t * 44;

  ctx.fillStyle = '#f59e0b5c';
  ctx.beginPath();
  ctx.moveTo(backX, topY);
  ctx.quadraticCurveTo(tipX + 34, centerY, backX, botY);
  ctx.quadraticCurveTo(tipX - 38, centerY, backX, topY);
  ctx.closePath();
  ctx.fill();

  const arcGrad = ctx.createLinearGradient(backX, topY, tipX + 28, botY);
  arcGrad.addColorStop(0, '#fffbeb');
  arcGrad.addColorStop(.5, '#fbbf24');
  arcGrad.addColorStop(1, '#d97706');
  ctx.strokeStyle = arcGrad;
  ctx.lineWidth = Math.max(2, 16 * (1 - t));
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(backX + 8, topY + 6);
  ctx.quadraticCurveTo(tipX + 26, centerY, backX + 8, botY - 6);
  ctx.stroke();

  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = Math.max(1, 6.5 * (1 - t * 1.15));
  ctx.beginPath();
  ctx.moveTo(backX + 16, topY + 18);
  ctx.quadraticCurveTo(tipX + 18, centerY, backX + 16, botY - 18);
  ctx.stroke();

  // Ground kick-up dust, backward recoil speed lines & emerging crystal shards across the full arc height.
  if (!reducedMotion) {
    for (let i = 0; i < 6; i++) {
      const dx = -22 - i * 16 - age * (3.2 + (i % 3));
      const dy = -16 - (i % 4) * 30;
      ctx.globalAlpha = arcFade * .75;
      ctx.fillStyle = i % 2 ? '#fde68a' : '#fffbeb';
      ctx.fillRect(dx, dy, 26 - t * 14, 3);
    }
    for (let i = 0; i < 5; i++) {
      const px = 26 + i * 20 + t * 84;
      const py = topY + 28 + i * 52 + Math.sin(age * .4 + i) * 8;
      drawFacetedCrystal(ctx, px, py, 7.5 * (1 - t * .45), t * 5 + i);
    }
  }
  ctx.restore();
}

export function drawSwordWaveProjectile(ctx: CanvasRenderingContext2D, p: Projectile, data: ProjectileDefinition,
  reducedMotion: boolean) {
  const age = p.age ?? 0;
  const radius = data.radius;
  ctx.save();

  // Persistent Originium crystal shards & amber speed-streak tail trailing behind the flying wave.
  const maxTail = Math.min(220, 48 + age * 22);
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.scale(p.facing, 1);

  if (!reducedMotion) {
    // High-speed golden aerodynamic streaks.
    for (let i = 0; i < 9; i++) {
      const lane = -radius * .82 + (i / 8) * (radius * 1.64);
      const phase = ((age * 24 + i * 37) % Math.max(40, maxTail));
      const len = 38 + (i % 3) * 26;
      const alpha = Math.max(0, (1 - phase / maxTail) * .72);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = i % 3 === 0 ? '#fffbeb' : '#fbbf24';
      ctx.fillRect(-phase - len, lane - 1.5, len, i % 2 ? 3.5 : 2);
    }

    // Tumbling faceted Originium crystals peeling off the crescent spine into a long wake.
    const shardCount = 12;
    for (let i = 0; i < shardCount; i++) {
      const cycle = ((age * 16 + i * 23) % Math.max(50, maxTail));
      const lifeRatio = cycle / maxTail;
      const tx = -26 - cycle;
      const spread = ((i % 5) - 2) * (radius * .36) + Math.sin(age * .28 + i * 1.7) * 14;
      const size = (10.5 - (i % 3) * 2.4) * (1 - lifeRatio * .55);
      ctx.globalAlpha = Math.max(0, (1 - lifeRatio ** 1.4) * .95);
      drawFacetedCrystal(ctx, tx, spread, size, age * .25 + i * 1.1);
    }
  }
  ctx.restore();

  // Hand-painted 4-frame giant Grand Vision crescent wave sprite.
  if (!drawSwordWaveSprite(ctx, p, radius)) {
    ctx.translate(p.x, p.y);
    ctx.scale(p.facing, 1);
    ctx.fillStyle = '#fbbf24';
    ctx.beginPath();
    ctx.arc(0, 0, radius * .6, -Math.PI * .45, Math.PI * .45);
    ctx.fill();
  }
  ctx.restore();
}

export function drawCrystalSpire(ctx: CanvasRenderingContext2D, age: number, life: number, reducedMotion: boolean) {
  const t = age / Math.max(1, life);
  ctx.save();

  // Giant orbital crystal greatsword crash -> crystal cluster eruption -> shattering embers.
  const frameIndex = age < 8 ? 1 : age < 17 ? 2 : 3;
  const fade = frameIndex === 3 ? Math.max(0, 1 - (age - 17) / Math.max(1, life - 17)) : 1;
  const slamDrop = frameIndex === 1 && age < 2 ? -18 * (2 - age) : 0;
  const squashX = frameIndex === 1 && age >= 2 && age < 5 ? 1.07 - (age - 2) * .022 : 1;
  const stretchY = frameIndex === 1 && age >= 2 && age < 5 ? .94 + (age - 2) * .02 : 1;

  ctx.save();
  ctx.translate(0, slamDrop);
  if (!drawCrystalSpireSprite(ctx, frameIndex, 250, fade, squashX, stretchY)) {
    ctx.globalAlpha = fade;
    ctx.fillStyle = '#fbbf24';
    ctx.fillRect(-18, -210, 36, 210);
  }
  ctx.restore();

  // Crisp bright impact ring + light shard accents during peak slam & shatter.
  if (age < 8) {
    const k = age / 8;
    ctx.globalAlpha = (1 - k) * .85;
    ctx.strokeStyle = '#fef3c7';
    ctx.lineWidth = 4 * (1 - k) + 1;
    ctx.beginPath();
    ctx.ellipse(0, -2, 34 + k * 66, 8 + k * 10, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  if (!reducedMotion && age >= 6 && age < 18) {
    const p = (age - 6) / 12;
    ctx.globalAlpha = Math.max(0, 1 - p);
    for (const [sx, sy, size] of [[-54, -68, 7], [58, -94, 8], [-34, -152, 6], [38, -165, 5]] as const) {
      drawFacetedCrystal(ctx, sx * (1 + p * .35), sy - age * 1.2, size * (1 - p * .45), age * .25 + sx);
    }
  }
  void t;
  ctx.restore();
}

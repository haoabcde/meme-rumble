import type { Box, CombatEvent, Projectile, ProjectileDefinition } from '../core/types.js';
import { bananaActionIds } from '../content/fighters/banana.js';
import { drawPixelEffect } from './pixelfx.js';

type Point = { x: number; y: number };

export function isTearJet(actionId: string | undefined) {
  return actionId === bananaActionIds.pressure || actionId === bananaActionIds.uppercut;
}

export function bananaEffectLife(event: CombatEvent) {
  if (event.kind === 'tear-splash') return 25;
  if ((event.kind === 'hit' || event.kind === 'block') && event.actionId === bananaActionIds.wave) return 28;
  if ((event.kind === 'hit' || event.kind === 'block') && isTearJet(event.actionId)) return 22;
  return event.kind === 'hit' && event.actionId?.startsWith('banana-') ? 16 : 0;
}

function droplet(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, angle = 0) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(angle);
  ctx.fillStyle = '#59cbf7'; ctx.strokeStyle = '#15527e'; ctx.lineWidth = Math.max(1, size * .12);
  ctx.beginPath(); ctx.moveTo(size * 1.7, 0);
  ctx.bezierCurveTo(0, -size * .9, -size, -size, -size, 0);
  ctx.bezierCurveTo(-size, size, 0, size * .9, size * 1.7, 0);
  ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#e5fbff'; ctx.beginPath(); ctx.ellipse(-size * .2, -size * .25, size * .5, size * .17, -.25, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

export function drawBananaProjectile(ctx: CanvasRenderingContext2D, p: Projectile, data: ProjectileDefinition) {
  const r = data.radius;
  ctx.save();
  ctx.translate(p.x, p.y);
  const fill = ctx.createRadialGradient(-.34 * r, -.41 * r, .08 * r, 0, 0, r);
  fill.addColorStop(0, '#ebfcff');
  fill.addColorStop(.33, '#8ceaf6');
  fill.addColorStop(.69, '#45bcf1');
  fill.addColorStop(1, '#236ba7');
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = '#1c486c';
  ctx.lineWidth = 2.4;
  ctx.stroke();
  ctx.strokeStyle = '#c4f6ffc8';
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(0, 0, .79 * r, 3.7, 5.11);
  ctx.stroke();
  ctx.fillStyle = '#e0faffb0';
  for (const [x, y, size] of [[-.39, -.24, .09], [.14, .44, .12], [.42, .16, .065]]) {
    ctx.beginPath();
    ctx.arc(r * x, r * y, r * size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

const waveCrest = new Path2D('M-107 0 C-138-12-145-27-176-31 C-126-29-103-37-80-57 C-42-88-26-149 4-178 C28-201 69-202 93-173 C105-160 110-140 101-117 C93-141 72-156 51-151 C36-146 36-127 54-118 C76-107 82-89 82-67 C112-60 118-32 130-21 C114-17 104-5 97 0Z');
const waveFoam = new Path2D('M-72-74 C-37-110-31-155 1-181 C32-207 69-203 93-175 C107-163 111-141 101-117 C98-134 87-141 80-148 L78-139 Q64-156 48-146 L43-136 Q32-140 31-128 Q20-132 23-117 Q11-123 10-109 Q-10-125-13-107 Q-22-112-27-91 Q-42-103-50-83Z');
const waveShadow = new Path2D('M-117-12 C-69-24-36-57-22-84 C1-128 12-152 41-165 Q13-128 25-94 C37-63 56-49 71-38 Q91-29 99-8Z');

export function drawBananaWave(ctx: CanvasRenderingContext2D, p: Projectile, data: ProjectileDefinition,
  reducedMotion: boolean) {
  const age = p.age ?? 0;
  const phase = reducedMotion ? 0 : age * .28;
  const fade = Math.min(1, Math.max(.10, ((data.life ?? 40) - age) / 7));
  const swell = .8 + .2 * (1 - Math.max(0, 1 - age / 8) ** 2);
  const crestHeight = swell * (.77 + fade * .23);
  ctx.save();
  ctx.translate(p.x, p.y + data.radius);
  ctx.scale(p.facing * (data.halfWidth ?? data.radius) / 104, data.radius / 98 * crestHeight);
  ctx.globalAlpha *= fade;
  ctx.fillStyle = '#14396078';
  ctx.beginPath();
  ctx.ellipse(-55, 6, 123, 11, 0, 0, Math.PI * 2);
  ctx.fill();
  const water = ctx.createLinearGradient(0, -172, 0, 0);
  water.addColorStop(0, '#8aeeff');
  water.addColorStop(.45, '#2fb4e4');
  water.addColorStop(1, '#1a61a9');
  ctx.fillStyle = water;
  ctx.strokeStyle = '#1b3a68';
  ctx.lineWidth = 4;
  ctx.lineJoin = 'round';
  ctx.fill(waveCrest);
  ctx.stroke(waveCrest);
  ctx.fillStyle = '#216daea8';
  ctx.fill(waveShadow);
  ctx.fillStyle = '#e2fdff';
  ctx.fill(waveFoam);
  ctx.save();
  ctx.clip(waveCrest);
  ctx.globalAlpha *= .8;
  ctx.globalCompositeOperation = 'screen';
  const surfFrame = Math.min(13, Math.floor(age * .34));
  // Pivot the source swell by its rising crest so the foam rides on the travelling wave.
  const surfPhase = (20 + surfFrame) / 36;
  const sourceCrest = -80 + 36 * (1 - Math.cos(Math.PI * surfPhase));
  drawPixelEffect(ctx, 'waveCrash', surfFrame, 38 - sourceCrest * 2.45, 0, 2.45, 5.05);
  ctx.restore();
  ctx.strokeStyle = '#92efff';
  ctx.lineCap = 'round';
  for (let i = 0; i < 5; i++) {
    const x = -104 + i * 24 + Math.sin(phase + i) * 7;
    const y = -13 - i % 3 * 10;
    ctx.lineWidth = 2.4 + i % 3;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + 19, y - 9, x + 35, y - 8);
    ctx.stroke();
  }
  for (let i = 0; i < 15; i++) {
    const t = (i * .19 + phase * .21) % 1;
    const x = i < 8 ? 36 + (i % 4) * 24 + t * 28 : -128 + (i % 4) * 66 + t * 28;
    const y = i < 8 ? -195 + t * t * 60 - i % 2 * 9 : -13 - Math.sin(t * Math.PI) * (16 + i % 3 * 14);
    droplet(ctx, x, y, 2.2 + i % 4 * 1.3, i < 8 ? -.48 + t : -.3);
  }
  ctx.restore();
}

function streamPoint(origin: Point, curl: Point, shoulder: Point, tip: Point, t: number) {
  const u = 1 - t;
  return {
    x: origin.x * u ** 3 + 3 * curl.x * t * u ** 2 + 3 * shoulder.x * t ** 2 * u + tip.x * t ** 3,
    y: origin.y * u ** 3 + 3 * curl.y * t * u ** 2 + 3 * shoulder.y * t ** 2 * u + tip.y * t ** 3
  };
}

function traceBank(path: Path2D, bank: Point[]) {
  for (let i = 1; i < bank.length - 1; i++) {
    const p = bank[i], next = bank[i + 1];
    path.quadraticCurveTo(p.x, p.y, (p.x + next.x) / 2, (p.y + next.y) / 2);
  }
  const tip = bank[bank.length - 1];
  path.lineTo(tip.x, tip.y);
}

export function drawCryingTears(ctx: CanvasRenderingContext2D, eyes: readonly Point[], strength: number, tick: number) {
  for (const [index, eye] of eyes.entries()) {
    const side = index ? 1 : -1;
    const swell = Math.sin(tick * .20 + index) * 4;
    ctx.save();
    ctx.translate(eye.x, eye.y);
    const fall = Math.min(1, Math.max(.3, (-eye.y - 4) / 86));
    ctx.scale(side * (.73 + strength * .27), fall * (.56 + strength * .44));
    ctx.globalAlpha *= .50 + strength * .42;
    const water = ctx.createLinearGradient(0, -6, 60, 70);
    water.addColorStop(0, '#69cceae5');
    water.addColorStop(.48, '#4fb7e0');
    water.addColorStop(1, '#45a8d8c4');
    ctx.fillStyle = water;
    ctx.beginPath();
    ctx.moveTo(-2, -1);
    ctx.bezierCurveTo(38, -15, 58 + swell, 13, 61 + swell, 64);
    ctx.quadraticCurveTo(60 + swell, 78, 51 + swell, 74);
    ctx.bezierCurveTo(51 + swell, 26, 38, -7, -2, 4);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#b8eafb99';
    ctx.lineWidth = 1.7;
    ctx.beginPath();
    ctx.moveTo(6, -2);
    ctx.bezierCurveTo(35, -9, 53 + swell, 19, 55 + swell, 52);
    ctx.stroke();
    ctx.fillStyle = '#6ac9eba6';
    const drop = (tick * 1.28 + index * 7) % 13;
    ctx.beginPath();
    ctx.ellipse(56 + swell + drop * .24, 75 + drop, 3.5 - drop * .11, 2 + drop * .15, -.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

export function drawTearJets(ctx: CanvasRenderingContext2D, eyes: readonly Point[], box: Box,
  upward: boolean, age: number, release: number, tick: number) {
  const length = 1;
  const blast = release ? 0 : Math.max(0, 1 - age / 6);
  const start = release * .14;
  if (start >= length) return;
  ctx.save();
  ctx.globalAlpha *= 1 - release / 8;
  for (const [index, eye] of eyes.entries()) {
    const lane = index === 0 ? -1 : 1;
    const phase = tick * .57 + index * 2.5;
    const end = upward
      ? { x: box.x + box.w * (index === 0 ? .08 : .70) + Math.sin(phase) * 8, y: box.y + 13 + Math.cos(phase) * 9 }
      : { x: box.x + box.w - (index === 0 ? 15 : 4), y: box.y + box.h * (index === 0 ? .44 : .94) + Math.sin(phase) * 6 };
    const curl = upward
      ? { x: eye.x + lane * 46, y: eye.y - 54 }
      : { x: eye.x + 28, y: eye.y + (index === 0 ? -59 : 3) };
    const shoulder = upward
      ? { x: end.x + lane * 32, y: end.y + box.h * .27 }
      : { x: end.x - box.w * .30, y: end.y - (index === 0 ? 30 : 18) };
    const at = (t: number) => streamPoint(eye, curl, shoulder, end, t);
    const banks: [Point[], Point[]] = [[], []];
    const segments = 38;
    for (let i = 0; i <= segments; i++) {
      const t = start + (length - start) * i / segments;
      const p = at(t), next = at(t + .005);
      const dx = next.x - p.x, dy = next.y - p.y;
      const normal = Math.hypot(dx, dy) || 1;
      const endFade = Math.min(1, (length - t) * 19);
      const root = Math.min(1, (t - start) * 17);
      for (const [edge, bank] of banks.entries()) {
        const ripple = 3.2 * Math.sin(t * 50 - phase + edge * 1.8) + 1.8 * Math.sin(t * 116 - phase * 1.8);
        const width = 1.1 + (6 + t * 11 + blast * 7 + ripple) * root * endFade;
        const offset = (edge === 0 ? -1 : 1) * width;
        bank.push({ x: p.x - dy / normal * offset, y: p.y + dx / normal * offset });
      }
    }
    const sheet = new Path2D();
    sheet.moveTo(banks[0][0].x, banks[0][0].y);
    traceBank(sheet, banks[0]);
    banks[1].reverse();
    sheet.lineTo(banks[1][0].x, banks[1][0].y);
    traceBank(sheet, banks[1]);
    sheet.closePath();
    const first = at(start), front = at(length);
    const fluid = ctx.createLinearGradient(first.x, first.y, front.x, front.y);
    fluid.addColorStop(0, '#a6f1f4eb');
    fluid.addColorStop(.26, '#42acc9ef');
    fluid.addColorStop(.68, '#7bddeddd');
    fluid.addColorStop(1, '#b9f3f3a5');
    ctx.fillStyle = fluid;
    ctx.fill(sheet);
    ctx.save();
    ctx.clip(sheet);
    for (let i = 0; i < 21; i++) {
      const t = (i * .049 + tick * .041) % 1;
      if (t < start || t > length) continue;
      const p = at(t), next = at(t + .012);
      const angle = Math.atan2(next.y - p.y, next.x - p.x);
      const drift = Math.sin(i * 5 + phase * .73) * (3 + 8 * t);
      ctx.fillStyle = i % 3 ? '#e3fffa9e' : '#236c998a';
      ctx.beginPath();
      ctx.ellipse(p.x - Math.sin(angle) * drift, p.y + Math.cos(angle) * drift,
        4.5 + i % 5 * 2.4, 1.6 + i % 4 * .8, angle, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // Detached drops carry momentum, spread sideways and fall after separating from the plume.
    ctx.fillStyle = '#a1dfe9';
    for (let i = 0; i < 26; i++) {
      const progress = ((i * .173 + tick * .047 + index * .2) % 1);
      const t = length * (.55 + (i % 6) * .085);
      if (t < start || t > length) continue;
      const p = at(t), next = at(t + .01);
      const angle = Math.atan2(next.y - p.y, next.x - p.x);
      const drift = (i % 2 ? 1 : -1) * progress * (11 + i % 5 * 7);
      const travel = progress * (19 + i % 4 * 9);
      const x = p.x + Math.cos(angle) * travel - Math.sin(angle) * drift;
      const y = p.y + Math.sin(angle) * travel + Math.cos(angle) * drift + progress ** 2 * 16;
      ctx.save();
      ctx.globalAlpha *= .94 - progress * .57;
      ctx.beginPath();
      ctx.ellipse(x, y, 1.6 + i % 4 * .7, 1 + i % 3 * .55, angle + drift * .028, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
  ctx.restore();
}

export function drawBananaEffect(ctx: CanvasRenderingContext2D, event: CombatEvent, age: number, life: number) {
  const t = age / life;
  if (isTearJet(event.actionId) || event.actionId === bananaActionIds.wave) {
    const wave = event.actionId === bananaActionIds.wave;
    const rising = event.actionId === bananaActionIds.uppercut;
    const direction = event.facing ?? 1;
    ctx.save();
    if (wave) {
      ctx.beginPath();
      ctx.ellipse(direction * 32, 28, 130, 102, 0, 0, Math.PI * 2);
      ctx.clip();
      drawPixelEffect(ctx, 'waveCrash', 16 + t * 34, direction * 20, 43, direction * 2.3, 2.7);
    } else {
      ctx.globalAlpha *= .67;
      drawPixelEffect(ctx, 'splash', t * 18, direction * 8, 3, direction * .94);
    }
    ctx.restore();
    ctx.save();
    ctx.globalAlpha *= 1 - t;
    ctx.rotate(rising ? -Math.PI / 2 : direction === 1 ? 0 : Math.PI);
    ctx.lineWidth = (rising ? 7 : 6) * (1 - t) + 1;
    ctx.strokeStyle = '#c4fbff';
    ctx.beginPath();
    ctx.ellipse(8 + 31 * t, 0, 8 + 13 * t, 14 + 26 * t, 0, -1.26, 1.26);
    ctx.stroke();
    for (let i = 0; i < 15; i++) {
      const side = i % 2 ? 1 : -1;
      const spread = side * (.22 + (i % 7) * .17);
      const distance = 11 + (wave ? 185 : rising ? 140 : 120) * t * (.54 + (i % 5) * .19);
      droplet(ctx, 8 + Math.cos(spread) * distance, Math.sin(spread) * distance,
        (2.4 + (i % 4) * 1.5) * (1 - t * .58), spread);
    }
    ctx.restore();
    return;
  }
  const splash = event.kind === 'tear-splash';
  const size = event.radius ?? 42;
  if (splash && !event.surface) {
    ctx.save();
    ctx.globalAlpha *= 1 - t;
    ctx.strokeStyle = '#c5f7ff';
    ctx.lineWidth = 5 * (1 - t) + 1;
    for (const [start, span] of [[-.5, 1], [1.1, .95], [2.7, .9], [4.1, .85]]) {
      ctx.beginPath();
      ctx.arc(0, 0, size * (.11 + .56 * t), start, start + span);
      ctx.stroke();
    }
    for (let i = 0; i < 14; i++) {
      const angle = i * Math.PI * 2 / 14;
      const distance = size * (.10 + t * (.52 + i % 4 * .15));
      droplet(ctx, Math.cos(angle) * distance, Math.sin(angle) * distance + t * t * 14,
        (3.2 + i % 3 * 1.1) * (1 - t * .55), angle);
    }
    ctx.restore();
    return;
  }
  ctx.save(); ctx.globalAlpha *= 1 - t;
  ctx.strokeStyle = '#9aefff';
  ctx.lineWidth = splash ? 4 * (1 - t) + 1 : 2;
  ctx.beginPath(); ctx.ellipse(0, -3, size * (.25 + t * .75), (splash ? 15 : 7) * (.4 + t), 0, 0, Math.PI * 2); ctx.stroke();
  for (let i = 0; i < (splash ? 14 : 7); i++) {
    const side = i % 2 ? 1 : -1;
    const speed = .3 + (i % 6) * .13;
    const x = side * size * t * speed;
    const y = -5 - Math.sin(t * Math.PI) * (12 + i % 4 * 10);
    droplet(ctx, x, y, (splash ? 5 : 3) * (1 - t * .5), Math.atan2(-1 + t * 2, side));
  }
  if (event.kind === 'hit' && event.actionId?.includes('scratch')) {
    ctx.strokeStyle = '#fff2c9'; ctx.lineWidth = 3 * (1 - t) + 1;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath(); ctx.moveTo(-16 + i * 9, -21); ctx.lineTo(-5 + i * 9, 19); ctx.stroke();
    }
  }
  ctx.restore();
}

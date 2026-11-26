import type { Box, CombatEvent, FighterState, Projectile, ProjectileDefinition } from '../core/types.js';
import { bananaActionIds } from '../content/fighters/banana.js';
import sheerHeartSrc from '../../assets/fighters/banana-sheer-heart-attack.png';
import { sparkle } from './hit-burst.js';
import { drawPixelEffect } from './pixelfx.js';

const sheerHeartSheet = new Image();
sheerHeartSheet.src = sheerHeartSrc;

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

export function drawTimeStopOverlay(ctx: CanvasRenderingContext2D, ts: { source: 0 | 1; frame: number;
  teleportAt: number; flickAt: number; releaseAt: number; originX?: number; originY?: number; flicked?: boolean },
  casterX: number, casterY: number, oppX: number, oppY: number,
  camX: number, camY: number, zoom: number, dx: number, dy: number, reducedMotion: boolean) {
  const { width, height } = ctx.canvas;
  const collapse = Math.min(1, ts.frame / 28);
  const cx = (casterX - camX) * zoom + dx;
  const cy = (casterY - 72 - camY) * zoom + dy;

  // World-space warp trail & accumulating kinetic fracture rings around the frozen target!
  if (ts.frame >= ts.teleportAt && ts.originX !== undefined && ts.originY !== undefined) {
    const warpAge = ts.frame - ts.teleportAt;
    if (warpAge < 18) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - warpAge / 18) * .8;
      ctx.strokeStyle = '#fde047';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.ellipse(ts.originX, ts.originY - 68, 30 + warpAge * 2.2, 68 - warpAge * 2, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }
  if (ts.flicked) {
    const flickAge = ts.frame - ts.flickAt;
    const charge = Math.min(1, flickAge / Math.max(1, ts.releaseAt - ts.flickAt));
    const finisherAt = ts.releaseAt - 26;
    const isFinisher = ts.frame >= finisherAt;
    const pulse = 1 + Math.sin(flickAge * .5) * (.08 + charge * .08);
    ctx.save();
    ctx.translate(oppX, oppY - 68);
    ctx.scale(pulse, pulse);
    // Stored kinetic energy rings & fracture spikes tightening around the frozen opponent!
    const ringCount = 1 + Math.floor(charge * 3);
    for (let r = 0; r < ringCount; r++) {
      ctx.strokeStyle = r % 2 === 0 ? '#fde047' : '#e879f9';
      ctx.lineWidth = isFinisher ? 4 : 2.5;
      ctx.globalAlpha = .48 + charge * .42;
      ctx.beginPath();
      ctx.ellipse(0, 0, 34 + r * 12, 54 + r * 10, (r - 1) * .25, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.strokeStyle = isFinisher ? '#ffffff' : '#fde047';
    ctx.lineWidth = isFinisher ? 4 : 2.5;
    for (let i = 0; i < 8; i++) {
      const a = i * Math.PI / 4 + .18;
      const inner = 20;
      const outer = 38 + charge * 26 + (isFinisher ? 14 : 0);
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * inner, Math.sin(a) * inner);
      ctx.lineTo(Math.cos(a) * outer, Math.sin(a) * outer);
      ctx.stroke();
    }
    if (isFinisher) {
      sparkle(ctx, 44, '#fde047', '#ffffff');
    }
    ctx.restore();
  }

  // Screen-space edge-to-center closing vignette, negative flash, and JoJo manga callouts.
  ctx.save();
  ctx.resetTransform();
  if (!reducedMotion && collapse < 1) {
    const ease = 1 - Math.pow(1 - collapse, 2.2);
    const r = Math.max(0, 960 * (1 - ease));
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, width, height);
    ctx.arc(cx, cy, r, 0, Math.PI * 2, true);
    ctx.fillStyle = `rgba(14, 10, 28, ${0.34 * collapse})`;
    ctx.fill('evenodd');
    ctx.restore();

    ctx.save();
    ctx.strokeStyle = '#fde047';
    ctx.lineWidth = 8 * (1 - collapse * .4);
    ctx.shadowColor = '#a855f7';
    ctx.shadowBlur = 24;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = '#a855f7';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(cx, cy, r + 16, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  } else {
    ctx.fillStyle = 'rgba(14, 10, 28, 0.24)';
    ctx.fillRect(0, 0, width, height);
  }

  // Dramatic JoJo negative pulse right as time locks shut!
  if (!reducedMotion && ts.frame >= 10 && ts.frame <= 16) {
    ctx.fillStyle = ts.frame <= 13 ? 'rgba(217, 70, 239, 0.36)' : 'rgba(253, 224, 71, 0.32)';
    ctx.fillRect(0, 0, width, height);
  }

  // Dramatic manga callouts matched to the 4 acts.
  ctx.font = '900 48px "Microsoft YaHei", sans-serif';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#120722';
  ctx.lineWidth = 10;
  if (ts.frame < ts.teleportAt) {
    ctx.textAlign = 'left';
    ctx.fillStyle = '#fde047';
    ctx.strokeText('ザ・ワールド!!', 64, 150);
    ctx.fillText('ザ・ワールド!!', 64, 150);
  } else if (ts.frame >= ts.releaseAt - 28) {
    ctx.textAlign = 'right';
    ctx.fillStyle = '#e5e7eb';
    ctx.strokeText('そして時は動き出す…', width - 64, height - 114);
    ctx.fillText('そして時は動き出す…', width - 64, height - 114);
  }
  ctx.restore();
}

export function drawTimeStopPunchImpact(ctx: CanvasRenderingContext2D, age: number, life: number, heavy: boolean,
  facing: number, reducedMotion: boolean) {
  const t = age / Math.max(1, life);
  ctx.save();
  const scale = heavy ? 1.85 : 1.25;
  drawPixelEffect(ctx, 'hitSpark', age * 1.4, 0, 0, facing * scale, scale);
  if (!reducedMotion) {
    ctx.globalAlpha = Math.max(0, 1 - t);
    ctx.strokeStyle = heavy ? '#ffffff' : '#fde047';
    ctx.lineWidth = (heavy ? 7 : 4.5) * (1 - t) + 1;
    ctx.beginPath();
    ctx.arc(0, 0, (heavy ? 24 : 14) + t * (heavy ? 112 : 66), 0, Math.PI * 2);
    ctx.stroke();
    sparkle(ctx, (heavy ? 48 : 30) * (1 - t * .45), '#fde047', '#ffffff');
  }
  ctx.restore();
}

export function drawTimeStopReleaseBurst(ctx: CanvasRenderingContext2D, age: number, life: number, reducedMotion: boolean) {
  const t = age / Math.max(1, life);
  ctx.save();
  drawPixelEffect(ctx, 'kqFireblast', age * .95, 0, 14, 1.85, 1.85);
  drawPixelEffect(ctx, 'hitSpark', age * 1.1, 0, -10, 2.0, 2.0);
  ctx.strokeStyle = '#fde047';
  ctx.lineWidth = Math.max(1.5, 9 * (1 - t));
  ctx.beginPath();
  ctx.arc(0, 0, 34 + t * 210, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = '#e879f9';
  ctx.lineWidth = Math.max(1, 5 * (1 - t));
  ctx.beginPath();
  ctx.arc(0, 0, 20 + t * 165, 0, Math.PI * 2);
  ctx.stroke();
  if (!reducedMotion) {
    ctx.globalAlpha = Math.max(0, 1 - t * t);
    ctx.font = '900 36px "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'center';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#120722';
    ctx.lineWidth = 8;
    ctx.strokeText('時は動き出す!!', 0, -76 - t * 38);
    ctx.fillStyle = '#fde047';
    ctx.fillText('時は動き出す!!', 0, -76 - t * 38);
  }
  ctx.restore();
}

function drawGoldSkullCoin(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, spin = 1) {
  ctx.save();
  ctx.translate(x, y);
  // Subtle metallic coin tilt/spin gleam while keeping the skull readable.
  const sx = .78 + .22 * Math.abs(Math.cos(spin));
  ctx.scale(sx, 1);
  // 1. Coin edge thickness + outer golden disc.
  ctx.fillStyle = '#92400e';
  ctx.strokeStyle = '#1e0638';
  ctx.lineWidth = Math.max(2.5, r * .12);
  ctx.beginPath();
  ctx.arc(3, 2, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  const coinGrad = ctx.createLinearGradient(-r, -r, r, r);
  coinGrad.addColorStop(0, '#fef08a');
  coinGrad.addColorStop(.45, '#facc15');
  coinGrad.addColorStop(1, '#d97706');
  ctx.fillStyle = coinGrad;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // 2. Inner raised coin groove & specular gleam.
  ctx.strokeStyle = '#92400e';
  ctx.lineWidth = Math.max(1.6, r * .07);
  ctx.beginPath();
  ctx.arc(0, 0, r * .8, 0, Math.PI * 2);
  ctx.stroke();

  // 3. Killer Queen cat-eared skull relief in the center of the coin.
  const s = r * .56;
  ctx.fillStyle = '#fffbeb';
  ctx.strokeStyle = '#2d083d';
  ctx.lineWidth = Math.max(1.8, r * .085);
  ctx.lineJoin = 'round';
  ctx.beginPath();
  // Pointed Killer Queen cat ears on top of the skull!
  ctx.moveTo(-s * .72, -s * .25);
  ctx.lineTo(-s * .85, -s * 1.05);
  ctx.lineTo(-s * .28, -s * .68);
  ctx.quadraticCurveTo(0, -s * .8, s * .28, -s * .68);
  ctx.lineTo(s * .85, -s * 1.05);
  ctx.lineTo(s * .72, -s * .25);
  // Cheekbones down to toothed jaw.
  ctx.quadraticCurveTo(s * .82, s * .22, s * .46, s * .44);
  ctx.lineTo(s * .46, s * .88);
  ctx.lineTo(-s * .46, s * .88);
  ctx.lineTo(-s * .46, s * .44);
  ctx.quadraticCurveTo(-s * .82, s * .22, -s * .72, -s * .25);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Sharp angry skull eye sockets.
  ctx.fillStyle = '#2d083d';
  ctx.beginPath();
  ctx.moveTo(-s * .56, -s * .22);
  ctx.lineTo(-s * .14, -s * .05);
  ctx.lineTo(-s * .22, s * .22);
  ctx.lineTo(-s * .54, s * .12);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(s * .56, -s * .22);
  ctx.lineTo(s * .14, -s * .05);
  ctx.lineTo(s * .22, s * .22);
  ctx.lineTo(s * .54, s * .12);
  ctx.closePath();
  ctx.fill();
  // Nose slit & skull teeth bars.
  ctx.beginPath();
  ctx.moveTo(0, s * .12);
  ctx.lineTo(-s * .1, s * .34);
  ctx.lineTo(s * .1, s * .34);
  ctx.closePath();
  ctx.fill();
  ctx.lineWidth = Math.max(1.5, r * .07);
  for (const tx of [-.22, 0, .22]) {
    ctx.beginPath();
    ctx.moveTo(s * tx, s * .56);
    ctx.lineTo(s * tx, s * .88);
    ctx.stroke();
  }
  ctx.restore();
}

export function drawKillerQueenOrb(ctx: CanvasRenderingContext2D, p: Projectile) {
  const age = p.age ?? 0;
  const r = p.boosted ? 27 : 23;
  ctx.save();
  // Pixelfx golden spark wake trailing behind the flying coin.
  drawPixelEffect(ctx, 'kqCoin', (age * .9) % 15, p.x - p.facing * 6, p.y, p.facing * 1.5, 1.3);
  if (p.boosted) {
    ctx.strokeStyle = '#fde047';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.ellipse(p.x - p.facing * 24, p.y, 38, 16, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  drawGoldSkullCoin(ctx, p.x, p.y, r, age * .22);
  ctx.restore();
}

export function drawKillerQueenMark(ctx: CanvasRenderingContext2D, f: FighterState, tick: number) {
  if (!f.bombMark) return;
  const ratio = Math.max(0, Math.min(1, f.bombMark.remaining / 240));
  const pulse = 1 + Math.sin(tick * .25) * .07;
  ctx.save();
  ctx.translate(f.x, f.y - 78);
  ctx.scale(pulse, pulse);
  // Golden-purple Killer Queen bomb countdown ring + large skull coin mark.
  ctx.strokeStyle = '#2d083d';
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.arc(0, 0, 32, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = ratio < .25 ? '#ef4444' : '#fde047';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(0, 0, 32, -Math.PI * .5, -Math.PI * .5 + Math.PI * 2 * ratio);
  ctx.stroke();
  drawGoldSkullCoin(ctx, 0, 0, 21, tick * .15);
  ctx.restore();
}

export function drawKillerQueenPlant(ctx: CanvasRenderingContext2D, age: number, life: number, reducedMotion: boolean) {
  const t = age / Math.max(1, life);
  ctx.save();
  ctx.strokeStyle = '#fde047';
  ctx.lineWidth = 4 * (1 - t) + 1;
  ctx.beginPath();
  ctx.arc(0, 0, 18 + t * 44, 0, Math.PI * 2);
  ctx.stroke();
  if (!reducedMotion) {
    ctx.globalAlpha = Math.max(0, 1 - t * t);
    ctx.font = '900 22px "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'center';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#1e0638';
    ctx.lineWidth = 6;
    ctx.strokeText('第一の爆弾!!', 0, -28 - t * 24);
    ctx.fillStyle = '#fde047';
    ctx.fillText('第一の爆弾!!', 0, -28 - t * 24);
  }
  ctx.restore();
}

export function drawKillerQueenDetonation(ctx: CanvasRenderingContext2D, age: number, life: number, reducedMotion: boolean) {
  const t = age / Math.max(1, life);
  ctx.save();
  // Stage 1 (frames 0..12): rapid inward space collapse (Implosion).
  if (age < 13) {
    drawPixelEffect(ctx, 'kqImplosion', age * 1.85, 0, 0, 1.35, 1.35);
  }
  // Stage 2 (frames 4..end): blazing arcade fireball & smoke burst (Big/Small Explosion).
  if (age >= 4) {
    drawPixelEffect(ctx, 'kqFireblast', (age - 4) * 1.0, 0, 12, 1.45, 1.45);
  }
  if (!reducedMotion) {
    ctx.globalAlpha = Math.max(0, 1 - t * t);
    ctx.font = '900 32px "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'center';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#1a0428';
    ctx.lineWidth = 8;
    const label = age < 7 ? 'カチッ!!' : 'キラークイーン!!';
    ctx.strokeText(label, 0, -62 - t * 30);
    ctx.fillStyle = age < 7 ? '#ffffff' : '#fde047';
    ctx.fillText(label, 0, -62 - t * 30);
  }
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
  const phase = reducedMotion ? 0 : age * .34;
  const fade = Math.min(1, Math.max(.10, ((data.life ?? 40) - age) / 7));
  const swell = .85 + .22 * (1 - Math.max(0, 1 - age / 8) ** 2);
  const pulse = reducedMotion ? 0 : Math.sin(age * .42) * .06;
  const crestHeight = swell * (.84 + fade * .22 + pulse) * 1.24;
  const waveSpan = (data.halfWidth ?? data.radius) / 104 * 1.28;
  ctx.save();
  ctx.translate(p.x, p.y + data.radius);
  ctx.scale(p.facing * waveSpan, data.radius / 98 * crestHeight);
  ctx.globalAlpha *= fade;

  // Flooded ground wake & roaring floor spray behind the advancing tsunami.
  ctx.fillStyle = '#14396094';
  ctx.beginPath();
  ctx.ellipse(-65, 6, 155, 13, 0, 0, Math.PI * 2);
  ctx.fill();
  if (!reducedMotion) {
    const wake = ctx.createLinearGradient(-320, 0, 40, 0);
    wake.addColorStop(0, '#2eaee800');
    wake.addColorStop(.55, '#48c8f588');
    wake.addColorStop(1, '#d8fbffbb');
    ctx.fillStyle = wake;
    ctx.fillRect(-320, -11, 360, 14);
    for (const [offset, alpha] of [[-78, .22], [-40, .38]] as const) {
      ctx.save();
      ctx.translate(offset, 0);
      ctx.scale(.94, .92);
      ctx.globalAlpha *= alpha;
      ctx.fillStyle = '#2587c9';
      ctx.fill(waveCrest);
      ctx.restore();
    }
  }
  const water = ctx.createLinearGradient(0, -182, 0, 0);
  water.addColorStop(0, '#aef5ff');
  water.addColorStop(.4, '#2bb3e6');
  water.addColorStop(1, '#125096');
  ctx.fillStyle = water;
  ctx.strokeStyle = '#142f59';
  ctx.lineWidth = 4.5;
  ctx.lineJoin = 'round';
  ctx.fill(waveCrest);
  ctx.stroke(waveCrest);
  ctx.fillStyle = '#1b5f9eb8';
  ctx.fill(waveShadow);
  ctx.fillStyle = '#ebfeff';
  ctx.fill(waveFoam);
  ctx.save();
  ctx.clip(waveCrest);
  ctx.globalAlpha *= .85;
  ctx.globalCompositeOperation = 'screen';
  const surfFrame = Math.min(13, Math.floor(age * .34));
  const surfPhase = (20 + surfFrame) / 36;
  const sourceCrest = -80 + 36 * (1 - Math.cos(Math.PI * surfPhase));
  drawPixelEffect(ctx, 'waveCrash', surfFrame, 38 - sourceCrest * 2.45, 0, 2.45, 5.05);
  ctx.restore();
  ctx.strokeStyle = '#a6f4ff';
  ctx.lineCap = 'round';
  for (let i = 0; i < 7; i++) {
    const x = -140 + i * 26 + Math.sin(phase + i) * 9;
    const y = -12 - i % 3 * 11;
    ctx.lineWidth = 2.8 + i % 3;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + 22, y - 11, x + 42, y - 9);
    ctx.stroke();
  }
  for (let i = 0; i < 22; i++) {
    const t = (i * .17 + phase * .24) % 1;
    const x = i < 11 ? 30 + (i % 5) * 24 + t * 34 : -150 + (i % 5) * 62 + t * 32;
    const y = i < 11 ? -200 + t * t * 68 - i % 2 * 10 : -14 - Math.sin(t * Math.PI) * (20 + i % 3 * 16);
    droplet(ctx, x, y, 2.4 + i % 4 * 1.4, i < 11 ? -.48 + t : -.3);
  }
  // Leading hydro-wind arcs slicing ahead of the crest.
  ctx.strokeStyle = '#e2fcff';
  ctx.lineCap = 'round';
  for (let i = 0; i < 4; i++) {
    ctx.globalAlpha = .72 - i * .15;
    ctx.lineWidth = 3.5 - i * .7;
    ctx.beginPath();
    ctx.arc(44 + i * 20, -112 + i * 24, 52 + i * 16, -.7, .48);
    ctx.stroke();
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
      ctx.ellipse(direction * 32, 24, 175, 138, 0, 0, Math.PI * 2);
      ctx.clip();
      drawPixelEffect(ctx, 'waveCrash', 14 + t * 36, direction * 20, 48, direction * 3.1, 3.6);
      drawPixelEffect(ctx, 'splash', Math.min(18, 6 + age * 1.1), direction * 18, 16, direction * 2.6, 2.8, true);
    } else {
      // The crown stays raised through the hit stop, then spills over.
      drawPixelEffect(ctx, 'splash', age < 3 ? 6 : 6 + (age - 3) * 1.05, direction * 12, 4,
        direction * (rising ? 2 : 1.7), rising ? 2 : 1.7, true);
    }
    ctx.restore();
    ctx.save();
    // A white-hot core marks the contact the way a claw hit does, so a jet that connects still reads as a hit.
    if (wave && age < 6) {
      ctx.save();
      ctx.globalAlpha *= 1 - age / 6;
      sparkle(ctx, 132, '#2ec4f6', '#ffffff');
      ctx.restore();
    } else if (!wave && age < 4) {
      ctx.save();
      ctx.globalAlpha *= age < 2 ? 1 : 1 - (age - 1) / 3;
      ctx.rotate(rising ? -Math.PI / 2 : direction === 1 ? 0 : Math.PI);
      sparkle(ctx, (rising ? 96 : 84) * (age === 0 ? .88 : 1 + Math.min(3, age) * .03), '#38bff0', '#bff6ff');
      ctx.restore();
    }
    ctx.globalAlpha *= 1 - t;
    ctx.rotate(rising ? -Math.PI / 2 : direction === 1 ? 0 : Math.PI);
    ctx.lineWidth = (rising ? 7 : 6) * (1 - t) + 1;
    ctx.strokeStyle = '#c4fbff';
    ctx.beginPath();
    ctx.ellipse(8 + 31 * t, 0, 8 + 13 * t, 14 + 26 * t, 0, -1.26, 1.26);
    ctx.stroke();
    for (let i = 0; i < 26; i++) {
      const side = i % 2 ? 1 : -1;
      const spread = side * (.22 + (i % 7) * .17);
      const distance = 13 + (wave ? 185 : rising ? 190 : 165) * t * (.54 + (i % 5) * .19);
      droplet(ctx, 8 + Math.cos(spread) * distance, Math.sin(spread) * distance,
        (3.4 + (i % 4) * 1.9) * (1 - t * .58), spread);
    }
    ctx.restore();
    return;
  }
  const splash = event.kind === 'tear-splash';
  const size = event.radius ?? 42;
  if (splash && !event.surface) {
    ctx.save();
    // Bursting on a fighter throws water in every direction: a crown, a flash and a wide ring of drops.
    drawPixelEffect(ctx, 'splash', Math.min(18, 7 + age * .9), 0, size * .3, size / 58, size / 58, true);
    if (age < 3) {
      ctx.save();
      ctx.globalAlpha *= age < 2 ? 1 : .4;
      sparkle(ctx, size * .8 * (age === 0 ? .88 : 1.04), '#38bff0', '#bff6ff');
      ctx.restore();
    }
    ctx.globalAlpha *= 1 - t;
    ctx.strokeStyle = '#c5f7ff';
    ctx.lineWidth = 6 * (1 - t) + 1;
    for (const [start, span] of [[-.5, 1], [1.1, .95], [2.7, .9], [4.1, .85]]) {
      ctx.beginPath();
      ctx.arc(0, 0, size * (.14 + .72 * t), start, start + span);
      ctx.stroke();
    }
    for (let i = 0; i < 22; i++) {
      const angle = i * Math.PI * 2 / 22;
      const distance = size * (.12 + t * (.62 + i % 4 * .16));
      droplet(ctx, Math.cos(angle) * distance, Math.sin(angle) * distance + t * t * 18,
        (4.2 + i % 3 * 1.6) * (1 - t * .55), angle);
    }
    ctx.restore();
    return;
  }
  if (splash) drawPixelEffect(ctx, 'splash', Math.min(18, 6 + age * .9), 0, 0, 1.7, 1.7, true);
  ctx.save(); ctx.globalAlpha *= 1 - t;
  ctx.strokeStyle = '#9aefff';
  ctx.lineWidth = splash ? 5 * (1 - t) + 1 : 2;
  ctx.beginPath(); ctx.ellipse(0, -3, size * (.25 + t * .75), (splash ? 22 : 7) * (.4 + t), 0, 0, Math.PI * 2); ctx.stroke();
  for (let i = 0; i < (splash ? 20 : 10); i++) {
    const side = i % 2 ? 1 : -1;
    const speed = (.3 + (i % 6) * .13) * (splash ? 1.3 : 1.6);
    const x = side * size * t * speed;
    const y = -5 - Math.sin(t * Math.PI) * (12 + i % 4 * 10) * (splash ? 1.25 : 1.5);
    droplet(ctx, x, y, (splash ? 6.5 : 4.2) * (1 - t * .5), Math.atan2(-1 + t * 2, side));
  }
  if (event.kind === 'hit' && event.actionId?.includes('scratch')) {
    // Three parallel claw marks, rimmed so all three stay visible over a pale opponent.
    ctx.lineCap = 'round';
    for (const [color, width] of [['#2a2a4e', 8], ['#fff2c9', 4.5]] as const) {
      ctx.strokeStyle = color;
      ctx.lineWidth = width * (1 - t * .8);
      for (let i = 0; i < 3; i++) {
        ctx.beginPath(); ctx.moveTo(-30 + i * 16, -32); ctx.lineTo(-10 + i * 16, 30); ctx.stroke();
      }
    }
  }
  ctx.restore();
}

export function drawSheerHeartAttack(ctx: CanvasRenderingContext2D, p: Projectile, tick: number) {
  const locked = p.locked;
  const frame = locked !== undefined
    ? (locked >= 30 ? 7 : locked >= 17 ? 6 : locked >= 6 ? 5 : 4)
    : Math.floor(tick / 4) % 4;
  const shakeX = locked !== undefined && locked >= 30 ? Math.sin(tick * 2.6) * 3 : 0;

  ctx.save();
  ctx.translate(p.x + shakeX, p.y);
  // Subtle red radar range sweep while cruising, intensifies to bright lock indicator when target found.
  ctx.strokeStyle = locked !== undefined ? 'rgba(239, 68, 68, .48)' : 'rgba(239, 68, 68, .13)';
  ctx.lineWidth = locked !== undefined ? 2.5 : 1.5;
  ctx.setLineDash(locked !== undefined ? [8, 4] : [10, 8]);
  ctx.beginPath();
  ctx.arc(0, -20, locked !== undefined ? Math.max(26, 90 - locked * 1.5) : 225, Math.PI, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = '#0c082099';
  ctx.beginPath();
  ctx.ellipse(0, 1, 28, 6, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.scale(p.facing, 1);
  if (sheerHeartSheet.naturalWidth) {
    const col = frame % 4;
    const row = Math.floor(frame / 4);
    const scale = .46;
    const drawSize = 256 * scale;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(sheerHeartSheet, col * 256, row * 256, 256, 256,
      -128 * scale, -195 * scale, drawSize, drawSize);
  }
  ctx.restore();
}

export function drawSheerHeartLock(ctx: CanvasRenderingContext2D, age: number, life: number, reducedMotion: boolean) {
  if (reducedMotion) return;
  const t = age / Math.max(1, life);
  ctx.save();
  ctx.globalAlpha = Math.max(0, 1 - t * t);
  ctx.strokeStyle = age % 4 < 2 ? '#ef4444' : '#fde047';
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.arc(0, -14, 16 + t * 54, 0, Math.PI * 2);
  ctx.stroke();
  ctx.font = '900 20px "Microsoft YaHei", sans-serif';
  ctx.textAlign = 'center';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#120722';
  ctx.lineWidth = 6;
  ctx.strokeText('コッチヲ見ロ!!', 0, -48 - t * 22);
  ctx.fillStyle = age < 6 ? '#ef4444' : '#fde047';
  ctx.fillText('コッチヲ見ロ!!', 0, -48 - t * 22);
  ctx.restore();
}

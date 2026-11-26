import { bananaActionIds as ids } from '../content/fighters/banana.js';
import type { ActionDefinition, FighterState } from '../core/types.js';
import bananaSprites from '../../assets/fighters/unified-handdrawn-v1/motion/banana/registered/banana-arcade-actions.webp';
import bananaJetExpressions from '../../assets/fighters/unified-handdrawn-v1/motion/banana/registered/banana-jet-expressions.webp';
import bananaCombatActions from '../../assets/fighters/banana-combat-actions.webp';
import bananaEntranceScenes from '../../assets/fighters/banana-entrance-scenes.webp';
import bananaVictoryScenes from '../../assets/fighters/banana-victory-scenes.webp';
import { drawCryingTears, drawTearJets } from './banana-fx.js';
import { drawBananaWaveMotion } from './banana-wave-art.js';
import { drawBananaHurt } from './banana-hit-art.js';
import { easeOut, noise } from './cinematics.js';
import { drawSparkle } from './cutin-art.js';

const atlas = new Image();
atlas.src = bananaSprites;
const jetAtlas = new Image();
jetAtlas.src = bananaJetExpressions;
const combatAtlas = new Image();
combatAtlas.src = bananaCombatActions;
const entranceAtlas = new Image();
entranceAtlas.src = bananaEntranceScenes;
const victoryAtlas = new Image();
victoryAtlas.src = bananaVictoryScenes;

const tile = { width: 384, height: 352, footX: 176, footY: 334, scale: .5 };

const poses = {
  idle: { column: 0, row: 0, soles: [[-23, -3], [-18.5, -1], [22, -2]] },
  stride: { column: 1, row: 0, soles: [[-42, -10.5], [-38.5, -6.5], [7, -.5], [21.5, -3.5]] },
  sob: { column: 2, row: 0, soles: [[-24, -3], [-18, -.5], [21, -1.5]],
    eyes: [{ x: 0, y: -53 }, { x: 39, y: -53 }] },
  strike: { column: 0, row: 1, soles: [[-47.5, -2.5], [-42.5, -.5], [39.5, -2]],
    eyes: [{ x: 18, y: -63 }, { x: 52, y: -64 }] },
  rise: { column: 1, row: 1, soles: [[-28, -3.5], [-22, -1], [27.5, -3]],
    eyes: [{ x: -2, y: -95 }, { x: 32.5, y: -100 }] },
  low: { column: 2, row: 1, soles: [[-50.5, -3], [-49, -1.5], [-45, -.5], [50.5, -1]] },
  pressure: { column: 0, row: 0, jets: true, soles: [[-41.5, -1], [42.5, -1.5]],
    eyes: [{ x: 18.7, y: -63.5 }, { x: 53, y: -62.9 }] },
  uppercut: { column: 1, row: 0, jets: true, soles: [[-26, -.5], [27, -.5]],
    eyes: [{ x: -9.4, y: -91.1 }, { x: 30, y: -97.8 }] }
};
type Pose = keyof typeof poses;

const attacks: Record<string, Pose> = {
  [ids.jab]: 'strike',
  [ids.backhand]: 'strike',
  [ids.headbutt]: 'strike',
  [ids.cry]: 'sob',
  [ids.lift]: 'rise',
  [ids.slide]: 'low',
  [ids.tear]: 'strike',
  [ids.pressure]: 'pressure',
  [ids.uppercut]: 'uppercut',
  [ids.recharge]: 'sob',
  [ids.wave]: 'uppercut'
};

const strikeTilt: Partial<Record<string, number>> = {
  [ids.jab]: .04,
  [ids.backhand]: -.05,
  [ids.headbutt]: .08,
  [ids.tear]: .06
};

const combatFrames: Partial<Record<string, { windup: number; strike: number; recover?: number }>> = {
  [ids.jab]: { windup: 0, strike: 1 },
  [ids.backhand]: { windup: 2, strike: 3 },
  [ids.headbutt]: { windup: 4, strike: 5, recover: 14 },
  [ids.cry]: { windup: 6, strike: 7, recover: 14 },
  [ids.lift]: { windup: 8, strike: 9, recover: 14 },
  [ids.slide]: { windup: 10, strike: 11, recover: 14 },
  [ids.tear]: { windup: 12, strike: 13 }
};

function combatCellFor(f: FighterState, action: ActionDefinition | undefined, frame: number, recovery: number): number | undefined {
  if (!combatAtlas.naturalWidth) return undefined;
  if (f.hp > 0 && f.guarding) return 15;
  if (!action || !f.attack) return undefined;
  const map = combatFrames[action.id];
  if (!map) return undefined;
  if (frame < action.startup) return map.windup;
  if (recovery < action.recovery * .65) return map.strike;
  return map.recover;
}

function choosePose(f: FighterState, action: ActionDefinition | undefined, frame: number, recovery: number): Pose {
  if (!f.hp || f.guarding) return 'low';
  if (action && f.attack) {
    if (frame < action.startup) return action.id === ids.pressure ? 'sob' : 'low';
    if (recovery < action.recovery * .55) return attacks[action.id] ?? 'strike';
  }
  if (f.dash || !f.ground) return 'stride';
  if (f.walk && Math.floor(f.walk.distance / 22) % 2 === 1) return 'stride';
  return 'idle';
}

export type BananaStageCue = { kind: 'entrance' | 'victory'; frame: number };

function drawStageRipple(ctx: CanvasRenderingContext2D, age: number, maxAge: number, maxRadius: number) {
  if (age < 0 || age >= maxAge) return;
  const t = easeOut(age / maxAge);
  ctx.save();
  ctx.globalAlpha = (1 - t) * .72;
  ctx.strokeStyle = '#9ceeff';
  ctx.lineWidth = 2.6 * (1 - t) + .8;
  ctx.beginPath();
  ctx.ellipse(0, -1, t * maxRadius, t * maxRadius * .24, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawSceneCell(ctx: CanvasRenderingContext2D, sheet: HTMLImageElement, index: number, yOffset = 0, scaleX = 1, scaleY = 1) {
  const col = index % 4;
  const row = Math.floor(index / 4);
  ctx.save();
  ctx.translate(0, yOffset);
  ctx.scale(scaleX, scaleY);
  ctx.drawImage(sheet, col * tile.width, row * tile.height, tile.width, tile.height,
    -tile.footX * tile.scale, -tile.footY * tile.scale, tile.width * tile.scale, tile.height * tile.scale);
  ctx.restore();
}

function drawStageEntrance(ctx: CanvasRenderingContext2D, f: FighterState, frame: number) {
  const sheet = entranceAtlas.naturalWidth ? entranceAtlas : atlas;
  const index = Math.min(15, Math.floor(frame / 12));

  // Startled jump across keyframes 4-5, landing squash on 6, crisp stance snap on 15.
  const hop = index === 4 || index === 5 ? Math.sin((frame - 48) / 24 * Math.PI) * 28 : 0;
  const landAge = frame - 72;
  const squash = landAge >= 0 && landAge < 8 ? Math.sin(landAge / 8 * Math.PI) : 0;
  const snapAge = frame - 180;
  const snap = snapAge >= 0 && snapAge < 8 ? Math.sin(snapAge / 8 * Math.PI) : 0;

  ctx.save();
  ctx.shadowBlur = 0;

  // Tear puddle under Banana Cat during sobbing (keyframes 9-10), splashing away on resolve.
  if (frame >= 108) {
    const puddle = frame < 144
      ? Math.min(1, (frame - 108) / 24)
      : Math.max(0, 1 - (frame - 144) / 18);
    if (puddle > 0) {
      ctx.fillStyle = '#4fc8eb54';
      ctx.beginPath();
      ctx.ellipse(0, 0, 22 + puddle * 44, 4 + puddle * 6, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  drawStageRipple(ctx, landAge, 20, 64);
  if (frame >= 120) drawStageRipple(ctx, frame - 120, 22, 74);
  if (frame >= 180) drawStageRipple(ctx, snapAge, 18, 86);

  const cell = sheet === entranceAtlas ? index : (index < 12 ? 2 : 3);
  drawSceneCell(ctx, sheet, cell, -hop,
    1 + squash * .12 - snap * .05,
    1 - squash * .10 + snap * .06);

  if (snapAge >= 0 && snapAge < 16) {
    const glint = 1 - snapAge / 16;
    ctx.save();
    ctx.globalAlpha = glint;
    ctx.fillStyle = '#fff5bd';
    drawSparkle(ctx, 22, -102, 13 * glint + 3);
    ctx.restore();
  }
  ctx.restore();
  void f;
}

function drawStageVictory(ctx: CanvasRenderingContext2D, f: FighterState, frame: number) {
  const sheet = victoryAtlas.naturalWidth ? victoryAtlas : atlas;
  const index = Math.min(15, Math.floor(frame / 12));

  // Happy Cat mid-air jump across keyframes 5-6, celebratory bounce on dance frames 8-11.
  const hop = index === 5 || index === 6 ? Math.sin((frame - 60) / 24 * Math.PI) * 34
    : index >= 8 && index <= 11 ? Math.sin(((frame - 96) % 12) / 12 * Math.PI) * 10 : 0;
  const landAge = frame - 84;
  const snapAge = frame - 180;
  const snap = snapAge >= 0 && snapAge < 8 ? Math.sin(snapAge / 8 * Math.PI) : 0;

  ctx.save();
  ctx.shadowBlur = 0;

  drawStageRipple(ctx, landAge, 20, 76);
  drawStageRipple(ctx, frame - 108, 18, 72);
  drawStageRipple(ctx, frame - 132, 18, 72);
  drawStageRipple(ctx, snapAge, 20, 84);

  const cell = sheet === victoryAtlas ? index : 2;
  drawSceneCell(ctx, sheet, cell, -hop, 1 - snap * .05, 1 + snap * .06);

  // Celebratory sparkles on joyful frames (5-15).
  if (index >= 5) {
    for (let i = 0; i < 3; i++) {
      const cycle = (frame + i * 11) % 30;
      const life = cycle / 30;
      const sx = (i % 2 ? 1 : -1) * (32 + noise(i * 7 + Math.floor((frame + i * 11) / 30)) * 34);
      const sy = -45 - noise(i * 13 + Math.floor((frame + i * 11) / 30)) * 75 - life * 18;
      ctx.save();
      ctx.globalAlpha = Math.sin(life * Math.PI) * .92;
      ctx.fillStyle = i % 2 ? '#fff6bd' : '#aef6ff';
      drawSparkle(ctx, sx, sy, 5 + Math.sin(life * Math.PI) * 6);
      ctx.restore();
    }
  }
  ctx.restore();
  void f;
}

export function drawBanana(ctx: CanvasRenderingContext2D, f: FighterState,
  action: ActionDefinition | undefined, tick: number, reducedMotion = false, stageCue?: BananaStageCue) {
  if (!atlas.naturalWidth) return;
  if (stageCue && !reducedMotion) {
    if (stageCue.kind === 'entrance') drawStageEntrance(ctx, f, stageCue.frame);
    else drawStageVictory(ctx, f, stageCue.frame);
    return;
  }
  if (!action && drawBananaHurt(ctx, f, reducedMotion)) return;
  const frame = f.attack?.frame ?? 0;
  if (action?.id === ids.wave && action.cutIn &&
    drawBananaWaveMotion(ctx, frame, action.startup, action.cutIn.at, reducedMotion)) return;
  const recovery = action ? frame - action.startup - action.active : 0;
  const active = Boolean(action && frame >= action.startup && recovery < 0);
  const combatCell = combatCellFor(f, action, frame, recovery);
  if (combatCell !== undefined) {
    const slide = action?.id === ids.slide && active;
    const tilt = active && action ? strikeTilt[action.id] ?? 0 : 0;
    const bounce = active && action?.id === ids.headbutt ? -6 : 0;
    ctx.save();
    ctx.shadowBlur = 0;
    if (slide) {
      ctx.fillStyle = '#67cdde99';
      ctx.beginPath();
      ctx.ellipse(-26, -2, 74, 4.5, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    drawSceneCell(ctx, combatAtlas, combatCell, bounce, 1, 1);
    if (active && action?.id === ids.cry) {
      const waveAge = frame - action.startup;
      ctx.strokeStyle = '#a3eaff';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.ellipse(0, -64, 105 + waveAge * 10, 48 + waveAge * 4, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
    void tilt;
    return;
  }
  const spraying = action?.id === ids.pressure || action?.id === ids.uppercut;
  const releasing = spraying && recovery >= 0 && recovery < 7;
  const preferredPose = choosePose(f, action, frame, recovery);
  const pose = !jetAtlas.naturalWidth && preferredPose === 'pressure' ? 'strike'
    : !jetAtlas.naturalWidth && preferredPose === 'uppercut' ? 'rise' : preferredPose;
  const cell = poses[pose];
  const slide = action?.id === ids.slide && active;
  const gait = f.walk ? Math.sin(f.walk.distance / 9) : 0;
  const rolling = f.hp === 0 ? -.99 : 0;
  const skillTilt = active && action ? strikeTilt[action.id] ?? 0 : 0;
  const sprayAge = action ? frame - action.startup + (f.attack?.sustainedFrames ?? 0) : 0;
  const kick = spraying && active && !reducedMotion ? Math.max(0, 1 - sprayAge / 7) : 0;
  const forwardJet = action?.id === ids.pressure;
  const lean = (rolling || (slide ? .27 : f.dash ? .24 : f.walk ? .055 * gait : skillTilt)) -
    (forwardJet ? .14 : .07) * kick;
  const settle = !active && recovery > 0 ? Math.min(1, recovery / 8) : 0;
  const effectTick = reducedMotion ? 0 : tick;
  const squash = pose === 'sob' ? Math.sin(effectTick * .34) * .025 : Math.sin(effectTick * .12) * .015;
  const compress = (slide ? .85 : f.hp ? 1 : .83) - (forwardJet ? .025 : .10) * kick;
  const transform = new DOMMatrix().translate(slide ? 5 : forwardJet ? -10 * kick : 0, 0)
    .rotate(lean * 180 / Math.PI).scale(1 - squash * .6, compress * (1 + squash - settle * .015));
  const planted = Math.max(...cell.soles.map(([x, y]) => transform.transformPoint({ x, y }).y));
  transform.f = f.ground ? -planted : -4;
  ctx.save();
  ctx.shadowBlur = 0;
  if (slide) {
    ctx.fillStyle = '#67cdde8c';
    ctx.beginPath();
    ctx.ellipse(-23, -2, 67, 3.5, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.save();
  ctx.transform(transform.a, transform.b, transform.c, transform.d, transform.e, transform.f);
  ctx.drawImage('jets' in cell ? jetAtlas : atlas, cell.column * tile.width, cell.row * tile.height, tile.width, tile.height,
    -tile.footX * tile.scale, -tile.footY * tile.scale, tile.width * tile.scale, tile.height * tile.scale);
  ctx.restore();
  if ('eyes' in cell && action && (active || releasing)) {
    const eyes = cell.eyes.map(eye => transform.transformPoint(eye));
    if (spraying) {
      drawTearJets(ctx, eyes, action.hitbox, action.id === ids.uppercut, sprayAge, releasing ? recovery + 1 : 0, effectTick);
    } else if (action.id === ids.recharge) {
      drawCryingTears(ctx, eyes, 1, effectTick);
    }
  }
  if (active && action && (action.id === ids.jab || action.id === ids.backhand || action.id === ids.lift)) {
    ctx.strokeStyle = '#fff2b2';
    ctx.lineCap = 'round';
    ctx.lineWidth = 2.5;
    if (action.id === ids.lift) ctx.stroke(new Path2D('M20-45 Q77-100 20-180'));
    else for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(43, -92 + i * 10);
      ctx.quadraticCurveTo(80, -90 + i * 10, 100, -72 + i * 10);
      ctx.stroke();
    }
  } else if (active && action?.id === ids.cry) {
    ctx.strokeStyle = '#a3eaff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(0, -64, 100 + frame - action.startup, 45, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

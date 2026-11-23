import { bananaActionIds as ids } from '../content/fighters/banana.js';
import type { ActionDefinition, FighterState } from '../core/types.js';
import bananaSprites from '../../assets/fighters/unified-handdrawn-v1/motion/banana/registered/banana-arcade-actions.webp';
import bananaJetExpressions from '../../assets/fighters/unified-handdrawn-v1/motion/banana/registered/banana-jet-expressions.webp';
import { drawCryingTears, drawTearJets } from './banana-fx.js';
import { drawBananaWaveMotion } from './banana-wave-art.js';
import { drawBananaHurt } from './banana-hit-art.js';

const atlas = new Image();
atlas.src = bananaSprites;
const jetAtlas = new Image();
jetAtlas.src = bananaJetExpressions;

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
  [ids.jab]: .06,
  [ids.backhand]: -.15,
  [ids.headbutt]: .24,
  [ids.tear]: .14
};

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

export function drawBanana(ctx: CanvasRenderingContext2D, f: FighterState,
  action: ActionDefinition | undefined, tick: number, reducedMotion = false) {
  if (!atlas.naturalWidth) return;
  if (!action && drawBananaHurt(ctx, f, reducedMotion)) return;
  const frame = f.attack?.frame ?? 0;
  if (action?.id === ids.wave && action.cutIn &&
    drawBananaWaveMotion(ctx, frame, action.startup, action.cutIn.at, reducedMotion)) return;
  const recovery = action ? frame - action.startup - action.active : 0;
  const active = Boolean(action && frame >= action.startup && recovery < 0);
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

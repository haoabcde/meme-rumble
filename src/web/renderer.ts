import { motionGrid } from '../content/fighter-kit.js';
import { ringLayers } from './ring-art.js';
import { bananaActionIds } from '../content/fighters/banana.js';
import { gagaActionIds } from '../content/fighters/gaga.js';
import { roster } from '../content/roster.js';
import type { EntityState } from '../core/entities.js';
import { frogPowered } from '../core/frog-kit.js';
import { actionFor, hitRegionsFor, hurtRegionsFor, isActiveFrame, recoveryDuration, worldBox } from '../core/match.js';
import { summonFallFrames } from '../core/summon.js';
import { platformAt } from '../core/terrain.js';
import { turretBoosted, turretBuildTicks } from '../core/turret.js';
import { DEFAULT_RISE_FRAMES, isAttack } from '../core/types.js';
import type { ActionDefinition, ArenaDefinition, Box, CombatEvent, FighterAction, FighterState, MatchConfig, MatchState, Summon } from '../core/types.js';
import { cinematicOwner } from '../core/whale-kit.js';
import { backgrounds, harborProps, harborGantry, ringPerformers, stageKits, drawEngineeringCrate, drawGagaLaunchTrail,
  drawGagaPole, drawGrenade, drawThrownPole, drawTurret, drawTurretBolt, gagaActionPose, gagaReactionPose, gagaStatePose,
  motionArt, sprites, type PolePose } from './art.js';
import { drawBanana, drawBananaJoDashTrail, drawBananaTheWorldStrike, drawBananaWorldStand, type StandLinger } from './banana-art.js';
import { bananaEffectLife, drawBananaEffect, drawBananaProjectile, drawBananaWave,
  drawKillerQueenDetonation, drawKillerQueenMark, drawKillerQueenOrb, drawKillerQueenPlant,
  drawSheerHeartAttack, drawSheerHeartLock, drawTimeStopOverlay, drawTimeStopPunchImpact, drawTimeStopReleaseBurst, isTearJet } from './banana-fx.js';
import { drawBananaImpact } from './banana-hit-art.js';
import { drawBananaJoCutIn, drawBananaWaveCutIn, drawJoShatterBurst } from './banana-wave-art.js';
import { frameCamera, frameDijiangLength, frameDijiangImpact, frameEntrance, frameTimeStopCamera, type CameraView } from './camera.js';
import { shotFading, shotOpacity, type FeatureShot, type FighterIntro } from './cinematics.js';
import { dijiangImpactLife, drawDijiang, drawDijiangGround, drawDijiangImpact, drawDijiangPressure,
  drawSummonCutIn } from './dijiang.js';
import { drawFrogActor, drawFrogEffects, drawFrogIntro } from './frog-art.js';
import { drawGagaContact, drawGagaReceive, gagaContact, type GagaContact } from './gaga-contact.js';
import { drawCrystalLockOnBeam, drawCrystalPlant, drawCrystalShatter, drawCrystalSpire, drawDiveLandImpact, drawOriginiumCrystalMark, drawPowerPylonField, drawPylonExpireEffect, drawPylonPlantEffect, drawSparkProjectile, drawSwordChargeGlint, drawSwordReleaseSlash, drawSwordWaveProjectile, drawTurretSpeedBoost, drawXiraniteBurstEffect } from './gaga-fx.js';
import { drawGagaImpact, gagaStrike } from './gaga-hit-art.js';
import { gagaIntro } from './gaga-intro.js';
import { drawPoleDust, drawPoleEarthBurst, drawPoleGroundMark, poleDustLife, poleImpactLife,
  poleSwingFor, type PoleSwing } from './gaga-pole-fx.js';
import { drawTurretEffect, isTurretEffect, turretEffectLife } from './gaga-turret-fx.js';
import { drawGagaWalk, GagaWalk } from './gaga-walk.js';
import { drawHarborScenery, drawHarborLift, drawQuay } from './harbor-art.js';
import { drawKnockdownDust, drawKnockdownPose, knockdownPose } from './knockdown-art.js';
import { drawStageBackdrop, drawStageMechanism, drawStageScenery } from './stage-art.js';
import { drawWhaleActor, drawWhaleEntities, drawWhaleIntro } from './whale-art.js';

export const seatColors = ['#61d8ff', '#ff849e'];
export const recoveryLabels = { fall: '击倒', down: '倒地', rise: '起身' };
const entrances: Partial<Record<string, FighterIntro>> = { gaga: gagaIntro };
/** The banana cat brings its own entrance, drawn by its own art. */
const stageEntrance = (fighter: MatchConfig['fighters'][number]) => fighter.id === 'banana' || Boolean(entrances[fighter.id]);
/** Length of each round's opening. It stretches from the usual 120 frames whenever a fighter performs an entrance. */
export const openingTicks = (fighters: MatchConfig['fighters']) => fighters.some(stageEntrance) ? 192 : 120;
/** Frame of the entrance, counted from the first frame of the opening, or -1 once the round is under way. */
export const openingFrame = (state: MatchState, fighters: MatchConfig['fighters']) =>
  state.phase === 'ready' ? openingTicks(fighters) - state.phaseTicks : -1;
/** The entrance a fighter performs on the stage, when it brings one. */
export const entranceFor = (fighter: MatchConfig['fighters'][number]) => entrances[fighter.id];
const arenaColors = { dorm: '#ffc08c', court: '#8faaff', harbor: '#8de9cd', station: '#bc9bff', ring: '#fe72be', broadcast: '#f05aaa' };
const tierColors = ['#6adfff', '#ffdd87', '#edacff', '#c1ebad'];
const artSizes = new Map(roster.map(entry => [entry.fighter.id, entry.height]));
const harborLayers = { backdrop: drawQuay, scenery: drawHarborScenery, mechanism: drawHarborLift };
const campusLayers = { backdrop: drawStageBackdrop, scenery: drawStageScenery, mechanism: drawStageMechanism };
const layersFor = (arena: ArenaDefinition) => {
  if (arena.theme === 'ring') return ringLayers;
  return arena.theme === 'harbor' ? harborLayers : campusLayers;
};
const sheetsFor = (arena: ArenaDefinition) => {
  if (arena.theme === 'ring') return [ringPerformers];
  return arena.theme === 'harbor' ? [harborProps, harborGantry] : [stageKits[arena.theme]];
};
type Point = [number, number];
const poses = {
  run: 0, stride: 1, jump: 2, guard: 3, windup: 4, strike: 5,
  sweep: 6, finish: 7, rise: 8, air: 9, recover: 10, hurt: 11
};

function poseFor(fighter: FighterState, action: FighterAction | undefined, frame: number, getUp: number) {
  if (!fighter.hp) return poses.hurt;
  if (fighter.recovery) return getUp >= .42 ? poses.recover : poses.hurt;
  if (fighter.hitstun || fighter.launched || fighter.guardBreak) return poses.hurt;
  if (fighter.guarding) return poses.guard;
  if (action && fighter.attack) {
    const phase = fighter.attack.frame;
    const keys = action.animation;
    if (keys) {
      for (let i = keys.length - 1; i >= 0; i--) {
        if (phase >= keys[i].frame) return keys[i].cell;
      }
    }
    if (phase < action.startup) return fighter.ground ? poses.windup : poses.jump;
    if (isActiveFrame(action, phase)) return 'counterTo' in action ? poses.guard : poses[action.pose];
    return fighter.ground ? poses.recover : poses.jump;
  }
  if (fighter.dash) return poses.run;
  if (!fighter.ground) return poses.jump;
  if (fighter.moving) return Math.floor(frame / 5) % 2 ? poses.run : poses.stride;
  return undefined;
}

function drawPose(ctx: CanvasRenderingContext2D, sheet: HTMLImageElement, pose: number, height: number, offset = 0) {
  const { cell, columns, footX, footY, referenceHeight } = motionGrid;
  const scale = height / referenceHeight;
  const sourceCell = sheet.naturalWidth / columns;
  ctx.drawImage(sheet, pose % columns * sourceCell, Math.floor(pose / columns) * sourceCell, sourceCell, sourceCell,
    offset - footX * scale, -footY * scale, cell * scale, cell * scale);
}

const poseContours = new WeakMap<HTMLImageElement, Map<number, Point[]>>();

function poseGroundOffset(sheet: HTMLImageElement, pose: number, angle: number, height: number) {
  const { cell, columns, footX, footY, referenceHeight } = motionGrid;
  let contours = poseContours.get(sheet);
  if (!contours) {
    contours = new Map();
    poseContours.set(sheet, contours);
  }
  let contour = contours.get(pose);
  if (!contour) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = cell;
    const ctx = canvas.getContext('2d')!;
    const sourceCell = sheet.naturalWidth / columns;
    ctx.drawImage(sheet, pose % columns * sourceCell, Math.floor(pose / columns) * sourceCell, sourceCell, sourceCell, 0, 0, cell, cell);
    const pixels = ctx.getImageData(0, 0, cell, cell).data;
    contour = [];
    // Keep the lowest opaque pixel in each column. All of these tilts are between flat and upright.
    for (let x = 0; x < cell; x++) {
      for (let y = cell - 1; y >= 0; y--) {
        if (pixels[(y * cell + x) * 4 + 3] < 128) continue;
        contour.push([x + .5 - footX, y + .5 - footY]);
        break;
      }
    }
    contours.set(pose, contour);
  }
  const sine = Math.sin(angle);
  const cosine = Math.cos(angle);
  const bottom = contour.reduce((max, [x, y]) => Math.max(max, sine * x + cosine * y), -Infinity);
  return contour.length ? bottom * height / referenceHeight : 0;
}

function recoveryTilt(fighter: FighterState, getUp: number, gap: number, height: number) {
  const flat = -Math.PI / 2;
  if (fighter.recovery?.phase === 'down' || (!fighter.hp && fighter.ground)) return flat;
  if (fighter.recovery?.phase === 'rise') return flat * (1 - getUp) ** 2;
  if (fighter.launched || fighter.recovery?.phase === 'fall' || !fighter.hp) {
    const airborne = -.52 - .38 * Math.min(1, Math.max(0, (fighter.vy + 8) / 20));
    const landing = fighter.vy <= 0 ? 0 : Math.max(0, 1 - Math.max(0, gap) / (height * .72));
    return airborne + (flat - airborne) * landing;
  }
  return 0;
}

type Trail = [Point, Point, Point];

const attackTrails: Partial<Record<string, Trail[]>> = {
  [gagaActionIds.jab]: [[[34, -49], [67, -57], [111, -61]]],
  [gagaActionIds.backhand]: [[[-43, -96], [32, -125], [98, -55]]],
  [gagaActionIds.poleSweep]: [[[24, -50], [147, -19], [266, -84]]],
  [gagaActionIds.poleBacksweep]: [[[25, -72], [162, -91], [265, -24]]],
  [gagaActionIds.lift]: [[[24, -48], [48, -73], [78, -127]]],
  [gagaActionIds.slide]: [[[-91, -12], [-46, -5], [28, -10]], [[-68, -21], [-38, -18], [-12, -18]]]
};
const rushTrails: Trail[] = [[[-89, -22], [-64, -28], [-37, -31]], [[-101, -10], [-72, -10], [-48, -13]]];

function polygon(ctx: CanvasRenderingContext2D, color: string, points: Point[]) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(...points[0]);
  for (const point of points.slice(1)) ctx.lineTo(...point);
  ctx.closePath();
  ctx.fill();
}

function drawSwing(ctx: CanvasRenderingContext2D, fighter: FighterState, hitbox: Box,
  pose: ActionDefinition['pose'], progress: number, color: string) {
  const tip = hitbox.x + hitbox.w - 6;
  const y = hitbox.y + hitbox.h * .58;
  ctx.save();
  ctx.translate(fighter.x, fighter.y);
  ctx.scale(fighter.facing, 1);
  ctx.globalAlpha = .91 - progress * .45;
  if (pose === 'strike') {
    polygon(ctx, color, [[tip - 91, y - 4], [tip - 4, y - 12], [tip, y - 6], [tip - 37, y]]);
    polygon(ctx, '#fff7da', [[tip - 55, y + 1], [tip, y - 5], [tip - 7, y + 3]]);
  } else {
    ctx.lineWidth = pose === 'finish' ? 9 : 6;
    ctx.lineCap = 'round';
    ctx.strokeStyle = color;
    ctx.beginPath();
    if (pose === 'rise') {
      ctx.moveTo(tip - 64, hitbox.y + hitbox.h);
      ctx.quadraticCurveTo(tip + 24, hitbox.y + 62, tip - 32, hitbox.y + 6);
    } else if (pose === 'air') {
      ctx.moveTo(tip - 65, y - 20);
      ctx.quadraticCurveTo(tip - 8, y - 12, tip, y + 22);
    } else {
      ctx.moveTo(tip - 58, y - 27);
      ctx.quadraticCurveTo(tip + 32, y - 6, tip - 34, y + 26);
    }
    ctx.stroke();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#fff6d6';
    ctx.stroke();
  }
  ctx.restore();
}

function drawEntity(ctx: CanvasRenderingContext2D, entity: EntityState, debug: boolean) {
  const { definition, owner, x, y, facing } = entity;
  const box = worldBox(definition.hitbox, x, y, facing);
  const centerX = box.x + box.w / 2;
  const centerY = box.y + box.h / 2;
  const color = definition.color ?? seatColors[owner];
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(centerX, centerY, box.w / 2, box.h / 2, 0, 0, Math.PI * 2);
  ctx.strokeStyle = '#181633';
  ctx.lineWidth = 5;
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = '#fff6d8';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = '#fff6d8';
  ctx.beginPath();
  ctx.ellipse(centerX - facing * box.w * .1, centerY, box.w * .18, box.h * .18, 0, 0, Math.PI * 2);
  ctx.fill();
  if (debug) {
    ctx.fillStyle = '#ff536844';
    ctx.strokeStyle = '#ff5a6e';
    ctx.lineWidth = 2;
    ctx.fillRect(box.x, box.y, box.w, box.h);
    ctx.strokeRect(box.x, box.y, box.w, box.h);
  }
  const label = 'P' + (owner + 1);
  ctx.font = '900 15px system-ui';
  ctx.textAlign = 'center';
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#181633';
  ctx.strokeText(label, centerX, box.y - 5);
  ctx.fillStyle = seatColors[owner];
  ctx.fillText(label, centerX, box.y - 5);
  ctx.restore();
}

function drawStageArt(ctx: CanvasRenderingContext2D, arena: ArenaDefinition, image: HTMLImageElement) {
  for (let band = 1; band < arena.artFrame.length; band++) {
    const start = arena.artFrame[band - 1];
    const end = arena.artFrame[band];
    ctx.drawImage(image, 0, start.sourceY * image.naturalHeight, image.naturalWidth,
      (end.sourceY - start.sourceY) * image.naturalHeight, 0, start.worldY, arena.width, end.worldY - start.worldY);
  }
}

export function paintArena(ctx: CanvasRenderingContext2D, arena: ArenaDefinition) {
  const { width, height, left, right, floor } = arena;
  const accent = arenaColors[arena.theme];
  const image = backgrounds[arena.theme];
  ctx.fillStyle = '#211f4b';
  ctx.fillRect(0, 0, width, height);
  if (!arena.artFrame.length) {
    const layers = layersFor(arena);
    if (arena.theme === 'broadcast') drawStageBackdrop(ctx, arena, arena.width / 2, true);
    else layers.backdrop(ctx, arena, arena.width / 2);
    layers.scenery(ctx, arena);
  } else if (image.naturalWidth) drawStageArt(ctx, arena, image);

  const shade = ctx.createLinearGradient(0, 0, 0, 190);
  shade.addColorStop(0, '#0c0d33ac');
  shade.addColorStop(1, '#0c0d3300');
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, width, 190);
  ctx.fillStyle = '#13172748';
  ctx.fillRect(0, floor, width, height - floor);
  ctx.fillStyle = accent + 'a5';
  ctx.fillRect(left, floor, right - left, 1);
  ctx.fillStyle = '#10142988';
  ctx.fillRect(0, floor, left, height - floor);
  ctx.fillRect(right, floor, width - right, height - floor);
  for (const x of [left, right]) {
    polygon(ctx, accent, [[x - 7, floor + 10], [x + 7, floor + 10], [x, floor + 18]]);
  }

  for (const p of arena.platforms) {
    if (p.prop) continue;
    const ledgeWidth = p.right - p.left;
    const tier = tierColors[p.tier - 1];
    ctx.fillStyle = tier + (image.naturalWidth ? '75' : 'ff');
    ctx.fillRect(p.left, p.y, ledgeWidth, image.naturalWidth ? 1 : 4);
    ctx.fillStyle = tier;
    ctx.fillRect(p.left, p.y, 11, 2);
    ctx.fillRect(p.right - 11, p.y, 11, 2);
  }
}

function paintRoute(ctx: CanvasRenderingContext2D, arena: ArenaDefinition, side: 0 | 1) {
  const route = arena.routes[side].map(id => arena.platforms.find(platform => platform.id === id)!);
  let support = { left: arena.left, right: arena.right, y: arena.floor };
  let from: Point = [arena.spawn[side], arena.floor];
  const color = seatColors[side];
  const outline = '#10152b';
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.arc(...from, 27, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = outline;
  ctx.lineWidth = 10;
  ctx.stroke();
  for (const [index, platform] of route.entries()) {
    const left = Math.max(support.left, platform.left);
    const right = Math.min(support.right, platform.right);
    const margin = Math.min(22, (right - left) / 2);
    const x = Math.min(right - margin, Math.max(left + margin, from[0]));
    const takeoff = index === 0 ? from[0] : x;
    ctx.beginPath();
    ctx.moveTo(...from);
    ctx.lineTo(takeoff, support.y);
    ctx.quadraticCurveTo((takeoff + x) / 2 + (side === 0 ? -72 : 72), platform.y - 56, x, platform.y);
    ctx.lineWidth = 24;
    ctx.strokeStyle = outline;
    ctx.stroke();
    ctx.lineWidth = 13;
    ctx.strokeStyle = color;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x, platform.y, 21, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = outline;
    ctx.lineWidth = 8;
    ctx.stroke();
    support = platform;
    from = [x, platform.y];
  }
  ctx.restore();
}

export function previewArena(canvas: HTMLCanvasElement, arena: ArenaDefinition, route = false, frame = 0) {
  const ctx = canvas.getContext('2d')!;
  const variant = arena.id + (route ? '-route' : '');
  canvas.dataset.variant = variant;
  const draw = () => {
    if (canvas.dataset.variant !== variant) return;
    ctx.setTransform(canvas.width / arena.width, 0, 0, canvas.height / arena.height, 0, 0);
    paintArena(ctx, arena);
    if (!arena.artFrame.length) layersFor(arena).mechanism(ctx, arena, 0);
    if (route) {
      ctx.fillStyle = '#10152b2b';
      ctx.fillRect(0, 0, arena.width, arena.height);
      for (const side of [0, 1] as const) paintRoute(ctx, arena, side);
    }
    ctx.resetTransform();
  };
  draw();
  for (const image of [backgrounds[arena.theme], ...sheetsFor(arena)]) {
    if (!image.complete) image.addEventListener('load', draw, { once: true });
  }
}

interface Effect {
  event: CombatEvent;
  start: number;
  life: number;
  cue?: GagaContact;
  poleSwing?: PoleSwing;
  swordSwing?: boolean;
  gagaReceives?: boolean;
  bananaImpact?: boolean;
  gagaImpact?: boolean;
  knockdownDust?: boolean;
  shake?: number;
}

const expiresAfter: Partial<Record<CombatEvent['kind'], number>> = {
  hit: 12, break: 17, block: 10, parry: 15, ultimate: 13,
  dash: 12, land: 12, drop: 12, 'air-jump': 12, knockdown: 12
};

export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private background = document.createElement('canvas');
  private sceneryTop = 0;
  private effects: Effect[] = [];
  private camera: CameraView | null = null;
  private dive: { summon: Summon; length: number } | null = null;
  private gagaWalks = [new GagaWalk(), new GagaWalk()];
  private standLinger: [ { actionId: string; lastFrame: number; age: number } | null,
    { actionId: string; lastFrame: number; age: number } | null ] = [null, null];
  private previousArenaFrame?: number;
  private previousRound?: number;

  constructor(canvas: HTMLCanvasElement, arena: ArenaDefinition) {
    this.ctx = canvas.getContext('2d', { alpha: false })!;
    this.load(arena);
  }

  load(arena: ArenaDefinition) {
    const layer = this.background;
    if (!arena.artFrame.length) {
      // Keep the detailed foreground at world resolution. Background and mechanisms have their own transforms.
      layer.width = arena.width;
      layer.height = 1024;
      this.sceneryTop = arena.floor - 950;
      layer.dataset.variant = arena.id;
      const draw = () => {
        if (layer.dataset.variant !== arena.id) return;
        const ctx = layer.getContext('2d')!;
        ctx.resetTransform();
        ctx.clearRect(0, 0, layer.width, layer.height);
        ctx.translate(0, -this.sceneryTop);
        layersFor(arena).scenery(ctx, arena);
      };
      draw();
      for (const prop of sheetsFor(arena)) {
        if (!prop.complete) prop.addEventListener('load', draw, { once: true });
      }
    } else {
      layer.width = Math.min(2560, arena.width);
      layer.height = Math.round(layer.width * arena.height / arena.width);
      previewArena(layer, arena);
    }
    this.effects = [];
    this.camera = null;
    this.dive = null;
    this.gagaWalks.forEach(walk => walk.reset());
    this.previousArenaFrame = undefined;
    this.previousRound = undefined;
  }

  add(events: CombatEvent[], frame: number, fighters?: MatchConfig['fighters']) {
    for (const event of events) {
      const { kind, actionId, source } = event;
      if (kind === 'ultimate' && (actionId === bananaActionIds.wave || actionId === gagaActionIds.dijiang)) continue;
      const actor = fighters?.[source].id;
      const target = fighters?.[source === 0 ? 1 : 0].id;
      const jet = isTearJet(actionId);
      const wave = actionId === bananaActionIds.wave;
      const poleSwing = poleSwingFor(event);
      const swordSwing = kind === 'swing' && actionId === gagaActionIds.swordSlash;
      const cue = fighters && gagaContact(event, fighters);
      const gagaImpact = cue === 'guard' || (actor === 'gaga' && Boolean(gagaStrike(event)));
      const gagaReceives = kind === 'hit' && target === 'gaga';
      const wet = jet || wave || actionId === bananaActionIds.tear;
      const bananaImpact = kind === 'land'
        ? actor === 'banana' && (event.reaction === 'air' || actionId === bananaActionIds.joAirDive)
        : kind === 'hit' && Boolean(event.amount) && !wet && !gagaImpact &&
          (actor === 'banana' || target === 'banana');
      const knockdownDust = kind === 'knockdown' && (actor === 'gaga' || actor === 'banana');
      const bananaLife = bananaEffectLife(event);
      let life = kind === 'hit' && event.heavy ? 16 : expiresAfter[kind];
      let shake: number | undefined;

      if (kind === 'tear-splash') {
        life = bananaLife;
        shake = 5;
      } else if (isTurretEffect(event)) {
        life = turretEffectLife[event.kind];
        if (event.kind === 'grenade-impact') shake = 9;
        if (event.kind === 'turret-burst' || event.kind === 'turret-ready') shake = 6;
      } else if (poleSwing) {
        life = poleDustLife;
      } else if (swordSwing) {
        life = 16;
        shake = 8;
      } else if (kind === 'pole-impact') {
        life = poleImpactLife;
        shake = 8.5;
      } else if (kind === 'summon-impact') {
        life = dijiangImpactLife;
      } else if (kind === 'summon-catch') {
        life = 14;
      } else if (kind === 'kq-plant') {
        life = 20;
        shake = 6;
      } else if (kind === 'kq-lock') {
        life = 22;
        shake = 8;
      } else if (kind === 'kq-detonate') {
        life = 29;
        shake = 18;
      } else if (kind === 'crystal-plant') {
        life = 16;
      } else if (kind === 'crystal-shatter') {
        life = 24;
        shake = 13;
      } else if (kind === 'crystal-spire') {
        life = 26;
        shake = 11;
      } else if (kind === 'xiranite-burst') {
        life = 20;
        shake = 9;
      } else if (kind === 'pylon-plant') {
        life = 18;
        shake = 7;
      } else if (kind === 'pylon-expire') {
        life = 14;
      } else if (kind === 'time-stop-start') {
        shake = 14;
      } else if (kind === 'time-stop-flick' || kind === 'time-stop-hit') {
        life = event.heavy ? 18 : 11;
        shake = event.heavy ? 16 : 8;
      } else if (kind === 'time-stop-release') {
        life = 32;
        shake = 24;
      } else if (kind === 'jo-shatter') {
        life = 28;
        shake = 22;
      } else if (knockdownDust) {
        life = 22;
      } else if (kind === 'land' && actionId === gagaActionIds.airDive) {
        life = 22;
        shake = 10;
      } else if (bananaImpact || gagaImpact) {
        life = kind === 'land' ? 22 : 19;
      } else if (bananaLife) {
        life = bananaLife;
      } else if (cue || gagaReceives) {
        life = cue === 'light' || event.impact === 'light' ? 14 : event.impact === 'heavy' ? 22 : 23;
      } else if (kind === 'dash' && event.heavy) {
        life = 24;
      }

      if (kind === 'swing' && (jet || wave)) {
        shake = wave ? 11 : actionId === bananaActionIds.uppercut ? 8 : 5.5;
        life = Math.ceil(shake);
      } else if (kind === 'swing' && actionId === bananaActionIds.joPounce) {
        shake = 7;
      } else if (kind === 'land' && actionId === bananaActionIds.joAirDive) {
        shake = 10;
      } else if ((kind === 'hit' || kind === 'break') && (jet || wave || cue || gagaReceives || bananaLife || gagaImpact || bananaImpact)) {
        const strength = jet ? (actionId === bananaActionIds.uppercut ? 13 : 8)
          : event.impact === 'heavy' ? 10 : event.impact === 'light' ? 2.5 : 4;
        shake = Math.max(wave ? 16 : 0, event.feedback?.shake ?? strength);
      }
      if (life) this.effects.push({ event, life, start: frame, cue, poleSwing, swordSwing, gagaReceives, bananaImpact, gagaImpact, knockdownDust, shake });
    }
  }

  draw(config: MatchConfig, state: MatchState, debug: boolean, elapsed: number, shakeEnabled: boolean, focus = false,
    reducedMotion = false, opening = 0, presentationFraction = 0, shot?: FeatureShot) {
    const ctx = this.ctx;
    const { width, height } = ctx.canvas;
    // A character shot covers the frozen match, then lets it fade back in under its last frames.
    if (shot && !shotFading(shot)) {
      shot.paint(ctx);
      return;
    }
    // A seek can jump across camera framing or a cinematic: redraw from a clean frame.
    ctx.resetTransform();
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, width, height);
    const arenaFrame = state.arenaFrame;
    if (this.previousRound !== state.round || arenaFrame < (this.previousArenaFrame ?? 0)) {
      this.camera = null;
      this.dive = null;
      this.gagaWalks.forEach(walk => walk.reset());
    }
    const motionFrames = Math.max(0, arenaFrame - (this.previousArenaFrame ?? arenaFrame));
    this.previousRound = state.round;
    this.previousArenaFrame = arenaFrame;
    this.effects = this.effects.filter(({ start, life }) => arenaFrame >= start && arenaFrame - start < life);
    if (state.cutIn) {
      const cutInAction = actionFor(config, state, state.cutIn.source);
      if (cutInAction?.id === bananaActionIds.joAwaken) {
        drawBananaJoCutIn(ctx, state.cutIn, reducedMotion);
      } else {
        drawBananaWaveCutIn(ctx, state.cutIn, reducedMotion);
      }
      return;
    }
    const summon = state.summon;
    if (summon?.phase === 'cut-in') {
      drawSummonCutIn(ctx, summon.frame, summon.facing, reducedMotion);
      return;
    }

    const [a, b] = state.fighters;
    const heights = ([0, 1] as const).map(seat =>
      (artSizes.get(config.fighters[seat].id) ?? 137) + (frogPowered(state.fighters[seat], state) ? 52 : 0));
    const jetTips = ([0, 1] as const).flatMap(seat => {
      const fighter = state.fighters[seat];
      const action = actionFor(config, state, seat);
      if (!isAttack(action) || action.id !== bananaActionIds.pressure || !fighter.attack ||
        fighter.attack.frame >= action.startup + action.active + 7) return [];
      const box = worldBox(action.hitbox, fighter.x, fighter.y, fighter.facing);
      const tip = fighter.facing === 1 ? box.x + box.w : box.x;
      return [{ x: Math.max(0, Math.min(config.arena.width, tip)), y: Math.max(0, box.y) }];
    });
    const frozen = state.phase === 'fight' && (state.freeze > 0 || cinematicOwner(state) !== undefined);
    const framing = frameCamera(config.arena, { width, height },
      [{ x: a.x, y: a.y, height: heights[0] }, { x: b.x, y: b.y, height: heights[1] }],
      this.camera, frozen ? 0 : elapsed, focus, opening, summon, jetTips);
    const openingIdx = reducedMotion ? -1 : openingFrame(state, config.fighters);
    const shown = ([0, 1] as const).map(seat => {
      const entrance = entranceFor(config.fighters[seat]);
      return entrance && openingIdx >= 0 && openingIdx < entrance.frames ? entrance : undefined;
    });
    const close = shown.find(Boolean)?.close(openingIdx);
    const ts = state.timeStop;
    const sight = close ? frameEntrance(config.arena, { width, height }, framing,
      [{ x: a.x, y: a.y, height: heights[0] }, { x: b.x, y: b.y, height: heights[1] }], close)
      : ts && !reducedMotion ? frameTimeStopCamera(config.arena, { width, height }, framing,
        { x: state.fighters[ts.source].x, y: state.fighters[ts.source].y, height: heights[ts.source] },
        { x: state.fighters[1 - ts.source].x, y: state.fighters[1 - ts.source].y, height: heights[1 - ts.source] },
        ts)
      : framing;
    this.camera = ts ? framing : sight;
    const standing = (seat: 0 | 1) =>
      state.fighters[seat].x + (shown[seat]?.shift(openingIdx) ?? 0) * state.fighters[seat].facing;
    const impact = this.effects.find(effect => effect.event.kind === 'summon-impact');
    const camera = impact && shakeEnabled && !reducedMotion
      ? frameDijiangImpact(config.arena, { width, height }, sight, impact.event, arenaFrame - impact.start) : sight;
    const { x, y, zoom } = camera;
    const [shakeX, shakeY] = shakeEnabled && !reducedMotion ? this.shakeOffset(arenaFrame) : [0, 0];
    const dx = Math.min(x * zoom, Math.max(width - (config.arena.width - x) * zoom, shakeX));
    const dy = Math.min(y * zoom, Math.max(height - (config.arena.height - y) * zoom, shakeY));
    ctx.setTransform(zoom, 0, 0, zoom, -x * zoom + dx, -y * zoom + dy);
    const worldGray = ts ? 'grayscale(' + Math.round(Math.min(1, ts.frame / 28) * 100) + '%) contrast(1.16)' : 'none';
    ctx.filter = worldGray;
    const layered = !config.arena.artFrame.length;
    if (layered) {
      const layers = layersFor(config.arena);
      layers.backdrop(ctx, config.arena, x + width / (2 * zoom));
      ctx.drawImage(this.background, 0, this.sceneryTop);
      layers.mechanism(ctx, config.arena, config.arena.theme === 'ring' && reducedMotion ? 0 : arenaFrame, state, config);
    } else {
      ctx.drawImage(this.background, 0, 0, config.arena.width, config.arena.height);
    }
    ctx.fillStyle = layered ? '#10153312' : '#10153324';
    ctx.fillRect(x - dx / zoom, y - dy / zoom, width / zoom, height / zoom);
    const waveLive = state.projectiles.some(p => p.actionId === bananaActionIds.wave) ||
      state.fighters.some((fighter, seat) => {
        const move = actionFor(config, state, seat as 0 | 1);
        return isAttack(move) && move.id === bananaActionIds.wave && Boolean(fighter.attack);
      });
    if (waveLive) {
      ctx.save();
      ctx.resetTransform();
      ctx.fillStyle = reducedMotion ? '#0a1f3f44' : '#081b3a6e';
      ctx.fillRect(0, 0, width, height);
      ctx.restore();
    }
    const decks = config.arena.platforms.map(p => platformAt(p, arenaFrame));
    if (summon?.phase === 'fall') {
      drawDijiangPressure(ctx, summon.x, summon.y, summon.frame / summonFallFrames, reducedMotion);
    } else if (impact && arenaFrame - impact.start < 24) {
      const { event, start } = impact;
      drawDijiangPressure(ctx, event.x, event.y, 1, reducedMotion, 1 - (arenaFrame - start) / 24);
    }
    for (const { event, start } of this.effects) {
      if (event.kind !== 'pole-impact' && event.kind !== 'summon-impact') continue;
      ctx.save();
      ctx.translate(event.x, event.y);
      const age = arenaFrame - start;
      if (event.kind === 'pole-impact' && event.surface) {
        drawPoleGroundMark(ctx, age, event.surface.left - event.x, event.surface.right - event.x);
      } else if (event.kind === 'summon-impact') {
        drawDijiangGround(ctx, age, config.arena.left - event.x, config.arena.right - event.x);
      }
      ctx.restore();
    }
    if (debug) {
      ctx.strokeStyle = '#fff4d9';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 4]);
      for (const p of decks) {
        ctx.beginPath();
        ctx.moveTo(p.left, p.y);
        ctx.lineTo(p.right, p.y);
        ctx.stroke();
      }
      ctx.setLineDash([]);
    }

    if (summon && this.dive?.summon !== summon) {
      this.dive = { summon, length: frameDijiangLength({ width, height }, framing) };
    } else if (!summon) {
      this.dive = null;
    }
    const carrying = summon?.phase === 'fall' && summon.carry;
    if (carrying && summon && this.dive) drawDijiang(ctx, summon, this.dive.length, debug, reducedMotion);

    const swingTrails: { paths: Trail[]; x: number; y: number; facing: number; alpha: number; wide: boolean; color?: string }[] = [];
    const poles: { pose: PolePose; x: number; y: number; facing: number; action: ActionDefinition; frame: number }[] = [];
    for (const pylon of state.powerPylons ?? []) {
      if (!pylon) continue;
      const owner = state.fighters[pylon.owner];
      const casterHolding = Boolean(owner.attack?.id === gagaActionIds.overclock && owner.attack.frame < 16);
      drawPowerPylonField(ctx, pylon, state.frame, reducedMotion, casterHolding);
    }
    for (const turret of Object.values(state.turrets)) {
      if (!turret) continue;
      drawTurret(ctx, turret);
      const boostPylon = turret.age >= turretBuildTicks ? turretBoosted(state, turret) : undefined;
      if (boostPylon) drawTurretSpeedBoost(ctx, boostPylon, turret, state.frame);
      if (turret.age >= turretBuildTicks) {
        const y = turret.y - (turret.kind === 'bolt' ? 142 : 136);
        for (let i = 0; i < 2; i++) {
          ctx.fillStyle = '#111533';
          ctx.fillRect(turret.x - 15 + i * 16, y, 13, 5);
          if (i < turret.hp) {
            ctx.fillStyle = seatColors[turret.owner];
            ctx.fillRect(turret.x - 14 + i * 16, y + 1, 11, 3);
          }
        }
      }
    }
    drawWhaleEntities(ctx, state, config, 'back', reducedMotion ? 0 : presentationFraction);
    drawFrogEffects(ctx, state, config, 'back');
    const riseFrames = recoveryDuration(config.rules.riseFrames, DEFAULT_RISE_FRAMES);
    const drawOrder: readonly (0 | 1)[] = ts ? [ts.source === 0 ? 1 : 0, ts.source]
      : a.attack && b.hitstun ? [1, 0] : [0, 1];
    for (const seat of drawOrder) {
      const f = state.fighters[seat];
      ctx.filter = ts && seat !== ts.source ? worldGray : 'none';
      const def = config.fighters[seat];
      const sprite = sprites[def.id];
      const sheet = motionArt[def.id];
      const color = seatColors[seat];
      const move = actionFor(config, state, seat);
      const action = isAttack(move) ? move : undefined;
      const phase = f.attack?.frame ?? 0;
      const active = move && isActiveFrame(move, phase);
      const strike = active ? action : undefined;
      const hitboxes = strike && (state.phase === 'fight' || state.freeze > 0) ? hitRegionsFor(strike, phase) : [];
      const stance = active && !action && f.ground;
      const height = heights[seat];
      const getUp = f.recovery?.phase === 'rise' ? (riseFrames - f.recovery.remaining) / Math.max(1, riseFrames - 1) : 0;
      const pose = poseFor(f, move, arenaFrame, getUp);
      const isGaga = def.id === 'gaga';
      const isBanana = def.id === 'banana';
      const sharedArt = def.id !== 'whale' && def.id !== 'frog';
      const authoredPose = Boolean(move?.animation?.length && sheet?.naturalWidth && pose !== undefined);
      const entrance = shown[seat];
      const attackPose = !authoredPose && isGaga && move && f.hp && !f.recovery && !f.hitstun
        ? gagaActionPose(move, phase, Boolean(f.ground)) : undefined;
      const gagaPose = entrance ? entrance.pose(openingIdx) ?? attackPose : attackPose;
      const reaction = isGaga && f.hp && !move && !f.walk && !f.dash && !f.guarding ? f.reaction : undefined;
      const hurtPose = reaction ? gagaReactionPose(reaction, f.vy) : undefined;
      const canWalk = isGaga && f.ground && f.hp && !move && !f.guarding && !f.dash &&
        !f.hitstun && !f.blockstun && !f.guardBreak && !f.recovery;
      const walk = this.gagaWalks[seat];
      if (!canWalk) walk.reset();
      const gait = entrance && entrance.travelled(openingIdx) > 0 && openingIdx < 40
        ? { direction: 'forward' as const, distance: entrance.travelled(openingIdx) } : f.walk;
      const statePose = isGaga && !hurtPose && !gagaPose && f.hp && !f.hitstun && !f.guardBreak && !f.recovery
        ? gagaStatePose(f, canWalk ? gait?.distance : undefined) : undefined;
      const drawnPose = hurtPose ?? gagaPose ?? statePose;
      const walkPose = canWalk && !drawnPose ? walk.sample(gait, motionFrames) : undefined;
      const fallingPose = knockdownPose(def.id, f, getUp);
      const barrageEnd = ts ? ts.flickAt + Math.max(20, ts.releaseAt - ts.flickAt - 51) : 0;
      const finisherAt = ts ? ts.releaseAt - 26 : 0;
      const tsStruck = Boolean(ts && seat !== ts.source && ts.flicked && !reducedMotion &&
        ((ts.frame < barrageEnd && (ts.frame - ts.flickAt) % 7 < 3) ||
         (ts.frame >= finisherAt && ts.frame < finisherAt + 10)));
      const tsJoltX = tsStruck ? Math.sin(ts!.frame * 3.1) * (ts!.frame >= finisherAt ? 7 : 3.5) : 0;
      const at = standing(seat) + tsJoltX;
      const ground = decks.reduce((y, platform) =>
        at >= platform.left && at <= platform.right && platform.y >= f.y && platform.id !== f.ignorePlatform
          ? Math.min(y, platform.y) : y,
        config.arena.floor);
      const tilt = recoveryTilt(f, getUp, ground - f.y, height);
      const recline = -Math.sin(tilt);
      ctx.fillStyle = '#08091cc9';
      ctx.beginPath();
      ctx.ellipse(at, ground + 3, f.ground ? 39 + recline * 22 : 23, f.ground ? 8 : 5, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.save();
      ctx.translate(at, f.y);
      ctx.scale(fallingPose?.facing ?? (hurtPose && reaction ? reaction.facing : f.facing), 1);
      const flash = this.hitFlash(seat, arenaFrame, f.hitstun > 0 && state.freeze > 0);
      if (def.id === 'whale') {
        if (flash > 0) ctx.filter = `brightness(${1 + flash * .36})`;
        drawWhaleActor(ctx, f, state, seat, move);
      } else if (def.id === 'frog') {
        drawFrogActor(ctx, f, state, move, seat);
      } else {
        const spriteWidth = sprite?.naturalHeight ? height * sprite.naturalWidth / sprite.naturalHeight : 0;
        const drawFromSheet = !isGaga && !isBanana && Boolean(sheet?.naturalWidth) && pose !== undefined;
        if (!fallingPose && !drawnPose?.image && !authoredPose && !isBanana && tilt && pose !== undefined) {
          const bottom = drawFromSheet
            ? poseGroundOffset(sheet, pose, tilt, height)
            : spriteWidth * .51 * recline;
          // The standing hurt art keeps limbs spread. Settle its silhouette toward the playing surface.
          const postureHeight = 1 - .44 * recline ** 4;
          ctx.translate(height * .43 * recline, -bottom * postureHeight);
          ctx.scale(1, postureHeight);
          ctx.rotate(tilt);
        } else if (isGaga && !fallingPose) {
          let scaleY = drawnPose || walkPose ? 1 : 1 + Math.sin(arenaFrame * .16) * .0084;
          if (f.hitstun && !hurtPose) {
            const reeling = Math.abs(f.push) >= 15;
            ctx.rotate(reeling ? -.38 : -.20);
            scaleY = reeling ? .88 : .94;
          } else if (f.dash && !drawnPose) {
            ctx.rotate(.20);
            scaleY = .87;
          } else if (f.guarding && !drawnPose) {
            scaleY = .83;
          } else if (strike && !gagaPose) {
            ctx.rotate(strike.pose === 'rise' ? -.14 : .12);
          } else if (!f.ground && !drawnPose) {
            ctx.rotate(f.vy < 0 ? -.085 : .085);
          }
          ctx.scale(2 - scaleY, scaleY);
          if (!hurtPose && gagaPose?.rotation) ctx.rotate(gagaPose.rotation);
        }
        if (f.dash && drawFromSheet && !reducedMotion) {
          ctx.globalAlpha = .18;
          drawPose(ctx, sheet, pose, height, -48);
          ctx.globalAlpha = .34;
          drawPose(ctx, sheet, pose, height, -23);
          ctx.globalAlpha = 1;
        }
        if (!fallingPose && f.recovery?.phase === 'rise') ctx.globalAlpha = .83;
        ctx.shadowColor = color + 'ae';
        ctx.shadowBlur = 9;
        if (flash > 0) ctx.filter = (ts && seat !== ts.source ? worldGray + ' ' : '') + `brightness(${1 + flash * .36})`;
        else if (tsStruck) ctx.filter = worldGray + ' brightness(1.48)';
        else if (hurtPose && reaction && reaction.elapsed < 2) ctx.filter = 'brightness(1.45) saturate(.7)';
        if (fallingPose) {
          drawKnockdownPose(ctx, fallingPose, height, reducedMotion);
        } else if (authoredPose && pose !== undefined) {
          drawPose(ctx, sheet, pose, height);
        } else if (isBanana) {
          const readyTotal = openingTicks(config.fighters);
          const stageCue = state.phase === 'ready'
            ? { kind: 'entrance' as const, frame: Math.max(0, readyTotal - state.phaseTicks) }
            : state.phase === 'round-over' && state.result?.winner === seat
              ? { kind: 'victory' as const, frame: Math.max(0, 192 - state.phaseTicks) }
              : undefined;
          let lingerCue: StandLinger | undefined;
          if (state.phase === 'fight' && f.joAwakened) {
            const isKq = action?.id === bananaActionIds.kqBomb || action?.id === bananaActionIds.kqDetonate;
            const prev = this.standLinger[seat];
            if (isKq && action) {
              this.standLinger[seat] = { actionId: action.id, lastFrame: state.frame, age: 0 };
            } else if (!action && prev && state.frame >= prev.lastFrame) {
              prev.age += state.frame - prev.lastFrame;
              prev.lastFrame = state.frame;
              if (prev.age < 14) lingerCue = { actionId: prev.actionId, age: prev.age };
              else this.standLinger[seat] = null;
            } else {
              this.standLinger[seat] = null;
            }
          } else {
            this.standLinger[seat] = null;
          }
          drawBanana(ctx, f, action, state.frame, reducedMotion, stageCue, lingerCue);
        } else if (drawnPose?.image) {
          const { image, region, scaleX, scaleY } = drawnPose;
          ctx.drawImage(image, region.x, region.y, region.width, region.height,
            -region.footX * scaleX, -region.footY * scaleY, region.width * scaleX, region.height * scaleY);
        } else if (isGaga && walkPose && sprite?.naturalWidth) {
          drawGagaWalk(ctx, sprite, height, walkPose);
        } else if (drawFromSheet) {
          drawPose(ctx, sheet, pose, height, strike && hitboxes.length && !strike.animation?.length ? 8 : 0);
        } else if (spriteWidth) {
          const breathe = pose === undefined ? Math.sin(arenaFrame * .10) * 1.4 : 0;
          const lean = isGaga && strike ? 9 : 0;
          const sink = isGaga && f.ground ? 2 : 0;
          ctx.drawImage(sprite, -spriteWidth * .51 + lean, -height - breathe + sink, spriteWidth, height + breathe);
        }
        ctx.filter = 'none';
        ctx.shadowBlur = 0;
        ctx.filter = ts && seat !== ts.source ? worldGray : 'none';
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;
        if (gagaPose?.heldCrate) {
          drawEngineeringCrate(ctx, gagaPose.heldCrate.kind, gagaPose.heldCrate.x, gagaPose.heldCrate.y, -.16);
        }
        if (gagaPose?.pole && action) {
          poles.push({ pose: gagaPose.pole, x: f.x, y: f.y, facing: f.facing, action, frame: phase });
        }
        if (action?.id === gagaActionIds.swordSlash && phase < action.startup && !reducedMotion) {
          drawSwordChargeGlint(ctx, phase, action.startup);
        }
        const trails = gagaPose?.rushing ? rushTrails : strike && gagaPose && attackTrails[strike.id];
        if (trails && action) {
          const sustained = gagaPose?.rushing || action.id === gagaActionIds.slide;
          const alpha = sustained ? .54 : .76 * (1 - (phase - action.startup) / action.active);
          const swordTrail = action.id === gagaActionIds.swordSlash || action.id === gagaActionIds.swordRise;
          swingTrails.push({ paths: trails, x: f.x, y: f.y, facing: f.facing,
            alpha, wide: Boolean(gagaPose?.pole) || action.impact === 'heavy' || swordTrail,
            ...(swordTrail ? { color: '#fbbf24' } : {}) });
        }
        if ((f.guarding && !statePose) || (stance && move?.id !== gagaActionIds.xiraniteGuard)) {
          ctx.strokeStyle = stance ? '#ffde85' : f.blockstun ? '#81e7ff' : '#afdfff93';
          ctx.lineWidth = f.blockstun ? 5 : 3;
          ctx.beginPath();
          ctx.ellipse(15, -60, 48, 56, 0, -1.33, 1.32);
          ctx.stroke();
        }
      }
      ctx.restore();

      if (strike && sharedArt && !isBanana && !gagaPose) {
        for (const hitbox of hitboxes) {
          drawSwing(ctx, f, hitbox, strike.pose, (phase - strike.startup) / strike.active, color);
        }
      }

      if (debug) {
        ctx.lineWidth = 2;
        if (f.hp && !f.recovery) {
          ctx.fillStyle = '#27d7ee24';
          ctx.strokeStyle = '#4ce2e8';
          for (const region of hurtRegionsFor(def, move, phase)) {
            const hurt = worldBox(region, f.x, f.y, f.facing);
            ctx.fillRect(hurt.x, hurt.y, hurt.w, hurt.h);
            ctx.strokeRect(hurt.x, hurt.y, hurt.w, hurt.h);
          }
        }
        ctx.strokeStyle = '#ffc263';
        ctx.strokeRect(f.x - def.bodyWidth / 2, f.y - 82, def.bodyWidth, 82);
        ctx.fillStyle = '#ff536844';
        ctx.strokeStyle = '#ff5a6e';
        for (const region of hitboxes) {
          const hit = worldBox(region, f.x, f.y, f.facing);
          ctx.fillRect(hit.x, hit.y, hit.w, hit.h);
          ctx.strokeRect(hit.x, hit.y, hit.w, hit.h);
        }
      }
    }

    for (const pole of poles) {
      ctx.save();
      ctx.translate(pole.x, pole.y);
      ctx.scale(pole.facing, 1);
      if (pole.action.id === gagaActionIds.poleLaunch) drawGagaLaunchTrail(ctx, pole.action, pole.frame);
      drawGagaPole(ctx, pole.pose);
      ctx.restore();
    }
    for (const seat of [0, 1] as const) {
      const f = state.fighters[seat];
      ctx.filter = ts && seat !== ts.source ? worldGray : 'none';
      const act = actionFor(config, state, seat);
      if (isAttack(act) && act.standAttack === 'ora') {
        drawBananaWorldStand(ctx, f, act, reducedMotion);
      }
      if (ts && ts.source === seat) {
        drawBananaTheWorldStrike(ctx, f, state.fighters[1 - seat], config.arena, ts, reducedMotion);
      }
      if (f.bombMark && f.hp > 0) {
        drawKillerQueenMark(ctx, f, state.frame);
      }
      if (f.crystalMark && f.hp > 0) {
        drawOriginiumCrystalMark(ctx, f, state.frame);
      }
      if (isAttack(act) && act.id === gagaActionIds.swordRise && f.attack && f.attack.frame < act.startup && !reducedMotion) {
        const opponent = state.fighters[1 - seat];
        const marked = opponent.crystalMark?.source === seat;
        const beamX = marked
          ? opponent.x
          : Math.max(config.arena.left, Math.min(config.arena.right, f.x + f.facing * 142));
        const beamY = marked ? opponent.y : f.y;
        ctx.save();
        ctx.translate(beamX, beamY);
        drawCrystalLockOnBeam(ctx, f.attack.frame, act.startup);
        ctx.restore();
      }
    }
    for (const projectile of state.projectiles) {
      const data = config.fighters[projectile.source].actions.filter(isAttack).find(move => move.id === projectile.actionId)?.projectile;
      if (!data) continue;
      if (data.kind === 'crate' && data.turret) {
        const pitch = Math.atan2(projectile.vy, Math.abs(projectile.vx)) * .20 * projectile.facing;
        drawEngineeringCrate(ctx, data.turret, projectile.x, projectile.y, pitch);
      } else if (data.kind === 'bolt') {
        drawTurretBolt(ctx, projectile);
      } else if (data.kind === 'spark') {
        drawSparkProjectile(ctx, projectile);
      } else if (data.kind === 'sword-wave') {
        drawSwordWaveProjectile(ctx, projectile, data, reducedMotion);
      } else if (data.kind === 'grenade') {
        drawGrenade(ctx, projectile);
      } else if (data.kind === 'tear') {
        drawBananaProjectile(ctx, projectile, data);
      } else if (data.kind === 'kq-orb') {
        drawKillerQueenOrb(ctx, projectile);
      } else if (data.kind === 'sheer-heart') {
        drawSheerHeartAttack(ctx, projectile, state.frame);
      } else if (data.kind === 'wave') {
        drawBananaWave(ctx, projectile, data, reducedMotion);
      } else {
        drawThrownPole(ctx, projectile, data);
      }
      if (debug) {
        const halfWidth = data.halfWidth ?? data.radius;
        ctx.strokeStyle = '#ff5a6e';
        ctx.lineWidth = 2;
        ctx.strokeRect(projectile.x - halfWidth, projectile.y - data.radius, halfWidth * 2, data.radius * 2);
      }
    }
    for (const entity of state.entities ?? []) {
      if (!entity.definition.behavior) drawEntity(ctx, entity, debug);
    }
    drawWhaleEntities(ctx, state, config, 'front', reducedMotion ? 0 : presentationFraction);
    drawFrogEffects(ctx, state, config, 'front');
    for (const trail of swingTrails) {
      ctx.save();
      ctx.translate(trail.x, trail.y);
      ctx.scale(trail.facing, 1);
      ctx.globalAlpha = trail.alpha;
      ctx.strokeStyle = trail.color ?? '#fff1c0';
      ctx.lineWidth = trail.wide ? 7 : 4;
      ctx.lineCap = 'round';
      for (const [from, control, to] of trail.paths) {
        ctx.beginPath();
        ctx.moveTo(...from);
        ctx.quadraticCurveTo(...control, ...to);
        ctx.stroke();
      }
      ctx.restore();
    }
    if (!carrying && summon && this.dive) {
      drawDijiang(ctx, summon, this.dive.length, debug, reducedMotion);
    }
    if (ts) {
      ctx.filter = 'none';
      const caster = state.fighters[ts.source];
      const opp = state.fighters[1 - ts.source];
      drawTimeStopOverlay(ctx, ts, caster.x, caster.y, opp.x, opp.y, x, y, zoom, dx, dy, reducedMotion);
    }
    ctx.filter = 'none';
    for (const seat of [0, 1] as const) shown[seat]?.effect?.(ctx, openingIdx, state.fighters[seat]);
    this.drawEffects(arenaFrame, Boolean(config.training), reducedMotion);
    ctx.resetTransform();
    for (const seat of [0, 1] as const) {
      const f = state.fighters[seat];
      const def = config.fighters[seat];
      if (!f.hp) continue;
      const center = (standing(seat) - x) * zoom + dx;
      const poseHeight = f.recovery?.phase === 'down' ? heights[seat] * .60 : heights[seat];
      const markerY = (f.y - poseHeight - y) * zoom + dy - 25;
      const label = 'P' + (seat + 1) + (f.recovery ? ' ' + recoveryLabels[f.recovery.phase] : '');
      const labelWidth = f.recovery ? 70 : 34;
      ctx.fillStyle = '#111333e8';
      ctx.fillRect(center - labelWidth / 2, markerY, labelWidth, 21);
      ctx.textAlign = 'center';
      ctx.font = '900 15px system-ui';
      ctx.fillStyle = seatColors[seat];
      ctx.fillText(label, center, markerY + 15);
      if (!f.ground && !f.launched && !f.recovery && (def.airJump || def.airDash)) {
        const dot = center + 26;
        polygon(ctx, f.airActionUsed ? '#535c83' : seatColors[seat],
          [[dot, markerY + 4], [dot + 6, markerY + 10], [dot, markerY + 16], [dot - 6, markerY + 10]]);
      }
    }
    if (config.arena.theme !== 'ring' && (debug || Math.abs(a.x - b.x) > width / zoom * .7)) {
      this.drawPositionStrip(config.arena, [a.x, b.x], camera);
    }
    const shatter = this.effects.find(effect => effect.event.kind === 'jo-shatter' && arenaFrame - effect.start < 9);
    if (shatter && !reducedMotion) {
      const shatterAge = arenaFrame - shatter.start;
      ctx.fillStyle = `rgba(254, 240, 138, ${(1 - shatterAge / 9) * .62})`;
      ctx.fillRect(0, 0, width, height);
    }
    drawWhaleIntro(ctx, config, state, reducedMotion ? 0 : presentationFraction);
    drawFrogIntro(ctx, config, state);
    if (shot) {
      ctx.save();
      ctx.globalAlpha = shotOpacity(shot);
      shot.paint(ctx);
      ctx.restore();
    }
  }

  private drawPositionStrip(arena: ArenaDefinition, fighters: [number, number], camera: CameraView) {
    const ctx = this.ctx;
    const width = 210;
    const center = (ctx.canvas.width - width) / 2;
    const y = 60;
    const position = (x: number) => center + width *
      Math.min(1, Math.max(0, (x - arena.left) / (arena.right - arena.left)));
    const start = position(camera.x);
    const end = position(camera.x + ctx.canvas.width / camera.zoom);
    ctx.fillStyle = '#10152ee0';
    ctx.fillRect(center - 5, y - 7, width + 10, 14);
    ctx.fillStyle = '#8f9acc96';
    ctx.fillRect(center, y - 1, width, 2);
    ctx.fillStyle = '#e7ddffac';
    ctx.fillRect(start, y - 4, end - start, 8);
    for (const seat of [0, 1] as const) {
      ctx.fillStyle = seatColors[seat];
      ctx.fillRect(position(fighters[seat]) - 3, y - 6 + seat * 6, 6, 6);
    }
  }

  private shakeOffset(frame: number): Point {
    let offset: Point = [0, 0];
    let remaining = 0;
    for (const { event, start, shake } of this.effects) {
      if (shake === undefined && event.kind !== 'hit' && event.kind !== 'break') continue;
      const heavy = event.heavy || event.kind === 'break' || (shake ?? 0) >= 8;
      const strength = shake ?? Math.min(10, event.feedback?.shake ?? (heavy ? 8 : 3));
      if (strength <= 0) continue;
      const age = frame - start;
      const weight = strength * Math.max(0, 1 - age / (shake ?? (heavy ? 9 : 5)));
      if (weight <= remaining) continue;
      remaining = weight;
      const pulse = Math.cos(age * 2.3) * weight;
      offset = [pulse * (event.direction ?? event.facing ?? 1) * (heavy ? .45 : .8), -pulse * (heavy ? .9 : .24)];
    }
    return offset;
  }

  private hitFlash(seat: 0 | 1, frame: number, frozenInHitstun: boolean) {
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const { event, start } = this.effects[i];
      if (event.kind !== 'hit' || event.source === seat) continue;
      const amount = event.feedback?.flash;
      if (amount !== undefined) return Math.max(0, 1 - (frame - start) / 6) * Math.max(0, Math.min(amount, 1));
      break;
    }
    return frozenInHitstun ? 1 : 0;
  }

  private drawEffects(frame: number, training: boolean, reducedMotion: boolean) {
    const ctx = this.ctx;
    const latestHit: [Effect | undefined, Effect | undefined] = [undefined, undefined];
    if (training) {
      for (const effect of this.effects) {
        if (effect.event.kind === 'hit') latestHit[effect.event.source] = effect;
      }
    }
    for (const effect of this.effects) {
      const { event, start, life, cue, poleSwing, swordSwing, bananaImpact, gagaReceives, knockdownDust } = effect;
      if (event.kind === 'swing' && !poleSwing && !swordSwing) continue;
      const age = frame - start;
      const color = event.kind === 'block' ? '#84e8ff' : event.kind === 'break' ? '#ff8c88' : event.feedback?.color ?? '#ffdfa0';
      ctx.save();
      ctx.globalAlpha = Math.min(1, (life - age) / 6);
      ctx.translate(event.x, event.y);
      if (poleSwing) {
        drawPoleDust(ctx, poleSwing, age, event.facing);
      } else if (swordSwing) {
        drawSwordReleaseSlash(ctx, age, life, event.facing, reducedMotion);
      } else if (event.kind === 'pole-impact') {
        drawPoleEarthBurst(ctx, age, event.facing);
      } else if (event.kind === 'summon-impact') {
        drawDijiangImpact(ctx, age, reducedMotion);
      } else if (event.kind === 'summon-catch') {
        ctx.save();
        drawGagaContact(ctx, 'heavy', age, event.facing);
        ctx.restore();
      } else if (event.kind === 'kq-plant') {
        drawKillerQueenPlant(ctx, age, life, reducedMotion);
      } else if (event.kind === 'kq-lock') {
        drawSheerHeartLock(ctx, age, life, reducedMotion);
      } else if (event.kind === 'kq-detonate') {
        drawKillerQueenDetonation(ctx, age, life, reducedMotion);
      } else if (event.kind === 'crystal-plant') {
        drawCrystalPlant(ctx, age, life);
      } else if (event.kind === 'crystal-shatter') {
        drawCrystalShatter(ctx, age, life, reducedMotion);
      } else if (event.kind === 'crystal-spire') {
        drawCrystalSpire(ctx, age, life, reducedMotion);
      } else if (event.kind === 'xiranite-burst') {
        drawXiraniteBurstEffect(ctx, age, life, event.facing, reducedMotion);
      } else if (event.kind === 'pylon-plant') {
        drawPylonPlantEffect(ctx, age, life, event.radius);
      } else if (event.kind === 'pylon-expire') {
        drawPylonExpireEffect(ctx, age, life);
      } else if (event.kind === 'time-stop-flick' || event.kind === 'time-stop-hit') {
        drawTimeStopPunchImpact(ctx, age, life, Boolean(event.heavy), event.facing ?? 1, reducedMotion);
      } else if (event.kind === 'time-stop-release') {
        drawTimeStopReleaseBurst(ctx, age, life, reducedMotion);
      } else if (event.kind === 'jo-shatter') {
        drawJoShatterBurst(ctx, age, life, reducedMotion);
      } else if (isTurretEffect(event)) {
        drawTurretEffect(ctx, event, age);
      } else if (bananaEffectLife(event)) {
        drawBananaEffect(ctx, event, age, life);
      } else if (cue && cue !== 'guard') {
        drawGagaContact(ctx, cue, age, event.facing ?? event.direction);
      } else if (knockdownDust) {
        drawKnockdownDust(ctx, age);
      } else if (bananaImpact && event.kind === 'land') {
        drawBananaImpact(ctx, event, age, life, reducedMotion);
      } else if (event.kind === 'land' && event.actionId === gagaActionIds.airDive) {
        drawDiveLandImpact(ctx, age, life, reducedMotion);
      } else if (event.kind === 'ultimate') {
        ctx.strokeStyle = '#efd28a';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.ellipse(0, 0, 24 + age * 4, 6 + age, 0, 0, 2 * Math.PI);
        ctx.stroke();
      } else if (event.kind === 'dash' && event.heavy) {
        drawBananaJoDashTrail(ctx, event, age, life, reducedMotion);
      } else if (event.kind === 'dash') {
        ctx.fillStyle = seatColors[event.source];
        ctx.scale(event.direction ?? 1, 1);
        for (let i = 0; i < 4; i++) ctx.fillRect(-37 - age * 2 + i * 5, -15 - i * 15, 10 + age, 2);
      } else if (event.kind === 'land' || event.kind === 'drop' || event.kind === 'air-jump' || event.kind === 'knockdown') {
        const air = event.kind === 'air-jump';
        ctx.strokeStyle = air ? seatColors[event.source] : '#fbdfb7cf';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(0, event.kind === 'drop' || air ? age * 1.8 : -1,
          (event.kind === 'knockdown' ? 22 : 9) + age * 2.7, 3 + age * .25, 0, 0, 2 * Math.PI);
        ctx.stroke();
      } else if (event.kind === 'parry') {
        const radius = 12 + age * 1.8;
        polygon(ctx, '#ffe399', [[0, -radius], [4, -4], [radius, 0], [4, 4],
          [0, radius], [-4, 4], [-radius, 0], [-4, -4]]);
      } else if (event.kind === 'block') {
        ctx.scale(event.direction ?? 1, 1);
        const radius = 15 + age * 1.6;
        ctx.strokeStyle = color;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(-6, 0, radius, -1.29, 1.29);
        ctx.stroke();
        ctx.strokeStyle = '#e8f9ff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(-8, 0, radius * .73, -.97, .97);
        ctx.stroke();
      } else if (event.feedback?.shape === 'ring') {
        ctx.strokeStyle = '#fff2cf';
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(0, 0, 10 + age * 1.7, 0, Math.PI * 2); ctx.stroke();
      } else if (effect.gagaImpact) {
        drawGagaImpact(ctx, event, age, life, reducedMotion);
      } else if (!bananaImpact) {
        const heavy = event.heavy || event.kind === 'break';
        if (heavy) {
          const radius = 24 + age * 2.25;
          ctx.strokeStyle = color;
          ctx.lineWidth = 2.5 - age * .08;
          ctx.beginPath();
          ctx.ellipse(0, 0, radius, radius * .76, -.32, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.save();
        const scale = (heavy ? .97 : .62) * (age < 3 ? 1 + age * .08 : 1.18 - age * .041);
        ctx.scale(scale * (event.direction ?? 1), scale);
        ctx.rotate(-.14 + age * .014);
        polygon(ctx, color, [[0, -39], [7, -11], [34, -18], [15, 0], [34, 18],
          [7, 10], [0, 36], [-8, 10], [-29, 16], [-14, 0], [-30, -19], [-7, -10]]);
        polygon(ctx, '#fff8e2', [[0, -17], [5, -5], [17, 0], [5, 4], [0, 17], [-6, 5], [-17, 0], [-5, -5]]);
        ctx.fillStyle = color;
        for (let i = 0; i < 5; i++) ctx.fillRect(19 + age * (1.3 + i * .12), (i - 2) * (12 + age * .42), 7, 2);
        ctx.restore();
      }
      if (bananaImpact && event.kind === 'hit') drawBananaImpact(ctx, event, age, life, reducedMotion);
      if (gagaReceives) drawGagaReceive(ctx, age, event.facing ?? event.direction);
      if (event.amount && latestHit[event.source] === effect) {
        const offset = 42 * (event.direction ?? 1);
        ctx.font = '950 20px system-ui';
        ctx.textAlign = 'center';
        ctx.strokeStyle = '#181934';
        ctx.lineWidth = 5;
        ctx.strokeText(String(event.amount), offset, -99 - age);
        ctx.fillStyle = '#fff4b9';
        ctx.fillText(String(event.amount), offset, -99 - age);
      }
      ctx.restore();
    }
  }
}

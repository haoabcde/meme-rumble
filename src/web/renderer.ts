import { roster } from '../content/roster.js';
import { bananaActionIds } from '../content/fighters/banana.js';
import { drawBanana } from './banana-art.js';
import { drawBananaImpact } from './banana-hit-art.js';
import { drawKnockdownDust, drawKnockdownPose, knockdownPose } from './knockdown-art.js';
import { drawBananaWaveCutIn } from './banana-wave-art.js';
import { bananaEffectLife, drawBananaEffect, drawBananaProjectile, drawBananaWave, isTearJet } from './banana-fx.js';
import { gagaActionIds } from '../content/fighters/gaga.js';
import { actionFor, hitRegionsFor, hurtRegionsFor, isActiveFrame, worldBox } from '../core/match.js';
import { motionGrid } from '../content/fighter-kit.js';
import type { EntityState } from '../core/entities.js';
import { isAttack, type FighterAction, type FighterState } from '../core/types.js';
import { summonFallFrames } from '../core/summon.js';
import { turretBuildTicks } from '../core/turret.js';
import type { ActionDefinition, ArenaDefinition, CombatEvent, MatchConfig, MatchState, Summon } from '../core/types.js';
import { backgrounds, harborProps, harborGantry, stageKits, drawEngineeringCrate, drawGagaLaunchTrail, drawGagaPole, drawGrenade, drawThrownPole, drawTurret, drawTurretBolt, gagaActionPose, gagaReactionPose, motionArt, sprites, type PolePose } from './art.js';
import { frameCamera, frameDijiangLength, frameDijiangImpact, frameEntrance, type CameraView } from './camera.js';
import { drawGagaWalk, GagaWalk } from './gaga-walk.js';
import { gagaIntro } from './gaga-intro.js';
import { drawGagaContact, drawGagaReceive, gagaContact, type GagaContact } from './gaga-contact.js';
import { drawGagaImpact, gagaStrike } from './gaga-hit-art.js';
import { hitWeight, type Weight } from './hit-burst.js';
import { drawPoleDust, drawPoleEarthBurst, drawPoleGroundMark, poleDustLife, poleImpactLife, poleSwingFor, type PoleSwing } from './gaga-pole-fx.js';
import { drawTurretEffect, isTurretEffect, turretEffectLife } from './gaga-turret-fx.js';
import { dijiangImpactLife, drawDijiang, drawDijiangGround, drawDijiangImpact, drawDijiangPressure,
  drawSummonCutIn } from './dijiang.js';

import { platformAt } from '../core/terrain.js';
import { shotFading, shotOpacity, type FeatureShot, type FighterIntro } from './cinematics.js';
import { drawHarborScenery, drawHarborLift, drawQuay } from './harbor-art.js';
import { drawStageBackdrop, drawStageMechanism, drawStageScenery } from './stage-art.js';

export const seatColors = ['#61d8ff', '#ff849e'];
export const recoveryLabels = { fall: '击倒', down: '倒地', rise: '起身' };
// Entrances performed on the stage, by fighter. They play inside the opening countdown with both fighters in view.
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
const arenaColors = { dorm: '#ffc08c', court: '#8faaff', harbor: '#8de9cd', station: '#bc9bff' };
// Peak screen shake in pixels for each hit weight, matching the flash of the same weight in hit-burst.ts.
const hitShake: Record<Weight, number> = { light: 4, medium: 6.5, heavy: 11, launch: 12 };
const artSizes = new Map(roster.map(entry => [entry.fighter.id, entry.height]));
type Point = [number, number];
const poses = {
  run: 0, stride: 1, jump: 2, guard: 3, windup: 4, strike: 5,
  sweep: 6, finish: 7, rise: 8, air: 9, recover: 10, hurt: 11
};

function poseFor(fighter: FighterState, action: FighterAction | undefined, frame: number) {
  if (!fighter.hp || fighter.hitstun || fighter.guardBreak) return poses.hurt;
  if (fighter.recovery) return fighter.recovery.phase === 'rise' ? poses.recover : poses.hurt;
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
  ctx.drawImage(sheet, pose % columns * cell, Math.floor(pose / columns) * cell, cell, cell,
    offset - footX * scale, -footY * scale, cell * scale, cell * scale);
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

const harborLayers = { backdrop: drawQuay, scenery: drawHarborScenery, mechanism: drawHarborLift };
const campusLayers = { backdrop: drawStageBackdrop, scenery: drawStageScenery, mechanism: drawStageMechanism };
const layersFor = (arena: ArenaDefinition) => arena.theme === 'harbor' ? harborLayers : campusLayers;
const sheetsFor = (arena: ArenaDefinition) => arena.theme === 'harbor' ? [harborProps, harborGantry] : [stageKits[arena.theme]];

export function paintArena(ctx: CanvasRenderingContext2D, arena: ArenaDefinition) {
  const { width, height, left, right, floor } = arena;
  const accent = arenaColors[arena.theme];
  ctx.fillStyle = '#211f4b';
  ctx.fillRect(0, 0, width, height);
  const layers = layersFor(arena);
  layers.backdrop(ctx, arena, arena.width / 2);
  layers.scenery(ctx, arena);

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

export function previewArena(canvas: HTMLCanvasElement, arena: ArenaDefinition, route = false) {
  const ctx = canvas.getContext('2d')!;
  const variant = arena.id + (route ? '-route' : '');
  canvas.dataset.variant = variant;
  const draw = () => {
    if (canvas.dataset.variant !== variant) return;
    ctx.setTransform(canvas.width / arena.width, 0, 0, canvas.height / arena.height, 0, 0);
    paintArena(ctx, arena);
    layersFor(arena).mechanism(ctx, arena, 0);
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
  age: number;
  life: number;
  cue?: GagaContact;
  poleSwing?: PoleSwing;
  gagaReceives: boolean;
  bananaImpact?: boolean;
  gagaImpact?: boolean;
}

export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private background = document.createElement('canvas');
  private sceneryTop = 0;
  private effects: Effect[] = [];
  /** Screen shake still to play out, in screen pixels. `shakePhase` drives its direction and restarts with each new blow. */
  private shake = 0;
  private shakePhase = 0;
  private shakeSign = 1;
  private camera: CameraView | null = null;
  private dive: { summon: Summon; length: number } | null = null;
  private gagaWalks = [new GagaWalk(), new GagaWalk()];

  constructor(canvas: HTMLCanvasElement, arena: ArenaDefinition) {
    this.ctx = canvas.getContext('2d', { alpha: false })!;
    this.load(arena);
  }

  load(arena: ArenaDefinition) {
    const layer = this.background;
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
    this.effects = [];
    this.shake = 0;
    this.shakePhase = 0;
    this.camera = null;
    this.dive = null;
    this.gagaWalks.forEach(walk => walk.reset());
  }

  /** A new blow restarts the shake at full strength on its own frame and flips which way it first throws the view. */
  private kick(strength: number) {
    if (strength <= this.shake) return;
    this.shake = strength;
    this.shakePhase = 0;
    this.shakeSign = -this.shakeSign;
  }

  add(events: CombatEvent[], fighters: MatchConfig['fighters']) {
    for (const event of events) {
      const jet = isTearJet(event.actionId);
      if (event.kind === 'tear-splash') {
        this.effects.push({ event, life: bananaEffectLife(event), age: 0, gagaReceives: false });
        this.kick(5);
      }
      if (jet && event.kind === 'swing') {
        this.kick(event.actionId === bananaActionIds.uppercut ? 8 : 5);
      }
      if (event.actionId === bananaActionIds.wave && (event.kind === 'swing' || event.kind === 'hit')) {
        this.kick(event.kind === 'hit' ? 16 : 11);
      }
      if (isTurretEffect(event)) {
        this.effects.push({ event, life: turretEffectLife[event.kind], age: 0, gagaReceives: false });
        if (event.kind === 'grenade-impact') this.kick(9);
        if (event.kind === 'turret-burst' || event.kind === 'turret-ready') this.kick(6);
      }
      const poleSwing = poleSwingFor(event);
      if (poleSwing) this.effects.push({ event, life: poleDustLife, age: 0, poleSwing, gagaReceives: false });
      if (event.kind === 'pole-impact') {
        this.effects.push({ event, life: poleImpactLife, age: 0, gagaReceives: false });
        this.kick(6);
      }
      if (event.kind === 'summon-impact') {
        this.effects.push({ event, life: dijiangImpactLife, age: 0, gagaReceives: false });
      }
      if (event.kind === 'summon-catch') {
        this.effects.push({ event, life: 14, age: 0, gagaReceives: false });
      }
      if (event.kind === 'ultimate' && (event.actionId === bananaActionIds.wave || event.actionId === gagaActionIds.dijiang)) continue;
      if (['hit', 'block', 'break', 'dash', 'land', 'drop', 'air-jump', 'knockdown', 'parry', 'ultimate'].includes(event.kind)) {
        const brief = event.kind === 'dash' || event.kind === 'land' || event.kind === 'drop';
        const cue = gagaContact(event, fighters);
        const fromBanana = fighters[event.source].id === 'banana';
        // A burst belongs to whoever landed the blow, so its colour tells the two fighters' hits apart.
        const gagaImpact = cue === 'guard' || (fighters[event.source].id === 'gaga' && Boolean(gagaStrike(event)));
        const wet = jet || event.actionId === bananaActionIds.wave || event.actionId === bananaActionIds.tear;
        const bananaImpact = event.kind === 'land' ? fromBanana && event.reaction === 'air'
          : event.kind === 'hit' && Boolean(event.amount) && !wet && !gagaImpact && (fromBanana || fighters[1 - event.source].id === 'banana');
        const life = event.kind === 'knockdown' ? 22 : bananaImpact || gagaImpact ? (event.kind === 'land' ? 22 : 19)
          : jet ? bananaEffectLife(event)
          : cue === 'light' || brief || event.impact === 'light' ? 14 : event.impact === 'heavy' ? 22 : 23;
        const gagaReceives = event.kind === 'hit' && fighters[1 - event.source].id === 'gaga';
        this.effects.push({ event, life, age: 0, cue, gagaReceives, bananaImpact, gagaImpact });
      }
      if (event.kind === 'hit' || event.kind === 'break') {
        const strength = event.actionId === bananaActionIds.wave ? 18
          : jet ? (event.actionId === bananaActionIds.uppercut ? 12 : 8)
          : hitShake[event.kind === 'break' ? 'medium' : hitWeight(event)];
        this.kick(event.feedback?.shake ?? strength);
      }
    }
  }

  draw(config: MatchConfig, state: MatchState, debug: boolean, elapsed: number, shakeEnabled: boolean, focus = false,
    reducedMotion = false, opening = 0, shot?: FeatureShot) {
    const ctx = this.ctx;
    const { width, height } = ctx.canvas;
    // A character shot covers the frozen match, then lets it fade back in under its last frames.
    if (shot && !shotFading(shot)) {
      shot.paint(ctx);
      return;
    }
    if (state.cutIn) {
      drawBananaWaveCutIn(ctx, state.cutIn, reducedMotion);
      return;
    }
    const summon = state.summon;
    if (summon?.phase === 'cut-in') {
      drawSummonCutIn(ctx, summon.frame, summon.facing, reducedMotion);
      return;
    }
    const [a, b] = state.fighters;
    const heights = [artSizes.get(config.fighters[0].id) ?? 137, artSizes.get(config.fighters[1].id) ?? 137];
    const jetTips = ([0, 1] as const).flatMap(seat => {
      const fighter = state.fighters[seat];
      const action = actionFor(config, state, seat);
      if (!isAttack(action) || action.id !== bananaActionIds.pressure || !fighter.attack ||
        fighter.attack.frame >= action.startup + action.active + 7) return [];
      const box = worldBox(action.hitbox, fighter.x, fighter.y, fighter.facing);
      const tipX = fighter.facing === 1 ? box.x + box.w : box.x;
      return [{ x: Math.max(0, Math.min(config.arena.width, tipX)), y: Math.max(0, box.y) }];
    });
    const camera = frameCamera(config.arena, { width, height },
      [{ x: a.x, y: a.y, height: heights[0] }, { x: b.x, y: b.y, height: heights[1] }],
      this.camera, elapsed, focus, opening, summon, jetTips);
    // An entrance takes a closer two-shot that still holds both fighters, then hands back to the play camera.
    const frame = reducedMotion ? -1 : openingFrame(state, config.fighters);
    const shown = ([0, 1] as const).map(seat => {
      const entrance = entranceFor(config.fighters[seat]);
      return entrance && frame >= 0 && frame < entrance.frames ? entrance : undefined;
    });
    const close = shown.find(Boolean)?.close(frame);
    const sight = close ? frameEntrance(config.arena, { width, height }, camera,
      [{ x: a.x, y: a.y, height: heights[0] }, { x: b.x, y: b.y, height: heights[1] }], close) : camera;
    this.camera = sight;
    // A walked-in entrance is drawn behind the opening mark. The simulation never moves the fighter.
    const standing = (seat: 0 | 1) =>
      state.fighters[seat].x + (shown[seat]?.shift(frame) ?? 0) * state.fighters[seat].facing;
    const impact = this.effects.find(effect => effect.event.kind === 'summon-impact');
    const { x, y, zoom } = impact && shakeEnabled ?
      frameDijiangImpact(config.arena, { width, height }, sight, impact.event, impact.age) : sight;
    // The shake alternates direction each frame on both axes and is hardest on the frame of the blow itself.
    // Neither axis may push the view past the edge of the arena.
    const force = shakeEnabled ? this.shake : 0;
    const dx = Math.min(x * zoom, Math.max(width - (config.arena.width - x) * zoom,
      force * this.shakeSign * Math.cos(this.shakePhase)));
    const dy = Math.min(y * zoom, Math.max(height - (config.arena.height - y) * zoom,
      force * .55 * Math.sin(this.shakePhase * 1.3 + .7)));
    ctx.setTransform(zoom, 0, 0, zoom, -x * zoom + dx, -y * zoom + dy);
    const layers = layersFor(config.arena);
    layers.backdrop(ctx, config.arena, x + width / (2 * zoom));
    ctx.drawImage(this.background, 0, this.sceneryTop);
    layers.mechanism(ctx, config.arena, state.arenaFrame, state, config);
    ctx.fillStyle = '#10153312';
    ctx.fillRect(x - dx / zoom, y - dy / zoom, width / zoom, height / zoom);

    const decks = config.arena.platforms.map(p => platformAt(p, state.arenaFrame));
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
    if (summon?.phase === 'fall') {
      drawDijiangPressure(ctx, summon.x, summon.y, summon.frame / summonFallFrames, reducedMotion);
    } else if (impact && impact.age < 24) {
      const { event, age } = impact;
      drawDijiangPressure(ctx, event.x, event.y, 1, reducedMotion, 1 - age / 24);
    }
    for (const { event, age } of this.effects) {
      if (event.kind !== 'pole-impact' && event.kind !== 'summon-impact') continue;
      ctx.save();
      ctx.translate(event.x, event.y);
      if (event.kind === 'pole-impact' && event.surface) {
        drawPoleGroundMark(ctx, age, event.surface.left - event.x, event.surface.right - event.x);
      } else if (event.kind === 'summon-impact') {
        const surface = config.arena;
        drawDijiangGround(ctx, age, surface.left - event.x, surface.right - event.x);
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
      this.dive = { summon, length: frameDijiangLength({ width, height }, camera) };
    } else if (!summon) {
      this.dive = null;
    }
    const carrying = summon?.phase === 'fall' && summon.carry;
    if (carrying && summon && this.dive) drawDijiang(ctx, summon, this.dive.length, debug, reducedMotion);

    const swingTrails: { paths: Trail[]; x: number; y: number; facing: number; alpha: number; wide: boolean }[] = [];
    const poles: { pose: PolePose; x: number; y: number; facing: number; action: ActionDefinition; frame: number }[] = [];
    for (const turret of Object.values(state.turrets)) {
      if (!turret) continue;
      drawTurret(ctx, turret);
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
    for (const seat of [0, 1] as const) {
      const f = state.fighters[seat];
      const def = config.fighters[seat];
      const sprite = sprites[def.id];
      const color = seatColors[seat];
      const move = actionFor(config, state, seat);
      const action = isAttack(move) ? move : undefined;
      const phase = f.attack?.frame ?? 0;
      const active = action && isActiveFrame(action, phase);
      const poseCell = poseFor(f, move, state.arenaFrame);
      const motionSheet = motionArt[def.id];
      const authoredPose = Boolean(move?.animation?.length && motionSheet?.naturalWidth && poseCell !== undefined);
      // An entrance takes the place of the idle stance until its last pose.
      const entrance = shown[seat];
      const attackPose = !authoredPose && def.id === 'gaga' && action ? gagaActionPose(action, phase, Boolean(f.ground)) : undefined;
      const pose = entrance ? entrance.pose(frame) ?? attackPose : attackPose;
      const reaction = def.id === 'gaga' && f.hp && !action && !f.walk && !f.dash && !f.guarding ? f.reaction : undefined;
      const hurtPose = reaction ? gagaReactionPose(reaction, f.vy) : undefined;
      const drawnPose = hurtPose ?? pose;
      const allowedToWalk = def.id === 'gaga' && f.ground && f.hp && !action &&
        !f.guarding && !f.dash && !f.hitstun && !f.blockstun && !f.guardBreak && !f.recovery;
      const walk = this.gagaWalks[seat];
      if (!allowedToWalk) walk.reset();
      // The walk-in reports how much ground it has covered; afterwards the gait follows the simulation again.
      const gait = entrance && entrance.travelled(frame) > 0 && frame < 40
        ? { direction: 'forward' as const, distance: entrance.travelled(frame) } : f.walk;
      const walkPose = allowedToWalk && !hurtPose ? walk.sample(gait, elapsed) : undefined;
      const fallingPose = knockdownPose(def.id, f);
      const at = standing(seat);
      const ground = decks.reduce((y, platform) =>
        at >= platform.left && at <= platform.right && platform.y >= f.y && platform.id !== f.ignorePlatform
          ? Math.min(y, platform.y) : y,
        config.arena.floor);
      ctx.fillStyle = '#08091cc9';
      ctx.beginPath();
      ctx.ellipse(at, ground + 3, f.ground ? 39 : 23, f.ground ? 8 : 5, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.save();
      ctx.translate(at, f.y);
      ctx.scale(fallingPose?.facing ?? (hurtPose && reaction ? reaction.facing : f.facing), 1);
      const sways = f.moving && (def.id !== 'gaga' || !f.ground);
      const stride = sways ? Math.sin(state.frame * .68) : Math.sin(state.frame * .16) * .24;
      const height = heights[seat];
      const width = sprite?.naturalHeight ? height * sprite.naturalWidth / sprite.naturalHeight : 100;
      let yScale = drawnPose || walkPose ? 1 : 1 + stride * .035;
      if (fallingPose) yScale = 1;
      else if (f.recovery?.phase === 'down') {
        ctx.translate(height * .40, -height * .32);
        ctx.rotate(-1.24);
      } else if (f.recovery?.phase === 'fall') ctx.rotate(-.25);
      else if (f.recovery?.phase === 'rise') yScale = 1 - f.recovery.remaining * .017;
      else if (def.id === 'banana') yScale = 1;
      else if (f.hp === 0) ctx.rotate(-Math.PI / 2.6);
      else if (f.hitstun && !hurtPose) {
        const reeling = Math.abs(f.push) >= 15;
        ctx.rotate(reeling ? -.38 : -.20);
        yScale = reeling ? .88 : .94;
      }
      else if (f.dash) { ctx.rotate(.20); yScale = .87; }
      else if (f.guarding) yScale = .83;
      else if (active && !pose) ctx.rotate(action.pose === 'rise' ? -.14 : .12);
      else if (!f.ground && !drawnPose) ctx.rotate(f.vy < 0 ? -.085 : .085);
      ctx.scale(2 - yScale, yScale);
      if (pose?.rotation) ctx.rotate(pose.rotation);
      if (!fallingPose && f.recovery?.phase === 'rise') ctx.globalAlpha = .83;
      if (def.id === 'banana' || drawnPose?.image || sprite?.naturalWidth) {
        ctx.shadowColor = color + 'ca';
        ctx.shadowBlur = 8;
        const flash = this.effects.find(effect => effect.event.kind === 'hit' &&
          effect.event.source !== seat && effect.age < 6)?.event.feedback?.flash;
        if (flash !== undefined && f.hitstun) ctx.filter = 'brightness(' + (1 + Math.min(1, flash)) + ')';
        else if (hurtPose && reaction && reaction.elapsed < 2) ctx.filter = 'brightness(1.45) saturate(.7)';
        else if (f.hitstun && state.freeze > 0) ctx.filter = 'brightness(1.48)';
        if (fallingPose) {
          drawKnockdownPose(ctx, fallingPose, height, reducedMotion);
        } else if (authoredPose && poseCell !== undefined) {
          drawPose(ctx, motionSheet, poseCell, height);
        } else if (def.id === 'banana') {
          const readyTotal = openingTicks(config.fighters);
          const stageCue = state.phase === 'ready'
            ? { kind: 'entrance' as const, frame: Math.max(0, readyTotal - state.phaseTicks) }
            : state.phase === 'round-over' && state.result?.winner === seat
              ? { kind: 'victory' as const, frame: Math.max(0, 192 - state.phaseTicks) }
              : undefined;
          drawBanana(ctx, f, action, state.frame, reducedMotion, stageCue);
        } else if (drawnPose?.image) {
          const { image, region, scaleX, scaleY } = drawnPose;
          ctx.drawImage(image, region.x, region.y, region.width, region.height,
            -region.footX * scaleX, -region.footY * scaleY, region.width * scaleX, region.height * scaleY);
        } else if (walkPose) {
          drawGagaWalk(ctx, sprite, height, walkPose);
        } else if (def.id !== 'gaga' && motionSheet?.naturalWidth && poseCell !== undefined) {
          drawPose(ctx, motionSheet, poseCell, height, active ? 8 : 0);
        } else {
          ctx.drawImage(sprite, -width * .51 + (active ? 9 : 0), -height, width, height);
        }
        ctx.filter = 'none';
        ctx.shadowBlur = 0;
      }
      if (pose?.heldCrate) drawEngineeringCrate(ctx, pose.heldCrate.kind, pose.heldCrate.x, pose.heldCrate.y, -.16);
      if (pose?.pole && action) poles.push({ pose: pose.pole, x: f.x, y: f.y, facing: f.facing, action, frame: phase });
      const trails = pose?.rushing ? rushTrails : active && pose && attackTrails[action.id];
      if (trails && action) {
        const sustained = pose?.rushing || action.id === gagaActionIds.slide;
        const alpha = sustained ? .54 : .76 * (1 - (phase - action.startup) / action.active);
        swingTrails.push({ paths: trails, x: f.x, y: f.y, facing: f.facing,
          alpha, wide: Boolean(pose?.pole) || action.impact === 'heavy' });
      }
      ctx.globalAlpha = 1;
      if (f.guarding || (move && !isAttack(move) && isActiveFrame(move, phase))) {
        ctx.strokeStyle = '#fff2ab';
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.ellipse(19, -65, 46, 61, 0, -1.40, 1.38);
        ctx.stroke();
      }
      ctx.restore();

      if (active && action && !pose && def.id !== 'banana') {
        const [region] = hitRegionsFor(action, phase);
        if (region) {
          const hit = worldBox(region, f.x, f.y, f.facing);
          const tip = f.facing === 1 ? hit.x + hit.w - 6 : hit.x + 6;
          ctx.save();
          ctx.strokeStyle = color + 'c2';
          ctx.lineWidth = action.slot === 'C' ? 7 : 4;
          ctx.beginPath();
          ctx.moveTo(tip - 42 * f.facing, hit.y + 3);
          ctx.quadraticCurveTo(tip + 19 * f.facing, hit.y + hit.h * .52, tip - 34 * f.facing, hit.y + hit.h - 4);
          ctx.stroke();
          ctx.restore();
        }
      }

      if (debug) {
        ctx.fillStyle = '#27d7ee24';
        ctx.strokeStyle = '#4ce2e8';
        ctx.lineWidth = 2;
        for (const region of hurtRegionsFor(def, move, phase)) {
          const hurt = worldBox(region, f.x, f.y, f.facing);
          ctx.fillRect(hurt.x, hurt.y, hurt.w, hurt.h);
          ctx.strokeRect(hurt.x, hurt.y, hurt.w, hurt.h);
        }
        ctx.strokeStyle = '#ffc263';
        ctx.strokeRect(f.x - def.bodyWidth / 2, f.y - 82, def.bodyWidth, 82);
        for (const region of hitRegionsFor(move, phase)) {
          const hit = worldBox(region, f.x, f.y, f.facing);
          ctx.fillStyle = '#ff536844';
          ctx.strokeStyle = '#ff5a6e';
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
    for (const projectile of state.projectiles) {
      const data = config.fighters[projectile.source].actions.filter(isAttack).find(move => move.id === projectile.actionId)?.projectile;
      if (!data) continue;
      if (data.kind === 'crate' && data.turret) {
        const pitch = Math.atan2(projectile.vy, Math.abs(projectile.vx)) * .20 * projectile.facing;
        drawEngineeringCrate(ctx, data.turret, projectile.x, projectile.y, pitch);
      } else if (data.kind === 'bolt') {
        drawTurretBolt(ctx, projectile);
      } else if (data.kind === 'grenade') {
        drawGrenade(ctx, projectile);
      } else if (data.kind === 'tear') {
        drawBananaProjectile(ctx, projectile, data);
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
    for (const entity of state.entities ?? []) drawEntity(ctx, entity, debug);
    for (const trail of swingTrails) {
      ctx.save();
      ctx.translate(trail.x, trail.y);
      ctx.scale(trail.facing, 1);
      ctx.globalAlpha = trail.alpha;
      ctx.strokeStyle = '#fff1c0';
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
    for (const seat of [0, 1] as const) shown[seat]?.effect?.(ctx, frame, state.fighters[seat]);
    this.drawEffects(elapsed, Boolean(config.training), reducedMotion);
    ctx.resetTransform();
    for (const seat of [0, 1] as const) {
      const f = state.fighters[seat];
      if (!f.hp) continue;
      const center = (standing(seat) - x) * zoom + dx;
      const poseHeight = f.recovery?.phase === 'down' ? heights[seat] * .60 : heights[seat];
      const markerY = (f.y - poseHeight - y) * zoom - 25 - dy;
      const label = 'P' + (seat + 1) + (f.recovery ? ' ' + recoveryLabels[f.recovery.phase] : '');
      const labelWidth = f.recovery ? 70 : 34;
      ctx.fillStyle = '#111333e8';
      ctx.fillRect(center - labelWidth / 2, markerY, labelWidth, 21);
      ctx.textAlign = 'center';
      ctx.font = '900 15px system-ui';
      ctx.fillStyle = seatColors[seat];
      ctx.fillText(label, center, markerY + 15);
      const { airJump, airDash } = config.fighters[seat];
      if (!f.ground && !f.recovery && (airJump || airDash)) {
        const dot = center + 26;
        polygon(ctx, f.airActionUsed ? '#535c83' : seatColors[seat],
          [[dot, markerY + 4], [dot + 6, markerY + 10], [dot, markerY + 16], [dot - 6, markerY + 10]]);
      }
    }
    this.drawPositionStrip(config.arena, [a.x, b.x], camera);
    this.shake = Math.max(0, this.shake - elapsed);
    this.shakePhase += elapsed * 2.9;
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
    const y = 117;
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

  private drawEffects(elapsed: number, training: boolean, reducedMotion: boolean) {
    const ctx = this.ctx;
    for (const effect of this.effects) {
      const { event, age, life, cue } = effect;
      const color = event.kind === 'block' ? '#84e8ff' : event.kind === 'break' ? '#ff8c88' : event.feedback?.color ?? '#ffdfa0';
      ctx.save();
      ctx.globalAlpha = Math.min(1, (life - age) / 10);
      ctx.translate(event.x, event.y);
      if (effect.poleSwing) {
        drawPoleDust(ctx, effect.poleSwing, age, event.facing);
      } else if (event.kind === 'pole-impact') {
        drawPoleEarthBurst(ctx, age, event.facing);
      } else if (event.kind === 'summon-impact') {
        drawDijiangImpact(ctx, age, reducedMotion);
      } else if (event.kind === 'summon-catch') {
        drawGagaContact(ctx, 'heavy', age, event.facing);
      } else if (isTurretEffect(event)) {
        drawTurretEffect(ctx, event, age);
      } else if (bananaEffectLife(event) && event.kind !== 'hit') {
        drawBananaEffect(ctx, event, age, life);
      } else if (event.kind === 'dash') {
        ctx.fillStyle = seatColors[event.source];
        for (let i = 0; i < 4; i++) ctx.fillRect(-21 + i * 15, -10 - i * 3, i + 5, 2);
      } else if (event.kind === 'land' && effect.bananaImpact) {
        drawBananaImpact(ctx, event, age, life, reducedMotion);
      } else if (event.kind === 'knockdown') {
        drawKnockdownDust(ctx, age);
      } else if (event.kind === 'land' || event.kind === 'drop' || event.kind === 'air-jump' ||
        event.kind === 'ultimate') {
        ctx.strokeStyle = event.kind === 'air-jump' ? seatColors[event.source] : '#fbdfb7cf';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(0, event.kind === 'drop' ? age * 1.8 : -1, 9 + age * 2.7, 3 + age * .25, 0, 0, 2 * Math.PI);
        ctx.stroke();
      } else if (event.kind === 'parry') {
        ctx.strokeStyle = '#7bfcf0';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(0, 0, 15 + age * 2.2, 0, 2 * Math.PI);
        ctx.stroke();
      } else {
        if (bananaEffectLife(event)) {
          drawBananaEffect(ctx, event, age, life);
        } else if (effect.gagaImpact) {
          drawGagaImpact(ctx, event, age, life, reducedMotion);
        } else if (cue && cue !== 'guard') {
          drawGagaContact(ctx, cue, age, event.facing);
        } else if (!effect.bananaImpact) {
          ctx.save();
          ctx.rotate(age * .035);
          const scale = 1 + age * .012;
          ctx.scale(scale, scale);
          polygon(ctx, color, [[0, -39], [7, -11], [34, -18], [15, 0], [34, 18],
            [7, 10], [0, 36], [-8, 10], [-29, 16], [-14, 0], [-30, -19], [-7, -10]]);
          polygon(ctx, '#fff8e2', [[0, -17], [5, -5], [17, 0], [5, 4], [0, 17], [-6, 5], [-17, 0], [-5, -5]]);
          ctx.restore();
        }
        if (effect.bananaImpact) drawBananaImpact(ctx, event, age, life, reducedMotion);
        if (effect.gagaReceives) drawGagaReceive(ctx, age, event.facing);
        if (training && event.amount) {
          ctx.font = '950 23px system-ui';
          ctx.textAlign = 'center';
          ctx.strokeStyle = '#181934';
          ctx.lineWidth = 5;
          ctx.strokeText(String(event.amount), 0, -35 - age);
          ctx.fillStyle = '#fff4b9';
          ctx.fillText(String(event.amount), 0, -35 - age);
        }
      }
      ctx.restore();
      effect.age += elapsed;
    }
    this.effects = this.effects.filter(effect => effect.age < effect.life);
  }
}

import { roster } from '../content/roster.js';
import { motionGrid } from '../content/fighter-kit.js';
import { actionFor, hitRegionsFor, hurtRegionsFor, isActiveFrame, worldBox } from '../core/match.js';
import type { EntityState } from '../core/entities.js';
import type { ActionDefinition, ArenaDefinition, Box, CombatEvent, FighterAction, FighterState, MatchConfig, MatchState } from '../core/types.js';
import { backgrounds, harborProps, harborGantry, motionArt, sprites, stageKits } from './art.js';
import { drawHarborScenery, drawHarborLift, drawQuay } from './harbor-art.js';
import { drawStageBackdrop, drawStageMechanism, drawStageScenery } from './stage-art.js';
import { platformAt } from '../core/terrain.js';
import { frameCamera, type CameraView } from './camera.js';
import {frogPowered} from '../core/frog-kit.js';
import {cinematicOwner} from '../core/whale-kit.js';
import {drawFrogActor,drawFrogEffects,drawFrogIntro} from './frog-art.js';
import {drawWhaleActor,drawWhaleEntities,drawWhaleIntro} from './whale-art.js';

export const seatColors = ['#61d8ff', '#ff849e'];
export const recoveryLabels = { fall: '击倒', down: '倒地', rise: '起身' };
const arenaColors = { dorm: '#ffc08c', court: '#8faaff', harbor: '#8de9cd', station: '#bc9bff' };
const tierColors = ['#6adfff', '#ffdd87', '#edacff', '#c1ebad'];
const artSizes = new Map(roster.map(entry => [entry.fighter.id, entry.height]));
const harborLayers = { backdrop: drawQuay, scenery: drawHarborScenery, mechanism: drawHarborLift };
const campusLayers = { backdrop: drawStageBackdrop, scenery: drawStageScenery, mechanism: drawStageMechanism };
const layersFor = (arena: ArenaDefinition) => arena.theme === 'harbor' ? harborLayers : campusLayers;
const sheetsFor = (arena: ArenaDefinition) => arena.theme === 'harbor' ? [harborProps, harborGantry] : [stageKits[arena.theme]];
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
    layers.backdrop(ctx, arena, arena.width / 2);
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

export function previewArena(canvas: HTMLCanvasElement, arena: ArenaDefinition, route = false) {
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
  }

  add(events: CombatEvent[], frame: number) {
    for (const event of events) {
      const life = event.kind === 'hit' && event.heavy ? 16 : expiresAfter[event.kind];
      if (life) this.effects.push({ event, life, start: frame });
    }
  }

  draw(config: MatchConfig, state: MatchState, debug: boolean, elapsed: number, shakeEnabled: boolean, focus = false, opening = 0) {
    const ctx = this.ctx;
    const { width, height } = ctx.canvas;
    // A seek can jump across camera framing or a cinematic: redraw from a clean frame.
    ctx.resetTransform();ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';
    ctx.clearRect(0,0,width,height);
    const [a, b] = state.fighters;
    this.effects = this.effects.filter(({ start, life }) => state.arenaFrame >= start && state.arenaFrame - start < life);
    const heights = ([0,1] as const).map(seat=>(artSizes.get(config.fighters[seat].id)??137)+(frogPowered(state.fighters[seat],state)?52:0));
    const camera = frameCamera(config.arena, { width, height },
      [{ x: a.x, y: a.y, height: heights[0] }, { x: b.x, y: b.y, height: heights[1] }],
      this.camera, state.phase === 'fight' && (state.freeze || cinematicOwner(state)!==undefined) ? 0 : elapsed, focus, opening);
    this.camera = camera;
    const { x, y, zoom } = camera;
    const [shakeX, shakeY] = shakeEnabled ? this.shakeOffset(state.arenaFrame) : [0, 0];
    const dx = Math.min(x * zoom, Math.max(width - (config.arena.width - x) * zoom, shakeX));
    const dy = Math.min(y * zoom, Math.max(height - (config.arena.height - y) * zoom, shakeY));
    ctx.setTransform(zoom, 0, 0, zoom, -x * zoom + dx, -y * zoom + dy);
    const layered = !config.arena.artFrame.length;
    if (layered) {
      const layers = layersFor(config.arena);
      layers.backdrop(ctx, config.arena, x + width / (2 * zoom));
      ctx.drawImage(this.background, 0, this.sceneryTop);
      layers.mechanism(ctx, config.arena, state.arenaFrame, state, config);
    } else {
      ctx.drawImage(this.background, 0, 0, config.arena.width, config.arena.height);
    }
    ctx.fillStyle = layered ? '#10153312' : '#10153324';
    ctx.fillRect(x - dx / zoom, y - dy / zoom, width / zoom, height / zoom);

    const decks = config.arena.platforms.map(p => platformAt(p, state.arenaFrame));
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

    drawWhaleEntities(ctx,state,config,'back');
    drawFrogEffects(ctx,state,config,'back');
    const front = a.attack && b.hitstun ? [1, 0] as const : [0, 1] as const;
    for (const seat of front) {
      const f = state.fighters[seat];
      const def = config.fighters[seat];
      const sprite = sprites[def.id];
      const sheet = motionArt[def.id];
      const color = seatColors[seat];
      const action = actionFor(config, state, seat);
      const phase = f.attack?.frame ?? 0;
      const active = action && isActiveFrame(action, phase) ? action : undefined;
      const strike = active && !('counterTo' in active) ? active : undefined;
      const hitboxes = strike ? hitRegionsFor(strike, phase) : [];
      const stance = active && 'counterTo' in active && f.ground;
      const pose = poseFor(f, action, state.arenaFrame);
      const ground = decks.reduce((y, platform) =>
        f.x >= platform.left && f.x <= platform.right && platform.y >= f.y && platform.id !== f.ignorePlatform
          ? Math.min(y, platform.y) : y,
        config.arena.floor);
      ctx.fillStyle = '#08091cc9';
      ctx.beginPath();
      ctx.ellipse(f.x, ground + 3, f.ground ? 39 : 23, f.ground ? 8 : 5, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.save();
      ctx.translate(f.x, f.y);
      ctx.scale(f.facing, 1);
      const height = heights[seat];
      if(def.id==='whale'){
        const flash=this.hitFlash(seat,state.arenaFrame,f.hitstun>0&&state.freeze>0);
        if(flash>0)ctx.filter=`brightness(${1+flash*.36})`;
        drawWhaleActor(ctx,f,state,seat,action);ctx.filter='none';
      }else if(def.id==='frog'){drawFrogActor(ctx,f,state,action);
      }else{
      if (!f.hp) ctx.rotate(-Math.PI / 2.6);
      else if (f.recovery?.phase === 'down') {
        ctx.translate(height * .40, -height * .32);
        ctx.rotate(-1.24);
      } else if (f.recovery?.phase === 'fall') {
        ctx.rotate(-.25);
      } else if (f.recovery?.phase === 'rise') {
        ctx.scale(1, 1 - f.recovery.remaining * .017);
      }
      if (f.dash && sheet?.naturalWidth && pose !== undefined) {
        ctx.globalAlpha = .18;
        drawPose(ctx, sheet, pose, height, -48);
        ctx.globalAlpha = .34;
        drawPose(ctx, sheet, pose, height, -23);
        ctx.globalAlpha = 1;
      }
      if (f.recovery?.phase === 'rise') ctx.globalAlpha = .83;
      ctx.shadowColor = color + 'ae';
      ctx.shadowBlur = 9;
      const flash = this.hitFlash(seat, state.arenaFrame, f.hitstun > 0 && state.freeze > 0);
      if (flash > 0) ctx.filter = `brightness(${1 + flash * .36})`;
      if (sheet?.naturalWidth && pose !== undefined) {
        drawPose(ctx, sheet, pose, height, strike && hitboxes.length && !strike.animation?.length ? 8 : 0);
      } else if (sprite?.naturalWidth) {
        const spriteWidth = height * sprite.naturalWidth / sprite.naturalHeight;
        const breathe = pose === undefined ? Math.sin(state.arenaFrame * .10) * 1.4 : 0;
        ctx.drawImage(sprite, -spriteWidth * .51, -height - breathe, spriteWidth, height + breathe);
      }
      ctx.filter = 'none';
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
      if (f.guarding || stance) {
        ctx.strokeStyle = stance ? '#ffde85' : f.blockstun ? '#81e7ff' : '#afdfff93';
        ctx.lineWidth = f.blockstun ? 5 : 3;
        ctx.beginPath();
        ctx.ellipse(15, -60, 48, 56, 0, -1.33, 1.32);
        ctx.stroke();
      }
      }
      ctx.restore();

      if (strike && def.id!=='whale' && def.id!=='frog') {
        for (const hitbox of hitboxes) {
          drawSwing(ctx, f, hitbox, strike.pose, (phase - strike.startup) / strike.active, color);
        }
      }

      if (debug) {
        ctx.fillStyle = '#27d7ee24';
        ctx.strokeStyle = '#4ce2e8';
        ctx.lineWidth = 2;
        for (const region of hurtRegionsFor(def, action, phase)) {
          const hurt = worldBox(region, f.x, f.y, f.facing);
          ctx.fillRect(hurt.x, hurt.y, hurt.w, hurt.h);
          ctx.strokeRect(hurt.x, hurt.y, hurt.w, hurt.h);
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

    for (const entity of state.entities ?? []) if(!entity.definition.behavior)drawEntity(ctx, entity, debug);
    drawWhaleEntities(ctx,state,config,'front');
    drawFrogEffects(ctx,state,config,'front');
    this.drawEffects(state.arenaFrame, Boolean(config.training));
    ctx.resetTransform();
    for (const seat of [0, 1] as const) {
      const f = state.fighters[seat];
      const def = config.fighters[seat];
      if (!f.hp) continue;
      const center = (f.x - x) * zoom + dx;
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
      if (!f.ground && !f.recovery && (def.airJump || def.airDash)) {
        const dot = center + 26;
        polygon(ctx, f.airActionUsed ? '#535c83' : seatColors[seat],
          [[dot, markerY + 4], [dot + 6, markerY + 10], [dot, markerY + 16], [dot - 6, markerY + 10]]);
      }
    }
    if (debug || Math.abs(a.x - b.x) > width / zoom * .7) {
      this.drawPositionStrip(config.arena, [a.x, b.x], camera);
    }
    drawWhaleIntro(ctx,config,state);
    drawFrogIntro(ctx,config,state);
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
    for (const { event, start } of this.effects) {
      if (event.kind !== 'hit' && event.kind !== 'break') continue;
      const heavy = event.heavy || event.kind === 'break';
      const strength = event.kind === 'hit' ? event.feedback?.shake : undefined;
      const age = frame - start;
      const weight = Math.min(10, strength ?? (heavy ? 8 : 3)) * Math.max(0, 1 - age / (heavy ? 9 : 5));
      if (weight <= remaining) continue;
      remaining = weight;
      const pulse = Math.cos(age * 2.3) * weight;
      offset = [pulse * (event.direction ?? 1) * (heavy ? .45 : .8), -pulse * (heavy ? .9 : .24)];
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

  private drawEffects(frame: number, training: boolean) {
    const ctx = this.ctx;
    const latestHit: [Effect | undefined, Effect | undefined] = [undefined, undefined];
    if (training) {
      for (const effect of this.effects) {
        if (effect.event.kind === 'hit') latestHit[effect.event.source] = effect;
      }
    }
    for (const effect of this.effects) {
      const { event, start, life } = effect;
      const age = frame - start;
      const color = event.kind === 'block' ? '#84e8ff' : event.kind === 'break' ? '#ff8c88' : event.feedback?.color ?? '#ffdfa0';
      ctx.save();
      ctx.globalAlpha = Math.min(1, (life - age) / 6);
      ctx.translate(event.x, event.y);
      if (event.kind === 'ultimate') {
        ctx.strokeStyle = '#efd28a';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.ellipse(0, 0, 24 + age * 4, 6 + age, 0, 0, 2 * Math.PI);
        ctx.stroke();
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
        ctx.textAlign = 'center';
        ctx.font = '900 22px system-ui';
        ctx.strokeStyle = '#242039';
        ctx.lineWidth = 4;
        ctx.strokeText('防反', 0, -47 - age);
        ctx.fillStyle = '#ffe399';
        ctx.fillText('防反', 0, -47 - age);
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
      } else {
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
      }
      ctx.restore();
    }
  }
}

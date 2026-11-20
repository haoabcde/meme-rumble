import { roster } from '../content/roster.js';
import { actionFor, worldBox } from '../core/match.js';
import type { ArenaDefinition, CombatEvent, MatchConfig, MatchState } from '../core/types.js';
import { backgrounds, sprites } from './art.js';

export const seatColors = ['#61d8ff', '#ff849e'];
const arenaColors = { dorm: '#ffc08c', court: '#8faaff', harbor: '#8de9cd', station: '#bc9bff' };
const tierColors = ['#6adfff', '#ffdd87', '#edacff'];
const artSizes = new Map(roster.map(entry => [entry.fighter.id, entry.height]));
type Point = [number, number];

function polygon(ctx: CanvasRenderingContext2D, color: string, points: Point[]) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(...points[0]);
  for (const point of points.slice(1)) ctx.lineTo(...point);
  ctx.closePath();
  ctx.fill();
}

function drawStageArt(ctx: CanvasRenderingContext2D, arena: ArenaDefinition, image: HTMLImageElement) {
  const source = [0, image.naturalHeight * arena.artFrame.sourceTop,
    image.naturalHeight * arena.artFrame.sourceFloor, image.naturalHeight];
  const world = [0, arena.artFrame.worldTop, arena.floor, arena.height];
  for (let band = 0; band < 3; band++) {
    ctx.drawImage(image, 0, source[band], image.naturalWidth, source[band + 1] - source[band],
      0, world[band], arena.width, world[band + 1] - world[band]);
  }
}

export function paintArena(ctx: CanvasRenderingContext2D, arena: ArenaDefinition) {
  const { width, height, left, right, floor } = arena;
  const accent = arenaColors[arena.theme];
  const image = backgrounds[arena.theme];
  ctx.fillStyle = '#211f4b';
  ctx.fillRect(0, 0, width, height);
  if (image.naturalWidth) drawStageArt(ctx, arena, image);

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
    const ledgeWidth = p.right - p.left;
    const tier = tierColors[p.tier - 1];
    ctx.fillStyle = tier + (image.naturalWidth ? '75' : 'ff');
    ctx.fillRect(p.left, p.y, ledgeWidth, image.naturalWidth ? 1 : 4);
    ctx.fillStyle = tier;
    ctx.fillRect(p.left, p.y, 11, 2);
    ctx.fillRect(p.right - 11, p.y, 11, 2);
  }
}

function paintRoute(ctx: CanvasRenderingContext2D, arena: ArenaDefinition) {
  const route = arena.route.flatMap(id => arena.platforms.filter(platform => platform.id === id));
  let from: Point = [arena.spawn[0], arena.floor];
  for (const [i, platform] of route.entries()) {
    const follow = route[i + 1];
    const x = follow
      ? (Math.max(platform.left, follow.left) + Math.min(platform.right, follow.right)) / 2
      : (platform.left + platform.right) / 2;
    const to: Point = [x, platform.y];
    ctx.save();
    ctx.strokeStyle = '#fff4cb';
    ctx.lineWidth = 4;
    ctx.shadowColor = '#0e0b2d';
    ctx.shadowBlur = 7;
    ctx.setLineDash([8, 6]);
    ctx.beginPath();
    ctx.moveTo(...from);
    ctx.quadraticCurveTo((from[0] + x) / 2 - 40, platform.y - 50, ...to);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = tierColors[platform.tier - 1];
    ctx.beginPath();
    ctx.arc(x, platform.y, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    from = to;
  }
}

export function previewArena(canvas: HTMLCanvasElement, arena: ArenaDefinition, route = false) {
  const ctx = canvas.getContext('2d')!;
  const variant = arena.id + (route ? '-route' : '');
  canvas.dataset.variant = variant;
  const draw = () => {
    if (canvas.dataset.variant !== variant) return;
    ctx.setTransform(canvas.width / arena.width, 0, 0, canvas.height / arena.height, 0, 0);
    paintArena(ctx, arena);
    if (route) paintRoute(ctx, arena);
    ctx.resetTransform();
  };
  draw();
  const image = backgrounds[arena.theme];
  if (!image.complete) image.addEventListener('load', draw, { once: true });
}

interface Effect {
  event: CombatEvent;
  age: number;
  life: number;
}

export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private background = document.createElement('canvas');
  private effects: Effect[] = [];
  private shake = 0;
  private zoom = 1;
  private centerX = 0;

  constructor(canvas: HTMLCanvasElement, arena: ArenaDefinition) {
    this.ctx = canvas.getContext('2d', { alpha: false })!;
    this.background.width = arena.width;
    this.background.height = arena.height;
    this.load(arena);
  }

  load(arena: ArenaDefinition) {
    previewArena(this.background, arena);
    this.effects = [];
    this.shake = 0;
    this.zoom = 1;
    this.centerX = arena.width / 2;
  }

  add(events: CombatEvent[]) {
    for (const event of events) {
      if (['hit', 'block', 'break', 'dash', 'land', 'drop'].includes(event.kind)) {
        const brief = event.kind === 'dash' || event.kind === 'land' || event.kind === 'drop';
        this.effects.push({ event, life: brief ? 12 : 23, age: 0 });
      }
      if (event.kind === 'hit' || event.kind === 'break') this.shake = Math.max(this.shake, 4);
    }
  }

  draw(config: MatchConfig, state: MatchState, debug: boolean, elapsed: number, shakeEnabled: boolean, focus = false) {
    const ctx = this.ctx;
    const { width, height } = config.arena;
    const [a, b] = state.fighters;
    const distance = Math.abs(a.x - b.x);
    const closestToHud = Math.min(a.y, b.y);
    const sensitivity = Math.min(1, elapsed * .16);
    const target = focus && closestToHud > 295
      ? 1 + .23 * Math.max(0, 1 - distance / 700) * Math.min(1, (closestToHud - 295) / 115)
      : 1;
    const neededWidth = distance + 236;
    this.zoom = Math.max(1, Math.min(width / neededWidth, this.zoom + (target - this.zoom) * sensitivity));
    this.centerX += ((a.x + b.x) / 2 - this.centerX) * sensitivity;
    const half = width / (2 * this.zoom);
    const leftBound = Math.max(half, Math.max(a.x, b.x) + 112 - half);
    const rightBound = Math.min(width - half, Math.min(a.x, b.x) - 112 + half);
    const center = Math.min(Math.max(this.centerX, leftBound), Math.max(leftBound, rightBound));
    const dx = shakeEnabled && this.shake > 0 ? Math.sin(this.shake * 3) * this.shake : 0;
    ctx.resetTransform();
    ctx.drawImage(this.background, 0, 0);
    ctx.setTransform(this.zoom, 0, 0, this.zoom, width / 2 - center * this.zoom + dx, height * (1 - this.zoom));
    if (this.zoom > 1 || dx) ctx.drawImage(this.background, 0, 0);

    if (debug) {
      ctx.strokeStyle = '#fff4d9';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 4]);
      for (const p of config.arena.platforms) {
        ctx.beginPath();
        ctx.moveTo(p.left, p.y);
        ctx.lineTo(p.right, p.y);
        ctx.stroke();
      }
      ctx.setLineDash([]);
    }

    for (const seat of [0, 1] as const) {
      const f = state.fighters[seat];
      const def = config.fighters[seat];
      const sprite = sprites[def.id];
      const color = seatColors[seat];
      const action = actionFor(config, state, seat);
      const phase = f.attack?.frame ?? 0;
      const active = action && phase >= action.startup && phase < action.startup + action.active;
      const ground = config.arena.platforms.reduce((y, platform) =>
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
      const stride = f.moving ? Math.sin(state.frame * .68) : Math.sin(state.frame * .16) * .24;
      const height = artSizes.get(def.id) ?? 137;
      const width = sprite?.naturalHeight ? height * sprite.naturalWidth / sprite.naturalHeight : 100;
      let yScale = 1 + stride * .035;
      if (f.hp === 0) ctx.rotate(-Math.PI / 2.6);
      else if (f.hitstun) { ctx.rotate(-.20); yScale = .94; }
      else if (f.dash) { ctx.rotate(.20); yScale = .87; }
      else if (f.guarding) yScale = .83;
      else if (active) ctx.rotate(action.pose === 'rise' ? -.14 : .12);
      else if (!f.ground) ctx.rotate(f.vy < 0 ? -.085 : .085);
      ctx.scale(2 - yScale, yScale);
      if (f.protection && state.frame % 6 < 3) ctx.globalAlpha = .64;
      if (sprite?.naturalWidth) {
        ctx.shadowColor = color + 'ca';
        ctx.shadowBlur = 8;
        if (f.hitstun && state.freeze > 0) ctx.filter = 'brightness(1.48)';
        ctx.drawImage(sprite, -width * .51 + (active ? 9 : 0), -height, width, height);
        ctx.filter = 'none';
        ctx.shadowBlur = 0;
      }
      ctx.globalAlpha = 1;
      if (f.guarding) {
        ctx.strokeStyle = '#fff2ab';
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.ellipse(19, -65, 46, 61, 0, -1.40, 1.38);
        ctx.stroke();
      }
      ctx.restore();

      if (active && action) {
        const hit = worldBox(action.hitbox, f.x, f.y, f.facing);
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

      if (f.hp > 0) {
        const above = f.y - height - 32;
        const markerY = above >= 105 ? above : f.y + 10;
        ctx.fillStyle = '#111333';
        ctx.fillRect(f.x - 20, markerY, 40, 23);
        ctx.textAlign = 'center';
        ctx.font = '900 15px system-ui';
        ctx.fillStyle = color;
        ctx.fillText('P' + (seat + 1), f.x, markerY + 16);
      }

      if (debug) {
        const hurt = worldBox(def.hurtbox, f.x, f.y, f.facing);
        ctx.fillStyle = '#27d7ee24';
        ctx.strokeStyle = '#4ce2e8';
        ctx.lineWidth = 2;
        ctx.fillRect(hurt.x, hurt.y, hurt.w, hurt.h);
        ctx.strokeRect(hurt.x, hurt.y, hurt.w, hurt.h);
        ctx.strokeStyle = '#ffc263';
        ctx.strokeRect(f.x - def.bodyWidth / 2, f.y - 82, def.bodyWidth, 82);
        if (active && action) {
          const hit = worldBox(action.hitbox, f.x, f.y, f.facing);
          ctx.fillStyle = '#ff536844';
          ctx.strokeStyle = '#ff5a6e';
          ctx.fillRect(hit.x, hit.y, hit.w, hit.h);
          ctx.strokeRect(hit.x, hit.y, hit.w, hit.h);
        }
      }
    }

    this.drawEffects(elapsed, Boolean(config.training));
    ctx.resetTransform();
    this.shake = Math.max(0, this.shake - elapsed);
  }

  private drawEffects(elapsed: number, training: boolean) {
    const ctx = this.ctx;
    for (const effect of this.effects) {
      const { event, age, life } = effect;
      const color = event.kind === 'block' ? '#84e8ff' : event.kind === 'break' ? '#ff8c88' : '#ffdfa0';
      ctx.save();
      ctx.globalAlpha = Math.min(1, (life - age) / 10);
      ctx.translate(event.x, event.y);
      if (event.kind === 'dash') {
        ctx.fillStyle = seatColors[event.source];
        for (let i = 0; i < 4; i++) ctx.fillRect(-21 + i * 15, -10 - i * 3, i + 5, 2);
      } else if (event.kind === 'land' || event.kind === 'drop') {
        ctx.strokeStyle = '#fbdfb7cf';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(0, event.kind === 'drop' ? age * 1.8 : -1, 9 + age * 2.7, 3 + age * .25, 0, 0, 2 * Math.PI);
        ctx.stroke();
      } else {
        ctx.save();
        ctx.rotate(age * .035);
        const scale = 1 + age * .012;
        ctx.scale(scale, scale);
        polygon(ctx, color, [[0, -39], [7, -11], [34, -18], [15, 0], [34, 18],
          [7, 10], [0, 36], [-8, 10], [-29, 16], [-14, 0], [-30, -19], [-7, -10]]);
        polygon(ctx, '#fff8e2', [[0, -17], [5, -5], [17, 0], [5, 4], [0, 17], [-6, 5], [-17, 0], [-5, -5]]);
        ctx.restore();
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

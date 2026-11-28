import { bananaActionIds as ids } from '../content/fighters/banana.js';
import type { ActionDefinition, ArenaDefinition, CombatEvent, FighterState, MatchState } from '../core/types.js';
import bananaSprites from '../../assets/fighters/banana-arcade-actions.webp';
import bananaJetExpressions from '../../assets/fighters/banana-jet-expressions.webp';
import bananaCombatActions from '../../assets/fighters/banana-combat-actions.webp';
import entranceAtlasSrc from '../../assets/fighters/banana-entrance-scenes.webp';
import victoryAtlasSrc from '../../assets/fighters/banana-victory-scenes.webp';
import kqStandSrc from '../../assets/fighters/banana-stand-killer-queen.png';
import spStandSrc from '../../assets/fighters/banana-stand-star-platinum.png';
import twStandSrc from '../../assets/fighters/banana-stand-the-world.png';
import kqAttackSrc from '../../assets/fighters/banana-killer-queen-attacks.png';
import spAttackSrc from '../../assets/fighters/banana-star-platinum-attacks.png';
import twAttackSrc from '../../assets/fighters/banana-the-world-attacks.png';
import joArcadeSrc from '../../assets/fighters/banana-jo-arcade.webp';
import joCombatSrc from '../../assets/fighters/banana-jo-combat.webp';
import joWalkSrc from '../../assets/fighters/banana-jo-walk.webp';
import { drawCryingTears, drawTearJets } from './banana-fx.js';
import { drawBananaWaveMotion } from './banana-wave-art.js';
import { drawBananaHurt } from './banana-hit-art.js';
import { easeOut, noise } from './cinematics.js';
import { drawSparkle } from './cutin-art.js';
import { drawPixelEffect } from './pixelfx.js';

const atlas = new Image();
atlas.src = bananaSprites;
const jetAtlas = new Image();
jetAtlas.src = bananaJetExpressions;
const combatAtlas = new Image();
combatAtlas.src = bananaCombatActions;
const entranceAtlas = new Image();
entranceAtlas.src = entranceAtlasSrc;
const victoryAtlas = new Image();
victoryAtlas.src = victoryAtlasSrc;
const kqStand = new Image();
kqStand.src = kqStandSrc;
const spStand = new Image();
spStand.src = spStandSrc;
const twStand = new Image();
twStand.src = twStandSrc;
const kqAttackAtlas = new Image();
kqAttackAtlas.src = kqAttackSrc;
const spAttackAtlas = new Image();
spAttackAtlas.src = spAttackSrc;
const twAttackAtlas = new Image();
twAttackAtlas.src = twAttackSrc;
const joArcadeAtlas = new Image();
joArcadeAtlas.src = joArcadeSrc;
const joCombatAtlas = new Image();
joCombatAtlas.src = joCombatSrc;
const joWalkAtlas = new Image();
joWalkAtlas.src = joWalkSrc;

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
  [ids.wave]: 'uppercut',
  [ids.joAwaken]: 'rise',
  [ids.joJab]: 'strike',
  [ids.joCross]: 'strike',
  [ids.joPounce]: 'strike',
  [ids.joUppercut]: 'rise',
  [ids.joOra]: 'strike'
};

const strikeTilt: Partial<Record<string, number>> = {
  [ids.jab]: .04,
  [ids.backhand]: -.05,
  [ids.headbutt]: .08,
  [ids.tear]: .06,
  [ids.joJab]: .05,
  [ids.joCross]: -.06,
  [ids.joPounce]: .1
};

const combatFrames: Partial<Record<string, { windup: number; strike: number; recover?: number }>> = {
  [ids.jab]: { windup: 0, strike: 1 },
  [ids.backhand]: { windup: 2, strike: 3 },
  [ids.headbutt]: { windup: 4, strike: 5, recover: 14 },
  [ids.cry]: { windup: 6, strike: 7, recover: 14 },
  [ids.lift]: { windup: 8, strike: 9, recover: 14 },
  [ids.slide]: { windup: 10, strike: 11, recover: 14 },
  [ids.tear]: { windup: 12, strike: 13 },
  [ids.joAwaken]: { windup: 6, strike: 9, recover: 14 },
  [ids.joJab]: { windup: 0, strike: 1 },
  [ids.joCross]: { windup: 2, strike: 3 },
  [ids.joPounce]: { windup: 4, strike: 5, recover: 14 },
  [ids.joUppercut]: { windup: 8, strike: 9, recover: 14 },
  [ids.joOra]: { windup: 14, strike: 14, recover: 14 }
};

function combatCellFor(f: FighterState, action: ActionDefinition | undefined, frame: number, recovery: number): number | undefined {
  if (!combatAtlas.naturalWidth) return undefined;
  if (f.hp > 0 && f.guarding) return 15;
  if (!action || !f.attack) return undefined;
  if (action.id === ids.joOra) {
    if (frame < 28) return 14;
    if (frame < 36) return 2;
    if (frame < 46) return 3;
    return 14;
  }
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
  if (f.walk && Math.floor(f.walk.distance / 44) % 2 === 1) return 'stride';
  return 'idle';
}

export type BananaStageCue = { kind: 'entrance' | 'victory'; frame: number };
export type StandLinger = { actionId: string; age: number };

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

function drawStandIdle(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, size: number, alpha = .92) {
  if (!img.naturalWidth) return;
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.globalAlpha *= alpha;
  ctx.drawImage(img, x - size * .5, y - size, size, size);
  ctx.restore();
}

function drawStandCell(ctx: CanvasRenderingContext2D, atlasImg: HTMLImageElement, cell: number,
  x: number, y: number, size: number, glowColor: string, glow = true, alpha = 1) {
  if (!atlasImg.naturalWidth) return false;
  const col = cell % 4;
  const row = Math.floor(cell / 4);
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.globalAlpha *= alpha;
  if (glow) {
    ctx.shadowColor = glowColor;
    ctx.shadowBlur = 18;
  }
  ctx.drawImage(atlasImg, col * 96, row * 96, 96, 96, x - size * .5, y - size, size, size);
  ctx.restore();
  return true;
}

function drawSpAttackCell(ctx: CanvasRenderingContext2D, cell: number, x: number, y: number, size: number, glow = true) {
  drawStandCell(ctx, spAttackAtlas, cell, x, y, size, '#d946ef', glow);
}

function drawKillerQueenSkill(ctx: CanvasRenderingContext2D, actionId: string, frame: number,
  facing: -1 | 1, reducedMotion: boolean, alpha: number) {
  const isDetonate = actionId === ids.kqDetonate;
  const startup = isDetonate ? 3 : 5;
  const active = frame >= startup;
  const age = Math.max(0, frame - startup);
  const cell = isDetonate ? (active ? 3 : 2) : (active ? 1 : 0);
  const kqX = isDetonate ? (active ? -106 : -112) : (active ? -104 : -114);
  const kqY = isDetonate ? (active ? -36 : -30) : (active ? -42 : -38);
  const kqSize = isDetonate ? (active ? 206 : 198) : (active ? 204 : 198);
  const glowColor = active ? '#fde047' : '#e879f9';

  ctx.save();
  if (active && age < 5 && !reducedMotion) {
    ctx.save();
    drawStandCell(ctx, kqAttackAtlas, cell, kqX - 10, kqY + 2, kqSize, '#e879f9', false, alpha * .34);
    ctx.restore();
  }
  if (!drawStandCell(ctx, kqAttackAtlas, cell, kqX, kqY, kqSize, glowColor, true, alpha)) {
    drawStandIdle(ctx, kqStand, kqX, kqY, 148, alpha);
  }

  if (!reducedMotion) {
    if (!isDetonate && !active) {
      // Windup charge halo around Killer Queen's coin hand.
      ctx.strokeStyle = '#fde047';
      ctx.lineWidth = 2.8;
      ctx.globalAlpha = alpha * .88;
      ctx.beginPath();
      ctx.arc(-86, -132, 16 - frame * 1.5, 0, Math.PI * 2);
      ctx.stroke();
    } else if (isDetonate && active) {
      // Iconic thumb-down switch click spark + expanding rings clearly above Banana Cat.
      const clickX = -57;
      const clickY = -168;
      ctx.globalAlpha = alpha * Math.max(0, 1 - age / 18);
      ctx.strokeStyle = '#fde047';
      ctx.lineWidth = Math.max(1.5, 3.6 - age * .15);
      ctx.beginPath();
      ctx.arc(clickX, clickY, 11 + age * 4.8, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = '#e879f9';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.arc(clickX, clickY, 6 + age * 3.4, 0, Math.PI * 2);
      ctx.stroke();
      if (age < 7) {
        ctx.fillStyle = '#fffbeb';
        drawSparkle(ctx, clickX, clickY, (1 - age / 7) * 20 + 5);
      }
      ctx.font = '900 18px "Microsoft YaHei", sans-serif';
      ctx.textAlign = 'center';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#1a0428';
      ctx.lineWidth = 5;
      const textY = -196 - Math.min(18, age * 1.2);
      ctx.save();
      ctx.translate(clickX - 16, textY);
      ctx.scale(facing, 1); // Keep text unmirrored when Banana Cat faces left.
      ctx.strokeText('カチッ!!', 0, 0);
      ctx.fillStyle = age < 5 ? '#ffffff' : '#fde047';
      ctx.fillText('カチッ!!', 0, 0);
      ctx.restore();
    }
  }
  ctx.restore();
}

function drawKillerQueenCoinArc(ctx: CanvasRenderingContext2D, frame: number, alpha: number, reducedMotion: boolean) {
  if (reducedMotion || frame < 5 || frame > 15) return;
  const age = frame - 5;
  const fade = Math.max(0, 1 - age / 10) * alpha;
  ctx.save();
  ctx.globalAlpha = fade;
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#e879f9';
  ctx.lineWidth = 6 * fade + 1.5;
  ctx.beginPath();
  ctx.moveTo(-42, -132);
  ctx.quadraticCurveTo(8, -140, 56, -76);
  ctx.stroke();
  ctx.strokeStyle = '#fde047';
  ctx.lineWidth = 3 * fade + 1;
  ctx.stroke();
  if (age < 5) {
    ctx.fillStyle = '#fffbeb';
    drawSparkle(ctx, -40, -132, (1 - age / 5) * 16 + 4);
  }
  ctx.restore();
}

function drawJoStands(ctx: CanvasRenderingContext2D, f: FighterState, action: ActionDefinition | undefined,
  tick: number, reducedMotion: boolean, standLinger?: StandLinger) {
  if (!f.joAwakened) return;
  const frame = f.attack?.frame ?? 0;
  const bob = (phase: number) => reducedMotion ? 0 : Math.sin(tick * .08 + phase) * 5;
  const kqDirect = action?.id === ids.kqBomb || action?.id === ids.kqDetonate;
  const kqSheerHeart = action?.standAttack === 'sheer-heart';
  const kqLinger = !action && (standLinger?.actionId === ids.kqBomb || standLinger?.actionId === ids.kqDetonate)
    ? standLinger : undefined;
  const kqActionId = kqDirect ? action!.id : kqLinger?.actionId;
  const timeStopping = action?.id === ids.theWorld;
  const spDashing = Boolean(f.joAwakened && !action && !f.guarding && (f.dash || f.dashActive));
  const spActive = (Boolean(action?.standAttack) && !kqSheerHeart) || spDashing;
  const idleAlpha = (kqActionId || kqSheerHeart || timeStopping || spActive) ? .36 : .92;

  ctx.save();
  // Subtle menacing JO aura behind Banana Cat.
  ctx.fillStyle = 'rgba(168, 85, 247, 0.16)';
  ctx.beginPath();
  ctx.ellipse(-18, -72, 68, 76, 0, 0, Math.PI * 2);
  ctx.fill();

  // 1. Killer Queen — behind-left during idle, dynamic on I skills or Sheer Heart Attack (U).
  if (kqActionId) {
    const baseLen = kqActionId === ids.kqBomb ? 19 : 16;
    const kqFrame = kqDirect ? frame : baseLen + (kqLinger?.age ?? 0);
    const lingerAlpha = kqLinger ? Math.max(.18, 1 - kqLinger.age / 14) : 1;
    drawKillerQueenSkill(ctx, kqActionId, kqFrame, f.facing, reducedMotion, lingerAlpha);
  } else if (kqSheerHeart) {
    drawStandCell(ctx, kqAttackAtlas, 1, -28, 0, 174, '#fde047');
    if (!reducedMotion && frame >= 3 && frame < 18) {
      ctx.save();
      ctx.translate(44, -142 - (frame - 3));
      ctx.scale(f.facing, 1);
      ctx.font = '900 18px "Microsoft YaHei", sans-serif';
      ctx.textAlign = 'center';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#120722';
      ctx.lineWidth = 5;
      ctx.strokeText('コッチヲ見ロ!!', 0, 0);
      ctx.fillStyle = '#fde047';
      ctx.fillText('コッチヲ見ロ!!', 0, 0);
      ctx.restore();
    }
  } else if (!timeStopping) {
    drawStandIdle(ctx, kqStand, -100, -30 + bob(0), 116, idleAlpha);
  }

  // 2. Star Platinum — floating high behind Banana Cat when idle (yields space when KQ or TW casts behind).
  if (!spActive && !kqActionId && !timeStopping) {
    drawStandIdle(ctx, spStand, -50, -82 + bob(2.1), 118, idleAlpha);
  }

  // 3. The World — upper-front flank when idle; prominent non-overlapping time-stop poses in Acts 1 & 2.
  if (timeStopping) {
    const teleportAt = action?.timeStop?.teleportAt ?? 90;
    const flickAt = action?.timeStop?.flickAt ?? 135;
    if (frame < teleportAt) {
      const pop = reducedMotion ? 1 : Math.min(1, frame / 8);
      const twX = -108;
      const twY = -42;
      const twSize = 194 + pop * 28;
      const clockY = twY - twSize * .54;
      ctx.save();
      if (!reducedMotion) {
        // Giant golden clock dial locking time shut behind The World!
        const lockT = Math.min(1, frame / 18);
        const dialAlpha = Math.min(1, frame / 5) * .88;
        ctx.globalAlpha = dialAlpha;
        ctx.strokeStyle = '#fde047';
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.arc(twX, clockY, 84, 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = '#c084fc';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(twX, clockY, 72, 0, Math.PI * 2);
        ctx.stroke();
        for (let i = 0; i < 12; i++) {
          const a = i * Math.PI / 6;
          ctx.strokeStyle = i % 3 === 0 ? '#fde047' : '#e879f9';
          ctx.lineWidth = i % 3 === 0 ? 3.5 : 2;
          ctx.beginPath();
          ctx.moveTo(twX + Math.cos(a) * 68, clockY + Math.sin(a) * 68);
          ctx.lineTo(twX + Math.cos(a) * 82, clockY + Math.sin(a) * 82);
          ctx.stroke();
        }
        // Clock hands spin swiftly then lock dead at 12:00 (-PI/2) at frame 14!
        const minAngle = -Math.PI * .5 - (1 - lockT) * Math.PI * 3.2;
        const hrAngle = -Math.PI * .5 - (1 - lockT) * Math.PI * .8;
        ctx.strokeStyle = '#fffbeb';
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.moveTo(twX, clockY);
        ctx.lineTo(twX + Math.cos(minAngle) * 62, clockY + Math.sin(minAngle) * 62);
        ctx.stroke();
        ctx.lineWidth = 4.5;
        ctx.beginPath();
        ctx.moveTo(twX, clockY);
        ctx.lineTo(twX + Math.cos(hrAngle) * 42, clockY + Math.sin(hrAngle) * 42);
        ctx.stroke();

        const ringAge = frame % 16;
        ctx.strokeStyle = '#fde047';
        ctx.lineWidth = 3.5;
        ctx.globalAlpha = Math.max(.18, 1 - ringAge / 16);
        ctx.beginPath();
        ctx.arc(twX, clockY, 32 + ringAge * 5.8, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
      if (!drawStandCell(ctx, twAttackAtlas, 0, twX, twY, twSize, '#fde047')) {
        drawStandIdle(ctx, twStand, twX, twY, 176, 1);
      }
    } else if (frame < flickAt) {
      const twX = -118;
      const twY = -32;
      const twSize = 216;
      if (!reducedMotion) {
        const pulse = 1 + Math.sin(frame * .55) * .15;
        ctx.save();
        ctx.strokeStyle = '#fde047';
        ctx.lineWidth = 3.5;
        ctx.globalAlpha = .88;
        ctx.beginPath();
        ctx.arc(twX - 40, twY - 122, 24 * pulse, 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = '#c084fc';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(twX - 40, twY - 122, 36 * (2 - pulse), 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
      if (!drawStandCell(ctx, twAttackAtlas, 1, twX, twY, twSize, '#fde047')) {
        drawStandIdle(ctx, twStand, twX, twY, 168, 1);
      }
    }
    // Frame >= 66: The World rushes the frozen opponent via drawBananaTheWorldStrike!
  } else {
    drawStandIdle(ctx, twStand, 64, -52 + bob(4.2), 116, idleAlpha);
  }

  // Synchronized Stand combos for 1A, 2A, up+J, down+J, W+U anti-air Ora, 4A, dash, and 45° air dive!
  if (spDashing) {
    ctx.save();
    ctx.translate(-34, -10);
    ctx.rotate(.20);
    if (!reducedMotion) {
      ctx.globalAlpha = .24;
      drawSpAttackCell(ctx, 3, -38, 0, 174, false);
      ctx.strokeStyle = '#e879f9';
      ctx.lineWidth = 2.5;
      for (const yLine of [-102, -74, -46]) {
        ctx.beginPath();
        ctx.moveTo(-78, yLine);
        ctx.lineTo(14, yLine);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = .68;
    drawSpAttackCell(ctx, 3, 0, 0, 184);
    ctx.restore();
  } else if (action?.standAttack === 'upper-ora') {
    const active = frame >= action.startup && frame < action.startup + action.active;
    if (frame < action.startup) {
      drawSpAttackCell(ctx, 6, 12, 8, 194);
    } else {
      const age = Math.max(0, frame - action.startup);
      const climbY = active ? -Math.min(110, age * 9) : -24;
      const cell = active ? (age % 4 < 2 ? 2 : 3) : 2;
      if (!reducedMotion && active) {
        // 1. Pixelfx heavy ground blast under launch + cyclone whirlpool wind discs tearing upward!
        drawPixelEffect(ctx, 'heavyLanding', age * 1.4, 42, 4, 1.35, 1.15);
        for (const [discIdx, [dy, scaleW, alpha]] of ([
          [-105 + climbY * .4, 1.55, .62],
          [-215 + climbY * .7, 1.35, .52],
          [-325 + climbY * .9, 1.15, .42]
        ] as const).entries()) {
          ctx.save();
          ctx.globalAlpha = alpha;
          drawPixelEffect(ctx, 'whirlpool', (tick * 1.6 + discIdx * 13) % 45, 56, dy, scaleW, .72);
          ctx.restore();
        }
        // 2. Trailing Star Platinum phantom silhouettes rising behind.
        for (const [gx, gy, alpha] of [[26, 42, .28], [38, 18, .46]] as const) {
          ctx.save();
          ctx.globalAlpha = alpha;
          drawSpAttackCell(ctx, cell === 2 ? 3 : 2, gx, gy + climbY, 198, false);
          ctx.restore();
        }
        // 3. Three vertical Pixelfx hitSpark punch explosions timed cleanly across the upward 3-hit barrage!
        for (const [hitIdx, [startOff, hitY, scale]] of ([
          [0, -175, 1.9],
          [4, -275, 2.1],
          [8, -385, 2.4]
        ] as const).entries()) {
          const hAge = age - startOff;
          if (hAge < 0 || hAge >= 12) continue;
          ctx.save();
          ctx.translate(58 + (hitIdx % 2 ? 12 : -8), hitY);
          ctx.rotate(-Math.PI / 2);
          drawPixelEffect(ctx, 'hitSpark', hAge * 1.3, 0, 0, scale, scale);
          ctx.restore();
        }
        // 4. Upward gale ribbons + JO manga punch callout!
        ctx.save();
        ctx.strokeStyle = '#fde047';
        ctx.lineWidth = 3.5;
        ctx.globalAlpha = .82;
        for (const [xOff, h] of [[12, 220], [56, 290], [96, 230]] as const) {
          ctx.beginPath();
          ctx.moveTo(xOff, climbY + 12);
          ctx.lineTo(xOff - 6, climbY - h);
          ctx.stroke();
        }
        ctx.translate(64, -185 + climbY);
        ctx.scale(f.facing, 1);
        ctx.font = '900 22px "Microsoft YaHei", sans-serif';
        ctx.textAlign = 'center';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = '#120722';
        ctx.lineWidth = 6;
        ctx.strokeText('オラオラオラ!!', 0, 0);
        ctx.fillStyle = age % 4 < 2 ? '#fde047' : '#ffffff';
        ctx.fillText('オラオラオラ!!', 0, 0);
        ctx.restore();
      }
      drawSpAttackCell(ctx, cell, 48, climbY, 212);
    }
  } else if (action?.standAttack === 'slide') {
    const sliding = frame >= action.startup && frame < action.startup + action.active;
    if (!sliding && frame < action.startup) {
      drawSpAttackCell(ctx, 3, -24, 18, 182);
    } else if (sliding) {
      ctx.save();
      ctx.translate(16, 12);
      ctx.rotate(.16);
      const cell = frame % 4 < 2 ? 0 : 7;
      if (!reducedMotion) {
        for (const [gx, alpha] of [[-58, .22], [-26, .42]] as const) {
          ctx.save();
          ctx.globalAlpha = alpha;
          drawSpAttackCell(ctx, cell, gx, 0, 198, false);
          ctx.restore();
        }
        ctx.strokeStyle = '#fde047';
        ctx.lineWidth = 4;
        ctx.globalAlpha = .82;
        ctx.beginPath();
        ctx.ellipse(92, -62, 18, 42, 0, -Math.PI * .45, Math.PI * .45);
        ctx.stroke();
      }
      drawSpAttackCell(ctx, cell, 8, 0, 202);
      ctx.restore();
    } else {
      drawSpAttackCell(ctx, 0, 18, 8, 184);
    }
  } else if (action?.standAttack === 'dive') {
    const diving = frame >= action.startup && frame < action.startup + action.active;
    const recovering = frame >= action.startup + action.active;
    if (recovering) {
      drawSpAttackCell(ctx, 7, 48, 0, 188);
    } else if (!diving) {
      ctx.save();
      ctx.translate(18, -82);
      ctx.rotate(.36);
      ctx.translate(0, 74);
      if (!reducedMotion) {
        ctx.strokeStyle = 'rgba(253, 224, 71, .65)';
        ctx.lineWidth = 2.5;
        ctx.setLineDash([7, 5]);
        ctx.beginPath();
        ctx.moveTo(28, -74);
        ctx.lineTo(148, -74);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      drawSpAttackCell(ctx, 6, 12, 0, 196);
      ctx.restore();
    } else {
      ctx.save();
      ctx.translate(18, -68);
      ctx.rotate(Math.PI / 4);
      ctx.translate(0, 68);
      if (!reducedMotion) {
        for (const [ghostX, alpha] of [[-74, .20], [-38, .38]] as const) {
          ctx.save();
          ctx.globalAlpha = alpha;
          drawSpAttackCell(ctx, 7, 36 + ghostX, -6, 206, false);
          ctx.restore();
        }
        ctx.save();
        ctx.strokeStyle = '#fde047';
        ctx.lineWidth = 4;
        ctx.globalAlpha = .86;
        ctx.beginPath();
        ctx.ellipse(98, -74, 24, 54, 0, -Math.PI * .46, Math.PI * .46);
        ctx.stroke();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 5.5;
        ctx.beginPath();
        ctx.ellipse(116, -74, 18, 42, 0, -Math.PI * .46, Math.PI * .46);
        ctx.stroke();
        ctx.restore();
      }
      drawSpAttackCell(ctx, 7, 38, -6, 210);
      ctx.restore();
    }
  } else if (action?.standAttack && action.standAttack !== 'ora') {
    const cell = action.standAttack === 'jab' ? 0 : action.standAttack === 'hook' ? 1 : 2;
    const active = frame >= action.startup;
    const reachX = action.standAttack === 'jab' ? (active ? 176 : 42)
      : action.standAttack === 'hook' ? (active ? 194 : 46)
      : (active ? 68 : 26);
    const liftY = action.standAttack === 'uppercut' && active ? -34 : 0;
    const spSize = action.standAttack === 'uppercut' ? 192 : 208;
    const impactColor = action.standAttack === 'jab' ? '#d946ef' : '#fde047';

    if (active && action.standAttack !== 'uppercut') {
      // Phantom dash afterimages connecting Banana Cat to Star Platinum at full range.
      for (const [ghostX, alpha] of [[44, .20], [108, .38]] as const) {
        ctx.save();
        ctx.globalAlpha = alpha;
        drawSpAttackCell(ctx, cell, ghostX, -4, spSize, false);
        ctx.restore();
      }
      if (!reducedMotion) {
        ctx.save();
        const age = Math.max(0, frame - action.startup);
        const expand = Math.min(1, age / Math.max(1, action.active - 1));
        const fistTip = reachX + 76;
        // Horizontal sonic wind lines streaming off Star Platinum's fist.
        ctx.strokeStyle = impactColor;
        for (const [yLine, x0, x1, w] of [
          [-98, 28, fistTip + 38, 2.5],
          [-76, 16, fistTip + 68 + expand * 16, 4.5],
          [-54, 28, fistTip + 36, 2.5]
        ] as const) {
          ctx.globalAlpha = .72;
          ctx.lineWidth = w;
          ctx.beginPath();
          ctx.moveTo(x0, yLine);
          ctx.lineTo(x1, yLine);
          ctx.stroke();
        }
        // Expanding elliptical sonic pressure shockwaves (NO chevron arrows!).
        for (const [offset, rx, ry, alpha, lw, color] of [
          [8 + expand * 12, 16 + expand * 8, 42 + expand * 8, .9, 5, '#ffffff'],
          [28 + expand * 22, 22 + expand * 10, 56 + expand * 10, .82, 4, impactColor],
          [52 + expand * 28, 18 + expand * 12, 44 + expand * 12, .65, 3, '#c084fc']
        ] as const) {
          ctx.globalAlpha = alpha;
          ctx.strokeStyle = color;
          ctx.lineWidth = lw;
          ctx.beginPath();
          ctx.ellipse(fistTip + offset, -76, rx, ry, 0, -Math.PI * .48, Math.PI * .48);
          ctx.stroke();
        }
        ctx.restore();
      }
    } else if (active && !reducedMotion) {
      const riseAge = Math.max(0, frame - action.startup);
      for (const [gx, gy, alpha] of [[24, 26, .22], [36, 8, .40]] as const) {
        ctx.save();
        ctx.globalAlpha = alpha;
        drawSpAttackCell(ctx, cell, gx, gy + liftY, spSize * .96, false);
        ctx.restore();
      }
      ctx.save();
      ctx.strokeStyle = '#fde047';
      ctx.lineWidth = 4.5;
      ctx.beginPath();
      ctx.moveTo(22, 6);
      ctx.lineTo(reachX + 26, -184 + liftY);
      ctx.stroke();
      ctx.strokeStyle = '#e879f9';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(reachX + 18, -148 + liftY + (riseAge % 4) * 3, 28, Math.PI * 1.1, Math.PI * 1.9);
      ctx.stroke();
      ctx.restore();
    }
    drawSpAttackCell(ctx, cell, reachX, -4 + liftY, spSize);
  }
  ctx.restore();
}

export function drawBananaTheWorldStrike(
  ctx: CanvasRenderingContext2D,
  caster: FighterState,
  opp: FighterState,
  arena: Pick<ArenaDefinition, 'width' | 'floor'>,
  ts: NonNullable<MatchState['timeStop']>,
  reducedMotion: boolean
) {
  if (ts.frame < ts.flickAt) return;
  const age = ts.frame - ts.flickAt;
  const dir = opp.x === caster.x ? caster.facing : opp.x > caster.x ? 1 : -1;
  const behindOppX = opp.x + dir * 82;
  const canFlankBehind = behindOppX >= 68 && behindOppX <= arena.width - 68;
  const strikeX = canFlankBehind ? behindOppX : caster.x - dir * 108;
  // Ground The World's planted foot cleanly near the surface instead of floating high.
  const strikeY = canFlankBehind ? Math.min(opp.y, arena.floor) + 18 : Math.min(caster.y, arena.floor) - 24;
  const strikeFacing = canFlankBehind ? -dir : dir;
  const barrageEnd = Math.max(20, ts.releaseAt - ts.flickAt - 51);
  const finisherAt = ts.releaseAt - 26;

  if (!reducedMotion && age < 6) {
    const originX = caster.x - dir * 116;
    const originY = Math.min(caster.y, arena.floor) - 32;
    for (const [t, alpha] of [[.35, .24], [.7, .42]] as const) {
      ctx.save();
      ctx.translate(originX + (strikeX - originX) * t, originY + (strikeY - originY) * t);
      ctx.scale(strikeFacing, 1);
      drawStandCell(ctx, twAttackAtlas, 1, 0, 0, 210, '#fde047', false, alpha);
      ctx.restore();
    }
  }

  ctx.save();
  ctx.translate(strikeX, strikeY);
  ctx.scale(strikeFacing, 1);

  if (age < barrageEnd) {
    // Act 3A: High-speed MUDA-MUDA Stand rush with phantom punch gusts smashing straight into the frozen foe!
    const punchStep = Math.floor(age / 2);
    const jx = reducedMotion ? 0 : (punchStep % 2) * 11;
    const jy = reducedMotion ? 0 : ((punchStep % 3) - 1) * 7;
    if (!reducedMotion) {
      for (const [gx, gy, alpha] of [[jx - 16, jy - 10, .28], [jx + 14, jy + 8, .44]] as const) {
        drawStandCell(ctx, twAttackAtlas, 2, gx, gy, 218, '#fde047', false, alpha);
      }
      ctx.strokeStyle = punchStep % 2 === 0 ? '#fde047' : '#e879f9';
      ctx.lineWidth = 3.5;
      for (let i = 0; i < 4; i++) {
        const rx = 56 + ((age * 17 + i * 21) % 52);
        const ry = -138 + ((age * 29 + i * 27) % 62);
        ctx.globalAlpha = .82;
        ctx.beginPath();
        ctx.ellipse(rx, ry, 10, 20, 0, -Math.PI * .45, Math.PI * .45);
        ctx.stroke();
      }
    }
    if (!drawStandCell(ctx, twAttackAtlas, 2, jx + 4, jy, 220, '#fde047')) {
      drawStandIdle(ctx, twStand, jx + 4, jy, 180, 1);
    }
    if (!reducedMotion) {
      ctx.save();
      ctx.scale(strikeFacing, 1);
      ctx.globalAlpha = .95;
      ctx.font = '900 24px "Microsoft YaHei", sans-serif';
      ctx.textAlign = 'center';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#120722';
      ctx.lineWidth = 6;
      const shout = punchStep % 4 < 2 ? '無駄!!' : '無駄ァ!!';
      const bobY = -202 - (age % 6) * 2;
      ctx.strokeText(shout, 0, bobY);
      ctx.fillStyle = punchStep % 2 === 0 ? '#fde047' : '#fffbeb';
      ctx.fillText(shout, 0, bobY);
      ctx.restore();
    }
  } else if (ts.frame < finisherAt) {
    // Act 3B: Dramatic coil-back windup charging golden lightning for the lethal finisher!
    const windT = (ts.frame - (ts.flickAt + barrageEnd)) / Math.max(1, finisherAt - (ts.flickAt + barrageEnd));
    const recoil = -10 - windT * 12;
    if (!reducedMotion) {
      ctx.strokeStyle = '#fde047';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(-44 + recoil, -110, 54 - windT * 34, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = '#c084fc';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(-44 + recoil, -110, 74 - windT * 48, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (!drawStandCell(ctx, twAttackAtlas, 1, recoil, 0, 222, '#fde047')) {
      drawStandIdle(ctx, twStand, recoil, 0, 182, 1);
    }
  } else {
    // Act 3C: Colossal finisher punch -> crushing overhead smash right before time resumes!
    const finAge = ts.frame - finisherAt;
    const cell = finAge < 11 ? 2 : 3;
    const lunge = !reducedMotion ? Math.min(18, finAge * 6) : 0;
    if (!drawStandCell(ctx, twAttackAtlas, cell, lunge, 0, 228, '#fde047')) {
      drawStandIdle(ctx, twStand, lunge, 0, 186, 1);
    }
    if (!reducedMotion) {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = Math.max(2, 7 - finAge * .3);
      ctx.beginPath();
      ctx.ellipse(68 + lunge + finAge * 3, -104, 18 + finAge * 4, 52 + finAge * 3, 0, -Math.PI * .46, Math.PI * .46);
      ctx.stroke();
      ctx.strokeStyle = '#fde047';
      ctx.lineWidth = Math.max(2, 5.5 - finAge * .25);
      ctx.beginPath();
      ctx.ellipse(88 + lunge + finAge * 4, -104, 24 + finAge * 5, 64 + finAge * 3.5, 0, -Math.PI * .46, Math.PI * .46);
      ctx.stroke();
      ctx.save();
      ctx.scale(strikeFacing, 1);
      ctx.font = '900 28px "Microsoft YaHei", sans-serif';
      ctx.textAlign = 'center';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#120722';
      ctx.lineWidth = 7;
      const calloutY = -208 - Math.min(16, finAge * .8);
      ctx.strokeText('無駄ァーッ!!', 0, calloutY);
      ctx.fillStyle = finAge < 5 ? '#ffffff' : '#fde047';
      ctx.fillText('無駄ァーッ!!', 0, calloutY);
      ctx.restore();
    }
  }
  ctx.restore();
}

export function drawBananaWorldStand(ctx: CanvasRenderingContext2D, f: FighterState,
  action: ActionDefinition | undefined, reducedMotion: boolean) {
  if (action?.standAttack !== 'ora' || !f.attack || f.attack.standX === undefined ||
      f.attack.standY === undefined || f.attack.standFacing === undefined) return;
  const frame = f.attack.frame;
  const cell = frame < action.startup ? 3
    : frame < 28 ? (Math.floor((frame - action.startup) / 2) % 2 === 0 ? 4 : 5)
    : frame < 36 ? 6 : 7;
  ctx.save();
  ctx.translate(f.attack.standX, f.attack.standY);
  ctx.scale(f.attack.standFacing, 1);

  if (!reducedMotion && frame < action.startup) {
    // Teleport warp snap-in + purple-gold cross flash.
    const t = frame / Math.max(1, action.startup);
    ctx.fillStyle = `rgba(192, 132, 252, ${0.46 * (1 - t * .5)})`;
    ctx.beginPath();
    ctx.ellipse(0, -82, 66 * (1.2 - t * .3), 90 * (1.2 - t * .3), 0, 0, Math.PI * 2);
    ctx.fill();
    drawSpAttackCell(ctx, cell, 12, 4, 178 + t * 30);
    ctx.restore();
    return;
  }

  if (!reducedMotion && frame >= action.startup && frame < 28) {
    // High-speed Ora barrage: jittering phantom afterimages + forward punch shockwave rings.
    const oraFrame = frame - action.startup;
    const jitterY = (oraFrame % 3 - 1) * 7;
    const jitterX = (oraFrame % 2) * 10;
    ctx.save();
    ctx.globalAlpha = .34;
    drawSpAttackCell(ctx, cell === 4 ? 5 : 4, 22 - jitterX, 4 - jitterY, 212, false);
    ctx.restore();
    ctx.save();
    ctx.strokeStyle = oraFrame % 2 === 0 ? '#e879f9' : '#fde047';
    ctx.lineWidth = 3.5;
    for (let i = 0; i < 3; i++) {
      const rx = 56 + ((oraFrame * 19 + i * 23) % 72);
      const ry = -112 + ((oraFrame * 31 + i * 29) % 68);
      ctx.globalAlpha = .78;
      ctx.beginPath();
      ctx.ellipse(rx, ry, 10, 22, 0, -Math.PI * .45, Math.PI * .45);
      ctx.stroke();
    }
    ctx.restore();
    drawSpAttackCell(ctx, cell, 12 + jitterX * .6, 4 + jitterY * .4, 208);
    ctx.restore();
    return;
  }

  if (!reducedMotion && frame >= 28 && frame < 36) {
    // Charged golden-purple aura & converging lightning before the finisher punch.
    const charge = (frame - 28) / 8;
    const recoil = -charge * 12;
    ctx.strokeStyle = '#fde047';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.arc(-28 + recoil, -80, 48 - charge * 28, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = '#d946ef';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(-28 + recoil, -80, 68 - charge * 42, 0, Math.PI * 2);
    ctx.stroke();
    drawSpAttackCell(ctx, cell, 12 + recoil, 4, 210);
    ctx.restore();
    return;
  }

  if (!reducedMotion && frame >= 36 && frame < 46) {
    // Explosive multi-ring shockwave blast on the megaton finisher punch.
    const age = frame - 36;
    const lunge = Math.min(28, age * 9);
    ctx.save();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = Math.max(2, 8 - age * .6);
    ctx.beginPath();
    ctx.ellipse(72 + lunge + age * 12, -84, 22 + age * 11, 66 + age * 9, 0, -Math.PI * .48, Math.PI * .48);
    ctx.stroke();
    ctx.strokeStyle = '#fde047';
    ctx.lineWidth = Math.max(2, 7 - age * .5);
    ctx.beginPath();
    ctx.ellipse(96 + lunge + age * 16, -84, 26 + age * 13, 76 + age * 11, 0, -Math.PI * .48, Math.PI * .48);
    ctx.stroke();
    ctx.strokeStyle = '#d946ef';
    ctx.lineWidth = Math.max(1.5, 5 - age * .4);
    ctx.beginPath();
    ctx.ellipse(120 + lunge + age * 20, -84, 18 + age * 9, 52 + age * 7, 0, -Math.PI * .48, Math.PI * .48);
    ctx.stroke();
    ctx.restore();
    drawSpAttackCell(ctx, cell, 12 + lunge, 4, 222);
    ctx.restore();
    return;
  }
  drawSpAttackCell(ctx, cell, 12, 4, 208);
  ctx.restore();
}

function drawJoTile(ctx: CanvasRenderingContext2D, sheet: HTMLImageElement, cols: number, index: number,
  yOffset = 0, lean = 0, scaleX = 1, scaleY = 1) {
  const col = index % cols;
  const row = Math.floor(index / cols);
  ctx.save();
  ctx.translate(0, yOffset);
  if (lean) ctx.rotate(lean);
  ctx.scale(scaleX, scaleY);
  ctx.drawImage(sheet, col * tile.width, row * tile.height, tile.width, tile.height,
    -tile.footX * tile.scale, -tile.footY * tile.scale, tile.width * tile.scale, tile.height * tile.scale);
  ctx.restore();
}

let pounceGhostCanvas: HTMLCanvasElement | null = null;
function drawJoTileTinted(ctx: CanvasRenderingContext2D, sheet: HTMLImageElement, cols: number, index: number,
  color: string, yOffset: number, lean: number) {
  const w = Math.ceil(tile.width * tile.scale);
  const h = Math.ceil(tile.height * tile.scale);
  pounceGhostCanvas ??= document.createElement('canvas');
  const layer = pounceGhostCanvas.getContext('2d')!;
  if (pounceGhostCanvas.width !== w || pounceGhostCanvas.height !== h) {
    pounceGhostCanvas.width = w;
    pounceGhostCanvas.height = h;
  } else {
    layer.clearRect(0, 0, w, h);
  }
  const col = index % cols;
  const row = Math.floor(index / cols);
  layer.globalCompositeOperation = 'source-over';
  layer.globalAlpha = 1;
  layer.drawImage(sheet, col * tile.width, row * tile.height, tile.width, tile.height, 0, 0, w, h);
  layer.globalCompositeOperation = 'source-atop';
  layer.globalAlpha = .72;
  layer.fillStyle = color;
  layer.fillRect(0, 0, w, h);
  layer.globalAlpha = 1;
  ctx.save();
  ctx.translate(0, yOffset);
  if (lean) ctx.rotate(lean);
  ctx.drawImage(pounceGhostCanvas, -tile.footX * tile.scale, -tile.footY * tile.scale, w, h);
  ctx.restore();
}

function drawJoPounceMomentum(ctx: CanvasRenderingContext2D, sheet: HTMLImageElement, cols: number, cell: number,
  yOffset: number, lean: number, frame: number) {
  // Trailing purple-gold silhouette afterimages & kinetic dash lines behind 3A pounce.
  for (const [offsetX, offsetY, alpha, color] of [
    [-112, 8, .15, '#7e22ce'],
    [-82, 5, .26, '#a855f7'],
    [-54, 2, .38, '#d946ef'],
    [-26, 0, .52, '#fde047']
  ] as const) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(offsetX, offsetY);
    drawJoTileTinted(ctx, sheet, cols, cell, color, yOffset, lean);
    ctx.restore();
  }
  ctx.save();
  if (lean) {
    ctx.translate(0, -68);
    ctx.rotate(lean);
    ctx.translate(0, 68);
  }
  ctx.lineCap = 'round';
  for (let i = 0; i < 6; i++) {
    const sy = -114 + i * 18;
    const wave = (frame * 17 + i * 29) % 46;
    ctx.strokeStyle = i % 2 === 0 ? '#fde047' : '#e879f9';
    ctx.globalAlpha = .72 - i * .06;
    ctx.lineWidth = i === 2 || i === 3 ? 4 : 2.5;
    ctx.beginPath();
    ctx.moveTo(28 - wave * .25, sy);
    ctx.lineTo(-125 - wave * .7, sy + (i - 2.5) * 2.5);
    ctx.stroke();
  }
  // Forward prow dash arc showing fierce forward momentum.
  ctx.strokeStyle = '#fef08a';
  ctx.globalAlpha = .82;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.ellipse(26, -68 + yOffset, 34, 48, 0, -Math.PI * .42, Math.PI * .42);
  ctx.stroke();
  ctx.restore();
}

function drawJoVerticalMomentum(ctx: CanvasRenderingContext2D, sheet: HTMLImageElement, cols: number, cell: number,
  yOffset: number, lean: number, frame: number) {
  for (const [offsetX, offsetY, alpha, color] of [
    [-22, 54, .18, '#7e22ce'],
    [-14, 34, .32, '#d946ef'],
    [-7, 16, .48, '#fde047']
  ] as const) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(offsetX, offsetY);
    drawJoTileTinted(ctx, sheet, cols, cell, color, yOffset, lean);
    ctx.restore();
  }
  ctx.save();
  ctx.lineCap = 'round';
  for (let i = 0; i < 5; i++) {
    const sx = -26 + i * 14;
    const wave = (frame * 15 + i * 19) % 34;
    ctx.strokeStyle = i % 2 === 0 ? '#fde047' : '#e879f9';
    ctx.globalAlpha = .78 - i * .08;
    ctx.lineWidth = i === 2 ? 4 : 2.5;
    ctx.beginPath();
    ctx.moveTo(sx, -138 + wave * .3);
    ctx.lineTo(sx - 10, 20 + wave * .6);
    ctx.stroke();
  }
  ctx.restore();
}

export function drawBananaJoDashTrail(ctx: CanvasRenderingContext2D, event: CombatEvent, age: number, life: number,
  reducedMotion: boolean) {
  if (!joArcadeAtlas.naturalWidth || reducedMotion) return;
  const dir = event.direction ?? event.facing ?? 1;
  const fade = Math.max(0, 1 - age / life);
  ctx.save();
  ctx.scale(dir, 1);
  // Start-of-dash wind-burst ring & speed streaks anchored at launch origin.
  ctx.strokeStyle = '#e879f9';
  ctx.lineWidth = Math.max(2, 5 * fade);
  ctx.globalAlpha = fade * .92;
  ctx.beginPath();
  ctx.ellipse(8 + age * 2, -64, 16 + age * 2.4, 50 - age * 1.1, 0, -Math.PI * .48, Math.PI * .48);
  ctx.stroke();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = Math.max(1.5, 3.5 * fade);
  ctx.beginPath();
  ctx.ellipse(36 + age * 3, -64, 14 + age * 2, 42 - age * .9, 0, -Math.PI * .46, Math.PI * .46);
  ctx.stroke();
  ctx.lineCap = 'round';
  for (let i = 0; i < 7; i++) {
    const sy = -112 + i * 16;
    ctx.strokeStyle = i % 2 === 0 ? '#fde047' : '#e879f9';
    ctx.globalAlpha = fade * (.88 - i * .05);
    ctx.lineWidth = i === 3 || i === 4 ? 4.5 : 2.8;
    ctx.beginPath();
    ctx.moveTo(-24 + i * 8, sy);
    ctx.lineTo(156 + age * 6 - i * 8, sy);
    ctx.stroke();
  }
  // Vivid staggered world-space afterimages along the dash trajectory!
  for (const [stepIdx, [dist, color]] of ([
    [0, '#7e22ce'],
    [62, '#d946ef'],
    [124, '#fde047']
  ] as const).entries()) {
    if (age < stepIdx * 1.6) continue;
    const ghostFade = Math.max(0, 1 - (age - stepIdx * 1.6) / Math.max(1, life - stepIdx * 1.6));
    ctx.save();
    ctx.globalAlpha = ghostFade * (.56 + stepIdx * .12);
    ctx.translate(dist, 0);
    drawJoTileTinted(ctx, joArcadeAtlas, 3, 1, color, -6, .26);
    ctx.restore();
  }
  ctx.restore();
}

function drawJoMenacingAura(ctx: CanvasRenderingContext2D, tick: number, reducedMotion: boolean) {
  if (reducedMotion) return;
  ctx.save();
  ctx.font = '900 17px "Microsoft YaHei", sans-serif';
  ctx.textAlign = 'center';
  ctx.lineWidth = 3.5;
  ctx.strokeStyle = '#1a0533';
  ctx.fillStyle = '#e879f9';
  for (let i = 0; i < 3; i++) {
    const cycle = ((tick + i * 24) % 72) / 72;
    const x = [-44, 38, -28][i] + Math.sin(tick * .08 + i) * 4;
    const y = -36 - cycle * 92 - i * 14;
    ctx.globalAlpha = Math.sin(cycle * Math.PI) * .9;
    ctx.strokeText('ゴ', x, y);
    ctx.fillText('ゴ', x, y);
  }
  ctx.restore();
}

function drawJoAwakenedBody(ctx: CanvasRenderingContext2D, f: FighterState, action: ActionDefinition | undefined,
  tick: number, reducedMotion: boolean) {
  if (!joArcadeAtlas.naturalWidth || !joCombatAtlas.naturalWidth) return false;
  const frame = f.attack?.frame ?? 0;
  const recovery = action ? frame - action.startup - action.active : 0;
  const active = Boolean(action && frame >= action.startup && recovery < 0);
  const spraying = action?.id === ids.pressure || action?.id === ids.uppercut;
  const releasing = spraying && recovery >= 0 && recovery < 7;

  // Choose JO sheet & cell for every possible state/action.
  let sheet = joArcadeAtlas;
  let cols = 3;
  let cell = 0;
  let lean = 0;
  let yOffset = 0;

  if (f.hp > 0 && f.guarding) {
    sheet = joCombatAtlas; cols = 4; cell = 6;
  } else if (action && f.attack) {
    if (action.id === ids.joJab || action.id === ids.jab) {
      if (frame < action.startup) { sheet = joCombatAtlas; cols = 4; cell = 0; }
      else { sheet = joArcadeAtlas; cols = 3; cell = 3; lean = .04; }
    } else if (action.id === ids.joCross || action.id === ids.joSlide || action.id === ids.backhand) {
      if (frame < action.startup) { sheet = joCombatAtlas; cols = 4; cell = 0; }
      else { sheet = joCombatAtlas; cols = 4; cell = 1; }
    } else if (action.id === ids.joPounce || action.id === ids.headbutt) {
      if (frame < action.startup) { sheet = joArcadeAtlas; cols = 3; cell = 5; }
      else if (recovery < action.recovery * .65) {
        sheet = joCombatAtlas; cols = 4; cell = 2;
        yOffset = -12;
        lean = action.id === ids.joPounce ? .20 : .08;
      } else { sheet = joArcadeAtlas; cols = 3; cell = 0; }
    } else if (action.id === ids.joUppercut || action.id === ids.lift || action.id === ids.joLift) {
      if (frame < action.startup) { sheet = joArcadeAtlas; cols = 3; cell = 5; }
      else if (recovery < action.recovery * .65) { sheet = joArcadeAtlas; cols = 3; cell = 4; yOffset = active ? -12 : 0; }
      else { sheet = joArcadeAtlas; cols = 3; cell = 0; }
    } else if (action.id === ids.joOra) {
      if (frame < 28) { sheet = joCombatAtlas; cols = 4; cell = 4; }
      else if (frame < 36) { sheet = joCombatAtlas; cols = 4; cell = 0; lean = -.05; }
      else if (frame < 46) { sheet = joCombatAtlas; cols = 4; cell = 5; lean = .05; }
      else { sheet = joArcadeAtlas; cols = 3; cell = 0; }
    } else if (action.id === ids.slide) {
      if (frame < action.startup) { sheet = joArcadeAtlas; cols = 3; cell = 5; }
      else if (recovery < action.recovery * .65) { sheet = joCombatAtlas; cols = 4; cell = 3; }
      else { sheet = joArcadeAtlas; cols = 3; cell = 0; }
    } else if (action.id === ids.uppercut) {
      sheet = joArcadeAtlas; cols = 3; cell = frame < action.startup ? 5 : 4;
    } else if (action.id === ids.joAntiAir) {
      sheet = joArcadeAtlas; cols = 3; cell = frame < action.startup ? 5 : 4; yOffset = active ? -8 : 0;
    } else if (action.id === ids.joSheerHeart) {
      sheet = joCombatAtlas; cols = 4; cell = frame < action.startup ? 0 : 4; lean = .03;
    } else if (action.id === ids.pressure || action.id === ids.recharge || action.id === ids.cry) {
      sheet = joArcadeAtlas; cols = 3; cell = frame < action.startup ? 5 : 2;
    } else if (action.id === ids.joAirDive) {
      if (frame < action.startup) { sheet = joArcadeAtlas; cols = 3; cell = 5; lean = .28; }
      else if (active) { sheet = joCombatAtlas; cols = 4; cell = 2; yOffset = -14; lean = Math.PI / 4; }
      else { sheet = joArcadeAtlas; cols = 3; cell = 5; }
    } else if (action.id === ids.kqBomb || action.id === ids.kqDetonate) {
      sheet = joCombatAtlas; cols = 4; cell = 4; lean = action.id === ids.kqDetonate ? -.04 : .02;
    } else if (action.id === ids.theWorld) {
      const { teleportAt, flickAt, releaseAt } = action.timeStop ?? { teleportAt: 90, flickAt: 135, releaseAt: 246 };
      const windupAt = flickAt + Math.max(20, releaseAt - flickAt - 51);
      const finisherAt = releaseAt - 26;
      if (frame < Math.round(teleportAt * .45)) { sheet = joCombatAtlas; cols = 4; cell = 6; }
      else if (frame < flickAt - 12) { sheet = joCombatAtlas; cols = 4; cell = 4; lean = -.03; }
      else if (frame < flickAt) { sheet = joCombatAtlas; cols = 4; cell = 0; lean = -.05; }
      else if (frame < windupAt) { sheet = joCombatAtlas; cols = 4; cell = 4; lean = -.04; }
      else if (frame < finisherAt) { sheet = joCombatAtlas; cols = 4; cell = 0; lean = -.06; }
      else { sheet = joCombatAtlas; cols = 4; cell = 5; lean = .06; }
    } else if (action.id === ids.tear) {
      if (frame < action.startup) { sheet = joCombatAtlas; cols = 4; cell = 0; }
      else { sheet = joArcadeAtlas; cols = 3; cell = 3; }
    } else {
      sheet = joArcadeAtlas; cols = 3; cell = active ? 4 : 2;
    }
  } else if (f.dash || f.dashActive || !f.ground) {
    const dashing = Boolean(f.dash || f.dashActive);
    sheet = joArcadeAtlas; cols = 3; cell = 1;
    lean = dashing ? .26 : 0;
    yOffset = dashing ? -6 : 0;
  } else if (f.walk && joWalkAtlas.naturalWidth) {
    // Natural ~0.7s 12-frame walk cycle (~3.5 ticks per frame at run speed 8).
    sheet = joWalkAtlas; cols = 4;
    const stepIdx = Math.floor(f.walk.distance / 28) % 12;
    cell = f.walk.direction === 'back' ? (11 - stepIdx) : stepIdx;
  } else if (f.walk) {
    sheet = joArcadeAtlas; cols = 3; cell = 1;
    yOffset = -Math.abs(Math.sin(f.walk.distance / 28)) * 5;
    lean = Math.sin(f.walk.distance / 28) * .045;
  } else {
    sheet = joArcadeAtlas; cols = 3; cell = 0;
  }

  const breath = reducedMotion || f.attack || f.guarding ? 0 : Math.sin(tick * .12) * .018;
  ctx.save();
  ctx.shadowBlur = 0;
  if (action?.id === ids.slide && active) {
    ctx.fillStyle = '#c084fc99';
    ctx.beginPath();
    ctx.ellipse(-24, -2, 82, 5, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  if (!reducedMotion && action?.id === ids.joLift && active) {
    drawJoVerticalMomentum(ctx, sheet, cols, cell, yOffset, lean, frame);
  }
  if (!reducedMotion && (((action?.id === ids.joPounce && frame >= action.startup - 1 &&
      frame < action.startup + action.active + 5) ||
      (action?.id === ids.joSlide && active) ||
      (action?.id === ids.joAirDive && active)) ||
      (!action && (f.dash || f.dashActive)))) {
    drawJoPounceMomentum(ctx, sheet, cols, cell, yOffset, lean, action ? frame : tick);
  }
  drawJoTile(ctx, sheet, cols, cell, yOffset, lean, 1 - breath * .5, 1 + breath);

  // JO Stand-energy effects for U / up+U / I / Ora charge.
  if ((spraying || action?.id === ids.recharge) && (active || releasing || action?.id === ids.recharge)) {
    const sprayAge = frame - action.startup + (f.attack?.sustainedFrames ?? 0);
    if (spraying) {
      drawTearJets(ctx, [{ x: 18, y: -88 }, { x: 44, y: -88 }], action.hitbox,
        action.id === ids.uppercut, sprayAge, releasing ? recovery + 1 : 0, reducedMotion ? 0 : tick);
    } else {
      ctx.strokeStyle = '#d946ef';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(0, -68, 42 + (tick % 12) * 3, 62 + (tick % 12) * 2, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  drawJoMenacingAura(ctx, tick, reducedMotion);
  ctx.restore();
  return true;
}

export async function prepareBananaArt() {
  await Promise.all([atlas, combatAtlas, entranceAtlas].map(image => {
    image.fetchPriority = 'high';
    return image.decode();
  }));
}

export function drawBanana(ctx: CanvasRenderingContext2D, f: FighterState,
  action: ActionDefinition | undefined, tick: number, reducedMotion = false, stageCue?: BananaStageCue,
  standLinger?: StandLinger) {
  if (!atlas.naturalWidth) return;
  if (stageCue && !reducedMotion) {
    if (stageCue.kind === 'entrance') drawStageEntrance(ctx, f, stageCue.frame);
    else drawStageVictory(ctx, f, stageCue.frame);
    return;
  }
  drawJoStands(ctx, f, action, tick, reducedMotion, standLinger);
  if (!action && drawBananaHurt(ctx, f, reducedMotion)) return;
  if (f.joAwakened && drawJoAwakenedBody(ctx, f, action, tick, reducedMotion)) {
    const kqCoinFrame = action?.id === ids.kqBomb ? (f.attack?.frame ?? 0)
      : !action && standLinger?.actionId === ids.kqBomb ? 19 + standLinger.age : -1;
    if (kqCoinFrame >= 5) {
      const alpha = !action && standLinger ? Math.max(.18, 1 - standLinger.age / 14) : 1;
      drawKillerQueenCoinArc(ctx, kqCoinFrame, alpha, reducedMotion);
    }
    return;
  }
  const frame = f.attack?.frame ?? 0;
  if (action?.id === ids.wave &&
    drawBananaWaveMotion(ctx, frame, action.startup, action.cutIn?.at ?? 8, reducedMotion)) return;
  const recovery = action ? frame - action.startup - action.active : 0;
  const active = Boolean(action && frame >= action.startup && recovery < 0);
  const combatCell = combatCellFor(f, action, frame, recovery);
  if (combatCell !== undefined) {
    const slide = action?.id === ids.slide && active;
    const tilt = active && action ? strikeTilt[action.id] ?? 0 : 0;
    const bounce = active && (action?.id === ids.headbutt || action?.id === ids.joPounce) ? -8 : 0;
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

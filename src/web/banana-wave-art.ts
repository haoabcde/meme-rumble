import { bananaWaveTitle } from '../content/fighters/banana.js';
import type { CutIn } from '../core/types.js';
import sprites from '../../assets/fighters/banana-wave-actions.webp';
import expressions from '../../assets/fighters/banana-wave-expressions.webp';
import ukiyoeArt from '../../assets/fighters/banana-wave-ukiyoe.webp';
import joCutInArt from '../../assets/fighters/banana-jo-cutin.webp';
import { easeIn, easeOut, easeOutBack, fadeSince, noise } from './cinematics.js';
import { drawFocusLines, drawPoseFlash, drawSparkle } from './cutin-art.js';
import { drawPixelEffect } from './pixelfx.js';

const sheet = new Image();
sheet.src = sprites;
const portraits = new Image();
portraits.src = expressions;
const ukiyoe = new Image();
ukiyoe.src = ukiyoeArt;
const joCutIn = new Image();
joCutIn.src = joCutInArt;

const tile = { w: 384, h: 352, x: 176, y: 334, scale: .5 };
const hands = [[26, -40], [14, -11], [11, -43], [50, -85], [83, -63], [12, -20]] as const;
const portraitTile = { w: 544, h: 576 };
const portraitsAt = [
  { x: 90, y: 73, zoom: 1.02, hands: [319, 470], eyes: [[285, 363], [424, 363]] },
  { x: 78, y: 58, zoom: 1.07, hands: [345, 512], eyes: [[287, 377], [430, 378]] },
  { x: 72, y: 30, zoom: 1.14, hands: [378, 422], eyes: [[224, 275], [373, 238]] }
] as const;

function drawKeyframe(ctx: CanvasRenderingContext2D, pose: number) {
  const column = pose % 3;
  const row = Math.floor(pose / 3);
  ctx.drawImage(sheet, column * tile.w, row * tile.h, tile.w, tile.h,
    -tile.x * tile.scale, -tile.y * tile.scale, tile.w * tile.scale, tile.h * tile.scale);
}

function drawGatheringWater(ctx: CanvasRenderingContext2D, anchor: readonly [number, number], tick: number, amount: number) {
  if (amount <= 0) return;
  const [x, y] = anchor;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(amount, amount);
  const water = ctx.createRadialGradient(-4, -5, 2, 0, 0, 19);
  water.addColorStop(0, '#e4faffc8');
  water.addColorStop(.55, '#60d5f8df');
  water.addColorStop(1, '#237cd692');
  ctx.beginPath();
  ctx.ellipse(0, 0, 18, 14, -.18, 0, Math.PI * 2);
  ctx.fillStyle = water;
  ctx.fill();
  const ring = tick * .27;
  ctx.strokeStyle = '#9aefff';
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  for (let i = 0; i < 3; i++) {
    const angle = ring + i * 2.09;
    ctx.beginPath();
    ctx.ellipse(0, 0, 27 + i * 2.5, 12 + i * 3, -.2, angle, angle + .94);
    ctx.stroke();
  }
  ctx.fillStyle = '#e0fcff';
  for (let i = 0; i < 9; i++) {
    const angle = ring - i * .78;
    const radius = 23 + i % 3 * 7;
    ctx.beginPath();
    ctx.ellipse(Math.cos(angle) * radius, Math.sin(angle) * radius * .60,
      1.6 + i % 3 * .48, 1.1 + i % 3 * .36, angle, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

export function drawBananaWaveMotion(ctx: CanvasRenderingContext2D, frame: number, startup: number,
  cutInFrame: number, reducedMotion: boolean) {
  if (!sheet.naturalWidth) return false;
  const age = frame - startup;
  const pose = age >= 15 ? 0 : age >= 4 ? 5 : age >= 0 ? 4
    : frame >= cutInFrame ? 3 : frame >= 4 ? 1 : 0;
  ctx.save();
  ctx.shadowBlur = 0;
  // Ease a few pixels of follow-through inside each authored ground pose.
  const recoil = reducedMotion ? 0 : age >= 0 ? Math.max(0, 1 - age / 12) : 0;
  ctx.translate(recoil * 6, 0);
  if (pose === 1 && !reducedMotion) {
    const dip = Math.max(0, Math.min(1, (frame - 4) / (cutInFrame - 4)));
    ctx.scale(1 + .04 * dip, 1 - .07 * dip);
  }
  if (frame >= 4 && age < 0) {
    const swell = Math.min(1, (frame - 3) / 14);
    ctx.save();
    ctx.globalAlpha = .82 * swell;
    drawPixelEffect(ctx, 'whirlpool', reducedMotion ? 4 : frame * 1.35, 26, -4, .7 + swell * 1.35, .32 + swell * .52);
    if (!reducedMotion) {
      // Expanding ground pressure rings + swirling rising water ribbons.
      for (let r = 0; r < 2; r++) {
        const t = ((frame * .08 + r * .5) % 1);
        ctx.globalAlpha = (1 - t) * .65 * swell;
        ctx.strokeStyle = r === 0 ? '#bff6ff' : '#45c8f5';
        ctx.lineWidth = 3 * (1 - t) + 1;
        ctx.beginPath();
        ctx.ellipse(12, -2, 34 + t * 96, 9 + t * 24, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      for (let i = 0; i < 10; i++) {
        const rise = ((frame * 3.8 + i * 9) % 44) / 44;
        const x = Math.sin(frame * .28 + i * 1.4) * (24 + (1 - rise) * 26);
        const y = -6 - rise * 128;
        ctx.globalAlpha = (1 - rise) * .85 * swell;
        ctx.fillStyle = i % 2 ? '#e3fcff' : '#6be3ff';
        ctx.fillRect(x, y, 3, 18 + (i % 3) * 9);
      }
    }
    ctx.restore();
  }
  drawKeyframe(ctx, pose);
  if (frame >= 4 && age < 0) {
    const amount = Math.min(1, (frame - 2) / 14);
    drawGatheringWater(ctx, hands[pose], reducedMotion ? 0 : frame, amount * 1.25);
  } else if (age >= 0 && age < 14) {
    const fade = 1 - age / 14;
    ctx.save();
    ctx.globalAlpha = fade;
    ctx.strokeStyle = '#9ef3ff';
    ctx.lineWidth = 7 * fade + 1.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(46, -58);
    ctx.quadraticCurveTo(96 + age * 10, -112, 152 + age * 18, -12);
    ctx.stroke();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3.5 * fade;
    ctx.beginPath();
    ctx.moveTo(38, -32);
    ctx.quadraticCurveTo(84 + age * 8, -74, 128 + age * 14, -4);
    ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
  return true;
}

export function drawBananaWaveCutIn(ctx: CanvasRenderingContext2D, cutIn: CutIn, reducedMotion: boolean) {
  const { width, height } = ctx.canvas;
  const frame = cutIn.frame;
  const duration = cutIn.duration;
  const phase = frame / duration;
  const chargeAt = Math.round(duration * .22);
  const climaxAt = Math.round(duration * .48);
  const scoop = frame < chargeAt;
  const climax = frame >= climaxAt;
  const expression = scoop ? 0 : 1;
  const shot = portraitsAt[expression];
  const live = reducedMotion ? 0 : 1;
  const travel = live * Math.min(1, phase * 2);
  const quiver = (4 * fadeSince(frame, chargeAt, 5) + 9 * fadeSince(frame, climaxAt, 11)) * live;
  const curtain = 1 - easeOut(frame / 5) * live;

  ctx.resetTransform();
  ctx.save();
  ctx.scale(width / 1280, height / 720);

  if (climax && ukiyoe.naturalWidth) {
    // Climax: dynamic layered Ukiyo-e "Great Wave of Tears" with snap-in zoom, live tear torrents,
    // crashing pixel surf, and scrolling foreground wave foam.
    const age = frame - climaxAt;
    const snap = easeOut(Math.min(1, age / 7));
    const zoom = (1.18 - .13 * snap + age * .002) * (live ? 1 : 0) || 1;
    const tilt = (1 - snap) * -.035 * live;
    ctx.save();
    ctx.translate(640 + Math.sin(frame * 9.5) * quiver, 360 + Math.cos(frame * 7.9) * quiver);
    ctx.rotate(tilt);
    ctx.scale(zoom, zoom);
    ctx.drawImage(ukiyoe, -640, -360, 1280, 720);

    // Live animated twin tear torrents overlaid on the cat's eyes so the water visibly gushes out.
    if (!reducedMotion) {
      for (const [side, ox, oy, tx, ty] of [
        [-1, -305, -92, -520, 145],
        [1, -185, -96, 120, 130]
      ] as const) {
        const pulse = Math.sin(frame * .85 + side) * 6;
        ctx.save();
        ctx.globalAlpha = .72;
        ctx.strokeStyle = '#9ef4ff';
        ctx.lineWidth = 14 + Math.sin(frame * .7) * 3;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(ox, oy);
        ctx.quadraticCurveTo(ox + side * 120, oy - 35 + pulse, tx, ty);
        ctx.stroke();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 5;
        ctx.setLineDash([28, 18]);
        ctx.lineDashOffset = -frame * 18;
        ctx.stroke();
        ctx.restore();
      }
    }
    ctx.restore();

    // Crashing pixel surf & surging foreground ocean foam sweeping across the bottom.
    ctx.save();
    ctx.globalAlpha = .92;
    drawPixelEffect(ctx, 'waveCrash', 8 + age * 1.45, 920, 560, 4.8, 5.4);
    ctx.restore();
    if (!reducedMotion) {
      const surge = (age * 28) % 420;
      ctx.save();
      ctx.fillStyle = '#1b72b8cc';
      ctx.beginPath();
      ctx.moveTo(0, 720);
      for (let x = -420; x <= 1700; x += 210) {
        const wx = x + surge;
        const crest = 615 + Math.sin(x * .02 + age * .25) * 18;
        ctx.quadraticCurveTo(wx + 105, crest - 55, wx + 210, crest);
      }
      ctx.lineTo(1280, 720);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#e3fcff';
      ctx.lineWidth = 8;
      ctx.stroke();
      ctx.restore();
    }
    drawFocusLines(ctx, 410, 320, (1 - Math.min(1, age / 24)) * .95 * live, 77, 1);
  } else {
    // Build-up: Banana Cat close-up trembling & welling up with tears before unleashing the wave.
    ctx.fillStyle = '#0d142c';
    ctx.fillRect(0, 0, 1280, 720);
    ctx.fillStyle = '#1b355e';
    ctx.fillRect(0, 46, 1280, 630);
    ctx.save();
    ctx.globalAlpha = .45;
    for (let i = 0; i < 8; i++) {
      const x = i * 190 + (reducedMotion ? 0 : frame * 8) % 190 - 560;
      ctx.fillStyle = i % 2 ? '#31b9cf' : '#356ea6';
      ctx.fill(new Path2D(`M${x} 635 L${x + 620} 45 H${x + 675 + (i % 3) * 25} L${x + 62} 635Z`));
    }
    ctx.restore();

    const swell = 100 + 380 * phase;
    ctx.fillStyle = '#319bc8';
    ctx.fill(new Path2D(`M0 652 C412 689 609 ${627 - swell * .56} 814 ${633 - swell} C975 ${618 - swell * 1.1} 1151 ${688 - swell * .49} 1280 ${514 - swell * .62} V720 H0Z`));
    ctx.fillStyle = '#a9f1f7';
    ctx.fill(new Path2D(`M0 677 C375 690 572 ${662 - swell * .44} 828 ${624 - swell} C1002 ${617 - swell * .87} 1124 ${700 - swell * .48} 1280 ${541 - swell * .64} C1127 ${708 - swell * .30} 989 ${640 - swell * .60} 830 ${677 - swell * .75} C634 533 385 714 0 705Z`));

    drawFocusLines(ctx, 420, 360, fadeSince(frame, chargeAt, 7) * .55 * live, 77, 1);

    ctx.save();
    ctx.translate(Math.sin(frame * 9.5) * quiver, Math.cos(frame * 7.9) * quiver);
    ctx.save();
    ctx.globalAlpha = .64;
    drawPixelEffect(ctx, 'whirlpool', reducedMotion ? 8 : (frame * 1.35) % 45, 845, 475,
      5.3 + phase * 2, 2.7 + phase * 2);
    ctx.restore();
    if (portraits.naturalWidth) {
      ctx.save();
      const rush = frame < 6 ? (1 - easeOutBack(frame / 6)) * live : 0;
      ctx.translate(shot.x + travel * 13 - rush * 140, shot.y + rush * 90);
      ctx.scale(shot.zoom + travel * .035, shot.zoom + travel * .035);
      const region = [expression * portraitTile.w, 0, portraitTile.w, portraitTile.h] as const;
      if (!scoop && frame - chargeAt < 2 && live) {
        drawPoseFlash(ctx, portraits, region, 0, 0, portraitTile.w, portraitTile.h, '#e6fbff');
      } else {
        ctx.drawImage(portraits, ...region, 0, 0, portraitTile.w, portraitTile.h);
      }
      for (const [i, [x, y]] of shot.eyes.entries()) {
        const side = i ? 1 : -1;
        const run = 20 + phase * 34;
        ctx.strokeStyle = '#8eeeff';
        ctx.lineWidth = 3.5 + phase * 4.5;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.quadraticCurveTo(x + side * run * .65, y + 7, x + side * run, y + run * .82);
        ctx.stroke();
      }
      drawGatheringWater(ctx, shot.hands, reducedMotion ? 0 : frame, scoop ? 1.0 : 1.6 + phase);
      ctx.restore();
    }
    ctx.restore();
  }

  // Spraying droplets & sparkles during the Ukiyo-e climax.
  if (climax && !reducedMotion) {
    const age = frame - climaxAt;
    ctx.save();
    for (let i = 0; i < 16; i++) {
      const t = (age + i * 2) / 22;
      const angle = -Math.PI * .65 + noise(i + 11) * Math.PI * 1.1;
      const dist = (140 + t * (280 + noise(i + 17) * 240));
      const sx = 460 + Math.cos(angle) * dist;
      const sy = 360 + Math.sin(angle) * dist * .7;
      ctx.globalAlpha = Math.max(0, 1 - t * .85) * .85;
      ctx.fillStyle = i % 3 ? '#c8f8ff' : '#ffffff';
      drawSparkle(ctx, sx, sy, 8 + noise(i + 29) * 12);
    }
    ctx.restore();
  }

  // Impact flash when switching expressions or slamming into the Ukiyo-e climax.
  ctx.fillStyle = '#e8fbff';
  ctx.globalAlpha = Math.min(1, .55 * fadeSince(frame, chargeAt, 3) + .85 * fadeSince(frame, climaxAt, 5)) * live;
  ctx.fillRect(0, 0, 1280, 720);
  ctx.globalAlpha = 1;

  if (!scoop) {
    const bannerAge = frame - chargeAt;
    const punch = live ? easeOutBack(Math.min(1, bannerAge / 7)) : 1;
    const liftPop = climax ? 1 + .14 * fadeSince(frame, climaxAt, 7) * live : 1;
    ctx.save();
    ctx.translate(1214, 515);
    ctx.scale(punch * liftPop, punch * liftPop);
    ctx.translate(-1214, -515);
    ctx.fillStyle = '#172746dd';
    ctx.fill(new Path2D('M650 402 L1280 329 V588 L691 650Z'));
    ctx.textAlign = 'right';
    ctx.font = '900 99px "Microsoft YaHei", sans-serif';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 16;
    ctx.strokeStyle = '#172746';
    ctx.strokeText(bananaWaveTitle, 1214, 541);
    ctx.lineWidth = 4.5;
    ctx.strokeStyle = climax ? '#9ef4ff' : '#5dd0ea';
    ctx.strokeText(bananaWaveTitle, 1214, 541);
    ctx.fillStyle = '#efffff';
    ctx.fillText(bananaWaveTitle, 1214, 541);
    ctx.restore();
  }

  // Water-curtain wipe in the final frames to hand straight off to the stage wave.
  if (live && frame >= duration - 7) {
    const wipe = easeIn((frame - (duration - 7)) / 7);
    const edge = wipe * 1460;
    ctx.fillStyle = '#2da8dc';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(edge, 0);
    ctx.lineTo(edge - 180, 720);
    ctx.lineTo(0, 720);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#d4fbff';
    ctx.beginPath();
    ctx.moveTo(edge - 26, 0);
    ctx.lineTo(edge + 18, 0);
    ctx.lineTo(edge - 162, 720);
    ctx.lineTo(edge - 206, 720);
    ctx.closePath();
    ctx.fill();
  }

  ctx.fillStyle = '#131634';
  ctx.fillRect(0, 0, 1280, 46 + 314 * curtain);
  ctx.fillRect(0, 674 - 314 * curtain, 1280, 46 + 314 * curtain);
  ctx.restore();
}

const joPanels: readonly { at: number; tilt: number; poly: readonly [number, number][] }[] = [
  { at: 0, tilt: -.04, poly: [[16, 16], [803, 16], [803, 218], [16, 316]] },
  { at: 14, tilt: .035, poly: [[16, 302], [803, 204], [803, 592], [16, 540]] },
  { at: 28, tilt: -.045, poly: [[16, 530], [390, 558], [354, 1004], [16, 1004]] },
  { at: 42, tilt: .05, poly: [[380, 558], [803, 584], [803, 1004], [344, 1004]] }
];

export function drawBananaJoCutIn(ctx: CanvasRenderingContext2D, cutIn: CutIn, reducedMotion: boolean) {
  const { width, height } = ctx.canvas;
  const frame = cutIn.frame;
  const live = reducedMotion ? 0 : 1;
  const crackT = live ? Math.max(0, Math.min(1, (frame - 52) / Math.max(1, cutIn.duration - 53))) : 0;

  ctx.resetTransform();
  ctx.save();
  ctx.scale(width / 1280, height / 720);
  if (crackT > 0) {
    ctx.translate(Math.sin(frame * 19.3) * crackT * 14, Math.cos(frame * 15.7) * crackT * 10);
  }

  // Dark purple JO menacing backdrop.
  ctx.fillStyle = '#120722';
  ctx.fillRect(-20, -20, 1320, 760);
  drawFocusLines(ctx, 640, 360, .65 + crackT * .35, frame, 36);

  if (joCutIn.naturalWidth) {
    const scale = Math.min(1280 / joCutIn.naturalWidth, 680 / joCutIn.naturalHeight);
    const dw = joCutIn.naturalWidth * scale;
    const dh = joCutIn.naturalHeight * scale;
    const ox = 640 - dw * .5;
    const oy = 360 - dh * .5;

    // Cream manga page backing once the first panel lands.
    ctx.fillStyle = '#faf3e0';
    ctx.fillRect(ox + 6, oy + 6, dw - 12, dh - 12);

    for (const [panelIdx, panel] of joPanels.entries()) {
      if (frame < panel.at && live) continue;
      const age = frame - panel.at;
      const snap = live ? easeOut(Math.min(1, age / 7)) : 1;
      const pop = 1 + (1 - snap) * .32 + crackT * .05;
      const shake = live ? fadeSince(frame, panel.at, 8) * 6 + crackT * 8 : 0;
      const cx = panel.poly.reduce((s, p) => s + p[0], 0) / panel.poly.length * scale + ox;
      const cy = panel.poly.reduce((s, p) => s + p[1], 0) / panel.poly.length * scale + oy;
      const splitX = crackT * (cx - 640) * .06;
      const splitY = crackT * (cy - 360) * .06;

      ctx.save();
      ctx.translate(cx + splitX + Math.sin(frame * 9.3 + panelIdx) * shake,
        cy + splitY + Math.cos(frame * 7.7 + panelIdx) * shake);
      ctx.rotate(panel.tilt * (1 - snap) + crackT * (panelIdx % 2 ? .035 : -.035));
      ctx.scale(pop, pop);
      ctx.translate(-cx, -cy);

      ctx.beginPath();
      panel.poly.forEach(([px, py], idx) => {
        const sx = ox + px * scale;
        const sy = oy + py * scale;
        if (idx === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      });
      ctx.closePath();
      ctx.save();
      ctx.clip();
      ctx.drawImage(joCutIn, ox, oy, dw, dh);
      if (live && age < 4) {
        ctx.fillStyle = `rgba(253, 224, 71, ${(1 - age / 4) * .45})`;
        ctx.fillRect(ox, oy, dw, dh);
      }
      ctx.restore();
      ctx.strokeStyle = '#120722';
      ctx.lineWidth = 4;
      ctx.stroke();
      ctx.restore();
    }
  }

  // Menacing katakana & title callout.
  ctx.save();
  ctx.font = '900 52px "Microsoft YaHei", sans-serif';
  ctx.textAlign = 'left';
  ctx.strokeStyle = '#1a0533';
  ctx.lineWidth = 10;
  ctx.fillStyle = '#d946ef';
  const pulse = 1 + Math.sin(frame * .35) * .04 * live;
  ctx.translate(72, 130);
  ctx.scale(pulse, pulse);
  ctx.strokeText('ゴゴゴゴ', 0, 0);
  ctx.fillText('ゴゴゴゴ', 0, 0);
  ctx.restore();

  if (!live || frame >= 42) {
    ctx.save();
    ctx.font = '900 44px "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'right';
    ctx.strokeStyle = '#1a0533';
    ctx.lineWidth = 9;
    ctx.fillStyle = '#fde047';
    ctx.strokeText('JO 化觉醒！', 1208, 650);
    ctx.fillText('JO 化觉醒！', 1208, 650);
    ctx.restore();
  }

  // Rising fracture lines & blinding golden-violet glow right before shattering the manga page.
  if (crackT > 0) {
    const reach = crackT * 760;
    for (let i = 0; i < 12; i++) {
      const a = i * (Math.PI * 2 / 12) + noise(i * 11) * .28;
      const r1 = reach * (.34 + noise(i * 3) * .16);
      const r2 = reach * (.68 + noise(i * 5) * .20);
      const r3 = reach;
      const kink1 = (noise(i * 7) - .5) * 44;
      const kink2 = (noise(i * 13) - .5) * 56;
      const drawRay = (color: string, widthPx: number) => {
        ctx.strokeStyle = color;
        ctx.lineWidth = widthPx;
        ctx.beginPath();
        ctx.moveTo(640, 360);
        ctx.lineTo(640 + Math.cos(a) * r1 - Math.sin(a) * kink1, 360 + Math.sin(a) * r1 + Math.cos(a) * kink1);
        ctx.lineTo(640 + Math.cos(a) * r2 + Math.sin(a) * kink2, 360 + Math.sin(a) * r2 - Math.cos(a) * kink2);
        ctx.lineTo(640 + Math.cos(a) * r3, 360 + Math.sin(a) * r3);
        ctx.stroke();
      };
      drawRay('#d946ef', 5 + crackT * 8);
      drawRay('#fde047', 2.5 + crackT * 4.5);
      drawRay('#ffffff', 1.2 + crackT * 2.5);
    }
    if (crackT > .45) {
      const flash = Math.pow((crackT - .45) / .55, 1.5) * .82;
      ctx.fillStyle = `rgba(254, 240, 138, ${flash})`;
      ctx.fillRect(-20, -20, 1320, 760);
    }
  }
  ctx.restore();
}

/** Shatters lingering manga shards outward across the arena to reveal JO Banana Cat. */
export function drawJoShatterBurst(ctx: CanvasRenderingContext2D, age: number, life: number, reducedMotion: boolean) {
  const t = Math.min(1, age / Math.max(1, life));
  const fade = 1 - t;
  if (reducedMotion) {
    ctx.strokeStyle = `rgba(253, 224, 71, ${fade * .7})`;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, 0, 48 + t * 90, 0, Math.PI * 2);
    ctx.stroke();
    return;
  }
  ctx.save();
  // Explosive purple-gold awakening shockwave rings centered on Banana Cat.
  const coreFade = Math.max(0, 1 - age / 9);
  if (coreFade > 0) {
    ctx.fillStyle = `rgba(254, 240, 138, ${coreFade * .75})`;
    ctx.beginPath();
    ctx.arc(0, 0, 56 + age * 14, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const [radius, lw, color] of [
    [40 + t * 280, Math.max(1.5, 9 * fade), '#ffffff'],
    [24 + t * 340, Math.max(2, 11 * fade), '#fde047'],
    [12 + t * 220, Math.max(1.5, 7 * fade), '#d946ef']
  ] as const) {
    ctx.strokeStyle = color;
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.stroke();
  }

  // 18 jagged comic paper shards blasting outward and tumbling away.
  const e = easeOut(t);
  for (let i = 0; i < 18; i++) {
    const angle = i * (Math.PI * 2 / 18) + (noise(i * 7 + 3) - .5) * .35;
    const speed = 220 + noise(i * 13 + 9) * 340;
    const sx = Math.cos(angle) * speed * e;
    const sy = Math.sin(angle) * speed * e + t * t * 140;
    const rot = angle + (i % 2 ? 1 : -1) * t * (2.5 + noise(i * 5) * 4);
    const sz = (18 + noise(i * 19) * 28) * (1 - t * .3);

    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(rot);
    ctx.globalAlpha = Math.min(1, fade * 1.45);
    ctx.beginPath();
    ctx.moveTo(-sz, -sz * .55);
    ctx.lineTo(sz * .85, -sz * .8);
    ctx.lineTo(sz * 1.05, sz * .35);
    ctx.lineTo(-sz * .4, sz * .85);
    ctx.closePath();
    ctx.fillStyle = i % 3 === 0 ? '#fdf2ff' : '#faf3e0';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#120722';
    ctx.stroke();
    // Comic panel halftone / speed accent inside shard.
    ctx.strokeStyle = i % 2 === 0 ? '#d946ef' : '#a855f7';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-sz * .55, -sz * .1);
    ctx.lineTo(sz * .5, -sz * .3);
    ctx.moveTo(-sz * .4, sz * .25);
    ctx.lineTo(sz * .6, sz * .05);
    ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
}

import arcade from '../../assets/ui/arcade.webp';
import comic from '../../assets/ui/comic-paper.webp';
import gagaActions from '../../assets/fighters/gaga-original-handdrawn-v1/motion/registered/gaga-actions.webp';
import gagaBase from '../../assets/fighters/gaga-base.webp';
import gagaSword from '../../assets/fighters/gaga-sword.webp';
import gagaSwordWave from '../../assets/fighters/gaga-sword-wave.webp';
import gagaCrystalSpire from '../../assets/fighters/gaga-crystal-spire.webp';
import gagaXiranite from '../../assets/fighters/gaga-xiranite.webp';
import gagaDive from '../../assets/fighters/gaga-dive.webp';
import gagaCombo from '../../assets/fighters/gaga-original-handdrawn-v1/motion/registered/gaga-basic-combo.webp';
import gagaFinish from '../../assets/fighters/gaga-original-handdrawn-v1/motion/registered/gaga-combo-finish.webp';
import gagaPoleAttacks from '../../assets/fighters/gaga-original-handdrawn-v1/motion/registered/gaga-pole-attacks.webp';
import gagaPoleLaunch from '../../assets/fighters/gaga-original-handdrawn-v1/motion/registered/gaga-pole-launch.webp';
import gagaAirPole from '../../assets/fighters/gaga-original-handdrawn-v1/motion/registered/gaga-air-pole.webp';
import gagaTurretTerminal from '../../assets/fighters/gaga-original-handdrawn-v1/motion/registered/gaga-turret-terminal.webp';
import gagaTurretDeploy from '../../assets/props/gaga-turret-deploy.webp';
import gagaHowitzerDeploy from '../../assets/props/gaga-howitzer-deploy.webp';
import gagaPole from '../../assets/fighters/gaga-pole.webp';
import gagaPolePlant from '../../assets/fighters/gaga-pole-plant.webp';
import gagaReactions from '../../assets/fighters/gaga-original-handdrawn-v1/motion/registered/gaga-hit-reactions.webp';
import dorm from '../../assets/arenas/dorm-bg.webp';
import court from '../../assets/arenas/court-bg.webp';
import harbor from '../../assets/arenas/harbor-quay.webp';
import dockProps from '../../assets/arenas/harbor-props.webp';
import gantry from '../../assets/arenas/harbor-gantry.webp';
import station from '../../assets/arenas/station-bg.webp';
import ring from '../../assets/arenas/ring-clean.webp';
import ringCast from '../../assets/arenas/ring-performers.webp';
import dormKit from '../../assets/arenas/dorm-kit.webp';
import courtKit from '../../assets/arenas/court-kit.webp';
import stationKit from '../../assets/arenas/station-kit.webp';
import broadcastKit from '../../assets/arenas/broadcast-kit.webp';
import { roster } from '../content/roster.js';
import type { ActionDefinition, ArenaDefinition, FighterAction, FighterState, HitReaction, Projectile, ProjectileDefinition, Turret, TurretKind } from '../core/types.js';
import { isAttack } from '../core/types.js';
import { turretFrame } from '../core/turret.js';
import { summonAtlas } from './dijiang.js';
import { gagaActionIds } from '../content/fighters/gaga.js';

export const arcadeArt = arcade;
export const comicArt = comic;
declare const __FIGHTER_IMAGES__: Record<string, string>;
function fighterSources(kind: 'portrait' | 'motion'): Record<string, string> {
  return Object.fromEntries(roster.map(({ fighter, art }) => [fighter.id, __FIGHTER_IMAGES__[art[kind]]]));
}
export const fighterArt = fighterSources('portrait');
export const arenaArt = { dorm, court, harbor, station, ring };

function loadImages(sources: Record<string, string>) {
  return Object.fromEntries(Object.entries(sources).map(([id, src]) => {
    const image = new Image();
    image.src = src;
    return [id, image];
  }));
}

export const sprites = loadImages(fighterArt);
export const motionArt = loadImages(Object.fromEntries(roster.map(({ fighter, art }) =>
  [fighter.id, __FIGHTER_IMAGES__[art.motion]])));
export const backgrounds = {
  ...loadImages(arenaArt) as Record<keyof typeof arenaArt, HTMLImageElement>,
  broadcast: undefined
};
export const { ringPerformers } = loadImages({ ringPerformers: ringCast });
export const { dockProps: harborProps, gantry: harborGantry } = loadImages({ dockProps, gantry });
export const stageKits = loadImages({ dorm: dormKit, court: courtKit, station: stationKit, broadcast: broadcastKit });
interface ActionPose {
  x: number;
  y: number;
  width: number;
  height: number;
  footX: number;
  footY: number;
}

function pose(left: number, top: number, width: number, height: number, pivot: number): ActionPose {
  return { x: left - 3, y: top - 3, width: width + 6, height: height + 6,
    footX: pivot - left + 3, footY: height + 3 };
}

const reactionPoses: Record<HitReaction['kind'], [ActionPose, ActionPose, ActionPose, ActionPose]> = {
  light: [
    pose(87, 18, 214, 306, 198), pose(444, 16, 234, 308, 587),
    pose(834, 27, 227, 297, 945), pose(1232, 17, 208, 307, 1336)
  ],
  heavy: [
    pose(55, 359, 267, 298, 182), pose(428, 364, 301, 293, 568),
    pose(842, 391, 240, 267, 945), pose(1229, 358, 218, 300, 1336)
  ],
  air: [
    pose(52, 690, 292, 292, 190), pose(427, 691, 263, 259, 565),
    pose(788, 699, 284, 311, 940), pose(1219, 737, 225, 275, 1330)
  ]
};

const reactionAtlas = new Image();
reactionAtlas.src = gagaReactions;

export function gagaReactionPose(reaction: HitReaction, vy: number) {
  if (!reactionAtlas.naturalWidth) return undefined;
  const { elapsed, kind, landedAt } = reaction;
  let index = 0;
  if (kind === 'air') {
    index = landedAt !== undefined ? 3 : elapsed < 4 ? 0 : vy < 0 ? 1 : 2;
  } else if (kind === 'heavy') {
    index = elapsed < 4 ? 0 : elapsed < 10 ? 1 : elapsed < 18 ? 2 : 3;
  } else {
    index = elapsed < 3 ? 0 : elapsed < 7 ? 1 : elapsed < 12 ? 2 : 3;
  }
  return { image: reactionAtlas, region: reactionPoses[kind][index], scaleX: .45, scaleY: .45 };
}

// Feet stay on the same ground plane as the body turns and changes shape.
const gagaComboPoses: Partial<Record<string, [ActionPose, ActionPose, ActionPose, ActionPose]>> = {
  [gagaActionIds.jab]: [
    pose(70, 22, 228, 298, 173), pose(440, 24, 255, 293, 554),
    pose(816, 31, 333, 287, 937), pose(1224, 22, 221, 297, 1336)
  ],
  [gagaActionIds.backhand]: [
    pose(85, 362, 213, 300, 183), pose(434, 358, 249, 302, 556),
    pose(804, 378, 298, 280, 927), pose(1232, 362, 230, 300, 1342)
  ]
};

const rushPose = pose(31, 161, 330, 261, 182);

const impactStretch: Partial<Record<string, [number, number]>> = {
  [gagaActionIds.jab]: [1.12, .93],
  [gagaActionIds.backhand]: [1.16, .93]
};

export interface PolePose {
  x: number;
  y: number;
  angle: number;
  projection: number;
}

export interface GagaActionPose {
  image: HTMLImageElement | null;
  region: ActionPose;
  scaleX: number;
  scaleY: number;
  rotation?: number;
  pole?: PolePose;
  rushing?: boolean;
  heldCrate?: { x: number; y: number; kind: TurretKind };
}

/** Frames of each round's opening on which a step of the terminal routine begins. The opening runs 192 frames. */
export const gagaIntroBeats = { pocket: 40, take: 63, press: 83, point: 107, relax: 159 } as const;

const poleScale = .45;

function poleFrame(region: ActionPose, handX: number, handY: number, angle: number, projection: number) {
  return {
    region, pole: {
      x: (handX - region.x - region.footX) * poleScale,
      y: (handY - region.y - region.footY) * poleScale,
      angle, projection
    }
  };
}

// Horizontal moves shorten the pole through the turn in depth.
const gagaPolePoses: Map<string, ReturnType<typeof poleFrame>[]> = new Map([
  [gagaActionIds.poleSweep, [
    poleFrame(pose(55, 12, 266, 306, 187), 123, 241, .03, -.85),
    poleFrame(pose(439, 12, 251, 306, 567), 579, 224, .09, -.34),
    poleFrame(pose(796, 21, 305, 297, 931), 1062, 193, -.13, 1),
    poleFrame(pose(1207, 15, 248, 303, 1330), 1292, 208, .10, .78)
  ]],
  [gagaActionIds.poleBacksweep, [
    poleFrame(pose(57, 350, 250, 311, 178), 121, 500, .10, .72),
    poleFrame(pose(442, 353, 242, 308, 569), 576, 526, -.10, .28),
    poleFrame(pose(801, 356, 302, 305, 931), 1059, 530, .17, 1),
    poleFrame(pose(1205, 356, 251, 305, 1330), 1372, 591, -.13, -.82)
  ]]
]);

const poleBodyAtlas = new Image();
poleBodyAtlas.src = gagaPoleAttacks;
const poleLaunchAtlas = new Image();
poleLaunchAtlas.src = gagaPoleLaunch;
const airPoleAtlas = new Image();
airPoleAtlas.src = gagaAirPole;
const terminalAtlas = new Image();
terminalAtlas.src = gagaTurretTerminal;
const deployAtlas = new Image();
deployAtlas.src = gagaTurretDeploy;
const howitzerAtlas = new Image();
howitzerAtlas.src = gagaHowitzerDeploy;
const poleSprite = new Image();
poleSprite.src = gagaPole;
const polePlantAtlas = new Image();
polePlantAtlas.src = gagaPolePlant;
const baseAtlas = new Image();
baseAtlas.src = gagaBase;
const swordAtlas = new Image();
swordAtlas.src = gagaSword;
const swordWaveAtlas = new Image();
swordWaveAtlas.src = gagaSwordWave;
const crystalSpireAtlas = new Image();
crystalSpireAtlas.src = gagaCrystalSpire;
const xiraniteAtlas = new Image();
xiraniteAtlas.src = gagaXiranite;
const diveAtlas = new Image();
diveAtlas.src = gagaDive;

const swordWaveFrames = [
  { x: 29, y: 43, w: 213, h: 253, cx: 190, cy: 169 },
  { x: 266, y: 43, w: 234, h: 254, cx: 451, cy: 169 },
  { x: 523, y: 43, w: 230, h: 254, cx: 709, cy: 169 },
  { x: 786, y: 43, w: 224, h: 254, cx: 966, cy: 170 }
] as const;

export function drawSwordWaveSprite(ctx: CanvasRenderingContext2D, projectile: Projectile, radius: number) {
  if (!swordWaveAtlas.naturalWidth) return false;
  const age = projectile.age ?? 0;
  const key = swordWaveFrames[Math.floor(age / 3) % swordWaveFrames.length];
  const scale = (radius * 2) / 251;
  ctx.save();
  ctx.translate(projectile.x, projectile.y);
  ctx.scale(projectile.facing, 1);
  // Slight forward stretch on launch for speed feel.
  const launchStretch = age < 4 ? 1 + (4 - age) * .045 : 1;
  ctx.scale(launchStretch, 1);
  ctx.drawImage(
    swordWaveAtlas, key.x, key.y, key.w, key.h,
    (key.x - key.cx) * scale, (key.y - key.cy) * scale, key.w * scale, key.h * scale
  );
  ctx.restore();
  return true;
}

const crystalSpireFrames = [
  { x: 98, y: 19, w: 76, h: 299, cx: 134, cy: 299 },
  { x: 305, y: 13, w: 158, h: 313, cx: 384, cy: 294 },
  { x: 545, y: 19, w: 187, h: 306, cx: 636, cy: 294 },
  { x: 826, y: 19, w: 135, h: 294, cx: 890, cy: 300 }
] as const;

export function drawCrystalSpireSprite(ctx: CanvasRenderingContext2D, frameIndex: number,
  targetHeight: number, alpha = 1, scaleX = 1, scaleY = 1) {
  if (!crystalSpireAtlas.naturalWidth) return false;
  const key = crystalSpireFrames[Math.max(0, Math.min(crystalSpireFrames.length - 1, frameIndex))];
  const scale = targetHeight / 280;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.scale(scaleX, scaleY);
  ctx.drawImage(
    crystalSpireAtlas, key.x, key.y, key.w, key.h,
    (key.x - key.cx) * scale, (key.y - key.cy) * scale, key.w * scale, key.h * scale
  );
  ctx.restore();
  return true;
}

const gagaBaseScale = .60;
const gagaBaseWalk = [
  pose(37, 5, 183, 230, 141),
  pose(299, 5, 176, 233, 400),
  pose(554, 5, 177, 229, 649),
  pose(818, 5, 170, 231, 908)
] as const;
const gagaBaseStates = {
  dash: pose(25, 290, 222, 199, 127),
  jump: pose(305, 257, 173, 219, 383),
  fall: pose(560, 276, 176, 199, 656),
  guard: pose(797, 291, 182, 209, 899)
} as const;

const gagaSwordPoses = {
  slash: [
    pose(16, 58, 279, 232, 136),
    pose(360, 57, 302, 231, 468),
    pose(736, 55, 245, 236, 872)
  ],
  rise: [
    pose(54, 417, 275, 230, 165),
    pose(384, 424, 219, 232, 498),
    pose(720, 425, 252, 219, 830)
  ]
} as const;

const gagaXiranitePoses = [
  pose(26, 80, 228, 210, 100),
  pose(359, 77, 324, 218, 455),
  pose(683, 80, 329, 202, 749)
] as const;

const gagaDivePoses = [
  pose(34, 20, 253, 223, 198),
  pose(379, 51, 258, 233, 515),
  pose(713, 59, 261, 228, 847)
] as const;

export function gagaStatePose(fighter: FighterState, walkDistance?: number): GagaActionPose | undefined {
  const sheet = motionArt.gaga;
  if (!sheet?.naturalWidth) return undefined;
  const frame = fighter.dash > 0 ? 4 : !fighter.ground ? (fighter.vy < 0 ? 5 : 6)
    : fighter.guarding ? 7 : walkDistance !== undefined ? Math.floor(walkDistance / 34) % 4 : -1;
  if (frame < 0) return undefined;
  const size = 432, scale = 139 / 378;
  return { image: sheet, region: { x: frame % 4 * size, y: Math.floor(frame / 4) * size,
    width: size, height: size, footX: 216, footY: 416 }, scaleX: scale, scaleY: scale };
}

const terminalFrames = [
  pose(87, 31, 326, 458, 250),
  pose(599, 31, 313, 458, 754),
  pose(1111, 33, 316, 456, 1268),
  pose(77, 545, 330, 455, 243),
  pose(555, 543, 406, 457, 733),
  pose(1111, 543, 320, 457, 1270)
];
const deployFrames = [
  pose(135, 323, 242, 153, 256),
  pose(634, 317, 262, 169, 765),
  pose(1081, 267, 399, 209, 1281),
  pose(81, 662, 372, 327, 268),
  pose(590, 576, 373, 414, 779),
  pose(1161, 548, 245, 442, 1284)
];
const howitzerFrames = [
  pose(116, 270, 285, 188, 259),
  pose(608, 250, 310, 222, 764),
  pose(1049, 192, 451, 287, 1274),
  pose(50, 645, 419, 355, 260),
  pose(623, 562, 290, 442, 766),
  pose(1123, 533, 290, 474, 1269)
];
const turretArt = {
  bolt: { image: deployAtlas, frames: deployFrames, scale: .291 },
  howitzer: { image: howitzerAtlas, frames: howitzerFrames, scale: .258 }
};

function terminalPose(action: ActionDefinition, frame: number): GagaActionPose {
  const index = frame < 4 ? 0 : frame < 8 ? 1 : frame < 12 ? 2 : frame < action.startup ? 3
    : frame < action.startup + 7 ? 4 : 5;
  return { image: frame < action.startup + 14 ? terminalAtlas : null, region: terminalFrames[index],
    scaleX: .30, scaleY: .30, heldCrate: index === 3 ? { x: -37, y: -61, kind: 'bolt' } : undefined };
}

export function drawEngineeringCrate(ctx: CanvasRenderingContext2D, kind: TurretKind, x: number, y: number, angle = 0) {
  const { image, frames, scale } = turretArt[kind];
  if (!image.naturalWidth) return;
  const { x: sx, y: sy, width, height } = frames[0];
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.drawImage(image, sx, sy, width, height, -width * scale / 2, -height * scale / 2,
    width * scale, height * scale);
  ctx.restore();
}

export function drawTurret(ctx: CanvasRenderingContext2D, turret: Turret) {
  const { image, frames, scale } = turretArt[turret.kind];
  if (!image.naturalWidth) return;
  const frame = frames[turretFrame(turret.age)];
  ctx.save();
  ctx.translate(turret.x, turret.y);
  ctx.scale(-turret.facing, 1);
  ctx.drawImage(image, frame.x, frame.y, frame.width, frame.height,
    -frame.footX * scale, -frame.footY * scale, frame.width * scale, frame.height * scale);
  ctx.restore();
}

export function drawTurretBolt(ctx: CanvasRenderingContext2D, { x, y, vx, vy }: Projectile) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(Math.atan2(vy, vx));
  ctx.fillStyle = '#287fff70';
  ctx.fillRect(-31, -5, 30, 10);
  ctx.fillStyle = '#42bcff';
  ctx.fillRect(-17, -4, 20, 8);
  ctx.fillStyle = '#c7faff';
  ctx.fillRect(-10, -2, 16, 4);
  ctx.restore();
}

export function drawGrenade(ctx: CanvasRenderingContext2D, { x, y, vx, vy }: Projectile) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(Math.atan2(vy, vx));
  ctx.fillStyle = '#ffae526b';
  ctx.fillRect(-21, -2, 15, 4);
  ctx.fillStyle = '#252336';
  ctx.strokeStyle = '#ffb255';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(0, 0, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#ffdd8c';
  ctx.fillRect(1, -4, 4, 4);
  ctx.restore();
}

const launchScale = .266;
const launchFrames = [
  { region: pose(118, 95, 417, 449, 325), handX: 290, handY: 489 },
  { region: pose(705, 103, 521, 440, 952), handX: 1163, handY: 358 },
  { region: pose(105, 655, 435, 492, 350), handX: 440, handY: 832 },
  { region: pose(750, 615, 417, 531, 962), handX: 784, handY: 792 }
] as const;

function launchPose(action: ActionDefinition, frame: number) {
  const release = action.startup - (action.swingLead ?? 4);
  const overhead = action.startup + action.active + 1;
  const settling = frame >= action.startup + action.active + Math.ceil(action.recovery * .72);
  const index = frame < release ? 0 : frame < action.startup ? 1 : frame < overhead ? 2 : 3;
  const { region, handX, handY } = launchFrames[index];
  const rise = Math.max(0, Math.min(1, (frame - action.startup) / (overhead - action.startup)));
  const followThrough = Math.min(1, Math.max(0, (frame - overhead) / 5));
  const releaseProgress = Math.max(0, Math.min(1, (frame - release) / (action.startup - release)));
  // Travel from the low forward reach through contact and across the crown of the hood.
  const angle = frame < release ? .045 : frame < action.startup ? .12 - .67 * releaseProgress ** 1.3
    : -.55 - 1.55 * rise - .1 * followThrough;
  const rotation = index === 2 ? -.16 * rise : index === 3 ? .1 * (1 - followThrough) : 0;
  const x = (handX - region.x - region.footX) * launchScale;
  const y = (handY - region.y - region.footY) * launchScale;
  const pole: PolePose = {
    x: x * Math.cos(rotation) - y * Math.sin(rotation),
    y: x * Math.sin(rotation) + y * Math.cos(rotation),
    angle,
    projection: index === 0 ? .84 : 1 - .08 * followThrough
  };
  return { image: settling ? null : poleLaunchAtlas, region, scaleX: launchScale, scaleY: launchScale,
    rotation: settling ? 0 : rotation, pole: settling ? undefined : pole };
}

const mastWidthScale = .67;
const baseWidthScale = .55;

export const POWER_PYLON_HEIGHT = 452;

export function drawPowerPylonPole(ctx: CanvasRenderingContext2D, squashX = 1, stretchY = 1) {
  if (!poleSprite.naturalWidth) return false;
  ctx.save();
  ctx.translate(0, 11); // Sink tripod side & front feet solidly into ground shadow plane
  ctx.scale(squashX, stretchY);
  const scale = .765; // 3x proportional width & height relative to the previous 0.255 standing scale
  // Base tripod + collar (y=478..603 cuts out the 3px empty bottom pad -> 125 source px).
  const baseH = 125 * scale;
  ctx.drawImage(poleSprite, 126, 478, 162, 125, -81.5 * scale, -baseH, 162 * scale, baseH);
  // Lower caution-striped housing box (y=330..478, 48x148).
  const lowerH = 148 * scale;
  ctx.drawImage(poleSprite, 184, 330, 48, 148, -23.5 * scale, -(baseH + lowerH), 48 * scale, lowerH);
  // Wire-free telescoping upper mast segments (y=165..320 has 0 yellow side wires) reaching cap.
  const capH = 22 * scale;
  const mastTop = -(POWER_PYLON_HEIGHT - capH);
  const mastBot = -(baseH + lowerH);
  const segCount = 2;
  const segH = (mastBot - mastTop) / segCount;
  for (let i = 0; i < segCount; i++) {
    const syTop = mastBot - (i + 1) * segH;
    const sw = 30 * scale * (1 - i * .10);
    ctx.drawImage(poleSprite, 191, 165, 30, 155, -sw / 2, syTop, sw, segH + 1);
  }
  // Top mast cap (x=195..217, y=7..29 — completely clear of side cables).
  ctx.drawImage(poleSprite, 195, 7, 23, 22, -11.5 * scale * .86, -POWER_PYLON_HEIGHT, 23 * scale * .86, capH + 2);
  ctx.restore();
  return true;
}

const gagaPolePlantScale = .63;
const gagaPolePlantPoses: ActionPose[] = [
  pose(26, 43, 215, 186, 98),
  pose(296, 39, 196, 190, 366),
  pose(561, 31, 182, 198, 631),
  pose(818, 6, 176, 224, 878),
  pose(55, 263, 150, 222, 108),
  pose(303, 278, 161, 206, 352),
  pose(552, 279, 164, 207, 604),
  pose(805, 279, 171, 207, 863),
  pose(25, 551, 159, 190, 82),
  { ...pose(302, 534, 131, 195, 358), footY: 210 },
  pose(560, 544, 131, 197, 620),
  pose(825, 543, 130, 198, 904)
];
const polePlantCue = [0, 2, 4, 6, 8, 10, 12, 14, 16, 19, 22, 26] as const;

// The neck bridges the cable crossing. The collar and tripod keep the
// silhouette of the standing prop at the bottom of the mast.
const poleSections = [
  [195, 7, 24, 22, 7, 22, mastWidthScale],
  [198, 40, 19, 7, 29, 18, mastWidthScale],
  [184, 47, 48, 431, 47, 431, mastWidthScale],
  [175, 478, 65, 22, 478, 22, baseWidthScale],
  [126, 500, 162, 106, 500, 106, baseWidthScale]
] as const;
const poleGrip = { x: 207.5, y: 479 };
const poleLengthScale = .448;
const mastReach = (poleGrip.y - poleSections[0][1]) * poleLengthScale;

const airPoleFrames = [
  { region: pose(141, 19, 371, 520, 347), x: 208, y: 143 },
  { region: pose(710, 13, 470, 542, 930), x: 1117, y: 232 },
  { region: pose(92, 602, 466, 530, 297) },
  { region: pose(713, 580, 443, 597, 951) }
] as const;

function airPolePose(action: ActionDefinition, frame: number): GagaActionPose {
  const index = frame < action.startup - 3 ? 0 : frame < action.startup ? 1
    : frame < action.startup + 7 ? 2 : 3;
  const key = airPoleFrames[index];
  const { region } = key;
  const scale = .237;
  const pose: GagaActionPose = { image: airPoleAtlas, region, scaleX: scale, scaleY: scale };
  if ('x' in key) {
    const x = (key.x - region.x - region.footX) * scale;
    const y = (key.y - region.y - region.footY) * scale;
    if (action.id === gagaActionIds.howitzer) {
      pose.heldCrate = { x, y: y - 19, kind: 'howitzer' };
    } else {
      pose.pole = { x, y, angle: index === 0 ? -.35 + frame * .015 : -.23 + (frame - action.startup + 3) * .23,
        projection: action.projectile!.reach / mastReach * (index === 0 ? .78 : 1) };
    }
  }
  return pose;
}

function pointOnMast(pole: PolePose, fraction: number): [number, number] {
  const reach = mastReach * pole.projection * fraction;
  return [pole.x + Math.cos(pole.angle) * reach, pole.y + Math.sin(pole.angle) * reach];
}

export function drawGagaLaunchTrail(ctx: CanvasRenderingContext2D, action: ActionDefinition, frame: number) {
  const release = action.startup - (action.swingLead ?? 4);
  const end = action.startup + action.active + 3;
  const fade = 1 - Math.max(0, frame - end) / 5;
  if (frame <= release || fade <= 0) return;
  const first = Math.max(release, Math.min(frame, end) - 8);
  const last = Math.min(frame, end);
  const samples: PolePose[] = [];
  for (let tick = first; tick <= last; tick++) {
    const { pole } = launchPose(action, tick);
    if (!pole) return;
    samples.push(pole);
  }
  ctx.save();
  ctx.fillStyle = '#ffdc91';
  ctx.strokeStyle = '#fff7d5';
  ctx.lineWidth = 3.5;
  ctx.lineCap = 'round';
  for (let i = 1; i < samples.length; i++) {
    const weight = i / (samples.length - 1);
    const from = pointOnMast(samples[i - 1], 1);
    const to = pointOnMast(samples[i], 1);
    ctx.globalAlpha = fade * weight * .36;
    ctx.beginPath();
    ctx.moveTo(...from);
    ctx.lineTo(...to);
    ctx.lineTo(...pointOnMast(samples[i], 1 - weight * .18));
    ctx.lineTo(...pointOnMast(samples[i - 1], 1 - (i - 1) / (samples.length - 1) * .18));
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = fade * weight * .88;
    ctx.beginPath();
    ctx.moveTo(...from);
    ctx.lineTo(...to);
    ctx.stroke();
  }
  ctx.restore();
}

export function drawGagaPole(ctx: CanvasRenderingContext2D, pole: PolePose, gripped = true) {
  if (!poleSprite.naturalWidth) return;
  ctx.save();
  ctx.translate(pole.x, pole.y);
  if (gripped) {
    ctx.beginPath();
    ctx.rect(-230, -230, 460, 460);
    ctx.ellipse(0, 0, 7.4, 6.2, 0, 0, Math.PI * 2);
    ctx.clip('evenodd');
  }
  ctx.rotate(Math.PI / 2 + pole.angle);
  const projection = Math.abs(pole.projection) < .12 ? .12 * (Math.sign(pole.projection) || 1) : pole.projection;
  ctx.scale(1, projection);
  for (const [sx, sy, width, height, y, drawnHeight, widthScale] of poleSections) {
    ctx.drawImage(poleSprite, sx, sy, width, height,
      (sx - poleGrip.x) * widthScale, (y - poleGrip.y) * poleLengthScale,
      width * widthScale, drawnHeight * poleLengthScale);
  }
  ctx.restore();
}

export function drawThrownPole(ctx: CanvasRenderingContext2D, projectile: Projectile, data: ProjectileDefinition) {
  const { x, y, facing, vx, vy } = projectile;
  const angle = Math.atan2(vy, Math.abs(vx));
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(facing, 1);
  ctx.strokeStyle = '#ffe8b9';
  ctx.lineCap = 'round';
  for (const [offset, size, alpha] of [[-13, 95, .46], [16, 73, .32], [-24, 53, .2]]) {
    ctx.globalAlpha = alpha;
    ctx.lineWidth = offset === -13 ? 4 : 2;
    ctx.beginPath();
    ctx.moveTo(-dx * 9 - dy * offset, -dy * 9 + dx * offset);
    ctx.lineTo(-dx * size - dy * offset, -dy * size + dx * offset);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  drawGagaPole(ctx, { x: -dx * data.reach, y: -dy * data.reach,
    angle, projection: data.reach / mastReach }, false);
  ctx.restore();
}

const gagaSpecialPoses: Partial<Record<string, [ActionPose, ActionPose, ActionPose]>> = {
  [gagaActionIds.lift]: [
    pose(162, 41, 205, 211, 260), pose(652, 9, 225, 244, 741), pose(1166, 8, 209, 244, 1269)
  ],
  [gagaActionIds.slide]: [
    pose(151, 294, 224, 202, 246), pose(602, 321, 295, 175, 747), pose(1127, 284, 252, 212, 1247)
  ]
};

const actionAtlas = new Image();
actionAtlas.src = gagaActions;
const comboAtlas = new Image();
comboAtlas.src = gagaCombo;
const finishAtlas = new Image();
finishAtlas.src = gagaFinish;

const summonFinish = pose(936, 519, 423, 488, 1128);

export function gagaIdlePose() {
  if (!comboAtlas.naturalWidth) return undefined;
  const region = gagaComboPoses[gagaActionIds.jab]![0];
  return { image: comboAtlas, region, scaleX: .465, scaleY: .465 };
}

export function gagaActionPose(move: FighterAction, frame: number, grounded: boolean): GagaActionPose | undefined {
  if (!isAttack(move)) {
    if (move.id === gagaActionIds.xiraniteGuard && xiraniteAtlas.naturalWidth) {
      const index = frame < move.startup ? 0 : frame < move.startup + move.active ? 1 : 0;
      return { image: xiraniteAtlas, region: gagaXiranitePoses[index], scaleX: gagaBaseScale, scaleY: gagaBaseScale };
    }
    return undefined;
  }
  const action = move;
  if (action.summon && summonAtlas.naturalWidth && frame < action.startup + 11) {
    return { image: summonAtlas, region: summonFinish, scaleX: .28, scaleY: .28 };
  }
  if (action.id === gagaActionIds.turret && terminalAtlas.naturalWidth) {
    return terminalPose(action, frame);
  }
  if (action.id === gagaActionIds.overclock && polePlantAtlas.naturalWidth) {
    if (frame >= action.startup + action.active + Math.ceil(action.recovery * .88)) return undefined;
    let index = 0;
    for (let i = 0; i < polePlantCue.length; i++) if (frame >= polePlantCue[i]) index = i;
    return {
      image: polePlantAtlas,
      region: gagaPolePlantPoses[index],
      scaleX: gagaPolePlantScale,
      scaleY: gagaPolePlantScale
    };
  }
  if (action.id === gagaActionIds.swordSlash && swordAtlas.naturalWidth) {
    const recoveryFrame = frame - action.startup - action.active;
    if (recoveryFrame >= Math.ceil(action.recovery * .78)) return undefined;
    const index = frame < action.startup ? 0 : recoveryFrame < 0 ? 1 : 2;
    let rotation = 0;
    let sx = 1;
    let sy = 1;
    if (index === 0) {
      const charge = Math.min(1, frame / Math.max(1, action.startup - 1));
      rotation = -.06 - .07 * charge;
      sx = .96 - .03 * charge;
      sy = 1.04 + .03 * charge;
    } else if (index === 1) {
      rotation = .11;
      sx = 1.09;
      sy = .94;
    } else {
      const ease = Math.min(1, recoveryFrame / 5);
      rotation = .05 * (1 - ease);
      sx = 1.03 - .03 * ease;
      sy = .98 + .02 * ease;
    }
    return {
      image: swordAtlas, region: gagaSwordPoses.slash[index],
      scaleX: .57 * sx, scaleY: .57 * sy, rotation
    };
  }
  if (action.id === gagaActionIds.swordRise && swordAtlas.naturalWidth) {
    const recoveryFrame = frame - action.startup - action.active;
    if (recoveryFrame >= Math.ceil(action.recovery * .75)) return undefined;
    const index = frame < action.startup ? 0 : recoveryFrame < 3 ? 1 : 2;
    const charge = index === 0 ? Math.min(1, frame / Math.max(1, action.startup - 1)) : 0;
    const rotation = index === 0 ? -.04 * charge : index === 1 ? Math.max(0, .06 - (frame - action.startup) * .012) : 0;
    return {
      image: swordAtlas, region: gagaSwordPoses.rise[index],
      scaleX: .57, scaleY: .57, rotation
    };
  }
  if (action.id === gagaActionIds.xiraniteBurst && xiraniteAtlas.naturalWidth) {
    const recoveryFrame = frame - action.startup - action.active;
    if (recoveryFrame >= Math.ceil(action.recovery * .78)) return undefined;
    const index = frame < action.startup + action.active + 5 ? 2 : 0;
    return { image: xiraniteAtlas, region: gagaXiranitePoses[index], scaleX: gagaBaseScale, scaleY: gagaBaseScale };
  }
  if (action.id === gagaActionIds.airDive && diveAtlas.naturalWidth) {
    const recoveryFrame = frame - action.startup - action.active;
    if (recoveryFrame >= Math.ceil(action.recovery * .85)) return undefined;
    const index = frame < action.startup ? 0 : recoveryFrame < 0 ? 1 : 2;
    return { image: diveAtlas, region: gagaDivePoses[index], scaleX: gagaBaseScale, scaleY: gagaBaseScale };
  }
  if ((action.id === gagaActionIds.airThrow || action.id === gagaActionIds.howitzer) && airPoleAtlas.naturalWidth) {
    return grounded && frame >= action.startup + 7 ? undefined : airPolePose(action, frame);
  }
  if (action.id === gagaActionIds.poleLaunch && poleLaunchAtlas.naturalWidth) return launchPose(action, frame);
  const recoveryFrame = frame - action.startup - action.active;
  const settling = recoveryFrame >= Math.ceil(action.recovery * .72);
  const secondPose = Math.ceil(action.startup / 2);
  const index = frame < secondPose ? 0 : frame < action.startup ? 1 : recoveryFrame < 0 ? 2 : 3;
  const staff = gagaPolePoses.get(action.id);
  if (staff && poleBodyAtlas.naturalWidth) {
    const { region, pole } = staff[index];
    const previous = staff[Math.max(0, index - 1)].pole;
    let progress = 1;
    if (index === 1) {
      progress = Math.min(1, (frame - secondPose + 1) / 3);
    } else if (index === 3) {
      progress = 1 - (1 - Math.min(1, (recoveryFrame + 1) / 5)) ** 2;
    }
    const next = staff[Math.min(index + 1, 3)].pole;
    const swing = index === 1 && action.swingLead
      ? Math.max(0, (frame - (action.startup - action.swingLead)) / action.swingLead)
      : 0;
    const angle = previous.angle + (pole.angle - previous.angle) * progress;
    const projection = previous.projection + (pole.projection - previous.projection) * progress;
    return { image: settling ? null : poleBodyAtlas, region, scaleX: poleScale, scaleY: poleScale,
      pole: settling ? undefined : { ...pole, angle: angle + (next.angle - angle) * swing,
        projection: projection + (next.projection - projection) * swing } };
  }
  const combo = gagaComboPoses[action.id];
  if (combo && comboAtlas.naturalWidth) {
    const scale = .465;
    const stretch = index === 2 ? impactStretch[action.id] : undefined;
    return {
      image: settling ? null : comboAtlas, region: combo[index],
      scaleX: scale * (stretch?.[0] ?? 1), scaleY: scale * (stretch?.[1] ?? 1)
    };
  }
  const special = gagaSpecialPoses[action.id];
  if (special && actionAtlas.naturalWidth) {
    if (action.id === gagaActionIds.lift && finishAtlas.naturalWidth &&
      frame >= (action.advanceFrom ?? 0) && frame < (action.advanceUntil ?? action.startup)) {
      return { image: finishAtlas, region: rushPose, scaleX: .45, scaleY: .42, rushing: true };
    }
    const index = frame < action.startup ? 0 : recoveryFrame < 0 ? 1 : 2;
    return { image: settling ? null : actionAtlas, region: special[index], scaleX: .56, scaleY: .56 };
  }
}

const introCells: [number, number][] = [
  [gagaIntroBeats.pocket, 0], [gagaIntroBeats.take, 1], [gagaIntroBeats.press, 2], [gagaIntroBeats.point, 4],
  [gagaIntroBeats.relax, 5]
];

/** The entrance, performed on the stage at the fighter's usual size: reach for the pocket, take the terminal out,
 *  press it, point at the opponent, then stand easy. */
export function gagaIntroPose(frame: number): GagaActionPose | undefined {
  if (!terminalAtlas.naturalWidth) return undefined;
  let cell = -1;
  for (const [from, index] of introCells) if (frame >= from) cell = index;
  return cell < 0 ? undefined : { image: terminalAtlas, region: terminalFrames[cell], scaleX: .30, scaleY: .30 };
}

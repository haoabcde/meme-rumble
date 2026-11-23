import { defineFighter, type NormalMove, type SignatureMove } from '../fighter-kit.js';
import { ENERGY_PER_STOCK, MAX_ENERGY, type ActionDefinition } from '../../core/types.js';
import { summonFallFrames } from '../../core/summon.js';

export const gagaActionIds = {
  jab: 'gaga-flipper-jab', backhand: 'gaga-flipper-backhand',
  poleSweep: 'gaga-pole-sweep', poleBacksweep: 'gaga-pole-backsweep', poleLaunch: 'gaga-pole-launch',
  lift: 'gaga-flipper-lift', slide: 'gaga-belly-slide', airThrow: 'gaga-air-pole-throw',
  turret: 'gaga-turret-deploy', turretBolt: 'gaga-turret-bolt',
  howitzer: 'gaga-howitzer-deploy', grenade: 'gaga-turret-grenade', dijiang: 'gaga-summon-dijiang'
} as const;

export const gagaComboNames = ['前鳍直击', '转身反拍', '电线杆横扫', '电线杆反扫', '电线杆挑飞'];

const poleLaunchBox = { x: 24, y: -271, w: 147, h: 224 };

// Chain windows reserve a few follow-through frames even when the next press is buffered.
export const gagaGroundCombo: NormalMove[] = [
  {
    id: gagaActionIds.jab, name: '前鳍直击', slot: 'A', posture: 'ground',
    startup: 5, active: 2, recovery: 14,
    hitbox: { x: 40, y: -70, w: 67, h: 29 },
    damage: 36, hitstun: 18, blockstun: 8, guardCost: 7, push: 2, lift: 0,
    stop: 2, advance: 8, advanceFrom: 4, activeAdvance: 4, pose: 'strike', swingOnActive: true,
    impact: 'light', chain: { actionId: gagaActionIds.backhand, open: 10, close: 20 }
  },
  {
    id: gagaActionIds.backhand, name: '转身反拍', slot: 'A', posture: 'ground', linkOnly: true,
    startup: 6, active: 3, recovery: 14,
    hitbox: { x: 23, y: -83, w: 70, h: 49 },
    damage: 41, hitstun: 20, blockstun: 9, guardCost: 8, push: 3, lift: 0,
    stop: 2, advance: 11, advanceFrom: 4, activeAdvance: 3, pose: 'sweep', swingOnActive: true,
    impact: 'light', chain: { actionId: gagaActionIds.poleSweep, open: 12, close: 22 }
  },
  {
    id: gagaActionIds.poleSweep, name: '电线杆横扫', slot: 'A', posture: 'ground', linkOnly: true,
    startup: 11, active: 4, recovery: 18,
    hitbox: { x: 25, y: -99, w: 244, h: 62 },
    damage: 50, hitstun: 24, blockstun: 10, guardCost: 11, push: 4, lift: 0,
    stop: 3, advance: 10, advanceFrom: 8, pose: 'sweep', swingOnActive: true, swingLead: 2,
    impact: 'medium', chain: { actionId: gagaActionIds.poleBacksweep, open: 18, close: 32 }
  },
  {
    id: gagaActionIds.poleBacksweep, name: '电线杆反扫', slot: 'A', posture: 'ground', linkOnly: true,
    startup: 12, active: 4, recovery: 19,
    hitbox: { x: 25, y: -86, w: 243, h: 69 },
    damage: 44, hitstun: 24, blockstun: 9, guardCost: 9, push: 3, lift: 0,
    stop: 2, advance: 12, advanceFrom: 10, pose: 'sweep', swingOnActive: true, swingLead: 2,
    impact: 'light', chain: { actionId: gagaActionIds.poleLaunch, open: 19, close: 34 }
  },
  {
    id: gagaActionIds.poleLaunch, name: '电线杆挑飞', slot: 'A', posture: 'ground', linkOnly: true,
    startup: 15, active: 5, recovery: 22,
    hitbox: poleLaunchBox,
    hitTimeline: [{ from: 15, to: 20, group: 'pole-launch', boxes: [poleLaunchBox] }],
    feedback: { color: '#fff1c0', shake: 10, flash: .45 },
    damage: 114, hitstun: 27, blockstun: 14, guardCost: 18, push: 9, lift: 16, knockdown: true,
    stop: 5, advance: 13, advanceFrom: 12, activeAdvance: 5, pose: 'rise', swingOnActive: true, swingLead: 4,
    impact: 'heavy'
  }
];

export const gagaAirThrow: NormalMove = {
  id: gagaActionIds.airThrow, name: '空投电线杆', slot: 'A', posture: 'air',
  startup: 8, active: 1, recovery: 20,
  hitbox: { x: 0, y: 0, w: 0, h: 0 }, hitTimeline: [],
  projectile: { x: 48, y: -50, vx: 23, vy: 18, gravity: .55, reach: 175, radius: 10 },
  damage: 110, hitstun: 23, blockstun: 11, guardCost: 15, push: 13, lift: 0,
  stop: 4, advance: 2, advanceFrom: 5, activeAdvance: -4, pose: 'sweep', swingOnActive: true,
  impact: 'heavy'
};

export const gagaTurretActions: SignatureMove[] = [
  {
    id: gagaActionIds.turret, name: '部署双管炮塔', slot: 'C', energyCost: ENERGY_PER_STOCK, posture: 'ground',
    startup: 16, active: 1, recovery: 17,
    hitbox: { x: 0, y: 0, w: 0, h: 0 }, hitTimeline: [],
    projectile: { kind: 'crate', turret: 'bolt', x: 55, y: -102, vx: 9.5, vy: -9.5, gravity: .92, reach: 0, radius: 22, halfWidth: 34 },
    damage: 55, hitstun: 17, blockstun: 9, guardCost: 11, push: 6, lift: 0,
    stop: 3, advance: 0, swingOnActive: true, impact: 'medium', pose: 'strike'
  },
  {
    id: gagaActionIds.howitzer, name: '空投榴弹炮', slot: 'C', energyCost: ENERGY_PER_STOCK, posture: 'air',
    startup: 8, active: 1, recovery: 20,
    hitbox: { x: 0, y: 0, w: 0, h: 0 }, hitTimeline: [],
    projectile: { kind: 'crate', turret: 'howitzer', x: 48, y: -71, vx: 12, vy: 6, gravity: 1.1, reach: 0, radius: 23, halfWidth: 35 },
    damage: 55, hitstun: 17, blockstun: 9, guardCost: 11, push: 6, lift: 0,
    stop: 3, advance: 0, swingOnActive: true, impact: 'medium', pose: 'strike'
  },
  {
    id: gagaActionIds.turretBolt, name: '炮塔射击', slot: 'C', posture: 'any', linkOnly: true,
    startup: 0, active: 1, recovery: 0,
    hitbox: { x: 0, y: 0, w: 0, h: 0 }, hitTimeline: [],
    projectile: { kind: 'bolt', x: 26, y: -112, vx: 19, vy: 0, gravity: 0, reach: 0, radius: 6 },
    damage: 32, hitstun: 12, blockstun: 7, guardCost: 8, push: 5, lift: 0,
    stop: 2, advance: 0, impact: 'light', pose: 'strike'
  },
  {
    id: gagaActionIds.grenade, name: '榴弹', slot: 'C', posture: 'any', linkOnly: true,
    startup: 0, active: 1, recovery: 0,
    hitbox: { x: 0, y: 0, w: 0, h: 0 }, hitTimeline: [],
    projectile: { kind: 'grenade', blastRadius: 145, x: 32, y: -101, vx: 11.5, vy: -13, gravity: .84, reach: 0, radius: 8 },
    damage: 90, hitstun: 20, blockstun: 10, guardCost: 13, push: 12, lift: 0,
    stop: 3, advance: 0, impact: 'heavy', pose: 'strike'
  }
];

export const gagaSpecials: NormalMove[] = [
  {
    id: gagaActionIds.lift, name: '冲锋挑击', slot: 'A', direction: 'up', posture: 'ground',
    startup: 16, active: 3, recovery: 16,
    hitbox: { x: 29, y: -131, w: 48, h: 68 },
    damage: 95, hitstun: 27, blockstun: 12, guardCost: 16, push: 7, lift: 14,
    stop: 5, advance: 24, advanceFrom: 2, advanceUntil: 12, pose: 'rise', swingOnActive: true
  },
  {
    id: gagaActionIds.slide, name: '滑铲', slot: 'A', direction: 'down', posture: 'ground',
    startup: 11, active: 27, recovery: 21,
    hitbox: { x: 24, y: -91, w: 61, h: 80 },
    damage: 130, hitstun: 23, blockstun: 14, guardCost: 22, push: 14, lift: 0,
    stop: 5, advance: 7, advanceFrom: 7, activeAdvance: 28, pose: 'sweep', swingOnActive: true
  }
];

const dijiang: Omit<ActionDefinition, 'slot' | 'energyCost'> = {
  id: gagaActionIds.dijiang, name: '帝江', posture: 'ground', summon: true,
  startup: summonFallFrames, active: 1, recovery: 22,
  hitbox: { x: 0, y: 0, w: 0, h: 0 }, hitTimeline: [],
  damage: 320, hitstun: 30, blockstun: 0, guardCost: 0, push: 18, lift: 16, knockdown: true,
  stop: 6, advance: 0, impact: 'heavy', pose: 'rise'
};

export const gaga = defineFighter({
  id: 'gaga', name: '姑姑嘎嘎', accent: '#d7a5ff', height: 139,
  art: { portrait: 'gaga-arcade.webp', motion: 'gaga-motion.webp' },
  stats: { bodyWidth: 54 },
  normalMoves: [...gagaGroundCombo, ...gagaSpecials, gagaAirThrow],
  signatureMoves: gagaTurretActions,
  moveSummary: gagaComboNames.join(' → '),
  ultimate: { cost: MAX_ENERGY, move: dijiang, gain: { onHit: 12, onHurt: 18 } }
});

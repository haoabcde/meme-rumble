import { defineFighter, type NormalMove, type SignatureMove } from '../fighter-kit.js';
import { ENERGY_PER_STOCK, MAX_ENERGY, type ActionDefinition } from '../../core/types.js';

export const bananaActionIds = {
  jab: 'banana-left-scratch', backhand: 'banana-right-scratch', headbutt: 'banana-headbutt',
  cry: 'banana-cry-burst', lift: 'banana-tip-rise', slide: 'banana-tear-slide',
  tear: 'banana-air-tear', pressure: 'banana-high-pressure-tears', uppercut: 'banana-cry-uppercut',
  recharge: 'banana-cry-recharge', wave: 'banana-tilting-tear-sea'
} as const;

export const bananaAdditionalActionIds = {
  airClaw: 'banana-air-claw', airPressure: 'banana-air-pressure', burst: 'banana-close-burst'
} as const;

export const bananaComboNames = ['左爪挠挠', '右爪挠挠', '蕉头顶撞', '嚎啕震开'];
export const bananaWaveTitle = '泪海滔天';

const normalMoves: NormalMove[] = [
  {
    id: bananaActionIds.jab, name: '左爪挠挠', slot: 'A', posture: 'ground',
    startup: 4, active: 2, recovery: 11,
    hitbox: { x: 20, y: -95, w: 83, h: 57 },
    damage: 30, hitstun: 20, blockstun: 8, guardCost: 6, push: 2, lift: 0,
    stop: 2, advance: 5, advanceFrom: 2, activeAdvance: 2, pose: 'strike', swingOnActive: true,
    impact: 'light', cancelOnHit: [bananaActionIds.lift],
    chain: { actionId: bananaActionIds.backhand, open: 8, close: 16 }
  },
  {
    id: bananaActionIds.backhand, name: '右爪挠挠', slot: 'A', posture: 'ground', linkOnly: true,
    startup: 5, active: 2, recovery: 12,
    hitbox: { x: 18, y: -100, w: 90, h: 66 },
    damage: 34, hitstun: 26, blockstun: 9, guardCost: 7, push: 3, lift: 0,
    stop: 2, advance: 6, advanceFrom: 2, activeAdvance: 2, pose: 'sweep', swingOnActive: true,
    impact: 'light', cancelOnHit: [bananaActionIds.lift],
    chain: { actionId: bananaActionIds.headbutt, open: 10, close: 18 }
  },
  {
    id: bananaActionIds.headbutt, name: '蕉头顶撞', slot: 'A', posture: 'ground', linkOnly: true,
    startup: 9, active: 3, recovery: 16,
    hitbox: { x: 15, y: -113, w: 107, h: 85 },
    damage: 58, hitstun: 32, blockstun: 12, guardCost: 11, push: 6, lift: 0,
    stop: 3, advance: 12, advanceFrom: 3, pose: 'strike', swingOnActive: true,
    impact: 'medium', chain: { actionId: bananaActionIds.cry, open: 15, close: 27 }
  },
  {
    id: bananaActionIds.cry, name: '嚎啕震开', slot: 'A', posture: 'ground', linkOnly: true,
    startup: 13, active: 4, recovery: 22,
    hitbox: { x: -150, y: -125, w: 300, h: 125 },
    damage: 96, hitstun: 28, blockstun: 15, guardCost: 19, push: 20, lift: 0,
    stop: 5, advance: 0, pose: 'rise', swingOnActive: true, impact: 'heavy'
  },
  {
    id: bananaActionIds.lift, name: '向上挑击', slot: 'A', direction: 'up', posture: 'ground',
    startup: 10, active: 4, recovery: 18,
    hitbox: { x: 10, y: -178, w: 92, h: 151 },
    damage: 85, hitstun: 27, blockstun: 12, guardCost: 15, push: 5, lift: 15,
    stop: 4, advance: 4, advanceFrom: 6, pose: 'rise', swingOnActive: true, impact: 'heavy',
    cancelOnHit: ['jump']
  },
  {
    id: bananaActionIds.slide, name: '泪滑', slot: 'A', direction: 'down', posture: 'ground',
    startup: 8, active: 14, recovery: 18,
    hitbox: { x: 16, y: -67, w: 89, h: 61 },
    damage: 85, hitstun: 24, blockstun: 13, guardCost: 17, push: 12, lift: 0,
    stop: 4, advance: 0, activeAdvance: 24, pose: 'sweep', swingOnActive: true, impact: 'medium'
  },
  {
    id: bananaAdditionalActionIds.airClaw, name: '空中爪击', slot: 'A', posture: 'air',
    startup: 6, active: 3, recovery: 14, hitbox: { x: 18, y: -107, w: 86, h: 73 },
    damage: 40, hitstun: 18, blockstun: 8, guardCost: 8, push: 4, lift: 0,
    stop: 3, advance: 0, airControl: .45, pose: 'strike', swingOnActive: true, impact: 'light'
  }
];

const pressureBox = { x: 18, y: -109, w: 440, h: 48 };
const pressure: SignatureMove = {
  id: bananaActionIds.pressure, name: '高压眼泪', slot: 'B', posture: 'ground', tearCost: 20,
  channel: 'spray', slow: 45,
  startup: 4, active: 12, recovery: 14,
  hitbox: pressureBox,
  hitTimeline: [{ from: 4, to: 16, group: 'spray', boxes: [pressureBox] }],
  feedback: { color: '#8beaff', shake: 8 },
  damage: 32, hitstun: 8, blockstun: 5, guardCost: 5, push: 2, lift: 0,
  stop: 0, advance: 0, pose: 'strike', swingOnActive: true, impact: 'light'
};

const signatureMoves: SignatureMove[] = [
  pressure,
  { ...pressure, id: bananaAdditionalActionIds.airPressure, name: '空中高压眼泪', posture: 'air', direction: 'down' },
  {
    id: bananaActionIds.tear, name: '空中水球', slot: 'B', posture: 'air', tearCost: 10,
    startup: 6, active: 1, recovery: 14,
    hitbox: { x: 0, y: 0, w: 0, h: 0 }, hitTimeline: [],
    projectile: { kind: 'tear', x: 70, y: -51, vx: 20, vy: 6, gravity: 1, reach: 0, radius: 28, blastRadius: 120 },
    damage: 72, hitstun: 20, blockstun: 9, guardCost: 10, push: 9, lift: 0,
    stop: 3, advance: 0, pose: 'strike', swingOnActive: true, impact: 'medium'
  },
  {
    id: bananaActionIds.uppercut, name: '哭哭升龙', slot: 'B', direction: 'up', posture: 'any', tearCost: 35,
    startup: 6, active: 8, recovery: 20,
    hitbox: { x: -16, y: -492, w: 100, h: 404 },
    damage: 112, hitstun: 24, blockstun: 12, guardCost: 16, push: 8, lift: 18,
    stop: 4, advance: 0, pose: 'rise', swingOnActive: true, impact: 'heavy'
  },
  {
    id: bananaActionIds.recharge, name: '哭泣', slot: 'C', posture: 'any', tearCost: 0, channel: 'cry',
    startup: 0, active: 1, recovery: 8,
    hitbox: { x: 0, y: 0, w: 0, h: 0 }, hitTimeline: [],
    damage: 0, hitstun: 0, blockstun: 0, guardCost: 0, push: 0, lift: 0,
    stop: 0, advance: 0, pose: 'rise'
  }
];

const wave: Omit<ActionDefinition, 'slot' | 'energyCost'> = {
  id: bananaActionIds.wave, name: bananaWaveTitle, posture: 'ground',
  cutIn: { at: 14, duration: 50 },
  startup: 22, active: 1, recovery: 28,
  hitbox: { x: 0, y: 0, w: 0, h: 0 }, hitTimeline: [],
  projectile: { kind: 'wave', x: 105, y: -98, vx: 31, vy: 0, gravity: 0,
    reach: 0, radius: 98, halfWidth: 104, life: 40 },
  damage: 240, hitstun: 34, blockstun: 18, guardCost: 28, push: 27, lift: 15, knockdown: true,
  stop: 6, advance: 0, pose: 'rise', swingOnActive: true, impact: 'heavy'
};

const burst: Omit<ActionDefinition, 'slot' | 'energyCost'> = {
  id: bananaAdditionalActionIds.burst, name: '回身泪爆', direction: 'up', posture: 'ground',
  startup: 7, active: 3, recovery: 19,
  hitbox: { x: -94, y: -123, w: 188, h: 120 }, radial: true,
  damage: 108, hitstun: 26, blockstun: 13, guardCost: 22, push: 13, lift: 0,
  stop: 5, advance: 0, pose: 'rise', impact: 'medium', feedback: { color: '#8beaff', shake: 4 }
};

export const banana = defineFighter({
  id: 'banana', name: '香蕉猫', accent: '#ff9c62', height: 145,
  art: { portrait: 'unified-handdrawn-v1/banana.webp', motion: 'banana-motion.webp' },
  stats: { usesTears: true, bodyWidth: 54 },
  normalMoves, signatureMoves,
  moveSummary: bananaComboNames.join(' → '),
  ultimate: { cost: MAX_ENERGY, move: wave, gain: { onHit: 12, onHurt: 18 },
    variants: [{ cost: ENERGY_PER_STOCK, move: burst }] }
});

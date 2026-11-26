import { defineFighter, type NormalMove, type SignatureMove } from '../fighter-kit.js';
import { MAX_ENERGY, type ActionDefinition } from '../../core/types.js';

export const bananaActionIds = {
  jab: 'banana-left-scratch', backhand: 'banana-right-scratch', headbutt: 'banana-headbutt',
  cry: 'banana-cry-burst', lift: 'banana-tip-rise', slide: 'banana-tear-slide',
  tear: 'banana-air-tear', pressure: 'banana-high-pressure-tears', uppercut: 'banana-cry-uppercut',
  recharge: 'banana-cry-recharge', wave: 'banana-tilting-tear-sea',
  joAwaken: 'banana-jo-awaken',
  joJab: 'banana-jo-jab', joCross: 'banana-jo-cross', joPounce: 'banana-jo-pounce',
  joUppercut: 'banana-jo-uppercut', joOra: 'banana-jo-ora',
  joLift: 'banana-jo-lift', joSlide: 'banana-jo-slide',
  joSheerHeart: 'banana-jo-sheer-heart', joAntiAir: 'banana-jo-anti-air',
  kqBomb: 'banana-kq-bomb', kqDetonate: 'banana-kq-detonate',
  joAirDive: 'banana-jo-air-dive',
  theWorld: 'banana-the-world'
} as const;

export const bananaComboNames = ['左爪挠挠', '右爪挠挠', '蕉头顶撞', '嚎啕震开'];
export const bananaWaveTitle = 'JO化觉醒';

const normalMoves: NormalMove[] = [
  {
    id: bananaActionIds.jab, name: '左爪挠挠', slot: 'A', posture: 'ground',
    startup: 4, active: 2, recovery: 11,
    hitbox: { x: 20, y: -95, w: 83, h: 57 },
    damage: 30, hitstun: 20, blockstun: 8, guardCost: 6, push: 2, lift: 0,
    stop: 2, advance: 5, advanceFrom: 2, activeAdvance: 2, pose: 'strike', swingOnActive: true,
    impact: 'light', joReplacement: bananaActionIds.joJab,
    chain: { actionId: bananaActionIds.backhand, open: 8, close: 16 }
  },
  {
    id: bananaActionIds.backhand, name: '右爪挠挠', slot: 'A', posture: 'ground', linkOnly: true,
    startup: 5, active: 2, recovery: 12,
    hitbox: { x: 18, y: -100, w: 90, h: 66 },
    damage: 34, hitstun: 26, blockstun: 9, guardCost: 7, push: 3, lift: 0,
    stop: 2, advance: 6, advanceFrom: 2, activeAdvance: 2, pose: 'sweep', swingOnActive: true,
    impact: 'light', chain: { actionId: bananaActionIds.headbutt, open: 10, close: 18 }
  },
  {
    id: bananaActionIds.headbutt, name: '蕉头顶撞', slot: 'A', posture: 'ground', linkOnly: true,
    startup: 9, active: 3, recovery: 16,
    hitbox: { x: 15, y: -113, w: 107, h: 85 },
    damage: 58, hitstun: 32, blockstun: 12, guardCost: 11, push: 6, lift: 0,
    stop: 3, advance: 26, advanceFrom: 3, activeAdvance: 22, pose: 'strike', swingOnActive: true,
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
    joReplacement: bananaActionIds.joLift
  },
  {
    id: bananaActionIds.joLift, name: '白金升龙拳', slot: 'A', direction: 'up', posture: 'ground', linkOnly: true,
    rise: { at: 5, vx: 5, vy: 17 },
    startup: 5, active: 14, recovery: 11,
    hitbox: { x: 8, y: -215, w: 136, h: 195 },
    damage: 92, hitstun: 34, blockstun: 13, guardCost: 16, push: 6, lift: 18,
    stop: 4, advance: 4, advanceFrom: 1, pose: 'rise', swingOnActive: true,
    standAttack: 'uppercut', impact: 'heavy', cancelOnHit: ['A', 'C'],
    feedback: { color: '#fde047', shake: 11, flash: .65, sound: 'heavy' }
  },
  {
    id: bananaActionIds.slide, name: '泪滑', slot: 'A', direction: 'down', posture: 'ground',
    startup: 8, active: 14, recovery: 18,
    hitbox: { x: 16, y: -67, w: 89, h: 61 },
    damage: 85, hitstun: 24, blockstun: 13, guardCost: 17, push: 12, lift: 0,
    stop: 4, advance: 0, activeAdvance: 24, pose: 'sweep', swingOnActive: true, impact: 'medium',
    joReplacement: bananaActionIds.joSlide
  },
  {
    id: bananaActionIds.joSlide, name: '白金破空滑铲', slot: 'A', direction: 'down', posture: 'ground', linkOnly: true,
    startup: 8, active: 14, recovery: 18,
    hitbox: { x: 16, y: -74, w: 120, h: 68 },
    damage: 94, hitstun: 28, blockstun: 13, guardCost: 17, push: 12, lift: 0,
    stop: 4, advance: 0, activeAdvance: 24, pose: 'sweep', swingOnActive: true,
    standAttack: 'slide', impact: 'heavy', cancelOnHit: ['C'],
    feedback: { color: '#d946ef', shake: 9, flash: .5, sound: 'heavy' }
  },
  {
    id: bananaActionIds.tear, name: '空中水球', slot: 'A', posture: 'air', tearCost: 10,
    startup: 6, active: 1, recovery: 14,
    hitbox: { x: 0, y: 0, w: 0, h: 0 }, hitTimeline: [],
    projectile: { kind: 'tear', x: 70, y: -51, vx: 20, vy: 6, gravity: 1, reach: 0, radius: 28, blastRadius: 120 },
    damage: 72, hitstun: 20, blockstun: 9, guardCost: 10, push: 9, lift: 0,
    stop: 3, advance: 0, pose: 'strike', swingOnActive: true, impact: 'medium',
    joReplacement: bananaActionIds.joAirDive
  },
  {
    id: bananaActionIds.joAirDive, name: '白金流星俯冲', slot: 'A', posture: 'air', linkOnly: true,
    dive: { vx: 16, vy: 16, piercePlatforms: true, carryTarget: true },
    startup: 5, active: 72, recovery: 12,
    hitbox: { x: -12, y: -116, w: 132, h: 116 },
    damage: 96, hitstun: 30, blockstun: 14, guardCost: 18, push: 10, lift: 0,
    stop: 5, advance: 0, pose: 'air', swingOnActive: true, standAttack: 'dive', impact: 'heavy',
    feedback: { color: '#fde047', shake: 12, flash: .65, sound: 'heavy' }
  },
  {
    id: bananaActionIds.joJab, name: 'JO直拳', slot: 'A', posture: 'ground', linkOnly: true,
    startup: 4, active: 3, recovery: 11,
    hitbox: { x: 20, y: -112, w: 276, h: 80 },
    damage: 42, hitstun: 22, blockstun: 9, guardCost: 8, push: 3, lift: 0,
    stop: 2, advance: 20, advanceFrom: 2, activeAdvance: 6, pose: 'strike', swingOnActive: true,
    standAttack: 'jab', impact: 'medium', cancelOnHit: ['C'],
    feedback: { color: '#d946ef', shake: 6, sound: 'sharp' },
    chain: { actionId: bananaActionIds.joCross, open: 7, close: 17 }
  },
  {
    id: bananaActionIds.joCross, name: 'JO重摆拳', slot: 'A', posture: 'ground', linkOnly: true,
    startup: 5, active: 3, recovery: 12,
    hitbox: { x: 18, y: -116, w: 296, h: 86 },
    damage: 48, hitstun: 26, blockstun: 10, guardCost: 10, push: 4, lift: 0,
    stop: 3, advance: 22, advanceFrom: 2, activeAdvance: 6, pose: 'sweep', swingOnActive: true,
    standAttack: 'hook', impact: 'medium', cancelOnHit: ['C'],
    feedback: { color: '#fde047', shake: 8, sound: 'heavy' },
    chain: { actionId: bananaActionIds.joPounce, open: 9, close: 19 }
  },
  {
    id: bananaActionIds.joPounce, name: 'JO飞扑', slot: 'A', posture: 'ground', linkOnly: true,
    startup: 4, active: 8, recovery: 14,
    hitbox: { x: -30, y: -113, w: 150, h: 85 },
    damage: 62, hitstun: 34, blockstun: 12, guardCost: 12, push: 4, lift: 0,
    stop: 3, advance: 18, advanceFrom: 2, activeAdvance: 30, passThrough: true,
    pose: 'strike', swingOnActive: true, impact: 'medium', cancelOnHit: ['C'],
    feedback: { color: '#c084fc', shake: 7, sound: 'sharp' },
    chain: { actionId: bananaActionIds.joUppercut, open: 12, close: 25, requiresHit: true }
  },
  {
    id: bananaActionIds.joUppercut, name: 'JO上钩拳', slot: 'A', posture: 'ground', linkOnly: true,
    startup: 8, active: 4, recovery: 18,
    hitbox: { x: -16, y: -175, w: 175, h: 145 },
    damage: 74, hitstun: 36, blockstun: 13, guardCost: 14, push: 5, lift: 17, liftRequiresPrevHit: true,
    stop: 4, advance: 9, advanceFrom: 2, pose: 'rise', swingOnActive: true,
    standAttack: 'uppercut', impact: 'heavy', cancelOnHit: ['C'],
    feedback: { color: '#fde047', shake: 11, flash: .6, sound: 'heavy' },
    chain: { actionId: bananaActionIds.joOra, open: 12, close: 28 }
  },
  {
    id: bananaActionIds.joOra, name: '白金欧拉', slot: 'A', posture: 'ground', linkOnly: true,
    startup: 8, active: 36, recovery: 18,
    hitbox: { x: -20, y: -130, w: 150, h: 110 },
    hitTimeline: [
      { from: 8, to: 11, group: 'ora-1', boxes: [{ x: -20, y: -130, w: 150, h: 110 }], damage: 18, hitstun: 16, push: 1, lift: 1, stop: 1 },
      { from: 12, to: 15, group: 'ora-2', boxes: [{ x: -20, y: -130, w: 150, h: 110 }], damage: 18, hitstun: 16, push: 1, lift: 1, stop: 1 },
      { from: 16, to: 19, group: 'ora-3', boxes: [{ x: -20, y: -130, w: 150, h: 110 }], damage: 18, hitstun: 16, push: 1, lift: 1, stop: 1 },
      { from: 20, to: 23, group: 'ora-4', boxes: [{ x: -20, y: -130, w: 150, h: 110 }], damage: 18, hitstun: 16, push: 1, lift: 1, stop: 1 },
      { from: 24, to: 27, group: 'ora-5', boxes: [{ x: -20, y: -130, w: 150, h: 110 }], damage: 18, hitstun: 18, push: 1, lift: 1, stop: 1 },
      { from: 36, to: 44, group: 'ora-finish', boxes: [{ x: -20, y: -140, w: 185, h: 135 }], damage: 95, hitstun: 34, blockstun: 16, guardCost: 22, push: 28, lift: 16, knockdown: true, stop: 8 }
    ],
    damage: 18, hitstun: 18, blockstun: 10, guardCost: 6, push: 2, lift: 0,
    stop: 2, advance: 0, pose: 'finish', swingOnActive: true, standAttack: 'ora', impact: 'heavy',
    feedback: { color: '#fde047', shake: 18, flash: 1, sound: 'heavy' }
  }
];

const pressureBox = { x: 18, y: -109, w: 440, h: 48 };

const signatureMoves: SignatureMove[] = [
  {
    id: bananaActionIds.pressure, name: '高压眼泪', slot: 'B', posture: 'any', tearCost: 20,
    channel: 'spray', slow: 45,
    startup: 4, active: 12, recovery: 14,
    hitbox: pressureBox,
    hitTimeline: [{ from: 4, to: 16, group: 'spray', boxes: [pressureBox] }],
    feedback: { color: '#8beaff', shake: 8 },
    damage: 32, hitstun: 8, blockstun: 5, guardCost: 5, push: 2, lift: 0,
    stop: 0, advance: 0, pose: 'strike', swingOnActive: true, impact: 'light',
    joReplacement: bananaActionIds.joSheerHeart
  },
  {
    id: bananaActionIds.joSheerHeart, name: '第二炸弹·枯萎穿心攻击', slot: 'B', posture: 'any', linkOnly: true,
    tearCost: 0, energyGain: 28, cancelOnHit: ['C'],
    startup: 5, active: 2, recovery: 12,
    hitbox: { x: 0, y: 0, w: 0, h: 0 }, hitTimeline: [],
    projectile: {
      kind: 'sheer-heart', x: 52, y: -12, vx: 4.6, vy: 0, gravity: 1, reach: 0,
      radius: 24, blastRadius: 165, life: 210
    },
    damage: 112, hitstun: 30, blockstun: 14, guardCost: 22, push: 16, lift: 14,
    stop: 6, advance: 0, pose: 'strike', swingOnActive: true, standAttack: 'sheer-heart', impact: 'heavy',
    feedback: { color: '#fde047', shake: 14, flash: .85, sound: 'heavy' }
  },
  {
    id: bananaActionIds.uppercut, name: '哭哭升龙', slot: 'B', direction: 'up', posture: 'any', tearCost: 35,
    startup: 6, active: 8, recovery: 20,
    hitbox: { x: -16, y: -492, w: 100, h: 404 },
    damage: 112, hitstun: 24, blockstun: 12, guardCost: 16, push: 8, lift: 18,
    stop: 4, advance: 0, pose: 'rise', swingOnActive: true, impact: 'heavy',
    joReplacement: bananaActionIds.joAntiAir
  },
  {
    id: bananaActionIds.joAntiAir, name: '白金·空压连殴', slot: 'B', direction: 'up', posture: 'any', linkOnly: true,
    tearCost: 0, energyGain: 12, cancelOnHit: ['jump', 'C'],
    startup: 4, active: 14, recovery: 14,
    hitbox: { x: -12, y: -440, w: 156, h: 410 },
    hitTimeline: [
      { from: 4, to: 7, group: 'aa-1', boxes: [{ x: -12, y: -220, w: 136, h: 190 }], damage: 34, hitstun: 22, push: 2, lift: 12, stop: 2 },
      { from: 8, to: 11, group: 'aa-2', boxes: [{ x: -12, y: -330, w: 144, h: 260 }], damage: 36, hitstun: 24, push: 2, lift: 15, stop: 2 },
      { from: 12, to: 17, group: 'aa-3', boxes: [{ x: -12, y: -440, w: 156, h: 350 }], damage: 48, hitstun: 34, push: 5, lift: 21, stop: 4 }
    ],
    damage: 34, hitstun: 24, blockstun: 12, guardCost: 16, push: 4, lift: 18,
    stop: 4, advance: 0, pose: 'rise', swingOnActive: true, standAttack: 'upper-ora', impact: 'heavy',
    feedback: { color: '#fde047', shake: 11, flash: .55, sound: 'heavy' }
  },
  {
    id: bananaActionIds.recharge, name: '哭泣', slot: 'C', posture: 'any', tearCost: 0, channel: 'cry',
    joReplacement: bananaActionIds.kqBomb,
    joDetonateReplacement: bananaActionIds.kqDetonate,
    startup: 0, active: 1, recovery: 8,
    hitbox: { x: 0, y: 0, w: 0, h: 0 }, hitTimeline: [],
    damage: 0, hitstun: 0, blockstun: 0, guardCost: 0, push: 0, lift: 0,
    stop: 0, advance: 0, pose: 'rise'
  },
  {
    id: bananaActionIds.kqBomb, name: '第一炸弹·炸弹硬币', slot: 'C', posture: 'any', linkOnly: true,
    startup: 5, active: 2, recovery: 12,
    hitbox: { x: 0, y: 0, w: 0, h: 0 }, hitTimeline: [],
    projectile: { kind: 'kq-orb', x: 56, y: -76, vx: 8.5, vy: 0, gravity: 0, reach: 0,
      radius: 26, blastRadius: 155, homing: .35, markFrames: 240, life: 165 },
    damage: 25, hitstun: 16, blockstun: 10, guardCost: 14, push: 3, lift: 0,
    stop: 2, advance: 0, pose: 'strike', swingOnActive: true, impact: 'light',
    feedback: { color: '#fde047', shake: 5, sound: 'sharp' }
  },
  {
    id: bananaActionIds.kqDetonate, name: '第一炸弹·起爆', slot: 'C', posture: 'any', linkOnly: true,
    detonateBomb: true,
    startup: 3, active: 2, recovery: 11,
    hitbox: { x: 0, y: 0, w: 0, h: 0 }, hitTimeline: [],
    damage: 115, hitstun: 32, blockstun: 14, guardCost: 24, push: 18, lift: 14, knockdown: true,
    stop: 6, advance: 0, pose: 'strike', swingOnActive: true, impact: 'heavy',
    feedback: { color: '#fde047', shake: 16, flash: .9, sound: 'heavy' }
  }
];

const joAwaken: Omit<ActionDefinition, 'slot' | 'energyCost'> = {
  id: bananaActionIds.joAwaken, name: bananaWaveTitle, posture: 'ground',
  awakenJo: true, cutIn: { at: 6, duration: 68 },
  startup: 14, active: 2, recovery: 16,
  hitbox: { x: -160, y: -150, w: 320, h: 150 },
  damage: 80, hitstun: 28, blockstun: 14, guardCost: 20, push: 24, lift: 10,
  stop: 5, advance: 0, pose: 'rise', swingOnActive: true, impact: 'heavy'
};

const theWorld: Omit<ActionDefinition, 'slot' | 'energyCost'> = {
  id: bananaActionIds.theWorld, name: '世界·时间停止', posture: 'ground',
  requiresJo: true, timeStop: { teleportAt: 90, flickAt: 135, releaseAt: 246 },
  startup: 246, active: 1, recovery: 16,
  hitbox: { x: 0, y: 0, w: 0, h: 0 }, hitTimeline: [],
  damage: 260, hitstun: 38, blockstun: 20, guardCost: 30, push: 34, lift: 18, knockdown: true,
  stop: 8, advance: 0, pose: 'finish', swingOnActive: true, impact: 'heavy',
  feedback: { color: '#fde047', shake: 22, flash: 1, sound: 'heavy' }
};

export const banana = defineFighter({
  id: 'banana', name: '香蕉猫', accent: '#ff9c62', height: 145,
  art: { portrait: 'banana-reference-portrait.webp', motion: 'banana-motion.webp' },
  stats: { usesTears: true, bodyWidth: 54 },
  normalMoves, signatureMoves,
  moveSummary: bananaComboNames.join(' → '),
  ultimate: { cost: MAX_ENERGY, move: joAwaken, variants: [{ cost: MAX_ENERGY, move: theWorld }], gain: { onHit: 12, onHurt: 18 } }
});

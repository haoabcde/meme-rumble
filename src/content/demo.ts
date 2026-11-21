import { TICK_RATE, type FighterDefinition, type Ruleset } from '../core/types.js';

export const rules: Ruleset = {
  ticksPerSecond: TICK_RATE,
  roundSeconds: 60,
  winsToFinish: 2,
  guardMax: 100,
  guardDelay: 60,
  guardBreak: 45,
  dashGuardCost: { ground: 20, air: 30 },
  dashInvulnerable: true,
  dashPassThrough: true,
  airDashPauseGravity: true,
  inputBuffer: 6,
  comboControlLimit: 180
};

// Development fixture for rules that future character kits may exercise.
export const testFighter: FighterDefinition = {
  id: 'practice-dummy',
  name: '训练体',
  maxHp: 1000,
  run: 7,
  airSpeed: 8,
  jump: 19,
  dash: 22,
  hurtbox: { x: -28, y: -116, w: 56, h: 116 },
  bodyWidth: 52,
  actions: [
    {
      id: 'test-a', slot: 'A', posture: 'any',
      startup: 5, active: 4, recovery: 10,
      hitbox: { x: 13, y: -97, w: 73, h: 52 },
      damage: 100, hitstun: 20, blockstun: 11, guardCost: 16, push: 8, lift: 0,
      stop: 3, advance: 3, cancelOnHit: ['B', 'C'], pose: 'strike'
    },
    {
      id: 'test-rise', slot: 'A', direction: 'up', posture: 'ground',
      startup: 8, active: 5, recovery: 18,
      hitbox: { x: 3, y: -163, w: 86, h: 124 },
      damage: 150, hitstun: 27, blockstun: 15, guardCost: 24, push: 7, lift: 13,
      stop: 5, advance: 3, pose: 'rise'
    },
    {
      id: 'test-b', slot: 'B', posture: 'any',
      startup: 9, active: 5, recovery: 16,
      hitbox: { x: 14, y: -104, w: 110, h: 73 },
      damage: 165, hitstun: 24, blockstun: 15, guardCost: 25, push: 13, lift: 0,
      stop: 4, advance: 5, pose: 'strike'
    },
    {
      id: 'test-c', slot: 'C', posture: 'ground',
      startup: 14, active: 6, recovery: 24,
      hitbox: { x: 8, y: -85, w: 150, h: 76 },
      damage: 235, hitstun: 30, blockstun: 18, guardCost: 38, push: 17, lift: 9,
      stop: 6, advance: 5, pose: 'sweep'
    }
  ]
};


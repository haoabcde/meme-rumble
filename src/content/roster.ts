import type { ActionDefinition, FighterDefinition } from '../core/types.js';

export interface RosterEntry {
  fighter: FighterDefinition;
  accent: string;
  height: number;
}

// 公共动作适用于所有角色。B/C 仍给各角色的专属技能使用。
export const basicAttack: ActionDefinition = {
  id: 'common-jab', name: '直拳', slot: 'A', posture: 'ground',
  startup: 5, active: 3, recovery: 13,
  hitbox: { x: 12, y: -101, w: 100, h: 62 },
  damage: 90, hitstun: 21, blockstun: 7, guardCost: 13, push: 6, lift: 0,
  stop: 4, advance: 4, cancelOnHit: ['common-sweep', 'common-launch'], pose: 'strike'
};

const commonActions: ActionDefinition[] = [
  basicAttack,
  {
    id: 'common-sweep', name: '扫击', slot: 'A', posture: 'ground', linkOnly: true,
    startup: 6, active: 4, recovery: 14,
    hitbox: { x: 8, y: -95, w: 126, h: 72 },
    damage: 105, hitstun: 24, blockstun: 9, guardCost: 17, push: 8, lift: 0,
    stop: 4, advance: 6, cancelOnHit: ['common-finish', 'common-launch'], pose: 'sweep'
  },
  {
    id: 'common-finish', name: '重推', slot: 'A', posture: 'ground', linkOnly: true,
    startup: 7, active: 4, recovery: 19,
    hitbox: { x: 21, y: -110, w: 136, h: 84 },
    damage: 135, hitstun: 26, blockstun: 11, guardCost: 23, push: 14, lift: 8, knockdown: true,
    stop: 6, advance: 7, pose: 'finish'
  },
  {
    id: 'common-launch', name: '挑空', slot: 'A', direction: 'up', posture: 'ground',
    startup: 8, active: 4, recovery: 20,
    hitbox: { x: 6, y: -166, w: 106, h: 132 },
    damage: 100, hitstun: 34, blockstun: 10, guardCost: 20, push: 6, lift: 16,
    stop: 5, advance: 4, cancelOnHit: ['jump'], pose: 'rise'
  },
  {
    id: 'common-air', name: '空中踢', slot: 'A', posture: 'air',
    startup: 5, active: 5, recovery: 12,
    hitbox: { x: 15, y: -96, w: 119, h: 104 },
    damage: 115, hitstun: 21, blockstun: 9, guardCost: 18, push: 8, lift: 0,
    stop: 4, advance: 4, airControl: .5, pose: 'air'
  }
];

function fighter(id: string, name: string, signatureMoves: ActionDefinition[] = []): FighterDefinition {
  return {
    id, name, maxHp: 1000,
    run: 8, airSpeed: 9, jump: 18, dash: 23, airDash: true, airJump: 13,
    hurtbox: { x: -28, y: -114, w: 56, h: 114 },
    bodyWidth: 72, actions: [...commonActions, ...signatureMoves]
  };
}

export const roster: RosterEntry[] = [
  { fighter: fighter('whale', 'DeepSeek 鲸鱼娘'), accent: '#75a9ff', height: 142 },
  { fighter: fighter('frog', '奶蛙'), accent: '#ffcf54', height: 130 },
  { fighter: fighter('banana', '香蕉猫'), accent: '#ff9c62', height: 145 },
  { fighter: fighter('gaga', '姑姑嘎嘎'), accent: '#d7a5ff', height: 139 }
];

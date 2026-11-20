import type { ActionDefinition, FighterDefinition } from '../core/types.js';
import { gagaAirThrow, gagaComboNames, gagaGroundCombo, gagaSpecials, gagaTurretActions } from './gaga.js';

export interface RosterEntry {
  fighter: FighterDefinition;
  accent: string;
  height: number;
  moveSummary?: string;
}

// 其余三名角色共用的基础攻击。
export const basicAttack: ActionDefinition = {
  id: 'common-strike', slot: 'A', posture: 'any',
  startup: 6, active: 4, recovery: 12,
  hitbox: { x: 15, y: -102, w: 99, h: 62 },
  damage: 160, hitstun: 22, blockstun: 12, guardCost: 20, push: 10, lift: 0,
  stop: 4, advance: 3, pose: 'strike'
};

function fighter(id: string, name: string, actions: ActionDefinition[] = [basicAttack]): FighterDefinition {
  return {
    id, name, maxHp: 1000,
    run: 8, airSpeed: 9, jump: 18, dash: 23,
    hurtbox: { x: -28, y: -114, w: 56, h: 114 },
    bodyWidth: 54, actions
  };
}

export const roster: RosterEntry[] = [
  { fighter: fighter('whale', 'DeepSeek 鲸鱼娘'), accent: '#75a9ff', height: 142 },
  { fighter: fighter('frog', '奶蛙'), accent: '#ffcf54', height: 130 },
  { fighter: fighter('banana', '香蕉猫'), accent: '#ff9c62', height: 145 },
  {
    fighter: fighter('gaga', '姑姑嘎嘎', [...gagaGroundCombo, ...gagaSpecials, gagaAirThrow, ...gagaTurretActions]),
    accent: '#d7a5ff', height: 139, moveSummary: gagaComboNames.join(' → ')
  }
];

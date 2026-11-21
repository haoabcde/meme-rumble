import { MAX_ENERGY, type ActionDefinition, type Box, type CounterStance, type FighterAction,
  type FighterDefinition, type UltimateGain } from '../core/types.js';

export const motionGrid = {
  columns: 4, defaultRows: 3, cell: 216, footX: 108, footY: 184, referenceHeight: 144
} as const;

export interface FighterArt {
  /** WebP paths relative to assets/fighters/. */
  portrait: string;
  motion: string;
}

export interface RosterEntry {
  fighter: FighterDefinition;
  accent: string;
  height: number;
  art: FighterArt;
}

export type SignatureMove = (ActionDefinition & { slot: 'B' | 'C' }) | CounterStance;

export interface FighterPackage {
  id: string;
  name: string;
  accent: string;
  height: number;
  art: FighterArt;
  stats?: Partial<Omit<FighterDefinition, 'id' | 'name' | 'actions' | 'guardCounter' | 'ultimateCost' | 'ultimateGain'>>;
  signatureMoves: SignatureMove[];
  guardCounter?: FighterDefinition['guardCounter'];
  ultimate?: { cost: number; gain?: UltimateGain; move: Omit<ActionDefinition, 'slot'> };
  /** Additional destinations after a shared attack lands, applied to this fighter only. */
  extraCancels?: Record<string, string[]>;
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

function validBox(box: Box) {
  return [box.x, box.y, box.w, box.h].every(Number.isFinite) && box.w > 0 && box.h > 0;
}

function validEnergy(value: number) {
  return Number.isInteger(value) && value >= 0 && value <= MAX_ENERGY;
}

function validateCounterTarget(owner: string, targetId: string, actions: FighterAction[]) {
  const target = actions.find(action => action.id === targetId);
  if (!target || 'counterTo' in target || target.posture === 'air' || target.slot === 'ULT') {
    throw Error(owner + ' 的防反必须指向本角色可在地面发动的非大招攻击：' + targetId);
  }
}

function validateMoves(owner: string, actions: FighterAction[]) {
  const ids = new Set<string>();
  for (const action of actions) {
    const where = owner + ' / ' + action.id;
    if (!action.id || ids.has(action.id)) throw Error(where + ' 的动作 ID 为空或重复');
    ids.add(action.id);
    if (![action.startup, action.active, action.recovery].every(Number.isInteger) ||
        action.startup < 0 || action.active < 1 || action.recovery < 0) {
      throw Error(where + ' 的动作帧数无效');
    }
    if ('counterTo' in action) {
      if (action.posture !== 'ground' || !['B', 'C'].includes(action.slot)) {
        throw Error(where + ' 的防反架势须使用地面 B/C 槽');
      }
      validateCounterTarget(where, action.counterTo, actions);
    } else {
      if (!validBox(action.hitbox)) throw Error(where + ' 的攻击框坐标或宽高无效');
      if (![action.hitstun, action.blockstun, action.stop].every(n => Number.isInteger(n) && n >= 0) ||
        ![action.damage, action.guardCost].every(n => Number.isFinite(n) && n >= 0) ||
        ![action.push, action.lift, action.advance, action.airControl ?? 0].every(Number.isFinite)) {
        throw Error(where + ' 的命中、位移或硬直参数无效');
      }
    }
    let previous = -1;
    const duration = action.startup + action.active + action.recovery;
    for (const key of action.animation ?? []) {
      if (!Number.isInteger(key.frame) || key.frame <= previous || key.frame >= duration ||
          !Number.isInteger(key.cell) || key.cell < 0) throw Error(where + ' 的动画帧序列无效');
      previous = key.frame;
    }
  }
  const legalTargets = new Set([...ids, 'A', 'B', 'C', 'jump']);
  if (actions.some(action => action.slot === 'ULT')) legalTargets.add('ULT');
  for (const action of actions) {
    for (const target of action.cancelOnHit ?? []) {
      if (!legalTargets.has(target)) throw Error(owner + ' / ' + action.id + ' 引用了未知的取消目标 ' + target);
    }
  }
}

export function defineFighter(spec: FighterPackage): RosterEntry {
  const { id, name, accent, height, art, stats, signatureMoves, guardCounter, ultimate, extraCancels = {} } = spec;
  for (const source of Object.keys(extraCancels)) {
    if (!commonActions.some(move => move.id === source)) throw Error(id + ' 找不到公共动作 ' + source);
  }
  const shared = commonActions.map(move => {
    const extra = extraCancels[move.id];
    return extra ? { ...move, cancelOnHit: [...new Set([...(move.cancelOnHit ?? []), ...extra])] } : move;
  });
  const actions: FighterAction[] = [...shared, ...signatureMoves];
  if (ultimate) {
    if (!validEnergy(ultimate.cost)) {
      throw Error(id + ' 的大招消耗须为 0–' + MAX_ENERGY + ' 的整数');
    }
    if (!validEnergy(ultimate.gain?.onHit ?? 0) || !validEnergy(ultimate.gain?.onHurt ?? 0)) {
      throw Error(id + ' 的大招能量增量须为 0–' + MAX_ENERGY + ' 的整数');
    }
    actions.push({ ...ultimate.move, slot: 'ULT' });
  }
  validateMoves(id, actions);
  if (guardCounter) {
    if (!Number.isSafeInteger(guardCounter.windowFrames) || guardCounter.windowFrames < 1) {
      throw Error(id + ' 的防反窗口须为正整数帧');
    }
    validateCounterTarget(id, guardCounter.actionId, actions);
  }
  const fighter: FighterDefinition = {
    maxHp: 1000, run: 8, airSpeed: 9, jump: 18, dash: 23, airDash: true, airJump: 13,
    hurtbox: { x: -28, y: -114, w: 56, h: 114 }, bodyWidth: 72,
    ...stats, id, name, actions, guardCounter, ultimateCost: ultimate?.cost, ultimateGain: ultimate?.gain
  };
  if (!id.trim() || !name.trim() || !Number.isFinite(height) || height <= 0 ||
      !Number.isFinite(fighter.maxHp) || fighter.maxHp <= 0) {
    throw Error(id + ' 的角色 ID、名称、显示高度或生命值无效');
  }
  if (!validBox(fighter.hurtbox) || ![fighter.bodyWidth, fighter.run, fighter.airSpeed, fighter.jump,
    fighter.dash, fighter.airJump ?? 0].every(n => Number.isFinite(n) && n >= 0)) {
    throw Error(id + ' 的受击框、身体宽度或移动数值无效');
  }
  return { fighter, accent, height, art };
}

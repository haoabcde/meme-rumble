import { MAX_ENERGY, type ActionAudioCue, type ActionDefinition, type AudioClipRef, type Box, type BoxWindow,
  type CounterStance, type FighterAction, type FighterDefinition, type HitFeedback, type UltimateGain } from '../core/types.js';
import { validateEntities } from '../core/entities.js';

export const motionGrid = {
  columns: 4, defaultRows: 3, cell: 216, footX: 108, footY: 184, referenceHeight: 144
} as const;

export interface FighterArt {
  /** WebP paths relative to assets/fighters/. */
  portrait: string;
  motion: string;
  /** Source-pixel density; logical cells and foot anchors stay at 216 and (108, 184). */
  motionScale?: 1 | 2 | 3 | 4;
}

export interface FighterAudioClip {
  /** Project-relative path under assets/audio/. */
  src: string;
  volume?: number;
}

export type FighterAudioBank = Record<string, FighterAudioClip>;

export interface RosterEntry {
  fighter: FighterDefinition;
  accent: string;
  height: number;
  art: FighterArt;
  audio?: FighterAudioBank;
  moveSummary?: string;
}

export type NormalMove = ActionDefinition & { slot: 'A' };
export type SignatureMove = (ActionDefinition & { slot: 'B' | 'C' }) | CounterStance;

interface UltimateMove {
  cost: number;
  move: Omit<ActionDefinition, 'slot' | 'energyCost'>;
}

export interface FighterPackage {
  commonMoves?: ActionDefinition[];
  id: string;
  name: string;
  accent: string;
  height: number;
  art: FighterArt;
  audio?: FighterAudioBank;
  stats?: Partial<Omit<FighterDefinition, 'id' | 'name' | 'actions' | 'guardCounter' | 'ultimateCost' | 'ultimateGain'>>;
  normalMoves?: NormalMove[];
  signatureMoves: SignatureMove[];
  moveSummary?: string;
  guardCounter?: FighterDefinition['guardCounter'];
  ultimate?: UltimateMove & { gain?: UltimateGain; variants?: UltimateMove[] };
  /** Additional destinations after a shared attack lands, applied to this fighter only. */
  extraCancels?: Record<string, string[]>;
  /** Overrides only the audio for this fighter's shared attacks. */
  commonAudio?: Record<string, { audioTimeline?: ActionAudioCue[]; hit?: AudioClipRef }>;
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

function validBoxWindows(windows: BoxWindow[] | undefined, firstFrame: number, endFrame: number) {
  return windows === undefined || (Array.isArray(windows) && windows.every(window =>
    window && Number.isInteger(window.from) && Number.isInteger(window.to) &&
    window.from >= firstFrame && window.from < window.to && window.to <= endFrame &&
    Array.isArray(window.boxes) && window.boxes.every(box => box && validBox(box))));
}

function validImpact(impact: Partial<Pick<ActionDefinition,
  'hitstun' | 'blockstun' | 'stop' | 'damage' | 'guardCost' | 'push' | 'lift' | 'knockdown'>>) {
  const optional = (value: number | undefined, check: (number: number) => boolean) =>
    value === undefined || check(value);
  return [impact.hitstun, impact.blockstun, impact.stop].every(n => optional(n, n => Number.isInteger(n) && n >= 0)) &&
    [impact.damage, impact.guardCost].every(n => optional(n, n => Number.isFinite(n) && n >= 0)) &&
    [impact.push, impact.lift].every(n => optional(n, Number.isFinite)) &&
    (impact.knockdown === undefined || typeof impact.knockdown === 'boolean');
}

export const fighterAudioPrefix = 'assets/audio/';

export function fighterAudioMimeType(src: string) {
  if (typeof src !== 'string' || !src.startsWith(fighterAudioPrefix) ||
      /[\\:%?#\x00-\x1f\x7f]/.test(src) || src.slice(fighterAudioPrefix.length).split('/').some(part =>
        !part || part === '.' || part === '..' || part.trim() !== part)) return undefined;
  if (/\.wav$/i.test(src)) return 'audio/wav';
  if (/\.mp3$/i.test(src)) return 'audio/mpeg';
  if (/\.ogg$/i.test(src)) return 'audio/ogg';
  if (/\.webm$/i.test(src)) return 'audio/webm';
  return undefined;
}

function validVolume(volume: number | undefined) {
  return volume === undefined || (Number.isFinite(volume) && volume >= 0 && volume <= 1);
}

function validateAudioBank(owner: string, audio: FighterAudioBank | undefined) {
  if (audio === undefined) return;
  if (!audio || ![Object.prototype, null].includes(Object.getPrototypeOf(audio))) {
    throw Error(owner + ' 的 audio 须为音频 ID 到素材配置的映射');
  }
  for (const [id, clip] of Object.entries(audio)) {
    if (!id || id.trim() !== id || !clip || typeof clip !== 'object' || !fighterAudioMimeType(clip.src)) {
      throw Error(owner + ' / audio.' + id + ' 须使用 assets/audio/ 内的 WAV、MP3、Ogg 或 WebM 路径');
    }
    if (!validVolume(clip.volume)) throw Error(owner + ' / audio.' + id + ' 的音量须在 0–1 之间');
  }
}

function validAudioReference(reference: AudioClipRef, audio: FighterAudioBank | undefined) {
  return reference && typeof reference === 'object' && typeof reference.clip === 'string' && audio !== undefined &&
    Object.prototype.propertyIsEnumerable.call(audio, reference.clip) && validVolume(reference.volume);
}

function validFeedback(feedback: HitFeedback) {
  return feedback && (feedback.color === undefined || (typeof feedback.color === 'string' && feedback.color.trim())) &&
    [feedback.shake, feedback.flash].every(n => n === undefined || (Number.isFinite(n) && n >= 0)) &&
    (feedback.sound === undefined || ['light', 'heavy', 'sharp'].includes(feedback.sound));
}

function validateFeedback(where: string, feedback: HitFeedback | undefined, audio: FighterAudioBank | undefined) {
  if (feedback === undefined) return;
  if (!validFeedback(feedback)) throw Error(where + ' 的命中反馈参数无效');
  if (feedback.audio !== undefined && !validAudioReference(feedback.audio, audio)) {
    throw Error(where + ' 的 feedback.audio 须引用本角色已登记的音频，且音量在 0–1 之间');
  }
}

function validateAudioTimeline(where: string, timeline: ActionAudioCue[] | undefined, duration: number,
  audio: FighterAudioBank | undefined) {
  if (timeline === undefined) return;
  if (!Array.isArray(timeline)) throw Error(where + ' 的 audioTimeline 须为数组');
  for (const [index, cue] of timeline.entries()) {
    if (!validAudioReference(cue, audio) || !Number.isInteger(cue.frame) || cue.frame < 0 || cue.frame >= duration ||
      (cue.variants !== undefined && (!Array.isArray(cue.variants) || !cue.variants.length ||
        !cue.variants.every(clip => validAudioReference({clip}, audio)))) ||
      (cue.channel !== undefined && !['sfx', 'voice'].includes(cue.channel)) ||
      (cue.stopOnInterrupt !== undefined && typeof cue.stopOnInterrupt !== 'boolean')) {
      throw Error(where + ' 的 audioTimeline[' + index + '] 帧、音频引用、音量、声道或打断设置无效');
    }
  }
}

function validateCounterTarget(owner: string, targetId: string, actions: FighterAction[]) {
  const target = actions.find(action => action.id === targetId);
  if (!target || 'counterTo' in target || target.posture === 'air' || target.slot === 'ULT') {
    throw Error(owner + ' 的防反必须指向本角色可在地面发动的非大招攻击：' + targetId);
  }
  if ((target.energyCost ?? 0) > 0 || (target.tearCost ?? 0) > 0) {
    throw Error(owner + ' 的自动反击不能指向需要消耗技能能量的动作：' + targetId);
  }
}

function validateMoves(owner: string, actions: FighterAction[], audio: FighterAudioBank | undefined) {
  const ids = new Set<string>();
  for (const action of actions) {
    const where = owner + ' / ' + action.id;
    if (!action.id || ids.has(action.id)) throw Error(where + ' 的动作 ID 为空或重复');
    ids.add(action.id);
    if (![action.startup, action.active, action.recovery].every(Number.isInteger) ||
        action.startup < 0 || action.active < 1 || action.recovery < 0) {
      throw Error(where + ' 的动作帧数无效');
    }
    const duration = action.startup + action.active + action.recovery;
    if (!validBoxWindows(action.hurtTimeline, 0, duration)) {
      throw Error(where + ' 的逐帧受击框无效');
    }
    validateAudioTimeline(where, action.audioTimeline, duration, audio);
    const required = action.comboKeys;
    if (required !== undefined && (!Array.isArray(required) || !required.length ||
        new Set(required).size !== required.length ||
        required.some(slot => slot === action.slot || !['A', 'B', 'C', 'ULT'].includes(slot)))) {
      throw Error(where + ' 的组合键须为互不重复、且不同于动作槽的按键');
    }
    if ('counterTo' in action) {
      if (action.posture !== 'ground' || !['B', 'C'].includes(action.slot)) {
        throw Error(where + ' 的防反架势须使用地面 B/C 槽');
      }
      validateCounterTarget(where, action.counterTo, actions);
    } else {
      const { x, y, w, h } = action.hitbox;
      const noMelee = action.hitTimeline?.length === 0 && [x, y].every(Number.isFinite) && w === 0 && h === 0;
      if (!noMelee && !validBox(action.hitbox)) throw Error(where + ' 的攻击框坐标或宽高无效');
      if (action.energyCost !== undefined && !validEnergy(action.energyCost)) {
        throw Error(where + ' 的技能能量消耗须为 0–' + MAX_ENERGY + ' 的整数');
      }
      if (action.slot !== 'ULT' && (action.energyCost ?? 0) > 0) {
        throw Error(where + ' 的普通动作不能消耗杀气');
      }
      if (action.slot === 'ULT') {
        if ((action.direction !== undefined && action.direction !== 'up' && action.direction !== 'down') ||
            action.comboKeys?.length) {
          throw Error(where + ' 的大招只使用 O、上＋O 或下＋O');
        }
        if (actions.some(move => move !== action && move.slot === 'ULT' && move.direction === action.direction &&
          Boolean(move.requiresJo) === Boolean(action.requiresJo) &&
          Boolean(move.awakenJo) === Boolean(action.awakenJo) &&
          (move.posture === action.posture || move.posture === 'any' || action.posture === 'any'))) {
          throw Error(where + ' 的大招方向和姿态与其他招式重复');
        }
      }
      if (![action.hitstun, action.blockstun, action.stop].every(n => Number.isInteger(n) && n >= 0) ||
        ![action.damage, action.guardCost].every(n => Number.isFinite(n) && n >= 0) ||
        ![action.push, action.lift, action.advance, action.airControl ?? 0].every(Number.isFinite)) {
        throw Error(where + ' 的命中、位移或硬直参数无效');
      }
      if (!validBoxWindows(action.hitTimeline, action.startup, action.startup + action.active) ||
          action.hitTimeline?.some(window => typeof window.group !== 'string' || !window.group.trim() || !validImpact(window))) {
        throw Error(where + ' 的逐帧攻击框、命中组或命中参数无效');
      }
      validateFeedback(where, action.feedback, audio);
    }
    let previous = -1;
    for (const key of action.animation ?? []) {
      if (!Number.isInteger(key.frame) || key.frame <= previous || key.frame >= duration ||
          !Number.isInteger(key.cell) || key.cell < 0) throw Error(where + ' 的动画帧序列无效');
      previous = key.frame;
    }
  }
  const legalTargets = new Set([...ids, 'A', 'B', 'C', 'jump', 'dash']);
  if (actions.some(action => action.slot === 'ULT')) legalTargets.add('ULT');
  for (const action of actions) {
    if ('chain' in action && action.chain) {
      const { actionId, open, close } = action.chain;
      if (!actions.some(move => move.id === actionId && move.slot === action.slot && move.linkOnly) ||
          !Number.isInteger(open) || !Number.isInteger(close) || open < 0 || close < open ||
          close > action.startup + action.active + action.recovery) {
        throw Error(owner + ' / ' + action.id + ' 的连段目标或接续窗口无效');
      }
    }
    for (const target of action.cancelOnHit ?? []) {
      if (!legalTargets.has(target)) throw Error(owner + ' / ' + action.id + ' 引用了未知的取消目标 ' + target);
    }
  }
}

export function defineFighter(spec: FighterPackage): RosterEntry {
  const { id, name, accent, height, art, audio, stats, signatureMoves, moveSummary, guardCounter, ultimate,
    extraCancels = {}, commonAudio = {} } = spec;
  const normalMoves = spec.normalMoves ?? spec.commonMoves ?? commonActions;
  validateAudioBank(id, audio);
  for (const source of Object.keys(extraCancels)) {
    if (!normalMoves.some(move => move.id === source)) throw Error(id + ' 找不到公共动作 ' + source);
  }
  if (!commonAudio || ![Object.prototype, null].includes(Object.getPrototypeOf(commonAudio))) {
    throw Error(id + ' 的 commonAudio 须为公共动作 ID 到音频配置的映射');
  }
  for (const [source, override] of Object.entries(commonAudio)) {
    if (!normalMoves.some(move => move.id === source)) throw Error(id + ' / commonAudio 找不到公共动作 ' + source);
    if (!override || typeof override !== 'object') throw Error(id + ' / commonAudio.' + source + ' 的音频配置无效');
  }
  const shared = normalMoves.map(move => {
    const extra = extraCancels[move.id];
    const override = commonAudio[move.id];
    if (!extra && !override) return move;
    return {
      ...move,
      ...(extra && { cancelOnHit: [...new Set([...(move.cancelOnHit ?? []), ...extra])] }),
      ...(override?.audioTimeline !== undefined && { audioTimeline: override.audioTimeline }),
      ...(override?.hit !== undefined && { feedback: { ...move.feedback, audio: override.hit } })
    };
  });
  const actions: FighterAction[] = [...shared, ...signatureMoves];
  if (ultimate) {
    if (!validEnergy(ultimate.gain?.onHit ?? 0) || !validEnergy(ultimate.gain?.onHurt ?? 0)) {
      throw Error(id + ' 的大招能量增量须为 0–' + MAX_ENERGY + ' 的整数');
    }
    for (const { cost, move } of [ultimate, ...(ultimate.variants ?? [])]) {
      if (!validEnergy(cost)) {
        throw Error(id + ' / ' + move.id + ' 的大招消耗须为 0–' + MAX_ENERGY + ' 的整数');
      }
      actions.push({ ...move, slot: 'ULT', energyCost: cost });
    }
  }
  validateMoves(id, actions, audio);
  validateEntities(id, actions);
  for (const action of actions) {
    if ('counterTo' in action) continue;
    for (const entity of action.entities ?? []) {
      const where = id + ' / ' + action.id + ' / ' + entity.id;
      validateFeedback(where, entity.feedback, audio);
      if (entity.color !== undefined && !/^#[0-9a-f]{3,8}$/i.test(entity.color)) {
        throw Error(where + ' 的实体颜色无效');
      }
    }
  }
  if (guardCounter) {
    if(guardCounter.whileGuarding!==undefined&&typeof guardCounter.whileGuarding!=='boolean')throw Error(id+' 的持续防反开关须为布尔值');
    if (!Number.isSafeInteger(guardCounter.windowFrames) || guardCounter.windowFrames < 1) {
      throw Error(id + ' 的防反窗口须为正整数帧');
    }
    validateCounterTarget(id, guardCounter.actionId, actions);
  }
  const fighter: FighterDefinition = {
    maxHp: 1000, run: 8, airSpeed: 9, jump: 18, dash: 23, airDash: true, airJump: 16,
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
  return { fighter, accent, height, art, moveSummary, ...(audio === undefined ? {} : { audio }) };
}

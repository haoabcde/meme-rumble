import { actionFor, hurtRegionsFor, worldBox } from './match.js';
import type { ActionDefinition, Box, FighterAction, HitFeedback, MatchConfig, MatchState, Side, Slot } from './types.js';

export interface EntityDefinition {
  id: string;
  /** Zero-based frame of the spawning action. */
  spawnFrame: number;
  offset: { x: number; y: number };
  /** World units per playable tick. Horizontal motion follows the spawn facing. */
  velocity: { x: number; y: number };
  /** Number of playable ticks that can connect, including the spawn tick. */
  lifetime: number;
  hitbox: Box;
  damage: number;
  hitstun: number;
  blockstun: number;
  guardCost: number;
  push: number;
  lift: number;
  stop: number;
  feedback?: HitFeedback;
  color?: string;
}

export interface EntityState {
  id: number;
  owner: 0 | 1;
  slot: Slot;
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: Side;
  age: number;
  definition: EntityDefinition;
}

interface EntityContact {
  entity: EntityState;
  source: 0 | 1;
  target: 0 | 1;
  action: ActionDefinition;
  facing: Side;
  x: number;
  y: number;
}

export function validateEntities(owner: string, actions: FighterAction[]) {
  for (const action of actions) {
    if ('counterTo' in action) continue;
    const ids = new Set<string>();
    const duration = action.startup + action.active + action.recovery;
    for (const definition of action.entities ?? []) {
      const { id, spawnFrame, offset, velocity, lifetime, hitbox, damage, guardCost, push, lift,
        hitstun, blockstun, stop } = definition;
      const where = [owner, action.id, id].join(' / ');
      if (typeof id !== 'string' || !id.trim() || ids.has(id)) {
        throw Error(where + ' 的实体 ID 无效或重复');
      }
      ids.add(id);
      if (!Number.isInteger(spawnFrame) || spawnFrame < 0 || spawnFrame >= duration ||
          !Number.isInteger(lifetime) || lifetime < 1) {
        throw Error(where + ' 的实体生成帧或存活帧数无效');
      }
      if (![offset.x, offset.y, velocity.x, velocity.y, hitbox.x, hitbox.y, hitbox.w, hitbox.h]
        .every(Number.isFinite) || hitbox.w <= 0 || hitbox.h <= 0) {
        throw Error(where + ' 的实体位置、速度或攻击框无效');
      }
      if (![damage, guardCost].every(value => Number.isFinite(value) && value >= 0) ||
          ![push, lift].every(Number.isFinite) ||
          ![hitstun, blockstun, stop].every(value => Number.isInteger(value) && value >= 0)) {
        throw Error(where + ' 的实体命中、位移或硬直参数无效');
      }
    }
  }
}

export function updateEntities(state: MatchState, config: MatchConfig) {
  if (state.entities?.length) {
    state.entities = state.entities.filter(entity => ++entity.age < entity.definition.lifetime);
    for (const entity of state.entities) {
      entity.x += entity.vx;
      entity.y += entity.vy;
    }
  }
  for (const owner of [0, 1] as const) {
    const fighter = state.fighters[owner];
    const action = actionFor(config, state, owner);
    const attack = fighter.attack;
    if (!action || 'counterTo' in action || !attack) continue;
    for (const definition of action.entities ?? []) {
      if (definition.spawnFrame !== attack.frame || attack.spawnedEntities?.includes(definition.id)) continue;
      (attack.spawnedEntities ??= []).push(definition.id);
      const id = state.nextEntityId ?? 0;
      state.nextEntityId = id + 1;
      (state.entities ??= []).push({
        id, owner, definition, slot: action.slot, age: 0, facing: fighter.facing,
        x: fighter.x + definition.offset.x * fighter.facing,
        y: fighter.y + definition.offset.y,
        vx: definition.velocity.x * fighter.facing,
        vy: definition.velocity.y
      });
    }
  }
}

export function entityContacts(state: MatchState, config: MatchConfig): EntityContact[] {
  const contacts: EntityContact[] = [];
  for (const entity of state.entities ?? []) {
    const { owner: source, definition, facing } = entity;
    const target = source === 0 ? 1 : 0;
    const defender = state.fighters[target];
    if (defender.recovery || (config.rules.dashInvulnerable && defender.dashActive)) continue;
    const hitbox = worldBox(definition.hitbox, entity.x, entity.y, facing);
    const hurtRegions = hurtRegionsFor(config.fighters[target], actionFor(config, state, target), defender.attack?.frame ?? 0);
    for (const region of hurtRegions) {
      const hurtbox = worldBox(region, defender.x, defender.y, defender.facing);
      const left = Math.max(hitbox.x, hurtbox.x);
      const right = Math.min(hitbox.x + hitbox.w, hurtbox.x + hurtbox.w);
      const top = Math.max(hitbox.y, hurtbox.y);
      const bottom = Math.min(hitbox.y + hitbox.h, hurtbox.y + hurtbox.h);
      if (left >= right || top >= bottom) continue;
      contacts.push({
        entity, source, target, facing, x: (left + right) / 2, y: (top + bottom) / 2,
        action: {
          id: definition.id, hitbox: definition.hitbox, feedback: definition.feedback,
          damage: definition.damage, guardCost: definition.guardCost,
          push: definition.push, lift: definition.lift, hitstun: definition.hitstun,
          blockstun: definition.blockstun, stop: definition.stop,
          slot: entity.slot, posture: 'any', startup: 0, active: 1, recovery: 0, advance: 0, pose: 'strike'
        }
      });
      break;
    }
  }
  return contacts;
}

export function removeContactEntity(state: MatchState, id: number) {
  if (state.entities) state.entities = state.entities.filter(entity => entity.id !== id);
}

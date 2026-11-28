import assert from 'node:assert/strict';
import test from 'node:test';
import { arenas } from '../dist/content/arenas.js';
import { rules, testFighter } from '../dist/content/demo.js';
import { basicAttack } from '../dist/content/fighter-kit.js';
import { createMatch, step } from '../dist/core/match.js';
import { NEUTRAL } from '../dist/core/types.js';
import { roster } from '../dist/content/roster.js';

const platform = { id: 'test-roof', name: '试验屋面', tier: 1, left: 1000, right: 2400, y: 500 };
const base = arenas.find(arena => arena.id === 'broadcast-ring');
const arena = { ...base, floor: 780, platforms: [platform], spawn: [1400, 1500] };
const strike = { ...basicAttack, id: 'test-normal', slot: 'A', startup: 0, active: 6, recovery: 8,
  hitbox: { x: 20, y: -95, w: 150, h: 65 }, push: 8, lift: 0, damage: 20, hitstun: 24, advance: 0, stop: 0 };

function situation(seat, { sameLevel = false, guard = false, skill = false, ranged = false, zeroPush = false, atEdge = false, immune = false, tooLow = false } = {}) {
  const action = { ...strike, slot: skill ? 'B' : 'A', ...(zeroPush && { push: 0 }),
    ...(ranged && { projectile: { id: 'test-bullet', spawnFrame: 99, lifetime: 20,
      offset: { x: 0, y: 0 }, velocity: { x: 1, y: 0 }, hitbox: { x: 0, y: 0, w: 1, h: 1 },
      damage: 1, hitstun: 1, blockstun: 1, guardCost: 1, push: 1, lift: 0, stop: 0 } }) };
  const fighter = { ...testFighter, actions: [action] };
  const config = { rules, arena, training: true, fighters: [fighter, fighter] };
  const state = createMatch(config); state.phase = 'fight';
  const source = state.fighters[seat], target = state.fighters[1 - seat], direction = seat === 0 ? 1 : -1;
  const x = atEdge ? (seat === 0 ? 2280 : 1120) : 1700;
  Object.assign(source, { x, y: platform.y, ground: platform.id, facing: direction,
    attack: { id: action.id, frame: 0, connected: false, landed: false } });
  Object.assign(target, { x: x + 75 * direction, y: platform.y + (sameLevel ? 0 : tooLow ? 145 : 50), ground: sameLevel ? platform.id : null,
    facing: -direction, vy: sameLevel ? 0 : -4, guarding: guard,
    ...(immune && { recovery: { phase: 'fall', facing: -direction } }) });
  return { config, state, source, target, direction };
}

function hit(s) { return step(s.state, [NEUTRAL, NEUTRAL], s.config); }

test('platform normals intercept a rising opponent on either side with modest extra recoil and deterministic replay', () => {
  for (const seat of [0, 1]) {
    const s = situation(seat);
    const snapshot = structuredClone(s.state);
    const events = hit(s);
    assert.ok(events.some(event => event.kind === 'hit' && event.source === seat));
    assert.equal(s.target.push, s.direction * 9.2);
    assert.deepEqual(step(snapshot, [NEUTRAL, NEUTRAL], s.config), events);
    assert.deepEqual(snapshot, s.state);
  }
});

test('each shipped fighter can connect its existing normal on a rising target across a platform', () => {
  for (const { fighter } of roster) for (const seat of [0, 1]) {
    const normal = fighter.actions.find(action => action.slot === 'A' && !action.direction &&
      action.posture === 'ground' && !action.linkOnly && !action.projectile && !action.summon && !action.standAttack);
    assert.ok(normal, fighter.id);
    const fighters = seat === 0 ? [fighter, testFighter] : [testFighter, fighter];
    const config = { rules, arena, training: true, fighters };
    const state = createMatch(config); state.phase = 'fight';
    const source = state.fighters[seat], target = state.fighters[1 - seat], direction = seat === 0 ? 1 : -1;
    Object.assign(source, { x: 1700, y: platform.y, ground: platform.id, facing: direction,
      attack: { id: normal.id, frame: normal.startup - 1, connected: false, landed: false } });
    Object.assign(target, { x: 1700 + 65 * direction, y: platform.y + 20, ground: null, vy: -4, facing: -direction });
    const events = step(state, [NEUTRAL, NEUTRAL], config);
    assert.ok(events.some(event => event.kind === 'hit' && event.source === seat), `${fighter.id} / ${seat}`);
    assert.equal(target.push, direction * Math.round(normal.push * 1.15 * 1000) / 1000, `${fighter.id} / ${seat}`);
  }
});

test('only real unguarded normal contacts from above get extra recoil', () => {
  for (const seat of [0, 1]) {
    for (const fields of [{ sameLevel: true }, { skill: true }, { ranged: true }, { zeroPush: true }]) {
      const s = situation(seat, fields), events = hit(s);
      assert.ok(events.some(event => event.kind === 'hit'));
      assert.equal(s.target.push, s.direction * (fields.zeroPush ? 0 : 8));
    }
    const guard = situation(seat, { sameLevel: true, guard: true });
    const events = step(guard.state, seat === 0 ? [NEUTRAL, { ...NEUTRAL, y: 1 }] : [{ ...NEUTRAL, y: 1 }, NEUTRAL], guard.config);
    assert.ok(events.some(event => event.kind === 'block'));
    assert.equal(guard.target.push, guard.direction * 4);
    const immune = situation(seat, { immune: true });
    assert.ok(!hit(immune).some(event => event.kind === 'hit'));
    assert.equal(immune.target.hp, testFighter.maxHp);
    const outOfRange = situation(seat, { tooLow: true });
    assert.ok(!hit(outOfRange).some(event => event.kind === 'hit'));
  }
});

test('a fighter pushed off an upper platform falls onto the next floor and receives knockdown protection', () => {
  for (const seat of [0, 1]) {
    const s = situation(seat, { atEdge: true });
    assert.ok(hit(s).some(event => event.kind === 'hit'));
    for (let i = 0; i < 100 && s.target.recovery?.phase !== 'down'; i++) hit(s);
    assert.equal(s.target.ground, 'floor');
    assert.equal(s.target.recovery?.phase, 'down');
    const hp = s.target.hp;
    s.source.x = s.target.x - s.direction * 75;
    s.source.y = s.target.y;
    s.source.ground = 'floor';
    s.source.attack = { id: strike.id, frame: 0, connected: false, landed: false };
    for (let i = 0; i < 5; i++) hit(s);
    assert.equal(s.target.hp, hp);
  }
});

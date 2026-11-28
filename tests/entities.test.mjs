import assert from 'node:assert/strict';
import test from 'node:test';
import { createMatch, step } from '../dist/core/match.js';
import { validateEntities } from '../dist/core/entities.js';
import { NEUTRAL } from '../dist/core/types.js';
import { arenas } from '../dist/content/arenas.js';
import { rules, testFighter } from '../dist/content/demo.js';

const entity = {
  id: 'test-entity', spawnFrame: 1, offset: { x: 55, y: -60 },
  velocity: { x: 30, y: 0 }, lifetime: 20,
  hitbox: { x: 0, y: -10, w: 20, h: 20 },
  damage: 75, hitstun: 10, blockstun: 8, guardCost: 12, push: 3, lift: 0, stop: 2,
  feedback: { color: '#f84' }
};

function fixture(entities, separation = 240, source = 0) {
  const move = {
    ...testFighter.actions[2], id: 'cast', startup: 1, active: 1, recovery: 1,
    advance: 0, hitTimeline: [], entities
  };
  const arena = arenas.find(arena => arena.id === 'broadcast-ring');
  const config = { rules, arena, fighters: [testFighter, testFighter] };
  config.fighters[source] = { ...testFighter, actions: [move] };
  const state = createMatch(config);
  const tick = (first = NEUTRAL, second = NEUTRAL) => step(state, [first, second], config);
  for (let i = 0; i < 120; i++) tick();
  const center = (config.arena.left + config.arena.right) / 2;
  state.fighters[0].x = center - separation / 2;
  state.fighters[1].x = center + separation / 2;
  const cast = { ...NEUTRAL, pressed: ['B'] };
  if (source === 0) tick(cast);
  else tick(NEUTRAL, cast);
  return { config, state, tick, move };
}

test('projectile spawns once, mirrors facing, and hits after the cast ends', () => {
  for (const source of [0, 1]) {
    const { state, tick } = fixture([entity], 240, source);
    const caster = state.fighters[source];
    const target = state.fighters[1 - source];
    const facing = source === 0 ? 1 : -1;
    assert.equal(state.entities?.length ?? 0, 0);
    tick();
    assert.equal(state.entities.length, 1);
    assert.equal(state.entities[0].x, caster.x + entity.offset.x * facing);
    assert.equal(state.entities[0].vx, entity.velocity.x * facing);
    assert.equal(state.entities[0].age, 0);
    const start = state.entities[0].x;
    tick();
    assert.equal(state.entities[0].x, start + entity.velocity.x * facing);
    tick();
    assert.equal(caster.attack, null);
    const events = Array.from({ length: 12 }, () => tick()).flat();
    const hits = events.filter(event => event.kind === 'hit');
    assert.equal(hits.length, 1);
    assert.equal(hits[0].source, source);
    assert.equal(hits[0].direction, facing);
    assert.equal(hits[0].feedback.color, entity.feedback.color);
    assert.equal(target.hp, testFighter.maxHp - entity.damage);
    assert.equal(state.entities.length, 0);
  }
});

test('entities can juggle after hitstun expires, and landing protection starts on the contact frame', () => {
  const airborneHit = {
    ...entity, offset: { x: 55, y: -180 }, lifetime: 60,
    hitbox: { x: 0, y: -40, w: 20, h: 180 }, push: 0, hitstun: 2
  };
  const trailingHit = { ...airborneHit, id: 'trailing-hit', velocity: { x: 6, y: 0 } };
  const atGround = {
    ...entity, id: 'landing-probe', offset: { x: 240, y: -5 }, velocity: { x: 0, y: 0 },
    lifetime: 100, hitbox: { x: 0, y: 0, w: 20, h: 5 }, push: 0
  };
  for (const source of [0, 1]) {
    const { state, tick } = fixture([airborneHit, trailingHit, atGround], 240, source);
    const target = 1 - source;
    const defender = state.fighters[target];
    const jump = { ...NEUTRAL, pressed: ['jump'] };
    const nextEvent = kind => {
      for (let frame = 0; frame < 60; frame++) {
        const event = tick().find(event => event.kind === kind);
        if (event) return event;
      }
      assert.fail('Expected ' + kind);
    };
    assert.ok((target === 0 ? tick(jump) : tick(NEUTRAL, jump)).some(event => event.kind === 'jump'));
    assert.equal(nextEvent('hit').chain, 1);
    assert.equal(defender.ground, null);
    const stunDuration = state.freeze + airborneHit.hitstun;
    for (let frame = 0; frame < stunDuration; frame++) tick();
    assert.equal(defender.hitstun, 0);
    assert.equal(defender.combo, 1);
    assert.equal(nextEvent('hit').chain, 2);
    assert.equal(defender.ground, null);
    assert.ok(defender.vy > 0, 'the trailing projectile hits during descent');
    const hp = defender.hp;

    assert.equal(nextEvent('knockdown').source, target);
    assert.equal(defender.ground, 'floor');
    assert.equal(defender.hp, hp);
    assert.deepEqual(state.entities.map(current => current.definition.id), ['landing-probe']);
    assert.equal(nextEvent('rise').source, target);
    assert.equal(defender.hp, hp);
    assert.equal(nextEvent('hit').chain, 1);
    assert.equal(defender.recovery, null);
    assert.equal(defender.hp, hp - atGround.damage);
  }
});

test('a stationary summon keeps its spawn position and is consumed by a block', () => {
  const summon = { ...entity, offset: { x: 100, y: -60 }, velocity: { x: 0, y: 0 } };
  const { state, tick } = fixture([summon], 160);
  const [, defender] = state.fighters;
  tick();
  const start = state.entities[0].x;
  tick({ ...NEUTRAL, x: -1 });
  assert.equal(state.entities[0].x, start);
  defender.x = start + 35;
  const events = tick(NEUTRAL, { ...NEUTRAL, y: 1 });
  assert.deepEqual(events.map(event => event.kind), ['block']);
  assert.equal(defender.hp, testFighter.maxHp);
  assert.equal(defender.guard, rules.guardMax - summon.guardCost);
  assert.equal(state.entities.length, 0);
});

test('entities expire after their playable lifetime and clear for the next round', () => {
  const { state, tick } = fixture([
    { ...entity, lifetime: 2 },
    { ...entity, id: 'long-lived', lifetime: 100, velocity: { x: 0, y: 0 } }
  ]);
  tick();
  assert.equal(state.entities.length, 2);
  state.freeze = 1;
  tick();
  assert.equal(state.entities[0].age, 0);
  tick();
  assert.equal(state.entities.length, 2);
  assert.equal(state.entities[0].age, 1);
  tick();
  assert.deepEqual(state.entities.map(current => current.definition.id), ['long-lived']);

  state.remaining = 1;
  tick();
  assert.equal(state.phase, 'round-over');
  for (let i = 0; i < 105; i++) tick();
  assert.equal(state.round, 2);
  assert.equal(state.entities?.length ?? 0, 0);
});

test('entity validation rejects duplicate IDs, unreachable spawn frames, and invalid physical values', () => {
  const { move } = fixture([entity]);
  assert.doesNotThrow(() => validateEntities('test', [move]));
  assert.throws(() => validateEntities('test', [{ ...move, entities: [entity, entity] }]), /ID/);
  for (const invalid of [
    { spawnFrame: 3 },
    { lifetime: 0 },
    { velocity: { x: Infinity, y: 0 } },
    { hitbox: { ...entity.hitbox, w: 0 } },
    { hitstun: 0.5 }
  ]) {
    assert.throws(() => validateEntities('test', [{ ...move, entities: [{ ...entity, ...invalid }] }]), /test-entity/);
  }
});

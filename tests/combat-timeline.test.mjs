import assert from 'node:assert/strict';
import test from 'node:test';
import { arenas } from '../dist/content/arenas.js';
import { rules } from '../dist/content/demo.js';
import { basicAttack, defineFighter } from '../dist/content/fighter-kit.js';
import { createMatch, hitRegionsFor, hurtRegionsFor, step } from '../dist/core/match.js';
import { NEUTRAL } from '../dist/core/types.js';

const hitbox = { x: 30, y: -95, w: 120, h: 60 };
const missBox = { ...hitbox, y: -210 };
const feedback = { color: '#cf7200', shake: 3, flash: 2, sound: 'sharp' };
const move = {
  ...basicAttack, id: 'probe', slot: 'B', startup: 1, active: 6, recovery: 8,
  hitbox, damage: 100, push: 0, lift: 0, advance: 0, stop: 0,
  cancelOnHit: [], feedback
};
const window = (from, to, group, boxes = [hitbox], impact = {}) => ({ from, to, group, boxes, ...impact });
const input = (pressed = [], fields = {}) => ({ ...NEUTRAL, pressed, ...fields });
const projectile = {
  id: 'bolt', spawnFrame: 1, lifetime: 20,
  offset: { x: 25, y: -60 }, velocity: { x: 40, y: 0 },
  hitbox: { x: 0, y: -10, w: 20, h: 20 },
  damage: 40, hitstun: 10, blockstun: 8, guardCost: 12, push: 0, lift: 0, stop: 2
};

function fighter(id, signatureMoves = []) {
  return defineFighter({
    id, name: id, accent: '#fff', height: 144,
    art: { portrait: 'fixture.webp', motion: 'fixture-motion.webp' }, signatureMoves
  }).fighter;
}

function opening(attacker, seat = 0, defender = fighter('dummy')) {
  const fighters = [defender, defender];
  fighters[seat] = attacker;
  const config = { rules, arena: arenas[0], training: true, fighters };
  let state = createMatch(config);
  state.phase = 'fight';
  state.fighters[0].x = 1800;
  state.fighters[1].x = 1890;
  return {
    get state() { return state; },
    get player() { return state.fighters[seat]; },
    get target() { return state.fighters[1 - seat]; },
    restore() { state = structuredClone(state); },
    tick(player = NEUTRAL, target = NEUTRAL) {
      return step(state, seat === 0 ? [player, target] : [target, player], config);
    }
  };
}

test('frame boxes, one contact per group, hitstop and restored snapshots work in either facing', () => {
  const timed = {
    ...move, hitTimeline: [
      window(1, 2, 'outline', []),
      window(2, 4, 'first', [missBox, hitbox, hitbox], { damage: 40, stop: 2 }),
      window(4, 5, 'first'),
      window(5, 7, 'second', [hitbox], { damage: 80 })
    ]
  };
  assert.deepEqual(hitRegionsFor(timed, 0), []);
  assert.deepEqual(hitRegionsFor(timed, 1), []);
  assert.deepEqual(hitRegionsFor(timed, 2), [missBox, hitbox, hitbox]);
  assert.deepEqual(hitRegionsFor(timed, 7), []);
  assert.deepEqual(hitRegionsFor(move, 2), [hitbox]);
  for (const seat of [0, 1]) {
    const match = opening(fighter('timeline', [timed]), seat);
    match.tick(input(['B']));
    assert.equal(match.tick().length, 0);
    const [first] = match.tick();
    assert.equal(first.kind, 'hit');
    assert.equal(first.source, seat);
    assert.equal(first.direction, seat === 0 ? 1 : -1);
    assert.equal(first.amount, 40);
    assert.deepEqual(first.feedback, feedback);
    assert.equal(match.state.freeze, 2);
    match.restore();
    for (let frozen = 0; frozen < 2; frozen++) {
      assert.deepEqual(match.tick(), []);
      assert.equal(match.player.attack.frame, 2);
    }
    assert.deepEqual(match.tick(), []);
    assert.deepEqual(match.tick(), []);
    const [second] = match.tick();
    assert.equal(second.chain, 2);
    assert.equal(second.amount, 73);
    assert.deepEqual(match.player.attack.connectedGroups, ['first', 'second']);
    assert.deepEqual(match.tick(), []);
    assert.deepEqual(match.tick(), []);
    assert.equal(match.target.hp, 887);
  }
});

test('timed hurt regions suppress early contact then allow a trade from the same frame', () => {
  const timed = { ...move, hitTimeline: [window(1, 4, 'contact')] };
  const evasion = {
    ...timed, id: 'evade', hitTimeline: [window(2, 4, 'trade')],
    hurtTimeline: [{ from: 0, to: 2, boxes: [] }, { from: 2, to: 4, boxes: [{ x: -28, y: -114, w: 56, h: 114 }] }]
  };
  const defender = fighter('evasive', [evasion]);
  assert.deepEqual(hurtRegionsFor(defender, evasion, 0), []);
  assert.deepEqual(hurtRegionsFor(defender, evasion, 4), []);
  assert.deepEqual(hurtRegionsFor(defender, undefined, 0), [defender.hurtbox]);
  const match = opening(fighter('attacker', [timed]), 0, defender);
  match.tick(input(['B']), input(['B']));
  assert.deepEqual(match.tick(), []);
  assert.deepEqual(match.tick().map(event => [event.kind, event.source]), [['hit', 0], ['hit', 1]]);
  assert.equal(match.player.hp, 900);
  assert.equal(match.target.hp, 900);
  assert.equal(match.player.attack, null);
  assert.equal(match.target.attack, null);
});

test('blocked and parried contacts consume the group and a later group can connect', () => {
  const timed = {
    ...move, hitTimeline: [window(1, 3, 'first', [hitbox], { blockstun: 0 }), window(3, 5, 'second')]
  };
  const authored = fighter('multihit', [timed]);
  const guard = opening(authored);
  guard.tick(input(['B']), input([], { y: 1 }));
  assert.equal(guard.tick(NEUTRAL, input([], { y: 1 }))[0].kind, 'block');
  assert.equal(guard.player.attack.landed, false);
  assert.equal(guard.tick().length, 0);
  assert.equal(guard.tick()[0].kind, 'hit');

  const counter = {
    id: 'counter', slot: 'C', posture: 'ground', startup: 0, active: 2, recovery: 4, counterTo: 'answer'
  };
  const answer = { ...move, id: 'answer', startup: 4, linkOnly: true };
  const parry = opening(authored, 0, fighter('parry', [counter, answer]));
  parry.tick(input(['B']), input(['C']));
  assert.equal(parry.tick()[0].kind, 'parry');
  assert.equal(parry.player.attack.landed, false);
  assert.deepEqual(parry.tick().map(event => event.kind), ['swing']);
  assert.equal(parry.tick()[0].kind, 'hit');
});

test('chords take precedence, require a new trigger, and consume competing inputs sampled together', () => {
  const chord = { ...move, id: 'chord', comboKeys: ['A'], direction: 'forward' };
  const specific = { ...move, id: 'specific', comboKeys: ['A', 'C'] };
  const authored = fighter('chords', [move, chord, specific, { ...move, id: 'fallback-c', slot: 'C' }]);
  for (const seat of [0, 1]) {
    const forward = seat === 0 ? 1 : -1;
    const held = opening(authored, seat);
    held.tick(input(['B'], { held: ['A', 'B'], sampled: { B: { x: forward, y: 0 } } }));
    assert.equal(held.player.attack.id, chord.id);

    const simultaneous = opening(authored, seat);
    simultaneous.tick(input(['A', 'B', 'C'], { x: forward }));
    assert.equal(simultaneous.player.attack.id, specific.id);
    assert.deepEqual(simultaneous.player.buffer, []);

    const keyOrder = opening(authored, seat);
    keyOrder.tick(input(['A'], { held: ['B'], x: forward }));
    assert.equal(keyOrder.player.attack.id, basicAttack.id);

    const fallback = opening(authored, seat);
    fallback.tick(input(['B'], { held: ['A'], x: -forward }));
    assert.equal(fallback.player.attack.id, move.id);
  }
});

test('a restored projectile can be parried once from either seat', () => {
  const cast = { ...move, hitTimeline: [], entities: [projectile] };
  const counter = {
    id: 'counter', slot: 'C', posture: 'ground', startup: 0, active: 2, recovery: 4, counterTo: 'answer'
  };
  const answer = { ...move, id: 'answer', startup: 4, linkOnly: true };
  for (const seat of [0, 1]) {
    const session = opening(fighter('cast', [cast]), seat, fighter('guard', [counter, answer]));
    session.tick(input(['B']));
    session.tick(NEUTRAL, input(['C']));
    assert.equal(session.state.entities[0].age, 0);
    session.restore();
    const [parry] = session.tick();
    assert.equal(parry.kind, 'parry');
    assert.equal(parry.source, 1 - seat);
    assert.equal(session.target.hp, 1000);
    assert.deepEqual(session.state.entities, []);
    assert.equal(session.target.pendingCounter, answer.id);
    assert.deepEqual(session.tick(), []);
    assert.deepEqual(session.tick(), []);
    assert.deepEqual(session.tick().map(event => event.kind), ['swing']);
  }
});

test('same-frame melee and entity contacts can break a guard only once', () => {
  const cast = {
    ...move, hitTimeline: [window(1, 2, 'melee')],
    entities: [{ ...projectile, offset: { x: 65, y: -60 } }]
  };
  const session = opening(fighter('cast', [cast]));
  session.target.guard = 10;
  const guard = input([], { y: 1 });
  session.tick(input(['B']), guard);
  const events = session.tick(NEUTRAL, guard);
  assert.deepEqual(events.map(event => event.kind), ['block', 'break', 'block']);
  assert.equal(session.target.hp, 1000);
  assert.equal(session.target.guard, 0);
  assert.deepEqual(session.state.entities, []);
});

test('a same-frame rear hit cancels the response to a frontal parry regardless of contact order', () => {
  const front = { ...projectile, offset: { x: 65, y: -60 } };
  const back = { ...projectile, id: 'rear', offset: { x: 95, y: -60 } };
  const counter = {
    id: 'counter', slot: 'C', posture: 'ground', startup: 0, active: 2, recovery: 4, counterTo: 'answer'
  };
  const answer = { ...move, id: 'answer', startup: 4, linkOnly: true };
  for (const entities of [[front, back], [back, front]]) {
    const cast = { ...move, hitTimeline: [], entities };
    const session = opening(fighter('cast', [cast]), 0, fighter('guard', [counter, answer]));
    session.tick(input(['B']), input(['C']));
    const events = session.tick();
    assert.deepEqual(events.map(event => event.kind).sort(), ['hit', 'parry']);
    assert.equal(session.target.hp, 960);
    assert.equal(session.target.pendingCounter, undefined);
    assert.deepEqual(session.state.entities, []);
  }
});

test('fighter packages reject invalid timeline windows, hit parameters, feedback, and chord slots', () => {
  for (const patch of [
    { hitTimeline: [window(0, 3, 'early')] }, { hitTimeline: [window(3, 3, 'empty')] },
    { hitTimeline: [window(2, 3, '')] }, { hitTimeline: [window(2, 3, 'bad', [hitbox], { stop: 1.5 })] },
    { hurtTimeline: [{ from: 1, to: 100, boxes: [] }] }, { hurtTimeline: [window(0, 3, '', [{ ...hitbox, w: -1 }])] },
    { feedback: { flash: -1 } }, { comboKeys: ['B'] }, { comboKeys: ['A', 'A'] }
  ]) {
    assert.throws(() => fighter('invalid-timeline', [{ ...move, ...patch }]), /invalid-timeline/);
  }
});

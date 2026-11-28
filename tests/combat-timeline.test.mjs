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
const flatArena = arenas.find(arena => arena.id === 'broadcast-ring');
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
  const config = { rules, arena: flatArena, training: true, fighters };
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

test('contact tiers shape short hitstop while preserving authored damage and hitstun', () => {
  const cases = [
    ['light', { impact: 'light', stop: 2 }, 2],
    ['medium', { impact: 'medium', stop: 2 }, 3],
    ['heavy', { impact: 'heavy', stop: 2 }, 4],
    ['launch', { impact: 'heavy', lift: 13, stop: 5 }, 5],
    ['ultimate', { slot: 'ULT', energyCost: 100, stop: 6 }, 6],
    ['ultimate', { slot: 'ULT', energyCost: 100, stop: 1 }, 1],
    ['heavy', { impact: 'heavy', stop: 0 }, 0]
  ];
  for (const seat of [0, 1]) {
    for (const [tier, impact, stop] of cases) {
      const action = { ...move, push: 4, damage: 80, hitstun: 22, ...impact };
      const session = opening(fighter('tier', [action]), seat);
      session.player.energy = 100;
      session.tick(input([action.slot]));
      const hit = session.tick().find(event => event.kind === 'hit');
      assert.equal(hit.impactTier, tier);
      assert.equal(hit.hitstop, stop);
      assert.equal(session.state.freeze, stop);
      assert.equal(session.target.hp, 920);
      assert.equal(session.target.hitstun, 22);
      for (let frame = 0; frame < stop; frame++) session.tick();
      assert.equal(session.target.hitstun, 22, 'freeze does not consume hitstun');
      session.tick();
      assert.equal(session.target.hitstun, 21);
    }
  }
});

test('guard and guard break have distinct stop, no damage and no heavy recoil', () => {
  const action = { ...move, impact: 'heavy', push: 14, stop: 5, guardCost: 20, blockstun: 11 };
  const guard = input([], { y: 1 });
  for (const [stamina, stop, tiers] of [[100, 2, ['guard']], [10, 4, ['guard', 'guard-break']]]) {
    const session = opening(fighter('weight', [action]));
    session.target.guard = stamina;
    session.tick(input(['B']), guard);
    const events = session.tick(NEUTRAL, guard);
    assert.deepEqual(events.map(event => event.impactTier), tiers);
    assert.ok(events.every(event => event.hitstop === stop && !event.trade));
    assert.equal(session.state.freeze, stop);
    assert.equal(session.target.hp, 1000);
    assert.equal(session.target.blockstun, 11);
    assert.equal(session.target.push, 7);
    assert.equal(session.target.pushAccent, undefined);
  }
});

test('a heavy hit leads with recoil after freeze and preserves total unobstructed travel', () => {
  for (const seat of [0, 1]) {
    const action = { ...move, impact: 'heavy', push: 10, stop: 4 };
    const session = opening(fighter('heavy', [action]), seat);
    const direction = seat === 0 ? 1 : -1;
    session.tick(input(['B']));
    const [hit] = session.tick();
    const x = session.target.x;
    for (let frame = 0; frame < hit.hitstop; frame++) session.tick();
    assert.equal(session.target.x, x);
    session.tick();
    assert.equal(session.target.x, x + direction * 12.5);
    session.restore();
    session.tick();
    assert.equal(session.target.x, x + direction * 19);
    for (let frame = 0; frame < 8; frame++) session.tick();
    assert.equal(session.target.x, x + direction * 55);
    assert.equal(session.target.push, 0);
    assert.equal(session.target.pushAccent, undefined);
  }
});

test('simultaneous opposing hits share the longest contact pause and keep both reactions', () => {
  const quick = { ...move, impact: 'light', damage: 40, hitstun: 14, stop: 2 };
  const heavy = { ...move, impact: 'heavy', damage: 80, hitstun: 25, stop: 5 };
  for (const seat of [0, 1]) {
    const session = opening(fighter('short', [quick]), seat, fighter('heavy', [heavy]));
    session.tick(input(['B']), input(['B']));
    const events = session.tick();
    assert.equal(events.length, 2);
    assert.ok(events.every(event => event.trade && event.hitstop === 5));
    assert.equal(session.state.freeze, 5);
    assert.deepEqual([session.player.hp, session.target.hp], [920, 960]);
    assert.deepEqual([session.player.hitstun, session.target.hitstun], [25, 14]);
  }
});

test('three hit groups can relaunch a fighter before landing, with their own lift speeds', () => {
  const followUpBox = { ...hitbox, y: -150, h: 120 };
  const timed = {
    ...move, hitTimeline: [
      window(1, 3, 'lift-1', [hitbox], { lift: 8 }),
      window(4, 5, 'lift-2', [followUpBox], { lift: 12 }),
      window(6, 7, 'lift-3', [followUpBox], { lift: 16 })
    ]
  };
  const authored = fighter('relaunch', [timed]);
  for (const seat of [0, 1]) {
    const session = opening(authored, seat);
    const landY = session.target.y;
    const contacts = [];
    session.tick(input(['B']));
    for (let frame = 1; frame <= 6; frame++) {
      for (const event of session.tick().filter(event => event.kind === 'hit')) {
        assert.equal(event.impactTier, 'launch');
        assert.equal(session.target.ground, null);
        assert.equal(session.target.launched, true);
        assert.ok(!session.target.recovery);
        if (contacts.length) assert.ok(session.target.y < landY);
        contacts.push([frame, event.chain, session.target.vy]);
      }
    }
    assert.deepEqual(contacts, [[1, 1, -8], [4, 2, -12], [6, 3, -16]]);
    for (let frame = 0; frame < 60 && !session.target.recovery; frame++) session.tick();
    assert.equal(session.target.y, landY);
    assert.equal(session.target.recovery?.phase, 'down');
  }
});

test('a hit group can explicitly clear a move-level lift or inherit it', () => {
  const timed = {
    ...move, lift: 13, stop: 0, hitTimeline: [
      window(1, 2, 'ground-hit', [hitbox], { lift: 0 }),
      window(3, 4, 'launch-hit')
    ]
  };
  const session = opening(fighter('lift-default', [timed]));
  session.tick(input(['B']));
  assert.equal(session.tick().find(event => event.kind === 'hit')?.chain, 1);
  assert.equal(session.target.ground, 'floor');
  assert.equal(session.target.vy, 0);
  session.tick();
  assert.equal(session.tick().find(event => event.kind === 'hit')?.chain, 2);
  assert.equal(session.target.ground, null);
  assert.equal(session.target.vy, -13);
});

test('a simultaneous weak projectile cannot overwrite a launch or its landing protection', () => {
  const launch = {
    ...move, damage: 80, hitstun: 24, lift: 15, push: 7, stop: 5,
    entities: [{ ...projectile, offset: { x: 65, y: -60 }, hitstun: 4, push: 1, stop: 1 }]
  };
  for (const seat of [0, 1]) {
    const session = opening(fighter('combo', [launch]), seat);
    session.tick(input(['B']));
    const hits = session.tick().filter(event => event.kind === 'hit');
    assert.deepEqual(hits.map(event => event.impactTier), ['launch', 'light']);
    assert.ok(hits.every(event => !event.trade));
    assert.equal(session.target.hitstun, 24);
    assert.equal(session.target.vy, -15);
    assert.equal(session.target.push, seat === 0 ? 7 : -7);
    assert.equal(session.target.ground, null);
    for (let frame = 0; frame < 60 && !session.target.recovery; frame++) session.tick();
    assert.equal(session.target.recovery?.phase, 'down');
    assert.equal(session.target.recovery.remaining, 30);
    for (let frame = 0; frame < 30; frame++) session.tick();
    assert.equal(session.target.recovery?.phase, 'rise');
    assert.equal(session.target.recovery.remaining, 18);
  }
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

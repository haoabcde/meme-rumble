import assert from 'node:assert/strict';
import test from 'node:test';
import { createMatch, step } from '../dist/core/match.js';
import { NEUTRAL } from '../dist/core/types.js';
import { rules, testFighter } from '../dist/content/demo.js';
import { arenas } from '../dist/content/arenas.js';
import { roster } from '../dist/content/roster.js';
import { defineFighter } from '../dist/content/fighter-kit.js';
import { frameCamera } from '../dist/web/camera.js';
import { cpuInput } from '../dist/web/cpu.js';
import { platformAt, platformOffset, tierAt } from '../dist/core/terrain.js';

const config = { rules, arena: arenas[0], fighters: [testFighter, testFighter] };
const platformArenas = arenas.filter(arena => arena.platforms.length > 0);
const input = (pressed = [], x = 0, y = 0) => ({ pressed, x, y });
// Public movement and combat have their own fixture so character authors can tune individual stats.
const baseline = defineFighter({
  id: 'baseline', name: '公共动作测试', height: 144, accent: '#fff',
  art: { portrait: 'whale.webp', motion: 'whale-motion.webp' }, signatureMoves: []
}).fighter;

function begin(settings = config) {
  const state = createMatch(settings);
  for (let i = 0; i < 120; i++) step(state, [NEUTRAL, NEUTRAL], settings);
  return state;
}

function closeDistance(state) {
  const [a, b] = state.fighters;
  const center = (a.x + b.x) / 2;
  a.x = center - 45;
  b.x = center + 45;
}

function stepFor(state, count, current = [NEUTRAL, NEUTRAL], settings = config) {
  return Array.from({ length: count }, () => step(state, current, settings)).flat();
}

test('dash closes distance quickly; jump can land on a platform and down+jump passes it', () => {
  const state = begin();
  const west = config.arena.platforms.find(platform => platform.id === 'west');
  const start = west.right + 20;
  state.fighters[0].x = start;
  step(state, [input(['dash'], -1), NEUTRAL], config);
  stepFor(state, 7);
  assert.equal(state.fighters[0].x, start - testFighter.dash * 8);
  step(state, [input(['jump']), NEUTRAL], config);
  stepFor(state, 35);
  assert.equal(state.fighters[0].ground, 'west');
  step(state, [input(['jump'], 0, 1), NEUTRAL], config);
  stepFor(state, 30);
  assert.equal(state.fighters[0].ground, 'floor');
});

test('guard blocks damage, spends guard, then breaks until recovery', () => {
  const state = begin();
  closeDistance(state);
  state.fighters[1].guard = 10;
  const guard = input([], 0, 1);
  step(state, [input(['A']), guard], config);
  const events = stepFor(state, 5, [NEUTRAL, guard]);
  assert.deepEqual(events.map(event => event.kind), ['block', 'break']);
  assert.equal(state.fighters[1].hp, 1000);
  assert.equal(state.fighters[1].guard, 0);
  const time = state.remaining;
  stepFor(state, state.freeze, [NEUTRAL, guard]);
  assert.equal(state.remaining, time);
  stepFor(state, rules.guardBreak);
  assert.equal(state.fighters[1].guard, 50);
});

test('a whiff recovers without damage and up+A selects a grounded launcher', () => {
  const state = begin();
  step(state, [input(['A']), NEUTRAL], config);
  assert.ok(stepFor(state, 22).some(event => event.kind === 'whiff'));
  assert.equal(state.fighters[1].hp, 1000);
  closeDistance(state);
  step(state, [input(['A'], 0, -1), NEUTRAL], config);
  assert.equal(state.fighters[0].attack.id, 'test-rise');
  assert.ok(stepFor(state, 8).some(event => event.kind === 'hit'));
  assert.equal(state.fighters[1].ground, null);
  assert.ok(state.fighters[1].vy < 0);
});

test('same-frame hits on the final tick are simultaneous and can cause a double KO', () => {
  const state = begin();
  closeDistance(state);
  state.fighters.forEach(fighter => { fighter.hp = 100; });
  step(state, [input(['A']), input(['A'])], config);
  stepFor(state, 4);
  state.remaining = 1;
  const events = step(state, [NEUTRAL, NEUTRAL], config);
  assert.deepEqual(events.map(event => event.kind), ['hit', 'hit', 'ko']);
  assert.deepEqual(state.result, { winner: null, reason: 'double-ko' });
  assert.deepEqual(state.wins, [0, 0]);
  assert.equal(state.draws, 1);
  assert.deepEqual(stepFor(state, state.freeze), []);
  const falls = step(state, [input(['A']), input(['dash'])], config);
  assert.deepEqual(falls.map(event => [event.kind, event.source]), [['knockdown', 0], ['knockdown', 1]]);
  assert.ok(state.fighters.every(fighter => fighter.recovery?.phase === 'down'));
  assert.deepEqual(stepFor(state, 60), []);
  assert.equal(state.draws, 1);
  assert.ok(state.fighters.every(fighter => fighter.recovery?.phase === 'down'));
});

test('a lethal launcher keeps round scoring immediate and lands after hitstop', () => {
  const settings = { ...config, arena: arenas[1], fighters: [testFighter, testFighter] };
  const state = begin(settings);
  const [attacker, defender] = state.fighters;
  attacker.x = 2190;
  Object.assign(defender, { x: 2280, hp: 100 });
  step(state, [input(['A'], 0, -1), NEUTRAL], settings);
  const decisive = stepFor(state, 8, [NEUTRAL, NEUTRAL], settings);
  assert.deepEqual(decisive.map(event => event.kind), ['hit', 'ko']);
  assert.equal(state.phase, 'round-over');
  assert.deepEqual(state.result, { winner: 0, reason: 'ko' });
  assert.deepEqual(state.wins, [1, 0]);
  assert.equal(defender.launched, true);
  assert.ok(defender.vy < 0 && state.freeze > 0);

  const settledTime = state.remaining;
  const frozen = structuredClone(state.fighters);
  const commands = [input(['jump', 'A'], -1, 0), input(['dash', 'A'], 1, 1)];
  assert.deepEqual(stepFor(state, state.freeze, commands, settings), []);
  assert.deepEqual(state.fighters, frozen);
  assert.equal(state.freeze, 0);
  step(state, commands, settings);
  assert.ok(defender.y < settings.arena.floor);
  const landing = waitForEvent(state, settings, 'knockdown', 1, commands);
  assert.equal(landing.y, settings.arena.floor);
  assert.equal(defender.hp, 0);
  assert.equal(defender.ground, 'floor');
  assert.equal(defender.recovery.phase, 'down');
  const downed = structuredClone(defender);
  assert.deepEqual(stepFor(state, 30, commands, settings), []);
  assert.deepEqual(defender, downed);
  assert.deepEqual(attacker, frozen[0]);
  assert.equal(state.remaining, settledTime);
  assert.deepEqual(state.wins, [1, 0]);
});

test('round end allows an unusually long fall to settle within a bounded extension', () => {
  const startFall = (height, ticks) => {
    const state = begin();
    state.fighters[1].hp = 0;
    step(state, [NEUTRAL, NEUTRAL], config);
    Object.assign(state.fighters[1], { ground: null, y: config.arena.floor - height, vy: 0, launched: true });
    state.phaseTicks = ticks;
    return state;
  };

  const late = startFall(120, 1);
  step(late, [NEUTRAL, NEUTRAL], config);
  assert.equal(late.phase, 'round-over');
  waitForEvent(late, config, 'knockdown', 1);
  assert.equal(late.fighters[1].recovery.phase, 'down');
  assert.equal(late.phaseTicks, 12);
  stepFor(late, 12);
  assert.equal(late.round, 2);

  const extreme = startFall(24000, 105);
  stepFor(extreme, 164);
  assert.equal(extreme.phase, 'round-over');
  step(extreme, [NEUTRAL, NEUTRAL], config);
  assert.equal(extreme.round, 2);
  assert.deepEqual(extreme.wins, [1, 0]);
});

test('timeout compares life ratios and the next round swaps sides and restores values', () => {
  const settings = { ...config, fighters: [testFighter, { ...testFighter, maxHp: 1200 }] };
  const state = begin(settings);
  state.fighters[0].hp = 400;
  Object.assign(state.fighters[1], { hp: 450, y: settings.arena.floor - 150, ground: null, vy: -6 });
  state.remaining = 1;
  step(state, [NEUTRAL, NEUTRAL], settings);
  assert.deepEqual(state.result, { winner: 0, reason: 'time' });
  const survivors = structuredClone(state.fighters);
  assert.deepEqual(stepFor(state, 104, [input(['A']), input(['dash'])], settings), []);
  assert.deepEqual(state.fighters, survivors);
  step(state, [NEUTRAL, NEUTRAL], settings);
  assert.equal(state.round, 2);
  assert.deepEqual(state.fighters.map(fighter => fighter.x), [...settings.arena.spawn].reverse());
  assert.deepEqual(state.fighters.map(fighter => fighter.hp), [1000, 1200]);
  assert.deepEqual(state.wins, [1, 0]);
});

test('saving and replaying the same input frames reproduces states and events', () => {
  const state = begin();
  closeDistance(state);
  step(state, [input(['A']), NEUTRAL], config);
  const copy = structuredClone(state);
  const commands = Array.from({ length: 60 }, (_, i) => [
    i === 9 ? input(['B']) : i === 18 ? input(['jump']) : input([], i % 2 ? 1 : 0), NEUTRAL
  ]);
  const play = target => commands.map(frame => step(target, frame, config));
  assert.deepEqual(play(state), play(copy));
  assert.deepEqual(state, copy);
});

test('training restores the practice target on a lethal hit and never times out', () => {
  const settings = { ...config, training: true };
  const state = begin(settings);
  closeDistance(state);
  state.fighters[1].hp = 1;
  state.remaining = 1;
  step(state, [input(['A']), NEUTRAL], settings);
  assert.ok(stepFor(state, 9, [NEUTRAL, NEUTRAL], settings).some(event => event.kind === 'hit'));
  assert.equal(state.fighters[1].hp, testFighter.maxHp);
  assert.equal(state.remaining, 1);
  assert.equal(state.result, null);
  assert.equal(state.phase, 'fight');
});

test('the baseline has the default moves, the roster supports ground and air A, and empty B/C slots are inert', () => {
  assert.deepEqual(roster.map(entry => entry.fighter.id), ['whale', 'frog', 'banana', 'gaga']);
  assert.deepEqual(baseline.actions.map(move => move.id),
    ['common-jab', 'common-sweep', 'common-finish', 'common-launch', 'common-air']);
  assert.ok(baseline.actions.every(move => move.slot === 'A'));
  for (const { fighter } of roster) {
    const normals = fighter.actions.filter(move => move.slot === 'A' && !move.linkOnly && !move.direction);
    assert.ok(normals.some(move => move.posture === 'ground' || move.posture === 'any'), fighter.id + ' ground A');
    assert.ok(normals.some(move => move.posture === 'air' || move.posture === 'any'), fighter.id + ' air A');
  }
  for (const fighter of [baseline, ...roster.map(entry => entry.fighter)]) {
    const emptySlots = ['B', 'C'].filter(slot => !fighter.actions.some(move => move.slot === slot));
    if (!emptySlots.length) continue;
    const settings = { ...config, fighters: [fighter, fighter] };
    const state = begin(settings);
    closeDistance(state);
    assert.equal(step(state, [input(emptySlots), NEUTRAL], settings).some(e => e.kind === 'swing'), false);
    const events = stepFor(state, 12, [NEUTRAL, NEUTRAL], settings);
    assert.equal(events.some(e => e.kind === 'hit'), false);
    assert.equal(state.fighters[0].attack, null);
    assert.equal(state.fighters[1].hp, fighter.maxHp);
  }
});

function waitForEvent(state, settings, kind, source = 0, inputs = [NEUTRAL, NEUTRAL]) {
  for (let frame = 0; frame < 50; frame++) {
    const event = step(state, inputs, settings).find(event => event.kind === kind && event.source === source);
    if (event) return event;
  }
  assert.fail('Expected P' + (source + 1) + ' ' + kind);
}

test('a first-hitstop-frame input can confirm all three ground attacks, then the finisher recovers', () => {
  const settings = { ...trainingOn(arenas[0]), rules: { ...rules, inputBuffer: 4 } };
  const state = begin(settings);
  closeDistance(state);
  const [attacker, defender] = state.fighters;
  step(state, [input(['A']), NEUTRAL], settings);
  for (const [index, id] of ['common-jab', 'common-sweep', 'common-finish'].entries()) {
    const hit = waitForEvent(state, settings, 'hit');
    assert.equal(hit.chain, index + 1);
    assert.equal(attacker.attack.id, id);
    const before = defender.hp;
    assert.ok(state.freeze >= settings.rules.inputBuffer);
    // Every repeat is pressed while the current strike is still frozen.
    step(state, [input(['A']), NEUTRAL], settings);
    if (id === 'common-finish') {
      const events = stepFor(state, 40, [NEUTRAL, NEUTRAL], settings);
      assert.ok(!events.some(event => event.kind === 'swing'));
      assert.equal(defender.hp, before);
      assert.equal(attacker.attack, null);
    }
  }
});

test('a whiff cannot start a chain and a guarded jab leaves time for a counterattack', () => {
  const settings = trainingOn(arenas[0]);
  const state = begin(settings);
  step(state, [input(['A']), NEUTRAL], settings);
  waitForEvent(state, settings, 'whiff');
  step(state, [input(['A']), NEUTRAL], settings);
  assert.equal(state.fighters[0].attack.id, 'common-jab');
  assert.ok(!stepFor(state, 23, [NEUTRAL, NEUTRAL], settings).some(event => event.kind === 'swing'));
  assert.equal(state.fighters[1].hp, 1000);

  closeDistance(state);
  const guard = input([], 0, 1);
  step(state, [input(['A']), guard], settings);
  waitForEvent(state, settings, 'block', 0, [NEUTRAL, guard]);
  assert.equal(state.fighters[1].hp, 1000);
  assert.equal(state.fighters[1].guard, 87);
  step(state, [input(['A']), guard], settings);
  stepFor(state, state.freeze + 3, [NEUTRAL, guard], settings);
  assert.equal(state.fighters[0].attack.id, 'common-jab');
  step(state, [NEUTRAL, input(['A'])], settings);
  waitForEvent(state, settings, 'hit', 1);
  assert.equal(state.fighters[0].hp, 910);
  assert.equal(state.fighters[0].attack, null);
});

test('either player can branch from a jab into a launcher and jump-cancel into a distinct aerial hit', () => {
  const settings = trainingOn(arenas[2]);
  for (const seat of [0, 1]) {
    const state = begin(settings);
    closeDistance(state);
    const [attacker, defender] = [state.fighters[seat], state.fighters[1 - seat]];
    const tap = (pressed, x = 0, y = 0) => step(state, inputForSeat(seat, input(pressed, x, y)), settings);
    tap(['A']);
    waitForEvent(state, settings, 'hit', seat);
    tap(['A'], 0, -1);
    waitForEvent(state, settings, 'hit', seat);
    assert.equal(attacker.attack.id, 'common-launch');
    assert.equal(defender.ground, null);
    assert.ok(defender.vy < 0);
    tap(['jump']);
    waitForEvent(state, settings, 'jump', seat);
    assert.ok(attacker.y < settings.arena.floor);
    tap(['A'], attacker.facing);
    assert.equal(attacker.attack.id, 'common-air');
    waitForEvent(state, settings, 'hit', seat);
    assert.equal(defender.combo, 3);
    assert.ok(defender.y < settings.arena.floor);
    waitForEvent(state, settings, 'knockdown', 1 - seat);
    assert.ok(defender.ground);
    assert.equal(defender.recovery.phase, 'down');
  }
});

test('the shared air dash adds horizontal reach once per takeoff and replenishes on landing', () => {
  const settings = trainingOn(arenas[3]);
  const state = begin(settings);
  const fighter = state.fighters[0];
  const start = fighter.x;
  step(state, [input(['jump']), NEUTRAL], settings);
  const jumpVy = fighter.vy;
  const jumpY = fighter.y;
  const events = step(state, [input(['dash'], -1), NEUTRAL], settings);
  assert.deepEqual(events.map(event => event.kind), ['dash']);
  assert.equal(fighter.vy, jumpVy);
  assert.equal(fighter.y, jumpY);
  stepFor(state, 5, [NEUTRAL, NEUTRAL], settings);
  assert.equal(fighter.x, start - settings.fighters[0].dash * 6);
  assert.equal(fighter.vy, jumpVy);
  assert.equal(fighter.y, jumpY);
  assert.equal(fighter.airDashUsed, true);
  assert.deepEqual(step(state, [input(['dash'], 1), NEUTRAL], settings), []);
  assert.equal(fighter.vy, jumpVy + 1);
  assert.equal(fighter.y, jumpY + jumpVy + 1);
  assert.deepEqual(step(state, [input(['jump']), NEUTRAL], settings).map(event => event.kind), ['air-jump']);
  waitForEvent(state, settings, 'land');
  assert.equal(fighter.airDashUsed, false);
  step(state, [input(['jump']), NEUTRAL], settings);
  assert.ok(step(state, [input(['dash'], 1), NEUTRAL], settings).some(event => event.kind === 'dash'));
});

test('a ground dash applies gravity immediately after leaving a platform', () => {
  const settings = trainingOn(arenas[1]);
  const state = begin(settings);
  const fighter = state.fighters[0];
  const bench = settings.arena.platforms.find(platform => platform.id === 'west-stand');
  fighter.x = bench.right - 5;
  fighter.y = bench.y;
  fighter.ground = bench.id;
  assert.deepEqual(step(state, [input(['dash'], 1), NEUTRAL], settings).map(event => event.kind), ['dash']);
  assert.equal(fighter.ground, null);
  assert.equal(fighter.y, bench.y + 1);
  assert.equal(fighter.vy, 1);
  step(state, [NEUTRAL, NEUTRAL], settings);
  assert.equal(fighter.y, bench.y + 3);
  assert.equal(fighter.vy, 2);
});

test('either seat spends public stamina once per legal dash and resets it between rounds', () => {
  for (const seat of [0, 1]) {
    const settings = { ...trainingOn(arenas[3]), training: false };
    const state = begin(settings);
    const fighter = state.fighters[seat];
    const outward = -fighter.facing;
    const tap = keys => step(state, inputForSeat(seat, input(keys, outward)), settings);
    assert.deepEqual(tap(['dash']).map(event => [event.kind, event.source]), [['dash', seat]]);
    assert.equal(fighter.guard, rules.guardMax - rules.dashGuardCost.ground);
    assert.equal(fighter.guardWait, rules.guardDelay);
    stepFor(state, 7, [NEUTRAL, NEUTRAL], settings);
    assert.equal(fighter.guard, rules.guardMax - rules.dashGuardCost.ground);

    fighter.guard = rules.dashGuardCost.ground - 1;
    assert.deepEqual(tap(['dash']).map(event => [event.kind, event.source]), [['dash-no-stamina', seat]]);
    assert.equal(fighter.guard, rules.dashGuardCost.ground - 1);
    assert.ok(!fighter.buffer.some(command => command.key === 'dash'));
    assert.equal(fighter.dash, 0);

    tap(['jump']);
    assert.deepEqual(tap(['dash']).map(event => event.kind), ['dash-no-stamina']);
    assert.equal(fighter.airDashUsed, false);
    fighter.guard = rules.dashGuardCost.air;
    assert.deepEqual(tap(['dash']).map(event => event.kind), ['dash']);
    assert.equal(fighter.guard, 0);
    assert.equal(fighter.guardWait, rules.guardDelay);
    stepFor(state, 5, [NEUTRAL, NEUTRAL], settings);
    assert.equal(fighter.airDashUsed, true);
    assert.deepEqual(tap(['dash']), []);
    assert.equal(fighter.guard, 0);

    state.remaining = 1;
    step(state, [NEUTRAL, NEUTRAL], settings);
    stepFor(state, 105, [NEUTRAL, NEUTRAL], settings);
    assert.equal(state.round, 2);
    assert.equal(state.fighters[seat].guard, rules.guardMax);
    assert.equal(state.fighters[seat].guardWait, 0);
  }
});

test('public dash crosses fighters and avoids melee and entities through its last movement tick', () => {
  const reach = { x: -260, y: -110, w: 520, h: 110 };
  const attack = {
    ...baseline.actions[0], slot: 'B', id: 'dash-test-together',
    startup: 0, active: 12, advance: 0, hitbox: reach, damage: 20, push: 0, stop: 0,
    entities: [{
      id: 'dash-test-entity', spawnFrame: 0, lifetime: 12,
      offset: { x: 0, y: 0 }, velocity: { x: 0, y: 0 },
      hitbox: reach, damage: 40, hitstun: 15, blockstun: 5, guardCost: 5,
      push: 0, lift: 0, stop: 0
    }]
  };

  for (const seat of [0, 1]) {
    const source = 1 - seat;
    const settings = trainingOn(arenas[0]);
    settings.fighters[source] = { ...baseline, actions: [...baseline.actions, attack] };
    const state = begin(settings);
    closeDistance(state);
    const fighter = state.fighters[seat];
    const opponent = state.fighters[source];
    const direction = fighter.facing;
    const startingX = fighter.x;
    const simultaneous = inputForSeat(seat, input(['dash'], direction));
    simultaneous[source] = input(['B']);
    const events = step(state, simultaneous, settings);
    assert.deepEqual(events.map(event => event.kind).sort(), ['dash', 'swing']);
    for (let tick = 1; tick <= 7; tick++) {
      assert.equal(fighter.facing, direction);
      assert.deepEqual(step(state, [NEUTRAL, NEUTRAL], settings), []);
    }
    assert.equal(fighter.dash, 0);
    assert.equal(fighter.dashActive, true);
    assert.equal(fighter.x, startingX + direction * baseline.dash * 8);
    assert.ok((fighter.x - opponent.x) * direction > 0);
    assert.equal(fighter.facing, -direction);
    assert.equal(fighter.hp, baseline.maxHp);
    assert.equal(fighter.guard, rules.guardMax - rules.dashGuardCost.ground);
    assert.equal(state.entities.length, 1);
    state.freeze = 1;
    assert.deepEqual(step(state, [NEUTRAL, NEUTRAL], settings), []);
    assert.equal(fighter.dashActive, true);

    const impacts = step(state, [NEUTRAL, NEUTRAL], settings);
    assert.equal(fighter.dashActive, false);
    assert.deepEqual(impacts.map(event => [event.kind, event.amount]), [['hit', 20], ['hit', 36]]);
    assert.equal(fighter.hp, baseline.maxHp - 56);
    assert.equal(state.entities.length, 0);
  }
});

test('either player can hold a direction and dash immediately after a second jump', () => {
  const settings = trainingOn(arenas.at(-1));
  for (const seat of [0, 1]) {
    for (const direction of [-1, 1]) {
      const state = begin(settings);
      const fighter = state.fighters[seat];
      const control = keys => step(state, inputForSeat(seat, input(keys, direction)), settings);
      control(['jump']);
      for (let tick = 0; tick < 12; tick++) control([]);
      assert.ok(control(['jump']).some(event => event.kind === 'air-jump'));
      const { x, y, vy, guard } = fighter;
      const dash = control(['dash']).find(event => event.kind === 'dash');
      assert.equal(dash?.direction, direction);
      assert.equal(fighter.x, x + settings.fighters[seat].dash * direction);
      assert.equal(fighter.y, y);
      assert.equal(fighter.vy, vy);
      assert.equal(fighter.guard, guard - rules.dashGuardCost.air);
      for (let tick = 0; tick < 5; tick++) control([]);
      assert.deepEqual(control(['dash', 'jump']), []);
      waitForEvent(state, settings, 'land', seat);
      assert.equal(fighter.airDashUsed, false);
      assert.equal(fighter.jumpCount, 0);
    }
  }
});

test('jump and dash tapped in the same tick still start the dash on the next tick', () => {
  const settings = trainingOn(arenas.at(-1));
  const state = begin(settings);
  const first = step(state, [input(['jump', 'dash'], -1), NEUTRAL], settings);
  assert.deepEqual(first.map(event => event.kind), ['jump']);
  const next = step(state, [input([], 1), NEUTRAL], settings);
  assert.deepEqual(next.map(event => [event.kind, event.direction]), [['dash', -1]]);
});

test('the second jump still lands on the middle tier when the upper lip is beyond its peak', () => {
  const { settings, lower: bench } = overlappingLedges();
  const state = begin(settings);
  const fighter = state.fighters[0];
  fighter.x = (bench.left + bench.right) / 2;
  step(state, [input(['jump']), NEUTRAL], settings);
  stepFor(state, 16, [NEUTRAL, NEUTRAL], settings);
  assert.deepEqual(step(state, [input(['jump']), NEUTRAL], settings).map(event => event.kind), ['air-jump']);
  let peak = fighter.y;
  for (let frame = 0; frame < 42 && !fighter.ground; frame++) {
    step(state, [NEUTRAL, NEUTRAL], settings);
    peak = Math.min(peak, fighter.y);
  }
  assert.equal(settings.arena.floor - peak, 231);
  assert.equal(fighter.ground, bench.id);
  assert.equal(fighter.jumpCount, 0);
});

test('an airborne side switch updates facing before the next directional action is sampled', () => {
  const airAttack = baseline.actions.find(action => action.id === 'common-air');
  const directional = { ...airAttack, id: 'air-forward', slot: 'B', direction: 'forward' };
  for (const seat of [0, 1]) {
    const settings = trainingOn(arenas[0]);
    settings.fighters[seat] = { ...baseline, actions: [...baseline.actions, directional] };
    const state = begin(settings);
    const fighter = state.fighters[seat];
    const opponent = state.fighters[1 - seat];
    const approach = fighter.facing;
    fighter.x = opponent.x - 5 * approach;
    fighter.ground = null;
    fighter.y = opponent.y - 130;
    step(state, inputForSeat(seat, input([], approach)), settings);
    assert.ok((fighter.x - opponent.x) * approach > 0);
    assert.equal(fighter.facing, -approach);
    step(state, inputForSeat(seat, input(['B'], -approach)), settings);
    assert.equal(fighter.attack?.id, directional.id);
  }
});

test('the finisher ends the chain, protects the downed fighter, and releases control on wakeup', () => {
  const settings = trainingOn(arenas[0]);
  const state = begin(settings);
  closeDistance(state);
  const [attacker, defender] = state.fighters;
  for (let hit = 1; hit <= 3; hit++) {
    step(state, [input(['A']), NEUTRAL], settings);
    assert.equal(waitForEvent(state, settings, 'hit').chain, hit);
  }
  assert.equal(defender.recovery.phase, 'fall');
  assert.equal(defender.combo, 0);
  waitForEvent(state, settings, 'knockdown', 1);
  assert.equal(defender.ground, 'floor');
  assert.equal(defender.recovery.phase, 'down');
  const hp = defender.hp;
  while (attacker.attack) step(state, [NEUTRAL, NEUTRAL], settings);
  attacker.x = defender.x - 85;
  step(state, [input(['A']), input(['A'])], settings);
  stepFor(state, 6, [NEUTRAL, NEUTRAL], settings);
  assert.equal(defender.hp, hp);
  assert.equal(defender.attack, null);
  waitForEvent(state, settings, 'rise', 1);
  assert.equal(defender.recovery.phase, 'rise');
  stepFor(state, defender.recovery.remaining - 2, [NEUTRAL, NEUTRAL], settings);
  step(state, [NEUTRAL, input(['A'])], settings);
  assert.equal(defender.attack, null);
  step(state, [NEUTRAL, NEUTRAL], settings);
  assert.equal(defender.recovery, null);
  assert.equal(defender.attack.id, 'common-jab');
});

test('ordinary launch locks either seat until landing, knockdown and wakeup on floor or platform', () => {
  const { settings: fixture, lower: bench } = overlappingLedges();
  const arena = { ...fixture.arena, platforms: [bench] };
  const launcher = baseline.actions.find(action => action.id === 'common-launch');
  // A short hitstun makes the independent airborne lock visible without changing jump physics.
  const shortLaunch = { ...launcher, hitstun: 4, push: 0, advance: 0 };
  for (const support of [null, bench]) {
    for (const target of [0, 1]) {
      const source = 1 - target;
      const settings = trainingOn(arena);
      if (support) settings.rules = { ...rules, knockdownFrames: 7, riseFrames: 6 };
      settings.fighters[source] = { ...baseline, actions: [shortLaunch] };
      const state = begin(settings);
      const landingY = support?.y ?? arena.floor;
      const middle = support ? (support.left + support.right) / 2 : arena.width / 2;
      state.fighters.forEach((fighter, seat) => Object.assign(fighter, {
        x: middle + (seat === 0 ? -45 : 45), y: landingY, ground: support?.id ?? 'floor'
      }));
      const defender = state.fighters[target];
      step(state, inputForSeat(source, input(['A'], 0, -1)), settings);
      waitForEvent(state, settings, 'hit', source);
      assert.equal(defender.ground, null);
      assert.ok(defender.vy < 0);
      const startX = defender.x;
      const away = -defender.facing;
      const tap = command => step(state, inputForSeat(target, command), settings);
      const attempts = [input([], away), input(['dash'], away), input(['jump']), input(['A']), input([], 0, 1)];
      let attemptedAfterHitstun = 0;
      let landingEvents;
      for (let frame = 0; frame < 60 && !defender.ground; frame++) {
        const attempt = defender.hitstun ? frame : attemptedAfterHitstun++;
        landingEvents = tap(attempts[attempt % attempts.length]);
        assert.equal(defender.x, startX, 'airborne directional input must not steer a launched fighter');
        assert.equal(defender.airDashUsed, false);
        assert.equal(defender.attack, null);
      }
      assert.ok(attemptedAfterHitstun >= attempts.length);
      assert.equal(defender.ground, support?.id ?? 'floor');
      assert.equal(defender.y, landingY);
      assert.ok(landingEvents.some(event => event.kind === 'knockdown' && event.source === target));
      assert.deepEqual(defender.recovery, { phase: 'down', remaining: support ? 7 : 30, facing: defender.facing });

      const groundedAttempts = [...attempts, input(['jump'], 0, 1)];
      const riseFrames = support ? 6 : 18;
      let recoveryTicks = 0;
      let riseEvents = 0;
      while (defender.recovery.phase === 'down' || defender.recovery.remaining > 1) {
        assert.ok(recoveryTicks < 60, 'recovery must reach its last wakeup frame');
        const events = tap(groundedAttempts[recoveryTicks++ % groundedAttempts.length]);
        for (const event of events.filter(event => event.source === target)) {
          assert.equal(event.kind, 'rise');
          assert.deepEqual(defender.recovery, { phase: 'rise', remaining: riseFrames, facing: defender.facing });
          riseEvents++;
        }
        assert.equal(defender.x, startX);
        assert.equal(defender.y, landingY);
        assert.equal(defender.ground, support?.id ?? 'floor');
        assert.equal(defender.attack, null);
        assert.equal(defender.guarding, false);
      }
      assert.equal(riseEvents, 1);
      assert.equal(recoveryTicks, (support ? 7 : 30) + riseFrames - 1);
      assert.ok(tap(input(['A'])).some(event => event.kind === 'swing' && event.source === target));
      assert.equal(defender.recovery, null);
    }
  }
});

test('a fighter waking at a platform edge is not pushed off by an overlapping opponent', () => {
  const { settings: fixture, lower: bench } = overlappingLedges();
  const settings = { ...fixture, arena: { ...fixture.arena, platforms: [bench] }, fighters: [testFighter, testFighter] };
  const state = begin(settings);
  const [attacker, defender] = state.fighters;
  Object.assign(attacker, { x: bench.right - 130, y: bench.y, ground: bench.id });
  Object.assign(defender, { x: bench.right - 30, y: bench.y, ground: bench.id });
  step(state, [input(['A'], 0, -1), NEUTRAL], settings);
  waitForEvent(state, settings, 'knockdown', 1);
  assert.equal(defender.ground, bench.id);
  const landedX = defender.x;

  stepFor(state, 10, [input([], 1), NEUTRAL], settings);
  const bodyDistance = (settings.fighters[0].bodyWidth + settings.fighters[1].bodyWidth) / 2;
  assert.ok(defender.x - attacker.x < bodyDistance);
  const rise = waitForEvent(state, settings, 'rise', 1);
  assert.equal(rise.x, landedX);
  assert.equal(defender.ground, bench.id);
  assert.equal(defender.recovery.phase, 'rise');
  const recoveryTime = defender.recovery.remaining;
  const events = stepFor(state, recoveryTime + 1, [NEUTRAL, NEUTRAL], settings);
  assert.deepEqual(events, []);
  assert.equal(defender.recovery, null);
  assert.equal(defender.ground, bench.id);
  assert.equal(defender.x, landedX);
  assert.equal(defender.x - attacker.x, bodyDistance);
});

test('the combo cap stays protective through a high fall until actual ground contact', () => {
  const settings = { ...trainingOn(arenas[2]), rules: { ...rules, comboControlLimit: 5 } };
  const state = begin(settings);
  const defender = state.fighters[1];
  Object.assign(defender, {
    x: settings.arena.left + 30, y: settings.arena.floor - 1050,
    ground: null, vy: -20, hitstun: 50, combo: 3, controlled: 4
  });
  step(state, [NEUTRAL, NEUTRAL], settings);
  assert.equal(defender.recovery.phase, 'fall');
  assert.ok(defender.vy > 0);
  stepFor(state, 34, [NEUTRAL, NEUTRAL], settings);
  assert.equal(defender.recovery.phase, 'fall');
  assert.equal(defender.ground, null);
  waitForEvent(state, settings, 'knockdown', 1);
  assert.equal(defender.ground, 'floor');
  waitForEvent(state, settings, 'rise', 1);
  stepFor(state, defender.recovery.remaining, [NEUTRAL, NEUTRAL], settings);
  assert.equal(defender.recovery, null);
});

test('the computer approaches and confirms more than one hit using the shipped actions', () => {
  const settings = trainingOn(arenas[0]);
  const state = begin(settings);
  let bestChain = 0;
  for (let frame = 0; frame < 360; frame++) {
    step(state, [NEUTRAL, cpuInput(state, settings)], settings);
    bestChain = Math.max(bestChain, state.fighters[0].combo);
  }
  assert.ok(bestChain >= 2);
});

function trainingOn(arena) {
  return { ...config, training: true, arena, fighters: [baseline, baseline] };
}

function inputForSeat(seat, command) {
  return seat === 1 ? [NEUTRAL, command] : [command, NEUTRAL];
}

function moveOn(state, settings, surface, target, seat = 0) {
  const fighter = state.fighters[seat];
  for (let frame = 0; frame < 300 && Math.abs(fighter.x - target) >= settings.fighters[seat].run; frame++) {
    step(state, inputForSeat(seat, input([], Math.sign(target - fighter.x))), settings);
    assert.equal(fighter.ground, surface.id, surface.id + ' should support the approach');
  }
  assert.ok(Math.abs(fighter.x - target) < settings.fighters[seat].run);
}

function jumpTo(state, settings, from, to, seat = 0, landingX = state.fighters[seat].x) {
  const fighter = state.fighters[seat];
  const airSpeed = settings.fighters[seat].airSpeed;
  const aim = (x, left, right) => Math.max(left + 24, Math.min(right - 24, x));
  const target = aim(landingX, to.left, to.right);
  const launch = aim(target, from.left, from.right);
  moveOn(state, settings, from, launch, seat);
  for (let frame = 0; frame < 60; frame++) {
    const direction = Math.abs(target - fighter.x) >= airSpeed ? Math.sign(target - fighter.x) : 0;
    const events = step(state, inputForSeat(seat, input(frame === 0 ? ['jump'] : [], direction)), settings);
    if (frame === 0) assert.ok(events.some(event => event.kind === 'jump'));
    if (fighter.ground) break;
  }
  assert.equal(fighter.ground, to.id, settings.arena.name + ' / ' + from.id + ' → ' + to.id);
  assert.equal(fighter.y, to.y);
}

function landAfter(state, command, settings, seat = 0, airDirection = 0) {
  const first = step(state, inputForSeat(seat, command), settings);
  assert.equal(state.fighters[seat].ground, null);
  let last = [];
  for (let i = 0; i < 60 && !state.fighters[seat].ground; i++) {
    last = step(state, inputForSeat(seat, input([], airDirection)), settings);
  }
  assert.ok(last.some(event => event.kind === 'land'));
  return first;
}

for (const arena of platformArenas) {
  test(arena.name + ' · every fighter can jump up and drop back down either route', () => {
    const floor = { ...arena, id: 'floor', y: arena.floor };
    for (const { fighter } of roster) {
      const settings = { ...trainingOn(arena), fighters: [fighter, fighter] };
      for (const seat of [0, 1]) {
        const state = begin(settings);
        state.fighters[1 - seat].x = seat === 0 ? arena.right : arena.left;
        const path = [floor, ...arena.routes[seat].map(id => arena.platforms.find(p => p.id === id))];
        assert.equal(Math.max(...path.map(p => p.tier ?? 0)), Math.max(...arena.platforms.map(p => p.tier)));
        for (let i = 1; i < path.length; i++) jumpTo(state, settings, path[i - 1], path[i], seat);
        for (let i = path.length - 1; i > 0; i--) {
          const from = path[i], to = path[i - 1];
          const landingX = (Math.max(from.left, to.left) + Math.min(from.right, to.right)) / 2;
          moveOn(state, settings, from, landingX, seat);
          assert.deepEqual(landAfter(state, input(['jump'], 0, 1), settings, seat).map(event => event.kind), ['drop']);
          assert.equal(state.fighters[seat].ground, to.id, fighter.id + ' / ' + arena.name + ' / ' + from.id);
        }
      }
    }
  });
}

function overlappingLedges() {
  const settings = trainingOn(arenas[0]);
  const floor = settings.arena.floor;
  const lower = { id: 'lower', name: '下层', tier: 1, left: 500, right: 1300, y: floor - 120 };
  const upper = { id: 'upper', name: '上层', tier: 2, left: 700, right: 1100, y: floor - 250 };
  settings.arena = { ...settings.arena, platforms: [lower, upper] };
  return { settings, lower, upper };
}

test('a falling fighter lands on the first crossed surface regardless of drawing order', () => {
  const { settings, lower: bridge, upper: terrace } = overlappingLedges();
  const state = begin(settings);
  const fighter = state.fighters[0];
  Object.assign(fighter, {
    x: (terrace.left + terrace.right) / 2,
    ground: null,
    y: terrace.y - 18,
    vy: bridge.y - terrace.y + 32
  });
  step(state, [NEUTRAL, NEUTRAL], settings);
  assert.equal(fighter.ground, terrace.id);
  assert.equal(fighter.y, terrace.y);
});

test('a fighter cannot land on a platform after passing below its edge', () => {
  const { settings, lower, upper: edge } = overlappingLedges();
  const state = begin(settings);
  const fighter = state.fighters[0];
  fighter.x = edge.left - 5;
  fighter.ground = null;
  fighter.y = edge.y - 1;
  fighter.vy = 22;
  step(state, [input([], 1), NEUTRAL], settings);
  assert.ok(fighter.x > edge.left, 'by the end of the tick the fighter is above the horizontal span');
  assert.equal(fighter.ground, null, 'the fighter was still outside when crossing the top plane');
  stepFor(state, 30, [NEUTRAL, NEUTRAL], settings);
  assert.equal(fighter.ground, lower.id);
});

test('down+jump on the floor starts an ordinary jump', () => {
  const settings = trainingOn(arenas[1]);
  const state = begin(settings);
  assert.deepEqual(step(state, [input(['jump'], 0, 1), NEUTRAL], settings).map(event => event.kind), ['jump']);
  assert.equal(state.fighters[0].ground, null);
  assert.ok(state.fighters[0].y < settings.arena.floor);
});

test('walking off a ledge clears its support and lands on the next reachable tier', () => {
  const { settings, lower, upper } = overlappingLedges();
  const state = begin(settings);
  const fighter = state.fighters[0];
  Object.assign(fighter, { ground: upper.id, y: upper.y, x: upper.left + 4 });
  step(state, [input([], -1), NEUTRAL], settings);
  assert.equal(fighter.ground, null);
  stepFor(state, 30, [NEUTRAL, NEUTRAL], settings);
  assert.equal(fighter.ground, lower.id);
});

test('down+jump drops one surface at a time and clears the ignored platform', () => {
  const { settings, lower, upper } = overlappingLedges();
  for (const seat of [0, 1]) {
    const state = begin(settings);
    const fighter = state.fighters[seat];
    Object.assign(fighter, { ground: upper.id, y: upper.y, x: 900 });
    const command = seat === 0
      ? { ...input(['jump']), sampled: { jump: { x: 0, y: 1 } } }
      : input(['jump'], 0, 1);
    for (const next of [lower, { id: 'floor', y: settings.arena.floor }]) {
      assert.deepEqual(landAfter(state, command, settings, seat).map(event => event.kind), ['drop']);
      assert.equal(fighter.ground, next.id);
      assert.equal(fighter.y, next.y);
      assert.equal(fighter.ignorePlatform, null);
    }
  }
});

test('both opening positions can reach their advertised first platform in one ordinary jump', () => {
  for (const arena of platformArenas) {
    const settings = trainingOn(arena);
    for (const seat of [0, 1]) {
      const state = begin(settings);
      const next = arena.platforms.find(platform => platform.id === arena.routes[seat][0]);
      const fighter = state.fighters[seat];
      const destination = Math.max(next.left + 20, Math.min(next.right - 20, arena.spawn[seat]));
      const oldX = fighter.x;
      for (let frame = 0; frame < 41; frame++) {
        const x = Math.abs(fighter.x - destination) > settings.fighters[seat].airSpeed
          ? Math.sign(destination - fighter.x) : 0;
        step(state, inputForSeat(seat, input(frame === 0 ? ['jump'] : [], x)), settings);
        if (fighter.ground) break;
      }
      assert.equal(fighter.ground, next.id, arena.name + ' P' + (seat + 1) + ' from ' + oldX);
      assert.equal(fighter.airDashUsed, false);
    }
  }
});

test('body separation at the platform edge never leaves a fighter grounded in midair', () => {
  const { settings, lower, upper: edge } = overlappingLedges();
  const state = begin(settings);
  const [left, right] = state.fighters;
  Object.assign(left, { x: edge.right - 28, y: edge.y, ground: edge.id });
  Object.assign(right, { x: edge.right - 6, y: edge.y, ground: edge.id });
  step(state, [NEUTRAL, NEUTRAL], settings);
  assert.equal(left.ground, edge.id);
  assert.ok(right.x > edge.right);
  assert.equal(right.ground, null);
  stepFor(state, 30, [NEUTRAL, NEUTRAL], settings);
  assert.equal(right.ground, lower.id);
});

test('the station towers have separate upper bays with a reachable middle crossing', () => {
  const settings = trainingOn(arenas[3]);
  const state = begin(settings);
  const map = new Map(settings.arena.platforms.map(platform => [platform.id, platform]));
  const { airSpeed, jump } = settings.fighters[0];
  assert.ok(map.get('upper-right').left - map.get('upper-left').right > airSpeed * jump * 2);

  const floor = { ...settings.arena, id: 'floor', y: settings.arena.floor };
  jumpTo(state, settings, floor, map.get('dock-left'));
  jumpTo(state, settings, map.get('dock-left'), map.get('relay-left'));
  jumpTo(state, settings, map.get('relay-left'), map.get('relay-right'));
});

test('every expanded floor is traversable and both players can reach their own edge', () => {
  for (const arena of arenas) {
    const settings = trainingOn(arena);
    const state = begin(settings);
    const [a, b] = state.fighters;
    assert.ok(arena.right - arena.left >= 1280 * 2.8);
    assert.ok(b.x - a.x >= 346 && b.x - a.x <= 600);
    const frames = Math.ceil((arena.right - arena.left) / settings.fighters[0].run) + 3;
    stepFor(state, frames, [input([], -1), input([], 1)], settings);
    assert.deepEqual(state.fighters.map(fighter => [fighter.x, fighter.ground]),
      [[arena.left, 'floor'], [arena.right, 'floor']]);
    stepFor(state, frames, [input([], 1), input([], 1)], settings);
    const { bodyWidth } = settings.fighters[0];
    assert.deepEqual(state.fighters.map(fighter => [fighter.x, fighter.ground]),
      [[arena.right - bodyWidth, 'floor'], [arena.right, 'floor']]);
    stepFor(state, frames, [input([], -1), input([], -1)], settings);
    assert.deepEqual(state.fighters.map(fighter => [fighter.x, fighter.ground]),
      [[arena.left, 'floor'], [arena.left + bodyWidth, 'floor']]);
  }
});

test('the camera follows the fight across viewports and fits players at opposite corners immediately', () => {
  const viewport = { width: 1280, height: 720 };
  for (const arena of arenas) {
    const center = arena.spawn.map(x => ({ x, y: arena.floor, height: 145 }));
    const near = frameCamera(arena, viewport, center, null, 0, true);
    assert.ok(near.zoom > 1);
    const jumpHeight = baseline.jump * (baseline.jump - 1) / 2;
    const peak = Math.min(arena.floor - jumpHeight, ...arena.platforms.map(platform => {
      const highest = platform.travel?.axis === 'y'
        ? Math.min(platform.y, platform.y + platform.travel.distance) : platform.y;
      return highest - jumpHeight;
    }));
    const tall = frameCamera(arena, viewport, [{ ...center[0], y: peak }, center[1]], near, 0, true);
    if (arena.platforms.length) assert.ok(tall.zoom < near.zoom, arena.name);
    assert.ok((peak - 145 - 32 - tall.y) * tall.zoom >= viewport.height * .19 - .01);
    assert.ok((arena.floor - tall.y) * tall.zoom <= viewport.height * .91 + .01);
    const spread = [{ x: arena.left, y: peak, height: 145 }, { x: arena.right, y: arena.floor, height: 145 }];
    const wide = frameCamera(arena, viewport, spread, near, 0, true);
    assert.ok(wide.zoom < .4);
    assert.equal(wide.x, 0);
    for (const player of spread) {
      const screenX = (player.x - wide.x) * wide.zoom;
      const head = (player.y - player.height - wide.y) * wide.zoom;
      const feet = (player.y - wide.y) * wide.zoom;
      assert.ok(screenX > 20 && screenX < viewport.width - 20);
      assert.ok(head > viewport.height * .19 && feet < viewport.height * .91);
    }
    const chase = [{ x: arena.right - 130, y: arena.floor, height: 145 },
      { x: arena.right, y: arena.floor, height: 145 }];
    let side = wide;
    for (let i = 0; i < 60; i++) side = frameCamera(arena, viewport, chase, side, 1, false);
    const pan = side.x + viewport.width / (2 * side.zoom) - (near.x + viewport.width / (2 * near.zoom));
    assert.ok(side.zoom > 1 && pan > viewport.width);
  }
});

test('each round opens on its approach routes and the combat camera holds still through small hops', () => {
  const viewport = { width: 1280, height: 720 };
  for (const arena of arenas) {
    const players = arena.spawn.map(x => ({ x, y: arena.floor, height: 142 }));
    const opening = frameCamera(arena, viewport, players, null, 1, false, 1);
    const close = frameCamera(arena, viewport, players, null, 1, false);
    assert.ok(opening.zoom < close.zoom * .62);
    for (const route of arena.routes) {
      for (const id of route) {
        const p = arena.platforms.find(p => p.id === id);
        assert.ok(p.right > opening.x && p.left < opening.x + viewport.width / opening.zoom);
        const height = (p.y - opening.y) * opening.zoom;
        assert.ok(height > viewport.height * .19 && height < viewport.height * .9);
      }
    }
    const rising = [{ ...players[0], y: arena.floor - 60 }, players[1]];
    const steady = frameCamera(arena, viewport, rising, close, 1, false);
    assert.equal(steady.y, close.y);
    let prior = opening;
    for (let i = 23; i >= 0; i--) {
      const next = frameCamera(arena, viewport, players, prior, 1, false, i / 24);
      assert.ok(next.zoom >= prior.zoom && Math.abs(next.zoom - prior.zoom) < .065);
      prior = next;
    }
  }
});

test('the opponent AI can follow across the new station bridge gap', () => {
  const settings = trainingOn(arenas[3]);
  const state = begin(settings);
  const [player, cpu] = state.fighters;
  const left = settings.arena.platforms.find(platform => platform.id === 'relay-left');
  const right = settings.arena.platforms.find(platform => platform.id === 'relay-right');
  Object.assign(player, { x: right.left + 130, y: right.y, ground: right.id });
  Object.assign(cpu, { x: left.right - 130, y: left.y, ground: left.id });
  for (let i = 0; i < 65 && cpu.ground !== right.id; i++) {
    step(state, [NEUTRAL, cpuInput(state, settings)], settings);
  }
  assert.equal(cpu.ground, right.id);
});

test('both players can jump across the station cable gap without using the elevator', () => {
  const settings = trainingOn(arenas.find(arena => arena.id === 'star-station'));
  const { arena } = settings;
  const floor = { ...arena, id: 'floor', y: arena.floor };
  for (const seat of [0, 1]) {
    const state = begin(settings);
    state.fighters[1 - seat].x = seat === 0 ? arena.right : arena.left;
    const [dock, relay] = arena.routes[seat].slice(0, 2).map(id => arena.platforms.find(p => p.id === id));
    const opposite = arena.platforms.find(p => p.id === arena.routes[1 - seat][1]);
    jumpTo(state, settings, floor, dock, seat);
    jumpTo(state, settings, dock, relay, seat);
    jumpTo(state, settings, relay, opposite, seat, seat === 0 ? opposite.left + 90 : opposite.right - 90);
  }
});

test('both sides can sprint across the whole level harbor catwalk and drop to the other shore', () => {
  const settings = trainingOn(arenas.find(arena => arena.id === 'harbor'));
  const { arena } = settings;
  const floor = { ...arena, id: 'floor', y: arena.floor };
  const deck = arena.platforms.find(p => p.id === 'gangway');
  const outer = ['loading', 'east-loading'].map(id => arena.platforms.find(p => p.id === id));
  const ends = [975, 3440];
  for (const seat of [0, 1]) {
    const state = begin(settings);
    state.fighters[1 - seat].x = seat === 0 ? arena.right : arena.left;
    const fighter = state.fighters[seat];
    jumpTo(state, settings, floor, outer[seat], seat, ends[seat]);
    jumpTo(state, settings, outer[seat], deck, seat, ends[seat]);
    const direction = seat === 0 ? 1 : -1;
    step(state, inputForSeat(seat, input(['dash'], direction)), settings);
    assert.ok(fighter.dash);
    assert.equal(fighter.ground, deck.id);
    moveOn(state, settings, deck, arena.width / 2, seat);
    moveOn(state, settings, deck, ends[1 - seat], seat);
    assert.equal(fighter.y, deck.y);
    landAfter(state, input(['jump'], 0, 1), settings, seat);
    assert.equal(fighter.ground, outer[1 - seat].id);
    landAfter(state, input(['jump'], 0, 1), settings, seat);
    assert.equal(fighter.ground, 'floor');
  }
});

test('players stay on the same level across the former low-platform seams in both directions', () => {
  const straightRuns = [
    ['dorm-roof', [['west', 900, 1250], ['east', 2900, 3350]]],
    ['night-court', [['west-stand', 900, 1390], ['east-stand', 3020, 3560]]],
    ['harbor', [['loading', 850, 1340], ['east-loading', 2950, 3500]]]
  ];
  for (const [id, wings] of straightRuns) {
    const settings = trainingOn(arenas.find(map => map.id === id));
    const { arena } = settings;
    const floor = { ...arena, id: 'floor', y: arena.floor };
    for (const [seat, [id, start, end]] of wings.entries()) {
      const state = begin(settings);
      state.fighters[1 - seat].x = seat === 0 ? arena.right : arena.left;
      const platform = arena.platforms.find(p => p.id === id);
      jumpTo(state, settings, floor, platform, seat, start);
      moveOn(state, settings, platform, end, seat);
      moveOn(state, settings, platform, start, seat);
      assert.equal(state.fighters[seat].y, platform.y);
      landAfter(state, input(['jump'], 0, 1), settings, seat);
      assert.equal(state.fighters[seat].ground, 'floor');
    }
  }
});

test('combat framing keeps the nearby first and second routes readable from the opening positions', () => {
  const viewport = { width: 1280, height: 720 };
  for (const arena of platformArenas) {
    const players = arena.spawn.map(x => ({ x, y: arena.floor, height: 142 }));
    const view = frameCamera(arena, viewport, players, null, 1, false);
    for (const id of new Set(arena.routes.flatMap(route => route.slice(0, 2)))) {
      const p = arena.platforms.find(p => p.id === id);
      const y = (p.y - view.y) * view.zoom;
      assert.ok(y >= viewport.height * .2 && y < viewport.height * .83, arena.name + ' / ' + id);
      assert.ok(p.left < view.x + viewport.width / view.zoom && p.right > view.x, arena.name + ' / ' + id);
    }
  }
});

test('the rooftop camera frames the lower landing before a fighter drops off either end of the corridor', () => {
  const arena = arenas.find(map => map.id === 'dorm-roof');
  const viewport = { width: 1280, height: 720 };
  const bridge = arena.platforms.find(platform => platform.id === 'bridge');
  const tower = arena.platforms.find(platform => platform.id === 'tank');
  for (const [id, x] of [['west', 1550], ['east', 2730]]) {
    const landing = arena.platforms.find(platform => platform.id === id);
    const players = [{ x, y: bridge.y, height: 137, ground: bridge.id },
      { x: (tower.left + tower.right) / 2, y: tower.y, height: 137, ground: tower.id }];
    const view = frameCamera(arena, viewport, players, null, 1, false);
    assert.ok((landing.y - view.y) * view.zoom <= viewport.height * .91 + .01);
    assert.ok((tower.y - players[1].height - view.y) * view.zoom >= viewport.height * .19);
  }
});

test('both outer wings of each multilayer map lead into its elevated routes', () => {
  const wings = [
    ['dorm-roof', [[890, 'west', 'bridge'], [3330, 'east', 'bridge']]],
    ['night-court', [[830, 'west-stand', 'middle-deck'], [3650, 'east-stand', 'middle-deck']]],
    ['harbor', [[900, 'loading', 'gangway', 'west-gallery'], [3490, 'east-loading', 'gangway', 'east-gallery']]],
    ['star-station', [[1140, 'dock-left', 'relay-left', 'upper-left', 'coil-left'],
      [3210, 'dock-right', 'relay-right', 'upper-right', 'coil-right']]]
  ];
  for (const [arenaId, routes] of wings) {
    const arena = arenas.find(candidate => candidate.id === arenaId);
    const settings = trainingOn(arena);
    const floor = { ...arena, id: 'floor', y: arena.floor };
    for (const [seat, [x, ...ids]] of routes.entries()) {
      const state = begin(settings);
      state.fighters[1 - seat].x = seat === 0 ? arena.right : arena.left;
      moveOn(state, settings, floor, x, seat);
      let from = floor;
      for (const id of ids) {
        const target = arena.platforms.find(platform => platform.id === id);
        jumpTo(state, settings, from, target, seat);
        from = target;
      }
    }
  }
});

test('a harbor player boards at the west dock, crosses the channel and returns to the floor on the east side', () => {
  const settings = trainingOn(arenas.find(a => a.id === 'harbor'));
  const { arena } = settings;
  const lift = arena.platforms.find(p => p.travel);
  assert.equal(lift.travel.distance, 1050);
  const deck = arena.platforms.find(p => p.id === 'gangway');
  const state = begin(settings);
  const [player, spectator] = state.fighters;
  spectator.x = arena.right;
  const floor = { ...arena, id: 'floor', y: arena.floor };
  const loading = arena.platforms.find(p => p.id === 'loading');
  jumpTo(state, settings, floor, loading);
  jumpTo(state, settings, loading, deck);
  while (player.x > 1640) step(state, [input([], -1), NEUTRAL], settings);
  assert.equal(player.ground, deck.id);
  stepFor(state, 395 - state.arenaFrame, [NEUTRAL, NEUTRAL], settings);
  assert.equal(platformOffset(lift, state.arenaFrame), 0);
  landAfter(state, input(['jump']), settings);
  assert.equal(player.ground, lift.id);
  stepFor(state, 675 - state.arenaFrame, [NEUTRAL, NEUTRAL], settings);
  assert.equal(player.ground, lift.id);
  assert.ok(player.x > 2600);
  landAfter(state, input(['jump'], 0, 1), settings);
  assert.equal(player.ground, deck.id);
  landAfter(state, input(['jump'], 0, 1), settings);
  assert.equal(player.ground, 'east-loading');
  landAfter(state, input(['jump'], 0, 1), settings);
  assert.equal(player.ground, 'floor');
});

test('both riders keep their offset through lift turnaround, hitstop, snapshot restore and dismount', () => {
  const settings = trainingOn(arenas.find(a => a.id === 'harbor'));
  const state = begin(settings);
  const lift = settings.arena.platforms.find(p => p.travel);
  const span = lift.travel.distance;
  assert.equal(platformOffset(lift, 405), 0);
  assert.equal(platformOffset(lift, 405 - 16), 0);
  assert.equal(platformOffset(lift, 135), span);
  assert.equal(platformOffset(lift, 135 + 16), span);
  const seats = [62, 238];
  for (const [seat, f] of state.fighters.entries()) {
    Object.assign(f, { x: platformAt(lift, 0).left + seats[seat], y: lift.y, ground: lift.id });
  }
  const snapshot = structuredClone(state);
  const ride = s => {
    for (let n = 0; n < lift.travel.period; n++) {
      if (n === 204) {
        s.freeze = 5;
        const x = s.fighters.map(f => f.x);
        stepFor(s, 5, [NEUTRAL, NEUTRAL], settings);
        assert.equal(s.arenaFrame, n);
        assert.deepEqual(s.fighters.map(f => f.x), x);
      }
      step(s, [NEUTRAL, NEUTRAL], settings);
      for (const [seat, f] of s.fighters.entries()) {
        assert.equal(f.ground, lift.id);
        assert.equal(f.x - platformAt(lift, s.arenaFrame).left, seats[seat]);
      }
    }
  };
  ride(state);
  ride(snapshot);
  assert.deepEqual(state, snapshot);
  stepFor(state, 135, [NEUTRAL, NEUTRAL], settings);
  assert.equal(platformOffset(lift, state.arenaFrame), span);
  step(state, [input(['jump'], 0, 1), NEUTRAL], settings);
  const out = state.fighters[0].x;
  stepFor(state, 28, [NEUTRAL, NEUTRAL], settings);
  assert.equal(state.fighters[0].ground, 'gangway');
  assert.equal(state.fighters[0].x, out);
  assert.equal(state.fighters[1].ground, lift.id);
  state.phase = 'round-over';
  state.phaseTicks = 1;
  step(state, [NEUTRAL, NEUTRAL], settings);
  assert.equal(state.arenaFrame, 0);
});

test('the lift catches a descending fighter only if its moving lip was underneath at crossing time', () => {
  const settings = trainingOn(arenas.find(a => a.id === 'harbor'));
  const lift = settings.arena.platforms.find(p => p.travel);
  for (const [offset, catches] of [[.6, false], [5, true]]) {
    const state = begin(settings);
    const p = platformAt(lift, 0);
    const rightNext = platformAt(lift, 1).right;
    const [player] = state.fighters;
    Object.assign(player, { x: rightNext - offset, y: p.y - 1, vy: 9, ground: null });
    step(state, [NEUTRAL, NEUTRAL], settings);
    assert.equal(player.ground, catches ? lift.id : null);
  }
});

test('either harbor dock connects the freight decks to the trolley at its stopping point', () => {
  const settings = trainingOn(arenas.find(a => a.id === 'harbor'));
  const { arena } = settings;
  const deck = arena.platforms.find(p => p.id === 'gangway');
  for (const [frame, x] of [[395, 1630], [125, 2690]]) {
    const state = begin(settings);
    state.arenaFrame = frame;
    Object.assign(state.fighters[0], { ground: deck.id, y: deck.y, x });
    landAfter(state, input(['jump']), settings);
    assert.equal(state.fighters[0].ground, 'crane');
  }
});

test('players can pursue and land a hit across the dorm corridor, then drop on either side', () => {
  const arena = arenas.find(map => map.id === 'dorm-roof');
  const settings = trainingOn(arena);
  const bridge = arena.platforms.find(p => p.id === 'bridge');
  assert.equal(arena.width, 4160);
  assert.deepEqual([arena.left, arena.right], [96, 4064]);
  assert.equal(bridge.right - bridge.left, 2680);
  for (const seat of [0, 1]) {
    const state = begin(settings);
    const wings = ['west', 'east'].map(id => arena.platforms.find(p => p.id === id));
    const entry = wings[seat], exit = wings[1 - seat];
    const startX = seat === 0 ? bridge.left + 145 : bridge.right - 130;
    const endX = seat === 0 ? bridge.right - 145 : bridge.left + 130;
    Object.assign(state.fighters[1 - seat], { x: endX, y: bridge.y, ground: bridge.id });
    jumpTo(state, settings, { ...arena, id: 'floor', y: arena.floor }, entry, seat);
    jumpTo(state, settings, entry, bridge, seat, startX);
    moveOn(state, settings, bridge, endX + Math.sign(startX - endX) * 80, seat);
    const events = step(state, inputForSeat(seat, input(['A'])), settings)
      .concat(stepFor(state, 8, undefined, settings));
    assert.ok(events.some(event => event.kind === 'hit' && event.source === seat));
    assert.equal(state.fighters[seat].ground, bridge.id);
    stepFor(state, 24, undefined, settings);
    landAfter(state, input(['jump'], 0, 1), settings, seat);
    assert.equal(state.fighters[seat].ground, exit.id);
    landAfter(state, input(['jump'], 0, 1), settings, seat);
    assert.equal(state.fighters[seat].ground, 'floor');
  }
});

test('the court keeps the ground open under the crossing bridge', () => {
  const court = arenas.find(arena => arena.id === 'night-court');
  const settings = trainingOn(court);
  assert.equal(court.platforms.length, 3);
  assert.deepEqual(court.routes.map(route => route.length), [2, 2]);
  assert.deepEqual([...new Set(court.platforms.map(p => p.tier))], [1, 2]);
  const middle = court.width / 2;
  const low = court.routes.map(route => court.platforms.find(p => p.id === route[0]));
  assert.ok(low[0].right < middle && low[1].left > middle);
  const state = begin(settings);
  const [player] = state.fighters;
  player.x = middle;
  landAfter(state, input(['jump']), settings);
  assert.equal(player.ground, 'floor');
});

test('both sides of the court can jump straight up, switch wings or drop through center', () => {
  const settings = trainingOn(arenas.find(arena => arena.id === 'night-court'));
  const { arena } = settings;
  for (const [seat, route] of arena.routes.entries()) {
    const [stand, middle] = route.map(id => arena.platforms.find(p => p.id === id));
    const state = begin(settings);
    const fighter = state.fighters[seat];
    const drop = input(['jump'], 0, 1);
    const jump = input(['jump']);
    for (const surface of [stand, middle]) {
      landAfter(state, jump, settings, seat);
      assert.equal(fighter.ground, surface.id);
    }
    moveOn(state, settings, middle, arena.spawn[1 - seat], seat);
    landAfter(state, drop, settings, seat);
    assert.equal(fighter.ground, arena.routes[1 - seat][0]);
    landAfter(state, jump, settings, seat);
    assert.equal(fighter.ground, middle.id);
    moveOn(state, settings, middle, arena.width / 2, seat);
    landAfter(state, drop, settings, seat);
    assert.equal(fighter.ground, 'floor');
  }
});

test('the court bridge gives both sides a crossing and room to land a hit near its far exit', () => {
  const settings = trainingOn(arenas.find(arena => arena.id === 'night-court'));
  const { arena } = settings;
  const bridge = arena.platforms.find(platform => platform.id === 'middle-deck');
  for (const seat of [0, 1]) {
    const direction = seat === 0 ? 1 : -1;
    const state = begin(settings);
    const actor = state.fighters[seat];
    const defender = state.fighters[1 - seat];
    const entryId = arena.routes[seat][0];
    const exitId = arena.routes[1 - seat][0];
    for (const id of [entryId, bridge.id]) {
      landAfter(state, input(['jump']), settings, seat);
      assert.equal(actor.ground, id);
    }
    const exitX = arena.spawn[1 - seat] + 125 * direction;
    Object.assign(defender, { x: exitX, y: bridge.y, ground: bridge.id });
    moveOn(state, settings, bridge, exitX - 78 * direction, seat);
    const events = step(state, inputForSeat(seat, input(['A'])), settings)
      .concat(stepFor(state, 8, undefined, settings));
    assert.ok(events.some(event => event.kind === 'hit' && event.source === seat));
    assert.equal(actor.ground, bridge.id);
    stepFor(state, 24, undefined, settings);
    landAfter(state, input(['jump'], 0, 1), settings, seat);
    assert.equal(actor.ground, exitId);
  }
});

test('a single regular jump from the lip cannot skip the gap between the court stands', () => {
  const settings = trainingOn(arenas.find(arena => arena.id === 'night-court'));
  const { arena } = settings;
  for (const seat of [0, 1]) {
    const state = begin(settings);
    const actor = state.fighters[seat];
    const stand = arena.platforms.find(platform => platform.id === arena.routes[seat][0]);
    const direction = seat === 0 ? 1 : -1;
    landAfter(state, input(['jump']), settings, seat);
    moveOn(state, settings, stand, direction > 0 ? stand.right - 10 : stand.left + 10, seat);
    landAfter(state, input(['jump'], direction), settings, seat, direction);
    assert.notEqual(actor.ground, arena.routes[1 - seat][0]);
  }
});

test('both fighters can land on the first tier directly from each multi-level spawn', () => {
  for (const arena of platformArenas) {
    for (const { fighter } of roster) {
      const settings = { ...trainingOn(arena), fighters: [fighter, fighter] };
      for (const seat of [0, 1]) {
        const state = begin(settings);
        landAfter(state, input(['jump']), settings, seat);
        assert.equal(state.fighters[seat].ground, arena.routes[seat][0], arena.name + ' / ' + fighter.id + ' / ' + seat);
      }
    }
  }
});

test('both lift riders keep their height through ascent, turnaround, hitstop, replay and descent', () => {
  const settings = trainingOn(arenas.find(a => a.id === 'star-station'));
  assert.equal(settings.arena.platforms.length, 9);
  const car = settings.arena.platforms.find(p => p.travel);
  assert.equal(car.travel.axis, 'y');
  const state = begin(settings);
  const seats = [car.left + 42, car.right - 42];
  for (const [seat, f] of state.fighters.entries()) Object.assign(f, { x: seats[seat], y: car.y, ground: car.id });
  let saved;
  for (let n = 0; n < car.travel.period; n++) {
    if (n === 125) {
      state.freeze = 5;
      const before = state.fighters.map(f => f.y);
      stepFor(state, 5, [NEUTRAL, NEUTRAL], settings);
      assert.equal(state.arenaFrame, n);
      assert.deepEqual(state.fighters.map(f => f.y), before);
      saved = structuredClone(state);
    }
    step(state, [NEUTRAL, NEUTRAL], settings);
    if (saved) step(saved, [NEUTRAL, NEUTRAL], settings);
    const deck = platformAt(car, n + 1);
    for (const [seat, f] of state.fighters.entries()) {
      assert.equal(f.ground, car.id);
      assert.equal(f.y, deck.y);
      assert.equal(f.x, seats[seat]);
    }
  }
  assert.deepEqual(state, saved);
  assert.equal(platformAt(car, 480).y, car.y);
  assert.equal(tierAt(settings.arena, car, 480), 1);
  assert.equal(car.y - platformAt(car, 240).y, 458);
  assert.equal(tierAt(settings.arena, car, 240), 4);
  stepFor(state, 240, [NEUTRAL, NEUTRAL], settings);
  landAfter(state, input(['jump'], 0, 1), settings);
  assert.equal(state.fighters[0].ground, 'floor');
  assert.equal(state.fighters[1].ground, car.id);
});

test('a one-way vertical lift catches only a relative crossing from above', () => {
  const settings = trainingOn(arenas.find(a => a.id === 'star-station'));
  const lift = settings.arena.platforms.find(p => p.travel);
  for (const [frame, gap, vy, inside, expected] of [
    [85, .5, -2, true, true], [85, -.5, -2, true, false], [85, .5, -2, false, false],
    [325, 1, 0, true, false], [325, 1, 5, true, true]
  ]) {
    const state = begin(settings);
    state.arenaFrame = frame;
    const old = platformAt(lift, frame);
    const next = platformAt(lift, frame + 1);
    const f = state.fighters[0];
    Object.assign(f, { x: inside ? (lift.left + lift.right) / 2 : lift.right + 1, y: old.y - gap, vy, ground: null });
    step(state, [NEUTRAL, NEUTRAL], settings);
    assert.equal(f.ground, expected ? lift.id : null);
    if (expected) assert.equal(f.y, next.y);
  }
});

test('either opening seat can board the station lift and step off onto its own tower crown with a single jump', () => {
  const settings = trainingOn(arenas.find(a => a.id === 'star-station'));
  const lift = settings.arena.platforms.find(p => p.travel);
  for (const seat of [0, 1]) {
    const state = begin(settings);
    const f = state.fighters[seat];
    const towardCar = seat === 0 ? 1 : -1;
    const stop = seat === 0 ? lift.left + 27 : lift.right - 27;
    step(state, inputForSeat(seat, input(['jump'], towardCar)), settings);
    for (let n = 0; n < 45 && !f.ground; n++) {
      const dir = (stop - f.x) * towardCar > 0 ? towardCar : 0;
      step(state, inputForSeat(seat, input([], dir)), settings);
    }
    assert.equal(f.ground, lift.id);
    stepFor(state, 235 - state.arenaFrame, [NEUTRAL, NEUTRAL], settings);
    const outward = -towardCar;
    landAfter(state, input(['jump'], outward), settings, seat, outward);
    assert.equal(f.ground, seat === 0 ? 'coil-left' : 'coil-right');
  }
});

test('both broadcast fighters can run and jump across the single floor with either jump input', () => {
  const arena = arenas.find(arena => arena.id === 'broadcast-ring');
  assert.deepEqual(arenas.filter(arena => arena.platforms.length === 0).map(arena => arena.id), ['broadcast-ring']);
  assert.deepEqual(arena.routes, [[], []]);
  assert.equal(arena.width, 4480);
  assert.equal(arena.right - arena.left, 4288);
  assert.equal(arena.spawn[1] - arena.spawn[0], 346);

  const settings = trainingOn(arena);
  const state = begin(settings);
  const [left, right] = state.fighters;
  const outward = [input([], -1), input([], 1)];
  stepFor(state, 16, outward, settings);
  assert.ok(left.x < arena.spawn[0] && right.x > arena.spawn[1]);

  const jumps = step(state, [input(['jump'], -1), input(['jump'], 1)], settings);
  assert.deepEqual(jumps.map(event => event.kind), ['jump', 'jump']);
  assert.ok(state.fighters.every(fighter => fighter.ground === null && fighter.y < arena.floor));
  const landings = stepFor(state, 60, outward, settings).filter(event => event.kind === 'land');
  assert.deepEqual(landings.map(event => event.source), [0, 1]);
  assert.ok(state.fighters.every(fighter => fighter.ground === 'floor' && fighter.y === arena.floor));

  const downJump = input(['jump'], 0, 1);
  assert.deepEqual(step(state, [downJump, downJump], settings).map(event => event.kind), ['jump', 'jump']);
  assert.ok(state.fighters.every(fighter =>
    fighter.ground === null && fighter.y < arena.floor && fighter.ignorePlatform === null));
});

test('the broadcast CPU chases and hits an opponent at either end of the floor', () => {
  const arena = arenas.find(arena => arena.id === 'broadcast-ring');
  const settings = trainingOn(arena);
  for (const edge of [arena.left, arena.right]) {
    const state = begin(settings);
    const [player, cpu] = state.fighters;
    player.x = edge;
    let hit = false;
    for (let frame = 0; frame < 240 && !hit; frame++) {
      const events = step(state, [NEUTRAL, cpuInput(state, settings)], settings);
      assert.equal(cpu.ground, 'floor');
      hit = events.some(event => event.kind === 'hit' && event.source === 1);
    }
    assert.ok(hit, 'CPU should reach the opponent at x=' + edge);
  }
});

test('the computer can approach an opponent occupying either upper route on maps with platforms', () => {
  for (const arena of platformArenas) {
    const settings = trainingOn(arena);
    const goals = new Set(arena.routes.map(route => route.at(-1)));
    if (arena.id === 'harbor') goals.add('crane');
    for (const id of goals) {
      const s = begin(settings);
      const roof = platformAt(arena.platforms.find(p => p.id === id), 0);
      Object.assign(s.fighters[0], { x: (roof.left + roof.right) / 2, y: roof.y, ground: id });
      const visited = new Set([s.fighters[1].ground]);
      let met = false;
      for (let n = 0; n < 240 && !met; n++) {
        const events = step(s, [NEUTRAL, cpuInput(s, settings)], settings);
        if (s.fighters[1].ground) visited.add(s.fighters[1].ground);
        met = events.some(e => e.kind === 'hit' && e.source === 1);
      }
      assert.ok(visited.size >= 2 && met, arena.name + ' / ' + roof.name);
    }
  }
});

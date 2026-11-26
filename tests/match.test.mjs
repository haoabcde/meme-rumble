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

const multiLevelArenas = arenas.filter(arena => arena.id !== 'neon-ring');
const config = { rules, arena: arenas[0], fighters: [testFighter, testFighter] };
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
});

test('timeout compares life ratios and the next round swaps sides and restores values', () => {
  const settings = { ...config, fighters: [testFighter, { ...testFighter, maxHp: 1200 }] };
  const state = begin(settings);
  state.fighters[0].hp = 400;
  state.fighters[1].hp = 450;
  state.remaining = 1;
  step(state, [NEUTRAL, NEUTRAL], settings);
  assert.deepEqual(state.result, { winner: 0, reason: 'time' });
  stepFor(state, 105, [NEUTRAL, NEUTRAL], settings);
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

test('the baseline fighters retain common moves, and unconfigured signature slots are inert', () => {
  assert.deepEqual(roster.map(entry => entry.fighter.id), ['whale', 'frog', 'banana', 'gaga']);
  assert.equal(baseline.actions.length, 5);
  assert.ok(baseline.actions.every(move => move.slot === 'A'));
  for (const { fighter } of roster.filter(entry => ['whale', 'frog'].includes(entry.fighter.id))) {
    assert.deepEqual(fighter.actions.filter(m => m.slot === 'A').map(m => m.id), baseline.actions.map(m => m.id));
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
  assert.equal(fighter.airActionUsed, true);
  assert.deepEqual(step(state, [input(['dash', 'jump'], 1), NEUTRAL], settings), []);
  assert.equal(fighter.vy, jumpVy + 1);
  assert.equal(fighter.y, jumpY + jumpVy + 1);
  waitForEvent(state, settings, 'land');
  assert.equal(fighter.airActionUsed, false);
  step(state, [input(['jump']), NEUTRAL], settings);
  assert.ok(step(state, [input(['dash'], 1), NEUTRAL], settings).some(event => event.kind === 'dash'));
});

test('a ground dash applies gravity immediately after leaving a platform', () => {
  const settings = trainingOn(arenas[1]);
  const state = begin(settings);
  const fighter = state.fighters[0];
  const bench = settings.arena.platforms.find(platform => platform.id === 'bench');
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
    assert.equal(fighter.airActionUsed, false);
    fighter.guard = rules.dashGuardCost.air;
    assert.deepEqual(tap(['dash']).map(event => event.kind), ['dash']);
    assert.equal(fighter.guard, 0);
    assert.equal(fighter.guardWait, rules.guardDelay);
    stepFor(state, 5, [NEUTRAL, NEUTRAL], settings);
    assert.equal(fighter.airActionUsed, true);
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

test('a second jump trades the air dash for extra height without skipping the middle tier', () => {
  const settings = trainingOn(arenas[1]);
  const state = begin(settings);
  const fighter = state.fighters[0];
  const bench = settings.arena.platforms.find(p => p.id === 'bench');
  fighter.x = bench.right - 60;
  step(state, [input(['jump']), NEUTRAL], settings);
  stepFor(state, 16, [NEUTRAL, NEUTRAL], settings);
  assert.deepEqual(step(state, [input(['jump']), NEUTRAL], settings).map(event => event.kind), ['air-jump']);
  assert.equal(fighter.airActionUsed, true);
  assert.deepEqual(step(state, [input(['dash', 'jump'], 1), NEUTRAL], settings), []);
  let peak = fighter.y;
  for (let frame = 0; frame < 42 && !fighter.ground; frame++) {
    step(state, [NEUTRAL, NEUTRAL], settings);
    peak = Math.min(peak, fighter.y);
  }
  assert.equal(settings.arena.floor - peak, 231);
  assert.equal(fighter.ground, 'bench');
  assert.equal(fighter.airActionUsed, false);
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

function alignOverlapping(state, before, next, settings, seat = 0) {
  const fighter = state.fighters[seat];
  const left = Math.max(before.left, next.left);
  const right = Math.min(before.right, next.right);
  const margin = Math.max(1, Math.min(10, Math.floor((right - left - 8) / 2)));
  const minimum = left + margin;
  const maximum = right - margin;
  assert.ok(minimum <= maximum, before.id + ' and ' + next.id + ' must overlap in this practice route');
  for (let i = 0; i < 130 && (fighter.x < minimum || fighter.x > maximum); i++) {
    step(state, inputForSeat(seat, input([], fighter.x < minimum ? 1 : -1)), settings);
    assert.equal(fighter.ground, before.id, before.id + ' should continue supporting the fighter');
  }
  assert.ok(fighter.x >= minimum && fighter.x <= maximum);
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

for (const arena of multiLevelArenas) {
  test(arena.name + ' · public jumps reach every tier and descend one surface per command', () => {
    const settings = trainingOn(arena);
    const state = begin(settings);
    const map = new Map(arena.platforms.map(platform => [platform.id, platform]));
    const floor = { ...arena, id: 'floor', y: arena.floor };
    const path = [floor, ...arena.routes[0].map(id => map.get(id))];
    const peak = settings.fighters[0].jump * (settings.fighters[0].jump - 1) / 2;
    assert.equal(path.length, 5);
    assert.ok(floor.y - path.at(-1).y >= 520,
      'the upper route needs usable vertical separation from the floor');
    assert.ok(path[0].y - path[2].y > peak, 'the middle layer cannot be skipped to directly from the floor');
    for (let i = 1; i < path.length; i++) {
      assert.ok(path[i - 1].y - path[i].y <= peak - 15, 'a shared jump has clearance above the next tier');
      alignOverlapping(state, path[i - 1], path[i], settings);
      assert.deepEqual(landAfter(state, input(['jump']), settings).map(event => event.kind), ['jump']);
      assert.equal(state.fighters[0].ground, path[i].id);
      assert.equal(state.fighters[0].y, path[i].y);
    }
    for (let i = path.length - 1; i > 0; i--) {
      alignOverlapping(state, path[i], path[i - 1], settings);
      const shortChord = { ...input(['jump']), sampled: { jump: { x: 0, y: 1 } } };
      assert.deepEqual(landAfter(state, shortChord, settings).map(event => event.kind), ['drop']);
      assert.equal(state.fighters[0].ground, path[i - 1].id);
      assert.equal(state.fighters[0].ignorePlatform, null);
    }
    assert.equal(state.fighters[0].y, arena.floor);
  });
}

test('a falling fighter lands on the first crossed surface regardless of drawing order', () => {
  const settings = trainingOn(arenas[0]);
  const state = begin(settings);
  const fighter = state.fighters[0];
  const terrace = settings.arena.platforms.find(platform => platform.id === 'terrace');
  const bridge = settings.arena.platforms.find(platform => platform.id === 'bridge');
  Object.assign(fighter, {
    x: (terrace.left + terrace.right) / 2,
    ground: null,
    y: terrace.y - 18,
    vy: bridge.y - terrace.y + 32
  });
  step(state, [NEUTRAL, NEUTRAL], settings);
  assert.equal(fighter.ground, 'terrace');
  assert.equal(fighter.y, terrace.y);
});

test('a fighter cannot land on a platform after passing below its edge', () => {
  const settings = trainingOn(arenas[0]);
  const state = begin(settings);
  const fighter = state.fighters[0];
  const edge = settings.arena.platforms.find(platform => platform.id === 'terrace');
  fighter.x = edge.left - 5;
  fighter.ground = null;
  fighter.y = edge.y - 1;
  fighter.vy = 22;
  step(state, [input([], 1), NEUTRAL], settings);
  assert.ok(fighter.x > edge.left, 'by the end of the tick the fighter is above the horizontal span');
  assert.equal(fighter.ground, null, 'the fighter was still outside when crossing the top plane');
  stepFor(state, 30, [NEUTRAL, NEUTRAL], settings);
  assert.equal(fighter.ground, 'bridge');
});

test('down+jump on the ground does not launch a new jump', () => {
  const settings = trainingOn(arenas[1]);
  const state = begin(settings);
  assert.deepEqual(step(state, [input(['jump'], 0, 1), NEUTRAL], settings), []);
  assert.equal(state.fighters[0].ground, 'floor');
  assert.equal(state.fighters[0].y, settings.arena.floor);
});

test('walking off a ledge clears its support and lands on the next reachable tier', () => {
  const settings = trainingOn(arenas[1]);
  const state = begin(settings);
  const fighter = state.fighters[0];
  const edge = settings.arena.platforms.find(platform => platform.id === 'score-deck');
  fighter.ground = edge.id;
  fighter.y = edge.y;
  fighter.x = edge.left + 4;
  step(state, [input([], -1), NEUTRAL], settings);
  assert.equal(fighter.ground, null);
  stepFor(state, 30, [NEUTRAL, NEUTRAL], settings);
  assert.equal(fighter.ground, 'press-west');
});

for (const arena of multiLevelArenas) {
  test(arena.name + ' · P2 can also reach the upper platform from the right side', () => {
    const settings = trainingOn(arena);
    const state = begin(settings);
    const floor = { ...arena, id: 'floor', y: arena.floor };
    const path = [floor, ...arena.routes[1].map(id => arena.platforms.find(platform => platform.id === id))];
    for (let i = 1; i < path.length; i++) {
      alignOverlapping(state, path[i - 1], path[i], settings, 1);
      landAfter(state, input(['jump']), settings, 1);
      assert.equal(state.fighters[1].ground, path[i].id);
    }
  });
}

test('both opening positions can reach their advertised first platform in one ordinary jump', () => {
  for (const arena of multiLevelArenas) {
    const settings = trainingOn(arena);
    const state = begin(settings);
    for (const seat of [0, 1]) {
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
      assert.equal(fighter.airActionUsed, false);
    }
  }
});

test('body separation at the platform edge never leaves a fighter grounded in midair', () => {
  const settings = trainingOn(arenas[0]);
  const state = begin(settings);
  const [left, right] = state.fighters;
  const edge = settings.arena.platforms.find(platform => platform.id === 'terrace');
  Object.assign(left, { x: edge.right - 28, y: edge.y, ground: edge.id });
  Object.assign(right, { x: edge.right - 6, y: edge.y, ground: edge.id });
  step(state, [NEUTRAL, NEUTRAL], settings);
  assert.equal(left.ground, 'terrace');
  assert.ok(right.x > edge.right);
  assert.equal(right.ground, null);
  stepFor(state, 30, [NEUTRAL, NEUTRAL], settings);
  assert.equal(right.ground, 'bridge');
});

test('the station towers have separate upper bays with a reachable middle crossing', () => {
  const settings = trainingOn(arenas[3]);
  const state = begin(settings);
  const map = new Map(settings.arena.platforms.map(platform => [platform.id, platform]));
  const fighter = state.fighters[0];
  const { airSpeed, jump } = settings.fighters[0];
  assert.ok(map.get('upper-right').left - map.get('upper-left').right > airSpeed * jump * 2);

  const floor = { ...settings.arena, id: 'floor', y: settings.arena.floor };
  alignOverlapping(state, floor, map.get('dock-left'), settings);
  landAfter(state, input(['jump']), settings);
  assert.equal(fighter.ground, 'dock-left');
  landAfter(state, input(['jump']), settings);
  assert.equal(fighter.ground, 'relay-left');
  const leftRelay = map.get('relay-left');
  const rightRelay = map.get('relay-right');
  while (fighter.x < leftRelay.right - 36) step(state, [input([], 1), NEUTRAL], settings);
  assert.equal(fighter.ground, leftRelay.id);
  step(state, [input(['jump'], 1), NEUTRAL], settings);
  for (let i = 0; i < 42 && !fighter.ground; i++) {
    step(state, [input([], fighter.x < rightRelay.left + 28 ? 1 : 0), NEUTRAL], settings);
  }
  assert.equal(fighter.ground, 'relay-right');
});

test('every expanded floor is traversable and both players can reach their own edge', () => {
  for (const arena of multiLevelArenas) {
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
    assert.equal(b.x, arena.right);
    assert.equal(a.x, arena.right - settings.fighters[0].bodyWidth);
  }
});

test('the camera follows the fight across viewports and fits players at opposite corners immediately', () => {
  const viewport = { width: 1280, height: 720 };
  for (const arena of multiLevelArenas) {
    const center = arena.spawn.map(x => ({ x, y: arena.floor, height: 145 }));
    const near = frameCamera(arena, viewport, center, null, 0, true);
    assert.ok(near.zoom > 1);
    const peak = Math.min(...arena.platforms.map(platform => platform.y)) - 153;
    const tall = frameCamera(arena, viewport, [{ ...center[0], y: peak }, center[1]], near, 0, true);
    assert.ok(tall.zoom < .8);
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

test('the single-screen duel ring keeps its fighters on the mat through jumps and corner pressure', () => {
  const arena = arenas.find(a => a.id === 'neon-ring');
  const settings = trainingOn(arena);
  const state = begin(settings);
  assert.deepEqual(arena.routes, [[], []]);
  assert.equal(arena.platforms.length, 0);
  step(state, [input(['jump']), input(['jump'])], settings);
  assert.ok(state.fighters.every(f => f.y < arena.floor));
  stepFor(state, 180, [input([], -1), input([], 1)], settings);
  assert.deepEqual(state.fighters.map(f => [f.x, f.y, f.ground]), [
    [arena.left, arena.floor, 'floor'], [arena.right, arena.floor, 'floor']
  ]);
});

test('each round opens on its approach routes and the combat camera holds still through small hops', () => {
  const viewport = { width: 1280, height: 720 };
  for (const arena of multiLevelArenas) {
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

test('the side entrances link into the main routes with the same shared jump', () => {
  const entries = [
    [arenas[0], 'planter', 'west-annex', 1],
    [arenas[0], 'greenhouse', 'east-garden', -1],
    [arenas[1], 'west-bench', 'west-end', 1],
    [arenas[1], 'east-bench', 'east-end', -1],
    [arenas[2], 'freight-dock', 'east-loading', -1]
  ];
  for (const [arena, entranceId, platformId, direction] of entries) {
    const settings = trainingOn(arena);
    const state = begin(settings);
    const fighter = state.fighters[0];
    const from = arena.platforms.find(platform => platform.id === entranceId);
    const to = arena.platforms.find(platform => platform.id === platformId);
    const start = direction === 1 ? from.right - 20 : from.left + 20;
    const target = Math.max(to.left + 18, Math.min(to.right - 18, start));
    Object.assign(fighter, { x: start, y: from.y, ground: from.id });
    for (let frame = 0; frame < 45; frame++) {
      const axis = Math.abs(fighter.x - target) > 9 ? Math.sign(target - fighter.x) : 0;
      step(state, [input(frame ? [] : ['jump'], axis), NEUTRAL], settings);
      if (fighter.ground) break;
    }
    assert.equal(fighter.ground, to.id, from.name + ' → ' + to.name);
  }
});

test('a harbor player crosses both gaps, takes the moving lift, and returns along a different route', () => {
  const settings = trainingOn(arenas.find(a => a.id === 'harbor'));
  const state = begin(settings);
  const [player] = state.fighters;
  const run = (x, ticks) => stepFor(state, ticks, [input([], x), NEUTRAL], settings);
  const jump = (ground, x = 0, y = 0) => {
    step(state, [input(['jump'], x, y), NEUTRAL], settings);
    assert.equal(player.ground, null);
    for (let n = 0; !player.ground && n < 55; n++) run(x, 1);
    assert.equal(player.ground, ground);
  };
  jump('loading', -1);
  run(-1, 5);
  jump('gangway');
  jump('middle', 1);
  run(1, 28);
  jump('overpass', 1);
  jump('crane');
  const boarded = player.x;
  run(0, 405 - state.arenaFrame);
  assert.equal(player.ground, 'crane');
  assert.ok(boarded - player.x > 900);
  jump('gangway', 0, 1);
  run(-1, 37);
  jump('west-cabin');
  jump('gangway', 0, 1);
  jump('floor', 0, 1);
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
  step(state, [input(['jump'], 0, 1), NEUTRAL], settings);
  const out = state.fighters[0].x;
  stepFor(state, 28, [NEUTRAL, NEUTRAL], settings);
  assert.equal(state.fighters[0].ground, 'middle');
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

test('at either dock the fourth-tier gallery and the trolley allow a round trip using ordinary jumps', () => {
  const settings = trainingOn(arenas.find(a => a.id === 'harbor'));
  for (const [id, frame, x] of [['west-gallery', 405, 1530], ['east-gallery', 135, 2860]]) {
    const state = begin(settings);
    const deck = settings.arena.platforms.find(p => p.id === id);
    state.arenaFrame = frame;
    Object.assign(state.fighters[0], { ground: id, y: deck.y, x });
    landAfter(state, input(['jump'], 0, 1), settings);
    assert.equal(state.fighters[0].ground, 'crane');
    landAfter(state, input(['jump']), settings);
    assert.equal(state.fighters[0].ground, id);
  }
});

test('the two dormitory corridors connect across the courtyard, and a jump in center court stays on the floor', () => {
  const dorm = trainingOn(arenas.find(a => a.id === 'dorm-roof'));
  const s = begin(dorm);
  const west = dorm.arena.platforms.find(p => p.id === 'bridge');
  const east = dorm.arena.platforms.find(p => p.id === 'bridge-east');
  assert.equal(east.left - west.right, 198);
  Object.assign(s.fighters[0], { x: west.right - 35, y: west.y, ground: west.id });
  landAfter(s, input(['jump'], 1), dorm, 0, 1);
  assert.equal(s.fighters[0].ground, east.id);

  const court = trainingOn(arenas.find(a => a.id === 'night-court'));
  const game = begin(court);
  const mid = court.arena.width / 2;
  const innerLow = court.arena.routes.map(route => court.arena.platforms.find(p => p.id === route[0]));
  assert.equal(innerLow[1].left - innerLow[0].right, 629);
  game.fighters[0].x = mid;
  landAfter(game, input(['jump']), court);
  assert.equal(game.fighters[0].ground, 'floor');
});

test('both lift riders keep their height through ascent, turnaround, hitstop, replay and descent', () => {
  const settings = trainingOn(arenas.find(a => a.id === 'star-station'));
  const car = settings.arena.platforms.find(p => p.travel);
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
  assert.equal(car.y - platformAt(car, 240).y, 465);
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

test('the computer can approach an opponent occupying either upper route from the opening floor on every map', () => {
  for (const arena of multiLevelArenas) {
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
      assert.ok(visited.size >= 3 && met, arena.name + ' / ' + roof.name);
    }
  }
});

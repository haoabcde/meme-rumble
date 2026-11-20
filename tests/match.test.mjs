import assert from 'node:assert/strict';
import test from 'node:test';
import { createMatch, step } from '../dist/core/match.js';
import { NEUTRAL } from '../dist/core/types.js';
import { rules, testFighter } from '../dist/content/demo.js';
import { arenas } from '../dist/content/arenas.js';
import { roster } from '../dist/content/roster.js';

const config = { rules, arena: arenas[0], fighters: [testFighter, testFighter] };
const input = (pressed = [], x = 0, y = 0) => ({ pressed, x, y });

function begin(settings = config) {
  const state = createMatch(settings);
  for (let i = 0; i < 120; i++) step(state, [NEUTRAL, NEUTRAL], settings);
  return state;
}

function closeDistance(state) {
  state.fighters[0].x = 595;
  state.fighters[1].x = 685;
}

function stepFor(state, count, current = [NEUTRAL, NEUTRAL], settings = config) {
  return Array.from({ length: count }, () => step(state, current, settings)).flat();
}

test('dash closes distance quickly; jump can land on a platform and down+jump passes it', () => {
  const state = begin();
  step(state, [input(['dash'], -1), NEUTRAL], config);
  stepFor(state, 7);
  assert.equal(state.fighters[0].x, config.arena.spawn[0] - testFighter.dash * 8);
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
  assert.deepEqual(state.fighters.map(fighter => fighter.x), [813, 467]);
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

test('shipped roster shares the same basic move and leaves all character skills empty', () => {
  assert.equal(roster.length, 4);
  const kit = roster[0].fighter;
  assert.deepEqual(kit.actions.map(move => move.slot), ['A']);
  for (const { fighter } of roster) {
    assert.deepEqual(fighter.actions, kit.actions);
    assert.equal(fighter.jump, kit.jump);
    assert.equal(fighter.maxHp, kit.maxHp);
    const settings = { ...config, fighters: [fighter, fighter] };
    const state = begin(settings);
    closeDistance(state);
    step(state, [input(['B', 'C']), NEUTRAL], settings);
    const events = stepFor(state, 12, [NEUTRAL, NEUTRAL], settings);
    assert.equal(events.some(event => event.kind === 'hit'), false);
    assert.equal(state.fighters[0].attack, null);
    assert.equal(state.fighters[1].hp, fighter.maxHp);
  }
});

function trainingOn(arena) {
  return { ...config, training: true, arena, fighters: [roster[0].fighter, roster[1].fighter] };
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

function landAfter(state, command, settings, seat = 0) {
  const first = step(state, inputForSeat(seat, command), settings);
  assert.equal(state.fighters[seat].ground, null);
  let last = [];
  for (let i = 0; i < 60 && !state.fighters[seat].ground; i++) {
    last = step(state, [NEUTRAL, NEUTRAL], settings);
  }
  assert.ok(last.some(event => event.kind === 'land'));
  return first;
}

for (const arena of arenas) {
  test(arena.name + ' · public jumps reach all three levels and descend one surface per command', () => {
    const settings = trainingOn(arena);
    const state = begin(settings);
    const map = new Map(arena.platforms.map(platform => [platform.id, platform]));
    const floor = { ...arena, id: 'floor', y: arena.floor };
    const path = [floor, ...arena.route.map(id => map.get(id))];
    const peak = settings.fighters[0].jump * (settings.fighters[0].jump - 1) / 2;
    assert.equal(path.length, 4);
    assert.ok(path[0].y - path[2].y > peak, 'the middle layer cannot be skipped to directly from the floor');
    for (let i = 1; i < path.length; i++) {
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
  fighter.x = 600;
  fighter.ground = null;
  fighter.y = 370;
  fighter.vy = 80;
  step(state, [NEUTRAL, NEUTRAL], settings);
  assert.equal(fighter.ground, 'terrace');
  assert.equal(fighter.y, 388);
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
  assert.equal(fighter.ground, 'west-stand');
});

const rightRoutes = [
  ['east', 'bridge', 'terrace'],
  ['bench', 'east-stand', 'score-deck'],
  ['east-loading', 'overpass', 'crane'],
  ['dock-right', 'relay-right', 'upper-right']
];

for (const [index, arena] of arenas.entries()) {
  test(arena.name + ' · P2 can also reach the upper platform from the right side', () => {
    const settings = trainingOn(arena);
    const state = begin(settings);
    const floor = { ...arena, id: 'floor', y: arena.floor };
    const path = [floor, ...rightRoutes[index].map(id => arena.platforms.find(platform => platform.id === id))];
    for (let i = 1; i < path.length; i++) {
      alignOverlapping(state, path[i - 1], path[i], settings, 1);
      landAfter(state, input(['jump']), settings, 1);
      assert.equal(state.fighters[1].ground, path[i].id);
    }
  });
}

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

  landAfter(state, input(['jump']), settings);
  assert.equal(fighter.ground, 'dock-left');
  landAfter(state, input(['jump']), settings);
  assert.equal(fighter.ground, 'relay-left');
  const leftRelay = map.get('relay-left');
  while (fighter.x < leftRelay.right - 60) step(state, [input([], 1), NEUTRAL], settings);
  assert.equal(fighter.ground, leftRelay.id);
  step(state, [input(['jump'], 1), NEUTRAL], settings);
  for (let i = 0; i < 42 && !fighter.ground; i++) {
    step(state, [input([], fighter.x < 775 ? 1 : 0), NEUTRAL], settings);
  }
  assert.equal(fighter.ground, 'relay-right');
});

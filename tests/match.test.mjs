import assert from 'node:assert/strict';
import test from 'node:test';
import { createMatch, step } from '../dist/core/match.js';
import { ENERGY_PER_BAR, MAX_ENERGY, NEUTRAL } from '../dist/core/types.js';
import { rules, testFighter } from '../dist/content/demo.js';
import { arenas } from '../dist/content/arenas.js';
import { gagaActionIds, gagaGroundCombo } from '../dist/content/gaga.js';
import { roster } from '../dist/content/roster.js';
import { frameCamera } from '../dist/web/camera.js';
import { cpuInput } from '../dist/web/cpu.js';
import { GagaWalk } from '../dist/web/gaga-walk.js';
import { gagaContact } from '../dist/web/gaga-contact.js';
import { poleSwingFor } from '../dist/web/gaga-pole-fx.js';

const config = { rules, arena: arenas[0], fighters: [testFighter, testFighter] };
const input = (pressed = [], x = 0, y = 0) => ({ pressed, x, y });

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
  state.fighters[0].energy = MAX_ENERGY;
  state.fighters[1].energy = ENERGY_PER_BAR;
  state.remaining = 1;
  step(state, [NEUTRAL, NEUTRAL], settings);
  assert.deepEqual(state.result, { winner: 0, reason: 'time' });
  stepFor(state, 105, [NEUTRAL, NEUTRAL], settings);
  assert.equal(state.round, 2);
  assert.deepEqual(state.fighters.map(fighter => fighter.x), [...settings.arena.spawn].reverse());
  assert.deepEqual(state.fighters.map(fighter => fighter.hp), [1000, 1200]);
  assert.deepEqual(state.fighters.map(fighter => fighter.energy), [0, 0]);
  assert.deepEqual(state.wins, [1, 0]);
});

test('saving and replaying the same input frames reproduces states and events', () => {
  const state = begin();
  closeDistance(state);
  state.fighters[0].energy = ENERGY_PER_BAR;
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

test('both players gain energy on actual hits, up to three bars', () => {
  const state = begin();
  closeDistance(state);
  assert.deepEqual(state.fighters.map(fighter => fighter.energy), [0, 0]);
  step(state, [input(['A']), input(['A'])], config);
  assert.deepEqual(state.fighters.map(fighter => fighter.energy), [0, 0]);
  stepFor(state, 5);
  assert.deepEqual(state.fighters.map(fighter => fighter.energy), [30, 30]);
  stepFor(state, 35);
  closeDistance(state);
  state.fighters[0].energy = MAX_ENERGY - 1;
  state.fighters[1].energy = MAX_ENERGY - 2;
  step(state, [input(['A']), NEUTRAL], config);
  stepFor(state, 5);
  assert.deepEqual(state.fighters.map(fighter => fighter.energy), [MAX_ENERGY, MAX_ENERGY]);
});

test('whiffed and guarded normals give neither player energy', () => {
  for (const guarding of [false, true]) {
    const state = begin();
    if (guarding) closeDistance(state);
    const target = guarding ? input([], 0, 1) : NEUTRAL;
    step(state, [input(['A']), target], config);
    const events = stepFor(state, 28, [NEUTRAL, target]);
    assert.ok(events.some(event => event.kind === (guarding ? 'block' : 'whiff')));
    assert.deepEqual(state.fighters.map(fighter => fighter.energy), [0, 0]);
  }
});

test('skill slots charge one or three bars at action start and reject insufficient energy', () => {
  for (const [slot, cost] of [['B', ENERGY_PER_BAR], ['C', MAX_ENERGY]]) {
    const state = begin();
    const [fighter] = state.fighters;
    fighter.energy = cost - 1;
    const denied = step(state, [input([slot]), NEUTRAL], config);
    assert.deepEqual(denied.map(event => [event.kind, event.amount]), [['energy-short', cost]]);
    assert.equal(fighter.attack, null);
    assert.equal(fighter.energy, cost - 1);
    fighter.energy = cost;
    step(state, [NEUTRAL, NEUTRAL], config);
    assert.equal(fighter.attack, null);
    const released = step(state, [input([slot]), NEUTRAL], config);
    assert.deepEqual(released.map(event => event.kind), ['swing']);
    assert.equal(fighter.attack.id, 'test-' + slot.toLowerCase());
    assert.equal(fighter.energy, 0);
    stepFor(state, 44);
    assert.equal(fighter.energy, 0);
  }
});

test('the three untouched fighters keep their shared basic move and empty skill slots', () => {
  assert.equal(roster.length, 4);
  const kit = roster[0].fighter;
  assert.deepEqual(kit.actions.map(move => move.slot), ['A']);
  for (const { fighter } of roster.filter(entry => entry.fighter.id !== 'gaga')) {
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

const gaga = roster.find(entry => entry.fighter.id === 'gaga').fighter;
const gagaConfig = { ...config, fighters: [gaga, roster[0].fighter] };

test('Gaga winds up, hits once, freezes on contact, and fully recovers from a single J', () => {
  const state = begin(gagaConfig);
  closeDistance(state);
  const neutral = [NEUTRAL, NEUTRAL];
  const attacker = state.fighters[0];
  assert.deepEqual(step(state, [input(['A']), NEUTRAL], gagaConfig), []);
  assert.equal(attacker.attack.id, gagaActionIds.jab);
  assert.equal(attacker.attack.frame, 0);
  assert.deepEqual(stepFor(state, 4, neutral, gagaConfig), []);
  assert.deepEqual(step(state, neutral, gagaConfig).map(event => event.kind), ['swing', 'hit']);
  assert.equal(state.fighters[1].hp, 964);
  assert.equal(state.freeze, 2);
  assert.deepEqual(stepFor(state, 2, neutral, gagaConfig), []);
  assert.equal(attacker.attack.frame, 5);
  assert.deepEqual(stepFor(state, 15, neutral, gagaConfig), []);
  assert.equal(attacker.attack.frame, 20);
  step(state, neutral, gagaConfig);
  assert.equal(attacker.attack, null);
});

function playGaga(state, presses, target = NEUTRAL) {
  const stages = [];
  const events = [];
  const hitFrames = [];
  const hitResponses = [];
  for (let frame = 0; frame < 150; frame++) {
    const tickEvents = step(state, [input(presses[frame] ?? []), target], gagaConfig);
    events.push(...tickEvents);
    const hit = tickEvents.find(event => event.kind === 'hit');
    if (hit) {
      hitFrames.push(frame);
      const defender = state.fighters[1];
      hitResponses.push({ actionId: hit.actionId, cue: gagaContact(hit, gagaConfig.fighters),
        grounded: Boolean(defender.ground), vy: defender.vy });
    }
    const id = state.fighters[0].attack?.id;
    if (id && id !== stages.at(-1)) stages.push(id);
  }
  return { stages, events, hitFrames, hitResponses };
}

test('Gaga lands five distinct ground attacks from buffered or rhythmic J presses', () => {
  for (const presses of [
    { 0: ['A'], 2: ['A'], 5: ['A'], 7: ['A'], 9: ['A'] },
    { 0: ['A', 'A', 'A', 'A', 'A'] },
    { 0: ['A'], 11: ['A'], 22: ['A'], 33: ['A'], 44: ['A'] },
    { 0: ['A'], 16: ['A'], 32: ['A'], 48: ['A'], 64: ['A'] }
  ]) {
    const state = begin(gagaConfig);
    const [attacker, defender] = state.fighters;
    [attacker.x, defender.x] = [650, 779];
    const { stages, events, hitFrames, hitResponses } = playGaga(state, presses);
    assert.deepEqual(stages, gagaGroundCombo.map(move => move.id));
    const hits = events.filter(event => event.kind === 'hit');
    assert.deepEqual(hits.map(event => event.amount), [36, 37, 42, 33, 77]);
    assert.deepEqual(hits.map(event => event.impact), ['light', 'light', 'medium', 'light', 'heavy']);
    assert.equal(hitFrames[0], 5);
    if (presses[0].length === 5) assert.deepEqual(hitFrames, [5, 18, 37, 59, 83]);
    assert.deepEqual(hitResponses, [
      { actionId: gagaActionIds.jab, cue: 'light', grounded: true, vy: 0 },
      { actionId: gagaActionIds.backhand, cue: 'light', grounded: true, vy: 0 },
      { actionId: gagaActionIds.poleSweep, cue: 'pole', grounded: true, vy: 0 },
      { actionId: gagaActionIds.poleBacksweep, cue: 'pole', grounded: true, vy: 0 },
      { actionId: gagaActionIds.poleLaunch, cue: 'lift', grounded: false, vy: -16 }
    ]);
    assert.equal(defender.hp, 775);
    assert.equal(attacker.energy, 60);
    assert.equal(defender.energy, 90);
    assert.equal(defender.ground, 'floor');
    assert.equal(attacker.attack, null);
  }
});

test('Gaga can play the five-stage sequence on guard and on whiff', () => {
  for (const blocked of [true, false]) {
    const state = begin(gagaConfig);
    if (blocked) closeDistance(state);
    else [state.fighters[0].x, state.fighters[1].x] = [650, 1150];
    const target = blocked ? input([], 0, 1) : NEUTRAL;
    const { stages, events } = playGaga(state, { 0: ['A'], 5: ['A'], 8: ['A'], 13: ['A'], 19: ['A'] }, target);
    assert.deepEqual(stages, gagaGroundCombo.map(move => move.id));
    assert.equal(events.filter(event => event.kind === (blocked ? 'block' : 'whiff')).length, 5);
    assert.deepEqual(events.map(poleSwingFor).filter(Boolean), ['sweep', 'reverse', 'launch']);
    assert.ok(events.filter(poleSwingFor).every(event => event.source === 0 && event.facing === 1));
    assert.equal(state.fighters[0].attack, null);
    assert.equal(state.fighters[1].hp, 1000);
  }
});

test('Gaga starts over after the recovery window and drops queued stages when interrupted', () => {
  const state = begin(gagaConfig);
  const neutral = [NEUTRAL, NEUTRAL];
  step(state, [input(['A']), NEUTRAL], gagaConfig);
  stepFor(state, 40, neutral, gagaConfig);
  step(state, [input(['A']), NEUTRAL], gagaConfig);
  assert.equal(state.fighters[0].attack.id, gagaActionIds.jab);

  const interrupted = begin(gagaConfig);
  closeDistance(interrupted);
  const [attacker] = interrupted.fighters;
  step(interrupted, [NEUTRAL, input(['A'])], gagaConfig);
  stepFor(interrupted, 4, neutral, gagaConfig);
  step(interrupted, [input(['A', 'A', 'A', 'A', 'A']), NEUTRAL], gagaConfig);
  assert.equal(attacker.attack.queuedChain.length, 4);
  step(interrupted, neutral, gagaConfig);
  assert.equal(attacker.attack, null);
  assert.ok(attacker.hitstun > 0);
  stepFor(interrupted, 40, neutral, gagaConfig);
  assert.equal(attacker.attack, null);
});

test('Gaga up + J rushes forward before launching, with no damage during the rush', () => {
  const state = begin(gagaConfig);
  const [attacker, defender] = state.fighters;
  [attacker.x, defender.x] = [650, 985];
  // The direction is the one sampled at the attack press, even if released before the tick.
  const upAttack = { ...input(['A']), sampled: [{ x: 0, y: -1 }] };
  step(state, [upAttack, NEUTRAL], gagaConfig);
  assert.equal(attacker.attack.id, gagaActionIds.lift);
  const neutral = [NEUTRAL, NEUTRAL];
  assert.deepEqual(stepFor(state, 11, neutral, gagaConfig), []);
  assert.equal(attacker.x, 890);
  assert.equal(defender.hp, 1000);
  assert.equal(defender.ground, 'floor');
  assert.deepEqual(stepFor(state, 4, neutral, gagaConfig), []);
  assert.equal(attacker.x, 890);
  const events = step(state, neutral, gagaConfig);
  assert.ok(events.some(event => event.kind === 'hit' && event.amount === 95));
  assert.equal(defender.ground, null);
  assert.equal(defender.vy, -14);
});

test('Gaga down + J exits guard and slides 784 units in either facing direction', () => {
  for (const direction of [-1, 1]) {
    const state = begin(gagaConfig);
    const [attacker, defender] = state.fighters;
    [attacker.x, defender.x] = [1900, 1900 + 1100 * direction];
    step(state, [NEUTRAL, NEUTRAL], gagaConfig);
    step(state, [input([], 0, 1), NEUTRAL], gagaConfig);
    assert.ok(attacker.guarding);
    step(state, [input(['A'], 0, 1), NEUTRAL], gagaConfig);
    assert.equal(attacker.attack.id, gagaActionIds.slide);
    assert.equal(attacker.guarding, false);
    stepFor(state, 38, [NEUTRAL, NEUTRAL], gagaConfig);
    assert.equal(attacker.x, 1900 + 784 * direction);
    assert.equal(defender.hp, 1000);
  }
});

test('Gaga can hit a distant target once during the long slide and stays inside the arena', () => {
  const state = begin(gagaConfig);
  const [attacker, defender] = state.fighters;
  defender.x = gagaConfig.arena.right;
  attacker.x = defender.x - 420;
  step(state, [input(['A'], 0, 1), NEUTRAL], gagaConfig);
  const hits = stepFor(state, 65, [NEUTRAL, NEUTRAL], gagaConfig).filter(event => event.kind === 'hit');
  assert.deepEqual(hits.map(event => event.amount), [130]);
  assert.equal(defender.x, gagaConfig.arena.right);
  assert.ok(attacker.x < defender.x);
});

test('Gaga directional inputs do not queue extra stages of the neutral J combo', () => {
  const state = begin(gagaConfig);
  const [attacker] = state.fighters;
  step(state, [input(['A']), NEUTRAL], gagaConfig);
  const mixedPresses = { ...input(['A', 'A']), sampled: [{ x: 0, y: -1 }, { x: 0, y: 0 }] };
  step(state, [mixedPresses, NEUTRAL], gagaConfig);
  assert.deepEqual(attacker.attack.queuedChain, [gagaActionIds.backhand]);
  step(state, [input(['A'], 0, 1), NEUTRAL], gagaConfig);
  assert.deepEqual(attacker.attack.queuedChain, [gagaActionIds.backhand]);
  stepFor(state, 10, [NEUTRAL, NEUTRAL], gagaConfig);
  assert.equal(attacker.attack.id, gagaActionIds.backhand);
  assert.equal(attacker.attack.queuedChain, undefined);
});

test('Gaga leaves U empty and selects the pole throw for air J', () => {
  const state = begin(gagaConfig);
  closeDistance(state);
  step(state, [input(['B']), NEUTRAL], gagaConfig);
  assert.equal(state.fighters[0].attack, null);
  assert.deepEqual(stepFor(state, 20, [NEUTRAL, NEUTRAL], gagaConfig), []);
  step(state, [input(['jump']), NEUTRAL], gagaConfig);
  step(state, [input(['A'], 0, -1), NEUTRAL], gagaConfig);
  assert.equal(state.fighters[0].attack.id, gagaActionIds.airThrow);
});

function castToLanding(state, settings) {
  const events = step(state, [input(['C']), NEUTRAL], settings);
  for (let frame = 0; frame < 67; frame++) {
    const tick = step(state, [NEUTRAL, NEUTRAL], settings);
    events.push(...tick);
    if (tick.some(event => event.kind === 'turret-land')) break;
  }
  return events;
}

test('Gaga spends one bar and the box rises, falls, hits only once and builds on landing', () => {
  const settings = { ...gagaConfig, training: true, arena: { ...gagaConfig.arena, platforms: [] } };
  const state = begin(settings);
  const [attacker, defender] = state.fighters;
  [attacker.x, defender.x] = [650, 890];
  const denied = step(state, [input(['C']), NEUTRAL], settings);
  assert.equal(denied[0].kind, 'energy-short');
  assert.equal(denied[0].amount, ENERGY_PER_BAR);
  attacker.energy = ENERGY_PER_BAR;
  step(state, [input(['C']), NEUTRAL], settings);
  assert.equal(attacker.energy, 0);
  assert.equal(attacker.attack.id, gagaActionIds.turret);
  stepFor(state, 15, [NEUTRAL, NEUTRAL], settings);
  assert.equal(state.projectiles.length, 0);
  step(state, [NEUTRAL, NEUTRAL], settings);
  const [box] = state.projectiles;
  const releaseHeight = box.y;
  assert.ok(box.vx > 0 && box.vy < 0);
  stepFor(state, 5, [NEUTRAL, NEUTRAL], settings);
  assert.ok(box.y < releaseHeight);
  const events = stepFor(state, 36, [NEUTRAL, NEUTRAL], settings);
  const hits = events.filter(event => event.kind === 'hit');
  assert.deepEqual(hits.map(event => [event.actionId, event.amount]), [[gagaActionIds.turret, 55]]);
  const land = events.filter(event => event.kind === 'turret-land');
  assert.equal(land.length, 1);
  assert.equal(land[0].y, settings.arena.floor);
  assert.equal(state.turrets.bolt.x, land[0].x);
  assert.equal(state.turrets.bolt.hp, 2);
  assert.equal(state.projectiles.length, 0);
});

test('a landed box replaces the old tower, builds in 20 ticks and fires a fixed shot every two seconds', () => {
  const settings = { ...gagaConfig, training: true, arena: { ...gagaConfig.arena, platforms: [] } };
  const state = begin(settings);
  const [attacker, defender] = state.fighters;
  [attacker.x, defender.x] = [650, 1350];
  attacker.energy = 2 * ENERGY_PER_BAR;
  const first = castToLanding(state, settings);
  assert.equal(first.filter(event => event.kind === 'turret-land').length, 1);
  const old = state.turrets.bolt;
  stepFor(state, 17, [NEUTRAL, NEUTRAL], settings);
  attacker.x += 90;
  const second = castToLanding(state, settings);
  assert.deepEqual(second.filter(event => event.kind === 'turret-burst' || event.kind === 'turret-land').map(event => event.kind),
    ['turret-burst', 'turret-land']);
  assert.equal(second.find(event => event.kind === 'turret-burst').x, old.x);
  assert.ok(state.turrets.bolt.x > old.x);
  assert.equal(state.turrets.bolt.age, 0);
  assert.ok(!stepFor(state, 19, [NEUTRAL, NEUTRAL], settings).some(event => event.kind === 'turret-ready'));
  assert.equal(step(state, [NEUTRAL, NEUTRAL], settings)[0].kind, 'turret-ready');
  assert.ok(!stepFor(state, 119, [NEUTRAL, NEUTRAL], settings).some(event => event.kind === 'turret-fire'));
  const fired = step(state, [NEUTRAL, NEUTRAL], settings);
  assert.equal(fired[0].kind, 'turret-fire');
  const [bolt] = state.projectiles;
  const velocity = [bolt.vx, bolt.vy];
  defender.x += 70;
  defender.y -= 90;
  step(state, [NEUTRAL, NEUTRAL], settings);
  assert.deepEqual([bolt.vx, bolt.vy], velocity);
  state.turrets.bolt.age = 30 * rules.ticksPerSecond - 1;
  assert.ok(step(state, [NEUTRAL, NEUTRAL], settings).some(event => event.kind === 'turret-burst'));
  assert.equal(state.turrets.bolt, null);
});

test('two distinct enemy attacks destroy a turret, with no duplicate hits on active frames', () => {
  const state = begin(gagaConfig);
  const [owner, enemy] = state.fighters;
  [owner.x, enemy.x] = [650, 900];
  state.turrets.bolt = { kind: 'bolt', owner: 0, x: 840, y: gagaConfig.arena.floor, facing: 1, age: 20, hp: 2 };
  step(state, [NEUTRAL, input(['A'])], gagaConfig);
  stepFor(state, 24, [NEUTRAL, NEUTRAL], gagaConfig);
  assert.equal(state.turrets.bolt.hp, 1);
  step(state, [NEUTRAL, input(['A'])], gagaConfig);
  const events = stepFor(state, 12, [NEUTRAL, NEUTRAL], gagaConfig);
  assert.equal(events.filter(event => event.kind === 'turret-burst').length, 1);
  assert.equal(state.turrets.bolt, null);
});

test('air I drops through all platforms and replaces only the global howitzer', () => {
  const { arena } = gagaConfig;
  const platforms = [397, 261, 130].map((rise, i) => ({
    id: 'tier-' + i, name: '台面', tier: 3 - i, left: 720, right: 1250, y: arena.floor - rise
  }));
  const settings = { ...gagaConfig, training: true, arena: { ...arena, platforms } };
  const state = begin(settings);
  const [owner, enemy] = state.fighters;
  Object.assign(owner, { x: 650, y: arena.floor - 470, ground: null, vy: 0, energy: ENERGY_PER_BAR });
  enemy.x = 1450;
  const bolt = { kind: 'bolt', owner: 0, x: 200, y: arena.floor, facing: 1, age: 30, hp: 2 };
  state.turrets.bolt = bolt;
  state.turrets.howitzer = { kind: 'howitzer', owner: 1, x: 300, y: arena.floor, facing: 1, age: 30, hp: 2 };
  const events = castToLanding(state, settings);
  assert.equal(owner.energy, 0);
  assert.ok(events.some(event => event.kind === 'swing' && event.actionId === gagaActionIds.howitzer));
  assert.deepEqual(events.filter(event => ['turret-burst','turret-land'].includes(event.kind)).map(event =>
    [event.kind, event.turretKind, event.source, event.y]), [
    ['turret-burst', 'howitzer', 1, arena.floor], ['turret-land', 'howitzer', 0, arena.floor]
  ]);
  assert.equal(state.turrets.bolt, bolt);
  assert.equal(state.turrets.howitzer.owner, 0);
});

test('both deployed turret types deal one shockwave hit and push away from the center', () => {
  for (const [kind, side] of [['bolt', 1], ['howitzer', -1]]) {
    const state = begin(gagaConfig);
    const [owner, enemy] = state.fighters;
    [owner.x, enemy.x] = [590, 900 + 85 * side];
    state.turrets[kind] = { kind, owner: 0, x: 900, y: gagaConfig.arena.floor, facing: 1, age: 18, hp: 2 };
    assert.deepEqual(step(state, [NEUTRAL, NEUTRAL], gagaConfig), []);
    const contacts = step(state, [NEUTRAL, NEUTRAL], gagaConfig);
    assert.deepEqual(contacts.map(event => event.kind), ['turret-ready', 'hit']);
    assert.equal(contacts[1].amount, 45);
    assert.equal(enemy.push, 18 * side);
    assert.equal(owner.hp, 1000);
    assert.ok(!stepFor(state, 30, [NEUTRAL, NEUTRAL], gagaConfig).some(event => event.kind === 'hit'));
  }
});

test('cannon shells arc, explode on impact and lose damage at range, and both turret shots charge ki on hits', () => {
  const settings = { ...gagaConfig, arena: { ...gagaConfig.arena, platforms: [] } };
  function fire(kind, offset, targetX = 970) {
    const state = begin(settings);
    const [owner, enemy] = state.fighters;
    [owner.x, enemy.x] = [510, targetX];
    state.turrets[kind] = { kind, owner: 0, x: 710, y: settings.arena.floor, facing: 1, age: 139, hp: 2 };
    assert.equal(step(state, [NEUTRAL, NEUTRAL], settings)[0].kind, 'turret-fire');
    if (kind === 'howitzer') {
      const shell = state.projectiles[0];
      assert.ok(shell.vy < 0);
      const arcStart = shell.y;
      stepFor(state, 5, [NEUTRAL, NEUTRAL], settings);
      assert.ok(shell.y < arcStart);
      enemy.x += offset;
    }
    const events = stepFor(state, 70, [NEUTRAL, NEUTRAL], settings);
    const hits = events.filter(event => event.kind === 'hit');
    const explosions = events.filter(event => event.kind === 'grenade-impact');
    assert.equal(explosions.length, kind === 'howitzer' ? 1 : 0);
    assert.equal(owner.energy, hits.length ? 12 : 0);
    assert.ok(hits.length <= 1);
    return hits[0]?.amount ?? 0;
  }
  assert.equal(fire('bolt', 0), 32);
  assert.equal(fire('howitzer', 0), 90);
  assert.ok(fire('howitzer', 104) < 90 && fire('howitzer', 104) > 0);
  assert.equal(fire('howitzer', 250), 0);
  assert.equal(fire('howitzer', 0, 1610), 0);
});

test('Gaga throws downward in either facing direction, hits once and then impacts the floor', () => {
  const settings = { ...gagaConfig, arena: { ...gagaConfig.arena, platforms: [] } };
  for (const facing of [-1, 1]) {
    for (const guarding of [false, true]) {
      const state = begin(settings);
      const [attacker, defender] = state.fighters;
      [attacker.x, defender.x] = facing === 1 ? [650, 900] : [900, 650];
      const target = guarding ? input([], 0, 1) : NEUTRAL;
      step(state, [input(['jump']), target], settings);
      step(state, [input(['A']), target], settings);
      assert.deepEqual(stepFor(state, 7, [NEUTRAL, target], settings), []);
      assert.equal(state.projectiles.length, 0);
      step(state, [NEUTRAL, target], settings);
      const [pole] = state.projectiles;
      assert.equal(Math.sign(pole.vx), facing);
      assert.ok(pole.vy > 0);
      const events = stepFor(state, 45, [NEUTRAL, target], settings);
      assert.deepEqual(events.filter(event => event.actionId === gagaActionIds.airThrow).map(event => event.kind),
        [guarding ? 'block' : 'hit', 'pole-impact']);
      const impact = events.find(event => event.kind === 'pole-impact');
      assert.equal(impact.y, settings.arena.floor);
      assert.equal(impact.facing, facing);
      assert.equal(defender.hp, guarding ? 1000 : 890);
      assert.deepEqual(state.projectiles, []);
    }
  }
});

test('a descending pole passes through platforms and impacts the bottom floor only', () => {
  const { arena } = gagaConfig;
  const upper = { id: 'upper', name: '上层', tier: 2, left: 760, right: 950, y: arena.floor - 100 };
  const top = { id: 'top', name: '最高层', tier: 3, left: 740, right: 940, y: arena.floor - 132 };
  const lower = { id: 'lower', name: '下层', tier: 1, left: 740, right: 940, y: arena.floor - 42 };
  const settings = { ...gagaConfig, arena: { ...arena, platforms: [lower, top, upper] } };
  const state = begin(settings);
  [state.fighters[0].x, state.fighters[1].x] = [650, 915];
  step(state, [input(['jump']), NEUTRAL], settings);
  step(state, [input(['A']), NEUTRAL], settings);
  const events = stepFor(state, 45, [NEUTRAL, NEUTRAL], settings);
  const impacts = events.filter(event => event.kind === 'pole-impact');
  assert.equal(impacts.length, 1);
  assert.equal(impacts[0].y, arena.floor);
  assert.deepEqual(impacts[0].surface, { left: arena.left, right: arena.right });
  assert.equal(state.fighters[1].hp, 890);
  assert.deepEqual(state.projectiles, []);
});

test('Gaga switches between forward and backstep according to facing and actual distance', () => {
  for (const facing of [-1, 1]) {
    const state = begin(gagaConfig);
    const [attacker, defender] = state.fighters;
    [attacker.x, defender.x] = [900, 900 + facing * 320];
    stepFor(state, 4, [input([], facing), NEUTRAL], gagaConfig);
    assert.equal(attacker.facing, facing);
    assert.deepEqual(attacker.walk, { direction: 'forward', distance: gaga.run * 4 });
    stepFor(state, 3, [input([], -facing), NEUTRAL], gagaConfig);
    assert.equal(attacker.facing, facing);
    assert.deepEqual(attacker.walk, { direction: 'back', distance: gaga.run * 3 });
    step(state, [NEUTRAL, NEUTRAL], gagaConfig);
    assert.equal(attacker.walk, undefined);
  }
});

test('Gaga does not walk against the wall, during a jump, or while sliding', () => {
  const state = begin(gagaConfig);
  const [attacker] = state.fighters;
  attacker.x = gagaConfig.arena.left;
  step(state, [input([], -1), NEUTRAL], gagaConfig);
  assert.equal(attacker.walk, undefined);
  step(state, [input(['A'], 1, 1), NEUTRAL], gagaConfig);
  stepFor(state, 15, [input([], 1), NEUTRAL], gagaConfig);
  assert.ok(attacker.x > gagaConfig.arena.left);
  assert.equal(attacker.walk, undefined);
  stepFor(state, 60, [NEUTRAL, NEUTRAL], gagaConfig);
  step(state, [input(['jump'], 1), NEUTRAL], gagaConfig);
  assert.equal(attacker.ground, null);
  assert.equal(attacker.walk, undefined);
});

test('Gaga grounds the support foot and blends direction changes without a snap', () => {
  const walk = new GagaWalk();
  const first = walk.sample({ direction: 'forward', distance: 16 }, 4);
  const next = walk.sample({ direction: 'forward', distance: 40 }, 1);
  assert.equal(16 + first.lead.x, 40 + next.lead.x);
  assert.equal(next.lead.y, 0);
  assert.ok(next.rear.y < 0);
  assert.deepEqual(walk.sample({ direction: 'back', distance: 8 }, 0), next);
  const retreat = walk.sample({ direction: 'back', distance: 16 }, 4);
  const later = walk.sample({ direction: 'back', distance: 32 }, 1);
  assert.equal(-16 + retreat.rear.x, -32 + later.rear.x);
  assert.equal(later.rear.y, 0);
  assert.deepEqual(walk.sample(undefined, 0), later);
  assert.equal(walk.sample(undefined, 4), undefined);
});

test('Gaga contact sound and sparks use the resolved move and separate guard from a hit', () => {
  for (const [direction, cue] of [[-1, 'lift'], [1, 'slide'], [0, 'light']]) {
    for (const blocking of [false, true]) {
      const state = begin(gagaConfig);
      closeDistance(state);
      const target = blocking ? input([], 0, 1) : NEUTRAL;
      step(state, [input(['A'], 0, direction), target], gagaConfig);
      const events = stepFor(state, 20, [NEUTRAL, target], gagaConfig);
      const contact = events.find(event => event.kind === (blocking ? 'block' : 'hit'));
      assert.equal(gagaContact(contact, gagaConfig.fighters), blocking ? 'guard' : cue);
      assert.equal(contact.facing, 1);
      if (blocking) assert.equal(state.fighters[1].reaction, undefined);
    }
  }
});

test('Gaga holds the first hurt pose during freeze and switches from airborne to landing', () => {
  const settings = { ...gagaConfig, fighters: [gaga, gaga] };
  for (const [direction, kind] of [[0, 'light'], [1, 'heavy'], [-1, 'air']]) {
    const state = begin(settings);
    closeDistance(state);
    const target = state.fighters[1];
    const neutral = [NEUTRAL, NEUTRAL];
    step(state, [input(['A'], 0, direction), NEUTRAL], settings);
    while (!target.reaction && state.frame < 145) step(state, neutral, settings);
    assert.deepEqual(target.reaction, { kind, elapsed: 0, facing: -1 });
    stepFor(state, state.freeze, neutral, settings);
    assert.equal(target.reaction.elapsed, 0);
    step(state, neutral, settings);
    assert.equal(target.reaction.elapsed, 1);
    if (kind === 'air') {
      while (!target.ground && state.frame < 200) step(state, neutral, settings);
      assert.equal(target.reaction.landedAt, target.reaction.elapsed);
      stepFor(state, 4, neutral, settings);
      assert.ok(target.reaction);
    }
    stepFor(state, 30, neutral, settings);
    assert.equal(target.reaction, undefined);
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
    assert.ok(floor.y - path[3].y >= 390, 'the upper route needs usable vertical separation from the floor');
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
  for (const arena of arenas) {
    const settings = trainingOn(arena);
    const state = begin(settings);
    const [a, b] = state.fighters;
    assert.ok(arena.right - arena.left >= 1280 * 2.8);
    assert.equal(b.x - a.x, 346);
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
  for (const arena of arenas) {
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
    [arenas[0], 'planter', 'west', 1],
    [arenas[0], 'greenhouse', 'east', -1],
    [arenas[1], 'west-bench', 'west-stand', 1],
    [arenas[1], 'east-bench', 'east-stand', -1],
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

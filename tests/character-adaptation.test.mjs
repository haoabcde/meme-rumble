import { platformAt } from '../dist/core/terrain.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import { createMatch, step } from '../dist/core/match.js';
import { ENERGY_PER_STOCK, MAX_ENERGY, NEUTRAL, TEAR_UNITS_PER_POINT } from '../dist/core/types.js';
import { rules, testFighter } from '../dist/content/demo.js';
import { arenas } from '../dist/content/arenas.js';
import { gagaActionIds, gagaGroundCombo } from '../dist/content/fighters/gaga.js';
import { bananaActionIds, bananaComboNames } from '../dist/content/fighters/banana.js';
import { roster } from '../dist/content/roster.js';
import { dijiangBurialTip, frameDijiangImpact, frameDijiangLength } from '../dist/web/camera.js';
import { aimSummon, dijiangPitch, dijiangTip, summonFallFrames } from '../dist/core/summon.js';
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

const banana = roster.find(entry => entry.fighter.id === 'banana').fighter;
const bananaActions = banana.actions;
const bananaConfig = { ...config, arena: { ...config.arena, platforms: [] }, fighters: [banana, banana] };
const bananaMove = id => bananaActions.find(action => action.id === id);
const bananaNeutral = [NEUTRAL, NEUTRAL];
function bananaStep(state, count, frames = bananaNeutral, settings = bananaConfig) {
  return stepFor(state, count, frames, settings);
}
const tears = fighter => fighter.tearUnits / TEAR_UNITS_PER_POINT;
const setTears = (fighter, points) => { fighter.tearUnits = points * TEAR_UNITS_PER_POINT; };
const hold = (key, pressed = [], x = 0, y = 0) => ({ ...input(pressed, x, y), held: [key] });

test('Banana equips pressure, uppercut, recharge and the wave with four ground combo stages', () => {
  assert.equal(new Set(bananaActions.map(move => move.id)).size, 11);
  assert.equal(bananaComboNames.length, 4);
  assert.deepEqual(bananaActions.filter(move => move.slot === 'B').map(move => move.tearCost), [20, 35]);
  assert.deepEqual(bananaActions.filter(move => move.slot === 'C').map(move => move.id),
    [bananaActionIds.recharge]);
  assert.equal(bananaMove(bananaActionIds.wave).slot, 'ULT');
  assert.equal(bananaMove(bananaActionIds.wave).energyCost, MAX_ENERGY);
});

test('Banana four-hit buffered combo is mirrored for either player and earns four hit rewards', () => {
  for (const source of [0, 1]) {
    const state = begin(bananaConfig);
    closeDistance(state);
    const frames = [NEUTRAL, NEUTRAL];
    frames[source] = input(['A', 'A', 'A', 'A']);
    const events = [...step(state, frames, bananaConfig), ...bananaStep(state, 150)];
    assert.deepEqual(events.filter(e => e.kind === 'hit').map(e => e.actionId),
      [bananaActionIds.jab, bananaActionIds.backhand, bananaActionIds.headbutt, bananaActionIds.cry]);
    assert.equal(state.fighters[1 - source].hp, 819);
    assert.equal(tears(state.fighters[source]), 92);
    assert.equal(tears(state.fighters[1 - source]), 80);
    assert.equal(state.fighters[source].attack, null);
  }
});

test('Banana blocked combo and whiff recover without restoring tears', () => {
  for (const guard of [false, true]) {
    const state = begin(bananaConfig);
    if (guard) closeDistance(state);
    else state.fighters[1].x = 3000;
    const target = guard ? input([], 0, 1) : NEUTRAL;
    step(state, [input(['A', 'A', 'A', 'A']), target], bananaConfig);
    const events = bananaStep(state, 140, [NEUTRAL, target]);
    assert.equal(events.filter(e => e.kind === (guard ? 'block' : 'whiff')).length, 4);
    assert.equal(state.fighters[1].hp, 1000);
    assert.deepEqual(state.fighters.map(tears), [60, 60]);
  }
});

test('Banana directional normals and air normal select distinct actions', () => {
  for (const [keys, y, air, expected] of [
    [['A'], -1, false, bananaActionIds.lift], [['A'], 1, false, bananaActionIds.slide],
    [['A'], 0, true, bananaActionIds.tear]
  ]) {
    const state = begin(bananaConfig), fighter = state.fighters[0];
    if (air) Object.assign(fighter, { ground: null, y: fighter.y - 150 });
    step(state, [input(keys, 0, y), NEUTRAL], bananaConfig);
    assert.equal(fighter.attack.id, expected);
  }
  const state = begin(bananaConfig);
  state.fighters[1].x = 3500;
  const start = state.fighters[0].x;
  step(state, [input(['A'], 0, 1), NEUTRAL], bananaConfig);
  bananaStep(state, 45);
  assert.equal(state.fighters[0].x - start, 336);
});

test('Banana starts each round with 60 tears; holding I gains 20 per second and caps at 100', () => {
  const state = begin(bananaConfig);
  const [f] = state.fighters;
  assert.deepEqual(state.fighters.map(tears), [60, 60]);
  step(state, [hold('C', ['C']), NEUTRAL], bananaConfig);
  bananaStep(state, 59, [hold('C'), NEUTRAL]);
  assert.equal(tears(f), 80);
  bananaStep(state, 90, [hold('C'), NEUTRAL]);
  assert.equal(tears(f), 100);
  bananaStep(state, 10);
  assert.equal(f.attack, null);
  state.remaining = 1;
  bananaStep(state, 106);
  assert.equal(state.round, 2);
  assert.deepEqual(state.fighters.map(tears), [60, 60]);
});

test('Banana short U uses 20 tears once, mirrors hits, slows movement, and consumes no more on release', () => {
  for (const source of [0, 1]) {
    const state = begin(bananaConfig);
    const f = state.fighters[source], target = state.fighters[1 - source];
    f.x = 1800 + 300 * source;
    target.x = f.x + 165 * f.facing;
    const frames = [NEUTRAL, NEUTRAL];
    frames[source] = { ...input(['B']), held: [] };
    step(state, frames, bananaConfig);
    const hits = bananaStep(state, 15).filter(event => event.kind === 'hit');
    assert.equal(hits.length, 1);
    assert.equal(hits[0].facing, f.facing);
    assert.equal(tears(f), 40);
    assert.equal(f.energy, 12);
    assert.equal(tears(target), 65);
    assert.equal(target.energy, 18);
    assert.ok(target.slow > 0);
    const x = target.x;
    const walking = [NEUTRAL, NEUTRAL];
    walking[1 - source] = input([], f.facing);
    bananaStep(state, 1, walking);
    assert.ok(Math.abs(Math.abs(target.x - x) - banana.run * .55) < 1e-9);
    bananaStep(state, 30);
    assert.equal(f.attack, null);
    assert.equal(tears(f), 40);
  }
});

test('Banana water jets hit within their doubled reach and miss beyond the new range', () => {
  for (const source of [0, 1]) {
    for (const [distance, hit] of [[400, true], [490, false]]) {
      const state = begin(bananaConfig);
      const f = state.fighters[source], target = state.fighters[1 - source];
      f.x = 1800 + 300 * source;
      target.x = f.x + distance * f.facing;
      const frames = [NEUTRAL, NEUTRAL];
      frames[source] = input(['B']);
      step(state, frames, bananaConfig);
      const events = bananaStep(state, 15);
      assert.equal(events.some(event => event.kind === 'hit' && event.actionId === bananaActionIds.pressure), hit);
    }
  }
  for (const [height, hit] of [[410, true], [515, false]]) {
    const platform = { id: 'high-jet-test', left: 1660, right: 2100, y: bananaConfig.arena.floor - height,
      tier: 3, name: 'test' };
    const settings = { ...bananaConfig, arena: { ...bananaConfig.arena, platforms: [platform] } };
    const state = begin(settings), [f, target] = state.fighters;
    f.x = 1800;
    Object.assign(target, { x: 1850, y: platform.y, ground: platform.id });
    step(state, [input(['B'], 0, -1), NEUTRAL], settings);
    const events = bananaStep(state, 15, bananaNeutral, settings);
    assert.equal(events.some(event => event.kind === 'hit' && event.actionId === bananaActionIds.uppercut), hit);
  }
});

test('Banana earns energy for each damaging U pulse, with no award on block or whiff', () => {
  for (const mode of ['hit', 'block', 'whiff']) {
    const state = begin(bananaConfig), [f, target] = state.fighters;
    f.x = 1780;
    target.x = f.x + (mode === 'whiff' ? 840 : 187);
    const defenderInput = mode === 'block' ? input([], 0, 1) : NEUTRAL;
    step(state, [hold('B', ['B']), defenderInput], bananaConfig);
    const events = bananaStep(state, mode === 'block' ? 14 : 76, [hold('B'), defenderInput]);
    const hits = events.filter(event => event.kind === 'hit' && event.actionId === bananaActionIds.pressure);
    if (mode === 'hit') assert.ok(hits.length >= 3);
    else assert.equal(hits.length, 0);
    if (mode === 'block') assert.ok(events.some(event => event.kind === 'block'));
    assert.equal(f.energy, hits.length * 12);
    assert.ok(tears(f) <= 40);
  }
});

test('Banana sustained U drains 10 per second, moves at reduced speed, and drops dash inputs while spraying', () => {
  const state = begin(bananaConfig), [f] = state.fighters;
  const spray = bananaMove(bananaActionIds.pressure);
  step(state, [hold('B', ['B']), NEUTRAL], bananaConfig);
  bananaStep(state, spray.startup + spray.active - 1, [hold('B'), NEUTRAL]);
  const start = f.x;
  const events = bananaStep(state, 60, [hold('B', ['dash'], 1), NEUTRAL]);
  assert.equal(tears(f), 30);
  assert.equal(f.attack.sustainedFrames, 60);
  assert.ok(Math.abs(f.x - start - banana.run * .45 * 60) < 1e-8);
  assert.equal(events.some(event => event.kind === 'dash'), false);
  step(state, bananaNeutral, bananaConfig);
  assert.equal(f.attack.frame, spray.startup + spray.active);
  bananaStep(state, spray.recovery);
  assert.equal(f.attack, null);
  assert.equal(f.dash, 0);
});

test('Holding U through depletion forces recovery and does not automatically recast', () => {
  const state = begin(bananaConfig), [f] = state.fighters;
  const spray = bananaMove(bananaActionIds.pressure);
  setTears(f, 21);
  step(state, [hold('B', ['B']), NEUTRAL], bananaConfig);
  bananaStep(state, spray.startup + spray.active + 4, [hold('B'), NEUTRAL]);
  assert.ok(tears(f) > 0);
  bananaStep(state, 1, [hold('B'), NEUTRAL]);
  assert.equal(tears(f), 0);
  assert.equal(f.attack.frame, spray.startup + spray.active);
  bananaStep(state, spray.recovery + 60, [hold('B'), NEUTRAL]);
  assert.equal(f.attack, null);
  assert.equal(tears(f), 0);
});

test('A buffered up + U spends 35 tears, hits above, and refuses to fall back when short', () => {
  for (const value of [34, 35]) {
    const state = begin(bananaConfig), [f, target] = state.fighters;
    setTears(f, value);
    Object.assign(target, { x: f.x + 60, ground: null, y: target.y - 155, vy: 0 });
    const combo = { ...input(['B']), sampled: [{ x: 0, y: -1 }] };
    const events = step(state, [combo, NEUTRAL], bananaConfig);
    if (value === 34) {
      assert.equal(f.attack, null);
      assert.equal(tears(f), 34);
      assert.equal(events.find(event => event.kind === 'tears-short')?.amount, 35);
    } else {
      assert.equal(f.attack.id, bananaActionIds.uppercut);
      assert.equal(tears(f), 0);
      assert.equal(bananaStep(state, 10).filter(event => event.kind === 'hit').length, 1);
      assert.equal(f.energy, 12);
      assert.ok(target.vy < 0);
    }
  }
});

test('An air water ball that misses the opponent passes platforms and explodes on the first-floor surface', () => {
  const platform = { id: 'above', left: 1600, right: 2400, y: bananaConfig.arena.floor - 140, tier: 1, name: 'test' };
  const settings = { ...bananaConfig, arena: { ...bananaConfig.arena, platforms: [platform] } };
  const state = begin(settings), [f, target] = state.fighters;
  Object.assign(f, { x: 1740, y: platform.y - 45, ground: null, vy: -4 });
  target.x = 2200;
  step(state, [input(['A']), NEUTRAL], settings);
  assert.equal(f.attack.id, bananaActionIds.tear);
  assert.equal(tears(f), 50);
  let sawBelowPlatform = false;
  const events = [];
  for (let i = 0; i < 40; i++) {
    if (state.projectiles.some(projectile => projectile.y > platform.y)) sawBelowPlatform = true;
    events.push(...step(state, bananaNeutral, settings));
  }
  const impact = events.find(event => event.kind === 'tear-splash');
  assert.ok(sawBelowPlatform);
  assert.equal(impact?.y, settings.arena.floor);
  assert.ok(impact.x - f.x > 350);
  assert.equal(events.filter(event => event.kind === 'hit').length, 1);
  assert.ok(events.indexOf(impact) < events.findIndex(event => event.kind === 'hit'));
  assert.deepEqual(state.fighters.map(tears), [58, 65]);
  assert.deepEqual(state.projectiles, []);
});

test('A direct air water ball detonates before reaching the floor and applies damage and tear rewards once', () => {
  const state = begin(bananaConfig), [f, target] = state.fighters;
  Object.assign(f, { x: 1740, y: bananaConfig.arena.floor - 185, ground: null, vy: -4 });
  target.x = 2040;
  step(state, [input(['A']), NEUTRAL], bananaConfig);
  const events = bananaStep(state, 75);
  const explosions = events.filter(event => event.kind === 'tear-splash');
  assert.equal(explosions.length, 1);
  assert.ok(explosions[0].y < bananaConfig.arena.floor);
  assert.equal(explosions[0].surface, undefined);
  assert.deepEqual(events.filter(event => event.kind === 'hit').map(event => event.amount), [72]);
  assert.deepEqual(state.fighters.map(tears), [58, 65]);
  assert.equal(target.hp, banana.maxHp - 72);
  assert.deepEqual(state.projectiles, []);
});

test('Air normal and U report their own costs when tears are insufficient', () => {
  for (const [key, air, cost] of [['A', true, 10], ['B', false, 20]]) {
    const state = begin(bananaConfig), [f] = state.fighters;
    setTears(f, cost - 1);
    if (air) Object.assign(f, { ground: null, y: f.y - 80 });
    const events = step(state, [input([key]), NEUTRAL], bananaConfig);
    assert.equal(events.find(event => event.kind === 'tears-short')?.amount, cost);
    assert.equal(f.attack, null);
    assert.equal(tears(f), cost - 1);
  }
});

test('Banana gains tears and energy together and an underfunded ultimate does not start crying', () => {
  const state = begin(bananaConfig), [f, target] = state.fighters;
  closeDistance(state);
  step(state, [input(['A']), NEUTRAL], bananaConfig);
  bananaStep(state, 38);
  assert.deepEqual([f.energy, target.energy], [12, 18]);
  assert.deepEqual([tears(f), tears(target)], [68, 65]);
  f.energy = MAX_ENERGY - 1;
  const events = step(state, [input(['ULT']), NEUTRAL], bananaConfig);
  assert.equal(events.find(event => event.kind === 'ultimate-no-energy')?.amount, MAX_ENERGY);
  bananaStep(state, 10, [hold('C'), NEUTRAL]);
  assert.equal(f.attack, null);
  assert.equal(f.energy, MAX_ENERGY - 1);
  assert.equal(tears(f), 68);
  assert.equal(state.cutIn, undefined);
});

test('Banana winds up on stage, pauses for a cut-in and sends one damaging wave in either direction', () => {
  for (const source of [0, 1]) {
    const state = begin(bananaConfig), f = state.fighters[source], target = state.fighters[1 - source];
    f.x = 1800 + 600 * source;
    target.x = f.x + f.facing * 760;
    f.energy = MAX_ENERGY;
    const commands = [NEUTRAL, NEUTRAL];
    commands[source] = input(['ULT']);
    const remaining = state.remaining;
    assert.equal(step(state, commands, bananaConfig)[0]?.kind, 'wave-windup');
    assert.equal(f.energy, 0);
    assert.equal(tears(f), 60);
    const wave = bananaMove(bananaActionIds.wave);
    assert.equal(state.cutIn, undefined);
    assert.equal(state.projectiles.length, 0);
    bananaStep(state, wave.cutIn.at - 1);
    assert.equal(state.cutIn, undefined);
    assert.equal(bananaStep(state, 1)[0]?.kind, 'wave-cut-in');
    assert.equal(state.cutIn?.source, source);
    assert.equal(state.cutIn?.frame, 0);
    const duration = state.cutIn.duration;
    const targetX = target.x;
    const move = [input([], 1), input([], -1)];
    assert.deepEqual(bananaStep(state, duration, move), []);
    assert.equal(state.cutIn, undefined);
    assert.equal(state.remaining, remaining - wave.cutIn.at);
    assert.equal(target.x, targetX);
    bananaStep(state, wave.startup - wave.cutIn.at - 1);
    assert.equal(state.projectiles.length, 0);
    bananaStep(state, 1);
    assert.equal(state.projectiles[0]?.actionId, wave.id);
    assert.equal(Math.sign(state.projectiles[0].vx), f.facing);
    const hits = bananaStep(state, 70).filter(event => event.kind === 'hit' && event.actionId === wave.id);
    assert.equal(hits.length, 1);
    assert.equal(hits[0].amount, 240);
    assert.equal(target.hp, banana.maxHp - 240);
    assert.equal(state.projectiles.length, 0);
  }
});

test('a heavy wave knocks either fighter down, locks the pose direction, and allows movement after rising', () => {
  for (const targetDefinition of [banana, gaga]) {
    const settings = { ...bananaConfig, fighters: [banana, targetDefinition] };
    const state = begin(settings);
    const [caster, target] = state.fighters;
    caster.energy = MAX_ENERGY;
    step(state, [input(['ULT']), NEUTRAL], settings);
    const phases = [];
    const events = [];
    for (let frame = 0; frame < 180; frame++) {
      events.push(...step(state, [NEUTRAL, NEUTRAL], settings));
      const phase = target.recovery?.phase ?? null;
      if (phases.at(-1) !== phase) phases.push(phase);
      if (phase) {
        assert.equal(target.recovery.facing, -1);
        assert.equal(Boolean(target.ground), phase !== 'fall');
      }
    }
    assert.deepEqual(phases, [null, 'fall', 'down', 'rise', null]);
    const landing = events.filter(event => event.kind === 'knockdown');
    assert.equal(landing.length, 1);
    assert.equal(landing[0].source, 1);
    assert.equal(landing[0].y, settings.arena.floor);
    assert.equal(events.filter(event => event.kind === 'rise').length, 1);
    const x = target.x;
    step(state, [NEUTRAL, input([], 1)], settings);
    assert.ok(target.x > x);
  }
});

test('a lethal launch finishes its landing during round-over without starting to rise', () => {
  const settings = { ...bananaConfig, fighters: [banana, gaga] };
  const state = begin(settings);
  const [caster, target] = state.fighters;
  caster.energy = MAX_ENERGY;
  target.hp = 1;
  step(state, [input(['ULT']), NEUTRAL], settings);
  for (let tick = 0; state.phase === 'fight' && tick < 150; tick++) step(state, [NEUTRAL, NEUTRAL], settings);
  assert.equal(state.phase, 'round-over');
  assert.equal(target.recovery.phase, 'fall');
  const events = stepFor(state, 80, [NEUTRAL, NEUTRAL], settings);
  assert.equal(target.recovery.phase, 'down');
  assert.equal(target.y, settings.arena.floor);
  assert.deepEqual(events.map(event => event.kind), ['knockdown']);
});

test('The initial wave windup can be interrupted before the cut-in', () => {
  const state = begin(bananaConfig), [f] = state.fighters;
  closeDistance(state);
  f.energy = MAX_ENERGY;
  step(state, [input(['ULT']), NEUTRAL], bananaConfig);
  step(state, [NEUTRAL, input(['A'])], bananaConfig);
  const events = bananaStep(state, 95);
  assert.equal(events.some(event => event.kind === 'hit' && event.source === 1), true);
  assert.equal(events.some(event => event.kind === 'wave-cut-in'), false);
  assert.equal(state.cutIn, undefined);
  assert.equal(state.projectiles.length, 0);
});

test('Banana can go directly from crying into the wave and gets a ground requirement in the air', () => {
  const state = begin(bananaConfig), [f] = state.fighters;
  f.energy = MAX_ENERGY;
  step(state, [hold('C', ['C']), NEUTRAL], bananaConfig);
  assert.equal(f.attack.id, bananaActionIds.recharge);
  const events = step(state, [input(['ULT']), NEUTRAL], bananaConfig);
  assert.equal(events[0]?.kind, 'wave-windup');
  assert.equal(f.energy, 0);

  const air = begin(bananaConfig), [airFighter] = air.fighters;
  airFighter.energy = MAX_ENERGY;
  step(air, [input(['jump']), NEUTRAL], bananaConfig);
  const refused = step(air, [input(['ULT']), NEUTRAL], bananaConfig);
  assert.equal(refused.find(event => event.kind === 'wave-unavailable')?.requirement, 'ground');
  assert.equal(air.cutIn, undefined);
  assert.equal(airFighter.energy, MAX_ENERGY);
});

test('A foe can interrupt crying and holding I through the hit does not restart it', () => {
  const state = begin(bananaConfig), [f] = state.fighters;
  closeDistance(state);
  step(state, [hold('C', ['C']), input(['A'])], bananaConfig);
  bananaStep(state, 10, [hold('C'), NEUTRAL]);
  const afterHit = tears(f);
  assert.equal(afterHit, 65 + 5 / 3);
  assert.equal(f.attack, null);
  bananaStep(state, 60, [hold('C'), NEUTRAL]);
  assert.equal(tears(f), afterHit);
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
    assert.equal(defender.energy, 50);
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
  stepFor(interrupted, 3, neutral, gagaConfig);
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

test('a downward direction keeps C on its own skill even with three full stocks', () => {
  for (const [definition, skill, cost] of [
    [banana, bananaActionIds.recharge, 0],
    [gaga, gagaActionIds.turret, ENERGY_PER_STOCK]
  ]) {
    for (const source of [0, 1]) {
      const settings = { ...config, fighters: [definition, definition] };
      const state = begin(settings);
      const fighter = state.fighters[source];
      fighter.energy = MAX_ENERGY;
      const commands = [NEUTRAL, NEUTRAL];
      commands[source] = input(['C'], 0, 1);
      const events = step(state, commands, settings);

      assert.equal(fighter.attack?.id, skill);
      assert.equal(fighter.energy, MAX_ENERGY - cost);
      assert.ok(events.every(event => event.kind !== 'ultimate'));
      assert.equal(state.cutIn, undefined);
      assert.equal(state.summon, undefined);
    }
  }
});

const summonInput = input(['ULT']);

test('ULT requires three bars and ground, without falling back to the C turrets', () => {
  const state = begin(gagaConfig);
  const [caster] = state.fighters;
  caster.energy = MAX_ENERGY - 1;
  assert.deepEqual(step(state, [summonInput, NEUTRAL], gagaConfig).map(event => [event.kind, event.amount]),
    [['ultimate-no-energy', MAX_ENERGY]]);
  assert.equal(caster.attack, null);
  assert.equal(caster.energy, MAX_ENERGY - 1);
  caster.energy = MAX_ENERGY;
  step(state, [input(['jump']), NEUTRAL], gagaConfig);
  assert.equal(caster.ground, null);
  step(state, [summonInput, NEUTRAL], gagaConfig);
  assert.equal(caster.attack, null);
  assert.equal(caster.energy, MAX_ENERGY);
  step(state, [input(['C']), NEUTRAL], gagaConfig);
  assert.equal(caster.attack.id, gagaActionIds.howitzer);
});

test('Dijiang freezes the whole match and hits through guard once after a 0.6-second dive', () => {
  const state = begin(gagaConfig);
  const [caster, opponent] = state.fighters;
  caster.energy = MAX_ENERGY;
  state.turrets.bolt = { kind: 'bolt', owner: 0, age: 31, x: caster.x, y: caster.y, hp: 2, facing: 1 };
  state.projectiles.push({ actionId: gagaActionIds.turretBolt, source: 0, facing: 1,
    x: gagaConfig.arena.left, y: caster.y - 100, vx: 5, vy: 0, connected: false });
  assert.equal(step(state, [summonInput, NEUTRAL], gagaConfig)[0].kind, 'summon-start');
  assert.equal(caster.energy, 0);
  const frozen = structuredClone({ fighters: state.fighters, turrets: state.turrets,
    projectiles: state.projectiles, timer: state.remaining, frame: state.frame });
  const holdGuard = input([], 0, 1);
  const cinematic = stepFor(state, 47, [summonInput, holdGuard], gagaConfig);
  assert.deepEqual(cinematic.map(event => event.kind), ['summon-confirm']);
  assert.equal(state.summon.phase, 'cut-in');
  assert.deepEqual({ fighters: state.fighters, turrets: state.turrets, projectiles: state.projectiles,
    timer: state.remaining, frame: state.frame }, frozen);
  assert.equal(step(state, [NEUTRAL, holdGuard], gagaConfig)[0].kind, 'summon-drop');
  assert.equal(summonFallFrames / rules.ticksPerSecond, .6);
  stepFor(state, summonFallFrames - 1, [NEUTRAL, holdGuard], gagaConfig);
  assert.equal(opponent.hp, 1000);
  const impact = step(state, [NEUTRAL, holdGuard], gagaConfig);
  assert.deepEqual(impact.map(event => event.kind), ['summon-impact', 'hit']);
  assert.equal(impact[1].amount, 320);
  assert.equal(opponent.guard, 100);
  assert.equal(opponent.vy, -16);
  assert.equal(caster.attack.id, gagaActionIds.dijiang);
  const after = stepFor(state, 29, [NEUTRAL, NEUTRAL], gagaConfig);
  assert.ok(!after.some(event => event.kind === 'summon-impact'));
  assert.equal(caster.attack, null);
  assert.equal(state.summon, undefined);
});

test('Dijiang still hits the floor after interruption when an elevated opponent dashes out of the dive', () => {
  const state = begin(gagaConfig);
  const [caster, target] = state.fighters;
  const platform = gagaConfig.arena.platforms.find(surface => surface.id === 'west');
  caster.energy = MAX_ENERGY;
  target.x = platform.left + 100;
  target.y = platform.y - 5;
  target.ground = null;
  target.vy = 6;
  target.dash = 8;
  target.facing = 1;
  const x = target.x;
  step(state, [summonInput, NEUTRAL], gagaConfig);
  const landing = state.summon.x;
  assert.equal(state.summon.y, gagaConfig.arena.floor);
  stepFor(state, 48, [NEUTRAL, NEUTRAL], gagaConfig);
  caster.attack = null;
  caster.hitstun = 10;
  const events = stepFor(state, summonFallFrames, [NEUTRAL, NEUTRAL], gagaConfig);
  assert.ok(events.some(event => event.kind === 'summon-impact' && event.x === landing && event.y === gagaConfig.arena.floor));
  assert.ok(!events.some(event => event.kind === 'summon-catch'));
  assert.equal(target.hp, 1000);
  assert.ok(target.x - x > 138);
});

test('Dijiang catches fighters on fixed and moving upper platforms in the dive and slams them to the floor once', () => {
  for (const arena of arenas) {
    const settings = { ...gagaConfig, arena };
    for (const raw of arena.platforms.filter(p => p.tier >= 2 || p.travel)) {
      const platform = platformAt(raw, 0);
      const state = begin(settings);
      const [caster, target] = state.fighters;
      caster.energy = MAX_ENERGY;
      target.x = (platform.left + platform.right) / 2;
      target.y = platform.y;
      target.ground = platform.id;
      step(state, [summonInput, NEUTRAL], settings);
      const { x: landing } = state.summon;
      assert.equal(state.summon.y, arena.floor);
      stepFor(state, 48, undefined, settings);
      const events = [];
      let carriedTicks = 0;
      let lastY = target.y;
      for (let frame = 0; frame < summonFallFrames; frame++) {
        const defend = state.summon.carry ? input(['jump', 'A'], -1) : input([], 0, 1);
        events.push(...step(state, [NEUTRAL, defend], settings));
        if (state.summon.phase === 'fall' && state.summon.carry) {
          carriedTicks++;
          assert.ok((carriedTicks === 1 || target.y >= lastY) && target.y < arena.floor);
          assert.equal(target.ground, null);
          assert.equal(target.attack, null);
          assert.equal(target.hp, 1000);
        }
        lastY = target.y;
      }
      assert.ok(carriedTicks > 1, `${arena.id} ${platform.id}`);
      assert.deepEqual(events.map(event => event.kind), ['summon-catch', 'summon-impact', 'hit', 'knockdown']);
      assert.equal(target.recovery.phase, 'down');
      assert.equal(events[1].y, arena.floor);
      assert.equal(events[2].amount, 320);
      assert.deepEqual([target.x, target.y, target.vy, target.ground], [landing, arena.floor, 0, 'floor']);
      stepFor(state, 25, undefined, settings);
      assert.equal(target.ground, 'floor');
      assert.equal(target.hp, 680);
    }
  }
});

test('Dijiang can approach a target at the edge while locking a landing inside the arena', () => {
  const { arena } = gagaConfig;
  const target = begin(gagaConfig).fighters[1];
  target.x = arena.right;
  target.y = arena.floor - 300;
  target.ground = null;
  const aim = aimSummon(arena, target, 1);
  assert.equal(aim.facing, -1);
  assert.ok(aim.x < target.x && aim.x >= arena.left);
  assert.equal(aim.y, arena.floor);
});

test('the oversized dive mirrors diagonally and aligns the ship nose with the impact', () => {
  const viewport = { width: 1280, height: 720 };
  const camera = { x: 800, y: 400, zoom: 1.1 };
  const target = { x: 1360, y: 920 };
  const length = frameDijiangLength(viewport, camera);
  const projectedWidth = length * Math.cos(dijiangPitch) * camera.zoom;
  assert.ok(Math.abs(projectedWidth / viewport.width - 1.36 * Math.cos(dijiangPitch)) < .001);
  const rightDive = { ...target, rise: 700, facing: 1 };
  const leftDive = { ...rightDive, facing: -1 };
  const right = dijiangTip(rightDive, 0);
  const left = dijiangTip(leftDive, 0);
  assert.ok(right.x < target.x && left.x > target.x && right.y === left.y && right.y < target.y);
  assert.ok(right.y < camera.y);
  assert.equal((left.x + right.x) / 2, target.x);
  assert.ok(dijiangTip(rightDive, .75).y > dijiangTip(rightDive, .25).y);
  assert.deepEqual(dijiangTip(rightDive, 1), target);
  assert.deepEqual(dijiangTip(leftDive, 1), target);
});

test('Dijiang continues along its dive axis until the hull is under the landing surface', () => {
  const target = { x: 1360, y: 920 };
  const length = frameDijiangLength({ width: 1280, height: 720 }, { x: 800, y: 400, zoom: 1.1 });
  for (const facing of [-1, 1]) {
    assert.deepEqual(dijiangBurialTip(length, target, facing, 0), dijiangTip({ ...target, rise: 700, facing }, 1));
    const entry = dijiangBurialTip(length, target, facing, .25);
    const buried = dijiangBurialTip(length, target, facing, 1);
    assert.ok(entry.y > target.y);
    assert.ok(buried.y - target.y > length * Math.sin(dijiangPitch));
    assert.ok(Math.abs((buried.x - target.x) * facing * Math.tan(dijiangPitch) - (buried.y - target.y)) < .001);
  }
});

test('the Dijiang impact camera recoils inside the arena and returns to the fight view', () => {
  const viewport = { width: 1280, height: 720 };
  const arena = { width: 2300, height: 1060 };
  const camera = { x: 1020, y: 340, zoom: 1 };
  const target = { x: 2250, y: 996 };
  const strike = frameDijiangImpact(arena, viewport, camera, target, 0);
  assert.ok(strike.zoom > camera.zoom && strike.y > camera.y);
  for (let age = 0; age < 25; age++) {
    const { x, y, zoom } = frameDijiangImpact(arena, viewport, camera, target, age);
    assert.ok(x >= 0 && x + viewport.width / zoom <= arena.width + .001);
    assert.ok(y >= 0 && y + viewport.height / zoom <= arena.height + .001);
  }
  assert.deepEqual(frameDijiangImpact(arena, viewport, camera, target, 25), camera);
});

test('simultaneous Dijiang confirms alternate by round and round end clears it', () => {
  const settings = { ...gagaConfig, fighters: [gaga, gaga] };
  for (const round of [1, 2]) {
    const state = begin(settings);
    state.round = round;
    for (const fighter of state.fighters) fighter.energy = MAX_ENERGY;
    step(state, [summonInput, summonInput], settings);
    assert.equal(state.summon.source, round - 1);
    assert.equal(state.fighters[2 - round].energy, MAX_ENERGY);
    stepFor(state, 48, [NEUTRAL, NEUTRAL], settings);
    state.remaining = 1;
    step(state, [NEUTRAL, NEUTRAL], settings);
    assert.equal(state.phase, 'round-over');
    assert.equal(state.summon, undefined);
  }
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
  assert.equal(denied[0].kind, 'ultimate-no-energy');
  assert.equal(denied[0].amount, ENERGY_PER_STOCK);
  attacker.energy = ENERGY_PER_STOCK;
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
  attacker.energy = 2 * ENERGY_PER_STOCK;
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
  Object.assign(owner, { x: 650, y: arena.floor - 470, ground: null, vy: 0, energy: ENERGY_PER_STOCK });
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

test('Banana impact effects receive light, heavy and launch cues, and only launch landings carry the air cue', () => {
  const settings = { ...gagaConfig, fighters: [gaga, banana] };
  const neutral = [NEUTRAL, NEUTRAL];
  for (const [direction, kind] of [[0, 'light'], [1, 'heavy'], [-1, 'air']]) {
    const state = begin(settings);
    closeDistance(state);
    step(state, [input(['A'], 0, direction), NEUTRAL], settings);
    const events = stepFor(state, 72, neutral, settings);
    assert.equal(events.find(event => event.kind === 'hit')?.reaction, kind);
    if (kind === 'air') {
      assert.ok(events.some(event => event.kind === 'land' && event.source === 1 && event.reaction === 'air'));
    }
  }

  const jump = begin(settings);
  step(jump, [NEUTRAL, input(['jump'])], settings);
  const land = stepFor(jump, 54, neutral, settings).find(event => event.kind === 'land');
  assert.ok(land);
  assert.equal(land.reaction, undefined);
});


test('Gaga’s turret crate lands on either moving deck and the built turret rides it', () => {
  for (const arena of arenas.filter(item => item.platforms.some(p => p.travel))) {
    const settings = { ...gagaConfig, arena, training: true };
    const lift = arena.platforms.find(p => p.travel);
    const state = begin(settings);
    state.arenaFrame = 85;
    const deck = platformAt(lift, state.arenaFrame);
    const crate = gaga.actions.find(action => action.id === gagaActionIds.turret);
    state.projectiles.push({
      source: 0, actionId: crate.id, facing: 1, x: (deck.left + deck.right) / 2,
      y: deck.y - crate.projectile.radius - 1, vx: 0, vy: 7, connected: false
    });
    const landing = step(state, [NEUTRAL, NEUTRAL], settings).find(event => event.kind === 'turret-land');
    const turret = state.turrets.bolt;
    assert.equal(turret.support, lift.id);
    assert.equal(landing.y, platformAt(lift, state.arenaFrame).y);
    const offset = turret.x - platformAt(lift, state.arenaFrame).left;
    stepFor(state, 180, [NEUTRAL, NEUTRAL], settings);
    const moved = platformAt(lift, state.arenaFrame);
    assert.equal(turret.x - moved.left, offset);
    assert.equal(turret.y, moved.y);
    assert.ok(turret.age > 20);
  }
});

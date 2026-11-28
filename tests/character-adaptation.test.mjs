import { platformAt } from '../dist/core/terrain.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import { createMatch, step } from '../dist/core/match.js';
import { DEFAULT_KNOCKDOWN_FRAMES, DEFAULT_RISE_FRAMES, ENERGY_PER_STOCK, MAX_ENERGY, NEUTRAL, TEAR_UNITS_PER_POINT } from '../dist/core/types.js';
import { rules, testFighter } from '../dist/content/demo.js';
import { arenas } from '../dist/content/arenas.js';
import { gagaActionIds, gagaGroundCombo } from '../dist/content/fighters/gaga.js';
import { bananaActionIds, bananaAdditionalActionIds, bananaComboNames } from '../dist/content/fighters/banana.js';
import { LEGACY_BANANA_SKILLS } from '../dist/content/fighters/legacy-skills.js';
import { roster } from '../dist/content/roster.js';
import { defineFighter } from '../dist/content/fighter-kit.js';
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

test('Banana equips pressure, uppercut, recharge, JO awakening, Killer Queen I, air dive J, JO up/down/U skills, wave/burst skills and The World ULT, and 5-hit JO combo', () => {
  assert.equal(new Set(bananaActions.map(move => move.id)).size, bananaActions.length);
  assert.equal(bananaComboNames.length, 4);
  assert.deepEqual(bananaActions.filter(move => move.slot === 'B').map(move => move.tearCost), [16, 16, 10, 0, 35, 0, 25]);
  assert.deepEqual(bananaActions.filter(move => move.slot === 'C').map(move => move.id),
    [bananaActionIds.recharge, bananaActionIds.kqBomb, bananaActionIds.kqDetonate, bananaActionIds.wave]);
  assert.equal(bananaMove(bananaActionIds.joAirDive).slot, 'A');
  assert.equal(bananaMove(bananaActionIds.joLift).slot, 'A');
  assert.equal(bananaMove(bananaActionIds.joSlide).slot, 'A');
  assert.equal(bananaMove(bananaActionIds.joSheerHeart).slot, 'B');
  assert.equal(bananaMove(bananaActionIds.joAntiAir).slot, 'B');
  assert.equal(bananaMove(bananaActionIds.joAwaken).slot, 'ULT');
  assert.equal(bananaMove(bananaActionIds.joAwaken).energyCost, MAX_ENERGY);
  assert.equal(bananaMove(bananaAdditionalActionIds.burst).slot, 'B');
  assert.equal(bananaMove(bananaActionIds.wave).tearCost, 30);
  assert.equal(bananaMove(bananaActionIds.wave).slot, 'C');
  assert.equal(bananaMove(bananaActionIds.theWorld).energyCost, 2 * ENERGY_PER_STOCK);
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
    assert.equal(state.fighters[1 - source].hp, 812);
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
    [['A'], 0, true, bananaAdditionalActionIds.airClaw], [['B'], 0, true, bananaActionIds.tear],
    [['B'], 1, true, bananaAdditionalActionIds.airPressure]
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
  assert.equal(state.fighters[0].x - start, 96);
});

test('Banana 3A headbutt pounces forward over 200 units on whiff', () => {
  const state = begin(bananaConfig);
  state.fighters[1].x = 3500;
  const start = state.fighters[0].x;
  step(state, [input(['A', 'A', 'A']), NEUTRAL], bananaConfig);
  bananaStep(state, 90);
  assert.equal(state.fighters[0].x - start, 26 + 28 + 222);
});

test('Banana holding I charges tears quickly, limits energy gain (~18/s), and resets between rounds', () => {
  const state = begin(bananaConfig);
  const [f] = state.fighters;
  assert.equal(f.energy, 0);
  step(state, [hold('C', ['C']), NEUTRAL], bananaConfig);
  bananaStep(state, 59, [hold('C'), NEUTRAL]);
  assert.equal(f.energy, 18);
  assert.equal(tears(f), 84);
  bananaStep(state, 100, [hold('C'), NEUTRAL]);
  assert.equal(f.energy, 48);
  assert.equal(tears(f), 100);
  bananaStep(state, 10);
  assert.equal(f.attack, null);
  state.remaining = 1;
  bananaStep(state, 106);
  assert.equal(state.round, 2);
  assert.equal(state.fighters[0].energy, 0);
  assert.equal(state.fighters[0].joAwakened, undefined);
});

test('Banana short U uses 16 tears once, mirrors hits, slows movement, and consumes no more on release', () => {
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
    assert.equal(tears(f), 44);
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
    assert.equal(tears(f), 44);
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
    assert.ok(tears(f) <= 44);
  }
});

test('Banana sustained U drains 10 per second, moves at reduced speed, and drops dash inputs while spraying', () => {
  const state = begin(bananaConfig), [f] = state.fighters;
  const spray = bananaMove(bananaActionIds.pressure);
  step(state, [hold('B', ['B']), NEUTRAL], bananaConfig);
  bananaStep(state, spray.startup + spray.active - 1, [hold('B'), NEUTRAL]);
  const start = f.x;
  const events = bananaStep(state, 60, [hold('B', ['dash'], 1), NEUTRAL]);
  assert.equal(tears(f), 34);
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
  setTears(f, 17);
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
  step(state, [input(['B']), NEUTRAL], settings);
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
  step(state, [input(['B']), NEUTRAL], bananaConfig);
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

test('ground and air U report their own costs, and air J works at zero tears', () => {
  for (const [air, cost] of [[true, 10], [false, 16]]) {
    const state = begin(bananaConfig), [f] = state.fighters;
    setTears(f, cost - 1);
    if (air) Object.assign(f, { ground: null, y: f.y - 80 });
    const events = step(state, [input(['B']), NEUTRAL], bananaConfig);
    assert.equal(events.find(event => event.kind === 'tears-short')?.amount, cost);
    assert.equal(f.attack, null);
    assert.equal(tears(f), cost - 1);
  }
  const state = begin(bananaConfig), [fighter] = state.fighters;
  Object.assign(fighter, { ground: null, y: fighter.y - 80 });
  setTears(fighter, 0);
  step(state, [input(['A']), NEUTRAL], bananaConfig);
  assert.equal(fighter.attack.id, bananaAdditionalActionIds.airClaw);
  assert.equal(tears(fighter), 0);
});

test('Banana gains tears and energy together and an underfunded ultimate does not start crying', () => {
  const state = begin(bananaConfig), [f, target] = state.fighters;
  closeDistance(state);
  step(state, [input(['A']), NEUTRAL], bananaConfig);
  bananaStep(state, 38);
  assert.deepEqual([f.energy, target.energy], [12, 18]);
  assert.deepEqual([tears(f), tears(target)], [68, 65]);
  f.energy = MAX_ENERGY - 1;
  const preEvents = step(state, [input(['ULT']), NEUTRAL], bananaConfig);
  assert.equal(preEvents.some(event => event.kind === 'wave-windup'), false);
  assert.equal(f.attack, null);
  f.joAwakened = true;
  f.energy = 2 * ENERGY_PER_STOCK - 1;
  const events = step(state, [input(['ULT']), NEUTRAL], bananaConfig);
  assert.equal(events.find(event => event.kind === 'ultimate-no-energy')?.amount, 2 * ENERGY_PER_STOCK);
  bananaStep(state, 10, [hold('C'), NEUTRAL]);
  assert.equal(f.attack, null);
  assert.equal(f.energy, 2 * ENERGY_PER_STOCK - 1);
  assert.equal(tears(f), 68);
  assert.equal(state.cutIn, undefined);
});

test('Banana triggers JO awakening ONLY with O (ULT) at 3 bars, NOT J or I, and unlocks 5A JO combo', () => {
  const guardState = begin(bananaConfig);
  guardState.fighters[0].energy = MAX_ENERGY;
  closeDistance(guardState);
  step(guardState, [input(['A']), NEUTRAL], bananaConfig);
  assert.equal(guardState.fighters[0].attack?.id, bananaActionIds.jab);
  assert.equal(guardState.fighters[0].joAwakened, undefined);

  const cryState = begin(bananaConfig);
  cryState.fighters[0].energy = MAX_ENERGY;
  step(cryState, [input(['C']), NEUTRAL], bananaConfig);
  assert.equal(cryState.fighters[0].attack?.id, bananaActionIds.recharge);
  assert.equal(cryState.fighters[0].joAwakened, undefined);
  assert.equal(cryState.cutIn, undefined);

  for (const source of [0, 1]) {
    const state = begin(bananaConfig), f = state.fighters[source], target = state.fighters[1 - source];
    closeDistance(state);
    f.energy = MAX_ENERGY;
    const commands = [NEUTRAL, NEUTRAL];
    commands[source] = input(['ULT']);
    const awaken = bananaMove(bananaActionIds.joAwaken);
    assert.equal(step(state, commands, bananaConfig)[0]?.kind, 'wave-windup');
    assert.equal(f.energy, 0);
    assert.equal(f.joAwakened, undefined);
    bananaStep(state, awaken.cutIn.at - 1);
    assert.equal(bananaStep(state, 1)[0]?.kind, 'wave-cut-in');
    assert.equal(f.joAwakened, true);
    assert.equal(state.cutIn?.source, source);
    const shatterEvents = bananaStep(state, state.cutIn.duration + 80);
    assert.equal(shatterEvents.some(e => e.kind === 'jo-shatter' && e.source === source), true);
    assert.equal(state.cutIn, undefined);
    assert.equal(f.attack, null);

    // Now test the 5-hit JO combo: 1A -> 2A -> 3A (pounce behind) -> 4A (uppercut) -> 5A (Ora barrage + finisher).
    closeDistance(state);
    const beforePounceFacing = f.facing;
    const comboCmd = [NEUTRAL, NEUTRAL];
    comboCmd[source] = input(['A', 'A', 'A', 'A', 'A']);
    const comboEvents = [...step(state, comboCmd, bananaConfig), ...bananaStep(state, 180)];
    const hitActions = comboEvents.filter(e => e.kind === 'hit').map(e => e.actionId);
    assert.ok(hitActions.includes(bananaActionIds.joJab));
    assert.ok(hitActions.includes(bananaActionIds.joCross));
    assert.ok(hitActions.includes(bananaActionIds.joPounce));
    assert.ok(hitActions.includes(bananaActionIds.joUppercut));
    assert.ok(hitActions.filter(id => id === bananaActionIds.joOra).length >= 5);
    const comboSwings = comboEvents.filter(e => e.kind === 'swing').map(e => e.actionId);
    assert.ok(comboSwings.includes(bananaActionIds.joJab));
    assert.ok(comboSwings.includes(bananaActionIds.joCross));
    assert.ok(comboSwings.includes(bananaActionIds.joPounce));
    assert.ok(comboSwings.includes(bananaActionIds.joUppercut));
    const oraSwings = comboEvents.filter(e => e.kind === 'swing' && e.actionId === bananaActionIds.joOra);
    assert.equal(oraSwings.length, 6);
    assert.equal(oraSwings.at(-1)?.heavy, true);
    assert.equal(comboEvents.some(e => e.kind === 'knockdown' && e.source === 1 - source), true);
    assert.ok(target.hp < 700);
    void beforePounceFacing;
  }
});

test('Banana JO 3A pounces past the opponent to their back and turns to face them', () => {
  const state = begin(bananaConfig);
  const [f, target] = state.fighters;
  f.joAwakened = true;
  closeDistance(state);
  const startTargetX = target.x;
  step(state, [input(['A', 'A', 'A']), NEUTRAL], bananaConfig);
  bananaStep(state, 60);
  assert.ok(f.x > startTargetX);
  assert.equal(f.facing, -1);
});

test('Banana JO 3A connects cleanly into 4A and 5A from close, mid, far, and corner spacing', () => {
  for (const [fX, tX] of [
    [1600, 1660],
    [1600, 1695],
    [1600, 1735],
    [bananaConfig.arena.right - 95, bananaConfig.arena.right - 20]
  ]) {
    const state = begin(bananaConfig);
    const [f, target] = state.fighters;
    f.joAwakened = true;
    f.x = fX;
    target.x = tX;
    const events = [...step(state, [input(['A', 'A', 'A', 'A', 'A']), NEUTRAL], bananaConfig), ...bananaStep(state, 180)];
    const hits = events.filter(e => e.kind === 'hit').map(e => e.actionId);
    assert.equal(hits.includes(bananaActionIds.joPounce), true, `Expected 3A hit at ${fX}->${tX}`);
    assert.equal(hits.includes(bananaActionIds.joUppercut), true, `Expected 4A hit after 3A at ${fX}->${tX}`);
    assert.equal(hits.includes(bananaActionIds.joOra), true, `Expected 5A hit after 4A at ${fX}->${tX}`);
  }
});

test('Banana JO 3A whiff does not chain into 4A or 5A', () => {
  const state = begin(bananaConfig);
  const [f, target] = state.fighters;
  f.joAwakened = true;
  target.x = f.x + 800;
  step(state, [input(['A', 'A', 'A', 'A', 'A']), NEUTRAL], bananaConfig);
  const events = bananaStep(state, 120);
  assert.equal(events.some(e => e.actionId === bananaActionIds.joUppercut), false);
  assert.equal(events.some(e => e.actionId === bananaActionIds.joOra), false);
});

test('a lethal JO Ora finisher knocks out the target during round-over', () => {
  const settings = { ...bananaConfig, fighters: [banana, gaga] };
  const state = begin(settings);
  const [caster, target] = state.fighters;
  caster.joAwakened = true;
  closeDistance(state);
  target.hp = 120;
  step(state, [input(['A', 'A', 'A', 'A', 'A']), NEUTRAL], settings);
  for (let tick = 0; state.phase === 'fight' && tick < 200; tick++) step(state, [NEUTRAL, NEUTRAL], settings);
  assert.equal(state.phase, 'round-over');
});

test('JO Banana I fires a Killer Queen air bomb orb that plants a mark and detonates on second I press', () => {
  const state = begin(bananaConfig);
  const [f, target] = state.fighters;
  f.joAwakened = true;
  target.x = f.x + 260;
  // First I launches Killer Queen air bomb orb.
  step(state, [input(['C']), NEUTRAL], bananaConfig);
  assert.equal(f.attack.id, bananaActionIds.kqBomb);
  const flyEvents = bananaStep(state, 45);
  assert.equal(flyEvents.some(e => e.kind === 'kq-plant'), true);
  assert.equal(target.bombMark?.source, 0);
  const hpAfterPlant = target.hp;
  assert.ok(hpAfterPlant < 1000);
  // Second I clicks the detonator switch and blows up the mark even from afar!
  f.x = target.x - 420;
  step(state, [input(['C']), NEUTRAL], bananaConfig);
  assert.equal(f.attack.id, bananaActionIds.kqDetonate);
  const detEvents = bananaStep(state, 20);
  assert.equal(detEvents.some(e => e.kind === 'kq-detonate'), true);
  assert.equal(detEvents.some(e => e.kind === 'hit' && e.actionId === bananaActionIds.kqDetonate), true);
  assert.equal(target.bombMark, undefined);
  assert.equal(target.hp, hpAfterPlant - 115);
});

test('JO Banana can detonate a flying Killer Queen orb mid-flight with a second I press', () => {
  const state = begin(bananaConfig);
  const [f, target] = state.fighters;
  f.joAwakened = true;
  target.x = f.x + 240;
  step(state, [input(['C']), NEUTRAL], bananaConfig);
  bananaStep(state, 16);
  assert.equal(state.projectiles.length, 1);
  // Move orb close enough or detonate mid-flight.
  state.projectiles[0].x = target.x - 40;
  step(state, [input(['C']), NEUTRAL], bananaConfig);
  const detEvents = bananaStep(state, 15);
  assert.equal(detEvents.some(e => e.kind === 'kq-detonate'), true);
  assert.equal(detEvents.some(e => e.kind === 'hit' && e.actionId === bananaActionIds.kqDetonate), true);
  assert.equal(state.projectiles.length, 0);
});

test('JO Banana aerial J dives at a crisp 45-degree diagonal with Star Platinum and hits on descent', () => {
  const state = begin(bananaConfig);
  const [f, target] = state.fighters;
  f.joAwakened = true;
  Object.assign(f, { ground: null, x: 1600, y: bananaConfig.arena.floor - 220, vy: -2 });
  target.x = 1780;
  step(state, [input(['A']), NEUTRAL], bananaConfig);
  assert.equal(f.attack.id, bananaActionIds.joAirDive);
  // Startup hover before dive begins
  bananaStep(state, 4);
  assert.equal(f.x, 1600);
  const diveY0 = f.y;
  // Active dive moves dx === dy (45 degrees!)
  bananaStep(state, 1);
  assert.equal(f.x - 1600, 16);
  assert.equal(f.y - diveY0, 16);
  const diveEvents = bananaStep(state, 35);
  assert.equal(diveEvents.some(e => e.kind === 'hit' && e.actionId === bananaActionIds.joAirDive), true);
  assert.equal(diveEvents.some(e => e.kind === 'land' && e.actionId === bananaActionIds.joAirDive), true);
  assert.ok(f.ground);
  assert.equal(f.attack, null);
});

test('JO Banana aerial J pierces tier-2/3 platforms all the way to floor 1 and drags struck foes down to floor 1', () => {
  const tierConfig = {
    ...bananaConfig,
    arena: {
      ...bananaConfig.arena,
      platforms: [
        { id: 'tier-3', name: '三层台', tier: 3, left: 1200, right: 2200, y: bananaConfig.arena.floor - 420, prop: 'office' },
        { id: 'tier-2', name: '二层台', tier: 2, left: 1200, right: 2200, y: bananaConfig.arena.floor - 220, prop: 'catwalk' }
      ]
    }
  };
  const state = begin(tierConfig);
  const [f, target] = state.fighters;
  f.joAwakened = true;
  Object.assign(f, { ground: null, x: 1620, y: tierConfig.arena.floor - 470, vy: 0 });
  Object.assign(target, { ground: 'tier-3', x: 1700, y: tierConfig.arena.floor - 420 });
  step(state, [input(['A']), NEUTRAL], tierConfig);
  assert.equal(f.attack.id, bananaActionIds.joAirDive);
  const events = stepFor(state, 55, bananaNeutral, tierConfig);
  assert.equal(events.some(e => e.kind === 'hit' && e.actionId === bananaActionIds.joAirDive), true);
  assert.equal(events.some(e => e.kind === 'land' && e.actionId === bananaActionIds.joAirDive), true);
  assert.equal(f.ground, 'floor');
  assert.equal(f.y, tierConfig.arena.floor);
  assert.equal(target.ground, 'floor');
  assert.equal(target.y, tierConfig.arena.floor);
  assert.ok(target.recovery);
});

test('JO Banana up+J rises into Star Platinum Shoryuken, down+J slides with Star Platinum, and dash emits JO trail', () => {
  const state = begin(bananaConfig);
  const [f, target] = state.fighters;
  f.joAwakened = true;
  closeDistance(state);
  step(state, [input(['A'], 0, -1), NEUTRAL], bananaConfig);
  assert.equal(f.attack.id, bananaActionIds.joLift);
  const upEvents = bananaStep(state, 20);
  assert.equal(f.ground, null);
  assert.ok(f.y < bananaConfig.arena.floor - 40);
  assert.equal(upEvents.some(e => e.kind === 'hit' && e.actionId === bananaActionIds.joLift), true);

  // Settle on floor and test JO down+J slide + JO dash event.
  bananaStep(state, 70);
  target.x = f.x + 140;
  const startX = f.x;
  step(state, [input(['A'], 0, 1), NEUTRAL], bananaConfig);
  assert.equal(f.attack.id, bananaActionIds.joSlide);
  const slideEvents = bananaStep(state, 22);
  assert.ok(f.x - startX >= 24);
  assert.equal(slideEvents.some(e => e.kind === 'hit' && e.actionId === bananaActionIds.joSlide), true);

  bananaStep(state, 30);
  const dashEvents = step(state, [input(['dash'], 1, 0), NEUTRAL], bananaConfig);
  assert.equal(dashEvents.some(e => e.kind === 'dash' && e.heavy === true), true);
});

test('JO Banana U patrols straight with no tracking out of range, accelerates on lock-on with kq-lock, blocks recast, and blasts after lock fuse', () => {
  const state = begin(bananaConfig);
  const [f, target] = state.fighters;
  f.joAwakened = true;
  setTears(f, 0);
  f.energy = 0;
  // Place enemy far ahead outside sensor range: tank patrols calmly in a straight line with no lock-on!
  target.x = f.x + 650;
  step(state, [input(['B']), NEUTRAL], bananaConfig);
  assert.equal(f.attack.id, bananaActionIds.joSheerHeart);
  bananaStep(state, 5);
  assert.equal(state.projectiles.length, 1);
  // Second U press while tank is active is blocked.
  bananaStep(state, 16);
  step(state, [input(['B']), NEUTRAL], bananaConfig);
  assert.equal(f.attack, null);
  assert.equal(state.projectiles.length, 1);

  const patrolStart = state.projectiles[0].x;
  const patrolFacing = state.projectiles[0].facing;
  const patrolEvents = bananaStep(state, 15);
  assert.equal(patrolEvents.some(e => e.kind === 'kq-lock'), false);
  assert.equal(state.projectiles[0].locked, undefined);
  assert.equal(state.projectiles[0].facing, patrolFacing);
  assert.ok((state.projectiles[0].x - patrolStart) * patrolFacing > 50);

  // Move target behind outside range -> tank STILL does NOT turn around while outside sensor range!
  target.x = state.projectiles[0].x - patrolFacing * 360;
  bananaStep(state, 5);
  assert.equal(state.projectiles[0].locked, undefined);
  assert.equal(state.projectiles[0].facing, patrolFacing);

  // Now enemy steps inside detection radius -> Sheer Heart Attack locks on, accelerates (vx = 11.5), parks at feet, and blasts!
  target.x = state.projectiles[0].x - patrolFacing * 160;
  const lockEvents = bananaStep(state, 3);
  assert.equal(lockEvents.some(e => e.kind === 'kq-lock' && e.actionId === bananaActionIds.joSheerHeart), true);
  assert.ok(state.projectiles[0].locked !== undefined);
  assert.equal(Math.abs(state.projectiles[0].vx), 11.5);

  // Rolls rapidly up to enemy feet, parks without premature explosion, then blasts when 42-tick lock fuse ends!
  const rushEvents = bananaStep(state, 20);
  assert.equal(rushEvents.some(e => e.kind === 'kq-detonate'), false);
  assert.ok(Math.abs(state.projectiles[0].x - target.x) <= 16);
  assert.equal(state.projectiles[0].vx, 0);

  const endEvents = bananaStep(state, 25);
  assert.equal(endEvents.some(e => e.kind === 'kq-detonate' && e.actionId === bananaActionIds.joSheerHeart), true);
  assert.equal(endEvents.some(e => e.kind === 'hit' && e.actionId === bananaActionIds.joSheerHeart), true);
  assert.equal(tears(f), 0);
  assert.equal(f.energy, 28);
  assert.equal(state.projectiles.length, 0);

  // Now U can be cast again once the previous Sheer Heart Attack has detonated and hitstop finishes.
  bananaStep(state, 10);
  step(state, [input(['B']), NEUTRAL], bananaConfig);
  assert.equal(f.attack?.id, bananaActionIds.joSheerHeart);
  bananaStep(state, 6);
  assert.equal(state.projectiles.length, 1);
  state.projectiles = [];

  // Up + U unleashes physical 3-hit upward Star Platinum Ora barrage at 0 tears and jump-cancels cleanly into 45° aerial J dive!
  bananaStep(state, 75);
  f.energy = 0;
  closeDistance(state);
  step(state, [input(['B'], 0, -1), NEUTRAL], bananaConfig);
  assert.equal(f.attack.id, bananaActionIds.joAntiAir);
  const aaEvents = bananaStep(state, 18);
  const aaHits = aaEvents.filter(e => e.kind === 'hit' && e.actionId === bananaActionIds.joAntiAir);
  assert.ok(aaHits.length >= 2);
  assert.ok(f.energy >= aaHits.length * 12);
  assert.equal(target.ground, null);
  step(state, [input(['jump']), NEUTRAL], bananaConfig);
  bananaStep(state, 5);
  assert.equal(f.ground, null);
  step(state, [input(['A']), NEUTRAL], bananaConfig);
  assert.equal(f.attack.id, bananaActionIds.joAirDive);
});

test('JO Banana Killer Queen orb does not U-turn backward once behind the opponent', () => {
  const state = begin(bananaConfig);
  const [f, target] = state.fighters;
  f.joAwakened = true;
  target.x = f.x + 300;
  step(state, [input(['C']), NEUTRAL], bananaConfig);
  bananaStep(state, 10);
  assert.equal(state.projectiles.length, 1);
  assert.ok(state.projectiles[0].vx > 0);
  // Opponent moves behind the orb; orb keeps drifting forward instead of reversing.
  target.x = f.x - 200;
  bananaStep(state, 20);
  assert.ok(state.projectiles[0].vx > 0);
});

test('JO Banana 2-bar ULT activates The World time stop in range, warps, flicks, and launches enemy on release', () => {
  const state = begin(bananaConfig);
  const [f, target] = state.fighters;
  f.joAwakened = true;
  f.energy = 2 * ENERGY_PER_STOCK;
  target.x = f.x + 320;
  const startRemaining = state.remaining;

  // Trigger The World via ULT.
  const startEvents = step(state, [input(['ULT']), NEUTRAL], bananaConfig);
  assert.equal(startEvents.some(e => e.kind === 'time-stop-start'), true);
  assert.ok(state.timeStop);
  assert.equal(f.energy, 0);

  // Opponent input is frozen during time stop and round timer pauses.
  const oppStartX = target.x;
  bananaStep(state, 41, [NEUTRAL, input([], 1)]);
  assert.equal(target.x, oppStartX);
  assert.equal(state.remaining, startRemaining);

  // Frame 42: Banana Cat warps beside the frozen enemy.
  const warpEvents = bananaStep(state, 1);
  assert.equal(warpEvents.some(e => e.kind === 'time-stop-warp'), true);
  assert.ok(Math.abs(f.x - target.x) <= 70);

  // Frame 72: Stand rush begins; barrage pulses fire while enemy stays frozen until release.
  const flickEvents = bananaStep(state, 30);
  assert.equal(flickEvents.some(e => e.kind === 'time-stop-flick'), true);
  assert.equal(target.hp, 1000);
  assert.equal(target.x, oppStartX);

  // Frame 144 (2.4s): Barrage & finisher pulses land visually, then time resumes and enemy takes 275 damage & flies away!
  const relEvents = bananaStep(state, 72);
  assert.equal(relEvents.some(e => e.kind === 'time-stop-hit'), true);
  assert.equal(relEvents.some(e => e.kind === 'time-stop-hit' && e.heavy === true), true);
  assert.equal(relEvents.some(e => e.kind === 'time-stop-release'), true);
  assert.equal(relEvents.some(e => e.kind === 'hit' && e.actionId === bananaActionIds.theWorld), true);
  assert.equal(state.timeStop, undefined);
  assert.equal(target.hp, 1000 - 275);
  assert.ok(target.vy < 0);
  assert.equal(target.recovery?.phase, 'fall');
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

test('Banana can go from crying directly into W+I wave', () => {
  const state = begin(bananaConfig), [f] = state.fighters;
  step(state, [hold('C', ['C']), NEUTRAL], bananaConfig);
  bananaStep(state, 2, [hold('C'), NEUTRAL]);
  step(state, [input(['C'], 0, -1), NEUTRAL], bananaConfig);
  assert.equal(f.attack.id, bananaActionIds.wave);
  assert.equal(f.energy, 0);
  assert.equal(state.cutIn, undefined);
});

test('A foe can interrupt crying and holding I through the hit does not restart it', () => {
  const state = begin(bananaConfig), [f] = state.fighters;
  closeDistance(state);
  step(state, [hold('C', ['C']), input(['A'])], bananaConfig);
  bananaStep(state, 10, [hold('C'), NEUTRAL]);
  const afterHit = f.energy;
  assert.ok(afterHit > 0);
  assert.equal(f.attack, null);
  bananaStep(state, 60, [hold('C'), NEUTRAL]);
  assert.equal(f.energy, afterHit);
});

const gaga = roster.find(entry => entry.fighter.id === 'gaga').fighter;
// Isolate authored Gaga behavior from the real whale's continuous basin counter and custom stats.
const gagaDummy = defineFighter({
  id: 'gaga-dummy', name: '公共动作陪练', height: 144, accent: '#fff',
  art: { portrait: 'whale.webp', motion: 'whale-motion.webp' }, signatureMoves: []
}).fighter;
const gagaConfig = { ...config, fighters: [gaga, gagaDummy] };

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

function playGaga(state, presses, target = NEUTRAL, settings = gagaConfig) {
  const stages = [];
  const events = [];
  const hitFrames = [];
  const hitResponses = [];
  for (let frame = 0; frame < 150; frame++) {
    const tickEvents = step(state, [input(presses[frame] ?? []), target], settings);
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
  const settings = { ...gagaConfig, arena: arenas.find(arena => arena.id === 'broadcast-ring') };
  for (const presses of [
    { 0: ['A'], 2: ['A'], 5: ['A'], 7: ['A'], 9: ['A'] },
    { 0: ['A', 'A', 'A', 'A', 'A'] },
    { 0: ['A'], 11: ['A'], 22: ['A'], 33: ['A'], 44: ['A'] },
    { 0: ['A'], 16: ['A'], 32: ['A'], 48: ['A'], 64: ['A'] }
  ]) {
    const state = begin(settings);
    const [attacker, defender] = state.fighters;
    [attacker.x, defender.x] = [650, 779];
    const { stages, events, hitFrames, hitResponses } = playGaga(state, presses, NEUTRAL, settings);
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

test('Gaga down + J exits guard and slides 170 units in either facing direction', () => {
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
    assert.equal(attacker.x, 1900 + 170 * direction);
    assert.equal(defender.hp, 1000);
  }
});

test('Gaga can hit a distant target once during the long slide and stays inside the arena', () => {
  const state = begin(gagaConfig);
  const [attacker, defender] = state.fighters;
  defender.x = gagaConfig.arena.right;
  attacker.x = defender.x - 150;
  step(state, [input(['A'], 0, 1), NEUTRAL], gagaConfig);
  const hits = stepFor(state, 65, [NEUTRAL, NEUTRAL], gagaConfig).filter(event => event.kind === 'hit');
  assert.deepEqual(hits.map(event => event.amount), [105]);
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

test('Gaga equips ranged Grand Vision sword wave U, remote shatter/spire up+B, air dive down+B, and air U/J pole/flipper', () => {
  const settings = { ...gagaConfig, arena: { ...gagaConfig.arena, platforms: [] } };
  const state = begin(settings);
  const [attacker, defender] = state.fighters;
  [attacker.x, defender.x] = [650, 950];

  // Neutral B fires a fast two-fighter-tall Grand Vision sword wave (hits distant foes) and plants crystalMark.
  step(state, [input(['B']), NEUTRAL], settings);
  assert.equal(attacker.attack.id, gagaActionIds.swordSlash);
  const waveEvents = stepFor(state, 28, [NEUTRAL, NEUTRAL], settings);
  assert.equal(waveEvents.some(e => e.kind === 'crystal-plant'), true);
  assert.equal(defender.crystalMark?.source, 0);
  const hpAfterWave = defender.hp;
  assert.equal(hpAfterWave, 1000 - 58);

  // Up+B remotely shatters the crystal mark even from 500px across the arena!
  attacker.x = defender.x - 500;
  step(state, [input(['B'], 0, -1), NEUTRAL], settings);
  assert.equal(attacker.attack.id, gagaActionIds.swordRise);
  const shatterEvents = stepFor(state, 12, [NEUTRAL, NEUTRAL], settings);
  assert.equal(shatterEvents.some(e => e.kind === 'crystal-shatter'), true);
  assert.equal(defender.crystalMark, undefined);
  // Connects as a 2-hit true combo after the faster sword wave (8% combo scaling: floor(128 * 0.92) = 117).
  assert.equal(defender.hp, hpAfterWave - 117);
  assert.equal(attacker.ground, 'floor');

  // Two-fighter-tall wave also catches an airborne opponent 200px above ground.
  const airCheck = begin(settings);
  airCheck.fighters[0].x = 650;
  Object.assign(airCheck.fighters[1], { x: 960, ground: null, y: settings.arena.floor - 200, vy: 0 });
  step(airCheck, [input(['B']), NEUTRAL], settings);
  const airWaveEvents = stepFor(airCheck, 22, [NEUTRAL, NEUTRAL], settings);
  assert.equal(airWaveEvents.some(e => e.kind === 'hit' && e.actionId === gagaActionIds.swordSlash), true);

  // Without mark, up+B summons an anti-air/mid-range crystal spire in front without dashing body.
  stepFor(state, 80, [NEUTRAL, NEUTRAL], settings);
  assert.equal(defender.recovery, null);
  defender.x = attacker.x + 140;
  defender.ground = null;
  defender.y -= 130;
  step(state, [input(['B'], 0, -1), NEUTRAL], settings);
  const spireEvents = stepFor(state, 15, [NEUTRAL, NEUTRAL], settings);
  assert.equal(spireEvents.some(e => e.kind === 'crystal-spire'), true);
  assert.equal(spireEvents.some(e => e.kind === 'hit' && e.actionId === gagaActionIds.swordRise), true);

  // Air down+B triggers Grand Vision dive; air B still selects pole throw and air A selects air flipper.
  stepFor(state, 25, [NEUTRAL, NEUTRAL], settings);
  step(state, [input(['jump']), NEUTRAL], settings);
  step(state, [input(['B'], 0, 1), NEUTRAL], settings);
  assert.equal(attacker.attack.id, gagaActionIds.airDive);
  stepFor(state, 40, [NEUTRAL, NEUTRAL], settings);
  assert.equal(attacker.ground, 'floor');

  step(state, [input(['jump']), NEUTRAL], settings);
  step(state, [input(['B']), NEUTRAL], settings);
  assert.equal(attacker.attack.id, gagaActionIds.airThrow);
});

test('Gaga down+C Xiranite dome parries frontal attacks and bursts liquid spikes', () => {
  const state = begin(gagaConfig);
  const [defender, attacker] = state.fighters;
  closeDistance(state);
  step(state, [input(['C'], 0, 1), input(['A'])], gagaConfig);
  assert.equal(defender.attack.id, gagaActionIds.xiraniteGuard);
  const events = stepFor(state, 20, [NEUTRAL, NEUTRAL], gagaConfig);
  assert.equal(events.some(e => e.kind === 'parry' && e.source === 0), true);
  assert.equal(events.some(e => e.kind === 'xiranite-burst' && e.source === 0), true);
  assert.equal(events.some(e => e.kind === 'hit' && e.actionId === gagaActionIds.xiraniteBurst), true);
  assert.equal(defender.hp, 1000);
  assert.ok(attacker.hp < 1000);
  assert.ok(attacker.recovery);
});

test('Gaga up+C plants a power pylon field that doubles friendly turret attack speed inside its radius', () => {
  const settings = { ...gagaConfig, arena: { ...gagaConfig.arena, platforms: [] } };
  const state = begin(settings);
  const [caster, target] = state.fighters;
  [caster.x, target.x] = [650, 1080];
  caster.energy = 0;

  // Plant a power pylon via up+C at 0 energy cost.
  step(state, [input(['C'], 0, -1), NEUTRAL], settings);
  assert.equal(caster.attack.id, gagaActionIds.overclock);
  const plantEvents = stepFor(state, 14, [NEUTRAL, NEUTRAL], settings);
  assert.equal(plantEvents.some(e => e.kind === 'pylon-plant' && e.source === 0), true);
  const pylon = state.powerPylons?.[0];
  assert.ok(pylon);
  assert.equal(pylon.x, 710);

  // Friendly bolt turret inside the field (distance 90 <= 520) charges at 2x speed and fires every 60 ticks.
  state.turrets.bolt = { kind: 'bolt', owner: 0, x: 800, y: settings.arena.floor, facing: 1, age: 20, hp: 2, charge: 0 };
  step(state, [NEUTRAL, NEUTRAL], settings);
  assert.equal(state.turrets.bolt.charge, 2);
  const boostedEvents = stepFor(state, 129, [NEUTRAL, NEUTRAL], settings);
  const boostedShots = boostedEvents.filter(e => e.kind === 'turret-fire' && e.turretKind === 'bolt');
  assert.equal(boostedShots.length, 2);

  // Friendly turret outside the field (distance 620 > 520) charges at 1x speed and fires once per 120 ticks.
  state.turrets.bolt = { kind: 'bolt', owner: 0, x: pylon.x + 620, y: settings.arena.floor, facing: 1, age: 20, hp: 2, charge: 0 };
  step(state, [NEUTRAL, NEUTRAL], settings);
  assert.equal(state.turrets.bolt.charge, 1);
  const unboostedEvents = stepFor(state, 129, [NEUTRAL, NEUTRAL], settings);
  const normalShots = unboostedEvents.filter(e => e.kind === 'turret-fire' && e.turretKind === 'bolt');
  assert.equal(normalShots.length, 1);

  // Expiring pylon restores normal 1x firing cadence and clears state.
  state.turrets.bolt = { kind: 'bolt', owner: 0, x: 800, y: settings.arena.floor, facing: 1, age: 20, hp: 2, charge: 0 };
  pylon.remaining = 2;
  const expireEvents = stepFor(state, 130, [NEUTRAL, NEUTRAL], settings);
  assert.equal(expireEvents.some(e => e.kind === 'pylon-expire' && e.source === 0), true);
  assert.equal(state.powerPylons?.[0], null);
  assert.equal(expireEvents.filter(e => e.kind === 'turret-fire' && e.turretKind === 'bolt').length, 1);
});

test('Gaga selects down+U ground throw, U air throw and J air strike at 0 energy', () => {
  for (const [key, air, x, actionId] of [
    ['B', false, 0, gagaActionIds.groundThrow], ['B', true, 0, gagaActionIds.airThrow],
    ['A', true, 0, gagaActionIds.airStrike]
  ]) {
    const state = begin(gagaConfig);
    if (air) step(state, [input(['jump']), NEUTRAL], gagaConfig);
    step(state, [input([key], x, actionId === gagaActionIds.groundThrow ? 1 : 0), NEUTRAL], gagaConfig);
    assert.equal(state.fighters[0].attack.id, actionId);
    assert.equal(state.fighters[0].energy, 0);
  }
});

test('a downward direction keeps C on its own skill even with three full stocks', () => {
  for (const [definition, skill, cost] of [
    [banana, bananaActionIds.recharge, 0],
    [gaga, gagaActionIds.xiraniteGuard, 0]
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
  const { arena } = gagaConfig;
  const platform = arena.platforms.find(surface => surface.id === arena.routes[0][0]);
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

test('simultaneous Dijiang confirms clash without a charge in either round', () => {
  const settings = { ...gagaConfig, fighters: [gaga, gaga] };
  for (const round of [1, 2]) {
    const state = begin(settings);
    state.round = round;
    for (const fighter of state.fighters) fighter.energy = MAX_ENERGY;
    const clash = step(state, [summonInput, summonInput], settings);
    assert.deepEqual(clash.map(event => [event.source, event.ultimateReason]), [[0, 'contested'], [1, 'contested']]);
    assert.equal(state.summon, undefined);
    assert.deepEqual(state.fighters.map(fighter => fighter.energy), [MAX_ENERGY, MAX_ENERGY]);
    assert.deepEqual(step(state, [NEUTRAL, NEUTRAL], settings), []);
    step(state, [summonInput, NEUTRAL], settings);
    assert.equal(state.summon.source, 0);
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

test('Gaga spends no energy and the box rises, falls, hits only once and builds on landing', () => {
  const settings = { ...gagaConfig, training: true, arena: { ...gagaConfig.arena, platforms: [] } };
  const state = begin(settings);
  const [attacker, defender] = state.fighters;
  [attacker.x, defender.x] = [650, 890];
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
  assert.equal(state.turrets.bolt.hp, 90);
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
  stepFor(state, 180, [NEUTRAL, NEUTRAL], settings);
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

test('two distinct enemy attacks destroy a turret by HP, with no duplicate hits on active frames', () => {
  const state = begin(gagaConfig);
  const [owner, enemy] = state.fighters;
  [owner.x, enemy.x] = [650, 900];
  state.turrets.bolt = { kind: 'bolt', owner: 0, x: 840, y: gagaConfig.arena.floor, facing: 1, age: 20, hp: 150, maxHp: 150 };
  step(state, [NEUTRAL, input(['A'])], gagaConfig);
  stepFor(state, 24, [NEUTRAL, NEUTRAL], gagaConfig);
  assert.equal(state.turrets.bolt.hp, 60);
  step(state, [NEUTRAL, input(['A'])], gagaConfig);
  const events = stepFor(state, 12, [NEUTRAL, NEUTRAL], gagaConfig);
  assert.equal(events.filter(event => event.kind === 'turret-burst').length, 1);
  assert.equal(state.turrets.bolt, null);
});

test('air I drops through platforms, keeps the opponent howitzer and costs no energy', () => {
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
  assert.equal(owner.energy, ENERGY_PER_STOCK);
  assert.ok(events.some(event => event.kind === 'swing' && event.actionId === gagaActionIds.howitzer));
  assert.deepEqual(events.filter(event => ['turret-burst','turret-land'].includes(event.kind)).map(event =>
    [event.kind, event.turretKind, event.source, event.y]), [
    ['turret-land', 'howitzer', 0, arena.floor]
  ]);
  assert.equal(state.turrets.bolt, bolt);
  assert.equal(state.turrets.howitzer.owner, 1);
  assert.equal(state.turrets['howitzer-second'].owner, 0);
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
      step(state, [input(['B']), target], settings);
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
  step(state, [input(['B']), NEUTRAL], settings);
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
    assert.equal(attacker.walk.direction, 'forward');
    assert.ok(Math.abs(attacker.walk.distance - gaga.run * 4) < 1e-9);
    stepFor(state, 3, [input([], -facing), NEUTRAL], gagaConfig);
    assert.equal(attacker.facing, facing);
    assert.equal(attacker.walk.direction, 'back');
    assert.ok(Math.abs(attacker.walk.distance - gaga.run * 3) < 1e-9);
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
      const contact = events.find(event => event.kind === (blocking && direction !== 1 ? 'block' : 'hit'));
      assert.equal(gagaContact(contact, gagaConfig.fighters), blocking && direction !== 1 ? 'guard' : cue);
      assert.equal(contact.facing, 1);
      if (blocking && direction !== 1) assert.equal(state.fighters[1].reaction, undefined);
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
      const landing = [];
      while (!target.ground && state.frame < 200) landing.push(...step(state, neutral, settings));
      // The shared framework transfers airborne reactions into the protected down/rise lifecycle.
      assert.ok(landing.some(event => event.kind === 'knockdown' && event.reaction === 'air'));
      assert.equal(target.reaction, undefined);
      assert.deepEqual(target.recovery, { phase: 'down', remaining: DEFAULT_KNOCKDOWN_FRAMES, facing: -1 });
      stepFor(state, 4, neutral, settings);
      assert.equal(target.recovery.phase, 'down');
      stepFor(state, DEFAULT_KNOCKDOWN_FRAMES + DEFAULT_RISE_FRAMES, neutral, settings);
      assert.equal(target.recovery, null);
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
      assert.ok(events.some(event => event.kind === 'knockdown' && event.source === 1 && event.reaction === 'air'));
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
    const { distance, dwell, period, phase } = lift.travel;
    const activeFrame = Math.round(period / 4 + dwell / 4) - phase;
    state.arenaFrame = (activeFrame + period) % period;
    const deck = platformAt(lift, state.arenaFrame);
    const crate = gaga.actions.find(action => action.id === gagaActionIds.turret);
    state.projectiles.push({
      source: 0, actionId: crate.id, facing: 1, x: (deck.left + deck.right) / 2,
      y: deck.y - crate.projectile.radius - 1, vx: 0, vy: 7, connected: false
    });
    const landing = step(state, [NEUTRAL, NEUTRAL], settings).find(event => event.kind === 'turret-land');
    const turret = state.turrets.bolt;
    assert.ok(landing && turret, arena.id + ' moving platform should catch the crate');
    assert.equal(turret.support, lift.id);
    assert.equal(landing.y, platformAt(lift, state.arenaFrame).y);
    const offset = turret.x - platformAt(lift, state.arenaFrame).left;
    stepFor(state, 180, [NEUTRAL, NEUTRAL], settings);
    const moved = platformAt(lift, state.arenaFrame);
    const movement = lift.travel.axis === 'y' ? moved.y - deck.y : moved.left - deck.left;
    assert.ok(Math.abs(movement) > Math.abs(distance) / 10);
    assert.equal(turret.x - moved.left, offset);
    assert.equal(turret.y, moved.y);
    assert.ok(turret.age > 20);
  }
});

test('Banana can connect a normal combo from farther away while spray stays bounded', () => {
  for (const source of [0, 1]) {
    const state = begin(bananaConfig);
    const [attacker, target] = [state.fighters[source], state.fighters[1 - source]];
    attacker.x = 1800; target.x = 1800 + (source === 0 ? 170 : -170);
    attacker.facing = source === 0 ? 1 : -1;
    target.facing = -attacker.facing;
    const frames = [NEUTRAL, NEUTRAL];
    frames[source] = input(['A', 'A', 'A', 'A']);
    const events = [...step(state, frames, bananaConfig), ...bananaStep(state, 150)];
    assert.deepEqual(events.filter(event => event.kind === 'hit').map(event => event.actionId),
      [bananaActionIds.jab, bananaActionIds.backhand, bananaActionIds.headbutt, bananaActionIds.cry]);
  }
  for (const [distance, shouldHit] of [[470, true], [540, false]]) {
    const state = begin(bananaConfig), [attacker, target] = state.fighters;
    attacker.x = 1800; target.x = attacker.x + distance;
    const events = [...step(state, [input(['B']), NEUTRAL], bananaConfig), ...bananaStep(state, 20)];
    assert.equal(events.some(event => event.kind === 'hit' && event.actionId === bananaActionIds.pressure), shouldHit);
  }
});


test('Banana previous first strike misses at 170 while the revised strike connects', () => {
  const previous = LEGACY_BANANA_SKILLS.usabilityPass;
  const oldFighter = { ...banana, actions: banana.actions.map(action => action.id === bananaActionIds.jab
    ? { ...action, hitbox: previous.jabHitbox, advance: previous.jabAdvance, activeAdvance: previous.jabActiveAdvance }
    : action) };
  for (const [fighter, expected] of [[oldFighter, false], [banana, true]]) {
    const settings = { ...bananaConfig, fighters: [fighter, banana] };
    const state = begin(settings), [attacker, target] = state.fighters;
    attacker.x = 1800; target.x = 1970;
    const events = [...step(state, [input(['A']), NEUTRAL], settings), ...bananaStep(state, 30, bananaNeutral, settings)];
    assert.equal(events.some(event => event.kind === 'hit' && event.actionId === bananaActionIds.jab), expected);
  }
});

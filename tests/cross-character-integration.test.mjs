import assert from 'node:assert/strict';
import test from 'node:test';
import { arenas } from '../dist/content/arenas.js';
import { rules } from '../dist/content/demo.js';
import { banana, bananaActionIds } from '../dist/content/fighters/banana.js';
import { frog } from '../dist/content/fighters/frog.js';
import { gaga, gagaActionIds } from '../dist/content/fighters/gaga.js';
import { whale } from '../dist/content/fighters/whale.js';
import { FROG_RULES } from '../dist/core/frog-kit.js';
import { createMatch, step } from '../dist/core/match.js';
import { MAX_ENERGY, NEUTRAL } from '../dist/core/types.js';
import { WHALE_RULES } from '../dist/core/whale-kit.js';

const neutral = [NEUTRAL, NEUTRAL];
const press = key => ({ ...NEUTRAL, pressed: [key] });
const guard = { ...NEUTRAL, y: 1 };

function match(fighters, separation) {
  const arena = {
    ...arenas[0], width: 4500, left: 100, right: 4400, floor: 800,
    spawn: [800, 800 + separation], platforms: []
  };
  const config = { rules, arena, fighters: fighters.map(entry => entry.fighter) };
  const state = createMatch(config);
  state.phase = 'fight';
  return { config, state };
}

function advance(state, config, ticks, inputs = neutral) {
  return Array.from({ length: ticks }, () => step(state, inputs, config)).flat();
}

function advanceUntil(state, config, predicate, limit) {
  for (let tick = 0; tick < limit && !predicate(); tick++) step(state, neutral, config);
  assert.ok(predicate(), 'Expected the transition before the tick limit');
}

function replay(state, config, ticks) {
  const restored = structuredClone(state);
  for (let tick = 0; tick < ticks; tick++) {
    assert.deepEqual(step(state, neutral, config), step(restored, neutral, config));
    assert.deepEqual(state, restored);
  }
}

test('a held iron-basin guard counters Gaga’s airborne pole on either seat after its tap window expires', () => {
  for (const gagaSeat of [0, 1]) {
    const whaleSeat = 1 - gagaSeat;
    const { state, config } = match(gagaSeat === 0 ? [gaga, whale] : [whale, gaga], 195);
    const attacker = state.fighters[gagaSeat];
    const defender = state.fighters[whaleSeat];
    const heldGuard = [...neutral];
    heldGuard[whaleSeat] = guard;
    advance(state, config, whale.fighter.guardCounter.windowFrames + 8, heldGuard);
    assert.equal(defender.guardCounterLeft, 0);
    assert.equal(defender.guarding, true);

    Object.assign(attacker, { y: config.arena.floor - 170, ground: null });
    const unguarded = structuredClone(state);
    const poleInput = [...neutral];
    poleInput[gagaSeat] = press('A');
    const plainHit = [...step(unguarded, poleInput, config), ...advance(unguarded, config, 24)];
    assert.deepEqual(plainHit.filter(event => event.kind === 'hit').map(event => event.actionId), [gagaActionIds.airThrow]);

    poleInput[whaleSeat] = guard;
    const countered = [...step(state, poleInput, config), ...advance(state, config, 24, heldGuard)];
    assert.deepEqual(countered.filter(event => event.kind === 'parry').map(event => event.source), [whaleSeat]);
    assert.ok(countered.some(event => event.kind === 'swing' && event.actionId === 'whale-counter'));
    assert.equal(state.entities?.filter(entity => entity.definition.behavior === 'rice').length, 8);
    assert.equal(defender.hp, whale.fighter.maxHp);
    assert.equal(defender.guard, rules.guardMax);
  }
});

test('two Banana tear blasts on the same tick trigger one Frog warp and are both consumed', () => {
  const { state, config } = match([banana, frog], 300);
  const [attacker, defender] = state.fighters;
  const action = banana.fighter.actions.find(move => move.id === bananaActionIds.tear);
  const { vx, vy } = action.projectile;
  // Restore two existing shots one tick before both reach the same defender.
  state.projectiles = [
    { x: defender.x - 65, y: defender.y - 70 },
    { x: defender.x - 70, y: defender.y - 80 }
  ].map(position => ({ ...position, actionId: action.id, source: 0, facing: 1, vx, vy, connected: false }));
  const unguarded = structuredClone(state);
  assert.equal(step(unguarded, neutral, config).filter(event => event.kind === 'hit').length, 2);

  const initialTears = attacker.tearUnits;
  const crouch = { ...press('C'), held: ['C'] };
  const contact = step(state, [NEUTRAL, crouch], config);
  assert.equal(contact.filter(event => event.kind === 'tear-splash').length, 2);
  assert.deepEqual(contact.filter(event => event.kind === 'parry').map(event => event.source), [1]);
  assert.ok(!contact.some(event => event.kind === 'hit'));
  assert.equal(defender.frogWarps?.length, 1);
  assert.equal(defender.frogWarps[0].kind, 'behind');
  assert.ok((defender.x - attacker.x) * attacker.facing < 0);
  assert.equal(defender.energy, FROG_RULES.warpGain);
  assert.equal(state.projectiles.length, 0);

  const after = advance(state, config, 25, [NEUTRAL, { ...NEUTRAL, held: ['C'] }]);
  assert.ok(!after.some(event => ['hit', 'parry', 'tear-splash'].includes(event.kind)));
  assert.equal(defender.hp, frog.fighter.maxHp);
  assert.equal(defender.energy, FROG_RULES.warpGain);
  assert.equal(attacker.tearUnits, initialTears);
  assert.equal(attacker.energy, 0);
});

test('Frog ascension and a pending Banana wave resume in order with resources and snapshots intact', () => {
  const { state, config } = match([banana, frog], 2800);
  const [cat, naiva] = state.fighters;
  const initialTears = cat.tearUnits;
  const cry = { ...press('C'), held: ['C'] };
  step(state, [cry, NEUTRAL], config);
  advance(state, config, 29, [{ ...NEUTRAL, held: ['C'] }, NEUTRAL]);
  advanceUntil(state, config, () => cat.attack === null, 12);
  const tears = cat.tearUnits;
  assert.ok(tears > initialTears);
  const wave = banana.fighter.actions.find(move => move.id === bananaActionIds.wave);
  cat.energy = naiva.energy = MAX_ENERGY;
  assert.ok(step(state, [press('ULT'), NEUTRAL], config).some(event => event.kind === 'wave-windup'));
  assert.ok(step(state, [NEUTRAL, press('ULT')], config).some(event => event.actionId === 'frog-ascend'));
  const pendingWave = structuredClone(cat.attack);
  const frogStart = state.arenaFrame;
  const timeBeforeFrog = state.remaining;

  replay(state, config, WHALE_RULES.cinematic);
  assert.deepEqual(cat.attack, pendingWave);
  assert.equal(state.arenaFrame, frogStart);
  assert.equal(state.remaining, timeBeforeFrog);
  assert.equal(cat.energy, 0);
  assert.equal(cat.tearUnits, tears);
  assert.equal(naiva.energy, MAX_ENERGY);
  assert.equal(naiva.ascendUntil, frogStart + FROG_RULES.buffTicks);

  advanceUntil(state, config, () => Boolean(state.cutIn), wave.cutIn.at + 1);
  assert.equal(state.cutIn.source, 0);
  const frogDuringWave = structuredClone(naiva);
  const waveStart = state.arenaFrame;
  const timeBeforeWave = state.remaining;
  replay(state, config, wave.cutIn.duration);
  assert.equal(state.cutIn, undefined);
  assert.equal(state.arenaFrame, waveStart);
  assert.equal(state.remaining, timeBeforeWave);
  assert.deepEqual(naiva, frogDuringWave);
  assert.equal(cat.energy, 0);
  assert.equal(cat.tearUnits, tears);

  advanceUntil(state, config, () => state.projectiles.some(projectile => projectile.actionId === wave.id), wave.startup);
  assert.equal(naiva.ascendUntil, frogStart + FROG_RULES.buffTicks);
  assert.ok(naiva.energy < frogDuringWave.energy);
});

test('Whale’s pool cinematic pauses Gaga’s deployed turret and lets both systems resume from a snapshot', () => {
  const { state, config } = match([whale, gaga], 2400);
  const [caster, engineer] = state.fighters;
  caster.energy = engineer.energy = MAX_ENERGY;
  step(state, [NEUTRAL, press('C')], config);
  advanceUntil(state, config, () => Boolean(state.turrets.bolt), 100);
  assert.equal(state.turrets.bolt.owner, 1);
  const stockAfterDeployment = engineer.energy;

  assert.ok(step(state, [press('ULT'), NEUTRAL], config).some(event => event.actionId === 'open-source'));
  const tower = structuredClone(state.turrets.bolt);
  const clock = state.arenaFrame;
  replay(state, config, WHALE_RULES.cinematic);
  assert.deepEqual(state.turrets.bolt, tower);
  assert.equal(state.arenaFrame, clock);
  assert.equal(engineer.energy, stockAfterDeployment);
  assert.equal(caster.energy, 0);
  const pools = state.entities.filter(entity => entity.definition.behavior === 'pool');
  assert.equal(pools.length, 1);
  assert.equal(pools[0].age, 0);

  replay(state, config, 1);
  assert.equal(state.turrets.bolt.age, tower.age + 1);
  assert.equal(state.entities.find(entity => entity.id === pools[0].id).age, 1);
});

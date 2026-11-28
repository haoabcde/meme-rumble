import assert from 'node:assert/strict';
import test from 'node:test';
import { arenas } from '../dist/content/arenas.js';
import { rules, testFighter } from '../dist/content/demo.js';
import { banana, bananaActionIds } from '../dist/content/fighters/banana.js';
import { frog } from '../dist/content/fighters/frog.js';
import { gaga, gagaActionIds } from '../dist/content/fighters/gaga.js';
import { whale } from '../dist/content/fighters/whale.js';
import { FROG_RULES } from '../dist/core/frog-kit.js';
import { clearBufferedInputs, createMatch, step, ultimateAvailability } from '../dist/core/match.js';
import { ENERGY_PER_STOCK, MAX_ENERGY, NEUTRAL } from '../dist/core/types.js';
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

test('a timed iron-basin guard counters Gaga’s airborne pole while holding past 8 frames blocks normally', () => {
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
    const heldBlocked = structuredClone(state);
    const poleInput = [...neutral];
    poleInput[gagaSeat] = press('B');
    poleInput[whaleSeat] = guard;
    const blockedEvents = [...step(heldBlocked, poleInput, config), ...advance(heldBlocked, config, 24, heldGuard)];
    assert.equal(blockedEvents.some(event => event.kind === 'parry'), false);
    assert.ok(blockedEvents.some(event => event.kind === 'block'));

    // Release and perform a fresh timed press within the 8-frame parry window as the thrown pole arrives.
    advance(state, config, 1, neutral);
    const poleOnly = [...neutral];
    poleOnly[gagaSeat] = press('B');
    step(state, poleOnly, config);
    advance(state, config, 7, neutral);
    const countered = [...advance(state, config, 20, heldGuard)];
    assert.deepEqual(countered.filter(event => event.kind === 'parry').map(event => event.source), [whaleSeat]);
    assert.ok(countered.some(event => event.kind === 'swing' && event.actionId === 'whale-counter'));
    assert.equal(state.entities?.filter(entity => entity.definition.behavior === 'rice').length, 7);
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
  const twoShots = [
    { x: defender.x - 65, y: defender.y - 70 },
    { x: defender.x - 70, y: defender.y - 80 }
  ].map(position => ({ ...position, actionId: action.id, source: 0, facing: 1, vx, vy, connected: false }));
  const unguarded = structuredClone(state);
  unguarded.projectiles = structuredClone(twoShots);
  assert.equal(step(unguarded, neutral, config).filter(event => event.kind === 'hit').length, 2);

  const initialTears = attacker.tearUnits;
  const crouch = { ...press('C'), held: ['C'] };
  // Enter active crouch window (2-frame startup) before the tear blasts arrive.
  step(state, [NEUTRAL, crouch], config);
  step(state, [NEUTRAL, { ...NEUTRAL, held: ['C'] }], config);
  state.projectiles = structuredClone(twoShots);
  const contact = step(state, [NEUTRAL, { ...NEUTRAL, held: ['C'] }], config);
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
  const initialEnergy = cat.energy;
  const cry = { ...press('C'), held: ['C'] };
  step(state, [cry, NEUTRAL], config);
  advance(state, config, 29, [{ ...NEUTRAL, held: ['C'] }, NEUTRAL]);
  advanceUntil(state, config, () => cat.attack === null, 12);
  const tears = cat.tearUnits;
  assert.ok(cat.energy > initialEnergy);
  const wave = banana.fighter.actions.find(move => move.id === bananaActionIds.joAwaken);
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
  assert.equal(naiva.energy, 0);
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

  advanceUntil(state, config, () => cat.attack === null, wave.startup + wave.active + wave.recovery + 2);
  assert.equal(naiva.ascendUntil, frogStart + FROG_RULES.buffTicks);
  assert.equal(naiva.energy, frogDuringWave.energy);
  assert.ok(state.arenaFrame > waveStart);
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

const production = [whale, frog, banana, gaga];
const dummy = { fighter: testFighter };
const vertical = (key, y) => ({ ...press(key), y });

test('all four roles can confirm either early J into launcher, jump cancel and air J at zero energy', () => {
  for (const entry of production) {
    for (const seat of [0, 1]) {
      for (const count of [1, 2]) {
        const fighters = seat === 0 ? [entry, dummy] : [dummy, entry];
        const { state, config } = match(fighters, 72);
        const fighter = state.fighters[seat];
        if (fighter.tearUnits !== undefined) fighter.tearUnits = 0;
        const target = state.fighters[1 - seat];
        const send = (command = NEUTRAL) => step(state, seat === 0 ? [command, NEUTRAL] : [NEUTRAL, command], config);
        const hits = [];
        const capture = (command = NEUTRAL) => {
          hits.push(...send(command).filter(event => event.kind === 'hit' && event.source === seat));
        };
        const wait = (predicate, label) => {
          for (let frame = 0; frame < 25 && !predicate(); frame++) capture();
          assert.ok(predicate(), entry.fighter.id + ' seat ' + seat + ': ' + label);
        };
        assert.equal(fighter.energy, 0);
        capture(press('A'));
        wait(() => hits.length === 1, 'first J hits');
        if (count === 2) {
          capture(press('A'));
          wait(() => hits.length === 2, 'second J hits');
        }
        capture(vertical('A', -1));
        wait(() => target.launched, 'W+J interrupts the landed normal into a launcher');
        assert.equal(hits.length, count + 1);
        capture(press('jump'));
        wait(() => fighter.ground === null, 'K cancels the landed launcher');
        capture({ ...press('A'), x: fighter.facing });
        wait(() => hits.length === count + 2, 'air J reaches the suspended opponent');
        assert.equal(entry.fighter.actions.find(action => action.id === hits.at(-1).actionId).posture, 'air');
      }
    }
  }
});

test('production O and W+O consult the current stock and S+O never spends an unbound stock', () => {
  for (const entry of production) {
    for (const seat of [0, 1]) {
      for (const [direction, y, cost] of [[undefined, 0, MAX_ENERGY], ['up', -1, ENERGY_PER_STOCK], ['down', 1, 0]]) {
        for (const energy of [0, 100, 200, 300]) {
          const fighters = seat === 0 ? [entry, dummy] : [dummy, entry];
          const { config, state } = match(fighters, 600);
          const fighter = state.fighters[seat];
          fighter.energy = energy;
          const frozen = structuredClone(state);
          const availability = ultimateAvailability(state, config, seat, direction);
          assert.deepEqual(state, frozen);
          assert.equal(availability.cost, cost);
          const command = vertical('ULT', y);
          const events = step(state, seat === 0 ? [command, NEUTRAL] : [NEUTRAL, command], config);
          assert.equal(fighter.energy, cost && energy >= cost ? energy - cost : energy);
          if (!cost) assert.equal(events.find(event => event.source === seat)?.ultimateReason, 'unbound');
          else if (energy < cost) assert.equal(availability.reason, 'energy');
          else {
            assert.equal(availability.reason, undefined);
            assert.equal(fighter.attack.id, availability.action.id);
            assert.equal(events.filter(event => event.kind === 'ultimate').length, 1);
          }
        }
      }
    }
  }
});

test('a directional launcher cannot fall back to the neutral chain after a whiff', () => {
  for (const entry of production) {
    const { state, config } = match([entry, dummy], 900);
    step(state, [press('A'), NEUTRAL], config);
    const initial = state.fighters[0].attack;
    advance(state, config, 13);
    step(state, [vertical('A', -1), NEUTRAL], config);
    assert.equal(state.fighters[0].attack, initial);
    assert.equal(initial.queuedChain, undefined);
  }
});

test('exclusive entrances clash at equal cost and the higher stock wins symmetrically', () => {
  for (const first of production) {
    for (const second of production) {
      const mirror = match([first, second], 900);
      mirror.state.fighters.forEach(fighter => { fighter.energy = MAX_ENERGY; });
      const clash = step(mirror.state, [press('ULT'), press('ULT')], mirror.config);
      assert.deepEqual(clash.map(event => event.ultimateReason), ['contested', 'contested']);
      assert.deepEqual(mirror.state.fighters.map(fighter => fighter.energy), [MAX_ENERGY, MAX_ENERGY]);
      assert.deepEqual(mirror.state.fighters.map(fighter => fighter.attack), [null, null]);
    }
  }
  for (const seat of [0, 1]) {
    const { state, config } = match(seat === 0 ? [whale, banana] : [banana, whale], 900);
    state.fighters.forEach(fighter => { fighter.energy = MAX_ENERGY; });
    const actions = [vertical('ULT', -1), vertical('ULT', -1)];
    actions[seat] = press('ULT');
    const events = step(state, actions, config);
    assert.equal(events.find(event => event.kind === 'ultimate').source, seat);
    assert.equal(events.find(event => event.ultimateReason === 'contested').source, 1 - seat);
    assert.equal(state.fighters[seat].energy, 0);
    assert.equal(state.fighters[1 - seat].energy, MAX_ENERGY);
  }
  const { state, config } = match([frog, gaga], 600);
  state.fighters.forEach(fighter => { fighter.energy = ENERGY_PER_STOCK; });
  const events = step(state, [vertical('ULT', -1), vertical('ULT', -1)], config);
  assert.deepEqual(events.filter(event => event.kind === 'ultimate').map(event => event.source), [0, 1]);
  assert.deepEqual(state.fighters.map(fighter => fighter.energy), [0, 0]);
});

test('each one-stock ultimate threatens close range, can be blocked and keeps its cost on a miss', () => {
  for (const entry of production) {
    for (const [distance, defense, outcome] of [[84, NEUTRAL, 'hit'], [84, guard, 'block'], [650, NEUTRAL, undefined]]) {
      const { state, config } = match([entry, dummy], distance);
      const caster = state.fighters[0];
      caster.energy = ENERGY_PER_STOCK;
      const action = ultimateAvailability(state, config, 0, 'up').action;
      const start = step(state, [vertical('ULT', -1), defense], config);
      assert.ok(start.some(event => event.kind === 'ultimate' && event.actionId === action.id));
      const events = advance(state, config, 45, [NEUTRAL, defense]);
      assert.equal(events.find(event => event.kind === 'hit' || event.kind === 'block')?.kind, outcome, entry.fighter.id);
      assert.equal(caster.energy, 0, entry.fighter.id);
    }
  }
});

test('clearing pending controls preserves the current strike without playing its queued follow-up', () => {
  const { state, config } = match([gaga, dummy], 500);
  step(state, [press('A'), NEUTRAL], config);
  step(state, [press('A'), NEUTRAL], config);
  const fighter = state.fighters[0];
  const started = fighter.attack.id;
  assert.equal(fighter.attack.queuedChain[0], gagaActionIds.backhand);
  fighter.pendingCounter = gagaActionIds.backhand;
  clearBufferedInputs(state);
  assert.equal(fighter.attack.id, started);
  assert.equal(fighter.pendingCounter, undefined);
  assert.deepEqual(fighter.buffer, []);
  assert.equal(fighter.attack.queuedChain, undefined);
  assert.ok(!advance(state, config, 35).some(event => event.actionId === gagaActionIds.backhand));
});

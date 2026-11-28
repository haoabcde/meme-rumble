import assert from 'node:assert/strict';
import test from 'node:test';
import { arenas } from '../dist/content/arenas.js';
import { rules, testFighter } from '../dist/content/demo.js';
import { banana } from '../dist/content/fighters/banana.js';
import { frog } from '../dist/content/fighters/frog.js';
import { gaga, gagaActionIds } from '../dist/content/fighters/gaga.js';
import { whale } from '../dist/content/fighters/whale.js';
import { createMatch, step } from '../dist/core/match.js';
import { createRelayMatch, stepRelayMatch } from '../dist/core/relay.js';
import { MAX_ENERGY, NEUTRAL } from '../dist/core/types.js';
import { cpuInput } from '../dist/web/cpu.js';

const arena = { ...arenas[0], spawn: [800, 3200], platforms: [] };
const config = { rules, arena, fighters: [testFighter, testFighter], randomSeed: 42 };
const roster = [[banana.fighter, frog.fighter], [whale.fighter, gaga.fighter]];
const neutral = [NEUTRAL, NEUTRAL];
const press = (key, x = 0) => ({ ...NEUTRAL, x, pressed: [key] });

function advanceUntil(session, predicate, limit = 240, inputs = neutral) {
  const events = [];
  for (let tick = 0; tick < limit && !predicate(); tick++) {
    events.push(...stepRelayMatch(session, inputs));
  }
  assert.ok(predicate(), 'Expected the relay transition before the tick limit');
  return events;
}

function readyToFight(session, inputs = neutral) {
  return advanceUntil(session, () => session.state.phase === 'fight', 120, inputs);
}

function finishPresentation(session) {
  const bout = session.state;
  return advanceUntil(session, () => session.state !== bout || session.phase === 'finished');
}

function knockout(session, seat) {
  session.state.fighters[seat].hp = 0;
  stepRelayMatch(session, neutral);
  assert.equal(session.state.phase, 'round-over');
}

function closeDistance(session) {
  const [a, b] = session.state.fighters;
  a.x = 1500;
  b.x = 1590;
}

test('relay requires two different fighters on each team and allows fully mirrored teams', () => {
  const [first, second] = roster;
  assert.throws(() => createRelayMatch(config, [[first[0], { ...first[0] }], second]));
  assert.throws(() => createRelayMatch(config, [first, [second[0], second[0]]]));
  assert.throws(() => createRelayMatch(config, [first]), /two distinct fighters/);
  assert.throws(() => createRelayMatch(config, [first, [...second, first[0]]]), /two distinct fighters/);
  assert.throws(() => createRelayMatch({ ...config, training: true }, roster), /do not support training/);
  const session = createRelayMatch(config, [first, [...first]]);
  assert.deepEqual(session.indices, [0, 0]);
  assert.deepEqual(session.eliminated, [0, 0]);
  assert.deepEqual(session.config.fighters, [first[0], first[0]]);
  assert.equal(session.generation, 0);
  assert.equal(rules.winsToFinish, 2);
});

test('the losing team changes after KO presentation and both fighters restart from clean spawn state', () => {
  const session = createRelayMatch(config, roster);
  readyToFight(session);
  closeDistance(session);
  const bout = session.state;
  const [survivor, loser] = bout.fighters;
  Object.assign(survivor, { hp: 432, energy: 157, tearUnits: 2441, guard: 31 });
  loser.hp = 1;
  stepRelayMatch(session, [press('A'), NEUTRAL]);
  const events = advanceUntil(session, () => bout.phase === 'round-over', 32);
  assert.ok(events.some(event => event.kind === 'hit' && event.source === 0));
  assert.ok(events.some(event => event.kind === 'ko' && event.source === 0));
  assert.equal(session.state, bout);
  assert.equal(session.generation, 0);
  assert.deepEqual(session.indices, [0, 0]);
  assert.deepEqual(session.config.fighters.map(fighter => fighter.id), ['banana', 'whale']);

  // Emulate transient stance and input data left by either kit at the transition boundary.
  for (const fighter of bout.fighters) {
    Object.assign(fighter, {
      ascendUntil: 990, slow: 18, bindUntil: 900, hitstun: 27, blockstun: 4,
      guarding: true, guardWait: 30, guardBreak: 5, combo: 3, dashActive: true,
      pendingCounter: 'queued-counter', frogWarps: [{ tick: 9 }],
      buffer: [{ key: 'A', remaining: 2 }]
    });
  }
  const carried = { hp: survivor.hp, energy: survivor.energy, tearUnits: survivor.tearUnits };
  const deployDuringPresentation = [press('C'), press('A')];
  stepRelayMatch(session, deployDuringPresentation);
  assert.equal(session.state, bout);
  assert.equal(session.generation, 0);
  finishPresentation(session);

  assert.equal(session.generation, 1);
  assert.deepEqual(session.indices, [0, 1]);
  assert.deepEqual(session.eliminated, [0, 1]);
  assert.deepEqual(session.history, [{
    fighters: ['banana', 'whale'], indices: [0, 0], result: { winner: 0, reason: 'ko' }
  }]);
  assert.deepEqual(session.config.fighters.map(fighter => fighter.id), ['banana', 'gaga']);

  const fresh = createMatch(session.config);
  assert.notEqual(session.state.fighters[0], survivor);
  assert.notEqual(session.state.fighters[1], loser);
  assert.deepEqual(session.state.fighters, [{ ...fresh.fighters[0], ...carried }, fresh.fighters[1]]);
  const [nextSurvivor, incoming] = session.state.fighters;
  survivor.buffer.push({ key: 'jump' });
  bout.result.winner = 1;
  assert.deepEqual(session.history[0].result, { winner: 0, reason: 'ko' });
  assert.deepEqual(nextSurvivor.buffer, []);
  assert.deepEqual(incoming.buffer, []);
  assert.equal(incoming.hp, gaga.fighter.maxHp);
  assert.equal(session.state.phase, 'ready');

  const beforeReady = structuredClone(session.state.fighters);
  assert.deepEqual(readyToFight(session, [press('A', 1), press('C', -1)]), []);
  assert.deepEqual(session.state.fighters, beforeReady);
  assert.equal(session.state.remaining, fresh.remaining);
  stepRelayMatch(session, neutral);
  assert.ok(session.state.fighters.every(fighter => fighter.attack === null));
  stepRelayMatch(session, [press('A'), NEUTRAL]);
  assert.ok(nextSurvivor.attack);
});

test('three bouts can eliminate both members of one team and a rematch starts fresh', () => {
  const session = createRelayMatch(config, roster);
  readyToFight(session);
  knockout(session, 0);
  finishPresentation(session);
  assert.deepEqual(session.indices, [1, 0]);

  readyToFight(session);
  knockout(session, 1);
  finishPresentation(session);
  assert.deepEqual(session.indices, [1, 1]);

  readyToFight(session);
  knockout(session, 1);
  finishPresentation(session);
  assert.equal(session.phase, 'finished');
  assert.equal(session.winner, 0);
  assert.equal(session.state.phase, 'match-over');
  assert.deepEqual(session.eliminated, [1, 2]);
  assert.equal(session.generation, 2);
  assert.deepEqual(session.history.map(bout => bout.fighters), [
    ['banana', 'whale'], ['frog', 'whale'], ['frog', 'gaga']
  ]);
  const terminal = structuredClone(session);
  assert.deepEqual(stepRelayMatch(session, [press('A'), press('A')]), []);
  assert.deepEqual(session, terminal);

  const rematch = createRelayMatch(config, session.teams);
  assert.deepEqual(rematch, createRelayMatch(config, roster));
  assert.notEqual(rematch.state, session.state);
  assert.deepEqual(rematch.history, []);
  assert.deepEqual(rematch.state.fighters.map(fighter => fighter.hp), [
    banana.fighter.maxHp, whale.fighter.maxHp
  ]);
});

test('same-tick hits eliminate both active fighters and a second double KO ends in a draw', () => {
  const teams = [
    [testFighter, { ...testFighter, id: 'reserve-a' }],
    [testFighter, { ...testFighter, id: 'reserve-b' }]
  ];
  const session = createRelayMatch(config, teams);
  for (const index of [0, 1]) {
    readyToFight(session);
    closeDistance(session);
    for (const fighter of session.state.fighters) fighter.hp = 100;
    stepRelayMatch(session, [press('A'), press('A')]);
    const events = advanceUntil(session, () => session.state.phase === 'round-over', 10);
    assert.deepEqual(events.map(event => event.kind), ['hit', 'hit', 'ko']);
    assert.deepEqual(session.state.result, { winner: null, reason: 'double-ko' });
    finishPresentation(session);
    assert.deepEqual(session.eliminated, [index + 1, index + 1]);
  }
  assert.equal(session.winner, null);
  assert.equal(session.phase, 'finished');
  assert.equal(session.state.phase, 'match-over');
  assert.equal(session.generation, 1);
  assert.deepEqual(session.indices, [1, 1]);
  assert.deepEqual(session.history.map(bout => bout.result.reason), ['double-ko', 'double-ko']);
});

test('a simultaneous elimination can end with one winner if only that team has a reserve', () => {
  for (const reason of ['double-ko', 'tie']) {
    const session = createRelayMatch(config, roster);
    readyToFight(session);
    knockout(session, 0);
    finishPresentation(session);

    readyToFight(session);
    if (reason === 'double-ko') {
      for (const fighter of session.state.fighters) fighter.hp = 0;
    } else {
      session.state.remaining = 1;
    }
    stepRelayMatch(session, neutral);
    assert.deepEqual(session.state.result, { winner: null, reason });
    finishPresentation(session);
    assert.equal(session.phase, 'finished');
    assert.equal(session.winner, 1);
    assert.equal(session.state.winner, null);
    assert.deepEqual(session.eliminated, [2, 1]);
    assert.deepEqual(session.indices, [1, 0]);
    assert.equal(session.generation, 1);
  }
});

test('timeout compares health ratios, exact ties remove both, and each bout gets the selected timer', () => {
  const heavier = { ...testFighter, id: 'heavier', maxHp: 1200 };
  const teams = [[testFighter, frog.fighter], [heavier, banana.fighter]];

  for (const seconds of [30, 60]) {
    const session = createRelayMatch({ ...config, rules: { ...rules, roundSeconds: seconds } }, teams);
    const limit = seconds * rules.ticksPerSecond;
    readyToFight(session);
    assert.equal(session.state.remaining, limit);
    session.state.fighters[0].hp = 400;
    session.state.fighters[1].hp = 450;
    session.state.remaining = 1;
    stepRelayMatch(session, neutral);
    assert.deepEqual(session.state.result, { winner: 0, reason: 'time' });
    finishPresentation(session);
    assert.equal(session.state.remaining, limit);
    assert.deepEqual(session.indices, [0, 1]);
    assert.equal(session.state.fighters[0].hp, 400);
    assert.equal(session.state.fighters[1].tearUnits, createMatch(session.config).fighters[1].tearUnits);
  }

  const tied = createRelayMatch(config, teams);
  readyToFight(tied);
  tied.state.fighters[0].hp = 400;
  tied.state.fighters[1].hp = 480;
  tied.state.remaining = 1;
  stepRelayMatch(tied, neutral);
  assert.deepEqual(tied.state.result, { winner: null, reason: 'tie' });
  finishPresentation(tied);
  assert.deepEqual(tied.indices, [1, 1]);
  assert.deepEqual(tied.eliminated, [1, 1]);
  assert.deepEqual(tied.state.fighters, createMatch(tied.config).fighters);
});

test('cross-kit assets clear on handoff and reserve kits and CPU use the active fighter definitions', () => {
  const session = createRelayMatch(config, [
    [gaga.fighter, banana.fighter], [whale.fighter, frog.fighter]
  ]);
  readyToFight(session);
  session.state.fighters[0].energy = MAX_ENERGY;
  stepRelayMatch(session, [press('C'), NEUTRAL]);
  const turretEvents = advanceUntil(session, () =>
    session.state.projectiles.some(projectile => projectile.actionId === gagaActionIds.turretBolt));
  assert.ok(turretEvents.some(event => event.kind === 'turret-fire' && event.source === 0));
  assert.equal(session.state.turrets.bolt.owner, 0);

  session.state.randomState = 0x6d2b79f5; // Deterministic successful rice throw.
  stepRelayMatch(session, [NEUTRAL, press('B')]);
  advanceUntil(session, () => session.state.entities?.some(entity => entity.owner === 1), 30);
  session.state.fighters[0].energy = MAX_ENERGY;
  const summon = stepRelayMatch(session, [press('ULT'), NEUTRAL]);
  assert.ok(summon.some(event => event.kind === 'summon-start'));
  assert.equal(session.state.summon.phase, 'cut-in');
  const clock = session.state.remaining;
  advanceUntil(session, () => session.state.summon?.phase === 'fall', 60);
  assert.equal(session.state.remaining, clock);
  assert.ok(session.state.turrets.bolt);
  assert.ok(session.state.projectiles.length);
  assert.ok(session.state.entities.length);

  session.state.fighters[1].hp = Math.floor(whale.fighter.maxHp / 2);
  session.state.remaining = 1;
  stepRelayMatch(session, neutral);
  assert.deepEqual(session.state.result, { winner: 0, reason: 'time' });
  finishPresentation(session);
  assert.deepEqual(session.state.projectiles, []);
  assert.deepEqual(session.state.turrets, { bolt: null, howitzer: null });
  assert.equal(session.state.summon, undefined);
  assert.equal(session.state.entities, undefined);
  assert.equal(session.state.nextEntityId, undefined);
  assert.equal(session.state.cutIn, undefined);

  assert.equal(cpuInput(session.state, session.config), NEUTRAL);
  readyToFight(session);
  const incoming = session.state.fighters[1];
  closeDistance(session);
  incoming.energy = MAX_ENERGY;
  const ascension = stepRelayMatch(session, [NEUTRAL, press('ULT')]);
  assert.ok(ascension.some(event => event.actionId === 'frog-ascend'));
  advanceUntil(session, () => incoming.ascendUntil !== undefined);

  knockout(session, 0);
  finishPresentation(session);
  assert.deepEqual(session.config.fighters.map(fighter => fighter.id), ['banana', 'frog']);
  assert.equal(session.state.fighters[1].ascendUntil, undefined);
  assert.equal(session.state.fighters[1].ascendVisual, undefined);
  readyToFight(session);
  stepRelayMatch(session, [press('C'), NEUTRAL]);
  assert.ok(session.state.fighters[0].attack);
  assert.equal(session.state.fighters[1].hp, frog.fighter.maxHp);
});

test('a wave cut-in pauses timeout and the CPU can control its newly active reserve kit', () => {
  const teams = [[banana.fighter, whale.fighter], [gaga.fighter, banana.fighter]];
  const session = createRelayMatch(config, teams);
  readyToFight(session);
  session.state.fighters[0].energy = MAX_ENERGY;
  stepRelayMatch(session, [press('ULT'), NEUTRAL]);
  const events = advanceUntil(session, () => Boolean(session.state.cutIn), 25);
  assert.ok(events.some(event => event.kind === 'wave-cut-in'));
  const current = session.state;
  current.fighters[1].hp = 400;
  current.remaining = 1;

  advanceUntil(session, () => !current.cutIn, 60);
  assert.equal(current.remaining, 1);
  assert.equal(current.phase, 'fight');
  assert.equal(session.generation, 0);
  stepRelayMatch(session, neutral);
  assert.deepEqual(current.result, { winner: 0, reason: 'time' });
  finishPresentation(session);
  assert.equal(session.state.cutIn, undefined);
  assert.deepEqual(session.config.fighters.map(fighter => fighter.id), ['banana', 'banana']);

  readyToFight(session);
  session.state.fighters[1].tearUnits = 0;
  const cpu = cpuInput(session.state, session.config);
  assert.deepEqual(cpu.pressed, ['C']);
  stepRelayMatch(session, [NEUTRAL, cpu]);
  assert.ok(session.state.fighters[1].tearUnits > 0);
});

test('standard 1v1 continues on the first tie and only ends on the second consecutive tie', () => {
  const state = createMatch(config);
  for (const round of [1, 2]) {
    for (let tick = 0; tick < 120; tick++) step(state, neutral, config);
    assert.equal(state.phase, 'fight');
    assert.equal(state.round, round);
    state.remaining = 1;
    step(state, neutral, config);
    assert.deepEqual(state.result, { winner: null, reason: 'tie' });
    for (let tick = 0; tick < 105; tick++) step(state, neutral, config);
    assert.equal(state.draws, round);
    if (round === 1) {
      assert.equal(state.phase, 'ready');
      assert.deepEqual(state.fighters.map(fighter => fighter.x), [...config.arena.spawn].reverse());
    }
  }
  assert.equal(state.phase, 'match-over');
  assert.equal(state.winner, null);
});

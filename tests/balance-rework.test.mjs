import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createMatch, step, ultimateAvailability } from '../dist/core/match.js';
import { arenas } from '../dist/content/arenas.js';
import { rules, testFighter } from '../dist/content/demo.js';
import { banana, bananaActionIds, bananaAdditionalActionIds, BANANA_JO_DURATION } from '../dist/content/fighters/banana.js';
import { frog } from '../dist/content/fighters/frog.js';
import { gaga, gagaActionIds } from '../dist/content/fighters/gaga.js';
import { whale } from '../dist/content/fighters/whale.js';
import {
  LEGACY_ARCHIVE_BASELINE,
  LEGACY_SKILL_SOURCES,
  LEGACY_BANANA_SKILLS,
  LEGACY_FROG_RULES,
  LEGACY_GAGA_SKILLS,
  LEGACY_WHALE_RULES
} from '../dist/content/fighters/legacy-skills.js';
import { FROG_RULES } from '../dist/core/frog-kit.js';
import { ENERGY_PER_STOCK, MAX_ENERGY, NEUTRAL, TEAR_UNITS_PER_POINT } from '../dist/core/types.js';

const press = (key, y = 0, x = 0) => ({ pressed: [key], x, y });
const hold = (key, pressed = [], y = 0, x = 0) => ({ pressed, x, y, held: [key] });
const flatArena = { ...arenas[0], left: 100, right: 3900, width: 4000, height: 1100, floor: 800, spawn: [1200, 1400], platforms: [] };

function makeMatch(fighters, sep = 150) {
  const arena = { ...flatArena, spawn: [1200, 1200 + sep] };
  const config = { rules, arena, fighters };
  const state = createMatch(config);
  state.phase = 'fight';
  state.phaseTicks = 0;
  return { state, config };
}

function advance(state, config, ticks, inputs = [NEUTRAL, NEUTRAL]) {
  const events = [];
  for (let i = 0; i < ticks; i++) events.push(...step(state, inputs, config));
  return events;
}

test('legacy skill archive preserves every pre-rework skill and rule constant', () => {
  assert.equal(LEGACY_ARCHIVE_BASELINE, 'origin/main@871cdb1');
  assert.equal(LEGACY_BANANA_SKILLS.burst1StockUlt.id, bananaAdditionalActionIds.burst);
  assert.equal(LEGACY_BANANA_SKILLS.wave3StockUlt.energyCost, MAX_ENERGY);
  assert.equal(LEGACY_BANANA_SKILLS.theWorldGlobalUlt.startup, 246);
  assert.equal(LEGACY_FROG_RULES.buffTicks, 900);
  assert.equal(LEGACY_WHALE_RULES.guardCounter.whileGuarding, true);
  assert.equal(LEGACY_GAGA_SKILLS.xiraniteGuard.active, 20);
});

test('Banana rework separates skills and ultimates: S+U burst, W+O wave, O timed JO (840f), JO O 2-bar The World', () => {
  const { state, config } = makeMatch([banana.fighter, testFighter], 100);
  const [cat, dummy] = state.fighters;

  // S+U triggers 回身泪爆 using 25 tears and 0 energy.
  const startTears = cat.tearUnits / TEAR_UNITS_PER_POINT;
  step(state, [press('B', 1), NEUTRAL], config);
  assert.equal(cat.attack.id, bananaAdditionalActionIds.burst);
  assert.equal(cat.tearUnits / TEAR_UNITS_PER_POINT, startTears - 25);
  assert.equal(cat.energy, 0);
  advance(state, config, 35);

  // W+O costs 1 stock for 泪海滔天.
  cat.energy = ENERGY_PER_STOCK;
  const wo = ultimateAvailability(state, config, 0, 'up');
  assert.equal(wo.action.id, bananaActionIds.wave);
  assert.equal(wo.cost, ENERGY_PER_STOCK);
  step(state, [press('ULT', -1), NEUTRAL], config);
  assert.equal(cat.energy, 0);
  advance(state, config, 90);
  dummy.recovery = null;
  dummy.hitstun = 0;

  // O costs 3 stocks for JO化觉醒, which expires after BANANA_JO_DURATION (840) arena ticks.
  cat.energy = MAX_ENERGY;
  const oNormal = ultimateAvailability(state, config, 0);
  assert.equal(oNormal.action.id, bananaActionIds.joAwaken);
  assert.equal(oNormal.cost, MAX_ENERGY);
  step(state, [press('ULT'), NEUTRAL], config);
  advance(state, config, 95);
  assert.equal(cat.joAwakened, true);
  assert.ok(cat.joUntil > state.arenaFrame);

  // While JO is active, O swaps to The World (2 stocks) and respects 380 range.
  const oJo = ultimateAvailability(state, config, 0);
  assert.equal(oJo.action.id, bananaActionIds.theWorld);
  assert.equal(oJo.cost, 2 * ENERGY_PER_STOCK);

  // Out of 380 range: whiffs cleanly without freezing opponent.
  cat.energy = 2 * ENERGY_PER_STOCK;
  dummy.x = cat.x + 600;
  const missEvents = step(state, [press('ULT'), NEUTRAL], config);
  assert.equal(state.timeStop, undefined);
  assert.ok(missEvents.some(e => e.kind === 'whiff'));
  assert.equal(cat.energy, 0);
  advance(state, config, 30);

  // Respects knockdown/rise protection: The World never strips opp.recovery!
  cat.energy = 2 * ENERGY_PER_STOCK;
  dummy.x = cat.x + 250;
  dummy.recovery = { phase: 'down', remaining: 25 };
  step(state, [press('ULT'), NEUTRAL], config);
  assert.equal(state.timeStop, undefined);
  assert.equal(dummy.recovery.phase, 'down');

  // JO expires cleanly after BANANA_JO_DURATION arena ticks.
  advance(state, config, BANANA_JO_DURATION);
  assert.equal(cat.joAwakened, false);
  assert.equal(cat.joUntil, undefined);
});

test('Banana KQ bomb detonate respects 900 range and can be blocked frontally', () => {
  const { state, config } = makeMatch([banana.fighter, testFighter], 180);
  const [cat, dummy] = state.fighters;
  cat.joAwakened = true;
  dummy.bombMark = { source: 0, remaining: 120 };
  const blockedEvents = [
    ...step(state, [press('C'), { pressed: [], x: 0, y: 1 }], config),
    ...advance(state, config, 20, [NEUTRAL, { pressed: [], x: 0, y: 1 }])
  ];
  assert.ok(blockedEvents.some(e => e.kind === 'block'));
  assert.equal(dummy.hp, 1000);

  // Beyond 900 range: bomb mark expires without global hit.
  dummy.x = cat.x + 1100;
  dummy.bombMark = { source: 0, remaining: 120 };
  const farEvents = [
    ...step(state, [press('C'), NEUTRAL], config),
    ...advance(state, config, 12)
  ];
  assert.equal(farEvents.some(e => e.kind === 'hit'), false);
  assert.equal(dummy.bombMark, undefined);
});

test('all zone-control objects have numeric HP and can be destroyed without harming the attacker', () => {
  // 1. Power Pylon (110 HP)
  {
    const { state, config } = makeMatch([gaga.fighter, testFighter], 180);
    const [engineer, attacker] = state.fighters;
    step(state, [press('C', -1), NEUTRAL], config);
    advance(state, config, 20);
    assert.ok(state.powerPylons[0]);
    assert.equal(state.powerPylons[0].hp, 110);
    assert.equal(state.powerPylons[0].maxHp, 110);
    attacker.x = state.powerPylons[0].x + 50;
    attacker.facing = -1;
    engineer.x = 800; // Keep engineer clear of attacker melee reach while attacking pylon.
    step(state, [NEUTRAL, press('A')], config);
    advance(state, config, 25);
    assert.equal(state.powerPylons[0].hp, 10);
    step(state, [NEUTRAL, press('A')], config);
    const ev = advance(state, config, 25);
    assert.equal(state.powerPylons[0], null);
    assert.ok(ev.some(e => e.kind === 'pylon-expire'));
    assert.equal(engineer.hp, 1000);
  }

  // 2. Sheer Heart Attack (90 HP) & KQ Orb (45 HP)
  {
    const { state, config } = makeMatch([banana.fighter, testFighter], 180);
    const [cat, attacker] = state.fighters;
    cat.joAwakened = true;
    step(state, [press('B'), NEUTRAL], config);
    advance(state, config, 7);
    const tank = state.projectiles.find(p => p.actionId === bananaActionIds.joSheerHeart);
    assert.ok(tank);
    assert.equal(tank.hp, 90);
    cat.x = 800; // Keep cat clear while attacker breaks the tank.
    attacker.x = tank.x + 55;
    attacker.facing = -1;
    step(state, [NEUTRAL, press('A')], config);
    advance(state, config, 12);
    assert.equal(state.projectiles.length, 0);
    assert.equal(attacker.hp, 1000);

    // KQ Orb (45 HP)
    step(state, [press('C'), NEUTRAL], config);
    advance(state, config, 7);
    const orb = state.projectiles.find(p => p.actionId === bananaActionIds.kqBomb);
    assert.ok(orb);
    assert.equal(orb.hp, 45);
    attacker.x = orb.x + 145;
    attacker.y = orb.y + 70;
    attacker.facing = -1;
    step(state, [NEUTRAL, press('A')], config);
    advance(state, config, 12);
    assert.equal(state.projectiles.length, 0);
    assert.equal(attacker.hp, 1000);
  }

  // 3. Grounded Rice Trap (40 HP)
  {
    const { state, config } = makeMatch([whale.fighter, testFighter], 900);
    const [, attacker] = state.fighters;
    state.randomState = 0x6d2b79f5; // Ensure rice throw succeeds rather than self-eat.
    step(state, [press('B'), NEUTRAL], config);
    advance(state, config, 45);
    const rice = state.entities?.find(e => e.definition.behavior === 'rice' && e.grounded);
    assert.ok(rice);
    assert.equal(rice.hp, 40);
    assert.equal(rice.maxHp, 40);
    attacker.x = rice.x + 75;
    attacker.facing = -1;
    step(state, [NEUTRAL, press('A')], config);
    advance(state, config, 12);
    assert.equal(state.entities?.some(e => e.id === rice.id) ?? false, false);
    assert.equal(attacker.bindUntil, undefined);
  }
});

test('Gaga cooldowns and blockable range-limited crystal shatter work deterministically', () => {
  const { state, config } = makeMatch([gaga.fighter, testFighter], 180);
  const [engineer, dummy] = state.fighters;

  // Turret cooldown (180 frames)
  dummy.x = 2000;
  step(state, [press('C'), NEUTRAL], config);
  advance(state, config, 45);
  const refused = step(state, [press('C'), NEUTRAL], config);
  assert.ok(refused.some(e => e.kind === 'skill-unavailable'));
  assert.equal(engineer.attack, null);

  // Crystal shatter is blockable and capped at 900 units.
  dummy.x = engineer.x + 150;
  dummy.crystalMark = { source: 0, remaining: 120 };
  const blockEvents = [
    ...step(state, [press('B', -1), { pressed: [], x: 0, y: 1 }], config),
    ...advance(state, config, 12, [NEUTRAL, { pressed: [], x: 0, y: 1 }])
  ];
  assert.ok(blockEvents.some(e => e.kind === 'block'));
  assert.equal(dummy.hp, 1000);

  // Snapshot replay remains identical across new cooldowns and destructible objects.
  const clone = structuredClone(state);
  for (let i = 0; i < 60; i++) {
    assert.deepEqual(step(state, [NEUTRAL, NEUTRAL], config), step(clone, [NEUTRAL, NEUTRAL], config));
    assert.deepEqual(state, clone);
  }
});

test('Frog crouch early release forces 14f recovery and 90f cooldown', () => {
  const { state, config } = makeMatch([frog.fighter, testFighter], 180);
  const [naiva] = state.fighters;
  step(state, [hold('C', ['C']), NEUTRAL], config);
  advance(state, config, 5, [hold('C'), NEUTRAL]);
  // Release C early -> jumps directly to recovery frame 38 and enters 14f recovery.
  step(state, [NEUTRAL, NEUTRAL], config);
  assert.equal(naiva.attack?.id, 'frog-crouch');
  assert.equal(naiva.attack.frame, 39);
  assert.ok(naiva.frogCrouchCooldownUntil > state.arenaFrame);
  advance(state, config, 13);
  assert.equal(naiva.attack, null);

  // Cannot immediately re-crouch during 90f cooldown.
  const refused = step(state, [hold('C', ['C']), NEUTRAL], config);
  assert.ok(refused.some(e => e.kind === 'skill-unavailable'));
  assert.equal(naiva.attack, null);
});

test('all four down+A breakers actually damage and break a guarding opponent', () => {
  for (const fighter of [banana.fighter, frog.fighter, gaga.fighter, whale.fighter]) {
    const { state, config } = makeMatch([fighter, testFighter], 85);
    const [attacker, target] = state.fighters;
    const guard = { pressed: [], x: 0, y: 1 };
    const action = fighter.actions.find(move => move.guardBreaker && move.direction === 'down' && !move.linkOnly);
    assert.ok(action, fighter.id);
    step(state, [press('A', 1), guard], config);
    assert.equal(attacker.attack?.id, action.id, fighter.id);
    const events = advance(state, config, 25, [NEUTRAL, guard]);
    assert.ok(events.some(event => event.kind === 'break'), fighter.id);
    assert.ok(events.some(event => event.kind === 'hit'), fighter.id);
    assert.ok(target.hp < testFighter.maxHp, fighter.id);
    assert.ok(target.guardBreak > 0, fighter.id);
  }
});

test('air jump and air dash can each be used once in either order and reset on landing', () => {
  for (const first of ['jump', 'dash']) {
    const { state, config } = makeMatch([banana.fighter, testFighter], 1000);
    const fighter = state.fighters[0];
    step(state, [press('jump'), NEUTRAL], config);
    const firstEvents = step(state, [press(first), NEUTRAL], config);
    assert.ok(firstEvents.some(e => e.kind === (first === 'jump' ? 'air-jump' : 'dash')));
    if (first === 'dash') advance(state, config, 7);
    const second = first === 'jump' ? 'dash' : 'jump';
    const secondEvents = step(state, [press(second), NEUTRAL], config);
    assert.ok(secondEvents.some(e => e.kind === (second === 'jump' ? 'air-jump' : 'dash')));
    assert.equal(fighter.airJumpUsed, true);
    assert.equal(fighter.airDashUsed, true);
    advance(state, config, 120);
    assert.ok(fighter.ground);
    assert.equal(fighter.airJumpUsed, false);
    assert.equal(fighter.airDashUsed, false);
  }
});

test('a landed normal can cancel into dash; a whiff cannot', () => {
  for (const landed of [false, true]) {
    const { state, config } = makeMatch([frog.fighter, testFighter], landed ? 85 : 900);
    const attacker = state.fighters[0];
    step(state, [press('A'), NEUTRAL], config);
    advance(state, config, 9);
    assert.equal(attacker.attack?.landed, landed);
    const events = step(state, [press('dash', 0, 1), NEUTRAL], config);
    assert.equal(events.some(event => event.kind === 'dash'), landed);
    if (landed) assert.equal(attacker.attack, null);
  }
});

test('whale mana gates tornado and eating rice restores mana deterministically', () => {
  const { state, config } = makeMatch([whale.fighter, testFighter], 900);
  const whaleState = state.fighters[0];
  whaleState.whaleMana = 0;
  const denied = step(state, [press('B', 1), NEUTRAL], config);
  assert.ok(denied.some(event => event.kind === 'skill-unavailable'));
  assert.equal(whaleState.attack, null);
  state.randomState = 42; // First deterministic roll selects the eat outcome.
  step(state, [press('B'), NEUTRAL], config);
  assert.equal(whaleState.attack?.id, 'whale-eat');
  assert.equal(whaleState.whaleMana, 25);
});

test('rebound directional skills select the same actions on both sides', () => {
  const cases = [
    [gaga.fighter, 'B', 1, 'gaga-ground-pole-throw'],
    [gaga.fighter, 'C', 1, 'gaga-xiranite-guard'],
    [whale.fighter, 'B', 1, 'tornado'],
    [whale.fighter, 'C', -1, 'tornado-up']
  ];
  for (const [fighter, key, y, expected] of cases) {
    for (const seat of [0, 1]) {
      const fighters = seat === 0 ? [fighter, testFighter] : [testFighter, fighter];
      const { state, config } = makeMatch(fighters, 600);
      const commands = [NEUTRAL, NEUTRAL];
      commands[seat] = press(key, y);
      step(state, commands, config);
      assert.equal(state.fighters[seat].attack?.id, expected, `${fighter.id}, seat ${seat}`);
    }
  }
});

test('each guard breaker defeats an active Frog, Whale and Gaga counter without a parry', () => {
  const opponents = [
    [frog.fighter, hold('C', ['C']), hold('C'), 'frog-crouch'],
    [whale.fighter, { pressed: [], x: 0, y: 1 }, { pressed: [], x: 0, y: 1 }, null],
    [gaga.fighter, press('C', 1), NEUTRAL, 'gaga-xiranite-guard']
  ];
  for (const attackerDefinition of [banana.fighter, frog.fighter, gaga.fighter, whale.fighter]) {
    for (const [defenderDefinition, startCounter, maintainCounter, counterId] of opponents) {
      const label = `${attackerDefinition.id} vs ${defenderDefinition.id}`;
      const { state, config } = makeMatch([attackerDefinition, defenderDefinition], 85);
      const [attacker, defender] = state.fighters;
      step(state, [press('A', 1), NEUTRAL], config);
      advance(state, config, 9);
      step(state, [NEUTRAL, startCounter], config);
      step(state, [NEUTRAL, maintainCounter], config);
      if (counterId) assert.equal(defender.attack?.id, counterId, label);
      else assert.ok(defender.guardCounterLeft > 0, label);
      const events = advance(state, config, 8, [NEUTRAL, maintainCounter]);
      assert.ok(events.some(event => event.kind === 'hit'), label);
      assert.ok(events.some(event => event.kind === 'break'), label);
      assert.equal(events.some(event => event.kind === 'parry'), false, label);
      assert.ok(defender.hp < defenderDefinition.maxHp, label);
      assert.equal(attacker.attack?.landed, true, label);
    }
  }
});

test('whale recovers precisely 30 mana by collecting its own grounded rice', () => {
  const { state, config } = makeMatch([whale.fighter, testFighter], 900);
  const caster = state.fighters[0];
  caster.whaleMana = 10;
  state.randomState = 0x6d2b79f5;
  step(state, [press('B'), NEUTRAL], config);
  advance(state, config, 45);
  const rice = state.entities.find(entity => entity.definition.behavior === 'rice' && entity.grounded);
  assert.ok(rice);
  caster.whaleMana = 10;
  caster.x = rice.x;
  step(state, [NEUTRAL, NEUTRAL], config);
  assert.equal(caster.whaleMana, 40);
  assert.equal(state.entities.some(entity => entity.id === rice.id), false);
});

test('whale pays exact mana costs for each tornado and gains eight on a landed tail', () => {
  for (const [key, direction, action, cost] of [['B', 1, 'tornado', 30], ['C', -1, 'tornado-up', 35]]) {
    const { state, config } = makeMatch([whale.fighter, testFighter], 900);
    state.fighters[0].whaleMana = 80;
    step(state, [press(key, direction), NEUTRAL], config);
    assert.equal(state.fighters[0].attack?.id, action);
    assert.equal(state.fighters[0].whaleMana, 80 - cost);
  }
  const { state, config } = makeMatch([whale.fighter, testFighter], 85);
  state.fighters[0].whaleMana = 20;
  step(state, [press('A'), NEUTRAL], config);
  const events = advance(state, config, 10);
  assert.ok(events.some(event => event.kind === 'hit' && event.actionId === 'common-jab'));
  assert.equal(state.fighters[0].whaleMana, 28);
});

test('active character actions contain no forward or back directional binding', () => {
  for (const fighter of [banana.fighter, frog.fighter, gaga.fighter, whale.fighter]) {
    for (const action of fighter.actions) {
      assert.ok(!['forward', 'back'].includes(action.direction), `${fighter.id}: ${action.id}`);
    }
  }
});

test('complete baseline skill source archive matches the original commit byte for byte', () => {
  const expected = {
    'src/content/fighters/banana.ts': 'e86b04cca3e048c98abb91f89ee3f8a7f93a680ba57e96ce44da84d32205ab73',
    'src/content/fighters/frog.ts': '354a21801a76fa10c5b9af35e3736ae077bb4e391ef024ee9a281dc455f4a17e',
    'src/content/fighters/gaga.ts': '98afbd7b9260f0d380ac3b8b6750354f6dbb6414cd6d9cb6570c58423853ce3b',
    'src/content/fighters/whale.ts': 'b4adde93556c308c7aa5e5077c3a007cf61ae4013cab562cd4c2ea59740adc41',
    'src/content/fighter-kit.ts': '33f88e31eaa31c2c982d1a1953225ca88e8d0309bc5e45dc3f81257b854787d5'
  };
  assert.deepEqual(Object.keys(LEGACY_SKILL_SOURCES).sort(), Object.keys(expected).sort());
  for (const [path, hash] of Object.entries(expected)) {
    const archived = LEGACY_SKILL_SOURCES[path];
    assert.equal(createHash('sha256').update(archived.baseline).digest('hex'), hash, path);
    assert.ok(archived.beforeRework.length > 1000, path);
  }
});

test('S+K on a platform drops through without starting a guard breaker', () => {
  const platform = { id: 'test-ledge', name: '测试平台', tier: 1, left: 1000, right: 1500, y: 680 };
  for (const fighterDefinition of [banana.fighter, frog.fighter, gaga.fighter, whale.fighter]) {
    for (const seat of [0, 1]) {
      const fighters = seat === 0 ? [fighterDefinition, testFighter] : [testFighter, fighterDefinition];
      const { state, config } = makeMatch(fighters, 600);
      config.arena.platforms = [platform];
      const fighter = state.fighters[seat];
      Object.assign(fighter, { x: 1250, y: platform.y, ground: platform.id });
      const inputs = [NEUTRAL, NEUTRAL];
      inputs[seat] = press('jump', 1);
      const events = step(state, inputs, config);
      assert.ok(events.some(event => event.kind === 'drop' && event.source === seat), `${fighterDefinition.id} seat ${seat}`);
      assert.equal(fighter.attack, null);
      assert.equal(fighter.ground, null);
      assert.equal(fighter.ignorePlatform, platform.id);
      advance(state, config, 20);
      assert.equal(fighter.attack, null);
      assert.ok(fighter.y > platform.y);
    }
  }
});

test('releasing S discards buffered S+J and S+U, while held S still executes them', () => {
  const cases = [
    [banana.fighter, 'A', bananaActionIds.slide],
    [gaga.fighter, 'B', gagaActionIds.groundThrow]
  ];
  for (const [definition, key, expected] of cases) {
    for (const release of [false, true]) {
      const { state, config } = makeMatch([definition, testFighter], 900);
      const fighter = state.fighters[0];
      fighter.hitstun = 3;
      step(state, [press(key, 1), NEUTRAL], config);
      assert.ok(fighter.buffer.some(command => command.key === key && command.down), `${key} was buffered`);
      const follow = release ? NEUTRAL : { pressed: [], x: 0, y: 1 };
      const seen = [];
      for (let frame = 0; frame < 8; frame++) {
        step(state, [follow, NEUTRAL], config);
        if (fighter.attack) seen.push(fighter.attack.id);
      }
      if (release) {
        assert.ok(!fighter.buffer.some(command => command.key === key && command.down));
        assert.deepEqual(seen, []);
        step(state, [press(key, 1), NEUTRAL], config);
        assert.equal(fighter.attack?.id, expected, `${key} remains usable after release`);
      } else {
        assert.ok(seen.includes(expected), `${key} executes while S remains held`);
      }
    }
  }
});

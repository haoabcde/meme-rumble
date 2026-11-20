import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { arenas } from '../dist/content/arenas.js';
import { rules, testFighter } from '../dist/content/demo.js';
import { basicAttack, defineFighter } from '../dist/content/fighter-kit.js';
import { createMatch, step } from '../dist/core/match.js';
import { NEUTRAL } from '../dist/core/types.js';
import { embedFighterImages } from '../scripts/fighter-art.mjs';

const empty = {
  id: 'fixture', name: '接入测试', accent: '#fff', height: 144,
  art: { portrait: 'portrait.webp', motion: 'motion.webp' }, signatureMoves: []
};
const probeB = { ...testFighter.actions.find(move => move.slot === 'B'), direction: 'forward', posture: 'ground' };
const probeC = { ...testFighter.actions.find(move => move.slot === 'C'), linkOnly: true };
const authored = defineFighter({
  ...empty, stats: { maxHp: 1240 }, signatureMoves: [probeB, probeC],
  extraCancels: { 'common-jab': [probeC.id] }
});
const dummy = defineFighter({ ...empty, id: 'target' });

function opening(seat, entry = authored) {
  const fighters = [dummy.fighter, dummy.fighter];
  fighters[seat] = entry.fighter;
  const config = { rules, arena: arenas[0], training: true, fighters };
  const state = createMatch(config);
  state.phase = 'fight';
  state.fighters[0].x = 1800;
  state.fighters[1].x = 1890;
  function tick(pressed = [], x = 0, y = 0, guard = false) {
    const inputs = [NEUTRAL, NEUTRAL];
    inputs[seat] = { pressed, x, y };
    if (guard) inputs[1 - seat] = { ...NEUTRAL, y: 1 };
    return step(state, inputs, config);
  }
  return { state, config, tick, player: state.fighters[seat], target: state.fighters[1 - seat] };
}

test('a registered directional B starts and hits from either seat with character-specific stats', () => {
  for (const seat of [0, 1]) {
    const { player, target, tick } = opening(seat);
    assert.equal(player.hp, 1240);
    const forward = player.facing;
    tick(['B'], -forward);
    assert.equal(player.attack, null);
    tick(['B'], forward);
    assert.equal(player.attack.id, probeB.id);
    let hit;
    for (let n = 0; !hit && n < probeB.startup + probeB.active; n++) {
      hit = tick().find(event => event.kind === 'hit');
    }
    assert.equal(hit?.amount, probeB.damage);
    assert.equal(target.hp, dummy.fighter.maxHp - probeB.damage);
    const airborne = opening(seat);
    airborne.tick(['jump']);
    airborne.tick(['B'], forward);
    assert.equal(airborne.player.attack, null);
  }
});

test('a package can extend a public hit confirm without changing the other fighter or enabling it on block', () => {
  assert.ok(!dummy.fighter.actions.find(m => m.id === basicAttack.id).cancelOnHit.includes(probeC.id));
  for (const guard of [false, true]) {
    const { player, tick } = opening(0);
    tick(['C']);
    assert.equal(player.attack, null);
    tick(['A']);
    for (let n = 0; n < basicAttack.startup; n++) tick([], 0, 0, guard);
    assert.equal(player.attack.landed, !guard);
    tick(['C'], 0, 0, guard);
    for (let n = 0; n < basicAttack.stop; n++) tick([], 0, 0, guard);
    assert.equal(player.attack.id, guard ? basicAttack.id : probeC.id);
  }
});

test('an invalid action id, timing, animation key or cancel is reported with the offending package', () => {
  for (const move of [
    { ...probeB, id: basicAttack.id }, { ...probeB, active: 0 },
    { ...probeB, cancelOnHit: ['missing'] }, { ...probeB, animation: [{ frame: 100, cell: 1 }] },
    { ...probeB, animation: [{ frame: 1, cell: 1 }, { frame: 1, cell: 2 }] }
  ]) {
    assert.throws(() => defineFighter({ ...empty, signatureMoves: [move] }), /fixture/);
  }
  assert.throws(() => defineFighter({ ...empty, extraCancels: { missing: ['B'] } }), /missing/);
  assert.throws(() => defineFighter({ ...empty, stats: { hurtbox: { x: 0, y: 0, w: 0, h: 1 } } }), /受击框/);
});

test('fractional push from an authored hit decays to zero for either facing', () => {
  const attacker = defineFighter({ ...empty, signatureMoves: [{ ...probeB, direction: undefined, push: 1.5 }] });
  for (const seat of [0, 1]) {
    const { target, tick } = opening(seat, attacker);
    tick(['B']);
    for (let n = 0; n < probeB.startup; n++) tick();
    assert.equal(target.push, seat === 0 ? 1.5 : -1.5);
    for (let n = 0; n < probeB.stop + 3; n++) tick();
    assert.equal(target.push, 0);
  }
});

const guard = { ...NEUTRAL, y: 1 };
const jab = { ...NEUTRAL, pressed: ['A'] };
const riposte = {
  ...basicAttack, id: 'test-riposte', slot: 'B', linkOnly: true, startup: 0, active: 1,
  advance: 0, damage: 37, cancelOnHit: []
};
function fighterDuel(seat, entry) {
  const { state, config, player, target } = opening(seat, entry);
  const tick = (defend = NEUTRAL, attack = NEUTRAL) =>
    step(state, seat === 0 ? [defend, attack] : [attack, defend], config);
  const hold = (frames, defend = NEUTRAL, attack = NEUTRAL) =>
    Array.from({ length: frames }, () => tick(defend, attack)).flat();
  return { state, config, player, target, tick, hold };
}

function counterDuel(seat, response = riposte, windowFrames = 3) {
  return fighterDuel(seat, defineFighter({ ...empty, signatureMoves: [response],
    guardCounter: { windowFrames, actionId: response.id } }));
}

test('first and last guard-window ticks parry from either seat, then frame zero of the response can hit', () => {
  for (const seat of [0, 1]) {
    for (const age of [1, 3]) {
      const { state, config, player, target, tick, hold } = counterDuel(seat);
      tick(NEUTRAL, jab);
      hold(basicAttack.startup - age);
      const events = hold(age, guard);
      assert.deepEqual(events.map(e => [e.kind, e.source]), [['parry', seat]]);
      assert.equal(target.attack.connected, true);
      assert.equal(target.attack.landed, false);
      assert.deepEqual([player.hp, player.guard, player.combo, player.blockstun, player.push, target.hp],
        [1000, rules.guardMax, 0, 0, 0, 1000]);
      assert.equal(player.pendingCounter, riposte.id);
      assert.ok(state.freeze > 0);
      const replay = structuredClone(state);
      const replayEvents = Array.from({ length: state.freeze + 1 }, () => step(replay, [NEUTRAL, NEUTRAL], config)).flat();
      assert.deepEqual(hold(state.freeze), []);
      assert.equal(player.pendingCounter, riposte.id);
      const response = tick();
      assert.deepEqual(response.map(e => [e.kind, e.source]), [['swing', seat], ['hit', seat]]);
      assert.equal(player.attack.frame, 0);
      assert.equal(target.hp, 1000 - riposte.damage);
      assert.equal(player.pendingCounter, undefined);
      assert.deepEqual(state, replay);
      assert.deepEqual(response, replayEvents);
    }
  }
});

test('holding guard beyond the window blocks normally until a release and a fresh timed press', () => {
  const { state, player, tick, hold } = counterDuel(0);
  tick(NEUTRAL, jab);
  hold(1);
  const late = hold(4, guard);
  assert.deepEqual(late.map(e => e.kind), ['block']);
  assert.equal(player.guard, rules.guardMax - basicAttack.guardCost);
  hold(state.freeze + 30, guard);
  tick(guard, jab);
  assert.deepEqual(hold(basicAttack.startup, guard).map(e => e.kind), ['block']);
  hold(state.freeze + 30, guard);
  tick(NEUTRAL, jab);
  hold(basicAttack.startup - 1);
  assert.deepEqual(tick(guard).map(e => e.kind), ['parry']);
});

test('guard counters require a frontal contact and a legal new guard press', () => {
  const rear = counterDuel(0, riposte, 9);
  rear.tick(guard);
  rear.target.x = rear.player.x - 90;
  rear.tick(guard, jab);
  assert.deepEqual(rear.hold(basicAttack.startup, guard).map(e => e.kind), ['hit']);
  assert.equal(rear.player.hp, 1000 - basicAttack.damage);
  for (const status of ['hitstun', 'blockstun', 'guardBreak']) {
    const duel = counterDuel(0);
    duel.player[status] = 3;
    duel.hold(4, guard);
    assert.equal(duel.player.guarding, true);
    assert.equal(duel.player.guardCounterLeft, 0, status);
    duel.tick();
    duel.tick(guard);
    assert.equal(duel.player.guardCounterLeft, 3, status);
  }
  const air = counterDuel(0);
  air.player.ground = null;
  air.player.y -= 2;
  air.hold(4, guard);
  assert.equal(air.player.ground, 'floor');
  assert.equal(air.player.guardCounterLeft, 0);
  const far = counterDuel(0, riposte, 25);
  far.target.x += 250;
  far.tick(guard, jab);
  assert.deepEqual(far.hold(14, guard).map(e => e.kind), ['whiff']);
  assert.equal(far.player.pendingCounter, undefined);
});

test('the response uses its own reach and timing and can miss or be guarded', () => {
  const short = counterDuel(0, { ...riposte, hitbox: { x: 0, y: -60, w: 1, h: 1 } });
  const slow = counterDuel(1, { ...riposte, startup: 22 });
  for (const duel of [short, slow]) {
    duel.tick(NEUTRAL, jab);
    duel.hold(4);
    assert.equal(duel.tick(guard)[0].kind, 'parry');
    const outcomes = duel.hold(32, NEUTRAL, guard).map(e => e.kind);
    assert.ok(outcomes.includes(duel === short ? 'whiff' : 'block'));
    assert.equal(duel.target.hp, 1000);
  }
});

test('an invalid guard-window length, missing response or air-only response names the role at build time', () => {
  for (const windowFrames of [0, -1, 1.5, NaN]) {
    assert.throws(() => defineFighter({ ...empty, guardCounter: { windowFrames, actionId: 'common-jab' } }), /fixture.*窗口/);
  }
  for (const actionId of ['missing', 'common-air']) {
    assert.throws(() => defineFighter({ ...empty, guardCounter: { windowFrames: 4, actionId } }), /fixture.*防反/);
  }
});

const stance = {
  id: 'test-stance', name: '测试架势', slot: 'B', posture: 'ground',
  startup: 2, active: 3, recovery: 6, counterTo: riposte.id
};

test('B/C stances intercept only on their active frames and preserve their pose through hitstop on both seats', () => {
  for (const seat of [0, 1]) {
    for (const slot of ['B', 'C']) {
      const entry = defineFighter({ ...empty, signatureMoves: [{ ...stance, slot }, riposte] });
      for (const contactFrame of [1, 2, 4, 5]) {
        const { state, player, target, tick, hold } = fighterDuel(seat, entry);
        let contact;
        for (let t = 0; t <= basicAttack.startup; t++) {
          const defend = t === basicAttack.startup - contactFrame ? { ...NEUTRAL, pressed: [slot] } : NEUTRAL;
          contact = tick(defend, t === 0 ? jab : NEUTRAL);
        }
        if (contactFrame === 2 || contactFrame === 4) {
          assert.deepEqual(contact.map(e => [e.kind, e.source]), [['parry', seat]]);
          assert.deepEqual([player.attack.id, player.attack.frame], [stance.id, contactFrame]);
          assert.equal(player.guard, rules.guardMax);
          assert.equal(target.attack.landed, false);
          hold(state.freeze);
          assert.equal(tick().find(e => e.kind === 'hit')?.amount, riposte.damage);
          assert.equal(player.attack.frame, 0);
        } else {
          assert.deepEqual(contact.map(e => e.kind), contactFrame < stance.startup ? ['hit'] : ['whiff', 'hit']);
          assert.equal(player.hp, 1000 - basicAttack.damage);
          assert.equal(player.pendingCounter, undefined);
        }
      }
    }
  }
});

test('stances have no outgoing hitbox, require the ground and expose the back', () => {
  const entry = defineFighter({ ...empty, signatureMoves: [stance, riposte] });
  const mirror = fighterDuel(0, entry);
  mirror.config.fighters[1] = entry.fighter;
  const pressB = { ...NEUTRAL, pressed: ['B'] };
  mirror.tick(pressB, pressB);
  const misses = mirror.hold(15);
  assert.deepEqual(misses.map(e => e.kind), ['whiff', 'whiff']);
  assert.deepEqual(mirror.state.fighters.map(f => [f.hp, f.attack]), [[1000, null], [1000, null]]);
  const air = fighterDuel(0, entry);
  air.tick({ ...NEUTRAL, pressed: ['jump'] });
  air.tick(pressB);
  assert.equal(air.player.attack, null);
  const back = fighterDuel(0, entry);
  back.tick(NEUTRAL, jab);
  back.tick(pressB);
  back.target.x = back.player.x - 90;
  back.target.facing = 1;
  assert.deepEqual(back.hold(4).map(e => e.kind), ['hit']);
});

test('normal guard and a stance can be equipped independently or route to different responses on the same fighter', () => {
  const moves = [stance, riposte];
  const stanceOnly = fighterDuel(0, defineFighter({ ...empty, signatureMoves: moves }));
  stanceOnly.tick(NEUTRAL, jab);
  stanceOnly.hold(4);
  assert.equal(stanceOnly.tick(guard)[0].kind, 'block');
  const both = defineFighter({ ...empty, signatureMoves: moves, guardCounter: { windowFrames: 3, actionId: basicAttack.id } });
  const guarded = fighterDuel(0, both);
  guarded.tick(NEUTRAL, jab);
  guarded.hold(4);
  guarded.tick(guard);
  assert.equal(guarded.player.pendingCounter, basicAttack.id);
  const special = fighterDuel(0, both);
  special.tick(NEUTRAL, jab);
  special.tick({ ...guard, pressed: ['B'] });
  special.hold(4, guard);
  assert.equal(special.player.pendingCounter, riposte.id);
});

test('counter targets must be strikes and invalid stance references, inputs and poses fail the build', () => {
  for (const invalid of [
    { ...stance, counterTo: stance.id }, { ...stance, counterTo: 'missing' }, { ...stance, counterTo: 'common-air' },
    { ...stance, posture: 'air' }, { ...stance, slot: 'A' }, { ...stance, active: 0 },
    { ...stance, animation: [{ frame: 11, cell: 3 }] }
  ]) {
    assert.throws(() => defineFighter({ ...empty, signatureMoves: [invalid, riposte] }), /fixture.*test-stance/);
  }
  assert.throws(() => defineFighter({ ...empty, signatureMoves: [stance, riposte],
    guardCounter: { windowFrames: 3, actionId: stance.id } }), /fixture.*防反/);
});

test('the offline builder embeds character-owned files and checks sprite references against the actual sheet', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'meme-fighter-assets-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  // Transparent 1×1 portrait and 864×864 atlas, independent of the artists' live files.
  await writeFile(join(dir, empty.art.portrait), Buffer.from('UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==', 'base64'));
  await writeFile(join(dir, empty.art.motion), Buffer.from('UklGRj4AAABXRUJQVlA4TDIAAAAvX8PXEAcQEREAUKT//ymi/6n//e9///vf//73v//973//+9///ve///3vf//73/+UAA==', 'base64'));
  const withCell = cell => defineFighter({ ...empty, signatureMoves: [{ ...probeB, animation: [{ frame: 0, cell }] }] });
  const images = await embedFighterImages([withCell(15), dummy], dir);
  assert.deepEqual(Object.keys(images).sort(), [empty.art.portrait, empty.art.motion].sort());
  assert.ok(Object.values(images).every(image => image.startsWith('data:image/webp;base64,')));
  await assert.rejects(embedFighterImages([withCell(16)], dir), /fixture.*test-b.*16/);
  await assert.rejects(embedFighterImages([dummy, dummy], dir), /ID 重复/);
  await assert.rejects(embedFighterImages([{ ...dummy, art: { ...empty.art, motion: empty.art.portrait } }], dir), /动作图集/);
  await assert.rejects(embedFighterImages([{ ...dummy, art: { ...empty.art, portrait: 'missing.webp' } }], dir), /missing.webp/);
});

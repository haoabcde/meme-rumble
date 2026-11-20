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
  return { state, tick, player: state.fighters[seat], target: state.fighters[1 - seat] };
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

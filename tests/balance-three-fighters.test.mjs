import test from 'node:test';
import assert from 'node:assert/strict';
import { whale } from '../dist/content/fighters/whale.js';
import { gaga, gagaActionIds } from '../dist/content/fighters/gaga.js';
import { banana, bananaActionIds } from '../dist/content/fighters/banana.js';
import { WHALE_RULES } from '../dist/core/whale-kit.js';

const action = (fighter, id) => {
  const move = fighter.fighter.actions.find(item => item.id === id);
  assert.ok(move, `missing ${id}`);
  return move;
};

test('whale retains rice and tail but loses automatic two-block guard break', () => {
  for (const id of ['common-jab', 'common-sweep', 'common-finish']) {
    const move = action(whale, id);
    assert.equal(move.guardHitsToBreak, undefined);
    assert.equal(move.guardCost, 14);
    assert.equal(move.damage, 45);
  }
  assert.equal(WHALE_RULES.bind, 48);
  assert.equal(action(whale, 'whale-guard-break').guardBreaker, true);
});

test('gaga retains turret and counter identity with bounded field and slide damage', () => {
  assert.deepEqual(action(gaga, gagaActionIds.overclock).plantPylon, { radius: 400, duration: 360, offsetX: 60 });
  assert.equal(action(gaga, gagaActionIds.slide).damage, 105);
  assert.equal(action(gaga, gagaActionIds.slide).guardBreaker, true);
  assert.equal(action(gaga, gagaActionIds.xiraniteGuard).counterTo, gagaActionIds.xiraniteBurst);
});

test('banana gains baseline damage while JO projectile generates less energy', () => {
  assert.equal(action(banana, bananaActionIds.jab).damage, 34);
  assert.equal(action(banana, bananaActionIds.backhand).damage, 38);
  const projectile = action(banana, bananaActionIds.joSheerHeart);
  assert.equal(projectile.energyGain, 12);
  assert.equal(projectile.projectile.life, 150);
  assert.equal(projectile.projectile.blastRadius, 145);
  assert.equal(action(banana, bananaActionIds.joAwaken).awakenJo, true);
});

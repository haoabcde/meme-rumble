import test from 'node:test';
import assert from 'node:assert/strict';
import { drawKnockbackStreak } from '../dist/web/knockback-feedback.js';

function drawing() {
  const lines = [];
  const ctx = { save() {}, restore() {}, beginPath() {}, moveTo(x, y) { lines.push([[x, y]]); },
    lineTo(x, y) { lines.at(-1).push([x, y]); }, stroke() {} };
  return { ctx, lines };
}
const fighter = { x: 300, y: 400, hp: 100, push: 12, hitstun: 8, launched: false, recovery: null };

test('knockback streaks point behind the moving victim for either direction', () => {
  for (const direction of [-1, 1]) {
    const { ctx, lines } = drawing();
    drawKnockbackStreak(ctx, { ...fighter, push: direction * 12 }, 80, false, { left: 0, right: 600 });
    assert.equal(lines.length, 2);
    for (const [[start], [end]] of lines) {
      assert.equal(Math.sign(start - fighter.x), -direction);
      assert.equal(Math.sign(end - start), -direction);
    }
  }
});

test('ordinary movement, guarding, tiny pushes, and reduced motion do not create knockback streaks', () => {
  for (const [state, reduced] of [[{ ...fighter, hitstun: 0 }, false],
    [{ ...fighter, push: 2 }, false], [fighter, true], [{ ...fighter, hp: 0 }, false],
    [{ ...fighter, x: 600 }, false], [{ ...fighter, x: 0, push: -12 }, false]]) {
    const { ctx, lines } = drawing();
    drawKnockbackStreak(ctx, state, 80, reduced, { left: 0, right: 600 });
    assert.equal(lines.length, 0);
  }
});

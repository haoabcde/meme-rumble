import test from 'node:test';
import assert from 'node:assert/strict';
import { packetInput, mergeInput } from '../scripts/online-input.mjs';

test('online input preserves repeated keys and their direction through packet merging', () => {
  const first = packetInput({ pressed: ['A', 'bad', 'A'], sampled: [{x: 1, y: 0}, {}, {x: 0, y: -1}] });
  const second = packetInput({ pressed: ['B', 'A'], sampled: [{x: 0, y: 1}, {x: -1, y: 0}], held: ['B'] });
  const merged = mergeInput(first, second);
  assert.deepEqual(merged.pressed, ['A', 'A', 'B', 'A']);
  assert.deepEqual(merged.sampled, [{x: 1, y: 0}, {x: 0, y: -1}, {x: 0, y: 1}, {x: -1, y: 0}]);
  assert.deepEqual(merged.held, ['B']);
});

test('online input accepts legacy direction maps and bounds queued commands', () => {
  const packet = packetInput({ pressed: Array(30).fill('A'), sampled: { A: {x: -1, y: 1} } });
  assert.equal(packet.pressed.length, 24);
  assert.deepEqual(packet.sampled[23], {x: -1, y: 1});
  assert.equal(mergeInput(packet, packet).pressed.length, 24);
  assert.equal(mergeInput(packet, packet).sampled.length, 24);
});

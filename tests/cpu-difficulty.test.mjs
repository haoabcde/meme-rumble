import assert from 'node:assert/strict';
import test from 'node:test';
import { rules, testFighter } from '../dist/content/demo.js';
import { arenas } from '../dist/content/arenas.js';
import { createMatch } from '../dist/core/match.js';
import { cpuInput } from '../dist/web/cpu.js';

test('difficulty changes CPU attack frequency, guard reaction and block retaliation', () => {
  const config = { rules, arena: arenas.find(arena => arena.id === 'broadcast-ring'), fighters: [testFighter, testFighter] };
  const state = createMatch(config);
  state.phase = 'fight';
  const [opponent, cpu] = state.fighters;
  cpu.x = opponent.x + 70;
  const levels = ['easy', 'normal', 'hard'];
  const jabs = [0, 0, 0];
  for (let frame = 0; frame < 48; frame++) {
    state.frame = frame;
    levels.forEach((level, index) => {
      if (cpuInput(state, config, level).pressed.includes('A')) jabs[index]++;
    });
    assert.deepEqual(cpuInput(state, config), cpuInput(state, config, 'normal'));
  }
  assert.ok(jabs[0] > 0 && jabs[0] < jabs[1] && jabs[1] < jabs[2]);
  state.frame = 0;
  opponent.attack = { id: 'test-a', frame: 2 };
  assert.deepEqual(levels.map(level => cpuInput(state, config, level).y), [0, 0, 1]);
  opponent.attack.frame = 4;
  assert.deepEqual(levels.map(level => cpuInput(state, config, level).y), [0, 1, 1]);
  cpu.blockstun = Math.min(4, rules.inputBuffer);
  assert.deepEqual(levels.map(level => cpuInput(state, config, level).pressed.includes('A')), [false, true, true]);
});

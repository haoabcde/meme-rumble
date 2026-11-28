import assert from 'node:assert/strict';
import test from 'node:test';
import { arenas } from '../dist/content/arenas.js';
import { roster } from '../dist/content/roster.js';
import { rules } from '../dist/content/demo.js';
import { createMatch, step } from '../dist/core/match.js';
import { NEUTRAL } from '../dist/core/types.js';
import { cpuInput } from '../dist/web/cpu.js';
import { approachPlatform } from '../dist/web/navigation.js';

const arena = arenas.find(candidate => candidate.id === 'mist-street');

function setup(fighter, id, airJump = fighter.airJump) {
  const platform = arena.platforms.find(candidate => candidate.id === id);
  const settings = { rules, training: true, arena, fighters: [fighter, { ...fighter, airJump }] };
  const state = createMatch(settings);
  state.phase = 'fight';
  Object.assign(state.fighters[0], { x: (platform.left + platform.right) / 2, y: platform.y, ground: id });
  Object.assign(state.fighters[1], { x: id === 'east-roof' ? 4200 : 2450, y: arena.floor, ground: 'floor' });
  return { settings, state, platform };
}

test('each CPU fighter can double-jump from the ground onto the mist street routes', () => {
  for (const { fighter } of roster) for (const id of ['middle-step', 'west-roof', 'middle-roof', 'east-roof']) {
    const { settings, state } = setup(fighter, id);
    let airJumps = 0;
    for (let i = 0; i < 1200 && state.fighters[1].ground !== id; i++) {
      const events = step(state, [NEUTRAL, cpuInput(state, settings)], settings);
      airJumps += events.filter(event => event.kind === 'air-jump' && event.source === 1).length;
    }
    assert.equal(state.fighters[1].ground, id, `${fighter.id} / ${id}`);
    assert.ok(airJumps > 0, `${fighter.id} / ${id} should use air jump`);
  }
});

test('navigation does not plan impossible double jumps for a fighter without one', () => {
  const fighter = roster[0].fighter;
  const { settings, state } = setup(fighter, 'middle-step', 0);
  assert.equal(approachPlatform(state, settings), undefined);
});

import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const [distPath] = process.argv.slice(2);
if (!distPath) throw Error('Pass the compiled TypeScript directory.');
const fromDist = path => import(pathToFileURL(resolve(distPath, path)).href);
const { createMatch, step } = await fromDist('core/match.js');
const { NEUTRAL } = await fromDist('core/types.js');
const { rules, testFighter } = await fromDist('content/demo.js');
const { arenas } = await fromDist('content/arenas.js');
const { roster } = await fromDist('content/roster.js');
const fighters = Object.fromEntries(roster.map(({ fighter }) => [fighter.id, fighter]));
const ring = arenas.find(arena => arena.id === 'broadcast-ring');

const input = (key, y = 0) => ({ x: 0, y, pressed: [key] });
function prepare(definitions, spawn = [1000, 1600]) {
  const config = { rules, arena: { ...ring, spawn }, fighters: definitions };
  const state = createMatch(config);
  state.phase = 'fight';
  return { state, tick: (first = NEUTRAL, second = NEUTRAL) => step(state, [first, second], config) };
}

for (const ids of [['whale', 'frog'], ['frog', 'whale'], ['banana', 'gaga'], ['gaga', 'banana']]) {
  for (const round of [1, 2]) {
    const { state, tick } = prepare(ids.map(id => fighters[id]));
    state.round = round;
    for (const player of state.fighters) player.energy = 300;
    const winner = tick(input('ULT'), input('ULT')).find(event => event.kind === 'ultimate').source;
    assert.equal(winner, ids.includes('whale') ? 0 : round - 1);
    assert.deepEqual(state.fighters.map(fighter => fighter.energy), winner === 0 ? [0, 300] : [300, 0]);
    console.log(ids.join('/'), 'round', round, 'both O, selected seat', winner + 1);
  }
}

for (const [id, fighter] of Object.entries(fighters)) {
  const { state, tick } = prepare([fighter, testFighter]);
  state.fighters[0].energy = 300;
  const result = tick(input('ULT', 1)).find(event => event.kind === 'ultimate');
  assert.equal(state.fighters[0].energy, 0);
  console.log(id, 'unconfigured down+O spent 300:', result?.actionId);
}

{
  const { state, tick } = prepare([fighters.whale, testFighter]);
  tick(input('jump', 1));
  assert.equal(state.fighters[0].ground, 'floor');
  tick(input('jump'));
  assert.equal(state.fighters[0].ground, null);
  console.log('floor down+K stays grounded; K jumps');
}

{
  const attacker = {
    ...testFighter,
    actions: testFighter.actions.map(action =>
      action.id === 'test-a' ? { ...action, hitstun: 2, stop: 0 } : action)
  };
  const { state, tick } = prepare([attacker, fighters.whale], [1000, 1080]);
  tick(input('A'), input('A'));
  for (let frame = 0; frame < 4; frame++) tick();
  const events = tick(NEUTRAL, input('C'));
  const player = state.fighters[1];
  assert(events.some(event => event.kind === 'hit' && event.source === 0));
  assert(player.buffer.some(command => command.key === 'C'));
  for (let frame = 0; frame < 3; frame++) tick();
  assert.equal(player.attack?.id, 'tornado');
  console.log('two-frame grounded hit fixture retains C and launches tornado after recovery without new input');
}

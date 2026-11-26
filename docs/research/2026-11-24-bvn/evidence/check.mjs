import assert from 'node:assert/strict';
import {createMatch, step} from './dist/core/match.js';
import {NEUTRAL} from './dist/core/types.js';
import {roster} from './dist/content/roster.js';
import {rules, testFighter} from './dist/content/demo.js';
import {arenas} from './dist/content/arenas.js';

const localArena = arenas.find(arena => arena.id === 'broadcast-ring');
const frame = (key, y = 0) => ({ x: 0, y, pressed: [key] });
const entry = name => roster.find(row => row.fighter.id === name).fighter;
function prepare(name, gap = 80, energy = 0, airborne = false) {
  const fighter = entry(name);
  const config = {rules, arena: {...localArena, spawn:[1000,1000+gap]}, fighters:[fighter,testFighter], training:true};
  const state = createMatch(config);
  state.phase = 'fight';
  const [player, target] = state.fighters;
  player.energy = energy;
  if (airborne) {
    player.ground = null;
    player.y -= 80;
  }
  const tick = (f = NEUTRAL, d = NEUTRAL) => step(state,[f,d],config);
  return {player,target,state,tick};
}

for (const [name, upA] of [['whale','common-jab'],['frog','common-jab'],['banana','banana-tip-rise'],['gaga','gaga-rise']]) {
  const actualUpId = entry(name).actions.find(action => action.slot === 'A' && action.direction === 'up')?.id;
  const t = prepare(name);
  t.tick(frame('A',-1));
  const expected = actualUpId ?? upA;
  assert.equal(t.player.attack.id, expected);
  console.log(name, 'W+J', t.player.attack.id, 'declared-up', !!actualUpId, 'jump-cancel', !!entry(name).actions.find(move => move.id === expected)?.cancelOnHit?.includes('jump'));
  for (const move of entry(name).actions.filter(action => action.slot === 'ULT')) {
    assert.equal(move.energyCost, 300);
    console.log(name, 'ULT', move.id, move.energyCost, move.posture);
  }
}

for (const name of ['whale','frog']) {
  const t = prepare(name,700);
  t.tick(frame('A'));
  for (let scan = 0; scan < 13; scan++) t.tick();
  assert.equal(t.player.attack.landed, false);
  t.tick(frame('A'));
  assert.equal(t.player.attack.id, 'common-sweep');
  console.log(name, 'second J after whiff', t.player.attack.id);
}

for (const [name, key, y] of [['whale','B',0],['frog','B',-1],['banana','B',0],['gaga','C',0]]) {
  const t = prepare(name);
  const events = t.tick(frame(key,y));
  const shortage = events.find(ev => ev.kind.endsWith('short') || ev.kind.endsWith('no-energy'));
  assert.equal(shortage?.amount, name === 'gaga' ? 100 : undefined);
  if (name !== 'gaga') assert.ok(t.player.attack);
  console.log(name, '0 Qi input', key, t.player.attack?.id ?? shortage.kind, shortage?.amount ?? '', 'Qi',t.player.energy);
}
for (const airborne of [false, true]) {
  const t = prepare('gaga',1080,100,airborne);
  t.tick(frame('C'));
  assert.equal(t.player.energy,0);
  assert.ok(t.player.attack);
  console.log('gaga cost with', airborne ? 'air I' : 'ground I', t.player.attack.id, 100-t.player.energy);
}
const noAirTears = prepare('banana',160,0,true);
noAirTears.player.tearUnits = 0;
assert.equal(noAirTears.tick(frame('A')).find(ev => ev.kind === 'tears-short')?.amount,10);
assert.equal(noAirTears.player.attack,null);
console.log('banana air J with 0 tears: no replacement');

const power = prepare('frog',500,300);
power.tick(frame('ULT'));
const spentEnergy = power.player.energy;
for (let f = 0; f < 62; f++) power.tick();
assert.equal(spentEnergy,0);
assert.ok(power.player.ascendUntil);
assert.equal(power.player.ascendUntil - power.state.arenaFrame,898);
console.log('frog after ULT: paid', 300-spentEnergy, 'display/state Qi', power.player.energy, 'remaining ticks', power.player.ascendUntil-power.state.arenaFrame);

const globalContacts = [];
for (const distance of [200,2200]) {
  const t = prepare('frog',distance);
  const defending = { x: 0,y: 1,pressed:[] };
  const events = t.tick(frame('B',-1),defending);
  for (let f = 0; f < 40; f++) events.push(...t.tick(NEUTRAL,defending));
  globalContacts.push(events.find(event => ['block','block'].includes(event.kind))?.kind);
}
assert.deepEqual(globalContacts,['block','block']);
console.log('frog W+U against identical front-facing guard, short and far spawns',globalContacts.join(', '));

for (const name of ['banana','gaga']) {
  const original = entry(name);
  const originalUltimate = original.actions.find(move => move.slot === 'ULT');
  const synthetic = { ...original.actions[0], id:'directional-alt', slot:'ULT', energyCost:100, direction:'up' };
  const fighter = {...original,actions:[...original.actions,synthetic]};
  const config = {rules,arena:{...localArena,spawn:[1000,1600]},fighters:[fighter,testFighter]};
  const state = createMatch(config);
  state.phase = 'fight';
  const [player] = state.fighters;
  player.energy = 300;
  step(state,[frame('ULT',-1),NEUTRAL],config);
  assert.equal(player.attack.id,originalUltimate.id);
  assert.equal(player.energy,0);
  console.log(name,'directional variant collision: W+O spent 300 and chose',player.attack.id);
}

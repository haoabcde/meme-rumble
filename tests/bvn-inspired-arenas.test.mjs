import assert from 'node:assert/strict';
import test from 'node:test';
import { createMatch, step } from '../dist/core/match.js';
import { NEUTRAL } from '../dist/core/types.js';
import { rules } from '../dist/content/demo.js';
import { arenas } from '../dist/content/arenas.js';
import { roster } from '../dist/content/roster.js';
const input = (pressed = [], x = 0, y = 0) => ({ pressed, x, y });
const pair = (seat, command) => seat ? [NEUTRAL, command] : [command, NEUTRAL];
function prepare(arena, fighter, seat, x) {
  const config = { arena, rules, training: true, fighters: [fighter, fighter] };
  const state = createMatch(config);
  for (let i = 0; i < 120; i++) step(state, [NEUTRAL, NEUTRAL], config);
  Object.assign(state.fighters[seat], { x, y: arena.floor, ground: 'floor' });
  state.fighters[1 - seat].x = x < arena.width / 2 ? arena.right : arena.left;
  return { state, config, actor: state.fighters[seat] };
}
function land(state, config, seat, target, destination, secondJump = false, drop = false) {
  const actor = state.fighters[seat];
  for (let tick = 0; tick < 90; tick++) {
    const dx = destination - actor.x;
    const direction = Math.abs(dx) < config.fighters[seat].airSpeed / 2 ? 0 : Math.sign(dx);
    const pressed = tick === 0 || (secondJump && tick === 16) ? ['jump'] : [];
    const events = step(state, pair(seat, input(pressed, direction, drop && tick === 0 ? 1 : 0)), config);
    if (!tick) assert.ok(events.some(event => event.kind === (drop ? 'drop' : 'jump')), 'movement must start');
    if (actor.ground) break;
  }
  assert.equal(actor.ground, target.id, `${config.arena.name} / ${config.fighters[seat].id} / P${seat+1}: expected ${target.id}, actual ${actor.ground}`);
}
function walkTo(state, config, seat, destination, support) {
  const actor = state.fighters[seat];
  for (let tick = 0; tick < 300 && Math.abs(actor.x - destination) >= config.fighters[seat].run; tick++) {
    step(state, pair(seat, input([], Math.sign(destination - actor.x))), config);
    assert.equal(actor.ground, support.id, `${support.id}: stay on roof while walking`);
  }
  assert.ok(Math.abs(actor.x - destination) < config.fighters[seat].run);
}
for (const arena of arenas.filter(a => [].includes(a.id))) {
  test(`${arena.name}: every fighter can reach every platform from the ground or an overhead drop`, () => {
    assert.ok(arena.width >= 4352);
    for (const target of arena.platforms) for (const { fighter } of roster) for (const seat of [0, 1]) {
      const x = (target.left + target.right) / 2;
      const upper = arena.platforms.filter(p => p !== target && p.left <= x && p.right >= x && p.y < target.y)
        .sort((a,b) => a.y-b.y);
      const { state, config } = prepare(arena, fighter, seat, x);
      if (upper.length) {
        land(state, config, seat, upper[0], x);
        for (const next of [...upper.slice(1), target]) land(state, config, seat, next, x, false, true);
      } else land(state, config, seat, target, x);
    }
  });
  test(`${arena.name}: all four fighters cross the main roofs in both directions using double jump`, () => {
    const roofs = arena.id === 'mist-street'
      ? ['west-roof', 'middle-roof', 'east-roof']
      : ['west-roof', 'west-rise', 'west-upper', 'center-roof', 'center-east', 'east-high', 'east-roof'];
    for (const { fighter } of roster) for (const seat of [0, 1]) {
      const platforms = (seat ? [...roofs].reverse() : roofs).map(id => arena.platforms.find(p => p.id === id));
      const direction = seat ? -1 : 1;
      const start = (platforms[0].left + platforms[0].right) / 2;
      const { state, config } = prepare(arena, fighter, seat, start);
      land(state, config, seat, platforms[0], start);
      for (let n = 1; n < platforms.length; n++) {
        const previous = platforms[n-1], target = platforms[n];
        const launch = direction > 0 ? previous.right - 25 : previous.left + 25;
        walkTo(state, config, seat, launch, previous);
        const destination = direction > 0
          ? Math.max(target.left + 25, previous.right + 25)
          : Math.min(target.right - 25, previous.left - 25);
        land(state, config, seat, target, destination, true);
      }
    }
  });
}

test('mist street: four fighters reach all seven surfaces and cross the high route both ways', () => {
  const arena=arenas.find(a=>a.id==='mist-street');
  for(const {fighter} of roster) for(const seat of [0,1]) {
    const routes=[
      ['west-step',400,[['west-step',400],['west-roof',400]]],
      ['middle-step',2000,[['middle-step',2000],['middle-roof',2240]]],
      ['east-mid-step',3400,[['east-mid-step',3400],['east-roof',3630]]],
      ['east-step',4300,[['east-step',4300],['east-roof',4050]]]
    ];
    for(const [,x,path] of routes) {
      const {state,config}=prepare(arena,fighter,seat,x);
      for(const [id,destination] of path) {
        const target=arena.platforms.find(p=>p.id===id);
        // Step to the edge of the middle low platform before heading to the roof.
        if(id==='middle-roof') walkTo(state,config,seat,2160,arena.platforms.find(p=>p.id==='middle-step'));
        if(id==='east-roof'&&x===3400) walkTo(state,config,seat,3560,arena.platforms.find(p=>p.id==='east-mid-step'));
        if(id==='east-roof'&&x===4300) walkTo(state,config,seat,4230,arena.platforms.find(p=>p.id==='east-step'));
        land(state,config,seat,target,destination,true);
      }
    }
    for(const [fromId,toId,start,dest] of [
      ['west-roof','middle-roof',1864,2217],['middle-roof','west-roof',2217,1864],
      ['middle-roof','east-roof',3264,3634],['east-roof','middle-roof',3634,3264]
    ]) {
      const {state,config,actor}=prepare(arena,fighter,seat,start);
      const from=arena.platforms.find(p=>p.id===fromId),to=arena.platforms.find(p=>p.id===toId);
      Object.assign(actor,{x:start,y:from.y,ground:from.id});
      land(state,config,seat,to,dest,true);
    }
  }
});

test('layered street: four fighters reach all nine surfaces and cross the longest routes both ways', () => {
  const arena=arenas.find(a=>a.id==='layered-street');
  for(const {fighter} of roster) for(const seat of [0,1]) {
    const checks=[
      ['floor',500,'west-roof',500,true],['floor',1000,'west-rise',1000,true],
      ['west-rise',1260,'west-upper',1380,true],
      ['west-upper',1840,'center-roof',2150,true],['center-roof',2150,'west-upper',1840,true],
      ['floor',3000,'center-east',3000,true],['floor',2800,'center-low',2800,false],
      ['floor',3500,'east-low',3500,true],['east-low',3700,'east-high',3700,true],
      ['floor',4150,'east-roof',4150,true],['east-roof',3900,'east-high',3830,true],
      ['east-high',3380,'center-east',3070,true],['center-east',3070,'east-high',3380,true]
    ];
    for(const [fromId,start,toId,dest,double] of checks) {
      const {state,config,actor}=prepare(arena,fighter,seat,start);
      if(fromId!=='floor'){const from=arena.platforms.find(p=>p.id===fromId);Object.assign(actor,{x:start,y:from.y,ground:from.id});}
      land(state,config,seat,arena.platforms.find(p=>p.id===toId),dest,double);
    }
  }
});

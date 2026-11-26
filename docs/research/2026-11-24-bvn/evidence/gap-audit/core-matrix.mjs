import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const [distPath, outputPath = 'core-matrix.json'] = process.argv.slice(2);
if (!distPath) throw Error('Pass the compiled TypeScript directory and an optional output path.');
const fromDist = path => import(pathToFileURL(resolve(distPath, path)).href);
const { createMatch, step } = await fromDist('core/match.js');
const { rules } = await fromDist('content/demo.js');
const { arenas } = await fromDist('content/arenas.js');
const { roster } = await fromDist('content/roster.js');
const { NEUTRAL: N, TEAR_UNITS_PER_POINT: tp } = await fromDist('core/types.js');

const arena = arenas.find(x => x.id === 'broadcast-ring');
const fighters = Object.fromEntries(roster.map(x => [x.fighter.id, x.fighter]));
const input = (keys = [], x = 0, y = 0, held = keys) => ({ pressed: keys, held, x, y });
function match(left, right, gap = 120, arenaOverride = arena) {
  const config = { rules, arena: arenaOverride, fighters: [fighters[left], fighters[right]], training: true };
  const state = createMatch(config);
  state.phase = 'fight';
  state.phaseTicks = 0;
  const center = (arenaOverride.left + arenaOverride.right) / 2;
  state.fighters.forEach((fighter, seat) => {fighter.x = center + (seat === 0 ? -gap / 2 : gap / 2);});
  const tick = (first = N, second = N) => step(state, [first,second], config);
  return { config, state, tick };
}
const snap = f => ({ a: f.attack?.id, frame: f.attack?.frame, hp: f.hp, energy: f.energy,
  tears: f.tearUnits === undefined ? undefined : f.tearUnits / tp, guard: f.guard,
  ground: f.ground, guarding: f.guarding, hitstun: f.hitstun, blockstun: f.blockstun,
  guardBreak: f.guardBreak, launched: f.launched, recovery: f.recovery ? {...f.recovery} : null, combo: f.combo, controlled: f.controlled,
  queuedChain: f.attack?.queuedChain?.slice(), ascendUntil: f.ascendUntil });
const eventSummary = e => ({ kind: e.kind, source: e.source, action: e.actionId, amount: e.amount, requirement: e.requirement, chain: e.chain });
const commands = { J: input(['A']), WJ: input(['A'],0,-1), U: input(['B']), WU: input(['B'],0,-1),
  I: input(['C']), WI: input(['C'],0,-1), O: input(['ULT']), WO: input(['ULT'],0,-1), SO: input(['ULT'],0,1) };
const matrix = [];
for (const id of Object.keys(fighters)) {
 for (const seat of [0,1]) {
  for (const grounded of [true,false]) {
   for (const stock of [0,1,2,3]) {
    for (const [label,action] of Object.entries(commands)) {
      const actors = seat === 0 ? [id, 'banana'] : ['banana', id];
      const { state, tick } = match(...actors, 1000);
      const f = state.fighters[seat];
      if (!grounded) Object.assign(f, { y: arena.floor - 120, vy: 0, ground: null });
      f.energy = stock * 100;
      const events = (seat === 0 ? tick(action, N) : tick(N, action)).map(eventSummary);
      matrix.push({ id, seat: seat+1, ground: grounded, stock, label, after: snap(f), events,
        nominalReady: stock >= 1, summon: state.summon?.actionId });
    }
   }
  }
 }
}
const cases = {};
{
 const {state,tick}=match('banana','gaga',1000);
 const f = state.fighters[0];
 f.tearUnits = 0;
 f.ground = null; f.y = arena.floor - 120;
 cases.bananaZeroTearsAirJ = { events: tick(commands.J).map(eventSummary), after: snap(f) };
}
{
 const {state,tick}=match('banana','gaga',1000);
 const f = state.fighters[0];
 f.tearUnits = 25*tp;
 cases.bananaUpU25Tears = { events: tick(commands.WU).map(eventSummary), after: snap(f) };
}
{
 const {state,tick}=match('frog','gaga',1000);
 const f = state.fighters[0];
 f.energy = 300;
 const seq = [[0,tick(commands.O).map(eventSummary),snap(f)]];
 for(let i=1;i<=991;i++) {
   const events = tick(i===75?commands.O:N).map(eventSummary);
   if ([59,60,61,75,300,950,959,960,961,962].includes(i)) seq.push([i,events,snap(f)]);
 }
 cases.frogAscension = seq;
}
{
 const {state,tick}=match('banana','gaga',1000);
 cases.floorDownJump = { before: snap(state.fighters[0]), events: tick(input(['jump'],0,1)).map(eventSummary), after: snap(state.fighters[0]) };
}
for (const id of Object.keys(fighters)) {
 const {state,tick} = match(id,'gaga',100);
 const actionEvents = [];
 for(let i=0;i<100;i++) {
   const events = tick(i===0?commands.WJ:i>=1&&i<=40?input(['jump']):N).map(eventSummary);
   if(events.length) actionEvents.push([i,events,snap(state.fighters[0]),snap(state.fighters[1])]);
 }
 cases['launcher-'+id] = actionEvents;
}
{
 const {state,tick}=match('banana','gaga',95);
 const res=[];
 for(let i=0;i<38;i++){
  const current = i===0||i===22 ? commands.J : N;
  const events=tick(current, i<16 ? input([],0,1) : N).map(eventSummary);
  if(events.length||i===1) res.push([i,events,snap(state.fighters[1]),state.freeze]);
 }
 cases.blockThenHit = res;
}
{
 const {state,tick}=match('gaga','banana',120);
 const res=[];
 const f=state.fighters[1];
 let phase='';
 for(let i=0;i<160;i++){
  const events=tick(i===0?commands.WJ : i>20&&i%9===0 ? commands.J:N).map(eventSummary);
  const next=f.recovery?.phase??'none';
  if(events.length||next!==phase) res.push([i,events,snap(f),state.freeze]);
  phase=next;
 }
 cases.gagaLiftRecovery = res;
}
{
 const {state,tick}=match('banana','gaga',90);
 const defender=state.fighters[1];
 const res=[];
 Object.assign(defender,{ hitstun:260, combo:9, controlled:178 });
 for(let i=0;i<65;i++){
   const events=tick(i%5===0?commands.J:N, N).map(eventSummary);
   if(i<4||events.length||i>=40) res.push([i,events,snap(defender)]);
 }
 cases.comboCapNearThreshold = res;
}
{
 const {state,tick}=match('whale','gaga',1700);
 state.randomState=1;
 const events=[];
 for(let i=0;i<20;i++){
   const inputFrame=i%2===0?commands.U:commands.WU;
   const t=tick(inputFrame).map(eventSummary);
   const id=state.fighters[0].attack?.id;
   events.push({launch:i+1,id,energy:state.fighters[0].energy, start:t});
   for(let j=0;j<19;j++)tick();
 }
 cases.whaleRiceTwentyCasts=events;
}
{
 const {state,tick}=match('banana','gaga',300);
 const all=[];
 const caster=state.fighters[0];
 let last = caster.energy;
 for(let i=0;i<330;i++){
  const es=tick(i===0?commands.U:input([],0,0,['B'])).map(eventSummary);
  if(caster.energy!==last){ all.push([i,caster.energy,es]); last=caster.energy; }
 }
 cases.bananaOneUResource=all;
}
{
 const {state,tick}=match('banana','gaga',1000);
 const p=state.fighters[0];
 const shots=[];
 const record=(label, command)=>shots.push([label,tick(command).map(eventSummary),snap(p),p.airActionUsed]);
 record('ground dash',input(['dash']));
 for(let i=0;i<14;i++)tick();
 record('jump',input(['jump']));
 record('air dash',input(['dash']));
 record('air jump after air dash',input(['jump']));
 cases.baseMobility=shots;
}
writeFileSync(outputPath, JSON.stringify({matrix,cases},null,2));
for(const id of Object.keys(fighters)){
  for(const ground of [true,false]) {
    for(const label of Object.keys(commands)) {
      const rows=matrix.filter(r=>r.id===id&&r.seat===1&&r.ground===ground&&r.label===label);
      const parts=rows.map(r=>[r.after.a??'—', r.after.energy, r.events.filter(e=>e.kind!=='action-audio').map(e=>e.kind+(e.amount?' '+e.amount:'')+(e.requirement?' '+e.requirement:'')).join('/')].join(' '));
      console.log(id,ground?'ground':'air',label, parts.join(' | '));
    }
  }
}
for (const [key, val] of Object.entries(cases)){
  console.log('\n'+key, JSON.stringify(key==='comboCapNearThreshold'? val.filter(([i, es])=>i<4||es.some(e=>['knockdown','rise','hit'].includes(e.kind))) : val));
}

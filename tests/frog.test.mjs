import test from 'node:test';
import assert from 'node:assert/strict';
import {createMatch,step,actionFor} from '../dist/core/match.js';
import {frog} from '../dist/content/fighters/frog.js';
import {testFighter,rules} from '../dist/content/demo.js';
import {arenas} from '../dist/content/arenas.js';
import {NEUTRAL} from '../dist/core/types.js';
const input=(pressed=[],x=0,y=0)=>({pressed,x,y});
function setup(source=0,sep=95){
 const arena={...arenas[0],left:100,right:3900,width:4000,height:1100,floor:800,spawn:[800,800+sep],platforms:[]};
 const config={rules,arena,fighters:[testFighter,testFighter]};config.fighters[source]=frog.fighter;
 const state=createMatch(config);state.phase='fight';state.phaseTicks=0;
 const tick=(a=NEUTRAL,b=NEUTRAL)=>step(state,[a,b],config),press=(key,y=0)=>source===0?tick(input([key],0,y)):tick(NEUTRAL,input([key],0,y));
 const run=(n,a=NEUTRAL,b=NEUTRAL)=>Array.from({length:n},()=>tick(a,b)).flat();
 return{state,config,tick,press,run,caster:state.fighters[source],target:state.fighters[1-source],source};
}
test('frog five-hit chain reaches the opponent after HA push on either side',()=>{
 for(const source of [0,1]){const t=setup(source);t.press('A');const events=[];let linked=1;
  for(let i=0;i<170;i++){
   if(!t.state.freeze&&linked<5&&t.caster.attack?.frame>=10){events.push(...t.press('A'));linked++;}else events.push(...t.tick());
  }
  assert.deepEqual(events.filter(e=>e.kind==='hit'&&e.source===source).map(e=>e.amount),[28,28,32,20,50]);assert.equal(t.target.hp,842);
 }
});
test('HA pushes away on either side and its one-body radius is circular',()=>{
 for(const side of [-1,1]){const t=setup();t.target.x=t.caster.x+side*80;t.caster.attack={id:'frog-ha',frame:4,connected:false,landed:false};assert.ok(t.tick().some(e=>e.kind==='hit'));assert.equal(Math.sign(t.target.push),side);}
 const miss=setup();miss.target.x=miss.caster.x+100;miss.target.y-=135;miss.caster.attack={id:'frog-ha',frame:4,connected:false,landed:false};assert.equal(miss.tick().some(e=>e.kind==='hit'),false);
});
test('laugh deals three independent circular hits then launches; out-of-radius enemies are safe',()=>{
 for(const source of [0,1]){const t=setup(source,190);t.press('B');const hits=t.run(90).filter(e=>e.kind==='hit'&&e.source===source);assert.deepEqual(hits.map(e=>e.amount),[28,28,44]);assert.equal(t.target.hp,900);assert.equal(t.caster.x,t.config.arena.spawn[source]);}
 const far=setup(0,330);far.press('B');assert.equal(far.run(80).some(e=>e.kind==='hit'),false);
});
test('global wave hits once across the complete map and upper platforms, with a genuine two-second cooldown',()=>{
 for(const source of [0,1]){const t=setup(source,2800);t.target.y=320;t.target.ground='high';t.config.arena.platforms=[{id:'high',name:'high',tier:4,left:t.target.x-120,right:t.target.x+120,y:320}];t.press('B',-1);assert.equal(t.caster.attack.id,'frog-laugh-global');assert.equal(t.run(30).some(e=>e.kind==='hit'),false);
  const hits=t.run(30).filter(e=>e.kind==='hit');assert.equal(hits.length,1);assert.equal(hits[0].amount,25);
  t.press('B',-1);assert.equal(t.caster.attack,null);t.run(65);t.press('B',-1);assert.equal(t.caster.attack.id,'frog-laugh-global');
 }
});
test('ascension freezes battle during its cinematic and grants exactly 900 playable ticks without healing',()=>{
 const t=setup(0,1200);t.caster.energy=300;t.caster.hp=612;t.press('ULT');assert.equal(t.caster.energy,0);const time=t.state.arenaFrame,remaining=t.state.remaining;
 t.run(59,input(['A','jump','dash'],1),input(['A'], -1));assert.equal(t.state.arenaFrame,time);assert.equal(t.state.remaining,remaining);assert.equal(t.caster.hp,612);
 assert.equal(t.caster.ascendVisual,undefined);assert.equal(t.caster.ascendUntil,undefined);
 t.tick();assert.equal(t.caster.attack,null);assert.equal(t.caster.ascendUntil-time,900);assert.equal(t.caster.energy,300);
 assert.deepEqual(t.caster.ascendVisual,{tick:time,x:t.caster.x,y:t.caster.y});
 t.run(450);assert.equal(t.caster.energy,150);const before=t.caster.ascendUntil;t.press('ULT');assert.equal(t.caster.attack,null);assert.equal(t.caster.ascendUntil,before);
 t.state.freeze=8;const age=t.state.arenaFrame,energy=t.caster.energy;t.run(8);assert.equal(t.state.arenaFrame,age);assert.equal(t.caster.energy,energy);
 t.run(449);assert.equal(t.caster.ascendUntil,undefined);assert.equal(t.caster.energy,0);assert.equal(t.caster.hp,612);
});

test('post-cinematic transformation and cast trails retain their own clocks through hits, hitstop and replay',()=>{
 const t=setup(0,1200);t.caster.energy=300;t.press('ULT');t.run(60);
 const reveal=structuredClone(t.caster.ascendVisual);t.press('A');const cast=structuredClone(t.caster.frogCasts[0]);
 assert.equal(cast.powered,true);assert.equal(cast.id,'common-jab');assert.equal(cast.tick,reveal.tick+1);
 t.caster.poseEvent={kind:'hurt',tick:t.state.arenaFrame};t.caster.hitstun=10;
 t.state.freeze=6;const frozen=structuredClone(t.state);t.run(6);
 assert.equal(t.state.arenaFrame,frozen.arenaFrame);assert.deepEqual(t.caster.ascendVisual,reveal);assert.deepEqual(t.caster.frogCasts,[cast]);
 const replay=structuredClone(t.state);for(let i=0;i<190;i++){assert.deepEqual(t.tick(),step(replay,[NEUTRAL,NEUTRAL],t.config));assert.deepEqual(t.state,replay);}
 assert.deepEqual(t.caster.ascendVisual,reveal); // Still alive at three seconds, including feather drift.
 t.run(31);assert.equal(t.caster.ascendVisual,undefined);assert.equal(t.caster.frogCasts,undefined);
});
test('angel damage and reach are 1.5x for every combo stage and all laugh waves',()=>{
 const t=setup();t.caster.ascendUntil=900;
 for(const raw of frog.fighter.actions.filter(a=>a.slot==='A')){t.caster.attack={id:raw.id,frame:0,connected:false,landed:false};const a=actionFor(t.config,t.state,0);assert.equal(a.damage,raw.damage*1.5);assert.equal(a.hitbox.w,raw.hitbox.w*1.5);assert.equal(a.hitbox.h,raw.hitbox.h*1.5);}
 t.caster.attack={id:'frog-laugh-global',frame:0,connected:false,landed:false};assert.equal(actionFor(t.config,t.state,0).entities[0].damage,37.5);
 const near=setup(0,330);near.caster.ascendUntil=900;near.caster.energy=300;near.press('B');const hits=near.run(85).filter(e=>e.kind==='hit');assert.deepEqual(hits.map(e=>e.amount),[42,42,66]);assert.equal(near.target.hp,850);
 assert.ok(near.caster.energy<300&&near.caster.energy>260);
});
test('buff does not change the hurtbox, platform movement or jump budget and cannot be refreshed',()=>{
 const t=setup();t.caster.ascendUntil=900;t.caster.energy=300;const box=structuredClone(t.config.fighters[0].hurtbox);t.press('jump');assert.equal(t.caster.ground,null);t.run(5);t.press('jump');assert.equal(t.caster.jumpCount,2);assert.equal(t.caster.airActionUsed,true);assert.deepEqual(t.config.fighters[0].hurtbox,box);
});
test('frog buff, global cooldown and wave hits survive snapshot replay and clear at round reset',()=>{
 const t=setup(0,190);t.caster.ascendUntil=900;t.caster.energy=300;t.press('B');t.run(18);const clone=structuredClone(t.state);
 for(let i=0;i<180;i++){const a=input(i===90?['B']:[],0,i===90?-1:0);assert.deepEqual(step(t.state,[a,NEUTRAL],t.config),step(clone,[a,NEUTRAL],t.config));assert.deepEqual(t.state,clone);}
 t.caster.attack=null;t.caster.hitstun=0;t.target.hp=1;t.target.x=t.caster.x+90;t.target.y=t.caster.y;t.target.ground='floor';t.caster.attack={id:'common-jab',frame:4,connected:false,landed:false};t.state.freeze=0;t.tick();assert.equal(t.state.phase,'round-over');t.run(110);assert.equal(t.state.fighters[0].ascendUntil,undefined);assert.equal(t.state.fighters[0].frogGlobalReady,undefined);assert.equal(t.state.fighters[0].energy,0);
});

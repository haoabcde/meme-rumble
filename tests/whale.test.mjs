import assert from 'node:assert/strict';
import test from 'node:test';
import {createMatch,step} from '../dist/core/match.js';
import {whale} from '../dist/content/fighters/whale.js';
import {rules,testFighter} from '../dist/content/demo.js';
import {arenas} from '../dist/content/arenas.js';
import {NEUTRAL} from '../dist/core/types.js';
const input=(pressed=[],x=0,y=0)=>({pressed,x,y});
function setup(source=0,sep=320){
 const arena={...arenas[0],width:2200,height:1000,left:100,right:2100,floor:800,spawn:[600,600+sep],platforms:[]};
 const config={rules,arena,fighters:[testFighter,testFighter],training:true};config.fighters[source]=whale.fighter;
 const state=createMatch(config);state.phase='fight';state.phaseTicks=0;
 const tick=(a=NEUTRAL,b=NEUTRAL)=>step(state,[a,b],config);
 const press=(key,y=0)=>source===0?tick(input([key],0,y)):tick(NEUTRAL,input([key],0,y));
 const run=(n,a=NEUTRAL,b=NEUTRAL)=>Array.from({length:n},()=>tick(a,b)).flat();
 return{state,config,tick,press,run,source,caster:state.fighters[source],target:state.fighters[1-source]};
}
test('authored whale owns three equal tail stages and an independent three-stock ultimate',()=>{
 const f=whale.fighter;assert.equal(f.ultimateCost,300);assert.equal(f.actions.find(a=>a.id==='open-source').slot,'ULT');
 assert.deepEqual(f.actions.filter(a=>['common-jab','common-sweep','common-finish'].includes(a.id)).map(a=>a.damage),[45,45,45]);
});
test('tail requires two actual blocks before normal third contact; a lone third stage cannot bypass guard',()=>{
 for(const source of [0,1]){
  const t=setup(source,110),guard=source===0?[NEUTRAL,input([],0,1)]:[input([],0,1),NEUTRAL];t.run(12,...guard);
  const hits=[];for(const id of ['common-jab','common-sweep','common-finish']){
   t.caster.attack={id,frame:whale.fighter.actions.find(a=>a.id===id).startup-1,connected:false,landed:false};
   const ev=t.run(8,...guard);hits.push(...ev);t.caster.attack=null;
  }
  assert.equal(hits.filter(e=>e.kind==='block').length,2);assert.equal(hits.filter(e=>e.kind==='break').length,1);
  assert.deepEqual(hits.filter(e=>e.kind==='hit').map(e=>e.amount),[45]);assert.equal(t.target.hp,955);
  const alone=setup(source,110);alone.run(12,...guard);alone.caster.attack={id:'common-finish',frame:7,connected:false,landed:false};
  const ev=alone.run(7,...guard);assert.equal(alone.target.hp,1000);assert.equal(ev.some(e=>e.kind==='break'),false);
 }
});
test('rice normal/up share five-throw greed and a 90-playable-tick reset; counter rice does not increment',()=>{
 const t=setup(0,1300);
 for(let i=0;i<5;i++){t.press('B',i%2?-1:0);t.run(20);}
 assert.equal(t.caster.whale.riceCount,5);t.press('B');assert.equal(t.caster.attack.id,'whale-eat');
 t.run(30);t.press('B');assert.equal(t.caster.attack.id,'whale-eat');t.run(91);t.press('B');assert.equal(t.caster.attack.id,'rice');
 assert.equal(t.caster.whale.riceCount,1);
});
test('rice direct hit damages and roots, floor contact only roots, airborne root drops vertically, and rice expires',()=>{
 for(const source of [0,1]){
  const t=setup(source,130);t.press('B');const ev=t.run(70);assert.equal(ev.filter(e=>e.kind==='hit').length,1);assert.equal(t.target.hp,970);
  const floor=setup(source,800);floor.press('B');floor.run(45);const e=floor.state.entities.find(e=>e.definition.behavior==='rice');assert.ok(e.grounded);
  floor.target.x=e.x;const before=floor.target.hp;floor.tick();assert.equal(floor.target.hp,before);assert.ok(floor.target.bindUntil>floor.state.arenaFrame);
  const x=floor.target.x;floor.run(15,source===0?NEUTRAL:input(['jump'],1),source===0?input(['jump'],1):NEUTRAL);assert.equal(floor.target.x,x);
  const air=setup(source,800);air.press('B');air.run(10);const a=air.state.entities[0];air.target.x=a.x;air.target.y=a.y+50;air.target.ground=null;air.target.vy=-12;air.tick();
  assert.ok(air.target.bindUntil>air.state.arenaFrame);const ax=air.target.x;air.run(6,source===0?NEUTRAL:input([],1),source===0?input([],1):NEUTRAL);assert.equal(air.target.x,ax);assert.ok(air.target.vy>0);
  const miss=setup(source,1300);miss.press('B');miss.run(135);assert.equal(miss.state.entities.length,0);
 }
});
test('ordinary tornado travels off stage, up tornado snapshots target x/caster y, visual lifetime matches counter',()=>{
 for(const source of [0,1]){
  const t=setup(source,800),x=t.caster.x;t.press('C');t.run(14);const e=t.state.entities.find(e=>e.definition.behavior==='spin');const ex=e.x;t.run(8);assert.equal(e.x-ex,24*e.facing*8);assert.equal(t.caster.x,x);
  t.run(180);assert.equal(t.state.entities.length,0);
  const up=setup(source,800);up.target.y-=120;up.target.ground=null;up.press('C',-1);up.run(12);const u=up.state.entities.find(e=>e.definition.behavior==='spin-up');assert.equal(u.x,up.target.x);assert.equal(u.y,up.caster.y);const ux=u.x;up.target.x+=200;up.run(20);assert.equal(u.x,ux);assert.equal(u.windTicks,20);up.run(40);assert.equal(up.state.entities.length,0);
 }
});
test('counter catches melee or an entity, emits two opposite rice throws, keeps 48-tick visual lifetime',()=>{
 for(const source of [0,1]){
  const t=setup(source,95),attacker=t.target;attacker.attack={id:'test-a',frame:4,connected:false,landed:false};
  const ev=source===0?t.tick(input([],0,1)):t.tick(NEUTRAL,input([],0,1));assert.ok(ev.some(e=>e.kind==='parry'));
  t.run(20);const rice=t.state.entities.filter(e=>e.definition.behavior==='rice');assert.equal(rice.length,2);assert.equal(Math.sign(rice[0].vx),-Math.sign(rice[1].vx));assert.equal(t.caster.whale?.riceCount??0,0);
  const wind=t.state.entities.find(e=>e.definition.behavior==='counter');assert.equal(wind.windTicks,20);assert.equal(wind.definition.lifetime,48);
 }
});
test('remote projectiles also trigger the shared guard counter without consuming rice greed',()=>{
 for(const source of [0,1]){
  const t=setup(source,240),enemy=1-source;
  const orb={id:'remote-orb',spawnFrame:0,offset:{x:190,y:-80},velocity:{x:0,y:0},lifetime:10,hitbox:{x:-25,y:-25,w:50,h:50},damage:50,hitstun:10,blockstun:8,guardCost:10,push:2,lift:0,stop:2};
  t.config.fighters[enemy]={...testFighter,actions:[{...testFighter.actions[0],id:'remote-cast',entities:[orb],hitTimeline:[]}]};
  t.target.attack={id:'remote-cast',frame:-1,connected:false,landed:false};
  const ev=source===0?t.tick(input([],0,1)):t.tick(NEUTRAL,input([],0,1));assert.ok(ev.some(e=>e.kind==='parry'));assert.equal(t.caster.hp,1000);
  t.run(24);assert.ok(t.state.entities.some(e=>e.definition.behavior==='counter'));assert.equal(t.caster.whale?.riceCount??0,0);
 }
});
test('rice rides a moving platform and expires without being restored by a round reset',()=>{
 const t=setup(0,1300);t.config.arena.platforms=[{id:'ride',name:'ride',tier:1,left:650,right:1000,y:760,travel:{axis:'x',distance:50,period:120,dwell:0,phase:0}}];
 t.press('B');t.run(50);const e=t.state.entities.find(e=>e.definition.behavior==='rice');assert.equal(e.support,'ride');const x=e.x;t.run(8);assert.notEqual(e.x,x);
 t.config.training=false;t.target.hp=1;t.caster.attack={id:'common-jab',frame:5,connected:false,landed:false};t.target.x=t.caster.x+90;t.tick();assert.equal(t.state.phase,'round-over');assert.equal(t.state.entities,undefined);
 t.run(110);assert.equal(t.state.fighters[0].whale,undefined);assert.equal(t.state.fighters[0].bindUntil,undefined);assert.equal(t.state.fighters[0].energy,0);
});
test('ultimate pays 300 once, slows on first contact and delivers eight equal hits after cast ends',()=>{
 for(const source of [0,1]){
  const t=setup(source,650);t.press('ULT');assert.equal(t.caster.attack,null);t.caster.energy=300;t.press('ULT');assert.equal(t.caster.energy,0);
  const ev=t.run(220),hits=ev.filter(e=>e.kind==='hit'&&e.source===source);assert.equal(hits.length,8,JSON.stringify(hits));assert.ok(hits.every(e=>e.amount===35));assert.equal(t.target.hp,720);assert.equal(t.caster.energy,0);assert.equal(t.caster.attack,null);
 }
});
test('orca contacts forward dashes and single jumps, but second-jump apex can clear it',()=>{
 for(const source of [0,1]){
  function contact(set){const t=setup(source,800);t.caster.energy=300;t.press('ULT');t.run(64);const e=t.state.entities[0];e.x=t.target.x-e.facing*180;e.previousX=e.x;e.originX=e.x-e.facing*500;e.vx=20*e.facing;set(t.target,e);const ev=t.tick();return ev.some(v=>v.kind==='hit');}
  assert.equal(contact(f=>{f.dash=5;f.facing=source===0?-1:1;}),true);
  assert.equal(contact(f=>{f.ground=null;f.jumpCount=1;f.jumpOriginY=800;f.y=550;f.vy=-1;}),true);
  assert.equal(contact(f=>{f.ground=null;f.jumpCount=2;f.secondApex=false;f.jumpOriginY=800;f.y=550;f.vy=-5;}),true);
  assert.equal(contact(f=>{f.ground=null;f.jumpCount=2;f.secondApex=true;f.jumpOriginY=800;f.y=550;f.vy=0;}),false);
 }
});
test('whale state, projectile physics, multihits and root restore deterministically; freeze pauses ages',()=>{
 const t=setup(0,800);t.press('B');t.run(12);t.state.freeze=3;const age=t.state.entities[0].age;t.run(3);assert.equal(t.state.entities[0].age,age);
 t.caster.attack=null;t.caster.energy=300;t.press('ULT');t.run(70);const clone=structuredClone(t.state);
 for(let i=0;i<150;i++){const a=input(i%29===0?['B']:[],i%2?0:1);assert.deepEqual(step(t.state,[a,NEUTRAL],t.config),step(clone,[a,NEUTRAL],t.config));assert.deepEqual(t.state,clone);}
 const reset=createMatch(t.config);assert.equal(reset.entities,undefined);assert.equal(reset.fighters[0].whale,undefined);assert.equal(reset.fighters[0].energy,0);
});

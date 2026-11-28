import test from 'node:test';
import assert from 'node:assert/strict';
import {createMatch,step,actionFor} from '../dist/core/match.js';
import {frog} from '../dist/content/fighters/frog.js';
import {whale} from '../dist/content/fighters/whale.js';
import {testFighter,rules} from '../dist/content/demo.js';
import {arenas} from '../dist/content/arenas.js';
import {NEUTRAL} from '../dist/core/types.js';
import {FROG_RULES,warpFrog} from '../dist/core/frog-kit.js';
const input=(pressed=[],x=0,y=0)=>({pressed,x,y});
const hold=(pressed=[])=>({...input(pressed),held:['C']});
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
test('global wave hits once across the complete map and upper platforms, and can recast as soon as recovery ends',()=>{
 for(const source of [0,1]){const t=setup(source,2800);t.target.y=320;t.target.ground='high';t.config.arena.platforms=[{id:'high',name:'high',tier:4,left:t.target.x-120,right:t.target.x+120,y:320}];t.press('B',-1);assert.equal(t.caster.attack.id,'frog-laugh-global');assert.equal(t.run(30).some(e=>e.kind==='hit'),false);
  const hits=t.run(30).filter(e=>e.kind==='hit');assert.equal(hits.length,1);assert.equal(hits[0].amount,25);
  t.press('B',-1);assert.equal(t.caster.attack.id,'frog-laugh-global');
  // The new launch recovery protects the fallen target, but does not add a cast cooldown.
  Object.assign(t.target,{recovery:null,launched:false,hitstun:0,ground:'high',y:320,vy:0});
  assert.equal(t.run(60).filter(e=>e.kind==='hit').length,1);
 }
});
test('ascension freezes battle during its cinematic and grants exactly 900 playable ticks without healing',()=>{
 const t=setup(0,1200);t.caster.energy=300;t.caster.hp=612;t.press('ULT');assert.equal(t.caster.energy,0);const time=t.state.arenaFrame,remaining=t.state.remaining;
 t.run(59,input(['A','jump','dash'],1),input(['A'], -1));assert.equal(t.state.arenaFrame,time);assert.equal(t.state.remaining,remaining);assert.equal(t.caster.hp,612);
 assert.equal(t.caster.ascendVisual,undefined);assert.equal(t.caster.ascendUntil,undefined);
 t.tick();assert.equal(t.caster.attack,null);assert.equal(t.caster.ascendUntil-time,900);assert.equal(t.caster.energy,0);
 assert.deepEqual(t.caster.ascendVisual,{tick:time,x:t.caster.x,y:t.caster.y});
 t.run(450);assert.equal(t.caster.energy,0);const before=t.caster.ascendUntil;
 t.caster.energy=150;t.press('ULT');assert.equal(t.caster.attack,null);assert.equal(t.caster.ascendUntil,before);
 t.state.freeze=8;const age=t.state.arenaFrame,energy=t.caster.energy;t.run(8);assert.equal(t.state.arenaFrame,age);assert.equal(t.caster.energy,energy);
 t.run(449);assert.equal(t.caster.ascendUntil,undefined);assert.equal(t.caster.energy,150);assert.equal(t.caster.hp,612);
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
test('buff expires on time while feather dissolution has an independent paused, replayable visual clock',()=>{
 const t=setup(0,1200);t.caster.ascendUntil=2;t.caster.energy=300;
 t.tick();assert.equal(t.caster.ascendEndVisual,undefined);
 t.tick();assert.equal(t.caster.ascendUntil,undefined);assert.equal(t.caster.energy,300);
 assert.deepEqual(t.caster.ascendEndVisual,{tick:2,x:t.caster.x,y:t.caster.y});
 t.caster.attack={id:'common-jab',frame:0,connected:false,landed:false};
 assert.equal(actionFor(t.config,t.state,0).damage,28);
 t.caster.attack=null;t.state.freeze=6;const end=structuredClone(t.caster.ascendEndVisual);t.run(6);
 assert.equal(t.state.arenaFrame,2);assert.deepEqual(t.caster.ascendEndVisual,end);
 const replay=structuredClone(t.state);
 for(let i=0;i<180;i++){t.tick();step(replay,[NEUTRAL,NEUTRAL],t.config);assert.deepEqual(t.state,replay);}
 assert.equal(t.caster.ascendEndVisual,undefined);
 const next=setup(0,1200);next.caster.ascendUntil=1;next.tick();next.caster.energy=300;
 next.press('ULT');next.run(60);assert.equal(next.caster.ascendEndVisual,undefined);assert.ok(next.caster.ascendVisual);
});
test('angel basics extend horizontal reach another 1.2x, keeping damage and skill one unchanged',()=>{
 const t=setup();t.caster.ascendUntil=900;
 for(const raw of frog.fighter.actions.filter(a=>a.slot==='A')){t.caster.attack={id:raw.id,frame:0,connected:false,landed:false};const a=actionFor(t.config,t.state,0);assert.equal(a.damage,raw.damage*1.5);assert.ok(Math.abs(a.hitbox.w-raw.hitbox.w*1.8)<1e-9);assert.equal(a.hitbox.h,raw.hitbox.h*1.5);}
 t.caster.attack={id:'frog-laugh-global',frame:0,connected:false,landed:false};assert.equal(actionFor(t.config,t.state,0).entities[0].damage,35);
 const near=setup(0,330);near.caster.ascendUntil=900;near.caster.energy=100;near.press('B');const hits=near.run(85).filter(e=>e.kind==='hit');assert.deepEqual(hits.map(e=>e.amount),[39.2,39.2,61.6]);assert.equal(near.target.hp,860);
 // During ascension, confirmed hits do not refill the meter.
 assert.equal(near.caster.energy,100);
});
test('extra empowered jab reach actually connects beyond the former range on both facings',()=>{
 for(const seat of [0,1])for(const powered of [false,true]){
  const t=setup(seat,240);if(powered)t.caster.ascendUntil=900;
  t.caster.attack={id:'common-jab',frame:4,connected:false,landed:false};
  assert.equal(t.tick().some(e=>e.kind==='hit'&&e.source===seat),powered);
 }
});

test('buff does not change the hurtbox, platform movement or jump budget and cannot be refreshed',()=>{
 const t=setup();t.caster.ascendUntil=900;t.caster.energy=300;const box=structuredClone(t.config.fighters[0].hurtbox);t.press('jump');assert.equal(t.caster.ground,null);t.run(5);t.press('jump');assert.equal(t.caster.jumpCount,2);assert.equal(t.caster.airActionUsed,true);assert.deepEqual(t.config.fighters[0].hurtbox,box);
});
test('frog buff, casts and wave hits survive snapshot replay and clear at round reset',()=>{
 const t=setup(0,190);t.caster.ascendUntil=900;t.caster.energy=300;t.press('B');t.run(18);const clone=structuredClone(t.state);
 for(let i=0;i<180;i++){const a=input(i===90?['B']:[],0,i===90?-1:0);assert.deepEqual(step(t.state,[a,NEUTRAL],t.config),step(clone,[a,NEUTRAL],t.config));assert.deepEqual(t.state,clone);}
 t.caster.attack=null;t.caster.hitstun=0;t.target.hp=1;t.target.x=t.caster.x+90;t.target.y=t.caster.y;t.target.ground='floor';Object.assign(t.target,{recovery:null,launched:false,hitstun:0,vy:0});t.caster.attack={id:'common-jab',frame:4,connected:false,landed:false};t.state.freeze=0;t.tick();assert.equal(t.state.phase,'round-over');t.run(110);assert.equal(t.state.fighters[0].ascendUntil,undefined);assert.equal(t.state.fighters[0].energy,0);
});


test('only empowered laugh can start in the air; ascension preserves height and fall velocity',()=>{
 for(const source of [0,1]){
  const t=setup(source,1200);t.caster.ascendUntil=900;t.press('jump');t.run(4);t.press('B');assert.equal(t.caster.attack.id,'frog-laugh');assert.equal(t.caster.ground,null);
  let aerialWave=false;for(let i=0;i<22;i++){t.tick();aerialWave ||= (t.state.entities??[]).some(e=>e.definition.behavior==='frog-wave'&&e.y<t.config.arena.floor-65);}
 assert.equal(aerialWave,true);assert.equal(t.caster.frogCasts[0].anchors[0].frame,16);assert.ok(t.caster.frogCasts[0].anchors[0].y<t.config.arena.floor);
  const u=setup(source,1200);u.caster.energy=300;u.press('jump');u.run(5);u.press('ULT');assert.equal(u.caster.attack.id,'frog-ascend');const y=u.caster.y,vy=u.caster.vy,clock=u.state.arenaFrame;
  u.run(60);assert.equal(u.caster.y,y);assert.equal(u.caster.vy,vy);assert.equal(u.state.arenaFrame,clock);assert.equal(u.caster.ascendUntil-clock,900);
  u.tick();assert.equal(u.caster.ground,null);assert.equal(u.caster.vy,vy+1);
 }
});

test('empowered laugh reaches 1.4x radius and deals exactly 1.4x damage',()=>{
 const near=setup(0,330);near.caster.ascendUntil=900;near.press('B');const action=actionFor(near.config,near.state,0);assert.equal(action.entities[0].hitbox.w,672);
 assert.deepEqual(near.run(90).filter(e=>e.kind==='hit').map(e=>e.amount),[39.2,39.2,61.6]);
 const far=setup(0,400);far.caster.ascendUntil=900;far.press('B');assert.equal(far.run(90).some(e=>e.kind==='hit'),false);
});

test('airborne laugh holds both coordinates through all three waves, then falls; bind and interruption release it',()=>{
 for(const source of [0,1])for(const powered of [true]){
  const t=setup(source,1200);t.caster.ground=null;t.caster.y=400;t.caster.vy=-12;
  if(powered)t.caster.ascendUntil=900;
  const x=t.caster.x,y=t.caster.y;t.press('B');
  for(let i=0;i<48;i++){
   const c=input([],source===0?1:-1);t.tick(...(source===0?[c,NEUTRAL]:[NEUTRAL,c]));
   assert.equal(t.caster.x,x);assert.equal(t.caster.y,y);assert.equal(t.caster.vy,0);
  }
  assert.deepEqual(t.caster.frogCasts[0].anchors.map(a=>a.y),[y,y,y]);
  t.run(15);assert.equal(t.caster.attack,null);assert.ok(t.caster.y>y);assert.ok(t.caster.vy>0);
 }
 for(const bound of [false,true]){
  const t=setup(0,1200);t.caster.ascendUntil=900;t.caster.ground=null;t.caster.y=400;t.press('B');const y=t.caster.y;
  if(bound)t.caster.bindUntil=t.state.arenaFrame+72;else{t.caster.attack=null;t.caster.hitstun=4;}
  t.tick();assert.ok(t.caster.y>y);assert.ok(t.caster.vy>0);
 }
});

test('ascension multiplies controlled ground and aerial travel by 1.5 and restores speed on expiry',()=>{
 for(const source of [0,1])for(const airborne of [false,true]){
  const t=setup(source,1200);if(airborne){t.caster.ground=null;t.caster.y=400;t.caster.vy=-8;}
  const dir=source===0?1:-1,controls=source===0?[input([],dir),NEUTRAL]:[NEUTRAL,input([],dir)],normal=airborne?frog.fighter.airSpeed:frog.fighter.run;
  let x=t.caster.x;t.tick(...controls);assert.equal(Math.abs(t.caster.x-x),normal);
  t.caster.ascendUntil=t.state.arenaFrame+3;x=t.caster.x;t.tick(...controls);assert.equal(Math.abs(t.caster.x-x),normal*1.5);
  t.tick(...controls);x=t.caster.x;t.tick(...controls);assert.equal(Math.abs(t.caster.x-x),normal);
 }
});

test('angel takes 0.7x actual melee and rice damage on either seat, without healing',()=>{
 for(const source of [0,1])for(const projectile of [false,true]){
  const t=setup(source,projectile?240:95);t.config.fighters[1-source]=whale.fighter;t.caster.ascendUntil=900;t.caster.energy=300;
  const key=projectile?'B':'A',commands=source===0?[NEUTRAL,input([key])]:[input([key]),NEUTRAL];t.tick(...commands);
  const hits=t.run(70).filter(e=>e.kind==='hit'&&e.target===undefined&&e.source===1-source);
  assert.equal(hits.length,1);assert.equal(hits[0].amount,projectile?21:31.5);assert.ok(Math.abs(t.caster.hp-(1000-hits[0].amount))<1e-9);
 }
});

test('unempowered skill one rejects both airborne variants without delaying a cast until landing',()=>{
 for(const source of [0,1])for(const up of [0,-1]){
  const t=setup(source,1200);t.caster.ground=null;t.caster.y=400;t.caster.vy=0;
  const refused=t.press('B',up);assert.equal(refused.find(event=>event.kind==='skill-unavailable')?.requirement,'ground');
  assert.equal(t.caster.attack,null);assert.equal(t.caster.frogCasts,undefined);assert.equal(t.caster.buffer.length,0);
  assert.ok(t.caster.y>400);t.run(60);assert.equal(t.caster.frogCasts,undefined);
  t.caster.ground=null;t.caster.y=400;t.caster.ascendUntil=t.state.arenaFrame+900;
  t.press('B',up);assert.equal(t.caster.attack.id,up?'frog-laugh-global':'frog-laugh');assert.equal(t.caster.y,400);
 }
});

test('held C stays crouched without energy or damage and releases immediately',()=>{
 for(const source of [0,1]){
  const t=setup(source,1200),commands=source===0?[hold(['C']),NEUTRAL]:[NEUTRAL,hold(['C'])];
  t.tick(...commands);const x=t.caster.x;t.run(180,...(source===0?[hold(),NEUTRAL]:[NEUTRAL,hold()]));
  assert.equal(t.caster.attack.id,'frog-crouch');assert.equal(t.caster.attack.frame,0);assert.equal(t.caster.x,x);
  assert.equal(t.caster.energy,0);assert.equal(t.target.hp,1000);assert.equal(t.caster.frogWarps,undefined);
  t.tick();assert.equal(t.caster.attack,null);
  t.target.x=t.caster.x+(source===0?90:-90);t.target.facing=source===0?-1:1;
  t.tick(...(source===0?[NEUTRAL,input(['A'])]:[input(['A']),NEUTRAL]));t.run(12);
  assert.equal(t.caster.hp,900);assert.equal(t.caster.frogWarps,undefined);
 }
});

test('crouch evades frontal and rear melee, teleports behind the attacker and gains energy only on a real trigger',()=>{
 for(const source of [0,1])for(const rear of [false,true]){
  const t=setup(source,90),side=source===0?1:-1;
  t.tick(...(source===0?[hold(['C']),NEUTRAL]:[NEUTRAL,hold(['C'])]));
  t.caster.facing=rear?side*-1:side;
  t.target.attack={id:'test-a',frame:4,connected:false,landed:false};
  const events=t.tick(...(source===0?[hold(),NEUTRAL]:[NEUTRAL,hold()]));
  assert.equal(t.caster.hp,1000);assert.equal(t.caster.energy,20);assert.equal(t.target.energy,0);
  assert.equal(t.caster.frogWarps.length,1);assert.equal(t.caster.attack.id,'frog-evade');
  assert.ok((t.caster.x-t.target.x)*t.target.facing<0);assert.ok(events.some(e=>e.kind==='parry'&&e.source===source));
  assert.equal(events.some(e=>e.kind==='hit'),false);assert.equal(t.target.attack.landed,false);
  t.run(30);assert.equal(t.caster.attack,null);assert.equal(t.caster.energy,20);
 }
});

test('crouch intercepts real rice projectiles without damage or root, using the owner as teleport target',()=>{
 for(const source of [0,1]){
  const t=setup(source,320);t.config.fighters[1-source]=whale.fighter;
  const attackFacing=t.target.facing;
  const c=source===0?[hold(['C']),input(['B'])]:[input(['B']),hold(['C'])];t.tick(...c);
  t.run(40,...(source===0?[hold(),NEUTRAL]:[NEUTRAL,hold()]));
  assert.equal(t.caster.hp,1000);assert.equal(t.caster.bindUntil,undefined);assert.equal(t.caster.energy,20);
  assert.equal(t.caster.frogWarps.length,1);assert.equal(t.state.entities?.some(e=>e.definition.behavior==='rice')??false,false);
  assert.ok((t.caster.frogWarps[0].toX-t.target.x)*attackFacing<0);
 }
});

test('simultaneous contacts produce one warp and one energy award; stale pre-warp hits are consumed',()=>{
 const t=setup(0,95);t.tick(hold(['C']));t.target.attack={id:'test-a',frame:4,connected:false,landed:false};
 const raw=whale.fighter.actions.find(a=>a.id==='whale-rice')??whale.fighter.actions.find(a=>a.whale==='rice');
 const definition={...raw.entities[0],velocity:{x:0,y:0},riceRadial:true};
 t.state.entities=[0,1].map(id=>({id,owner:1,slot:'B',x:t.caster.x,y:t.caster.y-65,vx:0,vy:0,facing:-1,age:0,definition}));
 const ev=t.tick(hold());assert.equal(ev.filter(e=>e.kind==='parry').length,1);assert.equal(t.caster.energy,20);assert.equal(t.caster.hp,1000);assert.equal(t.caster.frogWarps.length,1);assert.equal(t.caster.bindUntil,undefined);
});

test('up C emerges under the opponent on their support, without damage or energy; short transit is replayable',()=>{
 for(const source of [0,1])for(const elevated of [false,true]){
  const t=setup(source,700);if(elevated){t.target.y=400;t.target.ground='deck';t.config.arena.platforms=[{id:'deck',name:'deck',tier:2,left:t.target.x-120,right:t.target.x+120,y:400}];}
  t.press('C',-1);assert.equal(t.caster.attack.id,'frog-burrow');assert.equal(t.caster.x,t.target.x);assert.equal(t.caster.y,t.target.y);
  assert.equal(t.caster.ground,t.target.ground);assert.equal(t.caster.energy,0);assert.equal(t.target.hp,1000);
  const warp=t.caster.frogWarps[0];assert.equal(warp.kind,'burrow');assert.equal(warp.powered,false);
  const snapshot=structuredClone(t.state);t.state.freeze=snapshot.freeze=4;const clock=t.state.arenaFrame;
  for(let i=0;i<40;i++){assert.deepEqual(t.tick(),step(snapshot,[NEUTRAL,NEUTRAL],t.config));assert.deepEqual(t.state,snapshot);if(i<4)assert.equal(t.state.arenaFrame,clock);}
  assert.equal(t.caster.attack,null);assert.equal(t.caster.energy,0);assert.equal(t.target.hp,1000);
 }
});

test('warp destinations respect walls and empty air; empowered warps retain rune/feather flags without refilling the timer',()=>{
 const t=setup();t.target.x=t.config.arena.right;t.target.facing=-1;warpFrog(t.state,t.config,0,1,'behind');
 assert.ok(t.caster.x<=t.config.arena.right);assert.ok(t.target.x-t.caster.x>=80);
 const a=setup(0,900);a.target.ground=null;a.target.y=350;warpFrog(a.state,a.config,0,1,'burrow');assert.equal(a.caster.y,800);assert.equal(a.caster.ground,'floor');
 const p=setup(0,90);p.caster.ascendUntil=900;p.caster.energy=100;p.tick(hold(['C']));const before=p.caster.energy;
 p.target.attack={id:'test-a',frame:4,connected:false,landed:false};p.tick(hold());assert.equal(p.caster.frogWarps[0].powered,true);assert.equal(p.caster.ascendUntil,900);assert.equal(p.caster.energy,before+FROG_RULES.warpGain);
});
test('burrow seal settles at the real emergence position after body separation, then stays at that landing point',()=>{
 for(const source of [0,1]){
  const t=setup(source,700);t.caster.ascendUntil=900;t.press('C',-1);
  t.run(6);const w=t.caster.frogWarps[0];
  assert.equal(w.toX,t.caster.x);assert.equal(w.toY,t.caster.y);
  assert.notEqual(w.toX,t.target.x);
  const settled=w.toX;t.run(20);assert.equal(w.toX,settled);
 }
});
test('only empowered dodge records its real ground/air transit, preserving motion and replay through hitstop',()=>{
 for(const source of [0,1])for(const air of [false,true]){
  const plain=setup(source,1400),power=setup(source,1400);power.caster.ascendUntil=900;
  if(air)for(const t of [plain,power]){t.caster.y=550;t.caster.ground=null;t.caster.vy=2;}
  plain.press('dash');power.press('dash');assert.equal(plain.caster.frogDodge,undefined);
  assert.ok(power.caster.frogDodge);assert.equal(power.caster.frogDodge.arrivedAt,undefined);
  const clone=structuredClone(power.state);power.state.freeze=clone.freeze=3;
  const start=structuredClone(power.caster.frogDodge);
  for(let i=0;i<3;i++){assert.deepEqual(power.tick(),step(clone,[NEUTRAL,NEUTRAL],power.config));assert.deepEqual(power.state,clone);assert.deepEqual(power.caster.frogDodge,start);}
  for(let i=0;i<(air?5:7);i++){plain.tick();assert.deepEqual(power.tick(),step(clone,[NEUTRAL,NEUTRAL],power.config));assert.deepEqual(power.state,clone);}
  assert.ok(Math.abs(Math.abs(power.caster.x-power.caster.frogDodge.fromX)-2*Math.abs(plain.caster.x-power.caster.frogDodge.fromX))<1e-7);assert.equal(power.caster.y,plain.caster.y);
  assert.equal(power.caster.frogDodge.toX,power.caster.x);assert.equal(power.caster.frogDodge.toY,power.caster.y);
  assert.notEqual(power.caster.frogDodge.arrivedAt,undefined);
  assert.equal(power.caster.frogWarps,undefined);assert.equal(power.caster.frogFollowup,undefined);assert.equal(power.caster.frogCasts,undefined);
 }
});
test('empowered dodge seals stop at an actual wall and expire on arena time, without automatic attacks',()=>{
 const t=setup(0,1400);t.caster.ascendUntil=900;t.caster.x=t.config.arena.right-10;t.caster.facing=1;
 t.tick(input(['dash'],1));t.run(8);const d=t.caster.frogDodge;
 assert.equal(d.toX,t.config.arena.right);assert.equal(d.toX,t.caster.x);
 const arrival=d.arrivedAt;t.run(25);assert.equal(d.toX,t.config.arena.right);assert.equal(d.arrivedAt,arrival);
 assert.equal(t.caster.frogCasts,undefined);assert.equal(t.target.hp,1000);t.run(40);assert.equal(t.caster.frogDodge,undefined);
});

test('empowered reactive warp automatically casts skill one once after reappearing; proactive warp does not',()=>{
 for(const source of [0,1]){
  const t=setup(source,90);t.caster.ascendUntil=900;
  t.tick(...(source===0?[hold(['C']),NEUTRAL]:[NEUTRAL,hold(['C'])]));
  t.target.attack={id:'test-a',frame:4,connected:false,landed:false};t.tick(...(source===0?[hold(),NEUTRAL]:[NEUTRAL,hold()]));
  assert.equal(t.caster.frogFollowup,true);assert.equal(t.caster.frogCasts,undefined);
  const clone=structuredClone(t.state);const hits=[];
  for(let i=0;i<120;i++){const ev=t.tick();assert.deepEqual(ev,step(clone,[NEUTRAL,NEUTRAL],t.config));assert.deepEqual(t.state,clone);hits.push(...ev.filter(e=>e.kind==='hit'&&e.source===source));}
  assert.equal(t.caster.frogCasts.filter(c=>c.id==='frog-laugh').length,1);assert.equal(t.caster.frogFollowup,undefined);
  assert.deepEqual(hits.map(e=>e.amount),[39.2,39.2,61.6]);assert.equal(t.caster.hp,1000);assert.equal(t.target.hp,860);
  const up=setup(source,700);up.caster.ascendUntil=900;up.press('C',-1);up.run(90);
  assert.equal(up.caster.frogCasts,undefined);assert.equal(up.caster.frogFollowup,undefined);assert.equal(up.target.hp,1000);
 }
});

test('interruption or buff expiry cancels the automatic laugh without leaking it into later actions',()=>{
 for(const expire of [false,true]){
  const t=setup();t.caster.ascendUntil=expire?4:900;warpFrog(t.state,t.config,0,1,'behind');
  if(!expire){t.caster.attack=null;t.caster.hitstun=3;}
  t.run(80);assert.equal(t.caster.frogFollowup,undefined);assert.equal(t.caster.frogCasts,undefined);
 }
});


test('frog voice mapping follows skill activation and holding C emits only one random cue',()=>{
 const ordinary=setup(0,1200);const b=ordinary.press('B').filter(e=>e.kind==='action-audio');assert.equal(b.length,1);assert.equal(b[0].actionAudio.cue.clip,'laugh');
 const up=setup(0,1200);assert.equal(up.press('B',-1).find(e=>e.kind==='action-audio').actionAudio.cue.clip,'ha');
 for(const source of [0,1]){
  const t=setup(source,1200);const frames=[];
  for(let i=0;i<40;i++){const h=hold(i===0?['C']:[]);frames.push(...t.tick(source===0?h:NEUTRAL,source===1?h:NEUTRAL));}
  const cues=frames.filter(e=>e.kind==='action-audio');assert.equal(cues.length,1);assert.deepEqual([cues[0].actionAudio.cue.clip,...cues[0].actionAudio.cue.variants],['skill2-1','skill2-2','skill2-3','skill2-4']);
 }
 const burrow=setup(0,1200);assert.equal(burrow.press('C',-1).find(e=>e.kind==='action-audio').actionAudio.cue.clip,'skill2-1');
});


test('frog ultimate starts its BGM at frame zero with no old transformation sound',()=>{
 const t=setup(0,1200);t.caster.energy=300;const opening=t.press('ULT').filter(e=>e.kind==='action-audio');const world=t.state.arenaFrame;
 assert.deepEqual(opening.map(e=>[e.actionAudio.cue.clip,e.actionAudio.cue.channel]),[['ultimate-bgm','sfx']]);
 assert.equal(t.run(60).filter(e=>e.kind==='action-audio').length,0);assert.equal(t.state.arenaFrame,world);
 assert.equal(frog.audio.ascension,undefined);
});


test('holding C during a normal or laugh enters crouch on the exact recovery-end tick on either seat',()=>{
 for(const source of [0,1])for(const powered of [false,true])for(const key of ['A','B']){
  const t=setup(source,1200);if(powered)t.caster.ascendUntil=2000;
  t.press(key);t.run(2);const id=t.caster.attack.id;
  const action=frog.fighter.actions.find(a=>a.id===id),end=action.startup+action.active+action.recovery;
  let pressed=true;
  while(t.caster.attack?.id===id){
   const before=t.caster.attack.frame,command=hold(pressed?['C']:[]);pressed=false;
   t.tick(...(source===0?[command,NEUTRAL]:[NEUTRAL,command]));
   assert.equal(t.caster.attack?.id,before+1>=end?'frog-crouch':id);
  }
  assert.equal(t.caster.attack.frame,0);assert.equal(t.caster.energy,0);
  t.run(25,...(source===0?[hold(),NEUTRAL]:[NEUTRAL,hold()]));
  assert.equal(t.caster.attack.id,'frog-crouch');
  t.tick();assert.equal(t.caster.attack,null);
 }
});
test('releasing C before recovery ends cannot leave a stale crouch intent',()=>{
 for(const source of [0,1]){
  const t=setup(source,1200);t.press('B');t.run(2);
  t.tick(...(source===0?[hold(['C']),NEUTRAL]:[NEUTRAL,hold(['C'])]));
  t.run(100);assert.equal(t.caster.attack,null);assert.equal(t.caster.frogWarps,undefined);
 }
});

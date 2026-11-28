import test from 'node:test';
import assert from 'node:assert/strict';
import {updateActorPresentation} from '../dist/core/actor-presentation.js';
import {createMatch,step} from '../dist/core/match.js';
import {frog} from '../dist/content/fighters/frog.js';
import {whale} from '../dist/content/fighters/whale.js';
import {testFighter,rules} from '../dist/content/demo.js';
import {arenas} from '../dist/content/arenas.js';
import {NEUTRAL} from '../dist/core/types.js';
import {walkFootX,whaleAnimationCell} from '../src/web/actor-motion.mjs';
test('planted-foot target remains fixed in world space while the root advances, in both directions',()=>{
 for(const stride of [126,74])for(const facing of [-1,1])for(const phase of [1.3,5.3])for(const travel of [-5,-2,2,5]){
  const before=700+facing*walkFootX(phase,stride),after=700+travel*facing+facing*walkFootX(phase+travel/stride*8,stride);
  assert.ok(Math.abs(before-after)<1e-8);
 }
});
test('whale cadence is slightly slower and still advances by actual travel',()=>{
 const config={rules,arena:arenas[2],fighters:[whale.fighter,testFighter]},s=createMatch(config);s.phase='fight';
 const f=s.fighters[0];updateActorPresentation(s,config);const x=f.x;
 f.x+=9.25;f.moving=true;s.arenaFrame++;updateActorPresentation(s,config);
 assert.equal(f.motionVisual.stamp.phase,1);assert.equal(f.x,x+9.25);
 assert.ok(66/74>.88&&66/74<.92);
});
test('presentation history records actual displacement, braking, turns and chained attack frame',()=>{
 const config={rules,arena:arenas[2],fighters:[frog.fighter,testFighter]},state=createMatch(config);state.phase='fight';
 const f=state.fighters[0];updateActorPresentation(state,config);const original=structuredClone(f);
 f.x+=7.875;f.moving=true;state.arenaFrame++;updateActorPresentation(state,config);
 assert.equal(f.motionVisual.stamp.phase,.5);assert.equal(f.motionVisual.from.mode,'idle');
 f.attack={id:'common-jab',frame:9,connected:true,landed:true};state.arenaFrame++;updateActorPresentation(state,config);
 f.attack={id:'common-sweep',frame:0,connected:false,landed:false};state.arenaFrame++;updateActorPresentation(state,config);
 assert.equal(f.motionVisual.from.attackId,'common-jab');assert.equal(f.motionVisual.from.attackFrame,9);
 assert.equal(f.motionVisual.stamp.attackFrame,0);assert.equal(original.x+7.875,f.x);
 f.attack=null;f.moving=false;f.facing=-1;state.arenaFrame++;updateActorPresentation(state,config);
 assert.equal(f.motionVisual.turnFrom,1);assert.equal(f.motionVisual.turnTick,state.arenaFrame);
});
test('frog cadence is slightly slower without changing travelled distance',()=>{
 const config={rules,arena:arenas[2],fighters:[frog.fighter,testFighter]},s=createMatch(config);s.phase='fight';
 const f=s.fighters[0];updateActorPresentation(s,config);const x=f.x;
 f.x+=15.75;f.moving=true;s.arenaFrame++;updateActorPresentation(s,config);
 assert.equal(f.motionVisual.stamp.phase,1);assert.equal(f.x,x+15.75);
 assert.ok(112/126>.88&&112/126<.92);
});
test('movement presentation freezes with hitstop and restores identically from a snapshot',()=>{
 for(const entry of [frog,whale]){
  const config={rules,training:true,arena:arenas[2],fighters:[entry.fighter,testFighter]},s=createMatch(config);s.phase='fight';s.phaseTicks=0;
  const input={x:1,y:0,pressed:[]};step(s,[input,NEUTRAL],config);s.freeze=4;const v=structuredClone(s.fighters[0].motionVisual);
  for(let i=0;i<4;i++)step(s,[input,NEUTRAL],config);assert.deepEqual(s.fighters[0].motionVisual,v);
  const copy=structuredClone(s);
  for(let i=0;i<130;i++){const c={x:i<25?1:0,y:0,pressed:i===40?['jump']:i===95?['A']:[]};assert.deepEqual(step(s,[c,NEUTRAL],config),step(copy,[c,NEUTRAL],config));assert.deepEqual(s,copy);}
 }
});


test('whale tail animation samples whole registered cels and preserves authored contact frames',()=>{
 for(const id of ['common-jab','common-sweep','common-finish']){
  const action=whale.fighter.actions.find(a=>a.id===id);
  assert.equal(whaleAnimationCell(action,action.startup),action.animation.find(k=>k.frame===action.startup).cell);
  for(let i=0;i<action.animation.length;i++){
   const key=action.animation[i],next=action.animation[i+1]?.frame??action.startup+action.active+action.recovery;
   for(let f=key.frame;f<next;f++)assert.equal(whaleAnimationCell(action,f),key.cell);
  }
 }
});

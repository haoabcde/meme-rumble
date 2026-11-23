import test from 'node:test';
import assert from 'node:assert/strict';
import {frogMotionSample,FROG_BASIC_POSES,FROG_SCENE_POSES} from '../src/web/frog-motion.mjs';
const fighter=()=>({hp:1000,ground:'floor',vy:0,recovery:null,poseEvent:undefined});
const world=()=>({phase:'fight',frame:0,arenaFrame:0,phaseTicks:0,result:null});
test('authored frog entry finishes before controls unlock and never mutates state',()=>{
 const f=fighter(),s={...world(),phase:'ready',phaseTicks:120},initial=structuredClone(f);
 const cells=[];for(const elapsed of [0,44,60,80,104]){s.phaseTicks=120-elapsed;cells.push(frogMotionSample(f,s)?.cell??null);}
 assert.deepEqual(cells,[0,1,2,3,null]);assert.deepEqual(f,initial);
 assert.equal(FROG_BASIC_POSES.length,16);assert.equal(FROG_SCENE_POSES.length,8);
});
test('victory and defeat use actual seat rather than screen direction, including timeout draws',()=>{
 for(const winner of [0,1,null])for(const seat of [0,1]){
  const sample=frogMotionSample(fighter(),{...world(),phase:'round-over',phaseTicks:30,result:{winner}},seat);
  assert.equal(sample.bank,'scene');assert.ok((winner===seat?[4,5]:[6,7]).includes(sample.cell));
 }
});
test('airborne KO is not prematurely seated; real recovery proceeds down, supported rise, standing',()=>{
 const f={...fighter(),hp:0,ground:null,vy:8},s={...world(),phase:'round-over',phaseTicks:90,result:{winner:1}};
 assert.equal(frogMotionSample(f,s,0).cell,11);f.ground='floor';assert.equal(frogMotionSample(f,s,0).cell,12);
 f.hp=1000;s.phase='fight';f.recovery={phase:'down',remaining:30};assert.equal(frogMotionSample(f,s).cell,12);
 f.recovery={phase:'rise',remaining:18};assert.equal(frogMotionSample(f,s).cell,13);
 f.recovery.remaining=6;assert.equal(frogMotionSample(f,s).cell,14);f.recovery=null;assert.equal(frogMotionSample(f,s),null);
});
test('frog jump, apex, fall, landing and guard-break are different authored frames',()=>{
 const f={...fighter(),ground:null,vy:-10},s=world();
 assert.equal(frogMotionSample(f,s).cell,2);f.vy=0;assert.equal(frogMotionSample(f,s).cell,3);
 f.vy=8;assert.equal(frogMotionSample(f,s).cell,4);f.ground='floor';f.poseEvent={kind:'land',tick:0};assert.equal(frogMotionSample(f,s).cell,5);
 s.arenaFrame=6;assert.equal(frogMotionSample(f,s).cell,6);f.guardBreak=10;assert.equal(frogMotionSample(f,s).cell,15);
});

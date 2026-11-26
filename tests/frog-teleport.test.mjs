import test from 'node:test';
import assert from 'node:assert/strict';
import {warpDiscScale} from '../src/web/frog-warp.mjs';
import {teleportPoint,teleportWindow,dodgeTeleportSample} from '../src/web/frog-teleport.mjs';
test('gold teleport curve reaches the actual origin and endpoint on either side and different heights',()=>{
 for(const dx of [-600,600]){
  const w={fromX:900,fromY:500,toX:900+dx,toY:330};
  assert.deepEqual(teleportPoint(w,0),{x:900,y:406});
  assert.equal(teleportPoint(w,1).x,w.toX);
  assert.ok(Math.abs(teleportPoint(w,1).y-(w.toY-94))<1e-9);
  assert.ok(teleportPoint(w,.5).y<345);
 }
 assert.equal(teleportWindow(6).head,1);
 assert.equal(teleportWindow(44).alpha,0);
 assert.equal(teleportWindow(42).tail,1);
 assert.ok(teleportWindow(24).alpha>.9&&teleportWindow(24).tail<.5);
});
test('burrow seal opens once, holds through emergence, then closes without breathing or reopening',()=>{
 assert.equal(warpDiscScale(0),0);assert.equal(warpDiscScale(6),1);assert.equal(warpDiscScale(16),1);
 let previous=0;for(let age=0;age<=6;age+=.25){const n=warpDiscScale(age);assert.ok(n>=previous);previous=n;}
 for(let age=6;age<=16;age+=.25)assert.equal(warpDiscScale(age),1);
 previous=1;for(let age=16;age<=38;age+=.25){const n=warpDiscScale(age);assert.ok(n>=0&&n<=previous);previous=n;}
 assert.equal(warpDiscScale(32),0);assert.equal(warpDiscScale(38),0);
});
test('dodge trail follows movement first; its destination seal opens and closes once after actual arrival',()=>{
 const d={tick:20};assert.equal(dodgeTeleportSample(d,24).sealScale,0);assert.equal(dodgeTeleportSample(d,24).head,1);
 d.arrivedAt=27;
 assert.equal(dodgeTeleportSample(d,27).sealScale,0);
 assert.equal(dodgeTeleportSample(d,30).sealScale,1);
 assert.equal(dodgeTeleportSample(d,33).sealScale,1);
 assert.equal(dodgeTeleportSample(d,51).sealScale,1);
 assert.ok(dodgeTeleportSample(d,63).sealScale<dodgeTeleportSample(d,55).sealScale);
 assert.equal(dodgeTeleportSample(d,71).sealScale,0);
 assert.equal(dodgeTeleportSample(d,65).alpha,0);
});
test('empowered seal lingers after full emergence, then closes monotonically without reviving the trail',()=>{
 assert.equal(warpDiscScale(16,true),1);assert.equal(warpDiscScale(34,true),1);
 let previous=1;for(let age=34;age<=60;age+=.25){const n=warpDiscScale(age,true);assert.ok(n>=0&&n<=previous);previous=n;}
 assert.equal(warpDiscScale(54,true),0);
 const d={tick:0,arrivedAt:8},late=dodgeTeleportSample(d,47);
 assert.equal(late.alpha,0);assert.ok(late.sealScale>0);
});

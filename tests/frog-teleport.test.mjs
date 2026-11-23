import test from 'node:test';
import assert from 'node:assert/strict';
import {warpDiscScale} from '../src/web/frog-warp.mjs';
import {teleportPoint,teleportWindow} from '../src/web/frog-teleport.mjs';
test('gold teleport curve reaches the actual origin and endpoint on either side and different heights',()=>{
 for(const dx of [-600,600]){
  const w={fromX:900,fromY:500,toX:900+dx,toY:330};
  assert.deepEqual(teleportPoint(w,0),{x:900,y:430});
  assert.equal(teleportPoint(w,1).x,w.toX);
  assert.ok(Math.abs(teleportPoint(w,1).y-(w.toY-70))<1e-9);
  assert.ok(teleportPoint(w,.5).y<345);
 }
 assert.equal(teleportWindow(6).head,1);
 assert.equal(teleportWindow(32).alpha,0);
 assert.equal(teleportWindow(29).tail,1);
});
test('burrow disc expands then contracts without an orientation change',()=>{
 assert.ok(warpDiscScale(0)<warpDiscScale(3));
 assert.ok(warpDiscScale(3)<warpDiscScale(6));
 assert.ok(warpDiscScale(6)>warpDiscScale(12));
 for(let age=0;age<=38;age+=.25)assert.ok(Number.isFinite(warpDiscScale(age))&&warpDiscScale(age)>0);
});

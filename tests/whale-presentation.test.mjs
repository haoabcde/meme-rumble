import test from 'node:test';
import assert from 'node:assert/strict';
import {orbitAngle,leapSample} from '../src/web/whale-presentation.mjs';
test('travelling tornado whale completes a visible orbit every 24 ticks independently of map distance',()=>{
 for(const wind of [30,110,240])assert.ok(Math.abs(orbitAngle(27,wind,true)-orbitAngle(3,wind,true)-Math.PI*2)<1e-9);
 assert.equal(orbitAngle(18,40,true),orbitAngle(18,240,true));
 assert.equal(orbitAngle(48,20,false),-2.7+Math.PI*2*1.05);
});
test('three hero leaps gain scale, accelerate out of water, linger at the crest and return with no extra damage schedule',()=>{
 const first=leapSample(0,0),mid=leapSample(16,0),last=leapSample(48,8);
 assert.equal(first.height,0);assert.ok(Math.abs(last.height)<1e-12);assert.ok(mid.height>.99);
 assert.ok(leapSample(5,0).height>.6);assert.ok(leapSample(24,0).height>.97);
 assert.ok(leapSample(16,8).width>mid.width);assert.ok(leapSample(16,8).peak>mid.peak);
 for(let i=0;i<49;i++)assert.ok(leapSample(i,0).pose>=0&&leapSample(i,0).pose<7);
});

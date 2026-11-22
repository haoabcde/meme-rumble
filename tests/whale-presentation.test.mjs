import test from 'node:test';
import assert from 'node:assert/strict';
import {orbitAngle,orbitSample,leapSample} from '../src/web/whale-presentation.mjs';
test('travelling and stationary tornado whales share shape, rise and speed, repeating only on long journeys',()=>{
 for(const wind of [60,110,240])for(let age=0;age<48;age++)assert.deepEqual(orbitSample(age,wind,true),orbitSample(age,20,false));
 for(let age=0;age<48;age++)assert.deepEqual(orbitSample(age+48,240,true),orbitSample(age,20,false));
 assert.equal(orbitAngle(48),-2.7+Math.PI*2*1.05);
 assert.equal(orbitSample(138,110,true).fade,0);
});
test('three hero leaps gain scale, accelerate out of water, linger at the crest and return with no extra damage schedule',()=>{
 const first=leapSample(0,0),mid=leapSample(16,0),last=leapSample(48,8);
 assert.equal(first.height,0);assert.ok(Math.abs(last.height)<1e-12);assert.ok(mid.height>.99);
 assert.ok(leapSample(5,0).height>.6);assert.ok(leapSample(24,0).height>.97);
 assert.ok(leapSample(16,8).width>mid.width);assert.ok(leapSample(16,8).peak>mid.peak);
 for(let i=0;i<49;i++)assert.ok(leapSample(i,0).pose>=0&&leapSample(i,0).pose<7);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {orbitAngle,orbitSample,eruptionSample,ERUPTIONS} from '../src/web/whale-presentation.mjs';
test('travelling and stationary tornado whales share shape, rise and speed, repeating only on long journeys',()=>{
 for(const wind of [60,110,240])for(let age=0;age<48;age++)assert.deepEqual(orbitSample(age,wind,true),orbitSample(age,20,false));
 for(let age=0;age<48;age++)assert.deepEqual(orbitSample(age+48,240,true),orbitSample(age,20,false));
 assert.equal(orbitAngle(48),-2.7+Math.PI*2*1.05);
 assert.equal(orbitSample(138,110,true).fade,0);
});
test('irregular water whales only rise, leave the map and finish with a larger vertical whale',()=>{
 assert.equal(ERUPTIONS.length,12);assert.equal(ERUPTIONS[0].at,0);assert.equal(ERUPTIONS[11].at,77);
 assert.ok(new Set(ERUPTIONS.slice(1).map((x,i)=>x.at-ERUPTIONS[i].at)).size>3);
 for(let i=0;i<12;i++){
  assert.ok(Math.abs(ERUPTIONS[i].degrees)<=30);
  let previous=Infinity;
  for(let age=0;age<77;age++){const p=eruptionSample(age,i);assert.ok(p.y<=previous);previous=p.y;assert.ok(p.pose>=0&&p.pose<3.1);}
  assert.ok(eruptionSample(60,i).y< -1500);
 }
 const last=eruptionSample(30,11);assert.equal(last.x,0);assert.equal(last.angle,-Math.PI/2);
 assert.ok(last.width>2*Math.max(...ERUPTIONS.slice(0,11).map(x=>x.width)));
});

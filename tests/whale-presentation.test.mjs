import test from 'node:test';
import assert from 'node:assert/strict';
import {orbitAngle,orbitSample,eruptionSample,ERUPTIONS,waterSubframe} from '../src/web/whale-presentation.mjs';
import {waterSpine} from '../src/web/water-flow.mjs';
import {POOL,poolMouth,poolCutY} from '../src/web/water-pool.mjs';

test('pool openings occupy front and rear depth and all root widths fit the elliptical footprint',()=>{
 assert.ok(new Set(ERUPTIONS.map(e=>poolMouth(e).y.toFixed(1))).size>=6);
 assert.ok(ERUPTIONS.some(e=>e.depth<0)&&ERUPTIONS.some(e=>e.depth>0));
 for(const spec of ERUPTIONS){
  const m=poolMouth(spec);
  for(const x of [m.x-m.width/2,m.x,m.x+m.width/2])assert.ok((x/POOL.rx)**2+(m.y/POOL.ry)**2<=1);
 }
 assert.ok(poolCutY(0,.4)>poolCutY(0,-.4));
 assert.ok(poolCutY(130,.4)<poolCutY(0,.4));
});

test('subtick water presentation is continuous while hitstop and cinematics keep the pool still',()=>{
 for(const fraction of [0,.25,.5,.75]){
  assert.equal(waterSubframe(fraction),fraction);
  assert.equal(waterSubframe(fraction,1),0);
  assert.equal(waterSubframe(fraction,0,true),0);
 }
 for(let i=0;i<12;i++)for(let frame=0;frame<40;frame++){
  const samples=[0,.25,.5,.75,1].map(t=>eruptionSample(frame+t,i));
  for(let j=1;j<samples.length;j++)assert.ok(samples[j].y<samples[j-1].y);
 }
 assert.equal(waterSubframe(NaN),0);
});

test('water whale keeps swimming after opening its mouth, with a steadier head than tail',()=>{
 const tail=[],head=[];
 for(let i=0;i<240;i++){
  const phase=i/240*Math.PI*2;
  tail.push(waterSpine(phase,.1));head.push(waterSpine(phase,.9));
  assert.ok(Math.abs(waterSpine(phase+.001,.1)-waterSpine(phase,.1))<.01);
 }
 assert.ok(Math.max(...tail)>4);
 assert.ok(Math.max(...head)<.2);
 assert.ok(new Set(Array.from({length:60},(_,i)=>eruptionSample(12+i/4,0).pose)).size>50);
});
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

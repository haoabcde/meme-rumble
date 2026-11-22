import test from 'node:test';
import assert from 'node:assert/strict';
import {createPixelSimulation,selectedEffects} from '../src/web/pixel-fx.mjs';
import {holyFanSample} from '../src/web/holy-fan.mjs';

test('all selected library effects render their full timelines with the demo actor hidden',()=>{
 for(const name of Object.keys(selectedEffects)){
  const {f,fx}=createPixelSimulation(name,name==='thunder'?'blue':true);
  let visible=false;
  for(let i=0;i<=Math.ceil(selectedEffects[name].meta.duration*30);i++){
   for(const layer of ['back','front']){
    f.color.fill(0);f.light.fill(0);
    assert.doesNotThrow(()=>fx.draw(f,layer),`${name} frame ${i} ${layer}`);
    visible ||= f.color.some(Boolean)||f.light.some(Boolean);
   }
   fx.update(1/30);
  }
  assert.ok(visible,name+' must retain visible effects without its demo actor');
 }
});
test('feathers retain the original warm gold-white material and warm glow',()=>{
 const feather=createPixelSimulation('feather',true).fx.options;
 assert.equal(feather.glow,'#fff0c0');assert.equal(feather.palette.at(-1),'#ffffff');
 assert.notEqual(feather.palette[3].slice(1,3),feather.palette[3].slice(5,7));
 assert.equal(createPixelSimulation('pillar',true).fx.options.featherPalette,undefined);
});
test('all seven moving holy shafts span the full map without stretching the sun',()=>{
 for(const [foot,height]of [[2024,2448],[300,1100]]){
  const a=holyFanSample(1,foot,height),b=holyFanSample(1.3,foot,height);
  assert.equal(a.shafts.length,7);assert.equal(a.alpha,1);
  assert.ok(new Set(a.shafts.map(s=>s.topX)).size===7);
  for(let i=0;i<7;i++){
   assert.ok(a.shafts[i].top< -height);assert.equal(a.shafts[i].bottom,foot);
   assert.notEqual(a.shafts[i].topX,b.shafts[i].topX);
   assert.ok(a.shafts[i].topWidth>0&&Number.isFinite(a.shafts[i].topX));
  }
 }
 assert.equal(holyFanSample(0,2024,2448).alpha,0);
 assert.equal(holyFanSample(3,2024,2448).alpha,0);
});

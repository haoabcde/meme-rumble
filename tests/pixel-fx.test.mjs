import test from 'node:test';
import assert from 'node:assert/strict';
import {createPixelSimulation,selectedEffects,FEATHER_WHITE} from '../src/web/pixel-fx.mjs';

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
test('feather bursts and pillar feathers use a white ramp independently of gold light',()=>{
 assert.deepEqual(createPixelSimulation('feather',true).fx.options.palette,FEATHER_WHITE);
 assert.deepEqual(createPixelSimulation('pillar',true).fx.options.featherPalette,FEATHER_WHITE);
 assert.notDeepEqual(createPixelSimulation('pillar',true).fx.options.palette,FEATHER_WHITE);
});

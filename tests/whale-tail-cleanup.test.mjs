import test from 'node:test';
import assert from 'node:assert/strict';
import {removeDetachedTailPixels,whaleTailPose} from '../src/web/whale-tail-cleanup.mjs';
test('tail recovery cleanup removes detached scraps, preserving body colors and soft edges',()=>{
 const w=32,h=32,p=new Uint8ClampedArray(w*h*4),set=(x,y,a)=>p.set([45,87,143,a],(y*w+x)*4);
 for(let y=7;y<25;y++)for(let x=5;x<20;x++)set(x,y,255);
 set(20,15,9); // translucent body fringe
 set(28,12,255);set(29,12,100);set(28,13,3); // original cutout scraps
 const before=p.slice();removeDetachedTailPixels(p,w,h);
 for(let y=7;y<25;y++)for(let x=5;x<20;x++)assert.deepEqual(p.slice((y*w+x)*4,(y*w+x)*4+4),before.slice((y*w+x)*4,(y*w+x)*4+4));
 assert.equal(p[(15*w+20)*4+3],9);
 for(const [x,y]of [[28,12],[29,12],[28,13]])assert.equal(p[(y*w+x)*4+3],0);
});
test('unaffected tail poses bypass cleanup entirely',()=>{
 for(const index of [12,20,28,29,30,31,32,35,77])assert.equal(whaleTailPose({},index),undefined);
});

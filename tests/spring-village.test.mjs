import assert from 'node:assert/strict';
import test from 'node:test';
import { createMatch, step } from '../dist/core/match.js';
import { NEUTRAL } from '../dist/core/types.js';
import { rules } from '../dist/content/demo.js';
import { springVillage as arena } from '../dist/content/spring-village.js';
import { roster } from '../dist/content/roster.js';
const frame=(pressed=[],x=0,y=0)=>({pressed,x,y});
const inputs=(seat,i)=>seat?[NEUTRAL,i]:[i,NEUTRAL];
function setup(fighter,seat,x){const cfg={arena,rules,training:true,fighters:[fighter,fighter]},s=createMatch(cfg);for(let i=0;i<120;i++)step(s,[NEUTRAL,NEUTRAL],cfg);Object.assign(s.fighters[seat],{x,y:arena.floor,ground:'floor'});s.fighters[1-seat].x=x<arena.width/2?arena.right:arena.left;return {cfg,s,f:s.fighters[seat]};}
function land(o,seat,id,twice=false,drop=false){for(let i=0;i<90;i++){const pressed=i===0||(twice&&i===16)?['jump']:[];const events=step(o.s,inputs(seat,frame(pressed,0,drop&&i===0?1:0)),o.cfg);if(!i)assert.ok(events.some(e=>e.kind===(drop?'drop':'jump')));if(o.f.ground)break;}assert.equal(o.f.ground,id,`${o.cfg.fighters[seat].id} P${seat+1}: expected ${id}, got ${o.f.ground}`);}
const routes=[
 ['west-low',500,[['west-low',true]]],
 ['west-mid',1050,[['west-mid',true]]],
 ['west-high',1340,[['west-mid',true],['west-high',false]]],
 ['east-mid',2545,[['east-low',false],['east-bridge',false],['east-mid',false]]],
 ['east-bridge',2950,[['east-bridge',true]]],
 ['east-low',2800,[['east-low',false]]],
 ['far-east-low',3400,[['far-east-low',true]]],
 ['far-east-mid',3690,[['far-east-low',true],['far-east-mid',false]]],
 ['back-west',1340,[['west-mid',true],['west-high',false],['back-west',true]]],
 ['back-center',2545,[['east-low',false],['east-bridge',false],['east-mid',false],['back-center',true]]],
 ['back-east',3690,[['far-east-low',true],['far-east-mid',false],['back-east',true]]]
];
test('spring village: every fighter can reach all 11 painted roof surfaces',()=>{for(const {fighter} of roster)for(const seat of [0,1])for(const [target,x,path] of routes){const o=setup(fighter,seat,x);for(const [id,twice] of path)land(o,seat,id,twice);assert.equal(o.f.ground,target);}});
test('spring village: both seats can drop from each high gallery to its lower roof',()=>{for(const {fighter} of roster)for(const seat of [0,1])for(const [top,low,x,path] of [
 ['back-west','west-high',1340,[['west-mid',true],['west-high',false]]],
 ['back-center','east-mid',2545,[['east-low',false],['east-bridge',false],['east-mid',false]]],
 ['back-east','far-east-mid',3690,[['far-east-low',true],['far-east-mid',false]]]
]){const o=setup(fighter,seat,x);for(const [id,twice] of path)land(o,seat,id,twice);land(o,seat,top,true);land(o,seat,low,false,true);}});
test('spring village: the entire ground is clear for pursuit in both directions',()=>{for(const {fighter} of roster)for(const seat of [0,1]){const dir=seat?-1:1,start=dir>0?arena.left+5:arena.right-5,o=setup(fighter,seat,start);for(let i=0;i<800&&Math.abs(o.f.x-(dir>0?arena.right:arena.left))>fighter.run;i++){o.s.fighters[1-seat].x=dir>0?arena.left:arena.right;step(o.s,inputs(seat,frame([],dir)),o.cfg);assert.equal(o.f.ground,'floor');}assert.ok(Math.abs(o.f.x-(dir>0?arena.right:arena.left))<=fighter.run);}});

test('spring village: both seats can move from central spawn to a nearby low roof',()=>{
  for(const {fighter} of roster) for(const seat of [0,1]) {
    const o=setup(fighter,seat,arena.spawn[seat]);
    const destination=seat?2545:1360;
    for(let i=0;i<150&&Math.abs(o.f.x-destination)>fighter.run;i++){
      step(o.s,inputs(seat,frame([],Math.sign(destination-o.f.x))),o.cfg);
      assert.equal(o.f.ground,'floor');
    }
    land(o,seat,seat?'east-low':'west-mid',!seat);
  }
});

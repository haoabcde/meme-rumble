import type {ActionDefinition,Box,FighterAction,FighterState,MatchConfig,MatchState} from './types.js';
import {platformAt} from './terrain.js';

export const FROG_RULES=Object.freeze({buffTicks:900,fadeTicks:36,fadeLife:180,body:80,laughRadius:240,poweredLaughRange:1.4,poweredLaughDamage:1.4,poweredSpeed:1.5,incomingDamage:.7,warpGain:20,warpHidden:6});
export const frogPowered=(f:FighterState,state:MatchState)=>(f.ascendUntil??0)>state.arenaFrame;
export function frogBox(box:Box,scale:number):Box{return {x:box.x*scale,y:(box.y+65)*scale-65,w:box.w*scale,h:box.h*scale};}
export function frogAction(action:FighterAction|undefined,f:FighterState,state:MatchState):FighterAction|undefined{
 if(!action||'counterTo' in action||!frogPowered(f,state))return action;
 const reach='frog' in action&&action.frog==='laugh'?FROG_RULES.poweredLaughRange:1.5;
 const damage=action.frog==='laugh'||action.frog==='global'?FROG_RULES.poweredLaughDamage:1.5;
 const scaleDamage=(n:number)=>Math.round(n*damage*1000)/1000;
 return {...action,damage:scaleDamage(action.damage),hitbox:frogBox(action.hitbox,1.5),
  hitTimeline:action.hitTimeline?.map(w=>({...w,boxes:w.boxes.map(b=>frogBox(b,1.5)),...(w.damage!==undefined?{damage:scaleDamage(w.damage)}:{})})),
  entities:action.entities?.map(e=>({...e,damage:scaleDamage(e.damage),hitbox:e.behavior==='frog-global'?e.hitbox:{x:e.hitbox.x*reach,y:e.hitbox.y*reach,w:e.hitbox.w*reach,h:e.hitbox.h*reach}}))};
}
export function frogCanStart(action:FighterAction,f:FighterState,state:MatchState){
 if(!('frog' in action))return true;
 if((action.frog==='laugh'||action.frog==='global')&&!f.ground&&!frogPowered(f,state))return false;
 return !(action.frog==='ascend'&&frogPowered(f,state));
}
export function startFrog(action:ActionDefinition,f:FighterState,state:MatchState,config:MatchConfig,seat:0|1){
 if(action.frog==='burrow')warpFrog(state,config,seat,seat===0?1:0,'burrow');
 if(action.slot==='A'||action.frog==='laugh'||action.frog==='global'){
  (f.frogCasts??=[]).push({id:action.id,tick:state.arenaFrame,x:f.x,y:f.y,facing:f.facing,powered:frogPowered(f,state),startup:action.startup});
 }
}
/** Holding C catches contact from either side; it is not a guard or a damaging attack. */
export function frogCrouching(f:FighterState){return f.attack?.id==='frog-crouch'&&Boolean(f.ground)&&!f.hitstun&&!f.blockstun&&!f.recovery;}
export function warpFrog(state:MatchState,config:MatchConfig,seat:0|1,target:0|1,kind:'behind'|'burrow'){
 const f=state.fighters[seat],enemy=state.fighters[target],arena=config.arena;
 const fromX=f.x,fromY=f.y,powered=frogPowered(f,state);
 const gap=(config.fighters[seat].bodyWidth+config.fighters[target].bodyWidth)/2+16;
 const bound=(n:number)=>Math.max(arena.left,Math.min(arena.right,n));
 let x=kind==='burrow'?enemy.x:bound(enemy.x-enemy.facing*gap);
 // At a wall, use the nearest free side rather than spawning inside an opponent.
 if(kind==='behind'&&Math.abs(x-enemy.x)<gap-1)x=bound(enemy.x+enemy.facing*gap);
 const decks=arena.platforms.map(p=>platformAt(p,state.arenaFrame)).filter(p=>x>=p.left&&x<=p.right);
 const support=kind==='burrow'?decks.filter(p=>p.y>=enemy.y-.01).sort((a,b)=>a.y-b.y)[0]:decks.find(p=>Math.abs(p.y-enemy.y)<.01);
 f.x=x;f.y=support?.y??(kind==='burrow'?arena.floor:Math.min(enemy.y,arena.floor));
 f.ground=support?.id??(f.y>=arena.floor?'floor':null);f.vy=0;f.push=0;f.dash=0;f.dashActive=false;
 f.guarding=false;f.moving=false;f.ignorePlatform=null;f.buffer=[];delete f.guardCounterLeft;
 f.facing=f.x===enemy.x?enemy.facing===1?-1:1:f.x<enemy.x?1:-1;
 if(f.ground){f.airActionUsed=false;f.jumpCount=0;f.secondApex=false;}
 (f.frogWarps??=[]).push({tick:state.arenaFrame,fromX,fromY,toX:f.x,toY:f.y,powered,kind});
 if(kind==='behind'){
  f.attack={id:'frog-evade',frame:0,connected:true,landed:false};
  if(powered)f.frogFollowup=true;
  if(!powered)f.energy=Math.min(300,(f.energy??0)+FROG_RULES.warpGain);
 }
}
export function finishAscension(f:FighterState,state:MatchState){
 if(f.attack?.id!=='frog-ascend')return;
 f.ascendUntil=state.arenaFrame+FROG_RULES.buffTicks;f.energy=300;
 delete f.ascendEndVisual;
 f.ascendVisual={tick:state.arenaFrame,x:f.x,y:f.y};
 f.poseEvent={kind:'ascend',tick:state.arenaFrame};
}
export function tickAscension(f:FighterState,state:MatchState){
 if(f.frogWarps?.length){f.frogWarps=f.frogWarps.filter(w=>state.arenaFrame-w.tick<150);if(!f.frogWarps.length)delete f.frogWarps;}
 if(f.ascendVisual&&state.arenaFrame-f.ascendVisual.tick>220)delete f.ascendVisual;
 if(f.ascendEndVisual&&state.arenaFrame-f.ascendEndVisual.tick>=FROG_RULES.fadeLife)delete f.ascendEndVisual;
 if(f.frogCasts?.length){f.frogCasts=f.frogCasts.filter(c=>state.arenaFrame-c.tick<210);if(!f.frogCasts.length)delete f.frogCasts;}
 if(f.ascendUntil===undefined)return;
 const remaining=Math.max(0,f.ascendUntil-state.arenaFrame);
 f.energy=300*remaining/FROG_RULES.buffTicks;
 if(!remaining){
  f.ascendEndVisual={tick:state.arenaFrame,x:f.x,y:f.y};
  delete f.ascendUntil;
 }
}

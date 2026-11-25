import type {ActionDefinition,Box,FighterAction,FighterState,MatchConfig,MatchState} from './types.js';
import {platformAt} from './terrain.js';

export const FROG_RULES=Object.freeze({buffTicks:900,fadeTicks:36,fadeLife:180,body:80,laughRadius:240,poweredLaughRange:1.4,poweredLaughDamage:1.4,poweredSpeed:1.5,incomingDamage:.7,warpGain:20,warpHidden:6});
export const frogPowered=(f:FighterState,state:MatchState)=>(f.ascendUntil??0)>state.arenaFrame;
export function frogBox(box:Box,scale:number):Box{return {x:box.x*scale,y:(box.y+65)*scale-65,w:box.w*scale,h:box.h*scale};}
export function frogAction(action:FighterAction|undefined,f:FighterState,state:MatchState):FighterAction|undefined{
 if(!action||'counterTo' in action||!frogPowered(f,state))return action;
 const reach='frog' in action&&action.frog==='laugh'?FROG_RULES.poweredLaughRange:1.5;
 const basic=action.slot==='A';
 const combo=['common-jab','common-sweep','frog-left-kick','frog-ha','common-finish'].indexOf(action.id);
 const attackBox=(box:Box)=>{const b=frogBox(box,1.5);return basic?{...b,x:b.x*1.2,w:b.w*1.2}:b;};
 const hitClip=basic?'holy-melee-hit':'holy-hit';
 const damage=action.frog==='laugh'||action.frog==='global'?FROG_RULES.poweredLaughDamage:1.5;
 const scaleDamage=(n:number)=>Math.round(n*damage*1000)/1000;
 return {...action,audioTimeline:action.audioTimeline?.map(c=>c.channel==='sfx'?{...c,clip:basic&&c.clip==='melee-swing'?'holy-combo-'+(combo<0?3:combo+1):['wave','global-wave'].includes(c.clip)?'holy-wave':c.clip}:c),feedback:action.feedback?{...action.feedback,audio:{clip:hitClip}}:action.feedback,damage:scaleDamage(action.damage),hitbox:attackBox(action.hitbox),
  hitTimeline:action.hitTimeline?.map(w=>({...w,boxes:w.boxes.map(attackBox),...(w.damage!==undefined?{damage:scaleDamage(w.damage)}:{})})),
  entities:action.entities?.map(e=>({...e,feedback:e.feedback?{...e.feedback,audio:{clip:'holy-hit'}}:e.feedback,damage:scaleDamage(e.damage),hitbox:e.behavior==='frog-global'?e.hitbox:{x:e.hitbox.x*reach,y:e.hitbox.y*reach,w:e.hitbox.w*reach,h:e.hitbox.h*reach}}))};
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
/** At emergence, retain the real landing point after body separation for presentation/replays. */
export function settleFrogWarp(f:FighterState,state:MatchState){
 const w=f.frogWarps?.at(-1);
 if(w?.kind==='burrow'&&state.arenaFrame-w.tick===FROG_RULES.warpHidden){w.toX=f.x;w.toY=f.y;}
 const d=f.frogDodge;
 if(d&&d.arrivedAt===undefined){
  d.toX=f.x;d.toY=f.y;
  if(!f.dash||!f.dashActive||f.hitstun||f.recovery)d.arrivedAt=state.arenaFrame;
 }
}
export function startFrogDodge(f:FighterState,state:MatchState){
 if(frogPowered(f,state))f.frogDodge={tick:state.arenaFrame,fromX:f.x,fromY:f.y,toX:f.x,toY:f.y};
}
export function tickAscension(f:FighterState,state:MatchState){
 if(f.frogDodge&&state.arenaFrame-(f.frogDodge.arrivedAt??f.frogDodge.tick)>60)delete f.frogDodge;
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

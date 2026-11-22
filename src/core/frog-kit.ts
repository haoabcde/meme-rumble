import type {ActionDefinition,Box,FighterAction,FighterState,MatchState} from './types.js';

export const FROG_RULES=Object.freeze({buffTicks:900,fadeTicks:36,fadeLife:180,body:80,laughRadius:240,poweredLaughRange:2,poweredSpeed:1.5,incomingDamage:.7});
export const frogPowered=(f:FighterState,state:MatchState)=>(f.ascendUntil??0)>state.arenaFrame;
export function frogBox(box:Box,scale:number):Box{return {x:box.x*scale,y:(box.y+65)*scale-65,w:box.w*scale,h:box.h*scale};}
export function frogAction(action:FighterAction|undefined,f:FighterState,state:MatchState):FighterAction|undefined{
 if(!action||'counterTo' in action||!frogPowered(f,state))return action;
 const reach='frog' in action&&action.frog==='laugh'?FROG_RULES.poweredLaughRange:1.5;
 return {...action,damage:action.damage*1.5,hitbox:frogBox(action.hitbox,1.5),
  hitTimeline:action.hitTimeline?.map(w=>({...w,boxes:w.boxes.map(b=>frogBox(b,1.5)),...(w.damage!==undefined?{damage:w.damage*1.5}:{})})),
  entities:action.entities?.map(e=>({...e,damage:e.damage*1.5,hitbox:e.behavior==='frog-global'?e.hitbox:{x:e.hitbox.x*reach,y:e.hitbox.y*reach,w:e.hitbox.w*reach,h:e.hitbox.h*reach}}))};
}
export function frogCanStart(action:FighterAction,f:FighterState,state:MatchState){
 return !('frog' in action&&action.frog==='ascend'&&frogPowered(f,state));
}
export function startFrog(action:ActionDefinition,f:FighterState,state:MatchState){
 if(action.slot==='A'||action.frog==='laugh'||action.frog==='global'){
  (f.frogCasts??=[]).push({id:action.id,tick:state.arenaFrame,x:f.x,y:f.y,facing:f.facing,powered:frogPowered(f,state),startup:action.startup});
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

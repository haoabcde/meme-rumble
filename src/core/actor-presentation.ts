import type {FighterState,MatchState,MatchConfig,MotionStamp} from './types.js';
export function motionStamp(f:FighterState,tick:number,phase=0):MotionStamp{
 const age=tick-(f.poseEvent?.tick??-999),event=f.poseEvent?.kind??'';
 const mode=!f.hp||f.recovery||f.launched||f.guardBreak?'special':f.hitstun?'hurt':f.attack?'attack:'+f.attack.id:f.guarding?'guard':!f.ground?'air':event==='land'&&age<10?'land':f.moving?'walk':event==='brake'&&age<7?'brake':'idle';
 return{mode,tick,x:f.x,y:f.y,facing:f.facing,phase,vy:f.vy,ground:Boolean(f.ground),moving:f.moving,stun:f.hitstun,event,eventAge:age,...(f.attack?{attackId:f.attack.id,attackFrame:f.attack.frame}:{})};
}
export function updateActorPresentation(state:MatchState,config:MatchConfig){
 for(const seat of [0,1] as const){const id=config.fighters[seat].id;if(id!=='frog'&&id!=='whale')continue;
  const f=state.fighters[seat],old=f.motionVisual,previous=old?.stamp;
  let phase=previous?.phase??0;
  // Whale: a slightly longer stride lowers cadence by 11%, without changing movement speed.
  if(previous&&f.moving&&f.ground&&!f.attack&&!f.hitstun){const dx=f.x-previous.x;if(Math.abs(dx)<35)phase=((phase+dx*f.facing/(id==='frog'?112:74)*8)%8+8)%8;}
  const stamp=motionStamp(f,state.arenaFrame,phase),changed=previous?.mode!==stamp.mode;
  f.motionVisual={stamp,from:changed?previous:old?.from,changed:changed?state.arenaFrame:old?.changed??state.arenaFrame,
   turnTick:previous&&previous.facing!==f.facing?state.arenaFrame:old?.turnTick??-999,
   turnFrom:previous&&previous.facing!==f.facing?previous.facing:old?.turnFrom??f.facing};
 }
}

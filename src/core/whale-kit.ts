import type {ActionDefinition,Box,FighterState,MatchConfig,MatchState} from './types.js';
import type {EntityState} from './entities.js';
import {platformAt} from './terrain.js';

export const WHALE_RULES=Object.freeze({riceLife:120,bind:60,greed:5,greedReset:24,riceSpeed:28,riceUpSpeed:32,riceRange:432,wind:20,whale:48,windSpeed:24,orcaSpeed:32,orcaBiteSpeed:3.8,ultimateHits:12,hitGap:7});
export function kit(f:FighterState){return f.whale??={riceCount:0,lastRice:-1000};}
export function startWhale(action:ActionDefinition,f:FighterState,state:MatchState){
 if(!action.whale)return action.id;
 const k=kit(f),now=state.arenaFrame;
 if(action.whale==='rice'||action.whale==='rice-up'){
  if(now-k.lastRice>=WHALE_RULES.greedReset)k.riceCount=0;k.lastRice=now;
  if(k.riceCount>=WHALE_RULES.greed)return 'whale-eat';k.riceCount++;
 }
 return action.id;
}
export function kitLifetime(e:EntityState){return e.endingAge??(e.windTicks!==undefined?e.windTicks+28:e.definition.lifetime);}
export function initializeKitEntity(e:EntityState,state:MatchState,config:MatchConfig){
 const b=e.definition.behavior;if(!b)return;
 const f=state.fighters[e.owner];e.originX=e.x;e.originY=e.y;e.previousX=e.x;e.previousY=e.y;e.hits=0;e.hitSeats=[];
 if(b==='spin-up'){e.x=state.fighters[e.owner===0?1:0].x;e.originX=e.x;e.previousX=e.x;}
 if(b==='spin'||b==='spin-up'||b==='counter')e.windTicks=b==='spin'?Math.ceil((e.facing===1?config.arena.right+220-e.x:e.x-config.arena.left+220)/24)+1:20;
 // The disc is at the nose on the spawn tick, not at the body's centre.
 if(b==='orca')e.originX=e.x+e.facing*202.5;
 if(b==='rice'){
  const up=e.definition.id.includes('up'),sign=e.facing*Math.sign(e.definition.velocity.x||1);
  // No arc: normal flies straight from the pocket to six body widths away.
  // Up throws remain on a 60-degree ray; neither throw accelerates under gravity.
  e.vx=sign*(up?WHALE_RULES.riceUpSpeed*.5:WHALE_RULES.riceSpeed);
  e.vy=up?-WHALE_RULES.riceUpSpeed*Math.sin(Math.PI/3):87/(WHALE_RULES.riceRange-26)*WHALE_RULES.riceSpeed;
 }
}
export function advanceKitEntity(e:EntityState,state:MatchState,config:MatchConfig){
 const b=e.definition.behavior;if(!b)return false;
 if(b==='rice'){
  if(e.grounded){if(e.support&&e.support!=='floor'){
   const raw=config.arena.platforms.find(p=>p.id===e.support);if(raw){const now=platformAt(raw,state.arenaFrame),prev=platformAt(raw,state.arenaFrame-1);e.x+=now.left-prev.left;e.y+=now.y-prev.y;}
  }return true;}
  e.x+=e.vx;e.y+=e.vy;
  if(e.vy>0){let floor=config.arena.floor-5,support='floor';for(const raw of config.arena.platforms){const p=platformAt(raw,state.arenaFrame);if(e.x>=p.left&&e.x<=p.right&&(e.previousY??e.y)<=p.y-5&&e.y>=p.y-5&&p.y-5<floor){floor=p.y-5;support=p.id;}}
   if((e.previousY??e.y)<=floor&&e.y>=floor){const portion=(floor-(e.previousY??e.y))/e.vy;e.x=(e.previousX??e.x)+e.vx*portion;e.grounded=true;e.support=support;e.y=floor;e.vx=e.vy=0;}}
  if(e.x<config.arena.left-64||e.x>config.arena.right+64||e.y< -64)e.endingAge=e.age;
  return true;
 }
 if(b==='spin'){if(e.age<(e.windTicks??20))e.x+=e.vx;return true;}
 if(b==='spin-up'||b==='counter')return true;
 const biting=(e.hits??0)<WHALE_RULES.ultimateHits&&e.lastContactAge!==undefined&&e.age-e.lastContactAge<=WHALE_RULES.hitGap+1;
 e.vx=e.facing*(biting?WHALE_RULES.orcaBiteSpeed:WHALE_RULES.orcaSpeed);
 e.x+=e.vx;
 if(e.x<config.arena.left-400||e.x>config.arena.right+400)e.endingAge=e.age;
 return true;
}
export function kitContactAllowed(e:EntityState,f:FighterState,target:number){
 const b=e.definition.behavior;if(!b)return true;
 if(e.age>=(e.endingAge??Infinity)||e.age<(e.nextHitAge??0))return false;
 if(b==='orca'){
  if((e.hits??0)>=WHALE_RULES.ultimateHits)return false;
  return !(f.jumpCount===2&&f.secondApex&&f.y<e.y-90);
 }
 if(e.hitSeats?.includes(target))return false;
 return e.windTicks===undefined||e.age<e.windTicks;
}
export function kitContactBox(e:EntityState,f:FighterState,box:Box):Box{
 if(!e.definition.behavior)return box;
 // Swept horizontal contact avoids tunnelling at 24 units per tick.
 const dx=(e.previousX??e.x)-e.x;box={...box,x:box.x+Math.min(0,dx),w:box.w+Math.abs(dx)};
 if(e.definition.behavior==='orca'){
  if(e.facing===1){const left=Math.max(box.x,e.originX??box.x);box.w=Math.max(0,box.x+box.w-left);box.x=left;}
  else box.w=Math.max(0,Math.min(box.x+box.w,e.originX??Infinity)-box.x);
  // Same-lane single jumps and early second jumps do not clear this attack.
  if((f.jumpCount??0)>0&&!f.secondApex&&Math.abs((f.jumpOriginY??f.y)-(e.y+90))<100){box.y=Math.min(box.y,f.y-150);box.h=Math.max(box.h,f.y-box.y);}
 }
 return box;
}
export function kitContactResolved(e:EntityState,state:MatchState,target:0|1,blocked:boolean,countered:boolean){
 const b=e.definition.behavior;if(!b)return false;
 e.hits=(e.hits??0)+1;(e.hitSeats??=[]).push(target);
 if(b==='rice'){
  if(!blocked&&!countered){const f=state.fighters[target];f.bindUntil=state.arenaFrame+60;f.push=0;f.dash=0;f.dashActive=false;if(!f.ground)f.vy=Math.max(6,f.vy);}
  return false;
 }
 if(b==='orca'){
  if(countered){e.hits=WHALE_RULES.ultimateHits;e.endingAge=e.age+8;return true;}
  e.lastContactAge=e.age;e.firstContactAge??=e.age;
  e.vx=e.facing*(e.hits>=WHALE_RULES.ultimateHits?WHALE_RULES.orcaSpeed:WHALE_RULES.orcaBiteSpeed);
  e.nextHitAge=e.age+WHALE_RULES.hitGap;
 }
 return true;
}

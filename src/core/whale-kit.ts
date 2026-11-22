import type {ActionDefinition,Box,FighterState,MatchConfig,MatchState} from './types.js';
import type {EntityState} from './entities.js';
import {platformAt} from './terrain.js';

export const WHALE_RULES=Object.freeze({riceLife:120,bind:72,eatChance:.2,riceSpeed:28,riceUpSpeed:32,riceRange:432,wind:20,whale:48,windSpeed:24,cinematic:60,telegraph:36,ultimateHits:12,hitGap:7});
/** All randomness lives in the snapshot, never in Math.random or the renderer. */
export function riceRoll(state:MatchState){
 let x=state.randomState??0x6d2b79f5;
 x^=x<<13;x^=x>>>17;x^=x<<5;state.randomState=x>>>0;
 return state.randomState/4294967296;
}
export function startWhale(action:ActionDefinition,_f:FighterState,state:MatchState){
 if(action.whale==='rice'||action.whale==='rice-up')return riceRoll(state)<WHALE_RULES.eatChance?'whale-eat':action.id;
 return action.id;
}
export function cinematicOwner(state:MatchState){return ([0,1] as const).find(seat=>['open-source','frog-ascend'].includes(state.fighters[seat].attack?.id??'')&&(state.fighters[seat].attack?.frame??60)<WHALE_RULES.cinematic);}
export function kitLifetime(e:EntityState){return e.endingAge??(e.windTicks!==undefined?e.windTicks+28:e.definition.lifetime);}
export function initializeKitEntity(e:EntityState,state:MatchState,config:MatchConfig){
 const b=e.definition.behavior;if(!b)return;
 e.originX=e.x;e.originY=e.y;e.previousX=e.x;e.previousY=e.y;e.hits=0;e.hitSeats=[];
 if(b==='spin-up'){e.x=state.fighters[e.owner===0?1:0].x;e.originX=e.x;e.previousX=e.x;}
 if(b==='spin'||b==='spin-up'||b==='counter')e.windTicks=b==='spin'?Math.ceil((e.facing===1?config.arena.right+220-e.x:e.x-config.arena.left+220)/24)+1:20;
 if(b==='frog-global'){
  e.facing=1;e.x=(config.arena.left+config.arena.right)/2;e.y=config.arena.floor;
  e.definition={...e.definition,hitbox:{x:config.arena.left-e.x-50,y:-config.arena.height-500,w:config.arena.right-config.arena.left+100,h:config.arena.height+1000}};
 }
 if(b==='pool'){
  const target=state.fighters[e.owner===0?1:0];e.x=target.x;e.y=config.arena.floor;e.support='floor';
  for(const raw of config.arena.platforms){const p=platformAt(raw,state.arenaFrame);if(e.x>=p.left&&e.x<=p.right&&p.y>=target.y-1&&p.y<e.y){e.y=p.y;e.support=p.id;}}
  e.originX=e.previousX=e.x;e.originY=e.previousY=e.y;e.hitWaves=[];
 }
 if(b==='rice'){
  if(e.definition.riceRadial)return;
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
 // Water pools are fixed in world space, including the complete warning period.
 return true;
}

export function kitContactAllowed(e:EntityState,f:FighterState,target:number){
 const b=e.definition.behavior;if(!b)return true;
 if(e.age>=(e.endingAge??Infinity)||e.age<(e.nextHitAge??0))return false;
 if(b==='pool'){
  const wave=Math.floor((e.age-WHALE_RULES.telegraph)/WHALE_RULES.hitGap);
  return wave>=0&&wave<WHALE_RULES.ultimateHits&&!e.hitWaves?.includes(wave);
 }
 if(e.hitSeats?.includes(target))return false;
 return e.windTicks===undefined||e.age<e.windTicks;
}
export function kitContactBox(e:EntityState,f:FighterState,box:Box):Box{
 if(!e.definition.behavior)return box;
 // Swept horizontal contact avoids tunnelling at 24 units per tick.
 const dx=(e.previousX??e.x)-e.x;box={...box,x:box.x+Math.min(0,dx),w:box.w+Math.abs(dx)};

 return box;
}
export function kitContactResolved(e:EntityState,state:MatchState,target:0|1,blocked:boolean,countered:boolean){
 const b=e.definition.behavior;if(!b)return false;
 e.hits=(e.hits??0)+1;(e.hitSeats??=[]).push(target);
 if(b==='rice'){
  if(!blocked&&!countered){const owner=state.fighters[e.owner];if(owner.attack?.id==='rice'||owner.attack?.id==='rice-up')owner.attack.landed=true;const f=state.fighters[target];f.bindUntil=state.arenaFrame+WHALE_RULES.bind;f.push=0;f.dash=0;f.dashActive=false;if(!f.ground)f.vy=Math.max(6,f.vy);}
  return false;
 }
 if(b==='pool'){
  (e.hitWaves??=[]).push(Math.floor((e.age-WHALE_RULES.telegraph)/WHALE_RULES.hitGap));
  e.lastContactAge=e.age;e.firstContactAge??=e.age;
 }

 return true;
}

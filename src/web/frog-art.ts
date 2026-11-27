import normalGuardSource from '../../assets/角色/防御/奶蛙/护腹站姿_V6/护腹_看向玩家.png';
import basicSource from '../../assets/角色/基础动作/奶蛙/V19/跳跃受击倒地起身_十六帧.png';
import sceneSource from '../../assets/角色/出场与胜负/奶蛙/V19/侧躺出场与胜负_八帧.png';
import {frogMotionSample} from './frog-motion.mjs';
import locomotionV25 from '../../assets/角色/基础动作/奶蛙/V25/步态与起落_十六帧.png';
import {registerLocomotion,setActorMotion,setFrogHurtPoses,drawActorMotion} from './actor-motion.mjs';
import holyComboSource from '../../assets/角色/特效/奶蛙/强化普攻_V22/白金焰羽_八部件.png';
import dragonRiseSource from '../../assets/角色/特效/奶蛙/强化普攻_V24/金白流光_龙抬头六帧.png';
import {drawHolyCombo,registeredDragonFrames} from './frog-combo.mjs';
import type {FighterAction,FighterState,MatchConfig,MatchState} from '../core/types.js';
import {frogPowered,FROG_RULES,frogCrouching} from '../core/frog-kit.js';
import {cutGrid} from './pixel-sprites.mjs';
import {drawPixelFx} from './pixel-fx.mjs';
import {holyFanSample} from './holy-fan.mjs';
import {drawWarp,setWarpArt} from './frog-warp.mjs';
import {drawTeleport,drawDodgeTeleport,setTeleportArt} from './frog-teleport.mjs';
import {drawHeldStars,setStarArt} from './frog-stars.mjs';
import {drawRuneGuard,setGuardArt} from './frog-guard.mjs';
import crouchSource from '../../assets/角色/技能/奶蛙/二技能/调皮下蹲_像素姿态_V1.png';
import thinkingSource from '../../assets/角色/常态/奶蛙/托腮思考_像素姿态_V1.png';
import spiralSource from '../../assets/角色/特效/奶蛙/传送_V2/金色旋涡_常态与符文.png';
import discSource from '../../assets/角色/特效/奶蛙/传送_V2/钻出法阵_常态与符文.png';
import teleportSource from '../../assets/角色/技能/奶蛙/二技能/金色瞬移_V4/符文法阵与金色拖尾_双部件.png';
import starSource from '../../assets/角色/技能/奶蛙/二技能/星图传送_V3/金色星点连线_像素母版.png';
import guardSource from '../../assets/角色/防御/奶蛙/神圣符文_V1/立体符文牌与几何印记_八枚.png';
import moveSource from '../../assets/角色/技能/奶娃/拳脚与捧腹_八姿态.png';
import goldSource from '../../assets/角色/特效/奶蛙/金色符文_V1/星芒_法环_螺旋_星轨.png';
import travelSource from '../../assets/角色/常态/奶蛙/移动与悬浮_八帧_V1.png';
import angelSource from '../../assets/角色/大招/奶娃/神了/天使_四姿态.png';
import introSource from '../../assets/角色/大招/奶娃/神了/神性指尖_演出像素关键帧.png';
let normalGuard:HTMLCanvasElement;
let basics:HTMLCanvasElement[]=[],scenes:HTMLCanvasElement[]=[];
let holyComboArt:HTMLCanvasElement[]=[];
let dragonRiseArt:HTMLCanvasElement[]=[];
let moves:HTMLCanvasElement[]=[],angels:HTMLCanvasElement[]=[],travel:HTMLCanvasElement[]=[],gold:HTMLCanvasElement[]=[],crouch:HTMLCanvasElement,thinking:HTMLCanvasElement,intro:HTMLImageElement;
const cutBody=(im:HTMLImageElement,columns:number,rows:number,cleanCells:number[]=[])=>cutGrid(im,columns,rows,{pixelate:false,cleanCells});
const load=(src:string)=>{const im=new Image();im.src=src;return im.decode().then(()=>im)};
void Promise.all([load(moveSource),load(angelSource),load(introSource),load(travelSource),load(goldSource),load(crouchSource)]).then(([m,a,i,t,v,c])=>{moves=cutBody(m,4,2,[6]);angels=cutBody(a,2,2);travel=cutBody(t,4,2);gold=cutGrid(v,2,2);crouch=cutBody(c,1,1)[0];intro=i;});
void load(normalGuardSource).then(im=>normalGuard=cutBody(im,1,1)[0]);
void load(basicSource).then(im=>{basics=cutBody(im,4,4);setFrogHurtPoses([basics[8],basics[9]]);});
void load(locomotionV25).then(im=>registerLocomotion(im,'frog'));
void load(holyComboSource).then(im=>holyComboArt=cutGrid(im,4,2));
void load(dragonRiseSource).then(im=>dragonRiseArt=registeredDragonFrames(im));
void load(sceneSource).then(im=>scenes=cutBody(im,4,2));
void load(thinkingSource).then(im=>thinking=cutBody(im,1,1)[0]);
void load(starSource).then(im=>setStarArt(im));
void Promise.all([load(spiralSource),load(discSource)]).then(([s,d])=>setWarpArt(cutGrid(s,2,1),cutGrid(d,2,1)));
void load(guardSource).then(im=>setGuardArt(cutGrid(im,4,2)));
void load(teleportSource).then(im=>setTeleportArt(cutGrid(im,2,1)));
const clamp=(n:number)=>Math.max(0,Math.min(1,n));
function actorImage(g:CanvasRenderingContext2D,im:HTMLCanvasElement,h:number,y=0){const w=h*im.width/im.height;g.drawImage(im,-w/2,y-h,w,h);}
function goldMotif(g:CanvasRenderingContext2D,index:number,x:number,y:number,w:number,alpha:number,angle=0,squash=1){
 const im=gold[index];if(!im||alpha<=0)return;
 g.save();g.imageSmoothingEnabled=false;g.globalAlpha*=alpha;g.translate(x,y);g.rotate(angle);g.scale(1,squash);g.drawImage(im,-w/2,-w*im.height/im.width/2,w,w*im.height/im.width);g.restore();
}
function holyFeather(g:CanvasRenderingContext2D,x:number,y:number,angle:number,alpha:number,size=1){
 g.save();g.globalAlpha*=alpha;g.translate(Math.round(x),Math.round(y));g.rotate(angle);g.scale(size,size);
 g.fillStyle='#e8bd63';g.fillRect(-3,-9,4,15);g.fillRect(-5,-6,8,10);
 g.fillStyle='#fff8df';g.fillRect(-3,-8,4,12);g.fillRect(-5,-5,4,7);g.fillRect(1,-4,3,7);
 g.fillStyle='#ffe7ae';g.fillRect(-1,-10,2,21);g.restore();
}
function holyColumn(g:CanvasRenderingContext2D,f:FighterState,seconds:number,config:MatchConfig){
 const {alpha,shafts}=holyFanSample(seconds,f.y-1,config.arena.height);if(!alpha)return;
 g.save();g.translate(f.x,0);
 for(const shaft of shafts){
  if(shaft.bottom<=shaft.top)continue;
  for(const [width,opacity,color]of [[1.5,.11,'#ffd06b'],[1,.25,'#ffe9a7'],[.24,.62,'#fff9dc']] as const){
   g.globalAlpha=alpha*shaft.brightness*opacity;g.fillStyle=color;
   g.beginPath();g.moveTo(shaft.topX-shaft.topWidth*width/2,shaft.top);
   g.lineTo(shaft.topX+shaft.topWidth*width/2,shaft.top);
   g.lineTo(shaft.bottomX+shaft.bottomWidth*width/2,shaft.bottom);
   g.lineTo(shaft.bottomX-shaft.bottomWidth*width/2,shaft.bottom);g.closePath();g.fill();
  }
  // White-gold motes flow along every extended shaft instead of ending at the old sprite edge.
  const height=shaft.bottom-shaft.top;
  g.strokeStyle='#fff8df';g.lineWidth=2;g.globalAlpha=alpha*shaft.brightness*.7;
  for(let j=0;j<22;j++){
   const distance=(seconds*110+j*233)%(height+40);if(distance>height)continue;
   const u=distance/height,v=Math.min(1,(distance+12)/height);
   g.beginPath();g.moveTo(shaft.bottomX+(shaft.topX-shaft.bottomX)*u,shaft.bottom-distance);
   g.lineTo(shaft.bottomX+(shaft.topX-shaft.bottomX)*v,shaft.bottom-v*height);g.stroke();
  }
 }
 g.restore();
}
function shockRing(g:CanvasRenderingContext2D,x:number,y:number,r:number,t:number,powered:boolean,layer:'back'|'front'){
 if(t<0||t>20)return;
 const p=clamp((t+1)/12),fade=clamp((20-t)/14),from=layer==='back'?Math.PI:0;
 g.save();g.translate(x,y);g.globalAlpha*=fade;
 for(const [offset,width,color,alpha]of [[0,powered?23:8,'#ffd87c',powered?.5:.25],[-4,powered?6:3,'#fff3cf',1],[5,powered?4:2,'#ffce64',powered?.95:.65]] as const){
  g.globalAlpha=fade*alpha;g.strokeStyle=color;g.lineWidth=width;g.beginPath();g.arc(0,0,Math.max(3,r*p+offset),from,from+Math.PI);g.stroke();
 }g.restore();
}
function dissolvingAngel(g:CanvasRenderingContext2D,age:number,tick:number){
 const im=angels[0];if(!im||age<0||age>=FROG_RULES.fadeTicks)return;
 const p=age/FROG_RULES.fadeTicks,h=164-34*p,w=h*im.width/im.height,y=(-18+Math.sin(tick*.1)*3)*(1-p),size=6;
 g.save();g.imageSmoothingEnabled=false;g.globalAlpha*=1-clamp((p-.35)/.65)*.7;
 // The actual sacred sprite breaks into pixel clusters, which leave feathers as they disappear.
 for(let sy=0;sy<im.height;sy+=size)for(let sx=0;sx<im.width;sx+=size){
  const col=sx/size,row=sy/size,hash=((col*73856093)^(row*19349663))>>>0;
  const cut=.15+.55*(1-Math.abs(sx/im.width-.5)*2)+(hash%1000)/1000*.2+sy/im.height*.05;
  if(p<cut){
   const sw=Math.min(size,im.width-sx),sh=Math.min(size,im.height-sy);
   g.drawImage(im,sx,sy,sw,sh,-w/2+sx/im.width*w,y-h+sy/im.height*h,sw/im.width*w,sh/im.height*h);
  }else if(hash%10===0&&p<cut+.3){
   const drift=(p-cut)/.3;
   holyFeather(g,(sx/im.width-.5)*w+(sx/im.width-.5)*drift*60,y-h+sy/im.height*h-drift*38,
    Math.sin(row+drift*4)*.7,(1-drift)*.65,.7);
  }
 }
 g.restore();
}
export function drawFrogActor(g:CanvasRenderingContext2D,f:FighterState,state:MatchState,action?:FighterAction,seat:0|1=0,actions:readonly FighterAction[]=[]){
 if(!moves.length)return;
 const frame=f.attack?.frame??0,powered=frogPowered(f,state),a=action&&'frog' in action?action.frog:undefined;
 const stage=['common-jab','common-sweep','frog-left-kick','frog-ha','common-finish'].indexOf(action?.id??'');
 let pose=f.guarding?7:a==='laugh'||a==='global'?6:stage>=0?stage+1:action?.id==='common-air'?3:0;
 const h=pose===5?100:130,evAge=state.arenaFrame-(f.poseEvent?.tick??-999);
 setActorMotion('frog',{moves});
 if(!powered&&state.phase==='fight'&&state.arenaFrame-(f.ascendEndVisual?.tick??-999)>=FROG_RULES.fadeTicks&&drawActorMotion(g,'frog',f,state,action,actions))return;
 const motion=frogMotionSample(f,state,seat);
 if(motion&&(!powered||motion.bank==='scene'||!f.hp)){
  const im=(motion.bank==='scene'?scenes:basics)[motion.cell];
  if(im){
   g.save();g.imageSmoothingEnabled=true;g.imageSmoothingQuality='high';
   // Idle float/breath is tiny; pose changes come from authored drawings.
   if(motion.bank==='scene'&&motion.cell<2)g.translate(0,Math.sin((120-state.phaseTicks)*.14)*.7);
   actorImage(g,im,motion.height);g.restore();return;
  }
 }
 const warp=f.frogWarps?.at(-1),warpAge=state.arenaFrame-(warp?.tick??-999);
 g.save();g.imageSmoothingEnabled=true;g.imageSmoothingQuality='high';
 const dodge=f.frogDodge;
 if(dodge&&dodge.arrivedAt===undefined&&f.dashActive&&f.hp>0&&!f.hitstun&&!f.recovery){g.restore();return;}
 if(dodge?.arrivedAt!==undefined&&state.arenaFrame-dodge.arrivedAt<3)g.globalAlpha*=clamp((state.arenaFrame-dodge.arrivedAt+1)/3);
 if(warpAge<FROG_RULES.warpHidden){g.restore();return;}
 if(warpAge<16){
  const rise=clamp((warpAge-FROG_RULES.warpHidden+1)/10),height=powered?182:104;
  g.beginPath();g.rect(-250,-300,500,300);g.clip();g.translate(0,height*(1-rise));
 }
 if(!f.hp||f.recovery?.phase==='down'){g.translate(0,-20);g.rotate(-1.25);}
 else if(f.recovery?.phase==='fall')g.rotate(-.2);
 else if(f.hitstun)g.rotate(-.07);
 if(powered){
  const y=-18+Math.sin(state.arenaFrame*.1)*3;
  // The sacred idle silhouette stays identical through every empowered attack.
  if(f.moving&&!action&&!f.hitstun&&!f.recovery&&travel.length){g.rotate(.035);actorImage(g,travel[4+Math.floor(state.arenaFrame/8)%4],164,y);}
  else actorImage(g,angels[0],164,y);
 }else{
  const endAge=state.arenaFrame-(f.ascendEndVisual?.tick??-999);
  g.save();if(f.hp>0&&endAge<FROG_RULES.fadeTicks)g.globalAlpha*=clamp((endAge-5)/19);
  if(f.moving&&pose===0){g.translate(0,-Math.abs(Math.sin(state.arenaFrame*.4))*4);g.rotate(Math.sin(state.arenaFrame*.4)*.025);}
  if(a==='laugh'||a==='global'){g.rotate(Math.sin(frame*.8)*.035);g.scale(1+Math.sin(frame*.8)*.018,1-Math.sin(frame*.8)*.018);}
  if(stage>=0&&action){const anticipation=clamp(frame/action.startup);if(frame<action.startup){pose=0;g.rotate((stage%2?1:-1)*anticipation*.09);g.scale(1+anticipation*.025,1-anticipation*.06);}}
  if(f.dashActive){g.save();g.globalAlpha=.18;actorImage(g,moves[0],130,-3);g.restore();g.translate(18,0);}
  const idle=state.arenaFrame%420,ponder=!action&&!f.moving&&!f.guarding&&!f.hitstun&&!f.recovery&&f.ground&&idle>=150&&idle<320;
  if(f.guarding&&normalGuard){actorImage(g,normalGuard,130);}
  else if(ponder&&thinking){
   const blend=clamp((idle-150)/8)*clamp((320-idle)/8);
   g.save();g.globalAlpha*=1-blend;actorImage(g,moves[0],130);g.restore();
   g.save();g.globalAlpha*=blend;g.translate(0,-Math.sin(idle*.075)*1.2);g.rotate(Math.sin(idle*.045)*.008);actorImage(g,thinking,130);g.restore();
  }else if((a==='crouch'||a==='burrow'||a==='evade')&&crouch){g.translate(0,-Math.sin(state.arenaFrame*.16)*.7);actorImage(g,crouch,104);}
  else if(f.moving&&f.ground&&pose===0&&!action&&travel.length){actorImage(g,travel[Math.floor(state.arenaFrame/6)%4],130);}
  else actorImage(g,moves[pose],h);
  g.restore();
  if(f.hp>0)dissolvingAngel(g,endAge,state.arenaFrame);
 }
 g.restore();
}
export function drawFrogEffects(g:CanvasRenderingContext2D,state:MatchState,config:MatchConfig,layer:'back'|'front'){
 for(const seat of [0,1] as const){
  if(config.fighters[seat].id!=='frog')continue;
  const f=state.fighters[seat],a=config.fighters[seat].actions.find(a=>a.id===f.attack?.id),frame=f.attack?.frame??-999,power=frogPowered(f,state),scale=power?1.5:1;
  if(power&&f.moving&&!f.attack&&layer==='back')for(let i=0;i<4;i++){
   const p=((state.arenaFrame+i*8)%32)/32;
   holyFeather(g,f.x-f.facing*(60+p*100),f.y-70-i*8+p*30,Math.sin(p*5+i)*.5,.75*Math.sin(p*Math.PI),.85+i*.05);
  }
  if(power)drawPixelFx(g,'halo',f.x,f.y-72,(state.arenaFrame%120)/60,2.4,layer,true,.44);
  if(power&&f.guarding)drawRuneGuard(g,f.x,f.y,state.arenaFrame,layer);
  if(power&&frogCrouching(f))drawHeldStars(g,f.x,f.y,state.arenaFrame,layer);
  const reveal=f.ascendVisual;
  if(reveal){
   const seconds=(state.arenaFrame-reveal.tick)/60;
   if(layer==='back')holyColumn(g,f,seconds,config);
   drawPixelFx(g,'pillarTall',f.x,f.y,seconds,1.65,layer,true,1);
   drawPixelFx(g,'feather',f.x,f.y-95,seconds-.66,1.6,layer,true,.85);
  }
  if(f.ascendEndVisual){const end=f.ascendEndVisual;
   drawPixelFx(g,'feather',end.x,end.y-95,(state.arenaFrame-end.tick)/60,1.9,layer,true,.85);
  }
  drawCastEffects(g,f,state,config,layer);
  if(f.frogDodge)drawDodgeTeleport(g,f.frogDodge,state.arenaFrame,layer);
  for(const w of f.frogWarps??[]){
   const age=state.arenaFrame-w.tick;
   if(w.powered)drawTeleport(g,w,age,layer);
   else drawWarp(g,w.fromX,w.fromY-70,age,false,layer);
   drawWarp(g,w.toX,w.toY-2,age,w.powered,layer,true);
   if(w.powered)drawPixelFx(g,w.kind==='burrow'?'featherClean':'feather',w.fromX,w.fromY-80,age/60,1.8,layer,true,.95);
   if(w.powered&&layer==='back'&&age<34){
    const alpha=clamp((age-3)/4)*clamp((34-age)/18);
    g.save();const top=-config.arena.height-400;
    for(const [width,opacity,color]of [[88,.13,'#edaf37'],[42,.32,'#ffdc82'],[14,.72,'#fff7d5']] as const){
     g.fillStyle=color;g.globalAlpha=alpha*opacity;g.fillRect(w.toX-width/2,top,width,w.toY-top);
    }g.restore();
   }
  }
  if(a&&'frog' in a&&(a.frog==='laugh'||a.frog==='global')){
   if(frame<a.startup&&layer==='back'){
    g.save();g.globalAlpha=.35*frame/a.startup;g.strokeStyle='#ffe4a1';g.lineWidth=3;g.beginPath();g.arc(f.x,f.y-65,30+25*frame/a.startup,0,Math.PI*2);g.stroke();g.restore();
   }
  }
  if(!power&&a?.id==='frog-ha'&&frame>=3&&frame<19)drawPixelFx(g,'burst',f.x,f.y-65+28*scale, .22+(frame-3)/60*3,scale,layer,true,.8);
  if(!power&&a?.id==='common-finish'&&frame>=4&&frame<21){g.save();g.translate(f.x,f.y-25);g.scale(f.facing,1);g.rotate(.8);drawPixelFx(g,'uppercut',0,0,(frame-4)/60*2,1.25*scale,layer,true,.62);g.restore();}
  const target=state.fighters[seat===0?1:0],hitAge=state.arenaFrame-(target.poseEvent?.tick??-999);
  const laughing=a&&'frog' in a&&(a.frog==='laugh'||a.frog==='global');
  if(power&&layer==='front'&&['hurt','heavy','launch'].includes(target.poseEvent?.kind??'')&&hitAge<12)goldMotif(g,0,target.x,target.y-65,150+hitAge*3,.98*clamp((12-hitAge)/8),.12);
  if((power||!laughing)&&layer==='front'&&['hurt','heavy','launch'].includes(target.poseEvent?.kind??'')&&hitAge<14)drawPixelFx(g,power?'spark':'blunt',target.x,target.y-30,hitAge/60*2,power?2.1:1.25,layer,true,power?.92:.65);
 }
}
export function drawFrogIntro(g:CanvasRenderingContext2D,config:MatchConfig,state:MatchState){
 if(!intro)return;
 for(const seat of [0,1] as const){const f=state.fighters[seat];if(config.fighters[seat].id!=='frog'||f.attack?.id!=='frog-ascend')continue;
  const phase=f.attack.frame;if(phase>=60)continue;
  const alpha=clamp((phase+1)/6)*clamp((60-phase)/8),zoom=1.02+phase/60*.025;
  g.save();g.scale(g.canvas.width/1280,g.canvas.height/720);g.globalAlpha*=alpha;g.fillStyle='#432613';g.fillRect(0,0,1280,720);
  g.save();g.translate(640,360);g.scale(zoom,zoom);g.drawImage(intro,-640,-426,1280,853);g.restore();
  drawPixelFx(g,'rays',640,720,phase/60*3,4,'front',true,.33);
  g.restore();
 }
}

/** Persist the library's natural decay across attack cancels and hit reactions. */
function drawCastEffects(g:CanvasRenderingContext2D,f:FighterState,state:MatchState,config:MatchConfig,layer:'back'|'front'){
 for(const c of f.frogCasts??[]){
  const age=state.arenaFrame-c.tick;
  if(c.id==='frog-laugh'||c.id==='frog-laugh-global'){
   const global=c.id==='frog-laugh-global',envelope=clamp(age/12)*clamp((65-age)/25);
   const radius=global?config.arena.right-config.arena.left+config.arena.height:FROG_RULES.laughRadius*(c.powered?FROG_RULES.poweredLaughRange:1);
   if(c.powered&&layer==='back')goldMotif(g,1,c.x,c.y-65,Math.min(global?960:radius*2,200+age*19),.58*envelope,age*.022);
   for(const at of global?[32]:[16,26,36]){
    const point=global?c:c.anchors?.find(a=>a.frame===at)??c;
    shockRing(g,point.x,point.y-65,radius,age-at,c.powered,layer);
   }
   const point=global?c:c.anchors?.find(a=>a.frame===c.startup)??c;
   if(c.powered)drawPixelFx(g,'feather',point.x,point.y-90,(age-c.startup)/60,2.3,layer,true,.75);
   continue;
  }
  const stage=['common-jab','common-sweep','frog-left-kick','frog-ha','common-finish'].indexOf(c.id);
  if(stage<0&&c.id!=='common-air')continue;
  const t=(age-c.startup)/60;
  g.save();g.translate(c.x,c.y);g.scale(c.facing,1);
  if(c.powered){drawHolyCombo(g,holyComboArt,stage<0?2:stage,age-c.startup,layer,dragonRiseArt);g.restore();continue;}
  if(stage===0||stage===1){
   g.save();g.translate(10,stage===0?-51:-43);g.rotate(stage===0?-.12:.1);
   drawPixelFx(g,'thrust',0,0,t+.07,c.powered?1.85:1.22,layer,true,c.powered?.9:.62);g.restore();
  }
  if(stage===2||c.id==='common-air'){
   g.save();g.translate(27,-18);g.rotate(.7);drawPixelFx(g,'uppercut',0,0,t+.08,c.powered?1.7:1.15,layer,true,.72);g.restore();
  }
  g.restore();
 }
}

export function frogComboFrames(){return holyComboArt;}
export function frogDragonFrames(){return dragonRiseArt;}
export function frogGoldFrame(index:number){return gold[index];}
// Review uses the same trimmed sprites and height as the live actor renderer.
export function frogBodyComparison(){return [moves[0],normalGuard];}
export function frogFoundationFrames(){return [...basics,...scenes];}

export function frogReviewFrames(){
 return {moves, basics, scenes, travel, angels, stances:[normalGuard,crouch,thinking], intro:[intro]};
}

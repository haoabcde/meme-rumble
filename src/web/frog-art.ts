import type {FighterAction,FighterState,MatchConfig,MatchState} from '../core/types.js';
import {frogPowered} from '../core/frog-kit.js';
import {cutGrid} from './pixel-sprites.mjs';
import {drawPixelFx} from './pixel-fx.mjs';
import moveSource from '../../assets/角色/技能/奶娃/拳脚与捧腹_八姿态.png';
import angelSource from '../../assets/角色/大招/奶娃/神了/天使_四姿态.png';
import angelMoveSource from '../../assets/角色/大招/奶娃/神了/天使_拳脚捧腹_八姿态.png';
import introSource from '../../assets/角色/大招/奶娃/神了/神性指尖_演出像素关键帧.png';
let moves:HTMLCanvasElement[]=[],angels:HTMLCanvasElement[]=[],angelMoves:HTMLCanvasElement[]=[],intro:HTMLImageElement;
const load=(src:string)=>{const im=new Image();im.src=src;return im.decode().then(()=>im)};
void Promise.all([load(moveSource),load(angelSource),load(introSource),load(angelMoveSource)]).then(([m,a,i,am])=>{moves=cutGrid(m,4,2);angels=cutGrid(a,2,2);angelMoves=cutGrid(am,4,2);intro=i;});
const clamp=(n:number)=>Math.max(0,Math.min(1,n));
function actorImage(g:CanvasRenderingContext2D,im:HTMLCanvasElement,h:number,y=0){const w=h*im.width/im.height;g.drawImage(im,-w/2,y-h,w,h);}
export function drawFrogActor(g:CanvasRenderingContext2D,f:FighterState,state:MatchState,action?:FighterAction){
 if(!moves.length)return;
 const frame=f.attack?.frame??0,powered=frogPowered(f,state),a=action&&'frog' in action?action.frog:undefined;
 const stage=['common-jab','common-sweep','frog-left-kick','frog-ha','common-finish'].indexOf(action?.id??'');
 let pose=f.guarding?7:a==='laugh'||a==='global'?6:stage>=0?stage+1:action?.id==='common-air'?3:0;
 const h=pose===5?100:130,evAge=state.arenaFrame-(f.poseEvent?.tick??-999);
 g.save();g.imageSmoothingEnabled=false;
 if(!f.hp||f.recovery?.phase==='down'){g.translate(0,-20);g.rotate(-1.25);}
 else if(f.recovery?.phase==='fall')g.rotate(-.2);
 else if(f.hitstun)g.rotate(-.07);
 if(powered){
  const y=-18+Math.sin(state.arenaFrame*.1)*3;
  if(f.guarding)actorImage(g,angelMoves[7],164,y);
  else if(stage>=0||action?.id==='common-air'){
   const active=action&&frame>=action.startup;
   const move=action?.id==='common-air'?3:stage+1;
   g.translate(0,y);if(!active)g.rotate((stage%2?1:-1)*.04);
   actorImage(g,active?angelMoves[move]:angels[0],active&&move===5?145:164);
  }
  else if(a==='laugh'||a==='global'){
   g.translate(0,y);g.rotate(Math.sin(frame*.7)*.028);g.scale(1+Math.sin(frame*.7)*.014,1-Math.sin(frame*.7)*.012);actorImage(g,angelMoves[6],166);
  }else{g.translate(0,y);g.rotate(stage===0?-.07:stage===1?.07:0);actorImage(g,angels[0],164);}
 }else{
  if(f.moving&&pose===0){g.translate(0,-Math.abs(Math.sin(state.arenaFrame*.4))*4);g.rotate(Math.sin(state.arenaFrame*.4)*.025);}
  if(a==='laugh'||a==='global'){g.rotate(Math.sin(frame*.8)*.035);g.scale(1+Math.sin(frame*.8)*.018,1-Math.sin(frame*.8)*.018);}
  if(stage>=0&&action){const anticipation=clamp(frame/action.startup);if(frame<action.startup){pose=0;g.rotate((stage%2?1:-1)*anticipation*.09);g.scale(1+anticipation*.025,1-anticipation*.06);}}
  if(f.dashActive){g.save();g.globalAlpha=.18;actorImage(g,moves[0],130,-3);g.restore();g.translate(18,0);}
  actorImage(g,moves[pose],h);
 }
 g.restore();
}
export function drawFrogEffects(g:CanvasRenderingContext2D,state:MatchState,config:MatchConfig,layer:'back'|'front'){
 for(const seat of [0,1] as const){
  if(config.fighters[seat].id!=='frog')continue;
  const f=state.fighters[seat],a=config.fighters[seat].actions.find(a=>a.id===f.attack?.id),frame=f.attack?.frame??-999,power=frogPowered(f,state),scale=power?1.5:1;
  if(power)drawPixelFx(g,'halo',f.x,f.y-72,(state.arenaFrame%120)/60,2.4,layer,true,.44);
  const age=state.arenaFrame-(f.poseEvent?.tick??-999);
  if(f.poseEvent?.kind==='ascend'&&age<38)drawPixelFx(g,'feather',f.x,f.y-90,age/38*3,1.45,layer,true,.8);
  if(a&&'frog' in a&&(a.frog==='laugh'||a.frog==='global')){
   const starts=a.frog==='global'?[32]:[16,26,36];
   if(frame<a.startup&&layer==='back'){
    g.save();g.globalAlpha=.35*frame/a.startup;g.strokeStyle='#ffe4a1';g.lineWidth=3;g.beginPath();g.arc(f.x,f.y-65,30+25*frame/a.startup,0,Math.PI*2);g.stroke();g.restore();
   }
   for(const start of starts){const t=frame-start;if(t<0||t>20)continue;
    const k=a.frog==='global'?3:240/90*scale;
    drawPixelFx(g,'burst',f.x,f.y-65+28*k,.22+t/60*3,k,layer,true,.7);
    if(a.frog==='global'&&layer==='front'){
     const r=(config.arena.right-config.arena.left+config.arena.height)*clamp((t+1)/12);
     g.save();g.globalAlpha=clamp((20-t)/18)*.65;g.strokeStyle='#ffe5a8';g.lineWidth=9;g.beginPath();g.arc(f.x,f.y-65,r,0,Math.PI*2);g.stroke();g.restore();
    }
   }
  }
  if(a?.id==='frog-ha'&&frame>=3&&frame<19)drawPixelFx(g,'burst',f.x,f.y-65+28*scale, .22+(frame-3)/60*3,scale,layer,true,.8);
  if(a?.id==='common-finish'&&frame>=4&&frame<21){g.save();g.translate(f.x,f.y-25);g.scale(f.facing,1);g.rotate(.8);drawPixelFx(g,'uppercut',0,0,(frame-4)/60*2,1.25*scale,layer,true,.62);g.restore();}
  const target=state.fighters[seat===0?1:0],hitAge=state.arenaFrame-(target.poseEvent?.tick??-999);
  if(layer==='front'&&['hurt','heavy','launch'].includes(target.poseEvent?.kind??'')&&hitAge<14)drawPixelFx(g,'blunt',target.x,target.y-30,hitAge/60*2,1.25,layer,true,.65);
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
  if(phase>20)drawPixelFx(g,'feather',690,350,(phase-20)/40*2,2.5,'front',true,.6);
  g.save();g.translate(1020,617);g.rotate(-.1);g.textAlign='center';g.font='900 88px Microsoft YaHei';g.lineWidth=8;g.strokeStyle='#684017';g.strokeText('神了！',0,0);g.fillStyle='#fff2b4';g.fillText('神了！',0,0);g.restore();g.restore();
 }
}

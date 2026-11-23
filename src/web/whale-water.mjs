import {WHALE_RULES} from '../core/whale-kit.js';
import {cutGrid,createPoseMorph} from './pixel-sprites.mjs';
import {drawPixelFx} from './pixel-fx.mjs';
import {orbitSample,eruptionSample,ERUPTIONS} from './whale-presentation.mjs';
import {createSchoolRenderer} from './water-school.mjs';
// Independent pixel sprites, world-space depth layers and simulation-clock animation.
const clamp=n=>Math.max(0,Math.min(1,n));
const TAU=Math.PI*2;
function parts(im){
 return Array.from({length:4},(_,i)=>{
  const w=im.width/2,h=im.height/2,c=document.createElement('canvas');c.width=w;c.height=h;
  const g=c.getContext('2d',{willReadFrequently:true});g.drawImage(im,(i%2)*w,Math.floor(i/2)*h,w,h,0,0,w,h);
  const p=g.getImageData(0,0,w,h).data;let l=w,t=h,r=0,b=0;
  for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(p[(y*w+x)*4+3]>30){l=Math.min(l,x);t=Math.min(t,y);r=Math.max(r,x);b=Math.max(b,y);}
  const out=document.createElement('canvas');out.width=Math.max(1,Math.ceil((r-l+1)/3));out.height=Math.max(1,Math.ceil((b-t+1)/3));
  out.getContext('2d').drawImage(c,l,t,r-l+1,b-t+1,0,0,out.width,out.height);return out;
 });
}
function sprite(g,im,x,y,w,alpha=1,angle=0,flip=1){
 g.save();g.imageSmoothingEnabled=false;g.globalAlpha*=clamp(alpha);g.translate(Math.round(x),Math.round(y));g.rotate(angle);g.scale(flip,1);g.drawImage(im,-w/2,-w*im.height/im.width/2,w,w*im.height/im.width);g.restore();
}
// Curved spine bends the water whale's own body and fins instead of moving a rigid card.
function swim(g,im,x,y,w,phase,alpha=1,flip=1){
 g.save();g.imageSmoothingEnabled=false;g.globalAlpha*=clamp(alpha);g.translate(Math.round(x),Math.round(y));g.scale(flip,1);
 const h=w*im.height/im.width,segments=24;
 for(let i=0;i<segments;i++){
  const u=(i+.5)/segments,amp=6*Math.pow(1-u,1.6),dy=Math.sin(phase-u*5)*amp;
  g.save();g.translate((u-.5)*w,dy);g.rotate(Math.cos(phase-u*5)*amp/w*4);
  g.drawImage(im,i*im.width/segments,0,im.width/segments+1,im.height,-w/segments/2,-h/2,w/segments+1.5,h);g.restore();
 }g.restore();
}
// Runtime water palette: retain luminance and transparency, shift green water to pale blue.
function paleWater(im){
 const c=document.createElement('canvas');c.width=im.width;c.height=im.height;const g=c.getContext('2d',{willReadFrequently:true});g.drawImage(im,0,0);
 const image=g.getImageData(0,0,c.width,c.height),p=image.data;
 for(let i=0;i<p.length;i+=4){
  if(!p[i+3])continue;
  const v=Math.max(p[i],p[i+1],p[i+2])/255;
  const white=clamp((v-.96)/.04);
  const r=12+185*Math.pow(v,1.1),green=52+178*v;
  p[i]=r+(255-r)*white;p[i+1]=green+(255-green)*white;p[i+2]=110+145*v;
 }

 g.putImageData(image,0,0);return c;
}
// One blue-grey / ice-blue / silver-white family, with a quieter pool and brighter fish.
// Luminance retains body modelling; using max(R,G,B) made cyan water and white ridges alike.
const ICE_STOPS=[[0,26,51,79],[.28,42,88,124],[.55,76,147,188],[.78,132,201,229],[.92,198,236,248],[1,240,252,255]];
function ultimateWater(im,role='whale'){
 const c=document.createElement('canvas');c.width=im.width;c.height=im.height;
 const g=c.getContext('2d',{willReadFrequently:true});g.drawImage(im,0,0);
 const image=g.getImageData(0,0,c.width,c.height),p=image.data;
 for(let i=0;i<p.length;i+=4){
  if(!p[i+3])continue;
  const light=(.22*p[i]+.56*p[i+1]+.22*p[i+2])/255,white=clamp((Math.min(p[i],p[i+1],p[i+2])/255-.72)/.28);
  const t=clamp(light*(role==='pool'?.9:.98)+white*.1+(role==='fish'?.09:0));
  const n=ICE_STOPS.findIndex(stop=>stop[0]>=t),hi=ICE_STOPS[Math.max(1,n)],lo=ICE_STOPS[Math.max(0,n-1)],u=clamp((t-lo[0])/(hi[0]-lo[0]));
  for(let channel=0;channel<3;channel++)p[i+channel]=lo[channel+1]+(hi[channel+1]-lo[channel+1])*u;
  if(role==='whale'&&p[i+3]>100)p[i+3]=Math.min(255,p[i+3]*1.17);
 }
 g.putImageData(image,0,0);return c;
}
const ridgeCache=new WeakMap();
function whaleLight(g,morph,pose,x,y,width,alpha,rotation=0){
 const frame=morph.frame(pose);let ridge=ridgeCache.get(frame);
 if(!ridge){
  ridge=document.createElement('canvas');ridge.width=frame.width;ridge.height=frame.height;
  const rg=ridge.getContext('2d',{willReadFrequently:true});rg.drawImage(frame,0,0);
  const image=rg.getImageData(0,0,ridge.width,ridge.height),p=image.data;
  for(let i=0;i<p.length;i+=4){const white=Math.min(p[i],p[i+1],p[i+2])/255;p[i+3]*=Math.pow(clamp((white-.66)/.34),1.5);p[i]=226;p[i+1]=249;p[i+2]=255;}
  rg.putImageData(image,0,0);ridgeCache.set(frame,ridge);
 }
 g.save();g.imageSmoothingEnabled=false;g.globalCompositeOperation='screen';g.globalAlpha*=alpha;
 g.translate(x,y);g.rotate(rotation);g.scale(width/200,width/200);g.drawImage(ridge,-160,-160);g.restore();
}
export function createWaterRenderer(images){
 const whales=parts(images.waterWhale).map(im=>paleWater(im)),water=parts(images.waterParts).map(im=>paleWater(im)),runes=parts(images.runeParts).map(im=>paleWater(im));
 const school=createSchoolRenderer(images.fishSchool,im=>ultimateWater(im,'fish'));
 const turning=createPoseMorph(cutGrid(images.whaleTurn,4,2).map(im=>paleWater(im)));
 const introWhale=createPoseMorph(cutGrid(images.whaleTurn,4,2).map(im=>ultimateWater(im))),leaping=createPoseMorph(cutGrid(images.whaleLeap,4,2).map(im=>ultimateWater(im)));
 const poolWater=parts(images.waterParts).map(im=>ultimateWater(im,'pool')),poolRunes=parts(images.runeParts).map(im=>ultimateWater(im));
 function droplets(g,x,y,t,amount=14,alpha=1){
  g.save();for(let j=0;j<amount;j++){const p=((t+j*2.71)%23)/23,a=j*2.399;g.globalAlpha=alpha*(1-p)*.8;g.fillStyle=j%3?'#9bd4ff':'#effaff';const xx=x+Math.cos(a)*(15+70*p),yy=y-18-110*p+85*p*p;g.fillRect(Math.round(xx/3)*3,Math.round(yy/3)*3,3,3);}g.restore();
 }
 function pool(g,e,layer){
  const water=poolWater,runes=poolRunes;
  const warning=WHALE_RULES.telegraph,end=warning+WHALE_RULES.ultimateHits*WHALE_RULES.hitGap,fade=clamp((end+48-e.age)/20),active=e.age>=warning;
  if(layer==='back'){
   const pulse=1+Math.sin(e.age*.16)*.018;
   g.save();g.translate(e.x,e.y-2);g.scale(1,.22);
   const lake=g.createRadialGradient(0,0,8,0,0,150);lake.addColorStop(0,'#315b79a6');lake.addColorStop(.65,'#81bed536');lake.addColorStop(1,'#d8f6ff00');
   g.globalAlpha=fade*(active?.6:.35);g.fillStyle=lake;g.beginPath();g.arc(0,0,150,0,TAU);g.fill();g.restore();
   sprite(g,water[0],e.x,e.y-2,310*pulse,(active?.87:.55)*fade);
   if(!active){g.save();g.translate(e.x,e.y-3);g.scale(1,.38);drawPixelFx(g,'whirlpool',0,0,e.age/60,2.35,'both','ice',(.2+.4*e.age/warning)*fade);g.restore();}
   // A progressive elliptical rim communicates the existing 0.6-second warning.
   if(!active){g.save();g.translate(e.x,e.y-3);g.scale(1,.22);g.strokeStyle='#c8e9ff';g.lineWidth=3;g.setLineDash([5,3]);g.beginPath();g.arc(0,0,149,-Math.PI/2,-Math.PI/2+TAU*e.age/warning);g.stroke();g.restore();}
  }
  if(!active)return;
  for(let i=0;i<ERUPTIONS.length;i++){
   const age=e.age-warning-ERUPTIONS[i].at;if(age<0||age>76)continue;
   const front=i%2===0||i===11;if((layer==='front')!==front)continue;
   const whale=eruptionSample(age,i),last=i===11;
   if(whale.y< -2100)continue;
   g.save();g.beginPath();g.rect(e.x-2600,e.y-4600,5200,4600);g.clip();
   const path=lag=>{const t=age-lag/whale.speed;if(t<0)return null;const p=eruptionSample(t,i);return{x:e.x+p.x,y:e.y+p.y,angle:p.angle};};
   school(g,path,age,last?1.8:Math.max(.8,whale.width/210),fade*(last?1:.85),last?4:2);
   const x=e.x+whale.x,y=e.y+whale.y;
   leaping.draw(g,whale.pose,x,y,whale.width,whale.alpha*fade,1,whale.rotation);
   whaleLight(g,leaping,whale.pose,x,y,whale.width,whale.alpha*fade*(last?.45:.25),whale.rotation);
   if(age<18){
    sprite(g,water[1],e.x+whale.offset,e.y-35-age*4,last?360:135+whale.width*.3,clamp((18-age)/12)*fade,0);
    droplets(g,e.x+whale.offset,e.y-4,age+i*3,last?34:14,fade);
   }
   if(last&&age<32){
    drawPixelFx(g,'wave',e.x,e.y,.2+age/60*2,3.2,layer,'ice',clamp((32-age)/16)*.5);
    for(let k=0;k<3;k++){
     const t=age-k*4;if(t<0)continue;g.save();g.translate(e.x,e.y-2);g.scale(1,.22);g.globalAlpha=clamp((26-t)/20)*fade*.9;g.strokeStyle=k%2?'#effcff':'#9ed5e8';g.lineWidth=6-k;g.beginPath();g.arc(0,0,24+t*9,0,TAU);g.stroke();g.restore();
    }
   }
   g.restore();
  }
  if(layer==='front'){
   sprite(g,water[0],e.x,e.y+2,314,.12*fade);droplets(g,e.x,e.y,e.age,18,fade*.7);
   if(e.lastContactAge!==undefined&&e.age-e.lastContactAge<5)sprite(g,runes[3],e.x,e.y-75,68,clamp((5-e.age+e.lastContactAge)/5)*.4);
  }
 }
 function orbit(g,e,layer){
  const {angle:a,p,depth,fade}=orbitSample(e.age,e.windTicks??20,e.definition.behavior==='spin'),front=depth>0;
  if((layer==='front')!==front)return;
  const x=e.x+Math.cos(a)*112,y=e.y-70-p*156+depth*28,w=119+depth*17;
  const yaw=(((a+Math.PI/2)/TAU*8)%8+8)%8;
  const dir=-Math.sin(a)>=0?1:-1;
  sprite(g,runes[1],x-dir*35,y+6,w*.9,fade*.16,-.1,dir);
  turning.draw(g,yaw,x,y,w,fade*(front?.95:.6),1,-.12*Math.cos(a));
 }
 function motion(g,f,state,action,layer){
  if(layer!=='front')return;
  // Author all trails in the correct right-facing space, then mirror the complete transform.
  // Mirroring just the sprite after a world-space rotation reversed the left-facing slash angle.
  g.save();g.translate(Math.round(f.x),Math.round(f.y));g.scale(f.facing,1);
  const ev=f.poseEvent,age=ev?state.arenaFrame-ev.tick:999;
  if(ev?.kind==='dash'&&age<15)sprite(g,runes[1],-58,-65,188,clamp((15-age)/10)*.62);
  if((ev?.kind==='jump'||ev?.kind==='air-jump')&&age<15){sprite(g,water[1],-13,22,59,clamp((15-age)/10)*.48,.15);sprite(g,runes[2],0,10,39,clamp((15-age)/10)*.35);droplets(g,0,14,age,8,.5);}
  if(!f.attack||!action){g.restore();return;}
  const frame=f.attack.frame;
  if(action.slot==='A'){
   const p=(frame-action.startup+2)/11;if(p<0||p>1){g.restore();return;}
   const finish=action.id==='common-finish';
   sprite(g,runes[0],80,-(finish?118:74),finish?200:172,Math.sin(p*Math.PI)*.7,finish?-.6:(action.id==='common-sweep'?.22:-.18));
   sprite(g,water[1],59,-(finish?120:72),finish?102:82,Math.sin(p*Math.PI)*.3,finish?-.3:Math.PI/2);
   droplets(g,108,-80,frame,8,.5);
  }
  if(action.whale==='rice'||action.whale==='rice-up'){
   const p=(frame-8)/9;if(p>=0&&p<1)sprite(g,runes[1],40,-94,75,(1-p)*.32,action.whale==='rice-up'?-Math.PI/3:.2);
  }
  g.restore();
 }
 function cinematic(g,phase){
  const a=-2.7+phase/60*TAU*.9,x=640+Math.cos(a)*430,y=350+Math.sin(a)*225;
  const alpha=clamp(phase/5)*clamp((60-phase)/9);
  school(g,lag=>{const q=a-lag/410;return{x:640+Math.cos(q)*430,y:350+Math.sin(q)*225,angle:Math.atan2(Math.cos(q)*225,-Math.sin(q)*430)};},phase,1.5,alpha*.9,4);
  const yaw=(((a+Math.PI/2)/TAU*8)%8+8)%8;
  const width=405+Math.sin(a)*35;
  introWhale.draw(g,yaw,x,y,width,alpha,1,0);
  whaleLight(g,introWhale,yaw,x,y,width,alpha*.42);
 }
 return{whales,pool,orbit,motion,cinematic};
}

import {cutGrid,createPoseMorph} from './pixel-sprites.mjs';
import {drawPixelFx} from './pixel-fx.mjs';
import {orbitAngle,leapSample} from './whale-presentation.mjs';
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
 for(let i=0;i<p.length;i+=4){if(!p[i+3])continue;const v=Math.max(p[i],p[i+1],p[i+2])/255,white=clamp((v-.96)/.04),r=12+185*Math.pow(v,1.1),green=52+178*v;p[i]=r+(255-r)*white;p[i+1]=green+(255-green)*white;p[i+2]=117+138*v;}
 g.putImageData(image,0,0);return c;
}
export function createWaterRenderer(images){
 const whales=parts(images.waterWhale).map(paleWater),water=parts(images.waterParts).map(paleWater),runes=parts(images.runeParts).map(paleWater);
 const turning=createPoseMorph(cutGrid(images.whaleTurn,4,2).map(paleWater)),leaping=createPoseMorph(cutGrid(images.whaleLeap,4,2).map(paleWater));
 function droplets(g,x,y,t,amount=14,alpha=1){
  g.save();for(let j=0;j<amount;j++){const p=((t+j*2.71)%23)/23,a=j*2.399;g.globalAlpha=alpha*(1-p)*.8;g.fillStyle=j%3?'#9bd4ff':'#effaff';const xx=x+Math.cos(a)*(15+70*p),yy=y-18-110*p+85*p*p;g.fillRect(Math.round(xx/3)*3,Math.round(yy/3)*3,3,3);}g.restore();
 }
 function pool(g,e,layer){
  const warning=60,end=warning+12*7,fade=clamp((end+48-e.age)/20),active=e.age>=warning;
  if(layer==='back'){
   const pulse=1+Math.sin(e.age*.16)*.018;
   sprite(g,water[0],e.x,e.y-2,310*pulse,(active?.9:.55)*fade);
   if(!active){g.save();g.translate(e.x,e.y-3);g.scale(1,.38);drawPixelFx(g,'whirlpool',0,0,e.age/60,2.35,'both','blue',(.2+.45*e.age/warning)*fade);g.restore();}
   // A progressive elliptical rim communicates a full second before the eruptions.
   if(!active){g.save();g.translate(e.x,e.y-3);g.scale(1,.22);g.strokeStyle='#c8e9ff';g.lineWidth=3;g.setLineDash([5,3]);g.beginPath();g.arc(0,0,149,-Math.PI/2,-Math.PI/2+TAU*e.age/warning);g.stroke();g.restore();}
  }
  if(!active)return;
  for(let i=0;i<12;i++){
   const age=e.age-warning-i*7;if(age<0||age>48)continue;
   const front=i%2===0;if((layer==='front')!==front)continue;
   const p=age/48,env=clamp(age/3)*clamp((48-age)/10),side=i%2?1:-1;
   const ox=((i*47)%170)-85;
   g.save();g.beginPath();g.rect(e.x-195,e.y-510,390,510);g.clip();
   // Water jets and individual sprites leave the pool, crest, dissolve and return.
   sprite(g,water[1],e.x+ox*.65,e.y-65-22*Math.sin(p*Math.PI),114,env*.52*fade,side*.17,side);
   if(i%4===0){
    const leap=leapSample(age,i),x=e.x+ox*.35+side*Math.sin(p*Math.PI)*60,y=e.y+55-leap.height*leap.peak;
    sprite(g,runes[2],x-side*35,y+75,65+i*3,env*.45*fade,side*.5,side);
    leaping.draw(g,leap.pose,x,y,leap.width,env*fade,side,side*(p-.5)*.12);
    // The launch spray stays rooted to the pool, rather than following the whale as a rigid tail.
    if(age<16)sprite(g,water[1],e.x+ox*.35,e.y-35-age*3,125+i*7,clamp((16-age)/10)*fade,side*.1,side);
    if(age>34){
     const q=(age-34)/14;g.save();g.translate(e.x+ox*.35,e.y-3);g.scale(1,.24);g.globalAlpha*=Math.sin(q*Math.PI)*fade*.8;g.strokeStyle='#c6eaff';g.lineWidth=5-q*3;g.beginPath();g.arc(0,0,18+q*(80+i*4),0,TAU);g.stroke();g.restore();
    }

   }else{
    const flower=i%3===0,im=flower?water[3]:water[2];
    sprite(g,im,e.x+ox+side*p*42,e.y+20-Math.sin(p*Math.PI)*(flower?160:205),flower?63:75,env*.9*fade,side*(p-.5)*.75,side);
   }
   droplets(g,e.x+ox,e.y-4,age+i*3,10,env*fade);g.restore();
  }
  if(layer==='front'){
   sprite(g,water[0],e.x,e.y+2,314,.18*fade);droplets(g,e.x,e.y,e.age,18,fade*.7);
   if(e.lastContactAge!==undefined&&e.age-e.lastContactAge<5)sprite(g,runes[3],e.x,e.y-75,68,clamp((5-e.age+e.lastContactAge)/5)*.4);
  }
 }
 function orbit(g,e,layer){
  const wind=e.windTicks??20,total=wind+28,p=clamp(e.age/total),fade=clamp(e.age/3)*clamp((total-e.age)/16);
  const a=orbitAngle(e.age,wind,e.definition.behavior==='spin'),depth=Math.sin(a),front=depth>0;
  if((layer==='front')!==front)return;
  const x=e.x+Math.cos(a)*112,y=e.y-70-p*156+depth*28,w=119+depth*17;
  const yaw=(((a+Math.PI/2)/TAU*8)%8+8)%8;
  const dir=-Math.sin(a)>=0?1:-1;
  sprite(g,runes[1],x-dir*35,y+6,w*.9,fade*.16,-.1,dir);
  turning.draw(g,yaw,x,y,w,fade*(front?.95:.6),1,-.12*Math.cos(a));
 }
 function motion(g,f,state,action,layer){
  if(layer!=='front')return;
  const ev=f.poseEvent,age=ev?state.arenaFrame-ev.tick:999;
  if(ev?.kind==='dash'&&age<15)sprite(g,runes[1],f.x-f.facing*58,f.y-65,188,clamp((15-age)/10)*.62,0,f.facing);
  if((ev?.kind==='jump'||ev?.kind==='air-jump')&&age<15){sprite(g,water[1],f.x-f.facing*13,f.y+22,59,clamp((15-age)/10)*.48,.15,f.facing);sprite(g,runes[2],f.x,f.y+10,39,clamp((15-age)/10)*.35);droplets(g,f.x,f.y+14,age,8,.5);}
  if(!f.attack||!action)return;
  const frame=f.attack.frame;
  if(action.slot==='A'){
   const p=(frame-action.startup+2)/11;if(p<0||p>1)return;
   const finish=action.id==='common-finish';
   sprite(g,runes[0],f.x+f.facing*80,f.y-(finish?118:74),finish?200:172,Math.sin(p*Math.PI)*.7,finish?-.6:(action.id==='common-sweep'?.22:-.18),f.facing);
   sprite(g,water[1],f.x+f.facing*59,f.y-(finish?120:72),finish?102:82,Math.sin(p*Math.PI)*.3,finish?-.3:Math.PI/2,f.facing);
   droplets(g,f.x+f.facing*108,f.y-80,frame,8,.5);
  }
  if(action.whale==='rice'||action.whale==='rice-up'){
   const p=(frame-8)/9;if(p>=0&&p<1)sprite(g,runes[1],f.x+f.facing*40,f.y-94,75,(1-p)*.32,action.whale==='rice-up'?-Math.PI/3:.2,f.facing);
  }
 }
 return{whales,pool,orbit,motion};
}

// Reference-authored seal and flowing strands follow the actual simulation endpoints.
import {empoweredPortalScale,dodgePortalScale,EMPOWERED_PORTAL_LIFE,drawPortalImage} from './frog-portal.mjs';
let seal,ribbon;
const clamp=n=>Math.max(0,Math.min(1,n));
export function setTeleportArt(parts){[seal,ribbon]=parts;}
export function teleportPoint(w,u){
 const x=w.fromX+(w.toX-w.fromX)*u,y=w.fromY-94+(w.toY-w.fromY)*u;
 return{x,y:y-Math.sin(u*Math.PI)*Math.min(70,Math.hypot(w.toX-w.fromX,w.toY-w.fromY)*.13)};
}
export function teleportWindow(age){return{head:clamp(age/6),tail:clamp((age-12)/30),alpha:clamp((age+1)/2)*clamp((44-age)/16)};}
function drawTrail(g,w,{head,tail,alpha}){
 g.save();g.imageSmoothingEnabled=false;g.globalAlpha*=alpha;
 // Texture strips bend with the flight curve, rather than a straight rigid beam.
 const strips=44;
 for(let i=0;i<strips;i++){
  const a=Math.max(tail,i/strips),b=Math.min(head,(i+1)/strips);if(b<=a)continue;
  const p=teleportPoint(w,a),q=teleportPoint(w,b),len=Math.hypot(q.x-p.x,q.y-p.y);
  if(len<.01)continue;
  g.save();g.translate(p.x,p.y);g.rotate(Math.atan2(q.y-p.y,q.x-p.x));
  const height=44+16*Math.sin((a+b)*Math.PI/2);
  g.drawImage(ribbon,a*ribbon.width,0,(b-a)*ribbon.width,ribbon.height,0,-height/2,len+1.2,height);g.restore();
 }
 // The ring extends beyond the angel's wings, while the character still masks its centre.
 g.restore();
}
function drawSeal(g,w,age,scale){
 if(scale<=.001)return;
 const size=248*scale;
 g.save();g.imageSmoothingEnabled=false;
 g.translate(w.toX,w.toY-94);
 g.globalAlpha*=clamp((age+1)/3);
 drawPortalImage(g,seal,size,1,age,true);
 g.restore();
}
export function drawTeleport(g,w,age,layer){
 if(!w.powered||layer!=='back'||age<0||age>EMPOWERED_PORTAL_LIFE||!seal||!ribbon)return;
 const trail=teleportWindow(age);if(trail.alpha>0)drawTrail(g,w,trail);
 drawSeal(g,w,age,empoweredPortalScale(age));
}
export function dodgeTeleportSample(d,tick){
 const age=d.arrivedAt===undefined?undefined:tick-d.arrivedAt;
 return{age,head:1,tail:age===undefined?0:clamp((age-8)/28),alpha:age===undefined?1:clamp((38-age)/16),
  sealScale:age===undefined?0:dodgePortalScale(age)};
}
export function drawDodgeTeleport(g,d,tick,layer){
 if(layer!=='back'||!seal||!ribbon||tick<d.tick)return;
 const sample=dodgeTeleportSample(d,tick);
 if(sample.alpha>0)drawTrail(g,d,sample);
 if(sample.age!==undefined)drawSeal(g,d,sample.age,sample.sealScale);
}

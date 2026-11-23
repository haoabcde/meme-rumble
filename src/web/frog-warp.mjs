// Authored reference-derived spell textures; projected floor discs stay horizontal.
import {portalScale,empoweredPortalScale,EMPOWERED_PORTAL_LIFE,drawPortalImage} from './frog-portal.mjs';
let spirals=[],discs=[];
export function setWarpArt(swirl,disc){spirals=swirl;discs=disc;}
const clamp=n=>Math.max(0,Math.min(1,n));
export function warpDiscScale(age,powered=false){return powered?empoweredPortalScale(age):portalScale(age);}
export function drawWarp(g,x,y,age,powered,layer,disc=false){
 const life=disc?(powered?EMPOWERED_PORTAL_LIFE:32):38;
 if(age<0||age>life)return;
 const im=(disc?discs:spirals)[powered?1:0];if(!im)return;
 const fade=clamp((age+1)/3)*clamp((life-age)/12),grow=disc?warpDiscScale(age,powered):1-.48*clamp(age/30);
 if(grow<=.001)return;
 const w=(powered?disc?245:205:disc?180:158)*grow,h=w*im.height/im.width;
 g.save();g.imageSmoothingEnabled=false;g.globalAlpha*=fade*(powered?.98:.46);g.translate(x,y);
 g.beginPath();g.rect(-w,layer==='back'?-h:0,w*2,h);g.clip();
 if(disc)drawPortalImage(g,im,w,h/w,age,powered);
 else{g.rotate(-age*.105);g.drawImage(im,-w/2,-h/2,w,h);}
 g.restore();
}

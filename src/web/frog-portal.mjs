import {drawPixelFx} from './pixel-fx.mjs';
const clamp=n=>Math.max(0,Math.min(1,n));
// One opening, one reveal interval, one closing. Never pulse or reopen.
export function portalScale(age,open=6,reveal=10,close=16){
 if(age<0||age>=open+reveal+close)return 0;
 if(age<open)return 1-Math.pow(1-age/open,3);
 if(age<=open+reveal)return 1;
 return Math.pow(1-(age-open-reveal)/close,2);
}
// Keep the seal after the character is fully visible, then close it once.
export const EMPOWERED_PORTAL_LIFE=54;
export function empoweredPortalScale(age){return portalScale(age,6,28,20);}
export function dodgePortalScale(age){return portalScale(age,3,21,20);}
export function drawPortalImage(g,im,size,ratio,age,powered){
 g.save();g.imageSmoothingEnabled=false;g.scale(1,ratio);
 // Unproject first: rotation happens in the seal's own plane, not by rocking its ellipse.
 g.save();g.beginPath();g.arc(0,0,size*.325,0,Math.PI*2);g.clip();
 g.drawImage(im,-size/2,-size/2,size,size);g.restore();
 g.save();g.beginPath();g.arc(0,0,size*.55,0,Math.PI*2);g.arc(0,0,size*.325,0,Math.PI*2,true);g.clip('evenodd');
 g.rotate(age*.045);g.drawImage(im,-size/2,-size/2,size,size);g.restore();
 // Reuse only the rotating outer rays of the transformation sun, with its core masked out.
 g.save();g.beginPath();g.arc(0,0,size*.68,0,Math.PI*2);g.arc(0,0,size*.46,0,Math.PI*2,true);g.clip('evenodd');
 g.rotate(age*.045);drawPixelFx(g,'sun',0,0,age/60,size/78,'both',true,powered?.68:.3);g.restore();
 g.restore();
}

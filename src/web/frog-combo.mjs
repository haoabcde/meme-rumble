// Authored gold energy, driven by the real cast clock (including cancels/hitstop).
export function holyComboSample(stage,age){
 const start=-3,life=stage===4?32:stage===3?27:23;
 if(age<start||age>=life)return null;
 const t=(age-start)/(life-start),open=1-Math.pow(1-Math.min(1,t*3.5),3);
 return{stage,t,open,alpha:Math.min(1,(age-start)/3)*Math.pow(1-t,1.15),
  width:[232,244,270,288,340][stage]*(.38+.62*open),
  height:[94,142,180,288,230][stage]*(.65+.35*open),
  x:stage===3?0:[112,116,122,0,144][stage]+t*(stage===4?12:8),
  y:stage===3?-65:[-73,-72,-92,-65,-99][stage]-Math.sin(t*Math.PI)*(stage===4?28:10),
  angle:stage===3?t*.7:[-.12,.18,-.3,0,-.18][stage]+t*(stage===1?-.36:.2)};
}
export function drawHolyCombo(g,art,stage,age,layer){
 const s=holyComboSample(stage,age);if(!s||!art.length)return;
 const im=art[stage],front=layer==='front';
 g.save();g.imageSmoothingEnabled=false;g.translate(s.x,s.y);g.rotate(s.angle);
 g.globalAlpha*=s.alpha*(front?.96:.20);
 const w=s.width*(front?1:1.12),h=s.height*(front?1:1.10);
 // Advancing phase bends the authored stream rather than spinning a frozen decal.
 const count=24;
 for(let n=0;n<count;n++){
  const u=n/count,sw=im.width/count;
  const bend=stage===3?0:Math.sin(u*7-s.t*9+stage)*Math.sin(Math.PI*u)*(stage===4?11:6)*s.open;
  g.drawImage(im,n*sw,0,sw,im.height,-w/2+u*w,-h/2+bend,w/count+.7,h);
 }
 g.restore();
 if(!front)return;
 // Short detached feathers keep successive hits legible; they decay with the cast.
 const trail=art[7];if(!trail)return;
 g.save();g.globalAlpha*=s.alpha*.42;g.translate(s.x-35-s.t*35,s.y+18);g.rotate(-.12+s.t*.2);
 g.drawImage(trail,-s.width*.38,-28,s.width*.65,56);g.restore();
}

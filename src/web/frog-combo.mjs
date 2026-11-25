// Cast-driven, grounded impacts. No drifting feathers or sine-wave deformation.
const clamp=n=>Math.max(0,Math.min(1,n));
export function holyComboSample(stage,age){
 if(stage===4){
  if(age< -7||age>=39)return null;
  const frame=Math.min(5,Math.floor((age+7)/5));
  return{stage,age,dragonFrame:frame,open:1,width:310,height:310,x:160,y:-149,baseY:6,
   alpha:clamp((age+8)/3)*clamp((39-age)/12),impact:age>=0&&age<4?1-age/4:age>=18&&age<22?1-(age-18)/4:0};
 }
 const life=[12,14,16,15][stage];
 if(age< -3||age>=life)return null;
 const open=age<0?.65+.35*(age+3)/3:1;
 return{stage,age,open,alpha:age<0?.18*(age+3)/3:age<3?1:Math.pow(clamp((life-age)/(life-3)),1.6),
  width:[232,244,270,288][stage]*open,height:[86,142,180,288][stage]*open,
  x:[112,116,122,0][stage],y:[-73,-72,-92,-65][stage],
  angle:[-.10,.16,-.28,0][stage]+(stage===1?-.26:stage===2?.18:0)*clamp(age/3),
  impact:age>=0&&age<4?1-age/4:0};
}
// Keep full cell registration; per-frame trimming changes apparent scale and baseline.
export function registeredDragonFrames(im){
 return Array.from({length:6},(_,i)=>{
  const c=document.createElement('canvas');c.width=c.height=256;
  const g=c.getContext('2d');g.imageSmoothingEnabled=false;
  g.drawImage(im,(i%3)*im.width/3,Math.floor(i/3)*im.height/2,im.width/3,im.height/2,0,0,256,256);
  return c;
 });
}
function groundImpact(g,x,age,strength){
 if(age<0||age>17)return;
 const fade=clamp((17-age)/13),r=35+Math.min(age,7)*9;
 g.save();g.globalAlpha*=fade*strength;g.lineWidth=4;g.strokeStyle='#f4bd39';
 g.beginPath();g.ellipse(x,2,r,7+Math.min(age,6),0,0,Math.PI*2);g.stroke();
 g.fillStyle='#fff5cf';
 for(let n=0;n<7;n++){
  const side=n%2?1:-1,d=18+n*10+age*2;
  const y=-(age*2.8-age*age*.12)*(n%3+1)/3;
  g.fillRect(Math.round(x+side*d),Math.round(y),5+n%3,3+n%2);
 }
 g.restore();
}
export function drawHolyCombo(g,art,stage,age,layer,dragons=[]){
 const s=holyComboSample(stage,age);if(!s)return;
 const front=layer==='front';
 if(stage===4){
  if(!dragons.length)return;
  g.save();g.imageSmoothingEnabled=false;g.globalAlpha*=s.alpha;
  if(front){
   g.drawImage(dragons[s.dragonFrame],s.x-s.width/2,s.baseY-s.height,s.width,s.height);
   groundImpact(g,s.x,age+1,.9);groundImpact(g,s.x,age-18,.8);
  }else{
   g.globalAlpha*=.8;g.strokeStyle='#ffeaba';g.lineWidth=3;
   for(let n=0;n<3;n++){
    const rise=clamp((age+5-n*2)/20),x=s.x+(n-1)*72;
    g.beginPath();g.moveTo(x,0);g.lineTo(x-16,-260*rise);g.stroke();
   }
  }
  g.restore();return;
 }
 const im=art[stage];if(!im)return;
 g.save();g.imageSmoothingEnabled=false;g.globalAlpha*=s.alpha*(front?1:.08);
 g.translate(s.x,s.y);g.rotate(s.angle);
 g.drawImage(im,-s.width/2,-s.height/2,s.width,s.height);
 if(front&&s.impact>0){
  g.globalAlpha*=s.impact;g.fillStyle='#fff9e1';
  if(stage===3){
   g.lineWidth=7;g.strokeStyle='#fff6cf';g.beginPath();g.arc(0,0,120+s.age*4,0,Math.PI*2);g.stroke();
  }else{
   g.beginPath();g.moveTo(-s.width*.45,8);g.lineTo(s.width*.47,-2);g.lineTo(-s.width*.12,-8);g.closePath();g.fill();
  }
 }
 g.restore();
 if(front)groundImpact(g,stage===3?0:50,age,.65);
}

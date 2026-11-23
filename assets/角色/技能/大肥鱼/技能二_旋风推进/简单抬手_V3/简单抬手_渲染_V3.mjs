// Keep the approved normal body. Replace only the small sleeve/forearm region.
export function createSimpleHandRenderer(normal,raised){
  const pose=document.createElement('canvas');pose.width=1070;pose.height=1470;
  const g=pose.getContext('2d');g.drawImage(normal,0,0);
  g.save();g.beginPath();g.rect(738,826,238,322);g.clip();g.clearRect(0,0,1070,1470);g.drawImage(raised,0,0);g.restore();
  const ease=x=>{const q=Math.max(0,Math.min(1,x));return q*q*(3-2*q);};
  return {pose,draw(ctx,x,y,age,flip=1,height=144){
    if(age<0||age>=22)return false;
    const blend=age<6?ease(age/6):age<=14?1:1-ease((age-14)/8);
    ctx.save();ctx.translate(x,y);ctx.scale(flip*height/1350,height/1350);ctx.imageSmoothingEnabled=false;
    ctx.drawImage(normal,-599,-1424);ctx.globalAlpha*=blend;ctx.drawImage(pose,-599,-1424);ctx.restore();return true;
  }};
}

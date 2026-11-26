// The same original body is used for both states. Only the basin layer switches.
export const GUARD_ENTER_FRAMES=0;
export const GUARD_PRESS_FRAME=35;
export function guardCellAt(age){return age<0?-1:0;}
export const GUARD_LAYOUT={feetX:599,feetY:1424,normalHeight:1350,hideAboveY:430,basinCenterX:550,basinBottomY:485,basinWidth:950};
function bounds(im){
  const c=document.createElement('canvas');c.width=im.width;c.height=im.height;
  const g=c.getContext('2d',{willReadFrequently:true});g.drawImage(im,0,0);
  const bytes=g.getImageData(0,0,c.width,c.height).data;let x0=c.width,y0=c.height,x1=-1,y1=-1;
  for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++)if(bytes[(y*c.width+x)*4+3]>140){x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);}
  if(x1<0)throw Error('铁盆图层为空');return [x0,y0,x1-x0+1,y1-y0+1];
}
export function createGuardRenderer(normal,basin){
  const box=bounds(basin),L=GUARD_LAYOUT;
  return {draw(ctx,x,feet,height=144,age=0,flip=1){
    const defending=guardCellAt(age)>=0,scale=height/L.normalHeight;
    ctx.save();ctx.translate(x,feet);ctx.scale(scale*flip,scale);ctx.imageSmoothingEnabled=false;
    ctx.save();if(defending){ctx.beginPath();ctx.rect(-L.feetX,L.hideAboveY-L.feetY,normal.width,normal.height-L.hideAboveY);ctx.clip();}
    ctx.drawImage(normal,-L.feetX,-L.feetY);ctx.restore();
    if(defending){const h=L.basinWidth*box[3]/box[2];ctx.drawImage(basin,...box,L.basinCenterX-L.feetX-L.basinWidth/2,L.basinBottomY-L.feetY-h,L.basinWidth,h);}
    ctx.restore();
  }};
}

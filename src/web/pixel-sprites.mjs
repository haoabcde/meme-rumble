// Atlas slicing and silhouette-aligned mesh interpolation for authored pixel sprites.
import {removeDetachedPixels} from './sprite-cleanup.mjs';
export function cutGrid(im,columns,rows,{pixelate=true,cleanCells=[]}={}){
 const w=Math.floor(im.width/columns),h=Math.floor(im.height/rows);
 return Array.from({length:columns*rows},(_,i)=>{
  const c=document.createElement('canvas');c.width=w;c.height=h;const g=c.getContext('2d',{willReadFrequently:true});
  g.drawImage(im,(i%columns)*w,Math.floor(i/columns)*h,w,h,0,0,w,h);
  const data=g.getImageData(0,0,w,h),p=data.data;
  if(cleanCells.includes(i)){removeDetachedPixels(p,w,h);g.putImageData(data,0,0);}
  let l=w,t=h,r=0,b=0;
  for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(p[(y*w+x)*4+3]>120){l=Math.min(l,x);r=Math.max(r,x);t=Math.min(t,y);b=Math.max(b,y);}
  const divisor=pixelate?3:1;
  const out=document.createElement('canvas');out.width=Math.max(1,Math.ceil((r-l+1)/divisor));out.height=Math.max(1,Math.ceil((b-t+1)/divisor));
  const og=out.getContext('2d',{willReadFrequently:true});og.imageSmoothingEnabled=!pixelate;og.drawImage(c,l,t,r-l+1,b-t+1,0,0,out.width,out.height);return out;
 });
}
function silhouette(im){
 const g=im.getContext('2d',{willReadFrequently:true}),p=g.getImageData(0,0,im.width,im.height).data,top=[],bottom=[];
 for(let n=0;n<=16;n++){
  const x=Math.min(im.width-1,Math.round(n/16*(im.width-1)));let a=im.height,b=0;
  for(let xx=Math.max(0,x-1);xx<=Math.min(im.width-1,x+1);xx++)for(let y=0;y<im.height;y++)if(p[(y*im.width+xx)*4+3]>85){a=Math.min(a,y);b=Math.max(b,y);}
  if(a>b){a=im.height*.4;b=im.height*.6;}top.push(a);bottom.push(Math.max(a+1,b));
 }return{top,bottom};
}
function triangle(g,im,s,d){
 const a=s[1][0]-s[0][0],b=s[1][1]-s[0][1],c=s[2][0]-s[0][0],e=s[2][1]-s[0][1],det=a*e-c*b;if(Math.abs(det)<.001)return;
 const A=((d[1][0]-d[0][0])*e-(d[2][0]-d[0][0])*b)/det,B=((d[1][1]-d[0][1])*e-(d[2][1]-d[0][1])*b)/det;
 const C=((d[2][0]-d[0][0])*a-(d[1][0]-d[0][0])*c)/det,D=((d[2][1]-d[0][1])*a-(d[1][1]-d[0][1])*c)/det;
 g.save();g.beginPath();const mx=(d[0][0]+d[1][0]+d[2][0])/3,my=(d[0][1]+d[1][1]+d[2][1])/3;
 d.forEach((p,i)=>{const x=p[0]+(p[0]-mx)*.008,y=p[1]+(p[1]-my)*.008;i?g.lineTo(x,y):g.moveTo(x,y);});g.closePath();g.clip();
 g.transform(A,B,C,D,d[0][0]-A*s[0][0]-C*s[0][1],d[0][1]-B*s[0][0]-D*s[0][1]);g.drawImage(im,0,0);g.restore();
}
export function createPoseMorph(poses,{steps=12,maxCache=120}={}){
 const shapes=poses.map(silhouette),cache=new Map();
 function frame(position){
  const key=Math.round(position*steps),pos=key/steps,index=Math.floor(pos)%poses.length,next=(index+1)%poses.length,t=pos-Math.floor(pos);
  if(cache.has(key))return cache.get(key);
  const c=document.createElement('canvas');c.width=c.height=320;const g=c.getContext('2d');g.imageSmoothingEnabled=false;
  const dst=(n,v)=>{
   const u=n/16,ya=(shapes[index].top[n]*(1-v)+shapes[index].bottom[n]*v-poses[index].height/2)/poses[index].width*200;
   const yb=(shapes[next].top[n]*(1-v)+shapes[next].bottom[n]*v-poses[next].height/2)/poses[next].width*200;
   const bend=Math.sin(pos*1.3-u*5)*Math.pow(1-u,1.7)*4;
   return[160+(u-.5)*200,160+ya*(1-t)+yb*t+bend];
  };
  for(const [k,alpha]of [[index,1-t],[next,t]]){if(alpha<.001)continue;g.globalAlpha=alpha;
   const im=poses[k],s=shapes[k],src=(n,v)=>[n/16*im.width,s.top[n]*(1-v)+s.bottom[n]*v];
   for(let n=0;n<16;n++)for(let row=0;row<3;row++){
    const a=[n,row/3],b=[n+1,row/3],d=[n,(row+1)/3],e=[n+1,(row+1)/3];
    for(const tri of [[a,b,e],[a,e,d]])triangle(g,im,tri.map(p=>src(...p)),tri.map(p=>dst(...p)));
   }
  }
  if(cache.size>=maxCache)cache.delete(cache.keys().next().value);cache.set(key,c);return c;
 }
 return{frame,draw(g,position,x,y,width,alpha=1,flip=1,angle=0){const im=frame(position);g.save();g.imageSmoothingEnabled=false;g.globalAlpha*=alpha;g.translate(x,y);g.rotate(angle);g.scale(width/200*flip,width/200);g.drawImage(im,-160,-160);g.restore();}};
}

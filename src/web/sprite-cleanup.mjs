export function removeDetachedPixels(pixels,width,height){
 const seen=new Uint8Array(width*height);let body=[];
 for(let start=0;start<seen.length;start++){
  if(seen[start]||pixels[start*4+3]<20)continue;
  const part=[start];seen[start]=1;
  for(let i=0;i<part.length;i++){
   const at=part[i],x=at%width,y=Math.floor(at/width);
   for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
    const nx=x+dx,ny=y+dy;if(nx<0||ny<0||nx>=width||ny>=height)continue;
    const next=ny*width+nx;
    if(!seen[next]&&pixels[next*4+3]>=20){seen[next]=1;part.push(next);}
   }
  }
  if(part.length>body.length)body=part;
 }
 if(!body.length)return;
 const keep=new Uint8Array(width*height);
 for(const at of body){const x=at%width,y=Math.floor(at/width);
  for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++){
   const nx=x+dx,ny=y+dy;if(nx>=0&&ny>=0&&nx<width&&ny<height)keep[ny*width+nx]=1;
  }
 }
 for(let at=0;at<keep.length;at++)if(!keep[at])pixels[at*4+3]=0;
}

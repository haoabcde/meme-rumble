const clamp=n=>Math.max(0,Math.min(1,n));
// Tail-led wave on the existing silhouette, with a quiet head and no pose reset.
export function waterSpine(phase,u){
 return (Math.sin(phase-u*6)*15+Math.sin(phase*1.4-u*10)*3)*Math.pow(1-clamp(u),2);
}
export function drawWaterFrame(g,im,phase){
 const slices=32,sw=im.width/slices;
 for(let i=0;i<slices;i++){
  const x=(i+.5)*sw,dy=waterSpine(phase,(x-60)/200);
  g.drawImage(im,i*sw,0,sw,im.height,i*sw-160,-160+dy,sw,im.height);
 }
}

const clamp=n=>Math.max(0,Math.min(1,n));
// Tail-led wave on the existing silhouette, with a quiet head and no pose reset.
export function introWaterSpine(phase,u){
 return (Math.sin(phase-u*6)*7+Math.sin(phase*1.63-u*9)*1.5)*Math.pow(1-clamp(u),1.7);
}
export function drawIntroWaterFrame(g,im,phase){
 const slices=32,sw=im.width/slices;
 for(let i=0;i<slices;i++){
  const x=(i+.5)*sw,dy=introWaterSpine(phase,(x-60)/200);
  g.drawImage(im,i*sw,0,sw+.5,im.height,i*sw-160,-160+dy,sw+.5,im.height);
 }
}

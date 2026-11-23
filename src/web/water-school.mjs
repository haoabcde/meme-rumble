import {cutGrid} from './pixel-sprites.mjs';
/** The actual reference-derived fish and filaments follow different delayed points on a path. */
export function createSchoolRenderer(source,material=im=>im){
 const im=material(cutGrid(source,1,1)[0]);
 return function school(g,pointAt,age,size=1,alpha=1,count=3){
  for(let i=count*3-1;i>=0;i--){
   const lag=65+(i*43)%310*size,point=pointAt(lag);if(!point)continue;
   const w=(80+i%3*17)*size,h=w*im.height/im.width;
   const offset=((i%2?1:-1)*(10+(i*19)%36)+Math.sin(age*.16+i)*7)*size;
   g.save();g.imageSmoothingEnabled=false;g.globalAlpha*=alpha*(.9-i/(count*3)*.4);
   g.translate(point.x-Math.sin(point.angle)*offset,point.y+Math.cos(point.angle)*offset);g.rotate(point.angle);
   // Bend the source school's own luminous ribbons, not a separately drawn straight tail.
   const slices=10;
   for(let j=0;j<slices;j++){
    const u=(j+.5)/slices,dy=Math.sin(age*.21-u*5+i)*4*(1-u);
    g.drawImage(im,j*im.width/slices,0,im.width/slices+1,im.height,(u-.5)*w-w/slices/2,-h/2+dy,w/slices+1,h);
   }
   g.restore();
  }
 };
}

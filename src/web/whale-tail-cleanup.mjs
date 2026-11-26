// Two recovery poses contain detached leftovers from their original atlas cutout.
// Keep the connected character, including a two-pixel translucent edge. Clean
// before computing silhouettes, so the in-betweens cannot stretch the leftovers.
import {removeDetachedPixels as removeDetachedTailPixels} from './sprite-cleanup.mjs';
export {removeDetachedPixels as removeDetachedTailPixels} from './sprite-cleanup.mjs';
const poses=new WeakMap();
export function whaleTailPose(sheet,index){
 if(index!==33&&index!==34)return;
 let cells=poses.get(sheet);if(!cells){cells=new Map();poses.set(sheet,cells);}
 if(cells.has(index))return cells.get(index);
 const c=document.createElement('canvas');c.width=c.height=216;
 const g=c.getContext('2d',{willReadFrequently:true});
 const size=sheet.naturalWidth/4;
 g.drawImage(sheet,index%4*size,Math.floor(index/4)*size,size,size,0,0,216,216);
 const data=g.getImageData(0,0,216,216);removeDetachedTailPixels(data.data,216,216);g.putImageData(data,0,0);
 cells.set(index,c);return c;
}

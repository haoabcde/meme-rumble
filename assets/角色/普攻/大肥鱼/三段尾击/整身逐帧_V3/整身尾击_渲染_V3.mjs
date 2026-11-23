import {FRAME_LAYOUT} from './整身画格布局_V3.mjs';
// Complete character frames. The attached tail is part of every frame.
export const FULL_BODY_KEYS={
  1:[[0,0],[1,1],[3,2],[5,3],[6,4],[9,5],[14,6],[21,7]],
  2:[[0,0],[1,1],[3,2],[5,3],[6,4],[9,5],[14,6],[21,7]],
  3:[[0,0],[1,1],[3,2],[6,3],[8,4],[12,5],[19,6],[27,7]]
};
export function fullBodyCellAt(stage,age){
  const keys=FULL_BODY_KEYS[stage];return keys?keys.filter(([at])=>at<=age).at(-1)?.[1]??0:-1;
}
function prepare(sheet,layout){
  const frames=[];
  for(let i=0;i<8;i++){
    const data=layout.frames[i],c=document.createElement('canvas');c.width=data.rect[2];c.height=data.rect[3];
    c.getContext('2d').drawImage(sheet,...data.rect,0,0,c.width,c.height);
    frames.push({image:c,feetX:data.feetX,feetY:data.feetY});
  }
  return {frames,referenceHeight:layout.referenceHeight};
}
export function createFullBodyTailActor(normal,sheets){
  const stages=Object.fromEntries(Object.entries(sheets).map(([key,sheet])=>[key,prepare(sheet,FRAME_LAYOUT[key])]));
  function normalPose(ctx,x,y,height=144,flip=1){const scale=height/1350;ctx.save();ctx.translate(x,y);ctx.scale(scale*flip,scale);ctx.imageSmoothingEnabled=false;ctx.drawImage(normal,-599,-1424);ctx.restore();}
  function frame(ctx,x,y,stage,index,height=144,flip=1){
    const set=stages[stage],pose=set.frames[index],scale=height/set.referenceHeight;
    ctx.save();ctx.translate(Math.round(x),Math.round(y));ctx.scale(scale*flip,scale);ctx.imageSmoothingEnabled=false;
    ctx.drawImage(pose.image,-pose.feetX,-pose.feetY);ctx.restore();
  }
  return {stages,frame,normal:normalPose,draw(ctx,x,y,stage,age,flip=1,height=144){
    if(!stage)return normalPose(ctx,x,y,height,flip);
    frame(ctx,x,y,stage,fullBodyCellAt(stage,age),height,flip);
  }};
}

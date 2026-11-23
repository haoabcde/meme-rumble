import {mkdirSync,writeFileSync} from 'node:fs';
import {loadEffect,renderFrames,contactSheet} from '../assets/特效库/PixelFX/tools/lib/fxlib.mjs';
const picks=[['melee/thrust','普通拳脚_冲刺气流'],['impacts/hit-spark','强化命中_星芒火花'],['holy/smite','强化技能_天降圣光'],['holy/sunburst','强化攻击_日轮放射'],['impacts/blunt-hit','拳脚命中'],['arcane/mana-burst','捧腹冲击波'],['melee/uppercut','飞踢气流'],['holy/holy-pillar','神了_圣光柱'],['holy/halo','强化光环'],['holy/feather-burst','变身羽毛'],['weather/god-rays','演出天光']];
const out=new URL('../output/奶娃制作/推荐特效/',import.meta.url);mkdirSync(out,{recursive:true});
for(const [id,name]of picks.filter(([id])=>!process.argv.includes('--new')||['melee/thrust','impacts/hit-spark','holy/smite','holy/sunburst'].includes(id))){
 const fx=await loadEffect(id),r=renderFrames(fx,{actor:false,bg:'dark',fps:24});
 const frames=r.frames.slice(0,Math.min(r.frames.length,96));
 writeFileSync(new URL(name+'.rgba',out),Buffer.concat(frames.map(f=>Buffer.from(f.color))));
 writeFileSync(new URL(name+'.json',out),JSON.stringify({w:r.w,h:r.h,n:frames.length,fps:r.fps,id}));
 writeFileSync(new URL(name+'_关键帧.png',out),contactSheet(fx,r,{max:8,zoom:2}));console.log(name+' '+frames.length+' frames');
}

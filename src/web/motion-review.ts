import {createMatch,step} from '../core/match.js';
import {NEUTRAL,type InputFrame,type MatchConfig} from '../core/types.js';
import {frog} from '../content/fighters/frog.js';
import {whale} from '../content/fighters/whale.js';
import {roster} from '../content/roster.js';
import {arenas} from '../content/arenas.js';
import {rules} from '../content/demo.js';
import {Renderer} from './renderer.js';
const params=new URLSearchParams(location.search),character=params.get('character')==='whale'?'whale':'frog';
const variant=params.get('variant')==='before'?'before':'after',name=character==='frog'?'奶蛙':'大肥鱼';
document.title=name+' · 动作衔接'+(variant==='before'?'改前':'改后');
document.body.innerHTML=`<main><h1>${document.title}</h1><p>余晖货港 · 正常速度 · 1280×720。走→停→反向走→起跳→落地→普攻接段→受击→转身。正式战斗逻辑、地图和渲染器，录像直接捕获实时游戏画布。</p><canvas width="1280" height="720" id="arena"></canvas><p><button id="record">录制本轮（正常速度）</button> <button id="replay">重播</button> <button id="pause">暂停</button> <a href="/?character=frog&variant=${variant}">奶蛙</a> <a href="/?character=whale&variant=${variant}">大肥鱼</a></p><p id="status" role="status"></p><p id="report" role="status"></p><p>视频中的停顿包括真实命中停顿。页面缩放不改变录制的1280×720游戏画布。改前/改后使用完全相同输入脚本。</p></main>`;
const style=document.createElement('style');style.textContent='body{margin:0;background:#10151c;color:#e9e4d7;font:14px/1.6 Microsoft YaHei,sans-serif}main{max-width:1280px;margin:auto;padding:16px}h1{font-size:22px;margin:0}canvas{display:block;width:100%;image-rendering:pixelated}button,a{color:#fff;background:#243344;border:1px solid #52708b;padding:8px;text-decoration:none}p{color:#b8cbd8}#report{color:#a8e3c5}';document.head.append(style);
const $=<T extends HTMLElement>(s:string)=>document.querySelector<T>(s)!;
const canvas=$<HTMLCanvasElement>('#arena'),renderer=new Renderer(canvas,arenas.find(arena => arena.id === 'harbor')!);
const config:MatchConfig={rules,training:true,arena:arenas.find(arena => arena.id === 'harbor')!,fighters:[character==='frog'?frog.fighter:whale.fighter,roster[2].fighter]};
let state=createMatch(config),started=false,paused=false,clock=0,last=0,links=0,attackSent=false,hurtSent=false,crossSent=false,hits=0,turns=0,frames=0,intervals:number[]=[],recorder:MediaRecorder|undefined,chunks:Blob[]=[],recordStart=0;
function reset(){state=createMatch(config);state.phase='fight';state.phaseTicks=0;Object.assign(state.fighters[0],{x:1850,y:config.arena.floor,ground:'floor',facing:1});Object.assign(state.fighters[1],{x:2630,y:config.arena.floor,ground:'floor',facing:-1});links=0;hits=0;turns=0;attackSent=hurtSent=crossSent=false;clock=0;last=0;frames=0;intervals=[];renderer.load(config.arena);}
const input=(x=0,pressed:InputFrame['pressed']=[]):InputFrame=>({x:x as -1|0|1,y:0,pressed});
function controls():[InputFrame,InputFrame]{
 const t=state.frame,f=state.fighters[0],enemy=state.fighters[1];let a=NEUTRAL,b=NEUTRAL;
 if(t<48)a=input(1);else if(t>=70&&t<94)a=input(-1);
 if(t===114)a=input(1,['jump']);else if(t>114&&t<142)a=input(1);
 if(t>=200&&t<250&&f.x<enemy.x-100)a=input(1);
 if(t>=260&&!attackSent&&!state.freeze){a=input(0,['A']);attackSent=true;links=1;}
 const limit=character==='frog'?5:3;
 if(attackSent&&links<limit&&f.attack&&!state.freeze){const action=config.fighters[0].actions.find(a=>a.id===f.attack!.id);if(f.attack.frame>=(action&&'chainAfter'in action?action.chainAfter??999:999)){a=input(0,['A']);links++;}}
 if(t>=410&&t<515&&Math.abs(enemy.x-f.x)>92)b=input(enemy.x>f.x?-1:1);
 if(t>=520&&!hurtSent&&!enemy.recovery&&!enemy.hitstun&&!state.freeze){b=input(0,['A']);hurtSent=true;}
 if(t>=570&&t<600)a=input(-1);
 if(t>=600&&t<620&&enemy.x>f.x+90)b=input(-1);
 if(t>=620&&t<660){b=input(-1,!crossSent?['jump']:[]);crossSent=true;}
 if(t>=680&&t<700)a=input(f.facing);
 return[a,b];
}
function draw(){renderer.draw(config,state,false,1/60,false);const g=canvas.getContext('2d')!;g.save();g.resetTransform();g.fillStyle='#0a1220dc';g.fillRect(0,0,1280,34);g.fillStyle='#f5e3b5';g.font='18px Microsoft YaHei';g.textAlign='left';g.textBaseline='alphabetic';g.fillText(`${name} · ${variant==='before'?'改前':'改后'} · 正常速度 1× · 余晖货港`,18,24);g.restore();$('#status').textContent=`${(state.frame/60).toFixed(2)}s / 12.00s · 普攻 ${links} 段 / ${hits} 次命中 · ${state.fighters[0].ground?'接地':'腾空'} · ${state.fighters[0].attack?.id??(state.fighters[0].hitstun?'受击':state.fighters[0].moving?'移动':'站立')}`;}
async function saveRecording(){
 const blob=new Blob(chunks,{type:recorder!.mimeType});
 const elapsed=(performance.now()-recordStart)/1000,sorted=[...intervals].sort((a,b)=>a-b),fps=frames/elapsed;
 const details={character,variant,frames,wallSeconds:elapsed,fps,medianMs:sorted[Math.floor(sorted.length/2)]??0,p95Ms:sorted[Math.floor(sorted.length*.95)]??0,simulationFrames:state.frame,hits,links,turns,width:1280,height:720};
 $('#report').textContent='正在保存实时录像…';
 const result=await fetch('/capture?character='+character+'&variant='+variant,{method:'POST',headers:{'Content-Type':'video/webm','X-Capture-Metrics':encodeURIComponent(JSON.stringify(details))},body:blob});
 if(!result.ok)throw new Error('录像保存失败');
 $('#report').textContent=`录像已保存 · ${fps.toFixed(1)} FPS（实际渲染） · ${elapsed.toFixed(2)}s · ${details.hits}次命中 · ${details.links}段普攻`;
 $<HTMLButtonElement>('#record').disabled=false;
}
$('#record').onclick=()=>{
 if(recorder?.state==='recording')return;reset();paused=false;started=true;chunks=[];
 const mime=['video/webm;codecs=vp9','video/webm;codecs=vp8','video/webm'].find(x=>MediaRecorder.isTypeSupported(x))!;
 recorder=new MediaRecorder(canvas.captureStream(60),{mimeType:mime,videoBitsPerSecond:6500000});
 recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)};
 recorder.onstop=()=>{void saveRecording().catch(e=>$('#report').textContent=String(e))};
 recordStart=performance.now();recorder.start(250);$<HTMLButtonElement>('#record').disabled=true;$('#report').textContent='实时录制中，请保持此页播放至结束。';
};
$('#replay').onclick=()=>{if(recorder?.state==='recording')return;reset();started=true;paused=false;};
$('#pause').onclick=()=>{if(recorder?.state==='recording')return;paused=!paused;$('#pause').textContent=paused?'播放':'暂停';};
reset();draw();
function frame(now:number){const delta=last?now-last:0;last=now;
 if(started&&!paused&&state.frame<720){clock+=Math.min(delta,100);if(recorder?.state==='recording'&&delta){frames++;intervals.push(delta);}
  while(clock>=1000/60&&state.frame<720){clock-=1000/60;const facing=state.fighters[0].facing,events=step(state,controls(),config);if(state.fighters[0].facing!==facing)turns++;renderer.add(events,state,config.fighters);hits+=events.filter(e=>e.kind==='hit'&&e.source===0).length;}
 }
 draw();if(state.frame>=720&&recorder?.state==='recording')recorder.stop();requestAnimationFrame(frame);
}requestAnimationFrame(frame);

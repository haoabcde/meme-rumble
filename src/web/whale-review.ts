import {createMatch,step} from '../core/match.js';
import {NEUTRAL,type InputFrame,type MatchConfig,type ActionKey} from '../core/types.js';
import {whale} from '../content/fighters/whale.js';
import {roster} from '../content/roster.js';
import {arenas} from '../content/arenas.js';
import {rules} from '../content/demo.js';
import {FightAudio} from './audio.js';
declare const __FIGHTER_AUDIO__:Readonly<Record<string,string>>;
import {Renderer} from './renderer.js';
import {cinematicOwner,WHALE_RULES} from '../core/whale-kit.js';
import {drawWhaleWaterStudy} from './whale-art.js';

document.title='大肥鱼 · 完整接入试玩';
document.body.innerHTML=`<main><h1>大肥鱼 · 完整接入试玩</h1><p>此页使用正式战斗逻辑、角色包和渲染器。点击场景查看实际命中；自由操作请进入训练场。</p><nav id="cases"></nav><canvas id="arena" width="1280" height="720" tabindex="0" aria-label="大肥鱼实际对战场景"></canvas><div class="bar"><button id="pause">暂停</button><button id="restart">重播场景</button><button id="step">前进一帧</button><button id="mirror">方向：右</button><label>速度 <select id="speed" aria-label="演示速度"><option value="1">正常</option><option value=".5">0.5×</option><option value=".25">0.25×</option></select></label><button id="debug">判定框：关</button><a href="/?practice=harbor&p1=whale&p2=banana">自由训练 · 大肥鱼</a><a href="/">标题与本地双人</a></div><label>场景进度 <input id="seek" aria-label="实战场景进度" type="range" min="0" max="320" value="0" style="flex:1"></label><p id="stats" role="status"></p><p id="notes"></p><p class="hint">P1：A/D移动，W向上组合，S即时戴盆防御，K跳跃，L冲刺，J普攻，U技能1，I技能2，O大招。O消耗三格，训练设置可以充气。数值为首轮接入版。</p></main>`;
const style=document.createElement('style');style.textContent=`*{box-sizing:border-box}body{margin:0;background:#091321;color:#d8eafa;font:14px/1.6 'Microsoft YaHei',sans-serif}main{max-width:1250px;padding:18px 20px;margin:auto}h1{font-size:24px;margin:0}p{color:#a9bfd2;margin:7px 0 12px}nav,.bar{display:flex;gap:7px;flex-wrap:wrap;margin:10px 0}button,a,select{font:inherit;border:1px solid #375772;border-radius:6px;padding:6px 10px;background:#172e45;color:#dfedfa;text-decoration:none;cursor:pointer}button[aria-pressed=true]{border-color:#8edfff;background:#245774}canvas{display:block;width:100%;height:auto;border:1px solid #34506b;border-radius:8px}#arena[data-water-study]{image-rendering:pixelated}label{display:flex;align-items:center;gap:6px}.hint{font-size:12px;color:#9bb4c9}#stats{color:#b4e5ff;min-height:24px}`;document.head.append(style);
const $=<T extends HTMLElement>(s:string)=>document.querySelector<T>(s)!;
const canvas=$<HTMLCanvasElement>('#arena'),renderer=new Renderer(canvas,arenas.find(arena => arena.id === 'harbor')!);
const voiceShelf=document.createElement('details');voiceShelf.innerHTML='<summary>V23 大肥鱼配音 · 欧 / 鲸 / 鲸、鲸鲸与偷吃（展开试听）</summary><p>三段普攻逐段发声；大招演出使用更响的鲸鲸，偷吃只截取连续两声较响的喃喃，合计约0.46秒。独立播放器为原素材试听，实战采用阶梯混音。</p><div style="display:flex;flex-wrap:wrap;gap:18px"></div>';
$('main').append(voiceShelf);
for(const [id,label]of [['tail-voice-1','普攻一 · 欧'],['tail-voice-2','普攻二 · 鲸'],['tail-voice-3','普攻三 · 鲸'],['ultimate-voice','大招演出 · 鲸鲸'],['eat-voice','偷吃 · 两声喃喃']]){
 const box=document.createElement('div'),p=document.createElement('p'),a=document.createElement('audio');p.textContent=label;a.controls=true;a.preload='none';a.src=__FIGHTER_AUDIO__[whale.audio![id].src];a.setAttribute('aria-label',label);box.append(p,a);voiceShelf.querySelector('div')!.append(box);
}

const scenes=[['tail','三段普攻','三段均45伤害，第三段上挑；每段向前小移。'],['guard','两段格挡后破防','前两次实际格挡零伤害、轻推；第二次破防，后续命中才有正常效果。'],['counter','旋风防反','持续按住防御受击后原地成风，每隔45°向八个方向发射饭团；风柱20帧，鲸影48帧。'],['rice','米饭直投','直接命中30伤害、粘住1.2秒；地面米饭只束缚。'],['rice-up','↑＋技能1','以约60°直线快速对空投掷，普通/上投、地面/空中每次独立20%概率偷吃。'],['step-rice','踩中米饭','饭团落地后敌人走入，只束缚不扣血。'],['greed','随机偷吃','每次独立20%概率偷吃，没有连续投掷计数或冷却。'],['spin','技能2高速推进','大肥鱼原地成风；风柱独立快速远行，命中后继续推进；鲸影与上＋技能二共用48帧姿态、旋转与升高节奏，长距离推进时循环。'],['spin-up','↑＋技能2定点','简单抬手，在敌人横坐标与自身高度生成；风柱与防反同形同寿命。'],['ult','水潭十二段','梁文峰演出时整个战场静止；演出结束即在敌人脚下生成固定水潭，完整预警0.6秒。水潭分前后沿，大小鲸鱼从前后不同的破水口游出，水膜和卷浪遮住水下部分，带鱼群以不超过30°的角度冲出画面；最后巨鲸从潭心垂直冲出，根部水花和水面冲击环限定在潭内，第12段额外击飞。梁文峰演出保留；共12段，每段35伤害。'],['ult-dodge','水潭预警走避','预警期可离开水潭；水潭不追踪，未处于范围内就不会受到伤害。'],['rice-ult','米饭接水潭','先用米饭束缚1.2秒，再接大招。演出不消耗束缚时间，预警0.6秒后开始十二段攻击。'],['air-rice','空中投饭','跳跃中也能普通投掷或上投；独立20%概率偷吃。'],['jump','基础移动与二段跳','跑动、起跳、二段跳、落地和冲刺；使用同一套公共动作图集。'],['spin-chain','技能2连续释放','普通→强化→普通；收招后可以立刻再出，没有额外冷却。']] as const;
let scene:string='tail',mirror=false,paused=false,debug=false,speed=1,clock=0,loopTick=0,hitCount=0,damage=0,seen=new Set<string>();
const requestedScene=new URLSearchParams(location.search).get('scene');
const waterStudy=true; // Final material is shared; legacy waterpreview links remain compatible.
if(waterStudy){document.title='大肥鱼 · 配音与短促偷吃 V23';$('h1').textContent='大肥鱼 · 配音与短促偷吃 V23';$('h1').nextElementSibling!.textContent='正式游戏与此页已统一：流动泡沫、双向卷浪、白沫飞溅与纵深破水水膜，所有入口使用相同水潭材质。';}
let closeUp=false;
if(waterStudy){
 const button=document.createElement('button');button.id='water-closeup';button.textContent='水体近景';button.onclick=()=>{closeUp=!closeUp;button.textContent=closeUp?'返回实战':'水体近景';draw()};$('.bar').append(button);
}
if(scenes.some(s=>s[0]===requestedScene))scene=requestedScene!;
// Optional review-only telemetry; the game UI and default preview stay unchanged.
const flowCheck=new URLSearchParams(location.search).has('flowcheck');
const flowIntervals:number[]=[],flowDraws:number[]=[];
if(flowCheck){const p=document.createElement('p');p.id='flow-metrics';p.textContent='流动性验收：采样中';$('#stats').after(p);
 const button=document.createElement('button');button.id='flow-bench';button.textContent='验收完整大招绘制耗时';p.after(button);
 button.onclick=async()=>{
  button.disabled=true;paused=true;$('#pause').textContent='播放';scene='ult';const results:string[]=[];
  for(let pass=0;pass<2;pass++){
   reset();const times:number[]=[];
   while(state.frame<300){advance();const start=performance.now();draw();times.push(performance.now()-start);if(state.frame%12===0)await new Promise(resolve=>setTimeout(resolve,0));}
   times.sort((a,b)=>a-b);results.push(`${pass?'复播':'首遍'}P95 ${times[Math.floor(times.length*.95)].toFixed(1)}ms`);
  }
  $('#flow-metrics').textContent='完整大招绘制验收 · 每遍300帧 · '+results.join(' · ');button.disabled=false;
 };
}
let history:any[]=[];
let config:MatchConfig,state:ReturnType<typeof createMatch>;
const audio=new FightAudio();
function reset(){audio.configure(mirror?[undefined,whale.audio]:[whale.audio,undefined],__FIGHTER_AUDIO__);
 config={rules,arena:arenas.find(arena => arena.id === 'harbor')!,fighters:mirror?[roster[2].fighter,whale.fighter]:[whale.fighter,roster[2].fighter],training:false};
 state=createMatch(config);state.phase='fight';state.phaseTicks=0;
 const caster=state.fighters[mirror?1:0],target=state.fighters[mirror?0:1],d=mirror?-1:1;
 const distance=scene==='ult'||scene==='ult-dodge'?650:(scene==='spin'||scene==='spin-chain')?600:scene==='spin-up'?380:scene==='rice-up'?150:scene==='step-rice'?600:scene==='greed'?900:scene==='rice'||scene==='rice-ult'||scene==='air-rice'?150:scene==='jump'?650:105;
 caster.x=mirror?2500:1900;target.x=caster.x+d*distance;caster.facing=d;target.facing=d===1?-1:1;caster.energy=300;
 clock=0;loopTick=0;hitCount=0;damage=0;seen.clear();history=[];renderer.load(config.arena);saveSnapshot();
 $('#notes').textContent=scenes.find(s=>s[0]===scene)![2];
 document.querySelectorAll<HTMLButtonElement>('[data-scene]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.scene===scene)));
 draw();
}
for(const[id,name]of scenes){const b=document.createElement('button');b.textContent=name;b.dataset.scene=id;b.onclick=()=>{audio.enableFromGesture();audio.setPaused(false);scene=id;paused=false;$('#pause').textContent='暂停';reset()};$('#cases').append(b);}
const press=(key:ActionKey,y=0,x=0):InputFrame=>({x:x as -1|0|1,y:y as -1|0|1,pressed:[key]});
function trigger(n:number,key:ActionKey,y=0){const id=n+'/'+key;if(loopTick>=n&&!seen.has(id)){seen.add(id);return press(key,y)}return null;}
function inputs():[InputFrame,InputFrame]{
 let caster:InputFrame=NEUTRAL,target:InputFrame=NEUTRAL;
 if(state.freeze===0&&cinematicOwner(state)===undefined){
  if(scene==='tail'||scene==='guard')caster=trigger(4,'A')??trigger(18,'A')??trigger(32,'A')??NEUTRAL;
  if(scene==='guard')target={...NEUTRAL,y:1};
  if(scene==='rice'||scene==='rice-up'||scene==='step-rice')caster=trigger(8,'B',scene==='rice-up'?-1:0)??NEUTRAL;
  if(scene==='rice-up')target=trigger(4,'jump')??trigger(18,'jump')??NEUTRAL;
  if(scene==='spin-chain')caster=trigger(8,'C')??trigger(44,'C',-1)??trigger(80,'C')??NEUTRAL;
  if(scene==='step-rice'&&loopTick>=55)target={...NEUTRAL,x:mirror?1:-1};
  if(scene==='greed')for(const n of [4,24,44,64,84,104,124,160]){const p=trigger(n,'B');if(p){caster=p;break;}}
  if(scene==='spin'||scene==='spin-up')caster=trigger(8,'C',scene==='spin-up'?-1:0)??NEUTRAL;
  if(scene==='ult'||scene==='ult-dodge')caster=trigger(4,'ULT')??NEUTRAL;
  if(scene==='ult-dodge'&&state.entities?.some(e=>e.definition.behavior==='pool'))target={...NEUTRAL,x:mirror?-1:1};
  if(scene==='rice-ult'){caster=trigger(4,'B')??NEUTRAL;const f=state.fighters[mirror?1:0],t=state.fighters[mirror?0:1];if((t.bindUntil??0)>state.arenaFrame&&f.energy===300)caster=trigger(0,'ULT')??caster;}
  if(scene==='air-rice')caster=trigger(4,'jump')??trigger(12,'B')??trigger(30,'B',-1)??NEUTRAL;
  if(scene==='counter'){target=trigger(14,'A')??NEUTRAL;if(loopTick<60)caster={...NEUTRAL,y:1};}
  if(scene==='jump'){caster={...NEUTRAL,x:loopTick<22?(mirror?-1:1):0};caster=trigger(24,'jump')??trigger(43,'jump')??trigger(105,'dash')??caster;}
  loopTick++;
 }
 return mirror?[target,caster]:[caster,target];
}
function saveSnapshot(){history[state.frame]=structuredClone({state,loopTick,hitCount,damage,seen:[...seen]});}
function advance(){const events=step(state,inputs(),config);renderer.add(events,state,config.fighters);audio.update(config,state,events);for(const e of events)if(e.kind==='hit'&&e.source===(mirror?1:0)){hitCount++;damage+=e.amount??0;}saveSnapshot();}
function draw(){renderer.draw(config,state,debug,paused?0:1,false,true,false,0,paused?0:clock/(1000/60));const caster=state.fighters[mirror?1:0],target=state.fighters[mirror?0:1];
 const ctx=canvas.getContext('2d')!;ctx.resetTransform();ctx.fillStyle='#071427df';ctx.fillRect(0,0,1280,63);ctx.font='bold 20px Microsoft YaHei';ctx.fillStyle='#c8edff';ctx.textAlign='left';ctx.fillText('大肥鱼  HP '+caster.hp+' / 气 '+(caster.energy??0),24,38);ctx.textAlign='right';ctx.fillStyle='#ffd5c9';ctx.fillText('陪练  HP '+target.hp,1256,38);ctx.textAlign='center';ctx.fillStyle='#e6f5ff';ctx.fillText(hitCount+' 段 · 累计 '+damage,640,38);
 $<HTMLInputElement>('#seek').value=String(state.frame);
 $('#stats').textContent=`${paused?'已暂停':'播放中'} · ${(state.arenaFrame/60).toFixed(2)}s · ${hitCount}次实际命中 / ${damage}伤害 · 场上实体${state.entities?.length??0} · ${cinematicOwner(state)!==undefined?'梁文峰演出 · 战斗时间静止':state.entities?.some(e=>e.definition.behavior==='pool'&&e.age<WHALE_RULES.telegraph)?'水潭预警 · '+((WHALE_RULES.telegraph-state.entities.find(e=>e.definition.behavior==='pool')!.age)/60).toFixed(2)+'s':caster.attack?.id??'待机'}${(target.bindUntil??0)>state.arenaFrame?' · 敌人被米饭粘住':''}`;
 canvas.toggleAttribute('data-water-study',closeUp&&drawWhaleWaterStudy(ctx,state.entities?.find(e=>e.definition.behavior==='pool')?.age));
}
$<HTMLInputElement>('#seek').oninput=e=>{const target=Number((e.target as HTMLInputElement).value);audio.stopAll();audio.setPaused(true);renderer.resetPresentation();paused=true;$('#pause').textContent='播放';if(!history[target]){const last=history[history.length-1];state=structuredClone(last.state);loopTick=last.loopTick;hitCount=last.hitCount;damage=last.damage;seen=new Set(last.seen);while(state.frame<target)advance();}const point=history[target];state=structuredClone(point.state);loopTick=point.loopTick;hitCount=point.hitCount;damage=point.damage;seen=new Set(point.seen);draw();};
$('#pause').onclick=()=>{audio.enableFromGesture();paused=!paused;audio.setPaused(paused);$('#pause').textContent=paused?'播放':'暂停';draw()};$('#restart').onclick=()=>{audio.enableFromGesture();reset();};$('#step').onclick=()=>{audio.setPaused(true);paused=true;$('#pause').textContent='播放';advance();draw()};
$('#mirror').onclick=()=>{mirror=!mirror;$('#mirror').textContent='方向：'+(mirror?'左':'右');reset()};$<HTMLSelectElement>('#speed').onchange=e=>speed=Number((e.target as HTMLSelectElement).value);$('#debug').onclick=()=>{debug=!debug;$('#debug').textContent='判定框：'+(debug?'开':'关');draw()};
reset();let last=0;function frame(now:number){const rawDt=last?now-last:0,dt=Math.min(80,rawDt);last=now;if(!paused){clock+=dt*speed;while(clock>=1000/60){clock-=1000/60;advance();}if(state.frame> (scene==='greed'?360:scene==='ult'||scene==='ult-dodge'||scene==='rice-ult'?320:scene==='spin'?330:220))reset();}const start=flowCheck?performance.now():0;draw();
 if(flowCheck&&!paused&&rawDt>0){flowIntervals.push(rawDt);flowDraws.push(performance.now()-start);if(flowIntervals.length>240){flowIntervals.shift();flowDraws.shift();}const sorted=[...flowDraws].sort((a,b)=>a-b);$('#flow-metrics').textContent=`流动性验收 · ${flowIntervals.length}帧 · 实际绘制 ${(1000*flowIntervals.length/flowIntervals.reduce((a,b)=>a+b,0)).toFixed(1)}帧/秒 · 绘制耗时P95 ${sorted[Math.floor((sorted.length-1)*.95)].toFixed(1)}ms`;}
 requestAnimationFrame(frame)}requestAnimationFrame(frame);

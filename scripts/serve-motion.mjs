import {createServer} from 'node:http';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
const root=new URL('../',import.meta.url),out=new URL('output/动作衔接_V25/',root);await mkdir(out,{recursive:true});
const server=createServer(async(req,res)=>{try{
 const u=new URL(req.url,'http://127.0.0.1');
 if(req.method==='GET'&&u.pathname.startsWith('/videos/')){
  const name=decodeURIComponent(u.pathname.slice(8));
  if(!['奶蛙','大肥鱼'].some(c=>['改前','改后','改前改后_正常速度'].some(v=>name===c+'_'+v+'.mp4'))){res.writeHead(404).end();return;}
  const video=await readFile(new URL(name,out));res.writeHead(200,{'Content-Type':'video/mp4','Content-Length':video.length}).end(video);return;
 }
 if(req.method==='GET'&&u.pathname==='/compare'){
  const character=u.searchParams.get('character')==='whale'?'whale':'frog',name=character==='frog'?'奶蛙':'大肥鱼';
  const before=JSON.parse(await readFile(new URL(name+'_改前_录制数据.json',out))),after=JSON.parse(await readFile(new URL(name+'_改后_录制数据.json',out)));
  const html=`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${name}动作衔接 · 实机改前改后</title><style>body{margin:0;background:#10151c;color:#e9e4d7;font:16px/1.6 Microsoft YaHei,sans-serif}main{max-width:1500px;margin:auto;padding:20px}video{width:100%;display:block;background:black}a{color:#b8dfff}h1{font-size:24px}p{color:#c0ced8}</style><main><h1>${name} · 动作衔接改前/改后</h1><p>左侧改前，右侧改后 · 余晖货港 · 正常速度1× · 相同输入脚本。包含走→停→跳→落地、普攻连段、受击和换边转身。</p><video controls preload="metadata" aria-label="${name}改前改后正常速度实机视频" src="/videos/${name}_改前改后_正常速度.mp4"></video><p>实际录制：改前 ${before.fps.toFixed(1)} FPS；改后 ${after.fps.toFixed(1)} FPS。普攻 ${after.links} 段、${after.hits} 次命中。视频无声，游戏原有声音保留。</p><p><a href="/videos/${name}_改前.mp4">原尺寸改前</a> · <a href="/videos/${name}_改后.mp4">原尺寸改后</a> · <a href="/?character=${character}&variant=after">重播动作验收</a> · <a href="/compare?character=${character==='frog'?'whale':'frog'}">查看${character==='frog'?'大肥鱼':'奶蛙'}</a> · <a href="http://127.0.0.1:4190/?practice=harbor&p1=${character}&p2=banana">自由训练</a></p></main></html>`;
  res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'}).end(html);return;
 }
 if(req.method==='POST'&&u.pathname==='/capture'){
  const character=u.searchParams.get('character'),variant=u.searchParams.get('variant');
  if(!['frog','whale'].includes(character)||!['before','after'].includes(variant)){res.writeHead(400).end();return;}
  const chunks=[];let bytes=0;for await(const chunk of req){bytes+=chunk.length;if(bytes>120000000)throw new Error('录像过大');chunks.push(chunk);}
  const file=(character==='frog'?'奶蛙':'大肥鱼')+'_'+(variant==='before'?'改前':'改后');
  await writeFile(new URL(file+'.webm',out),Buffer.concat(chunks));
  await writeFile(new URL(file+'_录制数据.json',out),decodeURIComponent(req.headers['x-capture-metrics']??'{}'));
  console.log('录像已保存',file,bytes);res.writeHead(200).end('saved');return;
 }
 const file=u.searchParams.get('variant')==='before'?new URL('改前_动作验收.html',out):new URL('dist/motion-review.html',root);
 const html=await readFile(file);res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'}).end(html);
 }catch(e){console.error(e.message);res.writeHead(503).end('预览尚未就绪');}});
server.listen(4192,'127.0.0.1',()=>console.log('动作验收 http://127.0.0.1:4192/'));

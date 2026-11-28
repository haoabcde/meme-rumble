import {readFile,writeFile,mkdir,stat} from 'node:fs/promises';
import {createServer} from 'node:http';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import {build} from 'esbuild';
import {roster} from '../../dist/content/roster.js';
import {embedFighterImages} from '../fighter-art.mjs';
import {embedFighterAudio} from '../fighter-audio.mjs';
import {skills} from './catalog.mjs';
const root=new URL('../../',import.meta.url),out=new URL('deliverables/大肥鱼与奶蛙角色交付_20261126/',root),raw=new URL('output/技能说明录制_20261126/',root);await mkdir(raw,{recursive:true});await mkdir(out,{recursive:true});
const [images,audio]=await Promise.all([embedFighterImages(roster,fileURLToPath(new URL('assets/fighters/',root))),embedFighterAudio(roster,fileURLToPath(root))]);
const bundle=await build({entryPoints:[fileURLToPath(new URL('recording.mjs',import.meta.url))],bundle:true,format:'iife',platform:'browser',target:'es2022',loader:{'.png':'dataurl','.webp':'dataurl'},define:{__FIGHTER_IMAGES__:JSON.stringify(images),__FIGHTER_AUDIO__:JSON.stringify(audio)},write:false});
const html='<!doctype html><meta charset="utf-8"><body><p>技能素材加载中…</p><script src="/record.js"></script></body>';
const hd=new URL('output/技能说明高清_20261126/',root);await mkdir(hd,{recursive:true});
const ff=process.env.GUIDE_FFMPEG??'E:/剪映/JianyingPro/11.6.0.14552/ffmpeg.exe';let encoding;
const finish=p=>new Promise((resolve,reject)=>p.on('close',code=>code===0?resolve():reject(Error('FFmpeg failed '+code))));
createServer(async(req,res)=>{try{const u=new URL(req.url,'http://127.0.0.1');
 if(req.method==='POST'&&u.pathname.startsWith('/hd/')){
  const id=u.searchParams.get('id');if(!skills.some(s=>s.id===id)){res.writeHead(400).end();return;}
  if(u.pathname==='/hd/start'){
   if(encoding)throw Error('已有导出任务');
   const p=spawn(ff,['-hide_banner','-loglevel','error','-y','-f','image2pipe','-framerate','60','-i','pipe:0','-an','-c:v','h264_nvenc','-preset','p7','-rc','constqp','-qp','16','-g','120','-bf','2','-pix_fmt','yuv420p','-movflags','+faststart',fileURLToPath(new URL(id+'.video.mp4',hd))],{stdio:['pipe','ignore','pipe']});
   p.stderr.on('data',d=>console.error(String(d)));encoding={id,p,n:0,done:finish(p)};res.writeHead(200).end('started');return;
  }
  if(!encoding||encoding.id!==id)throw Error('导出任务不匹配');
  if(u.pathname==='/hd/frame'){
   if(Number(u.searchParams.get('n'))!==encoding.n)throw Error('画帧顺序错误');
   const chunks=[];for await(const chunk of req)chunks.push(chunk);
   const count=Number(u.searchParams.get('count')??1);if(!Number.isInteger(count)||count<1||count>4)throw Error('无效画帧批次');
   await new Promise((resolve,reject)=>encoding.p.stdin.write(Buffer.concat(chunks),e=>e?reject(e):resolve()));encoding.n+=count;res.writeHead(200).end('frame');return;
  }
  if(u.pathname==='/hd/end'){
   const chunks=[];for await(const chunk of req)chunks.push(chunk);const meta=JSON.parse(Buffer.concat(chunks).toString());if(meta.frames!==encoding.n)throw Error('导出帧数不符');
   encoding.p.stdin.end();await encoding.done;encoding=undefined;
   const p=spawn(ff,['-hide_banner','-loglevel','error','-y','-i',fileURLToPath(new URL(id+'.video.mp4',hd)),'-i',fileURLToPath(new URL(id+'.webm',raw)),'-map','0:v:0','-map','1:a:0','-c:v','copy','-c:a','aac','-b:a','192k','-t',String(meta.seconds),'-movflags','+faststart',fileURLToPath(new URL(id+'.mp4',hd))],{stdio:['ignore','ignore','pipe']});p.stderr.on('data',d=>console.error(String(d)));await finish(p);
   await writeFile(new URL(id+'.json',hd),JSON.stringify(meta));console.log('HD',id,meta.frames);res.writeHead(200).end('exported');return;
  }
 }
 if(req.method==='POST'&&u.pathname==='/capture'){
  const id=u.searchParams.get('id');if(!skills.some(s=>s.id===id)){res.writeHead(400).end();return;}
  const chunks=[];let bytes=0;for await(const chunk of req){bytes+=chunk.length;if(bytes>40000000)throw Error('clip too large');chunks.push(chunk);}
  await writeFile(new URL(id+'.webm',raw),Buffer.concat(chunks));await writeFile(new URL(id+'.json',raw),decodeURIComponent(req.headers['x-capture-metrics']??'{}'));console.log('saved',id,bytes);res.writeHead(200).end('saved');return;
 }
 if(u.pathname==='/record'){res.writeHead(200,{'Content-Type':'text/html;charset=utf-8','Cache-Control':'no-store'}).end(html);return;}
 if(u.pathname==='/record.js'){res.writeHead(200,{'Content-Type':'application/javascript;charset=utf-8'}).end(bundle.outputFiles[0].text);return;}
 const path=decodeURIComponent(u.pathname==='/'?'index.html':u.pathname.slice(1));if(path.split('/').some(s=>s==='..')||path.includes('\\')){res.writeHead(400).end();return;}
 const file=new URL(path,out),size=(await stat(file)).size,type=path.endsWith('.mp4')?'video/mp4':path.endsWith('.jpg')?'image/jpeg':path.endsWith('.json')?'application/json':'text/html;charset=utf-8';
 res.writeHead(200,{'Content-Type':type,'Content-Length':size,'Cache-Control':'no-store'}).end(await readFile(file));
 }catch(e){console.error(e.message);res.writeHead(404).end('未找到');}}).listen(4195,'127.0.0.1',()=>console.log('录制 http://127.0.0.1:4195/record  素材预览 http://127.0.0.1:4195/'));

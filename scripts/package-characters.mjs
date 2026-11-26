import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {deflateRawSync} from 'node:zlib';

const root=new URL('../',import.meta.url);
const out=new URL('output/角色试玩版/',root);
await mkdir(out,{recursive:true});
const html=await readFile(new URL('dist/index.html',root));
if(/<script\b[^>]*\bsrc\s*=/i.test(html.toString())||/<link\b[^>]*rel=["']stylesheet/i.test(html.toString()))throw Error('成品仍引用外部脚本或样式，请先构建');
const commit=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
const dirty=Boolean(execFileSync('git',['status','--porcelain'],{cwd:root,encoding:'utf8'}).trim());
const sha=data=>createHash('sha256').update(data).digest('hex');
const instructions=Buffer.from(`Meme 乱斗：四角色高清手绘版 · 单层直播擂台\r\n\r\n解压后，用桌面版 Chrome 或 Edge 双击打开“开始游戏.html”。无需安装 Node.js，无需联网加载游戏素材。\r\n先点击页面或按一次键，浏览器才会允许播放声音。\r\n支持同一台电脑的本地双人、人机对战和自由训练；当前没有跨电脑联机。\r\n\r\nP1：A/D移动，S防御，J普攻，W＋J挑空，K跳跃，L闪避。U是主动进攻键，有远程攻击时统一放U或方向＋U；I是角色特色机制。\r\n普通J/U/I不消耗杀气。W＋O消耗一格释放战术大招，O消耗三格释放代表大招。训练设置可以充满杀气，暂停菜单的“招式表”包含双方实际按键与条件。\r\n\r\n版本提交：${commit}${dirty?'（含未提交的工作区改动）':''}\r\nHTML SHA256：${sha(html)}\r\n\r\n仓库根目录的index.html是源码入口，不能当成成品直接打开。\r\n`,'utf8');
// Small dependency-free ZIP writer: UTF-8 names, raw deflate and CRC checksums.
const crcTable=Array.from({length:256},(_,n)=>{for(let i=0;i<8;i++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
function crc32(data){let n=0xffffffff;for(const b of data)n=crcTable[(n^b)&255]^(n>>>8);return(n^0xffffffff)>>>0;}
function zip(entries){
 const files=[],directory=[];let offset=0;
 const now=new Date(),dosDate=((now.getFullYear()-1980)<<9)|((now.getMonth()+1)<<5)|now.getDate();
 for(const [name,data]of entries){
  const filename=Buffer.from(name),compressed=deflateRawSync(data,{level:9}),crc=crc32(data);
  const local=Buffer.alloc(30);local.writeUInt32LE(0x04034b50);local.writeUInt16LE(20,4);local.writeUInt16LE(0x800,6);local.writeUInt16LE(8,8);
  local.writeUInt16LE(dosDate,12);local.writeUInt32LE(crc,14);local.writeUInt32LE(compressed.length,18);local.writeUInt32LE(data.length,22);local.writeUInt16LE(filename.length,26);
  const central=Buffer.alloc(46);central.writeUInt32LE(0x02014b50);central.writeUInt16LE(20,4);central.writeUInt16LE(20,6);central.writeUInt16LE(0x800,8);central.writeUInt16LE(8,10);
  central.writeUInt16LE(dosDate,14);central.writeUInt32LE(crc,16);central.writeUInt32LE(compressed.length,20);central.writeUInt32LE(data.length,24);central.writeUInt16LE(filename.length,28);central.writeUInt32LE(offset,42);
  files.push(local,filename,compressed);directory.push(central,filename);offset+=local.length+filename.length+compressed.length;
 }
 const body=Buffer.concat(files),central=Buffer.concat(directory),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(entries.length,8);end.writeUInt16LE(entries.length,10);end.writeUInt32LE(central.length,12);end.writeUInt32LE(body.length,16);
 return Buffer.concat([body,central,end]);
}
const archive=zip([['开始游戏.html',html],['游玩说明.txt',instructions]]);
await Promise.all([
 writeFile(new URL('meme-rumble-characters.html',out),html),
 writeFile(new URL('meme-rumble-characters.zip',out),archive),
 writeFile(new URL('游玩说明.txt',out),instructions),
 writeFile(new URL('version.json',out),JSON.stringify({commit,dirty,html:{bytes:html.length,sha256:sha(html)},zip:{bytes:archive.length,sha256:sha(archive)}},null,2)+'\n')
]);
console.log('角色试玩版已生成：'+out.pathname+'，HTML '+(html.length/1024**2).toFixed(1)+' MiB，ZIP '+(archive.length/1024**2).toFixed(1)+' MiB');

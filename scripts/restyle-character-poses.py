"""Prepare pose references and register image-generated drawings to approved cells.
This script only crops, lays out, registers and encodes the image editor's output.
"""
from pathlib import Path
from PIL import Image
import json,sys,hashlib,shutil
ROOT=Path(__file__).resolve().parents[1]
BASE=ROOT/'assets/角色/动作/手绘轻像素_V2'
INPUT=BASE/'参考分组'; RAW=BASE/'生成母版'; FINAL=BASE/'游戏图集'
def box(im): return im.getchannel('A').point(lambda a:255 if a>40 else 0).getbbox()
def spec(id,src,cols,rows,actor='frog'): return dict(id=id,src=src,cols=cols,rows=rows,actor=actor)
SPECS=[
 spec('大肥鱼_完整动作','assets/fighters/大肥鱼/完整动作.png',4,20,'whale'),
 spec('大肥鱼_步态起落','assets/角色/基础动作/大肥鱼/V25/步态与起落_十六帧.png',4,4,'whale'),
 spec('奶蛙_拳脚捧腹','assets/角色/技能/奶娃/拳脚与捧腹_八姿态.png',4,2),
 spec('奶蛙_跳跃受击','assets/角色/基础动作/奶蛙/V19/跳跃受击倒地起身_十六帧.png',4,4),
 spec('奶蛙_出场胜负','assets/角色/出场与胜负/奶蛙/V19/侧躺出场与胜负_八帧.png',4,2),
 spec('奶蛙_步态起落','assets/角色/基础动作/奶蛙/V25/步态与起落_十六帧.png',4,4),
 spec('奶蛙_移动悬浮','assets/角色/常态/奶蛙/移动与悬浮_八帧_V1.png',4,2),
 spec('奶蛙_天使形态','assets/角色/大招/奶娃/神了/天使_四姿态.png',2,2),
 spec('奶蛙_普通防御','assets/角色/防御/奶蛙/护腹站姿_V6/护腹_看向玩家.png',1,1),
 spec('奶蛙_下蹲','assets/角色/技能/奶蛙/二技能/调皮下蹲_像素姿态_V1.png',1,1),
 spec('奶蛙_思考','assets/角色/常态/奶蛙/托腮思考_像素姿态_V1.png',1,1),
]
def prepare():
 for p in [INPUT,RAW,FINAL]:p.mkdir(parents=True,exist_ok=True)
 records=[]; batches=[]; singles=[]
 for sp in SPECS:
  im=Image.open(ROOT/sp['src']).convert('RGBA');w=im.width//sp['cols'];h=im.height//sp['rows']
  frames=[]
  for i in range(sp['cols']*sp['rows']):
   cell=im.crop((i%sp['cols']*w,i//sp['cols']*h,i%sp['cols']*w+w,i//sp['cols']*h+h))
   frames.append(dict(index=i,rect=[i%sp['cols']*w,i//sp['cols']*h,w,h],bbox=box(cell)))
  records.append(dict(**sp,size=list(im.size),frames=frames))
  if len(frames)==1:singles.append((sp,frames[0]));continue
  for start in range(0,len(frames),16):
   group=frames[start:start+16];cols=4 if len(group)>=8 else 2;rows=(len(group)+cols-1)//cols;tile=384
   canvas=Image.new('RGBA',(cols*tile,rows*tile));slots=[]
   for n,f in enumerate(group):
    slots.append(dict(source=sp['id'],index=f['index']))
    if not f['bbox']:continue
    r=f['rect'];c=im.crop((r[0],r[1],r[0]+r[2],r[1]+r[3])).crop(f['bbox'])
    scale=tile*.84/max(c.size);c=c.resize((max(1,round(c.width*scale)),max(1,round(c.height*scale))),Image.Resampling.NEAREST)
    canvas.alpha_composite(c,(n%cols*tile+(tile-c.width)//2,n//cols*tile+(tile-c.height)//2))
   name=sp['id']+('_'+str(start).zfill(2)+'-'+str(start+len(group)-1).zfill(2) if len(frames)>16 else '')+'.png'
   canvas.save(INPUT/name);batches.append(dict(name=name,actor=sp['actor'],columns=cols,rows=rows,slots=slots))
 canvas=Image.new('RGBA',(3*512,512));slots=[]
 for n,(sp,f) in enumerate(singles):
  im=Image.open(ROOT/sp['src']).convert('RGBA').crop(f['bbox']);scale=430/max(im.size)
  im=im.resize((round(im.width*scale),round(im.height*scale)),Image.Resampling.NEAREST)
  canvas.alpha_composite(im,(n*512+(512-im.width)//2,(512-im.height)//2));slots.append(dict(source=sp['id'],index=0))
 name='奶蛙_防御下蹲思考.png';canvas.save(INPUT/name);batches.append(dict(name=name,actor='frog',columns=3,rows=1,slots=slots))
 (BASE/'姿态映射.json').write_text(json.dumps(dict(sources=records,batches=batches),ensure_ascii=False,indent=2),'utf-8')
 print(json.dumps(dict(batches=len(batches),poses=sum(len(x['frames']) for x in records),names=[b['name'] for b in batches]),ensure_ascii=False))
def assemble():
 data=json.loads((BASE/'姿态映射.json').read_text('utf-8'));specs={s['id']:s for s in data['sources']};out={};coverage=[]
 for k,s in specs.items():
  density=2 if s['actor']=='whale' and '完整动作' in k else 1
  out[k]=Image.new('RGBA',(s['size'][0]*density,s['size'][1]*density))
 for b in data['batches']:
  path=RAW/b['name'];im=Image.open(path).convert('RGBA');assert im.getextrema()[3][0]==0,str(path)+' must retain alpha'
  cw=im.width//b['columns'];ch=im.height//b['rows']
  for n,slot in enumerate(b['slots']):
   sp=specs[slot['source']];frame=sp['frames'][slot['index']];target=out[sp['id']];density=target.width/sp['size'][0]
   if not frame['bbox']:continue
   cell=im.crop((n%b['columns']*cw,n//b['columns']*ch,(n%b['columns']+1)*cw,(n//b['columns']+1)*ch));bb=box(cell);assert bb, (b['name'],n,'empty pose')
   # Preserve the approved source footprint and canvas registration. This is a
   # packaging transform, not a new pose or a change to attack timing.
   cell=cell.crop(bb);x,y,w,h=frame['rect'];l,t,r,bot=frame['bbox'];size=(max(1,round((r-l)*density)),max(1,round((bot-t)*density)))
   cell=cell.resize(size,Image.Resampling.LANCZOS);target.alpha_composite(cell,(round((x+l)*density),round((y+t)*density)))
   coverage.append(dict(source=sp['id'],index=frame['index'],original=sp['src'],generated=b['name'],sourceBBox=frame['bbox']))
 for k,im in out.items():
  im.save(FINAL/(k+'.png'));im.save(FINAL/(k+'.webp'),'WEBP',lossless=True,method=6,exact=True)
 # The generic 4x3 fallback bank uses the same newly drawn poses. Specialized
 # renderers below use all eleven full banks, rather than this compact fallback.
 fallback=Image.new('RGBA',(864,648));frog=out['奶蛙_拳脚捧腹'];fw=frog.width//4;fh=frog.height//2
 for n in range(12):
  source=n%8;cell=frog.crop((source%4*fw,source//4*fh,(source%4+1)*fw,(source//4+1)*fh))
  cell.thumbnail((216,216),Image.Resampling.LANCZOS)
  fallback.alpha_composite(cell,(n%4*216+(216-cell.width)//2,n//4*216+216-cell.height))
 fighters=ROOT/'assets/fighters'
 out['大肥鱼_完整动作'].save(fighters/'大肥鱼/完整动作_手绘轻像素_V2.webp','WEBP',lossless=True,method=6,exact=True)
 fallback.save(fighters/'奶蛙/完整动作_手绘轻像素_V2.webp','WEBP',lossless=True,method=6,exact=True)
 for name in ['奶蛙_大招演出','梁文峰_大招演出']:
  im=Image.open(RAW/(name+'.png'));im.save(FINAL/(name+'.webp'),'WEBP',lossless=True,method=6,exact=True)
 (BASE/'覆盖核验.json').write_text(json.dumps(dict(poses=len(coverage),sources=len(out),coverage=coverage),ensure_ascii=False,indent=2),'utf-8')
 print('Registered',len(coverage),'poses in',len(out),'atlases')
if __name__=='__main__':
 {'prepare':prepare,'assemble':assemble}[sys.argv[1]]()

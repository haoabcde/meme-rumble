from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
import subprocess,json
root=Path(__file__).resolve().parents[1];out=root/'output/动作衔接_V25'
ff='E:/剪映/JianyingPro/11.6.0.14552/ffmpeg.exe'
font=ImageFont.truetype('C:/Windows/Fonts/msyh.ttc',21)
for name in ['奶蛙','大肥鱼']:
 for version in ['改前','改后']:
  label=out/(name+'_'+version+'_片头标识.png')
  im=Image.new('RGB',(1280,36),'#0a1220');ImageDraw.Draw(im).text((18,3),name+' · '+version+' · 余晖货港 · 正常速度 1×',font=font,fill='#f5e3b5');im.save(label)
  dest=out/(name+'_'+version+'.mp4')
  subprocess.run([ff,'-y','-hide_banner','-loglevel','error','-i',str(out/(name+'_'+version+'.webm')),'-i',str(label),'-filter_complex','[0:v]fps=60[base];[base][1:v]overlay=0:0:format=auto[v]','-map','[v]','-c:v','h264_nvenc','-b:v','8M','-pix_fmt','yuv420p','-fps_mode','cfr','-movflags','+faststart','-an',str(dest)],check=True)
 dest=out/(name+'_改前改后_正常速度.mp4')
 subprocess.run([ff,'-y','-hide_banner','-loglevel','error','-i',str(out/(name+'_改前.mp4')),'-i',str(out/(name+'_改后.mp4')),'-filter_complex','[0:v]setpts=PTS-STARTPTS,tpad=stop_mode=clone:stop_duration=0.2[a];[1:v]setpts=PTS-STARTPTS,tpad=stop_mode=clone:stop_duration=0.2[b];[a][b]hstack=inputs=2,fps=60[v]','-map','[v]','-t','12','-c:v','h264_nvenc','-b:v','15M','-pix_fmt','yuv420p','-fps_mode','cfr','-movflags','+faststart','-an',str(dest)],check=True)
 print(dest.name,dest.stat().st_size,flush=True)

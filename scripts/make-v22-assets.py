"""V22 authored SFX, supplied-recording cuts and production atlas copy."""
from pathlib import Path
import argparse,math,random,struct,wave,subprocess
ROOT=Path(__file__).resolve().parents[1]
AUDIO=ROOT/'assets/audio'
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('source_dir', type=Path, help='Folder containing the supplied audio references')
parser.add_argument('--ffmpeg', default='ffmpeg')
args = parser.parse_args()
FF, INPUT = args.ffmpeg, args.source_dir

atlas=ROOT/'assets/角色/特效/奶蛙/强化普攻_V22/白金焰羽_八部件.png'
if not atlas.is_file():
    raise SystemExit(f"Missing production atlas: {atlas}")

def cut(source,name,start,end,extra=''):
    filters=f'atrim=start={start}:end={end},asetpts=PTS-STARTPTS,afade=t=in:d=0.004,afade=t=out:st={end-start-.012}:d=0.012'
    if extra:filters+=','+extra
    subprocess.run([FF,'-y','-hide_banner','-loglevel','error','-i',str(INPUT/source),'-vn','-af',filters,'-map_metadata','-1','-ac','1','-ar','44100','-c:a','pcm_s16le',str(AUDIO/'whale'/(name+'.wav'))],check=True)

cut('大肥鱼声音参考.mp3','普攻一_欧',.835,1.185)
cut('大肥鱼声音参考.mp3','普攻二_鲸',1.185,1.40)
cut('大肥鱼声音参考.mp3','普攻三_鲸',1.40,1.78)
cut('大肥鱼声音参考.mp3','大招_鲸鲸',1.185,1.78)
subprocess.run([FF,'-y','-hide_banner','-loglevel','error','-i',str(INPUT/'大肥鱼吃米饭.mp3'),'-filter_complex',
 '[0:a]atrim=start=1.77:end=3.44,asetpts=PTS-STARTPTS,afade=t=in:d=0.008,afade=t=out:st=1.65:d=0.02[a];[0:a]atrim=start=3.59:end=5.67,asetpts=PTS-STARTPTS,afade=t=in:d=0.008,afade=t=out:st=2.06:d=0.02[b];[a][b]concat=n=2:v=0:a=1[out]',
 '-map','[out]','-map_metadata','-1','-ac','1','-ar','44100','-c:a','pcm_s16le',str(AUDIO/'whale/偷吃_两声喃喃.wav')],check=True)

# Original, seeded, short metallic/air transients, rather than skill one's bell/wave.
names=['强化普攻一_穿光','强化普攻二_双弧','强化普攻三_升羽','强化普攻四_环震','强化普攻五_长虹','强化普攻_命中']
durations=[.26,.31,.33,.36,.52,.19]
rate=44100
for stage,(name,duration) in enumerate(zip(names,durations)):
    rng=random.Random(20261125+stage);samples=[];low=0
    for i in range(round(rate*duration)):
        t=i/rate;p=t/duration;n=rng.uniform(-1,1);low=.88*low+.12*n
        phase=2*math.pi*((190+stage*27)*t+(700 if stage==2 else -220)*t*t)
        air=(low*1.5+n*.17)*math.sin(math.pi*p)**.8
        strike=math.exp(-t*(36 if stage!=4 else 15))*(n*.22+math.sin(phase)*.3)
        sheen=math.sin(2*math.pi*(1800*t+800*t*t))*.10*math.exp(-t*12)
        if stage==1:air*=.45+.55*math.sin(math.pi*p*2)**2
        if stage==3:strike+=math.sin(2*math.pi*70*t)*.4*math.exp(-t*14)
        if stage==4:air*=1.4;strike+=math.sin(2*math.pi*58*t)*.42*math.exp(-t*8)
        v=(air+strike+sheen)*min(1,t/.004)*min(1,(duration-t)/.035)
        samples.append(v)
    scale=.8/max(max(map(abs,samples)),1)
    with wave.open(str(AUDIO/'frog'/(name+'.wav')),'wb') as w:
        w.setparams((1,2,rate,len(samples),'NONE','not compressed'))
        w.writeframes(struct.pack('<'+'h'*len(samples),*(int(v*scale*32767) for v in samples)))
print('V22 atlas copied and six original empowered combo SFX created.')

"""Original deterministic game foley; no external samples or voice cloning."""
from pathlib import Path
import math, random, struct, wave

ROOT=Path(__file__).resolve().parents[1]/'assets/audio'
RATE=22050
rng=random.Random(20261123)
def render(folder,name,duration,fn):
    data=[];low=0
    for i in range(int(RATE*duration)):
        t=i/RATE;p=t/duration;n=rng.uniform(-1,1);low=.86*low+.14*n
        value=fn(t,p,n,low)*min(1,t/.006)*min(1,(duration-t)/.025)
        data.append(value)
    peak=max(map(abs,data),default=1);scale=.78/max(1,peak)
    path=ROOT/folder/(name+'.wav');path.parent.mkdir(parents=True,exist_ok=True)
    with wave.open(str(path),'wb') as w:
        w.setparams((1,2,RATE,len(data),'NONE','not compressed'))
        w.writeframes(struct.pack('<'+'h'*len(data),*(int(max(-1,min(1,x*scale))*32767) for x in data)))
def tone(t,f):return math.sin(2*math.pi*f*t)
def whoosh(t,p,n,l):return (l*3+n*.13)*math.sin(math.pi*p)**1.5
def impact(t,p,n,l):return (n*.44*math.exp(-t*45)+tone(t,110-45*p)*math.exp(-t*20))
def metal(t,p,n,l):return sum(tone(t,f)*math.exp(-t*d)*a for f,d,a in [(512,7,.35),(877,10,.26),(1429,15,.18),(2317,19,.1)])+n*.25*math.exp(-t*80)
def splash(t,p,n,l):return (n*.28+l*1.8)*math.exp(-t*4)+tone(t,170+900*p)*math.exp(-t*16)*.18
def bell(t,p,n,l):return sum(tone(t,f)*a*math.exp(-t*(3+j*2)) for j,(f,a) in enumerate([(523,.28),(784,.18),(1047,.12),(1568,.05)]))
def gate(t,p,n,l):return bell(t,p,n,l)*.8+whoosh(t,p,n,l)*.3
for folder,name,duration,fn in [
 ('whale','尾击挥风',.22,whoosh),('whale','尾击命中',.22,impact),
 ('whale','铁盆格挡',.42,metal),('whale','铁盆触发',.60,lambda t,p,n,l:metal(t,p,n,l)*1.2),
 ('whale','米饭掷出',.18,lambda t,p,n,l:whoosh(t,p,n,l)*.5+tone(t,430-260*p)*math.sin(math.pi*p)*.3),
 ('whale','米饭黏住',.26,lambda t,p,n,l:impact(t,p,n,l)*.45+tone(t,220-170*p)*math.exp(-t*16)*.4),
 ('whale','偷吃米饭',.32,lambda t,p,n,l:abs(tone(t,11))*n*.22*math.exp(-t*5)),
 ('whale','蓝色旋风',.64,lambda t,p,n,l:whoosh(t,p,n,l)*(.6+.4*math.sin(t*45)**2)),
 ('whale','召唤潮鸣',1.0,lambda t,p,n,l:whoosh(t,p,n,l)*.38+tone(t,95+65*p)*math.sin(math.pi*p)*.45+tone(t,191+55*p)*.14*math.sin(math.pi*p)),
 ('whale','水潭预警',.60,lambda t,p,n,l:whoosh(t,p,n,l)*.4+tone(t,160+240*p)*p*.14),
 ('whale','水鲸破水',.34,splash),('whale','巨鲸冲天',.85,lambda t,p,n,l:splash(t,p,n,l)*1.6+tone(t,62+35*p)*math.sin(math.pi*p)*.4),
 ('frog','拳脚挥风',.17,lambda t,p,n,l:whoosh(t,p,n,l)*.68),('frog','拳脚命中',.18,impact),
 ('frog','落地缓冲',.17,lambda t,p,n,l:impact(t,p,n,l)*.6),('frog','起跳蹬地',.17,lambda t,p,n,l:whoosh(t,p,n,l)*.45+tone(t,130+240*p)*math.exp(-t*17)*.3),
 ('frog','捧腹震波',.23,lambda t,p,n,l:impact(t,p,n,l)*.45+tone(t,170-100*p)*math.exp(-t*13)*.55),
 ('frog','全图冲击',.47,lambda t,p,n,l:impact(t,p,n,l)*.6+whoosh(t,p,n,l)*.6),
 ('frog','金色瞬移',.38,gate),('frog','圣光变身',1.8,lambda t,p,n,l:bell(t,p,n,l)*.8+whoosh(t,p,n,l)*.33),
 ('frog','神圣命中',.27,bell),('frog','神圣震波',.38,lambda t,p,n,l:bell(t,p,n,l)+whoosh(t,p,n,l)*.45),
 ('frog','落败坐地',.22,lambda t,p,n,l:impact(t,p,n,l)*.6),('frog','侧躺起身',.32,lambda t,p,n,l:whoosh(t,p,n,l)*.3),
]:render(folder,name,duration,fn)
print('24 original character sound effects written')

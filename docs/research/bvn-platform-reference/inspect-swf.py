import struct,zlib,sys
class Bits:
 def __init__(self,b,p): self.b=b; self.bit=p*8
 def u(self,n):
  x=0
  for _ in range(n): x=(x<<1)|((self.b[self.bit//8]>>(7-self.bit%8))&1);self.bit+=1
  return x
 def s(self,n):
  x=self.u(n);return x-(1<<n) if n and x&(1<<(n-1)) else x
 def end(self): return (self.bit+7)//8
def rect(b,p):
 q=Bits(b,p);n=q.u(5); v=[q.s(n)/20 for i in range(4)];return v,q.end()
def matrix(b,p):
 q=Bits(b,p);sx=sy=1;rx=ry=0
 if q.u(1): n=q.u(5); sx=q.s(n)/65536;sy=q.s(n)/65536
 if q.u(1): n=q.u(5); rx=q.s(n)/65536;ry=q.s(n)/65536
 n=q.u(5);tx=q.s(n)/20;ty=q.s(n)/20;return (sx,sy,rx,ry,tx,ty),q.end()
def cxform(b,p):
 q=Bits(b,p);a=q.u(1);m=q.u(1);n=q.u(4)
 if m:
  for _ in range(4):q.s(n)
 if a:
  for _ in range(4):q.s(n)
 return q.end()
def tags(data,p,end):
 while p+2<=end:
  x=struct.unpack_from('<H',data,p)[0];p+=2;t=x>>6;n=x&63
  if n==63:n=struct.unpack_from('<I',data,p)[0];p+=4
  yield t,data[p:p+n];p+=n
  if not t: break

def place(b):
 flags=b[0]; depth=struct.unpack_from('<H',b,1)[0];p=3;cid=None;m=(1,1,0,0,0,0);name=None
 if flags&2:cid=struct.unpack_from('<H',b,p)[0];p+=2
 if flags&4:m,p=matrix(b,p)
 if flags&8:p=cxform(b,p)
 if flags&16:p+=2
 if flags&32:
  end=b.index(0,p);name=b[p:end].decode('utf8','replace');p=end+1
 return {'id':cid,'depth':depth,'matrix':m,'name':name}

def run(file):
 raw=open(file,'rb').read();d=raw[:8]+zlib.decompress(raw[8:]) if raw[:3]==b'CWS' else raw
 _,p=rect(d,8);p+=4; sprites={};shapes={};root=[]
 for t,b in tags(d,p,len(d)):
  if t in (2,22,32,83,46,84,37,7,34):
   try: cid=struct.unpack_from('<H',b,0)[0];shapes[cid]=rect(b,2)[0]
   except: pass
  elif t==39:
   cid,n=struct.unpack_from('<HH',b,0);lst=[]
   for tt,bb in tags(b,4,len(b)):
    if tt==26:
     try:lst.append(place(bb))
     except Exception as e:pass
    elif tt==1:break
   sprites[cid]=lst
  elif t==26:
   try:root.append(place(b))
   except:pass
  elif t==1: break
 print(file, 'named',[(x['name'],x['id'],x['matrix']) for x in root if x['name']])
 for obj in root:
  if obj['name']=='floor':
   print('FLOOR', obj)
   for child in sprites.get(obj['id'],[]):
    print(' item',child,'rect',shapes.get(child['id']),'children',len(sprites.get(child['id'],[])))
for f in sys.argv[1:]:run(f)

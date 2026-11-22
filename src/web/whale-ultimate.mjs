// Reuses the approved V7 flexible-body mesh, expression blend and thin logo portal.
export function createUltimateRenderer(images){
let ctx,entity;const SIZE=.75,START=1130,PORTAL={x:180,y:200,ry:115};
const clamp=x=>Math.max(0,Math.min(1,x)),smooth=x=>{x=clamp(x);return x*x*(3-2*x)},ease=x=>1-Math.pow(1-clamp(x),3);
const textures={};for(const n of ['calm','alert','fierce'])textures[n]=normalise(images[n]);
const face=document.createElement('canvas');face.width=512;face.height=256;const fg=face.getContext('2d');
const body=document.createElement('canvas'),disc=document.createElement('canvas');body.width=disc.width=1100;body.height=disc.height=420;
const bg=body.getContext('2d'),dg=disc.getContext('2d');
function motion(ms){return{x:PORTAL.x+(entity.x-entity.originX)*entity.facing,y:PORTAL.y+3*Math.sin(ms*.006)}}
function normalise(im){const c=document.createElement('canvas');c.width=im.width;c.height=im.height;const g=c.getContext('2d',{willReadFrequently:true});g.drawImage(im,0,0);const p=g.getImageData(0,0,c.width,c.height).data;let x0=c.width,y0=c.height,x1=0,y1=0;for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++)if(p[(y*c.width+x)*4+3]>100){x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y)}const out=document.createElement('canvas');out.width=512;out.height=256;const og=out.getContext('2d');og.imageSmoothingEnabled=false;og.drawImage(im,x0,y0,x1-x0+1,y1-y0+1,2,2,508,252);return out}
function faceTexture(ms){fg.clearRect(0,0,512,256);fg.drawImage(textures.fierce,0,0);fg.clearRect(330,0,182,256);fg.save();fg.beginPath();fg.rect(330,0,182,256);fg.clip();fg.drawImage(textures.calm,0,0);fg.globalAlpha=smooth((ms-1130)/120);fg.drawImage(textures.alert,0,0);fg.globalAlpha=smooth((ms-1230)/170);fg.drawImage(textures.fierce,0,0);fg.restore();return face}
function spine(u,ms){const amp=(3+17*Math.pow(1-u,1.8))*smooth((ms-START)/150);return [(-270+540*u)*SIZE,Math.sin(ms*.011-u*5.5)*amp]}
function vertex(u,v,ms){const p=spine(u,ms),a=spine(Math.max(0,u-.004),ms),b=spine(Math.min(1,u+.004),ms),dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy)||1;const offset=(v-.50)*262*SIZE;return [p[0]-dy/len*offset,p[1]+dx/len*offset]}
function triangle(im,s,d,g=ctx){const sx1=s[1][0]-s[0][0],sy1=s[1][1]-s[0][1],sx2=s[2][0]-s[0][0],sy2=s[2][1]-s[0][1],dx1=d[1][0]-d[0][0],dy1=d[1][1]-d[0][1],dx2=d[2][0]-d[0][0],dy2=d[2][1]-d[0][1],det=sx1*sy2-sx2*sy1;if(Math.abs(det)<.001)return;const a=(dx1*sy2-dx2*sy1)/det,b=(dy1*sy2-dy2*sy1)/det,c=(dx2*sx1-dx1*sx2)/det,e=(dy2*sx1-dy1*sx2)/det;g.save();const mx=(d[0][0]+d[1][0]+d[2][0])/3,my=(d[0][1]+d[1][1]+d[2][1])/3;g.beginPath();for(let j=0;j<3;j++){const xx=d[j][0]+(d[j][0]-mx)*.008,yy=d[j][1]+(d[j][1]-my)*.008;j?g.lineTo(xx,yy):g.moveTo(xx,yy)}g.closePath();g.clip();g.transform(a,b,c,e,d[0][0]-a*s[0][0]-c*s[0][1],d[0][1]-b*s[0][0]-e*s[0][1]);g.drawImage(im,0,0);g.restore()}
function swimBody(ms,g=ctx){const tex=faceTexture(ms),m=motion(ms);const cut=clamp((PORTAL.x-m.x+270*SIZE)/(540*SIZE));g.save();g.translate(m.x,m.y);g.imageSmoothingEnabled=false;for(let i=0;i<28;i++){const u=Math.max(i/28,cut),u1=(i+1)/28;if(u>=u1)continue;for(let j=0;j<3;j++){const v=j/3,v1=(j+1)/3;const a=vertex(u,v,ms),b=vertex(u1,v,ms),c=vertex(u1,v1,ms),d=vertex(u,v1,ms);const src=[[u*512,v*256],[u1*512,v*256],[u1*512,v1*256],[u*512,v1*256]];triangle(tex,[src[0],src[1],src[2]],[a,b,c],g);triangle(tex,[src[0],src[2],src[3]],[a,c,d],g)}}g.restore()}
function portalState(ms){const grow=ms<1030?0:.025+.975*ease((ms-1030)/90),fade=entity?(1-smooth((((entity.x-entity.originX)*entity.facing)-202.5)/70))*(entity.endingAge?clamp((entity.endingAge-entity.age)/12):1):1;return {grow,rx:28*grow,ry:115*grow,alpha:ms>=1030?fade:0}}
function portal(ms,g=ctx){const p=portalState(ms);if(p.alpha<=0||p.grow<=0)return;g.save();g.globalAlpha=p.alpha;g.translate(PORTAL.x,PORTAL.y);g.scale(p.grow,p.grow);g.save();g.scale(28/115,1);const grad=g.createRadialGradient(0,0,5,0,0,115);grad.addColorStop(0,'#071d3df5');grad.addColorStop(1,'#020c1ef5');g.fillStyle=grad;g.beginPath();g.arc(0,0,115,0,Math.PI*2);g.fill();const symbol=1;if(symbol>0){g.globalAlpha=p.alpha*symbol;g.drawImage(images.logo,-119,-140,238,238)}g.globalAlpha=p.alpha;for(const [r,color] of [[100,'#59a5f3'],[88,'#75cfff']]){g.strokeStyle=color;g.lineWidth=1.5;g.setLineDash(r===100?[7,10]:[]);g.beginPath();g.arc(0,0,r,0,Math.PI*2);g.stroke()}g.setLineDash([]);for(let i=0;i<10;i++){const a=i*Math.PI/5+(ms-1030)*.0008;g.fillStyle=i%3?'#69bdff':'#d7fbff';g.fillRect(Math.cos(a)*94-2,Math.sin(a)*94-2,4,4)}g.restore();g.strokeStyle='#8de8ff';g.lineWidth=1.5;g.beginPath();g.ellipse(0,0,28,115,0,0,Math.PI*2);g.stroke();g.restore()}
function lineBurst(age,a){ctx.save();ctx.globalAlpha=a;for(let i=0;i<68;i++){const angle=i*2.39996,r=95+(i%7)*27+(age*.35+i*43)%170,len=190+(i%5)*48;ctx.strokeStyle=i%3?'#398fff':'#baf6ff';ctx.lineWidth=2+(i%3)*2;ctx.beginPath();ctx.moveTo(500+Math.cos(angle)*r,390+Math.sin(angle)*r);ctx.lineTo(500+Math.cos(angle)*(r+len),390+Math.sin(angle)*(r+len));ctx.stroke()}ctx.restore()}

function draw(g,e){entity=e;const ms=1130+e.age*1000/60,withPortal=(e.x-e.originX)*e.facing-202.5<70;
 g.save();g.translate(e.originX,e.y);g.scale(e.facing,1);g.translate(-PORTAL.x,-PORTAL.y);
 if(withPortal){bg.clearRect(0,0,1100,420);dg.clearRect(0,0,1100,420);swimBody(ms,bg);portal(ms,dg);
 dg.save();dg.globalCompositeOperation='destination-out';for(const[x,y]of [[0,0],[-1,0],[1,0],[0,-1],[0,1]])dg.drawImage(body,x,y);dg.restore();g.drawImage(disc,0,0);}
 const progress=clamp((e.age)/15),m=motion(ms),tail=m.x-202.5;
 for(let strand=0;strand<3;strand++){g.save();g.globalAlpha=progress*.38;g.strokeStyle=['#245fe4','#6cdbff','#e0faff'][strand];g.lineWidth=12-strand*4;g.beginPath();
 for(let i=0;i<=32;i++){const x=Math.max(PORTAL.x,tail-i*5),yy=m.y+(strand-1)*(8+i*.4)+Math.sin(ms*.012-i*.27+strand)*10; i?g.lineTo(x,yy):g.moveTo(x,yy);}g.stroke();g.restore();}
 const fade=e.endingAge?clamp((e.endingAge-e.age)/12):1;
 g.save();g.globalAlpha*=fade;if(withPortal)g.drawImage(body,0,0);else swimBody(ms,g);g.restore();
 for(let i=0;i<23;i++){const phase=(e.age*1.7+i*3.7)%48,x=tail-phase*3;if(x<PORTAL.x)continue;g.fillStyle=i%3?'#8eeaff':'#edffff';g.globalAlpha=(1-phase/48)*.7;g.fillRect(Math.round(x/3)*3,Math.round((m.y+Math.sin(i*2.1+ms*.006)*phase*.6)/3)*3,3+(i%2)*2,3);}
 g.restore();
}
return{draw,portalStart(g,x,y,dir,age){g.save();g.translate(x,y);g.scale(dir,1);g.translate(-PORTAL.x,-PORTAL.y);const prev=entity;entity=null;portal(1030+age*1000/60,g);entity=prev;g.restore();},
 intro(g,w,h,phase){if(phase>=60)return;ctx=g;const ms=120+phase*1000/60,alpha=clamp(phase/5)*clamp((60-phase)/10),p=ease(phase/13);
 g.save();g.scale(w/1280,h/720);g.globalAlpha*=alpha;g.fillStyle='#020823ee';g.fillRect(0,0,1280,720);lineBurst(ms,.65);
 const ph=655,pw=ph*images.portrait.width/images.portrait.height;g.drawImage(images.portrait,-25-(1-p)*170,95,pw,ph);
 const tw=770*(1+(1-p)*.23),th=tw*images.title.height/images.title.width,tx=493+(1-p)*155,ty=168-(1-p)*60;
 if(phase<20){g.save();g.globalAlpha*=.32;g.filter='blur(5px)';g.drawImage(images.title,tx+15,ty-8,tw+22,th+10);g.restore();}g.drawImage(images.title,tx,ty,tw,th);g.restore();}};
}

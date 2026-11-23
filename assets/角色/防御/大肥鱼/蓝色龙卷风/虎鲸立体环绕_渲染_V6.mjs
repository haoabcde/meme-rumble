// Small software-rendered 3D whale. The approved ultimate art supplies the skin colours.
// Closed body/fins, true yaw, per-pixel depth and quantized light replace billboard flipping.
const TAU=Math.PI*2,clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const norm=v=>{const d=Math.hypot(...v)||1;return v.map(x=>x/d);};
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const minus=(a,b)=>a.map((x,i)=>x-b[i]);
const profile=[[0,1.5,1.5],[.10,3.4,2.8],[.22,7,5],[.40,11,8.8],[.60,14,11.5],[.78,15,13],[.91,12,11],[.98,7,6.3],[1,1,1]];
function radius(u){const i=Math.max(0,profile.findIndex(p=>p[0]>=u)-1),a=profile[i],b=profile[i+1]??a,t=clamp((u-a[0])/(b[0]-a[0]||1));return [a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t];}
// Visual time is independent of the attack action: the ghost can outlive the wind.
export const WHALE_VISUAL={duration:48,fadeFrom:32};
export function sampleCounterWhale(age){
  if(age<0||age>=WHALE_VISUAL.duration)return null;
  const u=clamp((age-12)/36),progress=age<=12?age/18:2/3+2*u-u*u;
  const fade=clamp((age-WHALE_VISUAL.fadeFrom)/(WHALE_VISUAL.duration-WHALE_VISUAL.fadeFrom));
  return {progress,alpha:clamp(age/2)*(1-fade*fade*(3-2*fade))};
}
export function orbitPose(progress,continuous=false){
  const p=continuous?Math.max(0,progress):clamp(progress),angle=-Math.PI/2+p*TAU,
    height=.27+.52*Math.min(p,1)+(continuous?.10*clamp(p-1):0),radius=36+45*height;
  return {p,angle,yaw:angle+Math.PI/2,x:Math.cos(angle)*radius,y:-height*259+Math.sin(angle)*radius*.19,
    depth:Math.sin(angle)*radius,alpha:continuous?1:Math.min(1,p*12,(1-p)*12)};
}
function mesh(phase){
  const tris=[],rings=32,sides=24,wave=Math.sin(phase*TAU*2),v=(u,j)=>{
    const a=j/sides*TAU,[ry,rz]=radius(u),tail=Math.pow(1-u,3)*wave*2.8;
    return {p:[-38+u*82,Math.sin(u*Math.PI)*2+tail+ry*Math.cos(a),rz*Math.sin(a)],uv:[.18+u*.80,.245+.51*(1-Math.cos(a))/2],skinSide:Math.abs(Math.sin(a)),vertical:Math.cos(a),along:u};
  };
  const tri=(a,b,c,color=null)=>tris.push({vertices:[a,b,c],color});
  for(let i=0;i<rings;i++)for(let j=0;j<sides;j++){
    const a=v(i/rings,j),b=v((i+1)/rings,j),c=v((i+1)/rings,j+1),d=v(i/rings,j+1);tri(a,b,c);tri(a,c,d);
  }
  for(const u of [0,1]){const ring=v(u,0),center={p:[ring.p[0],Math.sin(u*Math.PI)*2+Math.pow(1-u,3)*wave*2.8,0],uv:[.18+u*.80,.50]};
    for(let j=0;j<sides;j++)tri(center,v(u,j),v(u,j+1));}
  function fin(points,axis,thickness,color){
    const layers=[-1,1].map(sign=>points.map(p=>({p:p.map((x,i)=>x+(i===axis?sign*thickness/2:0)),uv:[0,0]})));
    for(const l of layers)for(let i=1;i<l.length-1;i++)tri(l[0],l[i],l[i+1],color);
    for(let i=0;i<points.length;i++){const j=(i+1)%points.length;tri(layers[0][i],layers[1][i],layers[1][j],color);tri(layers[0][i],layers[1][j],layers[0][j],color);}
  }
  // Dorsal, near/far pectorals and two tail flukes have independent thickness and depth.
  fin([[-8,12,0],[-8,27,0],[-3,24,0],[7,12,0]],2,2.4,[48,83,199]);
  for(const side of [-1,1])fin([[14,-4,side*9],[7,-12,side*17],[-7,-21,side*22],[-3,-10,side*8]],1,2,[46,85,190]);
  const lift=wave*4;
  for(const side of [-1,1])fin([[-35,lift,0],[-41,lift+3,side*17],[-48,lift+5,side*19],[-45,lift+1,side*6],[-40,lift-1,0]],1,1.8,[66,117,219]);
  return tris;
}
export function createWhaleVolumeRenderer(image){
  const tex=document.createElement('canvas');tex.width=image.width;tex.height=image.height;const tg=tex.getContext('2d',{willReadFrequently:true});tg.drawImage(image,0,0);
  const texture=tg.getImageData(0,0,tex.width,tex.height).data,cache=new Map(),W=160,H=116,S=1.38;
  const light=norm([-.4,.8,.65]);
  function render(progress,continuous=false){
    const phase=Math.round((continuous?Math.max(0,progress):clamp(progress))*120),key=phase+'/'+continuous;if(cache.has(key))return cache.get(key);
    const pose=orbitPose(phase/120,continuous),geometry=mesh(pose.p),depth=new Float32Array(W*H).fill(-Infinity),parts=new Int8Array(W*H),rgba=new Uint8ClampedArray(W*H*4);
    const cy=Math.cos(pose.yaw),sy=Math.sin(pose.yaw);
    const rotate=p=>[p[0]*cy-p[2]*sy,p[1],p[0]*sy+p[2]*cy];
    for(const face of geometry){
      const vv=face.vertices.map(v=>{const p=rotate(v.p);return {x:W/2+p[0]*S,y:H/2+7+(-p[1]+p[2]*.19)*S,z:p[2]+p[1]*.19,worldZ:p[2],uv:v.uv,skinSide:v.skinSide??0,vertical:v.vertical??0,along:v.along??0,p};});
      const [a,b,c]=vv,area=(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);if(Math.abs(area)<.001)continue;
      let normal=norm(cross(minus(b.p,a.p),minus(c.p,a.p)));
      // Double-sided fin meshes retain correctly lit visible surfaces.
      if(normal[2]<0)normal=normal.map(x=>-x);
      const illumination=.42+.58*Math.max(0,normal.reduce((s,x,i)=>s+x*light[i],0));
      const shade=.48+Math.round((illumination-.42)*5)/5*.52;
      const x0=Math.max(0,Math.floor(Math.min(a.x,b.x,c.x))),x1=Math.min(W-1,Math.ceil(Math.max(a.x,b.x,c.x)));
      const y0=Math.max(0,Math.floor(Math.min(a.y,b.y,c.y))),y1=Math.min(H-1,Math.ceil(Math.max(a.y,b.y,c.y)));
      for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){
        const px=x+.5,py=y+.5;
        const b1=((px-a.x)*(c.y-a.y)-(py-a.y)*(c.x-a.x))/area,b2=((b.x-a.x)*(py-a.y)-(b.y-a.y)*(px-a.x))/area,b0=1-b1-b2;
        if(b0<-.001||b1<-.001||b2<-.001)continue;
        const z=b0*a.z+b1*b.z+b2*c.z,index=y*W+x;if(z<=depth[index])continue;
        let color=face.color;
        if(!color){const u=clamp(b0*a.uv[0]+b1*b.uv[0]+b2*c.uv[0]),v=clamp(b0*a.uv[1]+b1*b.uv[1]+b2*c.uv[1]),at=(Math.min(tex.height-1,Math.floor(v*tex.height))*tex.width+Math.min(tex.width-1,Math.floor(u*tex.width)))*4;
          const side=b0*a.skinSide+b1*b.skinSide+b2*c.skinSide,vertical=b0*a.vertical+b1*b.vertical+b2*c.vertical,along=b0*a.along+b1*b.along+b2*c.along;
          let base=vertical<-.28?[225,237,255]:[45,78,194];
          if(along>.94&&vertical<-.08&&vertical>-.35)base=[12,24,61];
          // Side markings stay on the flanks instead of wrapping an eye patch into a ring on the nose.
          const weight=clamp((side-.45)/.35)*clamp((1-along)/.08),sample=texture[at+3]>128?[texture[at],texture[at+1],texture[at+2]]:base;
          color=base.map((c,i)=>c+(sample[i]-c)*weight);}
        const at=index*4;rgba[at]=color[0]*shade;rgba[at+1]=color[1]*shade;rgba[at+2]=color[2]*shade;rgba[at+3]=255;
        depth[index]=z;parts[index]=pose.depth+b0*a.worldZ+b1*b.worldZ+b2*c.worldZ>=0?1:-1;
      }
    }
    const outputs={pose};
    for(const [name,part] of [['back',-1],['front',1]]){
      const bytes=new Uint8ClampedArray(rgba.length);
      for(let i=0;i<W*H;i++)if(parts[i]===part){bytes.set(rgba.subarray(i*4,i*4+4),i*4);}
      const canvas=document.createElement('canvas');canvas.width=W;canvas.height=H;canvas.getContext('2d').putImageData(new ImageData(bytes,W,H),0,0);outputs[name]=canvas;
    }
    cache.set(key,outputs);return outputs;
  }
  return {render,draw(ctx,progress,layer,alpha=1,continuous=false){
    const frame=render(progress,continuous),p=frame.pose;if(p.alpha<=0)return;
    ctx.save();ctx.imageSmoothingEnabled=false;ctx.globalAlpha*=p.alpha*alpha;
    ctx.drawImage(frame[layer],p.x-W/(2*S),p.y-(H/2+7)/S,W/S,H/S);ctx.restore();
  }};
}

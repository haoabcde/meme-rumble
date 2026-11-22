// The approved Liang Wenfeng / typography composition; combat is rendered separately.
export function createUltimateRenderer(images){
 let ctx;
 const clamp=x=>Math.max(0,Math.min(1,x)),ease=x=>1-Math.pow(1-clamp(x),3);
function lineBurst(age,a){ctx.save();ctx.globalAlpha=a;for(let i=0;i<68;i++){const angle=i*2.39996,r=95+(i%7)*27+(age*.35+i*43)%170,len=190+(i%5)*48;ctx.strokeStyle=i%3?'#398fff':'#baf6ff';ctx.lineWidth=2+(i%3)*2;ctx.beginPath();ctx.moveTo(500+Math.cos(angle)*r,390+Math.sin(angle)*r);ctx.lineTo(500+Math.cos(angle)*(r+len),390+Math.sin(angle)*(r+len));ctx.stroke()}ctx.restore()}

return{ intro(g,w,h,phase){if(phase>=60)return;ctx=g;const ms=120+phase*1000/60,alpha=clamp(phase/5)*clamp((60-phase)/10),p=ease(phase/13);
 g.save();g.scale(w/1280,h/720);g.globalAlpha*=alpha;g.fillStyle='#020823ee';g.fillRect(0,0,1280,720);lineBurst(ms,.65);
 const ph=655,pw=ph*images.portrait.width/images.portrait.height;g.drawImage(images.portrait,-25-(1-p)*170,95,pw,ph);
 g.restore();}};
}

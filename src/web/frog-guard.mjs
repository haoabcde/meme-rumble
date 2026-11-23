// Independent faceted rune plaques orbit in real depth, not a single shield sticker.
let pieces=[];
export function setGuardArt(images){pieces=images;}
export function drawRuneGuard(g,x,y,tick,layer){
 if(!pieces.length)return;
 for(let i=0;i<8;i++){
  const angle=tick*.018+i*Math.PI/4,depth=Math.sin(angle);
  if((layer==='front')!==(depth>0))continue;
  const im=pieces[i],h=(i<6?65:59)*(1+depth*.12),w=h*im.width/im.height;
  const xx=x+Math.cos(angle)*(i<6?106:112),yy=y-94+depth*25+Math.sin(tick*.055+i)*3;
  g.save();g.imageSmoothingEnabled=false;g.translate(xx,yy);g.rotate(Math.sin(angle)*.055);
  g.scale(.65+.35*Math.abs(Math.sin(angle)),1);
  g.globalAlpha=depth>0?.9:.48;g.drawImage(im,-w/2,-h/2,w,h);g.restore();
 }
}

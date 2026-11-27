// Contact presentation reused from the approved two-character build (66e3c50).
import type {CombatEvent} from '../core/types.js';
export const hasApprovedPresentation=(id:string|undefined)=>id==='whale'||id==='frog';
function polygon(ctx:CanvasRenderingContext2D,color:string,points:[number,number][]){
 ctx.fillStyle=color;ctx.beginPath();ctx.moveTo(...points[0]);
 for(const point of points.slice(1))ctx.lineTo(...point);ctx.closePath();ctx.fill();
}
const seatColors=['#61d8ff','#ff849e'];
export function drawApprovedEffect(ctx:CanvasRenderingContext2D,event:CombatEvent,age:number,life:number,latestHit:boolean){
const color = event.kind === 'block' ? '#84e8ff' : event.kind === 'break' ? '#ff8c88' : event.feedback?.color ?? '#ffdfa0';
ctx.save();
ctx.globalAlpha = Math.min(1, (life - age) / 6);
ctx.translate(event.x, event.y);
if (event.kind === 'ultimate') {
  ctx.strokeStyle = '#efd28a';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(0, 0, 24 + age * 4, 6 + age, 0, 0, 2 * Math.PI);
  ctx.stroke();
} else if (event.kind === 'dash') {
  ctx.fillStyle = seatColors[event.source];
  ctx.scale(event.direction ?? 1, 1);
  for (let i = 0; i < 4; i++) ctx.fillRect(-37 - age * 2 + i * 5, -15 - i * 15, 10 + age, 2);
} else if (event.kind === 'land' || event.kind === 'drop' || event.kind === 'air-jump' || event.kind === 'knockdown') {
  const air = event.kind === 'air-jump';
  ctx.strokeStyle = air ? seatColors[event.source] : '#fbdfb7cf';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(0, event.kind === 'drop' || air ? age * 1.8 : -1,
    (event.kind === 'knockdown' ? 22 : 9) + age * 2.7, 3 + age * .25, 0, 0, 2 * Math.PI);
  ctx.stroke();
} else if (event.kind === 'parry') {
  const radius = 12 + age * 1.8;
  polygon(ctx, '#ffe399', [[0, -radius], [4, -4], [radius, 0], [4, 4],
    [0, radius], [-4, 4], [-radius, 0], [-4, -4]]);
} else if (event.kind === 'block') {
  ctx.scale(event.direction ?? 1, 1);
  const radius = 15 + age * 1.6;
  ctx.strokeStyle = color;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(-6, 0, radius, -1.29, 1.29);
  ctx.stroke();
  ctx.strokeStyle = '#e8f9ff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(-8, 0, radius * .73, -.97, .97);
  ctx.stroke();
} else if (event.feedback?.shape === 'ring') {
  ctx.strokeStyle = '#fff2cf';
  ctx.lineWidth = 3;
  ctx.beginPath();ctx.arc(0, 0, 10 + age * 1.7, 0, Math.PI * 2);ctx.stroke();
} else {
  const heavy = event.heavy || event.kind === 'break';
  if (heavy) {
    const radius = 24 + age * 2.25;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5 - age * .08;
    ctx.beginPath();
    ctx.ellipse(0, 0, radius, radius * .76, -.32, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.save();
  const scale = (heavy ? .97 : .62) * (age < 3 ? 1 + age * .08 : 1.18 - age * .041);
  ctx.scale(scale * (event.direction ?? 1), scale);
  ctx.rotate(-.14 + age * .014);
  polygon(ctx, color, [[0, -39], [7, -11], [34, -18], [15, 0], [34, 18],
    [7, 10], [0, 36], [-8, 10], [-29, 16], [-14, 0], [-30, -19], [-7, -10]]);
  polygon(ctx, '#fff8e2', [[0, -17], [5, -5], [17, 0], [5, 4], [0, 17], [-6, 5], [-17, 0], [-5, -5]]);
  ctx.fillStyle = color;
  for (let i = 0; i < 5; i++) ctx.fillRect(19 + age * (1.3 + i * .12), (i - 2) * (12 + age * .42), 7, 2);
  ctx.restore();
  if (event.amount && latestHit) {
    const offset = 42 * (event.direction ?? 1);
    ctx.font = '950 20px system-ui';
    ctx.textAlign = 'center';
    ctx.strokeStyle = '#181934';
    ctx.lineWidth = 5;
    ctx.strokeText(String(event.amount), offset, -99 - age);
    ctx.fillStyle = '#fff4b9';
    ctx.fillText(String(event.amount), offset, -99 - age);
  }
}
ctx.restore();
}

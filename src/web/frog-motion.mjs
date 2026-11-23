// Presentation only: authored poses follow real simulation state; no extra control lock.
export const FROG_BASIC_POSES=Object.freeze(['蓄力蹲身','起跳蹬地','收膝上升','腾空顶点','下落伸腿','落地缓冲','落地回正','前倾闪避','轻受击','重受击','仰身击飞','翻身下落','侧卧倒地','撑地起身','半蹲起立','破防踉跄']);
export const FROG_SCENE_POSES=Object.freeze(['侧躺翘腿','收腿准备','撑地坐起','半蹲起立','叉腰得意','比耶庆祝','垂头落败','掩面落败']);
export function frogMotionSample(f,state,seat=0){
 const age=state.arenaFrame-(f.poseEvent?.tick??-999);
 const pose=(cell,height=130,bank='basic')=>({bank,cell,height});
 if(state.phase==='ready'){
  const t=120-state.phaseTicks;
  return t<44?pose(0,83,'scene'):t<60?pose(1,86,'scene'):t<80?pose(2,101,'scene'):t<104?pose(3,113,'scene'):null;
 }
 if((state.phase==='round-over'||state.phase==='match-over')&&f.ground){
  const won=state.result?.winner===seat,t=105-state.phaseTicks;
  if(won)return pose(Math.floor(state.frame/45)%2?5:4,130,'scene');
  if(t<24&&state.phase==='round-over')return pose(12,63);
  return pose(Math.floor(state.frame/65)%2?7:6,86,'scene');
 }
 if(!f.hp)return pose(f.ground?12:f.vy<0?10:11,f.ground?63:118);
 if(f.recovery)return pose(f.recovery.phase==='down'?12:f.recovery.phase==='rise'?(f.recovery.remaining>9?13:14):11,f.recovery.phase==='down'?63:f.recovery.phase==='rise'?(f.recovery.remaining>9?92:114):118);
 if(f.launched)return pose(f.vy<0?10:11,118);
 if(f.guardBreak)return pose(15,128);
 if(f.hitstun)return pose(f.poseEvent?.kind==='heavy'?9:8,f.poseEvent?.kind==='heavy'?113:130);
 if(f.dashActive||f.dash)return pose(7,103);
 if(f.attack||f.guarding)return null;
 if(!f.ground){
  if(f.poseEvent?.kind==='jump'&&age<4)return pose(age<2?0:1,age<2?101:139);
  if(f.poseEvent?.kind==='air-jump'&&age<5)return pose(2,112);
  return pose(f.vy< -2?2:f.vy>3?4:3,f.vy< -2?112:f.vy>3?136:129);
 }
 if(f.poseEvent?.kind==='land'&&age<10)return pose(age<5?5:6,age<5?101:122);
 return null;
}

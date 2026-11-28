import { harbor } from './harbor.js';
import type { ArenaDefinition, Platform } from '../core/types.js';

type Surface = [id: string, name: string, tier: Platform['tier'], left: number, right: number,
  rise: number, prop: NonNullable<Platform['prop']>, travel?: Platform['travel']];
type Description = Pick<ArenaDefinition, 'id' | 'name' | 'theme' | 'width' | 'terrain' | 'description' | 'routes'>;

function stage(description: Description, surfaces: Surface[]): ArenaDefinition {
  const { width } = description;
  const height = width * 9 / 16;
  const floor = Math.round(height * .827);
  const platforms = surfaces.map(([id, name, tier, left, right, rise, prop, travel]) =>
    ({ id, name, tier, left, right, y: floor - rise, prop, ...(travel && { travel }) }));
  return { ...description, height, floor, left: 96, right: width - 96, artFrame: [],
    spawn: [width / 2 - 173, width / 2 + 173], platforms };
}

const dorm = stage({
  id: 'dorm-roof', name: '宿舍楼顶', theme: 'dorm', width: 4160, terrain: '双侧登楼 · 跨院连廊',
  description: '花房和机房接上同一条连廊，沿连廊可以追过整个中庭。两端都可下穿回地面，东段还可登上水塔。',
  routes: [['west', 'bridge', 'tank'], ['east', 'bridge', 'tank']]
}, [
  ['planter', '西侧树荫花坛', 1, 350, 1080, 116, 'planter'],
  ['west', '西侧花房顶', 1, 1130, 1840, 122, 'sunroom'],
  ['bridge', '跨院连廊', 2, 740, 3420, 244, 'skywalk'],
  ['east', '东侧机房顶', 1, 2310, 3070, 122, 'penthouse'],
  ['tank', '天台水塔', 3, 2440, 2890, 362, 'water-tank'],
  ['greenhouse', '东翼温室顶', 1, 3190, 3995, 116, 'sunroom']
]);

const court = stage({
  id: 'night-court', name: '夜训球场', theme: 'court', width: 4480, terrain: '开阔中圈 · 高位换边',
  description: '中圈留给地面对打。两翼看台都能跳上计分牌，场边长椅提供额外的低位落脚点。',
  routes: [['west-stand', 'score-deck'], ['east-stand', 'score-deck']]
}, [
  ['west-bench', '主队场边长椅', 1, 500, 1240, 96, 'bench-seat'],
  ['west-stand', '主队看台', 1, 1150, 1985, 126, 'bleachers'],
  ['score-deck', '中央计分牌', 2, 1740, 2740, 254, 'scoreboard'],
  ['east-stand', '客队看台', 1, 2495, 3330, 126, 'bleachers'],
  ['east-bench', '客队场边长椅', 1, 3240, 3980, 96, 'bench-seat']
]);

const station = stage({
  id: 'star-station', name: '星电站', theme: 'station', width: 4352, terrain: '双塔回路 · 垂直升降井',
  description: '两塔各有一条固定登顶路线。中央升降机从地面附近直达塔冠，左右电缆桥之间也能用普通跳跨过。',
  routes: [['dock-left', 'relay-left', 'upper-left', 'coil-left'], ['dock-right', 'relay-right', 'upper-right', 'coil-right']]
}, [
  ['dock-left', '左塔变压器', 1, 820, 1865, 126, 'transformer'],
  ['relay-left', '左电缆桥', 2, 960, 2065, 254, 'conduit'],
  ['upper-left', '左塔控制室', 3, 625, 1660, 382, 'control-room'],
  ['coil-left', '西塔线圈冠', 4, 965, 1848, 510, 'inductor'],
  ['service-lift', '中央升降机', 1, 2056, 2296, 62, 'elevator', { axis: 'y', distance: -458, period: 480, dwell: 52, phase: 0 }],
  ['relay-right', '右电缆桥', 2, 2290, 3400, 254, 'conduit'],
  ['dock-right', '右塔变压器', 1, 2487, 3540, 126, 'transformer'],
  ['upper-right', '右塔控制室', 3, 2680, 3725, 382, 'control-room'],
  ['coil-right', '东塔线圈冠', 4, 2500, 3385, 510, 'inductor']
]);

const broadcast = stage({
  id: 'broadcast-ring', name: '直播擂台', theme: 'broadcast', width: 4480,
  terrain: '开阔擂台 · 长距离追击',
  description: '擂台地面贯通两侧，双方可以沿场边拉开距离，在中央灯光下交锋。',
  routes: [[], []]
}, []);

export const arenas: ArenaDefinition[] = [dorm, court, harbor, station, broadcast];

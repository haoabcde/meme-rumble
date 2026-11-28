import { harbor } from './harbor.js';
import type { ArenaDefinition, Platform } from '../core/types.js';

type Surface = [id: string, name: string, tier: Platform['tier'], left: number, right: number,
  rise: number, prop: NonNullable<Platform['prop']>, travel?: Platform['travel']];
type Description = Pick<ArenaDefinition, 'id' | 'name' | 'theme' | 'width' | 'terrain' | 'description' | 'routes'> &
  Partial<Pick<ArenaDefinition, 'spawn'>>;

function stage(description: Description, surfaces: Surface[]): ArenaDefinition {
  const { width } = description;
  const height = width * 9 / 16;
  const floor = Math.round(height * .827);
  const platforms = surfaces.map(([id, name, tier, left, right, rise, prop, travel]) =>
    ({ id, name, tier, left, right, y: floor - rise, prop, ...(travel && { travel }) }));
  return { ...description, height, floor, left: 96, right: width - 96, artFrame: [],
    spawn: description.spawn ?? [width / 2 - 173, width / 2 + 173], platforms };
}

const dorm = stage({
  id: 'dorm-roof', name: '宿舍楼顶', theme: 'dorm', width: 4160, terrain: '双侧登楼 · 跨院连廊',
  description: '两翼屋面各自连通，都能跳上跨院连廊。从两翼可逐层下穿，东段还可登上水塔。',
  routes: [['west', 'bridge', 'tank'], ['east', 'bridge', 'tank']]
}, [
  ['west', '西翼花房屋面', 1, 350, 1975, 122, 'sunroom'],
  ['bridge', '跨院连廊', 2, 740, 3420, 244, 'skywalk'],
  ['east', '东翼机房屋面', 1, 2185, 3995, 122, 'penthouse'],
  ['tank', '天台水塔', 3, 2440, 2890, 362, 'water-tank']
]);

const court = stage({
  id: 'night-court', name: '夜训球场', theme: 'court', width: 4480, spawn: [1940, 2540],
  terrain: '长台交锋 · 短台换边',
  description: '先上主战台。沿台面向两侧走可登高，中央双短台可互跳。站在高台外侧下穿可直接回到侧台。',
  routes: [['runway', 'west-stand', 'west-step', 'west-top'], ['runway', 'east-stand', 'east-step', 'east-top']]
}, [
  ['runway', '贯通主战台', 1, 680, 3800, 126, 'skywalk'],
  ['west-stand', '左侧落脚台', 2, 480, 1660, 252, 'bleachers'],
  ['east-stand', '右侧落脚台', 2, 2820, 4000, 252, 'bleachers'],
  ['west-step', '左侧换边短台', 3, 1480, 2140, 378, 'skywalk'],
  ['east-step', '右侧换边短台', 3, 2340, 3000, 378, 'skywalk'],
  ['west-top', '左侧高台', 4, 590, 1740, 504, 'bleachers'],
  ['east-top', '右侧高台', 4, 2740, 3890, 504, 'bleachers']
]);

const station = stage({
  id: 'star-station', name: '星电站', theme: 'station', width: 4352, terrain: '双塔回路 · 垂直升降井',
  description: '两塔各有一条固定登顶路线。中央升降机从地面附近直达塔冠，左右电缆桥之间也能用普通跳跨过。',
  routes: [['dock-left', 'relay-left', 'upper-left', 'coil-left'], ['dock-right', 'relay-right', 'upper-right', 'coil-right']]
}, [
  ['dock-left', '左塔变压器', 1, 820, 2038, 126, 'transformer'],
  ['relay-left', '左电缆桥', 2, 960, 2065, 254, 'conduit'],
  ['upper-left', '左塔控制室', 3, 625, 1660, 382, 'control-room'],
  ['coil-left', '西塔线圈冠', 4, 965, 1848, 510, 'inductor'],
  ['service-lift', '中央升降机', 1, 2056, 2296, 62, 'elevator', { axis: 'y', distance: -458, period: 480, dwell: 52, phase: 0 }],
  ['relay-right', '右电缆桥', 2, 2290, 3400, 254, 'conduit'],
  ['dock-right', '右塔变压器', 1, 2314, 3540, 126, 'transformer'],
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

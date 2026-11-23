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
  id: 'dorm-roof', name: '宿舍楼顶', theme: 'dorm', width: 4160, terrain: '温室起跳 · 跨院抢水塔',
  description: '两段屋廊在中庭断开。可横跳换楼，也可借机房屋顶登水塔，沿另一侧晾晒台落回花园。',
  routes: [['west', 'bridge', 'terrace', 'tank'], ['east', 'bridge-east', 'east-drying', 'tank']]
}, [
  ['planter', '西侧树荫花坛', 1, 142, 597, 92, 'planter'],
  ['west-annex', '西翼温室顶', 2, 455, 935, 217, 'sunroom'],
  ['west-yard', '苗圃花台', 1, 724, 1124, 123, 'planter'],
  ['west-drying', '西楼晾晒台', 3, 756, 1110, 351, 'laundry'],
  ['west-arch', '西院花廊', 2, 950, 1370, 254, 'skywalk'],
  ['west', '西侧花房顶', 1, 1170, 1770, 130, 'sunroom'],
  ['bridge', '西楼连廊', 2, 1386, 1982, 263, 'skywalk'],
  ['terrace', '机房屋顶', 3, 1515, 1936, 397, 'penthouse'],
  ['tank', '天台水塔', 4, 1846, 2360, 529, 'water-tank'],
  ['bridge-east', '东楼连廊', 2, 2180, 2790, 267, 'skywalk'],
  ['east', '东侧种植台', 1, 2390, 2980, 131, 'planter'],
  ['east-drying', '东楼晾晒台', 3, 2278, 2730, 393, 'laundry'],
  ['east-garden', '东院花廊', 2, 2960, 3475, 249, 'skywalk'],
  ['east-yard', '东侧花圃', 1, 3070, 3540, 119, 'planter'],
  ['greenhouse', '东翼温室顶', 1, 3368, 3995, 113, 'sunroom']
]);

const court = stage({
  id: 'night-court', name: '夜训球场', theme: 'court', width: 4480, terrain: '开阔中圈 · 高位换边',
  description: '中圈留给地面对打。两翼从替补棚和看台起跳，跃过转播席之间的缺口，能站上实时计分牌。',
  routes: [['bench', 'west-stand', 'press-west', 'score-deck'], ['away-bench', 'east-stand', 'press-east', 'score-deck']]
}, [
  ['west-bench', '主队场边长椅', 1, 185, 690, 111, 'bench-seat'],
  ['west-end', '主场底线看台', 2, 545, 1072, 237, 'bleachers'],
  ['home-court', '西区替补棚', 1, 820, 1270, 119, 'shelter'],
  ['west-lights', '西侧摄像台', 3, 929, 1292, 365, 'camera-deck'],
  ['west-aisle', '主场观众席', 2, 1114, 1590, 249, 'bleachers'],
  ['bench', '主队替补棚', 1, 1460, 1925, 130, 'shelter'],
  ['west-stand', '主队高看台', 2, 1545, 1985, 261, 'bleachers'],
  ['press-west', '主场转播席', 3, 1770, 2180, 394, 'press-box'],
  ['score-deck', '中央计分牌', 4, 1970, 2510, 527, 'scoreboard'],
  ['press-east', '客场转播席', 3, 2310, 2720, 395, 'press-box'],
  ['east-stand', '客队高看台', 2, 2490, 2930, 261, 'bleachers'],
  ['away-bench', '客队替补棚', 1, 2554, 3020, 131, 'shelter'],
  ['east-aisle', '客场观众席', 2, 2990, 3490, 249, 'bleachers'],
  ['away-court', '东区替补棚', 1, 3250, 3685, 119, 'shelter'],
  ['east-lights', '东侧摄像台', 3, 3400, 3780, 366, 'camera-deck'],
  ['east-end', '客场底线看台', 2, 3500, 4005, 235, 'bleachers'],
  ['east-bench', '客队场边长椅', 1, 3710, 4285, 111, 'bench-seat']
]);

const station = stage({
  id: 'star-station', name: '星电站', theme: 'station', width: 4352, terrain: '双塔回路 · 垂直升降井',
  description: '两塔各有一条固定登顶路线。中央升降机从地面附近直达塔冠，左右电缆桥之间也能用普通跳跨过。',
  routes: [['dock-left', 'relay-left', 'upper-left', 'coil-left'], ['dock-right', 'relay-right', 'upper-right', 'coil-right']]
}, [
  ['west-stair', '西侧接线台', 1, 140, 590, 91, 'stair'],
  ['west-bank', '西厂配电柜', 2, 456, 940, 214, 'transformer'],
  ['west-feed', '西厂馈电箱', 1, 838, 1385, 120, 'transformer'],
  ['west-coil', '辅助线圈', 3, 752, 1100, 348, 'inductor'],
  ['west-loop', '西厂回路线桥', 2, 1065, 1480, 253, 'conduit'],
  ['dock-left', '左塔变压器', 1, 1425, 1865, 132, 'transformer'],
  ['relay-left', '左电缆桥', 2, 1485, 2040, 263, 'conduit'],
  ['upper-left', '左塔控制室', 3, 1180, 1660, 396, 'control-room'],
  ['coil-left', '西塔线圈冠', 4, 1455, 1848, 529, 'inductor'],
  ['service-lift', '中央升降机', 1, 2056, 2296, 61, 'elevator', { axis: 'y', distance: -465, period: 480, dwell: 52, phase: 0 }],
  ['relay-right', '右电缆桥', 2, 2300, 2890, 263, 'conduit'],
  ['dock-right', '右塔变压器', 1, 2487, 2972, 132, 'transformer'],
  ['upper-right', '右塔控制室', 3, 2680, 3160, 395, 'control-room'],
  ['coil-right', '东塔线圈冠', 4, 2500, 2820, 528, 'inductor'],
  ['east-loop', '东厂回路线桥', 2, 3050, 3525, 245, 'conduit'],
  ['east-feed', '东厂馈电箱', 1, 3210, 3705, 117, 'transformer'],
  ['east-coil', '整流线圈', 3, 3390, 3738, 375, 'inductor'],
  ['east-stair', '东侧接线台', 1, 3656, 4190, 100, 'stair']
]);

const broadcast = stage({
  id: 'broadcast-ring', name: '直播擂台', theme: 'broadcast', width: 4480,
  terrain: '单层地面 · 横向追击',
  description: '擂台地面贯通两侧，双方可以沿场边拉开距离，在中央灯光下交锋。',
  routes: [[], []]
}, []);

export const arenas: ArenaDefinition[] = [dorm, court, harbor, station, broadcast];

import type { ArenaDefinition, Duo, Platform } from '../core/types.js';

const base = { width: 1280, height: 720, left: 82, right: 1198, floor: 594 };
const spawn: Duo<number> = [467, 813];
const artwork = { width: 1672, height: 941 };

type PaintedSurface = [id: string, name: string, tier: Platform['tier'], left: number, right: number, lipY: number];
type ArenaDetails = Pick<ArenaDefinition, 'id' | 'name' | 'theme' | 'terrain' | 'description' | 'route'>;

// The painted lips and collision points are measured in the same source image.
// Reframing the deck band gives the upper tier extra jump clearance below the HUD.
function arena(
  details: ArenaDetails,
  frame: { lipY: number; groundY: number; upperY: number },
  surfaces: PaintedSurface[]
): ArenaDefinition {
  const x = (pixel: number) => Math.round(pixel / artwork.width * base.width);
  const y = (pixel: number) => Math.round(frame.upperY +
    (pixel - frame.lipY) / (frame.groundY - frame.lipY) * (base.floor - frame.upperY));

  return {
    ...base, spawn, ...details,
    artFrame: { sourceTop: frame.lipY / artwork.height, sourceFloor: frame.groundY / artwork.height, worldTop: frame.upperY },
    platforms: surfaces.map(([id, name, tier, left, right, lipY]) =>
      ({ id, name, tier, left: x(left), right: x(right), y: y(lipY) }))
  };
}

export const arenas: ArenaDefinition[] = [
  arena({
    id: 'dorm-roof', name: '宿舍楼顶', theme: 'dorm', terrain: '双侧登台 · 贯通长桥',
    description: '两栋宿舍的花箱阳台接上跨楼连廊，机房屋顶只占中间一段。',
    route: ['west', 'bridge', 'terrace']
  }, { lipY: 410, groundY: 773, upperY: 388 }, [
    ['west', '西侧花箱阳台', 1, 171, 636, 603],
    ['east', '东侧花箱阳台', 1, 1036, 1497, 604],
    ['bridge', '跨楼连廊', 2, 390, 1280, 491],
    ['terrace', '机房屋顶', 3, 677, 995, 410]
  ]),
  arena({
    id: 'night-court', name: '夜训球场', theme: 'court', terrain: '中央起跳 · 两翼分开',
    description: '从中央替补席上东西看台，向内跳进灯牌检修台。两翼之间留空。',
    route: ['bench', 'west-stand', 'score-deck']
  }, { lipY: 501, groundY: 775, upperY: 385 }, [
    ['bench', '中央替补席', 1, 478, 1192, 685],
    ['west-stand', '西翼看台', 2, 211, 688, 567],
    ['east-stand', '东翼看台', 2, 985, 1459, 567],
    ['score-deck', '计分牌检修台', 3, 667, 998, 501]
  ]),
  arena({
    id: 'harbor', name: '余晖货港', theme: 'harbor', terrain: '错位阶梯 · 悬吊货盘',
    description: '踩货柜上栈桥，两侧的中层不同宽。吊车的货盘在两条路线之间。',
    route: ['loading', 'gangway', 'crane']
  }, { lipY: 506, groundY: 789, upperY: 385 }, [
    ['loading', '西侧货柜顶', 1, 177, 692, 675],
    ['east-loading', '东侧货柜顶', 1, 1184, 1490, 667],
    ['gangway', '左侧装卸栈桥', 2, 659, 922, 575],
    ['overpass', '右侧绳栏栈桥', 2, 978, 1345, 577],
    ['crane', '悬吊货盘', 3, 763, 1119, 506]
  ]),
  arena({
    id: 'star-station', name: '星电站', theme: 'station', terrain: '双塔分流 · 中段可跨',
    description: '两座发电塔各有一条三层路线。顶层隔得远，中段电缆桥之间可以跨接。',
    route: ['dock-left', 'relay-left', 'upper-left']
  }, { lipY: 470, groundY: 768, upperY: 387 }, [
    ['dock-left', '左塔检修台', 1, 184, 644, 651],
    ['dock-right', '右塔检修台', 1, 1027, 1484, 651],
    ['relay-left', '左电缆桥', 2, 444, 779, 531],
    ['relay-right', '右电缆桥', 2, 891, 1227, 531],
    ['upper-left', '左塔控制台', 3, 248, 573, 470],
    ['upper-right', '右塔控制台', 3, 1098, 1422, 470]
  ])
];

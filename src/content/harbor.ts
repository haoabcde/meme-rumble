import type { ArenaDefinition, Platform } from '../core/types.js';

const floor = 2024;
function deck(id: string, name: string, tier: Platform['tier'], left: number, right: number,
  rise: number, prop: NonNullable<Platform['prop']>): Platform {
  return { id, name, tier, left, right, y: floor - rise, prop };
}

export const harbor: ArenaDefinition = {
  id: 'harbor', name: '余晖货港', theme: 'harbor', width: 4352, height: 2448, left: 96, right: 4256, floor,
  spawn: [2009, 2355],
  terrain: '贯通栈桥 · 吊盘捷径',
  description: '两翼货柜都通往同一条中层栈桥，可以沿桥横向追击。上方检修廊和横移吊盘提供高位路线。',
  routes: [['loading', 'gangway', 'west-gallery'], ['east-loading', 'gangway', 'east-gallery']],
  artFrame: [],
  platforms: [
    deck('boat-bow', '渡船顶棚', 1, 330, 1185, 116, 'ferry'),
    deck('loading', '西侧货柜顶', 1, 1070, 1872, 128, 'container'),
    deck('gangway', '贯通栈桥', 2, 805, 3547, 256, 'catwalk'),
    deck('west-gallery', '西吊架检修廊', 3, 520, 1515, 386, 'gallery'),
    deck('east-loading', '东侧货柜顶', 1, 2492, 3270, 128, 'trailer'),
    deck('east-gallery', '东吊架检修廊', 3, 2885, 3810, 386, 'gallery'),
    deck('end-boat', '补给船客舱', 1, 3160, 4045, 116, 'ferry'),
    { ...deck('crane', '横移吊盘', 3, 1500, 1850, 384, 'pallet'),
      travel: { distance: 1050, period: 540, dwell: 36, phase: 135 } }
  ]
};

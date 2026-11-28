import type { ArenaDefinition, Platform } from '../core/types.js';

// Preserve the reference stages' platform count and general route topology;
// positions and heights are calibrated to the artwork and double-jump physics.
const width = 4352;
const height = 2448;
const floor = 2024;
const deck = (id: string, name: string, left: number, right: number, rise: number): Platform =>
  ({ id, name, tier: 1, left, right, y: floor - rise, prop: 'shelter' });

// The port art is 2172×724. Collision x is mapped by 4700/2172; y uses
// a uniform 1.3× scale from the painted floor at y=604. The middle step is
// 5 world units lower than the painting to keep the double-jump margin usable.
export const mistStreet: ArenaDefinition = {
  id: 'mist-street', name: '雾港长街', theme: 'court', width: 4700, height: 2644, floor: 2187, left: 96, right: 4604,
  spawn: [2175, 2525], artFrame: [],
  terrain: '三段长台 · 低阶换线',
  description: '三段不等长屋顶覆盖街区，借低台二段跳登高，或沿高处跳跃换线。',
  routes: [['middle-step'], ['middle-step']],
  platforms: [
    { ...deck('west-step', '西街低阶', 162, 483, 30), y: 2035 },
    { ...deck('west-roof', '西街长屋顶', 314, 1889, 105), y: 1779 },
    { ...deck('middle-step', '中街踏台', 1904, 2194, 54), y: 1923 },
    { ...deck('middle-roof', '中街长屋顶', 2192, 3289, 105), y: 1779 },
    { ...deck('east-mid-step', '东中低阶', 3192, 3596, 30), y: 2035 },
    { ...deck('east-roof', '东街屋顶', 3609, 4085, 105), y: 1779 },
    { ...deck('east-step', '东街低阶', 4198, 4577, 30), y: 2035 }
  ]
};

// The street art is 2079×756. x uses 4352/2079, and y is a uniform
// 1.3× mapping relative to its painted y=631 floor.
export const layeredStreet: ArenaDefinition = {
  id: 'layered-street', name: '层叠屋街', theme: 'court', width, height, floor, left: 96, right: width - 96,
  spawn: [1750, 2250], artFrame: [],
  terrain: '九段屋面 · 高低换线',
  description: '九段屋面沿街高低交错，利用起跳和空中移动从一侧追到另一侧。',
  routes: [['west-upper'], ['center-low']],
  platforms: [
    deck('west-roof', '西侧屋面', 167, 795, 187),
    deck('west-rise', '西侧跃台', 789, 1298, 237),
    deck('west-upper', '西中屋面', 1348, 1863, 283),
    deck('center-roof', '中央屋面', 2125, 2476, 304),
    deck('center-east', '东中屋面', 2474, 3100, 241),
    deck('center-low', '东中低台', 2518, 2855, 137),
    deck('east-high', '东侧高屋', 3364, 3881, 341),
    deck('east-low', '东侧低屋', 3345, 3854, 169),
    deck('east-roof', '东侧屋面', 3889, 4256, 237)
  ]
};

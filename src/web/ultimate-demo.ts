import { arenas } from '../content/arenas.js';
import { basicAttack, defineFighter } from '../content/fighter-kit.js';
import { roster } from '../content/roster.js';

const sampleSlot = roster.findIndex(entry => entry.fighter.id === 'whale');
const { fighter, art, accent, height } = roster[sampleSlot];
roster[sampleSlot] = defineFighter({
  id: fighter.id, name: '大招训练体', art, accent, height, signatureMoves: [],
  ultimate: {
    cost: 100,
    move: {
      ...basicAttack, id: 'ultimate-probe', name: '联调大招', startup: 12,
      cancelOnHit: [], animation: [{ frame: 0, cell: 4 }, { frame: 12, cell: 7 }]
    },
    variants: [
      { cost: 200, move: { ...basicAttack, id: 'two-stock-probe', name: '两格消耗样例', direction: 'up', cancelOnHit: [] } },
      { cost: 300, move: { ...basicAttack, id: 'three-stock-probe', name: '三格消耗样例', direction: 'down', cancelOnHit: [] } }
    ]
  }
});
const harbor = arenas.find(arena => arena.id === 'harbor')!;
harbor.spawn = [harbor.spawn[1] - 96, harbor.spawn[1]];
document.title = '大招联调 · Meme 乱斗';
document.querySelector<HTMLSelectElement>('#training-speed')!.value = '.5';

void import('./game.js').then(({ openPractice }) => {
  openPractice(new URLSearchParams({ practice: harbor.id, p1: fighter.id, p2: 'banana' }));
  document.getElementById('debug')!.click();
  document.getElementById('footer-main')!.textContent = '联调样例 · O 消耗一格 · W＋O 消耗两格 · S＋O 消耗三格';
});

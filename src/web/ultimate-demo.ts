import { arenas } from '../content/arenas.js';
import { basicAttack, defineFighter } from '../content/fighter-kit.js';
import { roster } from '../content/roster.js';

const sampleSlot = roster.findIndex(entry => entry.fighter.id === 'whale');
const { fighter, art, accent, height } = roster[sampleSlot];
roster[sampleSlot] = defineFighter({
  id: fighter.id, name: '大招训练体', art, accent, height, signatureMoves: [],
  ultimate: {
    cost: 60,
    move: {
      ...basicAttack, id: 'ultimate-probe', name: '联调大招', startup: 12,
      cancelOnHit: [], animation: [{ frame: 0, cell: 4 }, { frame: 12, cell: 7 }]
    }
  }
});
const harbor = arenas.find(arena => arena.id === 'harbor')!;
harbor.spawn = [harbor.spawn[1] - 96, harbor.spawn[1]];
document.title = '大招联调 · Meme 乱斗';
document.querySelector<HTMLSelectElement>('#training-speed')!.value = '.5';

void import('./game.js').then(({ openPractice }) => {
  openPractice(new URLSearchParams({ practice: harbor.id, p1: fighter.id, p2: 'banana' }));
  document.getElementById('debug')!.click();
});

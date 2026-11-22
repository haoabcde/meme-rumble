import { defineFighter } from '../fighter-kit.js';

export const frog = defineFighter({
  id: 'frog',
  name: '奶蛙',
  accent: '#ffcf54',
  height: 130,
  art: { portrait: 'frog-v2.webp', motion: 'frog-motion.webp' },
  signatureMoves: []
});

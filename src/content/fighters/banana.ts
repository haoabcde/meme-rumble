import { defineFighter } from '../fighter-kit.js';

export const banana = defineFighter({
  id: 'banana',
  name: '香蕉猫',
  accent: '#ff9c62',
  height: 145,
  art: { portrait: 'banana.webp', motion: 'banana-motion.webp' },
  signatureMoves: []
});

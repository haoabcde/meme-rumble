import { defineFighter } from '../fighter-kit.js';

export const whale = defineFighter({
  id: 'whale',
  name: 'DeepSeek 鲸鱼娘',
  accent: '#75a9ff',
  height: 142,
  art: { portrait: 'whale.webp', motion: 'whale-motion.webp' },
  signatureMoves: []
});

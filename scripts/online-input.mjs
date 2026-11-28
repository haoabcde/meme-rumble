const controls = new Set(['A', 'B', 'C', 'ULT', 'jump', 'dash']);
const axis = value => value === -1 || value === 1 ? value : 0;
const limit = 24;

// Keep each accepted key aligned with its original sampled direction, including repeats.
export function packetInput(packet) {
  const pressed = [];
  const sampled = [];
  if (Array.isArray(packet.pressed)) {
    for (const [index, key] of packet.pressed.entries()) {
      if (!controls.has(key)) continue;
      const stick = Array.isArray(packet.sampled) ? packet.sampled[index] : packet.sampled?.[key];
      pressed.push(key);
      sampled.push({ x: axis(stick?.x ?? packet.x), y: axis(stick?.y ?? packet.y) });
      if (pressed.length === limit) break;
    }
  }
  const held = Array.isArray(packet.held) ? [...new Set(packet.held.filter(key => controls.has(key)))] : [];
  return { x: axis(packet.x), y: axis(packet.y), pressed, held, sampled };
}

export function mergeInput(previous, next) {
  const priorSamples = previous.sampled ?? [];
  const remaining = Math.max(0, limit - previous.pressed.length);
  return { ...next, pressed: [...previous.pressed, ...next.pressed.slice(0, remaining)],
    sampled: [...priorSamples, ...next.sampled.slice(0, remaining)] };
}

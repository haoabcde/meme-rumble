import assert from 'node:assert/strict';
import test from 'node:test';
import { bindingMap, loadPreferences } from '../dist/web/settings.js';

test('new players get the requested keyboard layout with developer mode off', t => {
  const previous = globalThis.localStorage;
  globalThis.localStorage = { getItem: () => null };
  t.after(() => { if (previous) globalThis.localStorage = previous; else delete globalThis.localStorage; });
  const preferences = loadPreferences();
  const keys = bindingMap(preferences);
  assert.equal(preferences.developerMode, false);
  for (const [code, seat, control] of [
    ['KeyJ', 0, 'A'], ['KeyK', 0, 'jump'], ['KeyL', 0, 'dash'], ['KeyU', 0, 'B'], ['KeyI', 0, 'C'], ['KeyO', 0, 'ULT'],
    ['Numpad1', 1, 'A'], ['Numpad2', 1, 'jump'], ['Numpad3', 1, 'dash'], ['Numpad4', 1, 'B'], ['Numpad5', 1, 'C'], ['Numpad6', 1, 'ULT']
  ]) assert.deepEqual(keys.get(code), { seat, control });
});

test('previously saved player bindings stay intact and the new mode defaults off', t => {
  const previous = globalThis.localStorage;
  const saved = { bindings: [
    { left:'KeyA', right:'KeyD', up:'KeyW', down:'KeyS', jump:'KeyK', dash:'KeyL', A:'KeyJ', B:'KeyU', C:'KeyI', ULT:'KeyO' },
    { left:'ArrowLeft', right:'ArrowRight', up:'ArrowUp', down:'ArrowDown', jump:'ShiftRight', dash:'Enter', A:'Comma', B:'Period', C:'Slash', ULT:'Quote' }
  ] };
  globalThis.localStorage = { getItem: () => JSON.stringify(saved) };
  t.after(() => { if (previous) globalThis.localStorage = previous; else delete globalThis.localStorage; });
  const preferences = loadPreferences();
  assert.deepEqual(preferences.bindings, saved.bindings);
  assert.equal(preferences.developerMode, false);
});

const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const buttons = Array.from({ length: 17 }, () => ({ pressed: false }));
const pad = { connected: true, buttons, axes: [0, 0] };
let now = 100, frame, listener, keydown;
const window = { addEventListener(type, cb) { if (type === 'keydown') keydown = cb; } };
const ctx = { window, navigator: { getGamepads: () => [pad] },
  performance: { now: () => now }, requestAnimationFrame(cb) { frame = cb; return 1; },
  console, localStorage: {} };
vm.runInNewContext(fs.readFileSync('webroot/input.js', 'utf8'), ctx);
const events = [];
window.RVInput.onAction(x => events.push(x));
function tick(ms = 20) { now += ms; frame(); }
buttons[9].pressed = true; tick(); tick(400);
assert.deepEqual(events, [], 'START não deve disparar antes de saber se haverá combo');
buttons[9].pressed = false; tick();
assert.deepEqual(events, ['start'], 'START solo abre menu ao soltar');
buttons[8].pressed = true; tick(); buttons[8].pressed = false; tick();
assert.deepEqual(events, ['start', 'select']);
buttons[8].pressed = buttons[9].pressed = true; tick(); tick(750);
assert.deepEqual(events, ['start', 'select', 'home']);
tick(1000);
assert.equal(events.filter(e => e === 'home').length, 1, 'combo não pode repetir enquanto segurado');
buttons[8].pressed = buttons[9].pressed = false; tick();
assert.equal(events.filter(e => e === 'start').length, 1, 'combo não pode emitir START ao soltar');
keydown({ key: 'p', preventDefault() {} });
assert.equal(events.at(-1), 'start', 'atalho de teclado mantém compatibilidade');
// O analógico deve mover um card por toque, não disparar 60 direções por segundo.
const start = events.length;
pad.axes[0] = .9; tick();
assert.deepEqual(events.slice(start), ['right']);
for (let i = 0; i < 10; i++) tick(20);
assert.deepEqual(events.slice(start), ['right'], 'analógico repetiu antes do atraso');
tick(400);
assert.deepEqual(events.slice(start), ['right','right'], 'analógico não repete ao segurar');
pad.axes[0] = 0; tick(); pad.axes[0] = -.9; tick();
assert.equal(events.at(-1), 'left', 'analógico não reiniciou ao inverter direção');
console.log('Controle físico: START, SELECT, combo, analógico e teclado OK');

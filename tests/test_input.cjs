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
console.log('Controle físico: START, SELECT, combo e teclado OK');

/* ═══════════════════════════════════════════════════════════════════
   RetroVault OS — camada de entrada
   Lê GAMEPAD físico (Gamepad API) e TECLADO (para testes/dev),
   normaliza em ações: up/down/left/right/a/b/x/y/l/r/start/select/home
   e despacha para o ouvinte registrado (shell).
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const REPEAT_DELAY = 380;  // ms até começar a repetir
  const REPEAT_RATE  = 120;  // ms entre repetições
  const AXIS_DEAD    = 0.55;

  // Botões W3C standard mapping
  const BTN = { A: 0, B: 1, X: 2, Y: 3, L: 4, R: 5, L2: 6, R2: 7,
                SELECT: 8, START: 9, L3: 10, R3: 11,
                UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15, HOME: 16 };

  const ACTION_OF_BTN = {};
  ACTION_OF_BTN[BTN.A] = 'a';       ACTION_OF_BTN[BTN.B] = 'b';
  ACTION_OF_BTN[BTN.X] = 'x';       ACTION_OF_BTN[BTN.Y] = 'y';
  ACTION_OF_BTN[BTN.L] = 'l';       ACTION_OF_BTN[BTN.R] = 'r';
  ACTION_OF_BTN[BTN.SELECT] = 'select'; ACTION_OF_BTN[BTN.START] = 'start';
  ACTION_OF_BTN[BTN.HOME] = 'home';
  ACTION_OF_BTN[BTN.UP] = 'up';     ACTION_OF_BTN[BTN.DOWN] = 'down';
  ACTION_OF_BTN[BTN.LEFT] = 'left'; ACTION_OF_BTN[BTN.RIGHT] = 'right';

  // Teclado = controle de desenvolvimento (setas + Enter/Esc…)
  const KEYMAP = {
    ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
    Enter: 'a', ' ': 'a', Escape: 'b', Backspace: 'b',
    f: 'x', F: 'x', x: 'x', X: 'x', y: 'y', Y: 'y',
    q: 'l', Q: 'l', e: 'r', E: 'r', PageUp: 'l', PageDown: 'r',
    p: 'start', P: 'start', s: 'select', S: 'select', h: 'home', H: 'home',
  };

  let listener = null;             // função(action) da shell
  let padState = {};               // índice do botão → {t0, last}
  let axisState = { x: 0, y: 0 };  // direção atual do analógico
  let comboStart = 0;              // combo START+SELECT
  let enabled = true;

  function emit(action) {
    if (!enabled || !listener) return;
    try { listener(action); } catch (e) { console.error('[input]', e); }
  }

  /* ── Gamepad (polling em rAF — necessário pra repetir direções) ── */
  let rafId = null;
  function poll() {
    rafId = requestAnimationFrame(poll);
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    let gp = null;
    for (const p of pads) if (p && p.connected) { gp = p; break; }
    const now = performance.now();

    // Combo START+SELECT (segurar 700ms) → ação "home" (menu de energia)
    if (gp) {
      const st = gp.buttons[BTN.START] && gp.buttons[BTN.START].pressed;
      const se = gp.buttons[BTN.SELECT] && gp.buttons[BTN.SELECT].pressed;
      if (st && se) {
        if (!comboStart) comboStart = now;
        else if (now - comboStart > 700) { comboStart = -1; emit('home'); }
      } else if (comboStart && comboStart > 0) {
        // soltou antes: trata como START normal
        comboStart = 0; emit('start');
      } else { comboStart = 0; }
    }

    // Botões digitais com auto-repeat
    for (const bi in ACTION_OF_BTN) {
      const pressed = gp ? (gp.buttons[bi] && gp.buttons[bi].pressed) : false;
      const st = padState[bi];
      if (pressed && !st) {
        padState[bi] = { t0: now, last: now };
        if (bi == BTN.SELECT || bi == BTN.START) continue; // vão pelo combo
        emit(ACTION_OF_BTN[bi]);
      } else if (pressed && st) {
        const act = ACTION_OF_BTN[bi];
        if (/^(up|down|left|right|l|r)$/.test(act) && now - st.t0 > REPEAT_DELAY && now - st.last > REPEAT_RATE) {
          st.last = now; emit(act);
        }
      } else if (!pressed && st) {
        if (bi == BTN.SELECT) delete padState[bi]; else delete padState[bi];
      }
    }

    // Analógico esquerdo → direções
    if (gp && gp.axes.length >= 2) {
      const ax = Math.abs(gp.axes[0]) > AXIS_DEAD ? Math.sign(gp.axes[0]) : 0;
      const ay = Math.abs(gp.axes[1]) > AXIS_DEAD ? Math.sign(gp.axes[1]) : 0;
      handleAxis('x', ax === -1 ? 'left' : ax === 1 ? 'right' : null, now);
      handleAxis('y', ay === -1 ? 'up'   : ay === 1 ? 'down'  : null, now);
    }
  }

  function handleAxis(k, dir, now) {
    const prev = axisState[k];
    if (dir && dir !== prev) { axisState[k] = { dir, t0: now, last: now }; emit(dir); }
    else if (dir && prev && now - prev.t0 > REPEAT_DELAY && now - prev.last > REPEAT_RATE) { prev.last = now; emit(dir); }
    else if (!dir) axisState[k] = 0;
  }

  /* ── Teclado (modo desenvolvimento) ── */
  const keyHeld = {};
  window.addEventListener('keydown', (ev) => {
    const act = KEYMAP[ev.key];
    if (!act) return;
    ev.preventDefault();
    if (keyHeld[ev.key] && !/^(up|down|left|right)$/.test(act)) return; // sem repeat p/ botões
    keyHeld[ev.key] = true;
    emit(act);
  });
  window.addEventListener('keyup', (ev) => { delete keyHeld[ev.key]; });

  window.RVInput = {
    onAction(cb) { listener = cb; if (!rafId) poll(); },
    setEnabled(v) { enabled = v; },
    /** lê o estado bruto de um botão (usado p/ combos fora da shell, ex.: sair do jogo) */
    rawButtons() {
      const pads = navigator.getGamepads ? navigator.getGamepads() : [];
      for (const p of pads) if (p && p.connected) return p.buttons.map(b => b.pressed);
      return null;
    },
  };
})();

/* ═══════════════════════════════════════════════════════════════════
   RetroVault OS — saída do jogo (player.html)
   SEMPRE ativo no OS: segurar START+SELECT por ~0,8s (ou o botão
   GUIDE/HOME) encerra a sessão e volta à shell (/).
   A navegação roda no próprio documento do player — sem iframe,
   então o gamepad funciona nativamente nos emuladores.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const BTN = { SELECT: 8, START: 9, HOME: 16 };
  const HOLD_MS = 800;
  let comboT = 0, fired = false;

  function back() {
    if (fired) return; fired = true;
    const veil = document.createElement('div');
    veil.style.cssText = 'position:fixed;inset:0;z-index:99999;background:#07060d;display:flex;align-items:center;justify-content:center;' +
      'color:#9a92c4;font:600 15px/1.4 system-ui;letter-spacing:.2em;text-transform:uppercase;opacity:0;transition:opacity .25s ease';
    veil.textContent = 'Voltando à shell…';
    document.body.appendChild(veil);
    requestAnimationFrame(() => { veil.style.opacity = '1'; });
    setTimeout(() => { window.location.href = '/'; }, 320);
  }

  function poll() {
    requestAnimationFrame(poll);
    if (fired || !navigator.getGamepads) return;
    const pads = navigator.getGamepads();
    for (const gp of pads) {
      if (!gp || !gp.connected) continue;
      const st = gp.buttons[BTN.START] && gp.buttons[BTN.START].pressed;
      const se = gp.buttons[BTN.SELECT] && gp.buttons[BTN.SELECT].pressed;
      const hm = gp.buttons[BTN.HOME] && gp.buttons[BTN.HOME].pressed;
      if (hm) return back();
      if (st && se) {
        if (!comboT) comboT = performance.now();
        else if (performance.now() - comboT > HOLD_MS) return back();
      } else comboT = 0;
    }
  }
  requestAnimationFrame(poll);

  // Teclado (dev): segurar ESC por 1s também volta à shell
  let escT = 0;
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !escT) escT = setTimeout(back, 1000); });
  window.addEventListener('keyup', (e) => { if (e.key === 'Escape') { clearTimeout(escT); escT = 0; } });
})();

/* Menu do jogo do RetroVault OS. START+SELECT (800 ms) abre o menu;
   HOME/GUIDE volta à shell. Controlável por D-pad/A/B ou teclado. */
(function () {
  'use strict';
  const BTN = { A: 0, B: 1, SELECT: 8, START: 9, UP: 12, DOWN: 13, HOME: 16 };
  const HOLD_MS = 800;
  let comboT = 0, comboFired = false, leaving = false;
  let menu = null, selected = 0, frozen = false, busy = false;
  let previous = { up: false, down: false, a: false, b: false, home: false };
  const items = [
    { label: 'Continuar jogando', action: 'continue' },
    { label: 'Salvar estado', action: 'save' },
    { label: 'Carregar save', action: 'load' },
    { label: 'Retomar checkpoint', action: 'resume' },
    { label: 'Sair para a biblioteca', action: 'exit' }
  ];
  const styles = document.createElement('style');
  styles.textContent = `
    #rv-os-menu { position:fixed;inset:0;z-index:10001;background:rgba(0,8,4,.92);
      display:flex;align-items:center;justify-content:center;padding:12px;font-family:Rajdhani,system-ui,sans-serif;color:#fff }
    #rv-os-menu .panel {width:min(460px,96vw);max-height:96vh;overflow:auto;background:#07110a;border:1px solid #24753a;
      padding:16px;border-radius:16px;box-shadow:0 18px 55px #000}
    #rv-os-menu h2 {font:700 clamp(17px,3vw,24px) Orbitron,system-ui;color:#00ff41;margin:0 0 9px}
    #rv-os-menu p {font-size:15px;color:#c9d6cd;margin:0 0 10px}
    #rv-os-menu button {display:flex;align-items:center;gap:12px;width:100%;text-align:left;min-height:42px;padding:8px 12px;margin:5px 0;
      border:1px solid #304a38;border-radius:9px;background:#0c1910;color:white;font:700 17px Rajdhani,system-ui}
    #rv-os-menu button .rv-icon {width:22px;height:22px;color:#00ff41}
    #rv-os-menu button[data-action=exit] .rv-icon {color:#ff7474}
    #rv-os-menu h2 .rv-icon {width:25px;height:25px;vertical-align:-5px;margin-right:6px}
    #rv-os-menu button.selected,#rv-os-menu button:focus-visible {border-color:#00ff41;outline:2px solid #00ff41;background:#164926}
    #rv-os-menu .message {min-height:22px;color:#ffd58a;font-size:14px}
    #rv-os-menu .hint {font-size:13px;color:#9dae9c;margin-top:9px}
    @media (max-height:380px) {
      #rv-os-menu .panel {padding:9px 13px}
      #rv-os-menu h2 {font-size:17px;margin-bottom:2px}
      #rv-os-menu p {font-size:12px;margin-bottom:5px}
      #rv-os-menu button {min-height:32px;padding:3px 10px;margin:3px 0;font-size:15px}
      #rv-os-menu button .rv-icon {width:17px;height:17px}
      #rv-os-menu .hint {font-size:11px;margin-top:4px}
    }`;
  document.head.appendChild(styles);

  function message(text) { const el = menu && menu.querySelector('.message'); if (el) el.textContent = text; }
  function focus(i) {
    if (!menu) return;
    const buttons = menu.querySelectorAll('button[data-action]');
    selected = (i + buttons.length) % buttons.length;
    buttons.forEach((b, index) => b.classList.toggle('selected', selected === index));
    buttons[selected].focus({ preventScroll: true });
  }
  function open() {
    if (menu || leaving) return;
    const existing = document.getElementById('rv-resume');
    if (existing) existing.style.display = 'none';
    frozen = typeof rvFreezeCore === 'function' && rvFreezeCore();
    menu = document.createElement('div'); menu.id = 'rv-os-menu';
    const panel = document.createElement('div'); panel.className = 'panel';
    const title = document.createElement('h2'); title.innerHTML = RVIcons.render('system') + ' Menu do jogo'; panel.appendChild(title);
    const name = document.createElement('p');
    name.textContent = typeof rvGameLabel === 'function' ? rvGameLabel() : 'RetroVault OS'; panel.appendChild(name);
    items.forEach(({ label, action }, index) => {
      const btn = document.createElement('button'); btn.type = 'button'; btn.dataset.action = action;
      const glyphs = { continue: 'gamepad', save: 'save', load: 'load', resume: 'reboot', exit: 'exit' };
      btn.innerHTML = RVIcons.render(glyphs[action]) + '<span>' + label + '</span>';
      btn.addEventListener('click', () => { focus(index); execute(action); });
      panel.appendChild(btn);
    });
    const msg = document.createElement('p'); msg.className = 'message'; msg.setAttribute('role', 'status'); panel.appendChild(msg);
    const hint = document.createElement('p'); hint.className = 'hint'; hint.textContent = 'D-pad para escolher · A confirmar · B voltar'; panel.appendChild(hint);
    menu.appendChild(panel); document.body.appendChild(menu); focus(0);
  }
  function close() {
    if (!menu || busy) return;
    menu.remove(); menu = null;
    const existing = document.getElementById('rv-resume'); if (existing) existing.style.display = '';
    if (frozen && typeof rvUnfreezeCore === 'function') rvUnfreezeCore();
    frozen = false;
  }
  async function back() {
    if (leaving) return;
    leaving = true;
    if (menu) { menu.remove(); menu = null; }
    const veil = document.createElement('div');
    veil.style.cssText = 'position:fixed;inset:0;z-index:99999;background:#020503;display:flex;align-items:center;justify-content:center;color:#00ff41;font:700 16px Rajdhani,system-ui';
    veil.textContent = 'Salvando progresso e voltando à biblioteca…';
    document.body.appendChild(veil);
    try {
      if (typeof window.__rvAutoCapture === 'function') {
        await Promise.race([Promise.resolve(window.__rvAutoCapture()), new Promise(resolve => setTimeout(resolve, 2000))]);
      }
    } catch (e) { console.warn('[RetroVault OS] checkpoint não gravado', e); }
    window.location.href = '/';
  }
  async function execute(action) {
    if (busy || !menu) return;
    if (action === 'continue') return close();
    if (action === 'exit') return back();
    busy = true;
    message('Aguarde…');
    try {
      if (action === 'save') {
        if (typeof rvSaveNow !== 'function' || await rvSaveNow() === false) throw new Error('Este núcleo não salvou o estado.');
        message('Estado salvo neste aparelho.');
      } else if (action === 'load') {
        if (typeof rvLoadNow !== 'function' || await rvLoadNow() === false) throw new Error('Não há save para carregar.');
        message('Save carregado.');
      } else if (action === 'resume') {
        if (typeof window.__rvResumeAuto !== 'function' || await window.__rvResumeAuto() === false) throw new Error('Nenhum checkpoint disponível.');
        const prompt = document.getElementById('rv-resume'); if (prompt) prompt.remove();
        message('Checkpoint retomado.');
      }
    } catch (e) { message(e.message || 'Não foi possível completar a ação.'); }
    finally {
      if (frozen && typeof rvFreezeCore === 'function') rvFreezeCore();
      busy = false;
    }
  }
  function button(gp, idx) { return !!(gp && gp.buttons[idx] && gp.buttons[idx].pressed); }
  function poll() {
    requestAnimationFrame(poll);
    if (leaving || !navigator.getGamepads) return;
    const gp = Array.from(navigator.getGamepads()).find(p => p && p.connected);
    const st = button(gp, BTN.START), se = button(gp, BTN.SELECT);
    if (st && se) {
      if (!comboT) comboT = performance.now();
      if (!comboFired && performance.now() - comboT >= HOLD_MS) { comboFired = true; if (menu) close(); else open(); }
    } else if (!st && !se) { comboT = 0; comboFired = false; }
    const curr = { up: button(gp, BTN.UP) || (gp && gp.axes[1] < -.65),
      down: button(gp, BTN.DOWN) || (gp && gp.axes[1] > .65),
      a: button(gp, BTN.A), b: button(gp, BTN.B), home: button(gp, BTN.HOME) };
    if (curr.home && !previous.home) back();
    if (menu && !busy) {
      if (curr.up && !previous.up) focus(selected - 1);
      if (curr.down && !previous.down) focus(selected + 1);
      if (curr.a && !previous.a) execute(items[selected].action);
      if (curr.b && !previous.b) close();
    }
    previous = curr;
  }
  requestAnimationFrame(poll);
  let escT = 0;
  window.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !menu && !escT) escT = setTimeout(back, 1000);
    if (!menu) return;
    if (['ArrowUp','ArrowDown','Enter',' ','Escape','Backspace'].includes(e.key)) e.preventDefault();
    if (e.repeat || busy) return;
    if (e.key === 'ArrowUp') focus(selected - 1);
    if (e.key === 'ArrowDown') focus(selected + 1);
    if (e.key === 'Enter' || e.key === ' ') execute(items[selected].action);
    if (e.key === 'Escape' || e.key === 'Backspace') close();
  }, true);
  window.addEventListener('keyup', e => { if (e.key === 'Escape') { clearTimeout(escT); escT = 0; } });
  window.RVOSMenu = { open, close };
})();

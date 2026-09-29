/* RetroVault — controle em páginas externas abertas pela shell.
   Sem servidor remoto: cursor, cliques e teclado virtuais operam somente na aba
   registrada pela shell. Sites podem rejeitar eventos sintéticos; DRM é separado. */
(() => {
  'use strict';
  if (window.top !== window) return;
  const host = location.hostname;
  const localShell = host === 'localhost' || host === '127.0.0.1' || host.endsWith('.e2b.app');
  if (localShell && document.querySelector('#app #screen') && document.querySelector('.sb-brand')) {
    chrome.runtime.sendMessage({ type: 'registerShell' }, () => { void chrome.runtime.lastError; });
    return;
  }
  if (location.protocol !== 'https:') return;
  chrome.runtime.sendMessage({ type: 'getHome' }, response => {
    if (chrome.runtime.lastError || !response?.home) return;
    try {
      const home = new URL(response.home);
      if (!(home.hostname === 'localhost' || home.hostname === '127.0.0.1' || home.hostname.endsWith('.e2b.app'))) return;
      createController(home.href);
    } catch (e) { /* sem uma shell conhecida, não alterar outros sites */ }
  });

  function createController(home) {
    const svg = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4m7 4 5 5-5 5M21 12H9"/></svg>';
    const hud = document.createElement('div');
    hud.id = 'rvos-pad-hud';
    hud.innerHTML = `<button type="button" data-rv-return>${svg}<span>Menu · START+SELECT</span></button><button type="button" data-rv-keyboard>⌨<span>Teclado · X</span></button><small>Analógico/D-pad: cursor · A: clicar · B: voltar · Y: rolar</small>`;
    const cursor = document.createElement('div'); cursor.id = 'rvos-pad-cursor'; cursor.hidden = true;
    const keyboard = document.createElement('div'); keyboard.id = 'rvos-pad-keyboard'; keyboard.hidden = true;
    (document.body || document.documentElement).append(hud, cursor, keyboard);
    const returnHome = () => location.assign(home);
    hud.querySelector('[data-rv-return]').addEventListener('click', returnHome);
    const keyboardButton = hud.querySelector('[data-rv-keyboard]');
    keyboardButton.addEventListener('pointerdown', event => event.preventDefault()); // mantém o input ativo
    keyboardButton.addEventListener('click', () => toggleKeyboard());

    const rows = ['1234567890'.split(''), 'qwertyuiop'.split(''), 'asdfghjkl'.split(''), 'zxcvbnm.-_@'.split(''),
      '!#$%&*+?/:;='.split(''), ['(',')','[',']','{','}','\"',"'",'\\\\','^','~'],
      ['⇧','espaço','←','Enter','Fechar']];
    let target = null, keyboardOpen = false, shift = false, row = 0, col = 0;
    let x = innerWidth / 2, y = innerHeight / 2, comboSince = 0, comboDone = false;
    let lastFrame = performance.now(), lastMove = 0, previousButtons = [];
    const padPressed = (pad, i) => !!pad.buttons?.[i]?.pressed;
    const canType = el => el && (el instanceof HTMLTextAreaElement ||
      (el instanceof HTMLInputElement && !['button','checkbox','radio','submit','reset','file','hidden','range','color','date'].includes(el.type)) ||
      el.isContentEditable);
    const highlight = () => {
      keyboard.querySelectorAll('[data-rv-key]').forEach(el => el.classList.toggle('selected', +el.dataset.row === row && +el.dataset.col === col));
      const current = keyboard.querySelector(`[data-row="${row}"][data-col="${col}"]`);
      current?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    };
    const renderKeyboard = () => {
      keyboard.innerHTML = '<div class="rvos-keyboard-head">TECLADO · A escolhe · Y maiúsculas · X apaga · B fecha</div>';
      rows.forEach((keys, r) => {
        const line = document.createElement('div'); line.className = 'rvos-keyboard-row';
        keys.forEach((key, c) => {
          const btn = document.createElement('button'); btn.type = 'button'; btn.dataset.rvKey = key;
          btn.dataset.row = r; btn.dataset.col = c;
          btn.textContent = key === 'espaço' ? 'ESPAÇO' : shift && key.length === 1 ? key.toUpperCase() : key;
          if (key === 'espaço') btn.className = 'wide';
          btn.addEventListener('pointerdown', event => event.preventDefault()); // preserva foco no input
          btn.addEventListener('click', () => { row = r; col = c; typeKey(key); });
          line.appendChild(btn);
        });
        keyboard.appendChild(line);
      });
      highlight();
    };
    const openKeyboard = el => {
      if (canType(el)) target = el;
      if (!canType(target) || !target.isConnected) {
        hud.querySelector('small').textContent = 'Selecione primeiro um campo de texto com A.';
        return;
      }
      keyboardOpen = true; keyboard.hidden = false; cursor.hidden = true;
      renderKeyboard();
    };
    const closeKeyboard = () => {
      keyboardOpen = false; keyboard.hidden = true;
      target?.dispatchEvent(new Event('change', { bubbles: true }));
      if (previousButtons.length) cursor.hidden = false;
    };
    const toggleKeyboard = () => keyboardOpen ? closeKeyboard() : openKeyboard(document.activeElement);
    const editInput = (text, backspace) => {
      if (!canType(target) || !target.isConnected) return closeKeyboard();
      target.focus();
      if (target.isContentEditable) {
        if (backspace) document.execCommand('delete');
        else document.execCommand('insertText', false, text);
        target.dispatchEvent(new InputEvent('input', { bubbles: true, data: text, inputType: backspace ? 'deleteContentBackward' : 'insertText' }));
        return;
      }
      const start = target.selectionStart ?? target.value.length;
      const end = target.selectionEnd ?? target.value.length;
      const from = backspace && start === end ? Math.max(0, start - 1) : start;
      const value = target.value.slice(0, from) + (backspace ? '' : text) + target.value.slice(end);
      const prototype = target instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(prototype, 'value').set.call(target, value);
      try { target.setSelectionRange(from + (backspace ? 0 : text.length), from + (backspace ? 0 : text.length)); }
      catch (e) { /* type=email/number não oferece seleção de texto */ }
      target.dispatchEvent(new InputEvent('input', { bubbles: true, data: text, inputType: backspace ? 'deleteContentBackward' : 'insertText' }));
    };
    const typeKey = key => {
      if (key === 'Fechar') return closeKeyboard();
      if (key === '⇧') { shift = !shift; renderKeyboard(); return; }
      if (key === '←') { editInput('', true); return; }
      if (key === 'Enter') {
        target?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        closeKeyboard(); return;
      }
      editInput(key === 'espaço' ? ' ' : shift ? key.toUpperCase() : key, false);
    };
    const clickAtCursor = () => {
      const element = document.elementFromPoint(x, y);
      if (!element || element === cursor) return;
      const clickable = element.closest('button,a,input,textarea,[role="button"],[role="link"],[contenteditable="true"]') || element;
      clickable.focus?.();
      const eventOptions = { bubbles: true, cancelable: true, clientX: x, clientY: y, pointerId: 1, pointerType: 'mouse' };
      if (typeof PointerEvent !== 'undefined') {
        clickable.dispatchEvent(new PointerEvent('pointerdown', eventOptions));
        clickable.dispatchEvent(new PointerEvent('pointerup', eventOptions));
      }
      clickable.dispatchEvent(new MouseEvent('mousedown', eventOptions));
      clickable.dispatchEvent(new MouseEvent('mouseup', eventOptions));
      clickable.click?.();
      const field = canType(document.activeElement) ? document.activeElement : canType(clickable) ? clickable : null;
      if (field) openKeyboard(field);
    };
    const moveKeyboard = (dx, dy) => {
      row = Math.max(0, Math.min(rows.length - 1, row + dy));
      col = Math.max(0, Math.min(rows[row].length - 1, col + dx));
      highlight();
    };
    function frame(now) {
      const dt = Math.min(50, now - lastFrame); lastFrame = now;
      const pads = navigator.getGamepads ? Array.from(navigator.getGamepads() || []) : [];
      const pad = pads.find(p => p && p.connected !== false && p.buttons?.length >= 10);
      if (pad) {
        const pressed = i => padPressed(pad, i);
        const just = i => pressed(i) && !previousButtons[i];
        const combo = pressed(8) && pressed(9);
        if (combo) {
          if (!comboSince) comboSince = now;
          if (!comboDone && now - comboSince >= 800) { comboDone = true; returnHome(); }
        } else { comboSince = 0; comboDone = false; }
        if (!combo) {
          if (keyboardOpen) {
            if (just(0)) typeKey(rows[row][col]);
            if (just(1)) closeKeyboard();
            if (just(2)) editInput('', true);
            if (just(3)) { shift = !shift; renderKeyboard(); }
            const dx = (pressed(15) || pad.axes?.[0] > .65 ? 1 : 0) - (pressed(14) || pad.axes?.[0] < -.65 ? 1 : 0);
            const dy = (pressed(13) || pad.axes?.[1] > .65 ? 1 : 0) - (pressed(12) || pad.axes?.[1] < -.65 ? 1 : 0);
            if ((dx || dy) && now - lastMove >= 175) { moveKeyboard(dx, dy); lastMove = now; }
          } else {
            if (just(0)) clickAtCursor();
            if (just(1)) history.back();
            if (just(2)) toggleKeyboard();
            if (just(3)) scrollBy({ top: innerHeight * .55, behavior: 'smooth' });
            const axisX = Math.abs(pad.axes?.[0] || 0) > .19 ? pad.axes[0] : 0;
            const axisY = Math.abs(pad.axes?.[1] || 0) > .19 ? pad.axes[1] : 0;
            const mx = axisX + (pressed(15) ? 1 : 0) - (pressed(14) ? 1 : 0);
            const my = axisY + (pressed(13) ? 1 : 0) - (pressed(12) ? 1 : 0);
            x = Math.max(8, Math.min(innerWidth - 8, x + mx * dt * .55));
            y = Math.max(8, Math.min(innerHeight - 8, y + my * dt * .55));
            if (Math.abs(pad.axes?.[3] || 0) > .25) scrollBy(0, pad.axes[3] * dt * .55);
            cursor.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
            cursor.hidden = false;
          }
        }
        previousButtons = pad.buttons.map(b => !!b.pressed);
      } else { previousButtons = []; cursor.hidden = true; comboSince = 0; }
      requestAnimationFrame(frame);
    }
    addEventListener('resize', () => { x = Math.min(x, innerWidth - 8); y = Math.min(y, innerHeight - 8); });
    requestAnimationFrame(frame);
  }
})();

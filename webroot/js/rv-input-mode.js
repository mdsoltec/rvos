/* ═══════════════════════════════════════════════════════════
   RETROVAULT WEB — MODO DE ENTRADA        (js/rv-input-mode.js)
   ───────────────────────────────────────────────────────────
   Decide, sozinho, se o controle virtual na tela deve existir.

   Regra (modo "auto", o padrão):
     • PC / notebook (ponteiro fino, mouse+teclado) ......... NÃO mostra
     • Qualquer aparelho com CONTROLE FÍSICO conectado ...... NÃO mostra
     • Celular/tablet sem controle .......................... mostra
     • Controle desconectou no celular ...................... volta a mostrar

   Detalhe importante: por segurança, o navegador só revela um gamepad
   depois que ele "fala" (evento gamepadconnected ou um botão apertado).
   Por isso, além do evento, fazemos uma varredura leve nos primeiros
   segundos e continuamos ouvindo conexões/desconexões o tempo todo.

   Preferência do jogador (Perfil → Controle na tela):
     'auto' (padrão) | 'on' (sempre mostrar) | 'off' (nunca mostrar)
   Também aceita ?pad=auto|on|off na URL, para teste rápido.
   ═══════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';

  var PREF_KEY = 'rv_pad_mode';
  var listeners = [];
  var lastDecision = null;
  var gamepadSeen = false;
  var gamepadLabel = '';

  function store() { return global.RVStore || localStorage; }

  function urlOverride() {
    var m = /[?&]pad=(auto|on|off|1|0)/i.exec(global.location.search || '');
    if (!m) return null;
    var v = m[1].toLowerCase();
    if (v === '1') return 'on';
    if (v === '0') return 'off';
    return v;
  }

  function mode() {
    var forced = urlOverride();
    if (forced) return forced;
    var v;
    try { v = store().getItem(PREF_KEY); } catch (e) { v = null; }
    try { v = v ? (JSON.parse(v)) : v; } catch (e) { /* valor salvo como texto puro */ }
    return (v === 'on' || v === 'off') ? v : 'auto';
  }

  function setMode(v) {
    if (['auto', 'on', 'off'].indexOf(v) === -1) v = 'auto';
    try { store().setItem(PREF_KEY, JSON.stringify(v)); } catch (e) { }
    evaluate(true);
    return v;
  }

  /* ── É um aparelho de toque de verdade? ──
     maxTouchPoints sozinho mente: notebook com tela sensível ao toque
     também reporta toque, e o Chrome de desktop chega a expor
     'ontouchstart'. A decisão segue uma ordem de sinais confiáveis:

       1. o navegador se declara mobile              → toque
       2. o ponteiro PRINCIPAL é grosso (dedo)       → toque
       3. existe algum ponteiro fino (mouse/trackpad)→ NÃO é toque
       4. sem informação de ponteiro: cai no toque bruto             */
  function isTouchDevice() {
    var uaMobile = !!(navigator.userAgentData && navigator.userAgentData.mobile) ||
      /Android|iPhone|iPad|iPod|IEMobile|Mobile Safari|Silk|Kindle/i.test(navigator.userAgent || '');
    if (uaMobile) return true;

    var primaryCoarse = false, anyFine = false;
    try {
      primaryCoarse = matchMedia('(pointer: coarse)').matches;
      anyFine = matchMedia('(any-pointer: fine)').matches;
    } catch (e) { /* navegador sem matchMedia: usa o toque bruto abaixo */ }

    if (primaryCoarse) return true;   // celular/tablet
    if (anyFine) return false;        // PC, notebook (mesmo com tela touch)

    return ('ontouchstart' in global) || navigator.maxTouchPoints > 0;
  }

  /* ── Há controle físico conectado? ── */
  function scanGamepads() {
    var pads = [];
    try { pads = navigator.getGamepads ? navigator.getGamepads() : []; } catch (e) { return false; }
    for (var i = 0; i < pads.length; i++) {
      var p = pads[i];
      if (p && p.connected !== false && p.id) { gamepadLabel = p.id; return true; }
    }
    return false;
  }
  function hasGamepad() { gamepadSeen = scanGamepads(); return gamepadSeen; }

  function shouldShowVirtualPad() {
    var m = mode();
    if (m === 'on') return true;
    if (m === 'off') return false;
    if (hasGamepad()) return false;
    return isTouchDevice();
  }

  function reason() {
    var m = mode();
    if (m === 'on') return 'preferência: sempre mostrar';
    if (m === 'off') return 'preferência: nunca mostrar';
    if (gamepadSeen) return 'controle físico conectado';
    if (!isTouchDevice()) return 'PC / mouse e teclado';
    return 'aparelho de toque sem controle';
  }

  function evaluate(force) {
    var show = shouldShowVirtualPad();
    if (!force && show === lastDecision) return show;
    var previous = lastDecision;
    lastDecision = show;
    listeners.forEach(function (cb) {
      try { cb({ show: show, previous: previous, reason: reason(), gamepad: gamepadLabel, mode: mode() }); } catch (e) { }
    });
    return show;
  }

  /* ── Eventos do navegador ── */
  global.addEventListener('gamepadconnected', function (e) {
    gamepadLabel = (e.gamepad && e.gamepad.id) || 'Controle';
    gamepadSeen = true;
    evaluate(true);
  });
  global.addEventListener('gamepaddisconnected', function () {
    setTimeout(function () { evaluate(true); }, 60);
  });

  /* Varredura curta no início: cobre o caso do controle já conectado
     antes de a página abrir (Chrome só popula getGamepads após interação). */
  var polls = 0;
  var poller = setInterval(function () {
    polls++;
    var before = gamepadSeen;
    if (hasGamepad() !== before) evaluate(true);
    if (polls > 40) clearInterval(poller); /* ~20 s */
  }, 500);

  /* Primeiro toque na tela em aparelho híbrido: reavalia. */
  global.addEventListener('touchstart', function once() {
    global.removeEventListener('touchstart', once);
    evaluate(false);
  }, { passive: true });

  global.RVInput = {
    mode: mode,
    setMode: setMode,
    isTouchDevice: isTouchDevice,
    hasGamepad: hasGamepad,
    gamepadName: function () { return gamepadLabel; },
    shouldShowVirtualPad: shouldShowVirtualPad,
    reason: reason,
    evaluate: evaluate,
    onChange: function (cb) { listeners.push(cb); return function () { listeners = listeners.filter(function (f) { return f !== cb; }); }; }
  };
})(window);

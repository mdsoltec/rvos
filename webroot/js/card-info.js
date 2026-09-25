/* ═══════════════════════════════════════════════════════════
   RETROVAULT WEB — FICHA NA CAPA DO CARD
   Mostra as informações do jogo DIRETO no card (sem modal):
     • linha de metadados: ANO · GÊNERO · JOGADORES
     • descrição curta (2 linhas, com reticências)
   Como funciona:
   1. Observa os cards (a.game-card / a.user-game-card) com MutationObserver.
   2. Lê o href do card (play.html?core=...&game=console/arquivo), procura
      a ficha em RV_FICHAS pela chave = nome exato do arquivo da ROM.
   3. Injeta a ficha no bloco de info do card (.game-info / .user-game-info)
      e põe a descrição completa no title (tooltip ao passar o mouse).
   Não toca nos templates: funciona em index.html e games.html.
   ═══════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  if (typeof window.RV_FICHAS === 'undefined') {
    console.warn('[RetroVault Web] js/fichas.js não carregado antes de card-info.js');
    return;
  }
  var F = window.RV_FICHAS;

  /* ---------- estilo próprio (sobrepõe o do site sem alterá-lo) ---------- */
  var css = [
    /* o .game-info do games.html tem altura fixa de 54px — libera para caber a ficha */
    '.game-card .game-info{height:auto;min-height:54px;justify-content:flex-start}',
    '.rv-card-meta{display:block;font-family:var(--font-body,system-ui);font-size:.66rem;',
    'letter-spacing:.6px;color:#8ef0ff;margin-top:3px;white-space:nowrap;',
    'overflow:hidden;text-overflow:ellipsis}',
    '.rv-card-desc{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;',
    'overflow:hidden;font-family:var(--font-body,system-ui);font-size:.66rem;line-height:1.45;',
    'color:var(--text-muted,#8fa3c0);margin-top:4px;font-weight:500}',
    /* nos cards compactos do index (Continue Jogando etc.), 1 linha só */
    '.user-game-card .rv-card-desc{-webkit-line-clamp:1}'
  ].join('');
  var styleEl = document.createElement('style');
  styleEl.textContent = css;
  document.head.appendChild(styleEl);

  /* ---------- helpers ---------- */
  function extrairArquivo(href) {
    var q = (href || '').split('?')[1] || '';
    try {
      var params = new URLSearchParams(q);
      var game = params.get('game') || '';
      return decodeURIComponent(game.split('/').slice(1).join('/'));
    } catch (e) { return ''; }
  }

  function esc(s) {
    return String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* monta o HTML da ficha (função pura, fácil de testar) */
  function montarInfo(ficha) {
    var partes = [];
    if (ficha.ano) partes.push(ficha.ano);
    if (ficha.gen) partes.push(ficha.gen);
    if (ficha.jog) partes.push(ficha.jog === 1 ? '1 jogador' : ficha.jog + ' jogadores');
    var meta = partes.length
      ? '<span class="rv-card-meta">' + esc(partes.join(' · ')) + '</span>'
      : '';
    var desc = ficha.desc
      ? '<span class="rv-card-desc">' + esc(ficha.desc) + '</span>'
      : '';
    return meta + desc;
  }

  function injetar(card) {
    if (card.dataset.rvInfo) return;
    var ficha = F[extrairArquivo(card.getAttribute('href'))];
    if (!ficha) return;

    var alvo = card.querySelector('.game-info') || card.querySelector('.user-game-info');
    if (!alvo) return;

    alvo.insertAdjacentHTML('beforeend', montarInfo(ficha));
    if (!card.title) card.title = ficha.desc || '';
    card.dataset.rvInfo = '1';
  }

  function varrer() {
    var cards = document.querySelectorAll('a.game-card, a.user-game-card');
    for (var i = 0; i < cards.length; i++) injetar(cards[i]);
  }

  if (window.MutationObserver) {
    var obs = new MutationObserver(varrer);
    obs.observe(document.body, { childList: true, subtree: true });
  }
  varrer();

  /* exposto para testes e uso externo (não interfere no funcionamento) */
  window.RV_CARDINFO = { montarInfo: montarInfo, extrairArquivo: extrairArquivo };

  console.log('[RetroVault Web] Fichas na capa prontas: ' + Object.keys(F).length + ' jogos.');
})();

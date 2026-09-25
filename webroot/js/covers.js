/* ═══════════════════════════════════════════════════════════
   RETROVAULT WEB — SISTEMA DE CAPAS AUTOMÁTICO (v2)
   ───────────────────────────────────────────────────────────
   Regra: se a capa NÃO existir localmente, o sistema busca
   automaticamente na internet (base comunitária libretro-thumbnails,
   a mesma usada pelo RetroArch/RetroPie/Lakka) — sem login, sem CORS.

   Ordem de tentativas para cada jogo:
     1) covers/<console>/<nome-da-rom>.png        (local)
     2) covers/<console>/<nome-da-rom>.jpg        (local)
     3) URL exata do mapa js/covers-map.js (gerado por tools/gerar-capas.py)
     4) https://thumbnails.libretro.com/<Sistema>/Named_Boxarts/<nome>.png
     4) ... Named_Covers/<nome>.png
     5) ... Named_Titles/<nome>.png   (último recurso visual)
        → todas as variações de nome (game.remote, nome do arquivo,
          nome exibido, sem região, com caracteres especiais trocados
          por "_" conforme o padrão libretro)
     6) placeholder "RV"

   Extras:
     • cache em localStorage (rv_cover_cache): a URL que funcionou é
       lembrada, então nas próximas visitas a capa carrega de primeira;
     • URLs que falharam também são lembradas (não tenta de novo);
     • API única usada por index.html, games.html, profile.html.

   Uso:
     RVCovers.attach(imgElement, { console: 'snes', file: 'Aladdin (USA).sfc',
                                   remote: 'Aladdin (USA)', name: 'Aladdin',
                                   onFail: fn, onLoad: (url) => {} });
   ═══════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';

  // Pastas de sistema na base libretro-thumbnails
  var RETRO_SYSTEM = {
    'snes': 'Nintendo - Super Nintendo Entertainment System',
    'nes': 'Nintendo - Nintendo Entertainment System',
    'gb': 'Nintendo - Game Boy',
    'gbc': 'Nintendo - Game Boy Color',
    'gba': 'Nintendo - Game Boy Advance',
    'n64': 'Nintendo - Nintendo 64',
    'nds': 'Nintendo - Nintendo DS',
    'sega': 'Sega - Mega Drive - Genesis',
    'segacd': 'Sega - Mega-CD - Sega CD',
    'gamegear': 'Sega - Game Gear',
    'mastersystem': 'Sega - Master System - Mark III',
    'sega32x': 'Sega - 32X',
    'saturn': 'Sega - Saturn',
    'atari2600': 'Atari - 2600',
    'psx': 'Sony - PlayStation',
    'psp': 'Sony - PlayStation Portable',
    'arcade': 'FBNeo - Arcade Games',
    'mame': 'MAME'
  };

  var RETRO_BASE = 'https://thumbnails.libretro.com';
  var TIPOS = ['Named_Boxarts', 'Named_Covers', 'Named_Titles'];
  var CACHE_KEY = 'rv_cover_cache';
  var CACHE_MAX_DIAS = 30;

  /* ─── cache ─────────────────────────────────────────────── */
  var cache = (function () {
    try {
      var c = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
      return (c && typeof c === 'object') ? c : {};
    } catch (e) { return {}; }
  })();

  var salvarPendente = false;
  function salvarCache() {
    if (salvarPendente) return;
    salvarPendente = true;
    setTimeout(function () {
      salvarPendente = false;
      try { localStorage.setItem(CACHE_KEY, JSON.stringify(cache)); }
      catch (e) { try { localStorage.removeItem(CACHE_KEY); } catch (e2) {} }
    }, 400);
  }

  function cacheGet(chave) {
    var reg = cache[chave];
    if (!reg) return null;
    if (Date.now() - (reg.t || 0) > CACHE_MAX_DIAS * 864e5) { delete cache[chave]; return null; }
    return reg;
  }

  /* ─── nomes ─────────────────────────────────────────────── */
  function semExtensao(nome) {
    return String(nome || '').replace(/\.[^/.]+$/, '');
  }

  // Caracteres proibidos em nomes de arquivo viram "_" (padrão libretro)
  function sanitizarLibretro(nome) {
    return String(nome).replace(/[&*/:`<>?\\|"]/g, '_').trim();
  }

  function semTags(nome) {
    // remove "(USA)", "(Rev 1)", "[!]" etc.
    return String(nome).replace(/\s*[\(\[][^\)\]]*[\)\]]/g, '').trim();
  }

  // Variações de nome a tentar na base remota, em ordem de probabilidade
  function variacoesNome(jogo) {
    var base = semExtensao(jogo.file);
    var nomes = [];
    function add(n) {
      if (!n) return;
      n = sanitizarLibretro(n);
      if (n && nomes.indexOf(n) === -1) nomes.push(n);
    }

    if (jogo.remote) add(jogo.remote);       // nome exato informado no catálogo
    add(base);                               // nome do arquivo da ROM
    add(base.replace(/\s*\(.*$/, ''));       // sem região/revisão
    if (jogo.name) {
      var display = jogo.name + (jogo.subtitle ? ' - ' + jogo.subtitle : '');
      add(display + ' (USA)');
      add(display + ' (World)');
      add(display + ' (Europe)');
      add(display);
      add(jogo.name + ' (USA)');
      add(jogo.name);
    }
    add(semTags(base) + ' (USA)');
    add(semTags(base) + ' (World)');
    return nomes;
  }

  /* ─── lista de candidatas ───────────────────────────────── */
  function candidatas(jogo) {
    var consoleKey = jogo.console;
    var base = semExtensao(jogo.file);
    var urls = [];

    // 1) LOCAIS
    var localBase = 'covers/' + consoleKey + '/' + encodeURIComponent(base);
    urls.push(localBase + '.png');
    urls.push(localBase + '.jpg');

    // 2) MAPA PRÉ-RESOLVIDO (js/covers-map.js, gerado por tools/gerar-capas.py)
    var mapa = global.RV_COVER_MAP;
    if (mapa) {
      var exata = mapa[consoleKey + '/' + jogo.file];
      if (exata) urls.push(exata);
    }

    // 3) REMOTAS POR TENTATIVA (fallback, se o mapa não tiver o jogo)
    var sys = RETRO_SYSTEM[consoleKey];
    if (sys) {
      var pasta = RETRO_BASE + '/' + encodeURIComponent(sys).replace(/%20/g, '%20');
      var nomes = variacoesNome(jogo);
      for (var t = 0; t < TIPOS.length; t++) {
        for (var n = 0; n < nomes.length; n++) {
          urls.push(pasta + '/' + TIPOS[t] + '/' + encodeURIComponent(nomes[n]) + '.png');
        }
      }
    }
    return urls;
  }

  /* ─── API ───────────────────────────────────────────────── */
  function attach(img, jogo) {
    if (!img || !jogo || !jogo.file) return;
    var chave = (jogo.console || '?') + '/' + jogo.file;
    var lista = candidatas(jogo);
    var ruins = {};
    var reg = cacheGet(chave);

    if (reg && Array.isArray(reg.bad)) {
      reg.bad.forEach(function (u) { ruins[u] = true; });
    }
    // URL que já funcionou antes vai para o topo da fila
    if (reg && reg.ok) {
      lista = [reg.ok].concat(lista.filter(function (u) { return u !== reg.ok; }));
    }
    lista = lista.filter(function (u) { return !ruins[u] || u === (reg && reg.ok); });

    var i = 0;

    function falhouTudo() {
      if (typeof jogo.onFail === 'function') jogo.onFail(img);
      else {
        var d = document.createElement('div');
        d.className = jogo.fallbackClass || 'user-game-fallback';
        d.textContent = 'RV';
        if (img.parentNode) img.replaceWith(d);
      }
    }

    function proxima() {
      if (i >= lista.length) { falhouTudo(); return; }
      img.src = lista[i++];
    }

    img.addEventListener('error', function () {
      var falhou = img.getAttribute('src');
      if (falhou && falhou.indexOf('covers/') !== 0) {
        var r = cache[chave] || { t: Date.now(), bad: [] };
        r.bad = (r.bad || []);
        if (r.bad.indexOf(falhou) === -1) r.bad.push(falhou);
        if (r.bad.length > 40) r.bad = r.bad.slice(-40);
        if (r.ok === falhou) delete r.ok;
        r.t = Date.now();
        cache[chave] = r;
        salvarCache();
      }
      proxima();
    });

    img.addEventListener('load', function () {
      var url = img.getAttribute('src');
      var r = cache[chave] || { bad: [] };
      r.ok = url; r.t = Date.now();
      cache[chave] = r;
      salvarCache();
      if (typeof jogo.onLoad === 'function') jogo.onLoad(url, img);
    });

    proxima();
  }

  // Retorna só a URL local (compatibilidade com código antigo)
  function localUrl(consoleKey, file) {
    return 'covers/' + consoleKey + '/' + encodeURIComponent(semExtensao(file)) + '.png';
  }

  function limparCache() {
    cache = {};
    try { localStorage.removeItem(CACHE_KEY); } catch (e) {}
  }

  global.RVCovers = {
    attach: attach,
    localUrl: localUrl,
    candidatas: candidatas,
    limparCache: limparCache,
    RETRO_SYSTEM: RETRO_SYSTEM
  };
})(window);

/* ═══════════════════════════════════════════════════════════════════
   RetroVault OS — aplicação da shell
   Telas: Assistente inicial (somente 1º uso) ou Home → Consoles · Ajustes ·
   Wi-Fi · Sobre · Menu de Energia · Teclado virtual de texto.
   Navegação 100% por ações do RVInput (gamepad físico ou teclado).
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* ─────────────────── utilitários ─────────────────── */
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const icon = (name, cls) => RVIcons.render(name, cls);
  function h(tag, cls, html) { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
  function store(key, val) { if (val === undefined) { try { return JSON.parse(localStorage.getItem(key)); } catch (e) { return null; } } localStorage.setItem(key, JSON.stringify(val)); }

  /* ── catálogo (vem de js/catalog.js — fonte única da web) ── */
  let CAT = window.CATALOG || {};
  let SYS_IDS = Object.keys(CAT);

  const COLORS = { // paleta oficial do RetroVault WEB
    snes: '#a06ee1', nes: '#ff2e4d', gba: '#9b5cf0', gbc: '#00d455',
    n64: '#ff3b47', psx: '#4d9fff', sega: '#3d7bff', segacd: '#5a5aff',
    gamegear: '#ff4444', nds: '#00bfff', atari2600: '#e8963c',
    mastersystem: '#ff5a5a', arcade: '#00ff41',
  };
  const LIBRETRO = {
    snes: 'Nintendo - Super Nintendo Entertainment System',
    nes: 'Nintendo - Nintendo Entertainment System',
    gba: 'Nintendo - Game Boy Advance', gbc: 'Nintendo - Game Boy Color',
    n64: 'Nintendo - Nintendo 64', psx: 'Sony - PlayStation',
    sega: 'Sega - Mega Drive - Genesis', segacd: 'Sega - Mega-CD - Sega CD',
    gamegear: 'Sega - Game Gear', nds: 'Nintendo - Nintendo DS',
    atari2600: 'Atari - 2600', mastersystem: 'Sega - Master System - Mark III',
    arcade: 'FBNeo - Arcade Games',
  };
  const sysColor = (id) => COLORS[id] || (CAT[id] && CAT[id].color) || '#8b5cf6';
  const sysShort = (id) => (CAT[id] && CAT[id].short) || id.toUpperCase();

  /* ── dados da shell ── */
  let recents = store('rvos:recent') || [];
  // O player OS já usa RVStore no perfil convidado. Compartilhe o formato
  // para que status e favoritos marcados na shell não se percam no player.
  const guestKey = key => 'rv:convidado:' + key;
  function guestGet(key, fallback) {
    try { return JSON.parse(localStorage.getItem(guestKey(key))) ?? fallback; }
    catch (e) { return fallback; }
  }
  const oldFavs = store('rvos:favs');
  const guestFavs = guestGet('rv_favorites', []);
  let favs = new Set([
    ...(Array.isArray(oldFavs) ? oldFavs : []),
    ...(Array.isArray(guestFavs) ? guestFavs : []).filter(f => f && typeof f.console === 'string' && typeof f.file === 'string')
      .map(f => f.console + ':' + f.file),
  ]);
  const saveRecents = () => store('rvos:recent', recents.slice(0, 8));
  function saveFavs() {
    store('rvos:favs', Array.from(favs)); // compatibilidade com versões anteriores
    const list = [];
    SYS_IDS.forEach(sys => (CAT[sys].games || []).forEach(g => {
      if (favs.has(sys + ':' + g.file)) list.push({
        name: g.name, subtitle: g.subtitle || '', file: g.file,
        console: sys, core: CAT[sys].core || sys, consoleShort: sysShort(sys),
      });
    }));
    localStorage.setItem(guestKey('rv_favorites'), JSON.stringify(list));
  }

  const FICHAS = window.RV_FICHAS || {};
  const STATUS_VALUES = ['', 'playing', 'done', 'wish'];
  const STATUS_LABEL = { playing: 'Jogando', done: 'Zerado', wish: 'Quero zerar' };
  const GENRES = ['', 'Ação', 'Aventura', 'Plataforma', 'RPG', 'Corrida', 'Luta', 'Esporte', 'Tiro', 'Estratégia', 'Quebra-cabeça'];
  const PLAYER_OPTIONS = ['', '1', '2', '4'];
  const folded = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  function statusMap() {
    const map = guestGet('rv_status', {});
    return map && typeof map === 'object' && !Array.isArray(map) ? map : {};
  }
  const statusKey = (sys, file) => sys + '/' + file;
  function statusOf(sys, file) {
    const item = statusMap()[statusKey(sys, file)];
    return item && Object.prototype.hasOwnProperty.call(STATUS_LABEL, item.s) ? item.s : '';
  }
  function cycleStatus(sys, file) {
    const map = statusMap(), key = statusKey(sys, file);
    const next = STATUS_VALUES[(STATUS_VALUES.indexOf(statusOf(sys, file)) + 1) % STATUS_VALUES.length];
    if (next) map[key] = { s: next, at: Date.now() };
    else delete map[key];
    localStorage.setItem(guestKey('rv_status'), JSON.stringify(map));
    return next;
  }

  /* ─────────────────── sons de interface ─────────────────── */
  const Sound = (() => {
    let ctx = null, master = null, volume = 0.7;
    function ac() {
      if (!ctx) { const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
        ctx = new AC(); master = ctx.createGain(); master.gain.value = 0.05; master.connect(ctx.destination); }
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      return ctx;
    }
    function tone(f0, f1, dur, type, vol) {
      const c = ac(); if (!c) return;
      const o = c.createOscillator(), g = c.createGain();
      o.type = type || 'square';
      o.frequency.setValueAtTime(f0, c.currentTime);
      if (f1) o.frequency.exponentialRampToValueAtTime(f1, c.currentTime + dur);
      g.gain.setValueAtTime((vol || 1) * 0.05 * volume, c.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
      o.connect(g); g.connect(master); o.start(); o.stop(c.currentTime + dur + 0.02);
    }
    return {
      move()    { tone(950, 0, 0.035, 'square', 0.8); },
      confirm() { tone(660, 990, 0.09, 'square', 1); },
      back()    { tone(520, 340, 0.09, 'square', 0.9); },
      open()    { tone(440, 880, 0.14, 'triangle', 1); },
      type()    { tone(1250, 0, 0.02, 'square', 0.5); },
      err()     { tone(190, 140, 0.16, 'sawtooth', 1); },
      success() { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone(f, 0, 0.12, 'triangle', 1), i * 90)); },
      setVolume(v) { volume = Math.max(0, Math.min(1, v / 100)); },
    };
  })();

  /* ─────────────────── capas (pipeline local → libretro) ─────────────────── */
  function coverBase(sysId, g) {
    const raw = (g.remote || (g.file || '').replace(/\.[^.]+$/, '')).trim();
    return raw;
  }
  function coverCandidates(sysId, g) {
    const base = coverBase(sysId, g);
    const enc = encodeURIComponent(base);
    const list = [`covers/${sysId}/${encodeURIComponent((g.file || '').replace(/\.[^.]+$/, ''))}.png`,
                  `covers/${sysId}/${encodeURIComponent((g.file || '').replace(/\.[^.]+$/, ''))}.jpg`];
    if (LIBRETRO[sysId]) list.push(`https://thumbnails.libretro.com/${encodeURIComponent(LIBRETRO[sysId])}/Named_Boxarts/${enc}.png`);
    return list;
  }
  function applyCover(el, sysId, g) {
    const cands = coverCandidates(sysId, g);
    let i = 0;
    (function next() {
      if (i >= cands.length) return;
      const url = cands[i++];
      const img = new Image();
      img.onload = () => {
        el.classList.add('has-cover');
        const ph = $('.ph', el); if (ph) ph.remove();
        el.style.setProperty('--cu', `url("${url}")`);
        if (!$('.art', el)) el.insertAdjacentHTML('beforeend', '<i class="art"></i>');
      };
      img.onerror = next;
      img.src = url;
    })();
  }
  function shade(hex, f) { // escurece hex em direção ao fundo
    const n = parseInt(hex.slice(1), 16), r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    const mix = (c) => Math.round(c * f + 10 * (1 - f));
    return `rgb(${mix(r)},${mix(g)},${mix(b)})`;
  }
  function rgba(hex, a) {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  }
  function ambient(col) { // cor ambiente do topo segue o console em foco
    document.body.style.setProperty('--ambient', col ? rgba(col, 0.14) : 'color-mix(in srgb, var(--green) 12%, transparent)');
  }
  function placeholder(el, sysId, g) {
    const c = sysColor(sysId);
    el.style.background = `linear-gradient(160deg, ${c}, ${shade(c, 0.28)})`;
    const ini = (g.name || '?').split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();
    el.innerHTML = `<span class="ph">${esc(ini)}</span>`;
  }

  /* ── Disponibilidade local: HEAD não baixa ROM para descobrir se existe ── */
  const localRoms = new Map(); // null = em consulta; true/false = resultado
  const romQueue = [];
  let activeRomChecks = 0, libraryRefresh = null;
  function romKey(sysId, g) { return sysId + ':' + g.file; }
  function romUrl(sysId, g) {
    return 'roms/' + [sysId, ...g.file.split('/')].map(encodeURIComponent).join('/');
  }
  function romLabel(value) {
    return value === true ? 'NO CARTÃO' : value === null ? 'VERIFICANDO…' :
      statusCache.wifi && statusCache.wifi.connected ? 'SÓ VIA REDE*' : 'SEM ROM LOCAL';
  }
  function updateRomBadge(sysId, g) {
    const key = romKey(sysId, g), available = localRoms.get(key);
    $$('.game-card').forEach(card => {
      if (card.dataset.gameSys !== sysId || card.dataset.file !== g.file) return;
      const badge = $('.rom-badge', card);
      if (badge) { badge.textContent = romLabel(available); badge.classList.toggle('on-card', available === true); }
    });
    const hero = $('.hero-continue');
    if (hero && hero.dataset.sys === sysId && hero.dataset.file === g.file) {
      const badge = $('.hero-availability', hero); if (badge) badge.textContent = romLabel(available);
    }
    if (top() === consoleScreen && consoleScreen.filter === 'local') {
      clearTimeout(libraryRefresh);
      libraryRefresh = setTimeout(() => {
        if (top() !== consoleScreen) return;
        consoleScreen.render();
        consoleScreen.defaultFocus();
      }, 180);
    }
  }
  function queueRomCheck(sysId, g) {
    const key = romKey(sysId, g);
    if (localRoms.has(key)) return;
    localRoms.set(key, null);
    romQueue.push({ sysId, g });
    pumpRomChecks();
  }
  function pumpRomChecks() {
    while (activeRomChecks < 5 && romQueue.length) {
      const { sysId, g } = romQueue.shift();
      activeRomChecks++;
      fetch(romUrl(sysId, g), { method: 'HEAD', cache: 'no-store' })
        .then(response => localRoms.set(romKey(sysId, g), response.ok))
        .catch(() => localRoms.set(romKey(sysId, g), false))
        .finally(() => { activeRomChecks--; updateRomBadge(sysId, g); pumpRomChecks(); });
    }
  }

  /* Save-states ficam no IndexedDB do player; a shell só lê os metadados. */
  let savesDbPromise;
  function readSaveDate(sysId, g) {
    if (!('indexedDB' in window)) return Promise.resolve(null);
    // Não criar um banco vazio: o player precisa poder inicializar o schema.
    if (!savesDbPromise) savesDbPromise = (indexedDB.databases ? indexedDB.databases() : Promise.resolve([]))
      .then(list => new Promise(resolve => {
        if (!list.some(item => item.name === 'RetroVault-saves')) return resolve(null);
        const req = indexedDB.open('RetroVault-saves');
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(null);
      })).catch(() => null);
    return savesDbPromise.then(db => new Promise(resolve => {
      if (!db || !db.objectStoreNames.contains('saves')) return resolve(null);
      const core = (CAT[sysId] && CAT[sysId].core) || sysId;
      const key = 'convidado::' + core + '|' + sysId + '/' + g.file;
      const tx = db.transaction('saves', 'readonly');
      const request = tx.objectStore('saves').get(key);
      request.onsuccess = () => resolve(request.result && request.result.savedAt || null);
      request.onerror = () => resolve(null);
    }));
  }
  function showSaveBadge(container, sysId, g) {
    readSaveDate(sysId, g).then(date => {
      if (!date || !container.isConnected) return;
      const el = h('span', 'save-badge', '● SAVE ' + new Date(date).toLocaleDateString('pt-BR'));
      container.appendChild(el);
    });
  }

  /* ─────────────────── navegação espacial ─────────────────── */
  function focusables(container) { const root = typeof container === 'string' ? $(container) : container; return root ? $$('.focusable', root).filter(e => e.offsetParent !== null) : []; }
  let focusedEl = null;
  function setFocus(el, silent) {
    if (focusedEl) focusedEl.classList.remove('focused');
    focusedEl = el;
    if (el) {
      el.classList.add('focused');
      el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      if (!silent) Sound.move();
    }
  }
  function nearestIn(dir, container) {
    const items = focusables(container);
    if (!items.length) return null;
    if (!focusedEl || !items.includes(focusedEl)) return items[0];
    const r = focusedEl.getBoundingClientRect();
    const c = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    let best = null, bs = Infinity;
    for (const it of items) {
      if (it === focusedEl) continue;
      const q = it.getBoundingClientRect();
      const p = { x: q.left + q.width / 2, y: q.top + q.height / 2 };
      const dx = p.x - c.x, dy = p.y - c.y;
      if (dir === 'left' && dx > -6) continue;
      if (dir === 'right' && dx < 6) continue;
      if (dir === 'up' && dy > -6) continue;
      if (dir === 'down' && dy < 6) continue;
      const score = (dir === 'left' || dir === 'right') ? Math.abs(dx) + Math.abs(dy) * 2.6 : Math.abs(dy) + Math.abs(dx) * 2.6;
      if (score < bs) { bs = score; best = it; }
    }
    return best;
  }

  /* ─────────────────── toast ─────────────────── */
  let toastTimer = null;
  function toast(msg, ms, iconName) {
    let t = $('#toast');
    if (!t) { t = h('div'); t.id = 'toast'; document.body.appendChild(t); }
    t.innerHTML = (iconName ? icon(iconName) : '') + `<span>${esc(msg)}</span>`; t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), ms || 2200);
  }

  /* ─────────────────── estado + pilha de contextos ─────────────────── */
  const stack = [];
  const top = () => stack[stack.length - 1];
  const ui = { lastConsole: store('rvos:ui:lastConsole') || SYS_IDS[0] };

  function handleAction(a) {
    const ctx = top();
    if (ctx && ctx.onAction) ctx.onAction(a);
  }

  /* ════════════════════ HOME — consoles full-bleed ════════════════════ */
  const CONSOLE_IMG = { sega: 'segamd', gamegear: 'gg' };
  const sysArt = (id) => `assets/consoles/${CONSOLE_IMG[id] || id}.png`;

  function sysCard(id) {
    const info = CAT[id];
    const card = h('div', 'sys-card focusable');
    card.tabIndex = -1; card.dataset.sys = id;
    const col = sysColor(id);
    card.style.setProperty('--sc', col);
    card.style.background = `radial-gradient(120% 150% at 50% 118%, ${shade(col, 0.9)} 0%, ${shade(col, 0.34)} 46%, ${shade(col, 0.10)} 100%)`;
    const art = h('div', 'sys-art');
    const img = h('img'); img.src = sysArt(id); img.alt = info.short || id; img.draggable = false;
    img.onerror = () => { art.innerHTML = `<span style="font-family:var(--font-display);font-size:34px;font-weight:900;color:rgba(255,255,255,.85)">${esc(info.short || id.toUpperCase())}</span>`; };
    art.appendChild(img); card.appendChild(art);
    card.appendChild(h('div', 'sys-top', esc(info.short || id.toUpperCase())));
    card.appendChild(h('div', 'sys-meta', `<div class="sys-name">${esc(info.name || id)}</div><div class="sys-count">${info.games.length} jogos</div>`));
    return card;
  }
  function utilCard(kind, iconName, name, count, col) {
    col = col || getComputedStyle(document.documentElement).getPropertyValue('--green').trim() || '#00ff41';
    const card = h('div', 'sys-card sys-util focusable');
    card.tabIndex = -1; card.dataset.sys = kind;
    card.style.setProperty('--sc', col);
    card.style.background = `radial-gradient(120% 150% at 50% 118%, ${rgba(col, 0.5)} 0%, ${shade(col, 0.22)} 46%, ${shade(col, 0.08)} 100%)`;
    const art = h('div', 'sys-art');
    if (kind === '@settings') {
      // Mesma hierarquia visual dos consoles: arte PNG no centro, não um glifo pequeno.
      const image = h('img');
      image.src = 'ui/system-gear.png'; image.alt = ''; image.draggable = false;
      image.onerror = () => { art.innerHTML = icon('system', 'sys-glyph'); };
      art.appendChild(image);
    } else art.innerHTML = icon(iconName, 'sys-glyph');
    card.appendChild(art);
    card.appendChild(h('div', 'sys-top', name.toUpperCase().slice(0, 8)));
    card.appendChild(h('div', 'sys-meta', `<div class="sys-name">${esc(name)}</div><div class="sys-count">${esc(count)}</div>`));
    return card;
  }

  const homeScreen = {
    render() {
      const scr = $('#screen');
      scr.innerHTML = '';
      ambient(null); // home = verde da marca

      // ── Continuar jogando (hero) ──
      const latest = recents.find(r => CAT[r.sys] && (CAT[r.sys].games || []).some(g => g.file === r.file));
      if (latest) {
        const r = latest;
        const g = (CAT[r.sys].games || []).find(x => x.file === r.file);
        scr.appendChild(h('div', 'row-title', 'Continuar jogando'));
        const hero = h('div', 'hero-continue focusable');
        hero.tabIndex = -1; hero.dataset.launch = '1'; hero.dataset.sys = r.sys; hero.dataset.file = r.file;
        const col = sysColor(r.sys);
        hero.style.setProperty('--hc', shade(col, 0.14));
        hero.style.setProperty('--hc2', col);
        const shadeEl = h('div', 'hero-shade'); shadeEl.style.background =
          `linear-gradient(90deg, ${shade(col, 0.15)} 26%, ${shade(col, 0.32)} 62%, ${shade(col, 0.55)} 100%)`;
        hero.appendChild(shadeEl);
        const cover = h('div', 'hero-cover'); applyCover(cover, r.sys, g); hero.appendChild(cover);
        hero.appendChild(h('div', 'hero-glow')).style.background = col;
        const last = h('span', 'hero-availability', romLabel(localRoms.get(romKey(r.sys, g))));
        hero.appendChild(last); queueRomCheck(r.sys, g); showSaveBadge(hero, r.sys, g);
        hero.appendChild(h('div', 'hero-meta',
          `<span class="hero-chip">Continuar</span>
           <div class="hero-title">${esc(r.name)}${r.sub ? ` <span style="opacity:.65;font-weight:600;font-size:.72em">${esc(r.sub)}</span>` : ''}</div>
           <div class="hero-sys" style="color:${col}">${esc(sysShort(r.sys))} · aperte A para jogar</div>`));
        scr.appendChild(hero);
      }

      // ── Consoles (arte ocupando o card inteiro) ──
      scr.appendChild(h('div', 'row-title', 'Consoles'));
      const grid = h('div', 'sys-grid'); grid.id = 'sysGrid';
      SYS_IDS.forEach(id => grid.appendChild(sysCard(id)));
      if (favs.size) grid.appendChild(utilCard('@fav', 'heart', 'Favoritos', favs.size + ' jogos', '#ff5d7e'));
      grid.appendChild(utilCard('@settings', 'system', 'Sistema', 'ajustes'));
      scr.appendChild(grid);
      return scr;
    },

    onAction(a) {
      if (a === 'start' || a === 'home') return openPower();
      if (['left', 'right', 'up', 'down'].includes(a)) {
        const next = nearestIn(a, $('#screen'));
        if (next) setFocus(next);
        return;
      }
      if (a === 'x' && focusedEl && focusedEl.dataset.launch) { // favorito do hero
        const { sys, file } = focusedEl.dataset;
        const key = sys + ':' + file;
        if (favs.has(key)) { favs.delete(key); toast('Removido dos favoritos', 2200, 'heart'); }
        else { favs.add(key); toast('Adicionado aos favoritos', 2200, 'heart'); }
        saveFavs(); Sound.confirm();
        return;
      }
      if (a !== 'a' || !focusedEl) return;
      if (focusedEl.dataset.launch) {
        const { sys, file } = focusedEl.dataset;
        const g = (CAT[sys].games || []).find(x => x.file === file);
        if (g) launch(sys, g);
        return;
      }
      const id = focusedEl.dataset.sys;
      if (!id) return;
      Sound.confirm();
      if (id === '@settings') openSettings();
      else if (id === '@fav') consoleScreen.openFavorites();
      else { ui.lastConsole = id; store('rvos:ui:lastConsole', id); consoleScreen.open(id); }
    },

    defaultFocus() {
      const target = $$('#sysGrid .sys-card').find(c => c.dataset.sys === ui.lastConsole) || $('#sysGrid .sys-card');
      setFocus(target, true);
    },
    _rendered: false,
  };

  function openSettings() { Sound.open(); pushCtx(settingsScreen); }

  /* ════════════════════ TELA DO CONSOLE — jogos (como o site) ════════════════════ */
  function gameCard(sysId, g, showChip) {
    const card = h('div', 'game-card focusable');
    card.tabIndex = -1; card.dataset.gameSys = sysId; card.dataset.file = g.file;
    card.style.setProperty('--gc', sysColor(sysId));
    const cov = h('div', 'cover');
    placeholder(cov, sysId, g); applyCover(cov, sysId, g);
    card.appendChild(cov);
    const mark = statusOf(sysId, g.file);
    card.appendChild(h('div', 'meta', `<span class="t">${esc(g.name)}</span>${g.subtitle ? `<span class="s">${esc(g.subtitle)}</span>` : ''}${mark ? `<span class="game-status" data-status="${mark}">${esc(STATUS_LABEL[mark])}</span>` : ''}`));
    const badge = h('span', 'rom-badge' + (localRoms.get(romKey(sysId, g)) === true ? ' on-card' : ''), romLabel(localRoms.get(romKey(sysId, g))));
    card.appendChild(badge); queueRomCheck(sysId, g); showSaveBadge(card, sysId, g);
    if (showChip) card.appendChild(h('span', 'chip', esc(sysShort(sysId))));
    if (favs.has(sysId + ':' + g.file)) card.appendChild(h('span', 'fav', icon('heart')));
    return card;
  }

  const consoleScreen = {
    sysId: null, custom: null, title: '', isFav: false, filter: 'all', query: '',
    statusFilter: '', genreFilter: '', playersFilter: '', restoreGame: null,
    open(id) {
      this.sysId = id; this.custom = null; this.isFav = false; this.filter = 'all'; this.query = '';
      this.statusFilter = this.genreFilter = this.playersFilter = ''; this.restoreGame = null;
      this.title = CAT[id].name || id;
      pushCtx(this);
    },
    openFavorites() {
      const list = [];
      SYS_IDS.forEach(id => (CAT[id].games || []).forEach(g => { if (favs.has(id + ':' + g.file)) list.push({ sys: id, g }); }));
      this.sysId = '@fav'; this.custom = list; this.isFav = true; this.filter = 'all'; this.query = '';
      this.statusFilter = this.genreFilter = this.playersFilter = ''; this.restoreGame = null;
      this.title = 'Meus Favoritos';
      pushCtx(this);
    },
    render() {
      const scr = $('#screen');
      scr.innerHTML = '';
      const col = this.isFav ? '#ff5d7e' : sysColor(this.sysId);
      ambient(col); // topo da tela ganha a cor do console
      const n = this.isFav ? this.custom.length : (CAT[this.sysId].games || []).length;
      const artImg = this.isFav ? null : sysArt(this.sysId);
      const ghost = this.isFav ? icon('heart') : esc(sysShort(this.sysId));

      const hero = h('div', 'console-hero');
      hero.style.background = `linear-gradient(100deg, ${shade(col, 0.30)} 0%, ${shade(col, 0.10)} 70%, ${shade(col, 0.06)} 100%)`;
      hero.style.borderColor = shade(col, 0.65);
      hero.innerHTML = `${artImg ? `<img src="${artImg}" alt="" draggable="false" onerror="this.style.display='none'">` : `<span class="ch-fav-art">${icon('heart')}</span>`}
        <div class="ch-meta">
          <div class="ch-name" style="text-shadow:0 0 22px ${col}66">${esc(this.title)}</div>
          <div class="ch-sub">${n} ${n === 1 ? 'jogo' : 'jogos'}</div>
          <div class="ch-hint"><b>A</b> jogar · <b>Y</b> ficha · <b>SELECT</b> status · <b>X</b> favorito · <b>L/R</b> console</div>
        </div>
        <div class="ch-ghost">${ghost}</div>`;
      scr.appendChild(hero);

      const all = this.isFav ? this.custom : (CAT[this.sysId].games || []).map(g => ({ sys: this.sysId, g }));
      // Apenas gêneros encontrados nesta aba aparecem ao ciclar o filtro.
      this.genreOptions = GENRES.filter(label => !label || all.some(({ g }) =>
        folded((FICHAS[g.file] || {}).gen).includes(folded(label))));
      if (!this.genreOptions.includes(this.genreFilter)) this.genreFilter = '';
      // Filtros navegáveis pelo controle; os jogos permanecem acessíveis sem rede.
      const tools = h('div', 'library-tools');
      [['all', 'Todos'], ['local', 'No cartão'], ['recent', 'Recentes'], ['favs', 'Favoritos']].forEach(([id, text]) => {
        const btn = h('div', 'library-filter focusable' + (this.filter === id ? ' active' : ''), text);
        btn.dataset.filter = id; btn.tabIndex = -1; tools.appendChild(btn);
      });
      const search = h('div', 'library-filter library-search focusable', icon('search') + `<span>${this.query ? esc(this.query) : 'Buscar jogo'}</span>`);
      search.dataset.search = '1'; search.tabIndex = -1; tools.appendChild(search);
      scr.appendChild(tools);
      const refine = h('div', 'library-refine');
      [
        ['status', 'Status', STATUS_VALUES, this.statusFilter, v => STATUS_LABEL[v] || 'Todos'],
        ['genre', 'Gênero', this.genreOptions, this.genreFilter, v => v || 'Todos'],
        ['players', 'Jogadores', PLAYER_OPTIONS, this.playersFilter, v => ({ '': 'Todos', '1': '1', '2': '2+', '4': '3–4' })[v]],
      ].forEach(([kind, title, options, current, label]) => {
        const btn = h('div', 'library-filter library-refine-item focusable' + (current ? ' active' : ''),
          `<span class="refine-title">${title}</span><span class="refine-value">${esc(label(current))}</span>${icon('chevronRight')}`);
        btn.dataset.refine = kind; btn.tabIndex = -1; refine.appendChild(btn);
      });
      scr.appendChild(refine);
      // Consulta todas as ROMs da aba em grupos pequenos, inclusive as ocultas pelo filtro.
      all.forEach(it => queueRomCheck(it.sys, it.g));
      const q = this.query.trim().toLocaleLowerCase('pt-BR');
      const recentKeys = new Set(recents.map(r => r.sys + ':' + r.file));
      const visible = all.filter(({ sys, g }) => {
        const key = romKey(sys, g);
        if (this.filter === 'local' && localRoms.get(key) !== true) return false;
        if (this.filter === 'recent' && !recentKeys.has(key)) return false;
        if (this.filter === 'favs' && !favs.has(key)) return false;
        if (this.statusFilter && statusOf(sys, g.file) !== this.statusFilter) return false;
        const ficha = FICHAS[g.file] || {};
        if (this.genreFilter && !folded(ficha.gen).includes(folded(this.genreFilter))) return false;
        if (this.playersFilter && (!Number.isFinite(Number(ficha.jog)) ||
          (this.playersFilter === '1' ? Number(ficha.jog) !== 1 :
          Number(ficha.jog) < (this.playersFilter === '4' ? 3 : 2)))) return false;
        return !q || folded([g.name, g.subtitle, ficha.gen, ficha.dev].join(' ')).includes(folded(q));
      });
      scr.appendChild(h('div', 'library-count', `${visible.length} ${visible.length === 1 ? 'jogo exibido' : 'jogos exibidos'}${this.filter === 'local' && all.some(it => localRoms.get(romKey(it.sys, it.g)) === null) ? ' · verificando cartão…' : ''} · *Disponibilidade online não verificada`));
      if (!visible.length) {
        const empty = this.query ? 'Nenhum jogo corresponde à busca. Apague a busca ou escolha outro filtro.'
          : this.statusFilter || this.genreFilter || this.playersFilter ? 'Nenhum jogo corresponde a esta combinação de filtros. Ajuste Status, Gênero ou Jogadores.'
          : this.filter === 'local' ? 'Nenhuma ROM local encontrada. Use Todos para ver o catálogo.'
          : this.filter === 'recent' ? 'Ainda não há jogos recentes. Abra um jogo para vê-lo aqui.'
          : this.filter === 'favs' || this.isFav ? 'Ainda não há favoritos. Selecione um jogo e aperte X para adicioná-lo.'
          : 'Nenhum jogo encontrado neste filtro.';
        scr.appendChild(h('div', 'empty-note', empty));
        return scr;
      }
      const grid = h('div', 'game-grid'); grid.id = 'gameGrid';
      visible.forEach(it => grid.appendChild(gameCard(it.sys, it.g, this.isFav)));
      scr.appendChild(grid);
      return scr;
    },
    cycleConsole(dir) {
      if (this.isFav) return Sound.err();
      const i = SYS_IDS.indexOf(this.sysId);
      const next = SYS_IDS[(i + dir + SYS_IDS.length) % SYS_IDS.length];
      this.sysId = next; this.title = CAT[next].name || next; this.filter = 'all'; this.query = '';
      this.statusFilter = this.genreFilter = this.playersFilter = ''; this.restoreGame = null;
      ui.lastConsole = next; store('rvos:ui:lastConsole', next);
      Sound.open(); this.render(); this.defaultFocus();
    },
    onAction(a) {
      if (a === 'start' || a === 'home') return openPower();
      if (a === 'b') { popCtx(); Sound.back(); return; }
      if (a === 'l') return this.cycleConsole(-1);
      if (a === 'r') return this.cycleConsole(1);
      if (['up', 'down'].includes(a)) { const n = nearestIn(a, $('#screen')); if (n) setFocus(n); return; }
      if (['left', 'right'].includes(a)) {
        // troca de console por ◀▶ só nas bordas da PRIMEIRA linha da grade
        const grid = $('#gameGrid');
        const firstRow = grid && grid.children.length ? grid.children[0].offsetTop : 0;
        const n = nearestIn(a, $('#screen'));
        if (n) setFocus(n);
        else if (focusedEl && focusedEl.closest('.game-grid') && focusedEl.offsetTop === firstRow)
          this.cycleConsole(a === 'left' ? -1 : 1);
        return;
      }
      if (a === 'select' && focusedEl && focusedEl.dataset.file) {
        const sys = focusedEl.dataset.gameSys, file = focusedEl.dataset.file;
        const next = cycleStatus(sys, file);
        this.restoreGame = sys + ':' + file;
        this.render(); this.defaultFocus();
        toast(next ? `Status: ${STATUS_LABEL[next]}` : 'Status removido', 2200, 'check'); Sound.confirm(); return;
      }
      if (a === 'y' && focusedEl && focusedEl.dataset.file) {
        const sys = focusedEl.dataset.gameSys, file = focusedEl.dataset.file;
        const g = (CAT[sys].games || []).find(x => x.file === file);
        if (g) { this.restoreGame = romKey(sys, g); Sound.open(); gameDetailScreen.open(sys, g); }
        return;
      }
      if (a === 'x' && focusedEl && focusedEl.dataset.file) {
        const sys = focusedEl.dataset.gameSys, file = focusedEl.dataset.file;
        const key = sys + ':' + file;
        if (favs.has(key)) {
          favs.delete(key);
          const f = $('.fav', focusedEl); if (f) f.remove();
          toast('Removido dos favoritos', 2200, 'heart');
          if (this.isFav) { const nx = focusedEl.nextElementSibling || focusedEl.previousElementSibling; focusedEl.remove(); if (nx && nx.classList.contains('game-card')) setFocus(nx, true); }
        } else { favs.add(key); focusedEl.appendChild(h('span', 'fav', icon('heart'))); toast('Adicionado aos favoritos', 2200, 'heart'); }
        saveFavs(); Sound.confirm();
        return;
      }
      if (a === 'a' && focusedEl && focusedEl.dataset.filter) {
        this.filter = focusedEl.dataset.filter; this.render();
        setFocus($(`.library-filter[data-filter="${this.filter}"]`), true); Sound.confirm(); return;
      }
      if (a === 'a' && focusedEl && focusedEl.dataset.refine) {
        const kind = focusedEl.dataset.refine;
        const field = { status: 'statusFilter', genre: 'genreFilter', players: 'playersFilter' }[kind];
        const options = { status: STATUS_VALUES, genre: this.genreOptions, players: PLAYER_OPTIONS }[kind];
        if (!field || !options.length) return Sound.err();
        this[field] = options[(options.indexOf(this[field]) + 1) % options.length];
        this.render(); setFocus($(`.library-refine-item[data-refine="${kind}"]`), true);
        Sound.confirm(); return;
      }
      if (a === 'a' && focusedEl && focusedEl.dataset.search) {
        pushKeyboard('Buscar jogo', v => { this.query = v.trim(); this.render(); this.defaultFocus(); }, false); return;
      }
      if (a === 'a' && focusedEl && focusedEl.dataset.file) {
        const sys = focusedEl.dataset.gameSys, file = focusedEl.dataset.file;
        const g = (CAT[sys].games || []).find(x => x.file === file);
        if (g) launch(sys, g);
      }
    },
    defaultFocus() {
      const card = this.restoreGame && $$('#gameGrid .game-card').find(el =>
        el.dataset.gameSys + ':' + el.dataset.file === this.restoreGame);
      this.restoreGame = null;
      const first = $('#gameGrid .game-card');
      // No LCD 480×320, focar o primeiro jogo escondia o nome do console e os filtros.
      const compact = window.innerHeight <= 380;
      setFocus(card || (compact && $('.library-filter')) || first || $('.library-filter'), true);
    },
  };

  /* ════════════════════ FICHA DO JOGO — mesma base de dados da web ════════════════════ */
  const gameDetailScreen = {
    sys: null, game: null,
    open(sys, game) { this.sys = sys; this.game = game; pushCtx(this); },
    render() {
      const sys = this.sys, g = this.game, ficha = FICHAS[g.file] || {};
      const key = sys + ':' + g.file;
      const scr = $('#screen'); scr.innerHTML = '';
      ambient(sysColor(sys));
      scr.appendChild(h('div', 'row-title', `${icon('info')} Ficha do jogo`));
      const sheet = h('div', 'detail-sheet');
      sheet.style.setProperty('--gc', sysColor(sys));
      const topRow = h('div', 'detail-top');
      const art = h('div', 'detail-cover');
      placeholder(art, sys, g); applyCover(art, sys, g);
      topRow.appendChild(art);
      const info = h('div', 'detail-intro');
      info.innerHTML = `<span class="detail-system">${esc(sysShort(sys))}</span>
        <h2>${esc(g.name)}</h2>${g.subtitle ? `<p>${esc(g.subtitle)}</p>` : ''}
        <div class="detail-pills">
          ${ficha.ano ? `<span>${esc(ficha.ano)}</span>` : ''}
          ${ficha.gen ? `<span>${esc(ficha.gen)}</span>` : ''}
          ${ficha.jog ? `<span>${Number(ficha.jog) === 1 ? '1 jogador' : esc(ficha.jog) + ' jogadores'}</span>` : ''}
        </div>`;
      topRow.appendChild(info); sheet.appendChild(topRow);
      if (ficha.dev) sheet.appendChild(h('div', 'detail-developer', `Desenvolvedora · <strong>${esc(ficha.dev)}</strong>`));
      sheet.appendChild(h('div', 'detail-description', ficha.desc ? esc(ficha.desc) :
        'Ficha ainda não disponível para este jogo. Você ainda pode marcar um status e jogar.'));
      const actions = h('div', 'detail-actions'); actions.id = 'detailActions';
      [
        ['play', 'play', 'Jogar', 'primary'],
        ['status', 'check', statusOf(sys, g.file) ? STATUS_LABEL[statusOf(sys, g.file)] : 'Sem status', ''],
        ['favorite', 'heart', favs.has(key) ? 'Favorito ✓' : 'Favoritar', ''],
      ].forEach(([act, ic, label, extra]) => {
        const btn = h('div', 'detail-btn focusable ' + extra, icon(ic) + `<span>${esc(label)}</span>`);
        btn.dataset.detail = act; btn.tabIndex = -1; actions.appendChild(btn);
      });
      sheet.appendChild(actions);
      sheet.appendChild(h('div', 'detail-help', 'A selecionar · SELECT mudar status · X favorito · B voltar'));
      scr.appendChild(sheet); return scr;
    },
    redraw(action) { this.render(); setFocus($(`[data-detail="${action}"]`, $('#detailActions')), true); },
    onAction(a) {
      if (a === 'start' || a === 'home') return openPower();
      if (a === 'b' || a === 'y') { popCtx(); Sound.back(); return; }
      if (['up', 'down', 'left', 'right'].includes(a)) {
        const n = nearestIn(a, '#detailActions');
        if (n) setFocus(n);
        else $('#screen').scrollBy({ top: a === 'up' ? -65 : a === 'down' ? 65 : 0 });
        return;
      }
      const sys = this.sys, g = this.game, key = sys + ':' + g.file;
      if (a === 'select' || (a === 'a' && focusedEl?.dataset.detail === 'status')) {
        const next = cycleStatus(sys, g.file);
        this.redraw('status'); toast(next ? `Status: ${STATUS_LABEL[next]}` : 'Status removido', 2200, 'check');
        Sound.confirm(); return;
      }
      if (a === 'x' || (a === 'a' && focusedEl?.dataset.detail === 'favorite')) {
        if (favs.has(key)) favs.delete(key); else favs.add(key);
        saveFavs(); this.redraw('favorite');
        toast(favs.has(key) ? 'Adicionado aos favoritos' : 'Removido dos favoritos', 2200, 'heart');
        Sound.confirm(); return;
      }
      if (a === 'a' && focusedEl?.dataset.detail === 'play') launch(sys, g);
    },
    defaultFocus() { setFocus($('#detailActions [data-detail="play"]'), true); },
  };

  /* ── lançar jogo (reutiliza o player.html da web, 1:1) ── */
  function launch(sysId, g) {
    Sound.confirm();
    recents = recents.filter(r => !(r.sys === sysId && r.file === g.file));
    recents.unshift({ sys: sysId, name: g.name, sub: g.subtitle || '', file: g.file, ts: Date.now() });
    saveRecents();
    const core = CAT[sysId].core || sysId;
    const url = `player.html?core=${encodeURIComponent(core)}&game=${encodeURIComponent(sysId + '/' + g.file)}&os=1`;
    toast(`Abrindo ${g.name}…`, 1200);
    setTimeout(() => { window.location.href = url; }, 260);
  }

  /* ════════════════════ TELA: AJUSTES ════════════════════ */
  const settingsScreen = {
    items: [],
    render() {
      const scr = $('#screen');
      scr.innerHTML = '';
      scr.appendChild(h('div', 'row-title', `<span class="accent">${icon('system')}</span> Ajustes do sistema`));
      const panel = h('div', 'full-panel');
      const body = h('div', 'ov-body'); body.id = 'setBody';
      body.appendChild(h('div', 'back-line', '<b>B</b> voltar · ←/→ ajustar valores'));
      panel.appendChild(body);
      scr.appendChild(panel);

      const mk = (id, type, iconName, lbl, sub) => {
        const it = h('div', 'set-item focusable');
        it.tabIndex = -1; it.dataset.set = id; it.dataset.type = type;
        it.innerHTML = `<span class="ic">${icon(iconName)}</span><div><div class="lbl">${lbl}</div>${sub ? `<div class="sub">${sub}</div>` : ''}</div>`;
        if (type === 'bar') it.insertAdjacentHTML('beforeend', `<span class="val"><span class="val-bar"><i style="width:0%"></i></span><span class="num">0%</span></span>`);
        else it.insertAdjacentHTML('beforeend', `<span class="arrow">${icon('chevronRight')}</span>`);
        body.appendChild(it);
        return it;
      };

      mk('wifi', 'go', 'wifi', 'Wi-Fi', statusCache.wifi && statusCache.wifi.connected ? 'Conectado: ' + esc(statusCache.wifi.ssid) : statusCache.wifi && statusCache.wifi.available === false ? 'Adaptador indisponível' : 'Não conectado');
      mk('bluetooth', 'go', 'bluetooth', 'Bluetooth', 'parear controles e dispositivos');
      mk('profile', 'go', 'profile', 'Perfil', 'avatar · atividade · conquistas');
      mk('appearance', 'go', 'sparkle', 'Aparência', 'tema: ' + esc(RVTheme.themes.find(t => t.id === RVTheme.saved()).name));
      mk('volume', 'bar', 'volume', 'Volume', 'áudio do sistema');
      mk('brightness', 'bar', 'brightness', 'Brilho da tela', 'backlight do LCD');
      mk('about', 'go', 'info', 'Sobre o console', 'versão · hardware · créditos');
      mk('reboot', 'go', 'reboot', 'Reiniciar', 'reinicia o console');
      mk('shutdown', 'go', 'power', 'Desligar', 'desliga com segurança');

      this.setBars();
      return scr;
    },
    async setBars() {
      const st = await RVBridge.status();
      statusCache.volume = st.volume; statusCache.brightness = st.brightness;
      Sound.setVolume(st.volume ?? 70);
      this.applyBar('volume', st.volume ?? 0);
      this.applyBar('brightness', st.brightness ?? 0);
    },
    applyBar(id, v) {
      const it = $(`.set-item[data-set="${id}"]`); if (!it) return;
      $('.val-bar i', it).style.width = v + '%';
      $('.num', it).textContent = v + '%';
    },
    bump(dir) {
      if (!focusedEl || focusedEl.dataset.type !== 'bar') return Sound.err();
      const id = focusedEl.dataset.set;
      const cur = id === 'volume' ? (statusCache.volume || 0) : (statusCache.brightness || 0);
      const v = Math.max(id === 'brightness' ? 10 : 0, Math.min(100, cur + dir * 5));
      if (id === 'volume') { statusCache.volume = v; RVBridge.setVolume(v); Sound.setVolume(v); Sound.confirm(); }
      else { statusCache.brightness = v; RVBridge.setBrightness(v); }
      this.applyBar(id, v);
    },
    onAction(a) {
      if (a === 'start' || a === 'home') return openPower();
      if (['up', 'down'].includes(a)) { const n = nearestIn(a, '#setBody'); if (n) setFocus(n); return; }
      if (a === 'left') return this.bump(-1);
      if (a === 'right') return this.bump(1);
      if (a === 'b') { popCtx(); Sound.back(); return; }
      if (a === 'a') {
        if (!focusedEl) return;
        const id = focusedEl.dataset.set;
        if (id === 'wifi') { Sound.open(); pushCtx(wifiScreen); }
        else if (id === 'bluetooth') { Sound.open(); pushCtx(bluetoothScreen); }
        else if (id === 'profile') { Sound.open(); pushCtx(profileScreen); }
        else if (id === 'appearance') { Sound.open(); pushCtx(appearanceScreen); }
        else if (id === 'about') { Sound.open(); pushCtx(aboutScreen); }
        else if (id === 'reboot') openPower('reboot');
        else if (id === 'shutdown') openPower('shutdown');
        else Sound.err();
      }
    },
    defaultFocus() { const it = $('.set-item'); if (it) setFocus(it, true); },
  };

  /* ════════════════════ TELA: APARÊNCIA ════════════════════ */
  const appearanceScreen = {
    render() {
      const scr = $('#screen'); scr.innerHTML = '';
      scr.appendChild(h('div', 'row-title', `<span class="accent">${icon('sparkle')}</span> Aparência · Temas`));
      const panel = h('div', 'full-panel');
      const body = h('div', 'ov-body'); body.id = 'themeBody';
      body.appendChild(h('p', 'theme-intro', 'Quatro identidades para toda a interface. A imagem dos jogos permanece original.'));
      const grid = h('div', 'theme-grid');
      RVTheme.themes.forEach(t => {
        const item = h('div', 'theme-card focusable' + (t.id === RVTheme.saved() ? ' applied' : ''), `
          <div class="theme-preview" style="--sample-bg:${t.colors[0]};--sample-accent:${t.colors[1]};--sample-extra:${t.colors[2]};--sample-line:color-mix(in srgb,${t.colors[1]} 32%,${t.colors[0]})">
            <div class="theme-rail"><i></i><i></i><i></i></div>
            <div class="theme-stage"><div class="theme-stage-top"></div><i class="theme-stage-card"></i><i class="theme-stage-card"></i></div>
          </div><div class="theme-caption"><div class="theme-name">${esc(t.name)}</div><div class="theme-note">${esc(t.note)}</div></div>`);
        item.tabIndex = -1; item.dataset.theme = t.id; grid.appendChild(item);
      });
      body.appendChild(grid);
      body.appendChild(h('div', 'theme-help', '<b>←/→/↑/↓</b> prévia · <b>A</b> aplicar · <b>B</b> voltar'));
      panel.appendChild(body); scr.appendChild(panel);
      RVTheme.preview(RVTheme.saved());
    },
    onAction(a) {
      if (a === 'start' || a === 'home') return openPower();
      if (a === 'b') {
        RVTheme.preview(RVTheme.saved());
        popCtx();
        setFocus($('#setBody [data-set="appearance"]'), true);
        Sound.back(); return;
      }
      if (['up','down','left','right'].includes(a)) {
        const next = nearestIn(a, '#themeBody');
        if (next) { setFocus(next); RVTheme.preview(next.dataset.theme); }
        return;
      }
      if (a === 'a' && focusedEl?.dataset.theme) {
        const id = focusedEl.dataset.theme;
        if (!RVTheme.commit(id)) return toast('Não foi possível salvar o tema.');
        $$('.theme-card').forEach(card => card.classList.toggle('applied', card.dataset.theme === id));
        Sound.confirm(); toast(RVTheme.themes.find(t => t.id === id).name + ' aplicado.');
      }
    },
    defaultFocus() {
      const card = $(`#themeBody .theme-card[data-theme="${RVTheme.saved()}"]`);
      if (card) setFocus(card, true);
    },
  };

  /* ════════════════════ TELA: WI-FI ════════════════════ */
  const wifiScreen = {
    nets: [], scanning: false, connecting: false, scanGeneration: 0,
    render() {
      this.scanGeneration++; this.scanning = false; // descarta varreduras de uma tela anterior
      const scr = $('#screen'); scr.innerHTML = '';
      scr.appendChild(h('div', 'row-title', `<span class="accent">${icon('wifi')}</span> Wi-Fi`));
      const panel = h('div', 'full-panel');
      const body = h('div', 'ov-body'); body.id = 'wifiBody';
      body.appendChild(h('div', 'back-line', '<b>A</b> conectar / atualizar · <b>B</b> voltar'));
      const retry = h('div', 'net-refresh focusable', icon('reboot') + '<span>Buscar redes novamente</span>');
      retry.tabIndex = -1; retry.dataset.action = 'scan'; body.appendChild(retry);
      panel.appendChild(body); scr.appendChild(panel);
      this.scan();
      return scr;
    },
    async scan() {
      if (this.scanning) return;
      const body = $('#wifiBody'); if (!body) return;
      const generation = ++this.scanGeneration;
      this.scanning = true;
      $$('.net-item, .spinner, .empty-note', body).forEach(el => el.remove());
      body.appendChild(h('div', 'spinner'));
      setFocus($('.net-refresh', body), true);
      let failure = null, nets = [];
      try {
        const r = await RVBridge.wifiScan();
        nets = (r.networks || []).sort((a, b) => (b.connected - a.connected) || (b.signal || 0) - (a.signal || 0));
      } catch (e) { failure = 'Não foi possível buscar redes. Verifique adaptador e NetworkManager.'; }
      if (generation !== this.scanGeneration || !body.isConnected) return;
      this.nets = nets;
      this.scanning = false;
      $('.spinner', body)?.remove();
      if (!this.nets.length) {
        body.appendChild(h('div', 'empty-note', failure || 'Nenhuma rede encontrada. Tente atualizar a busca.'));
        return;
      }
      this.nets.forEach(n => {
        const it = h('div', 'net-item focusable' + (n.connected ? ' connected' : ''));
        it.tabIndex = -1; it.dataset.ssid = n.ssid;
        const pct = Math.max(0, Math.min(100, Math.round(n.signal || 0)));
        it.innerHTML = `
          <span class="net-sig" style="opacity:${Math.max(0.4, pct / 100)}">${icon('wifi')}</span>
          <div class="device-label"><div class="lbl">${esc(n.ssid)}</div><div class="sub">${n.connected ? 'Conectado' : (n.secure ? 'Protegida' : 'Aberta')}</div></div>
          <span class="sig">${n.secure ? icon('lock', 'lock') : ''}${pct}%</span>`;
        body.appendChild(it);
      });
      setFocus($('.net-item', body), true);
    },
    onAction(a) {
      if (a === 'start' || a === 'home') return openPower();
      if (['up', 'down', 'left', 'right'].includes(a)) { const n = nearestIn(a, '#wifiBody'); if (n) setFocus(n); return; }
      if (a === 'b') { popCtx(); Sound.back(); return; }
      if (a !== 'a' || !focusedEl || this.scanning || this.connecting) return;
      if (focusedEl.dataset.action === 'scan') { this.scan(); return; }
      const ssid = focusedEl.dataset.ssid;
      const net = this.nets.find(n => n.ssid === ssid);
      if (!net) return;
      if (net.connected) { toast('Você já está conectado a esta rede.', 2200, 'wifi'); return; }
      Sound.confirm();
      if (net.secure === false) this.connect(ssid, '');
      else pushKeyboard(`Senha — ${ssid}`, pwd => this.connect(ssid, pwd), true);
    },
    async connect(ssid, psk) {
      if (this.connecting) return;
      this.connecting = true;
      toast(`Conectando a “${ssid}”…`, 5000);
      try {
        await RVBridge.wifiConnect(ssid, psk);
        toast(`Conectado a “${ssid}”`, 2200, 'check'); Sound.confirm();
        statusCache.wifi = { connected: true, ssid };
        await refreshStatus(true);
        if (top() === this) this.render();
      } catch (e) {
        toast('Falha ao conectar. Verifique senha e sinal.', 3500, 'warning'); Sound.err();
      } finally { this.connecting = false; }
    },
    defaultFocus() { setFocus($('.net-refresh'), true); },
  };

  /* ════════════════════ TELA: BLUETOOTH ════════════════════ */
  const bluetoothScreen = {
    devices: [], scanning: false, busy: false, pendingRemove: null, scanGeneration: 0,
    render() {
      this.scanGeneration++; this.scanning = false;
      const scr = $('#screen'); scr.innerHTML = '';
      scr.appendChild(h('div', 'row-title', `<span class="accent">${icon('bluetooth')}</span> Bluetooth`));
      const panel = h('div', 'full-panel');
      const body = h('div', 'ov-body'); body.id = 'btBody';
      body.appendChild(h('div', 'back-line', '<b>A</b> parear / conectar · <b>X</b> esquecer · <b>B</b> voltar'));
      const refresh = h('div', 'net-refresh focusable', icon('reboot') + '<span>Buscar dispositivos</span>');
      refresh.tabIndex = -1; refresh.dataset.action = 'scan'; body.appendChild(refresh);
      panel.appendChild(body); scr.appendChild(panel);
      this.scan(); return scr;
    },
    async scan(preferred) {
      if (this.scanning || this.busy) return;
      const body = $('#btBody'); if (!body) return;
      const generation = ++this.scanGeneration;
      this.scanning = true; this.pendingRemove = null;
      $$('.bt-device, .spinner, .empty-note, .bt-status', body).forEach(el => el.remove());
      body.appendChild(h('div', 'spinner'));
      setFocus($('.net-refresh', body), true);
      try {
        const result = await RVBridge.bluetoothScan();
        if (generation !== this.scanGeneration || !body.isConnected) return;
        $('.spinner', body)?.remove();
        this.devices = result.devices || [];
        if (!result.available) {
          body.appendChild(h('div', 'empty-note', 'Bluetooth indisponível. Verifique adaptador e serviço BlueZ.'));
          return;
        }
        const paired = this.devices.filter(d => d.paired).length;
        body.appendChild(h('div', 'bt-status', `${this.devices.length} dispositivo(s) · ${paired} pareado(s)`));
        if (!this.devices.length) body.appendChild(h('div', 'empty-note', 'Nenhum dispositivo encontrado. Ative o modo de pareamento e busque novamente.'));
        this.devices.forEach(d => {
          const item = h('div', 'net-item bt-device focusable' + (d.connected ? ' connected' : ''));
          item.tabIndex = -1; item.dataset.address = d.address;
          item.innerHTML = `<span class="net-sig">${icon('bluetooth')}</span><div class="device-label"><div class="lbl">${esc(d.name || 'Dispositivo Bluetooth')}</div><div class="sub">${d.connected ? 'Conectado · A desconectar' : d.paired ? 'Pareado · A conectar' : 'Disponível · A parear'} · ${esc(d.address)}</div></div>${d.connected ? icon('check', 'bt-check') : ''}`;
          body.appendChild(item);
        });
        setFocus(this.devices.length ? ($$('.bt-device', body).find(el => el.dataset.address === preferred) || $('.bt-device', body)) : $('.net-refresh', body), true);
      } catch (e) {
        if (generation === this.scanGeneration && body.isConnected) {
          this.devices = [];
          $('.spinner', body)?.remove();
          body.appendChild(h('div', 'empty-note', e.message || 'Não foi possível buscar dispositivos. Verifique Bluetooth/BlueZ.'));
        }
      } finally { if (generation === this.scanGeneration) this.scanning = false; }
    },
    async execute(address, action) {
      if (this.busy || this.scanning) return;
      this.busy = true; this.pendingRemove = null;
      const label = { pair:'Pareando', connect:'Conectando', disconnect:'Desconectando', remove:'Esquecendo' }[action];
      toast(`${label} dispositivo…`, 4500, 'bluetooth');
      try {
        await RVBridge.bluetoothAction(address, action);
        toast(action === 'pair' ? 'Dispositivo pareado e conectado.' : action === 'remove' ? 'Pareamento removido.' : action === 'connect' ? 'Dispositivo conectado.' : 'Dispositivo desconectado.', 2600, 'check');
        if (top() === this) {
          this.busy = false;
          await this.scan(address);
        }
      } catch (e) { toast(e.message || 'Falha no Bluetooth. Tente novamente.', 3500, 'warning'); Sound.err(); }
      finally { this.busy = false; }
    },
    onAction(a) {
      if (a === 'start' || a === 'home') return openPower();
      if (['up', 'down', 'left', 'right'].includes(a)) { this.pendingRemove = null; const n = nearestIn(a, '#btBody'); if (n) setFocus(n); return; }
      if (a === 'b') { popCtx(); Sound.back(); return; }
      if (!focusedEl || this.scanning || this.busy) return;
      if (a === 'a' && focusedEl.dataset.action === 'scan') return this.scan();
      const address = focusedEl.dataset.address;
      const d = this.devices.find(device => device.address === address);
      if (!d) return;
      if (a === 'a') {
        Sound.confirm();
        return this.execute(address, d.connected ? 'disconnect' : d.paired ? 'connect' : 'pair');
      }
      if (a === 'x' && d.paired) {
        if (this.pendingRemove === address) return this.execute(address, 'remove');
        this.pendingRemove = address;
        toast('Aperte X novamente para esquecer este dispositivo.', 3500, 'warning');
        setTimeout(() => { if (this.pendingRemove === address) this.pendingRemove = null; }, 3500);
      }
    },
    defaultFocus() { setFocus($('.net-refresh'), true); },
  };

  /* ════════════════════ TELA: PERFIL LOCAL ════════════════════ */
  const profileScreen = {
    render() {
      const data = RVProfile.snapshot(CAT, favs);
      const scr = $('#screen'); scr.innerHTML = '';
      scr.appendChild(h('div', 'row-title', `<span class="accent">${icon('profile')}</span> Perfil`));
      const panel = h('div', 'full-panel profile-panel');
      const header = h('div', 'profile-header', `
        <div class="profile-avatar"><img src="${data.avatar}" alt=""></div>
        <div class="profile-identity"><div class="profile-eyebrow">JOGADOR · NESTE DISPOSITIVO</div>
          <div class="profile-name">${esc(data.name)}</div>
          <div class="profile-time">${icon('gamepad')} ${RVProfile.fmtTime(data.stats.seconds)} de jogo</div></div>`);
      const actions = h('div', 'profile-actions');
      const edit = h('div', 'profile-edit focusable', `${icon('edit')} <span>Editar nome</span>`);
      edit.tabIndex = -1; edit.dataset.act = 'edit'; actions.appendChild(edit);
      const choose = h('div', 'profile-edit profile-avatar-action focusable', `${icon('profile')} <span>Avatar</span>`);
      choose.tabIndex = -1; choose.dataset.act = 'avatar'; actions.appendChild(choose);
      header.appendChild(actions); panel.appendChild(header);
      const body = h('div', 'ov-body profile-body'); body.id = 'profileBody';
      const tiles = [
        ['Sessões', data.stats.sessions], ['Jogos', data.stats.played],
        ['Consoles', data.stats.consoles], ['Favoritos', data.stats.favorites],
      ];
      body.insertAdjacentHTML('beforeend', `
        <div class="profile-stats">${tiles.map(([label, value]) =>
          `<div class="profile-stat"><b>${value}</b><span>${label}</span></div>`).join('')}</div>
        <div class="profile-sections">
          <section class="profile-section"><h2>${icon('gamepad')} Mais jogados</h2>
            ${data.top.length ? data.top.map((g, i) => `
              <div class="profile-game"><span class="profile-rank">${String(i + 1).padStart(2, '0')}</span>
                <div class="profile-game-info"><b>${esc(g.name)}</b><span>${esc(CAT[g.sys]?.short || g.sys || 'Jogo')}</span></div>
                <strong>${RVProfile.fmtTime(g.seconds)}</strong></div>`).join('') :
              '<p class="profile-empty">Nenhum jogo registrado ainda. Inicie um jogo para ver seu tempo aqui.</p>'}
          </section>
          <section class="profile-section"><h2>${icon('calendar')} Atividade · 12 semanas</h2>
            <div class="profile-activity-meta"><b>${data.streak} ${data.streak === 1 ? 'dia' : 'dias'}</b> de sequência</div>
            <div class="profile-calendar" role="img" aria-label="Atividade nos últimos 84 dias">
              ${data.days.map(d => `<i class="${d.future ? 'future' : d.seconds >= 7200 ? 'lv4' : d.seconds >= 3600 ? 'lv3' : d.seconds >= 900 ? 'lv2' : d.seconds > 0 ? 'lv1' : ''}" title="${d.key}: ${RVProfile.fmtTime(d.seconds)}"></i>`).join('')}
            </div><div class="profile-legend">menos <i></i><i class="lv1"></i><i class="lv2"></i><i class="lv3"></i><i class="lv4"></i> mais</div>
          </section>
        </div>
        <section class="profile-section profile-achievements"><h2>${icon('trophy')} Conquistas <span>${data.earned}/${data.achievements.length}</span></h2>
          <div class="profile-badges">${data.achievements.map(a => `
            <div class="profile-badge ${a.unlocked ? 'earned' : 'locked'}">
              <span class="profile-badge-icon">${icon(a.unlocked ? 'trophy' : 'lock')}</span>
              <div><b>${esc(a.title)}</b><small>${esc(a.desc)}</small></div></div>`).join('')}</div>
        </section>
        <div class="profile-note">Dados salvos apenas neste navegador, sem login. <b>↑/↓</b> rolar · <b>B</b> voltar</div>`);
      panel.appendChild(body); scr.appendChild(panel);
      return scr;
    },
    editName() {
      const previousScroll = $('#profileBody')?.scrollTop || 0;
      Sound.open();
      pushKeyboard('Nome do jogador', v => {
        if (RVProfile.saveName(v)) { refreshPlayerName(); toast('Nome atualizado.'); }
        else toast('Digite um nome para salvar.');
        this.render(); this.defaultFocus();
        $('#profileBody').scrollTop = previousScroll;
      }, false);
    },
    onAction(a) {
      if (a === 'start' || a === 'home') return openPower();
      if (a === 'b') { popCtx(); Sound.back(); return; }
      if (a === 'left' || a === 'right') {
        const target = a === 'left' ? $('.profile-edit[data-act="edit"]') : $('.profile-avatar-action');
        if (target && target !== focusedEl) setFocus(target);
        return;
      }
      if (a === 'a') {
        if (focusedEl?.dataset.act === 'avatar') {
          avatarPicker.previousScroll = $('#profileBody')?.scrollTop || 0;
          Sound.open(); pushCtx(avatarPicker); avatarPicker.render();
        } else this.editName();
        return;
      }
      if (a === 'up' || a === 'down') {
        const body = $('#profileBody');
        if (body) body.scrollTop += a === 'down' ? 75 : -75;
      }
    },
    defaultFocus() { const el = $('.profile-edit[data-act="edit"]'); if (el) setFocus(el, true); },
  };

  /* ════════════════════ SELETOR: AVATAR ════════════════════ */
  const avatarPicker = {
    previousScroll: 0,
    render() {
      const ov = $('#overlay'); ov.hidden = false; ov.innerHTML = '';
      const panel = h('div', 'ov-panel avatar-picker');
      panel.appendChild(h('div', 'ov-head', '<h2>Escolher avatar</h2><span class="ov-tag">A escolher · B voltar</span>'));
      const body = h('div', 'ov-body avatar-picker-body');
      const grid = h('div', 'avatar-grid');
      const current = RVProfile.avatar();
      RVProfile.avatars.forEach((path, index) => {
        const option = h('div', 'avatar-option focusable' + (path === current ? ' selected' : ''),
          `<img src="${path}" alt=""><span class="avatar-check">${path === current ? icon('check') : ''}</span>`);
        option.tabIndex = -1; option.setAttribute('role', 'button');
        option.setAttribute('aria-label', `Avatar ${index + 1}${path === current ? ', atual' : ''}`);
        option.dataset.avatar = path;
        grid.appendChild(option);
      });
      body.appendChild(grid); panel.appendChild(body); ov.appendChild(panel);
      setFocus($('.avatar-option.selected', grid) || $('.avatar-option', grid), true);
    },
    onAction(a) {
      if (['up', 'down', 'left', 'right'].includes(a)) {
        const n = nearestIn(a, '#overlay'); if (n) setFocus(n);
        return;
      }
      if (a === 'b') return this.close(false);
      if (a === 'a' && focusedEl?.dataset.avatar) {
        if (!RVProfile.saveAvatar(focusedEl.dataset.avatar)) return toast('Não foi possível salvar o avatar.');
        this.close(true);
      }
    },
    close(saved) {
      $('#overlay').hidden = true; $('#overlay').innerHTML = '';
      popCtx(true);
      $('#profileBody').scrollTop = this.previousScroll;
      setFocus($('.profile-avatar-action'), true);
      if (saved) { Sound.confirm(); toast('Avatar atualizado.'); }
      else Sound.back();
    },
  };

  /* ════════════════════ TELA: SOBRE ════════════════════ */
  const aboutScreen = {
    render() {
      const total = SYS_IDS.reduce((n, id) => n + CAT[id].games.length, 0);
      const scr = $('#screen');
      scr.innerHTML = '';
      scr.appendChild(h('div', 'row-title', `<span class="accent">${icon('info')}</span> Sobre o console`));
      const panel = h('div', 'full-panel');
      const body = h('div', 'ov-body'); body.id = 'aboutBody';
      body.appendChild(h('div', 'back-line', '<b>↑/↓</b> rolar · <b>B</b> voltar'));
      body.insertAdjacentHTML('beforeend', `
        <div class="about-list">
          <div class="about-logo"><img src="assets/rv-transparent-final-solid.png" alt=""></div>
          <div class="a-row"><span>Sistema</span><b>RetroVault OS ${OS_VERSION}</b></div>
          <div class="a-row"><span>Plataforma</span><b>${RVBridge.simulated ? 'Simulação (navegador)' : 'Console RetroVault'}</b></div>
          <div class="a-row"><span>Motor de emulação</span><b>EmulatorJS 4.2.3</b></div>
          <div class="a-row"><span>Consoles</span><b>${SYS_IDS.length}</b></div>
          <div class="a-row"><span>Jogos no catálogo</span><b>${total}</b></div>
          <div class="a-row"><span>IP local</span><b>${esc(statusCache.ip || '—')}</b></div>
          <div class="a-row"><span>Armazenamento de ROMs</span><b>/roms (cartão SD)</b></div>
        </div>`);
      panel.appendChild(body); scr.appendChild(panel);
      return scr;
    },
    onAction(a) {
      if (a === 'start' || a === 'home') return openPower();
      if (a === 'up' || a === 'down') {
        const body = $('#aboutBody');
        if (body) body.scrollTop += a === 'down' ? 64 : -64;
        return;
      }
      if (a === 'b' || a === 'a') { popCtx(); Sound.back(); }
    },
    defaultFocus() {},
  };

  /* ════════════════════ OVERLAY: ENERGIA ════════════════════ */
  function openPower(preselect) {
    if (top() === powerCtx) return;
    pushCtx(powerCtx);
    powerCtx.render(preselect);
  }
  const powerCtx = {
    confirmAction: null,
    render(preselect) {
      this.confirmAction = null;
      const ov = $('#overlay'); ov.hidden = false; ov.innerHTML = '';
      const panel = h('div', 'ov-panel');
      panel.appendChild(h('div', 'ov-head', '<h2>Energia</h2><span class="ov-tag">RetroVault OS</span>'));
      const body = h('div', 'ov-body');
      const mk = (act, icon, lbl, sub, danger) => {
        const it = h('div', 'ov-item focusable' + (danger ? ' danger' : ''));
        it.tabIndex = -1; it.dataset.act = act;
        it.innerHTML = `${RVIcons.render(icon, 'ic')}<div><div class="lbl">${lbl}</div><div class="sub">${sub}</div></div>`;
        body.appendChild(it);
      };
      mk('back', 'resume', 'Continuar jogando', 'voltar para a shell');
      mk('reboot', 'reboot', 'Reiniciar', 'reinicia o console');
      mk('shutdown', 'power', 'Desligar', 'desliga com segurança', true);
      panel.appendChild(body); ov.appendChild(panel);
      let el = $('.ov-item');
      if (preselect) el = $(`.ov-item[data-act="${preselect}"]`) || el;
      setFocus(el, true);
    },
    onAction(a) {
      if (['up', 'down'].includes(a)) { this.confirmAction = null; const n = nearestIn(a, '#overlay'); if (n) setFocus(n); return; }
      if (a === 'b' || a === 'start' || a === 'home') { this.close(); return; }
      if (a === 'a' && focusedEl) {
        const act = focusedEl.dataset.act;
        if (act === 'back') { this.close(); return; }
        if (this.confirmAction !== act) {
          this.confirmAction = act;
          toast(`Aperte A novamente para ${act === 'shutdown' ? 'DESLIGAR' : 'REINICIAR'}` , 3500);
          Sound.err(); return;
        }
        this.close(true);
        powerAction(act);
      }
    },
    close(silent) { this.confirmAction = null; $('#overlay').hidden = true; $('#overlay').innerHTML = ''; popCtx(true); if (!silent) Sound.back(); },
  };
  const OS_VERSION = '1.0.0';

  /* ════════════════════ OVERLAY: TECLADO VIRTUAL ════════════════════ */
  const KBD_ROWS = [
    '1234567890',
    'qwertyuiop',
    'asdfghjkl',
    'zxcvbnm.-',
    '@_!#$%&*+',
  ];
  // Y alterna maiúsculas e oferece símbolos adicionais para senhas Wi-Fi.
  const KBD_SHIFT_SYMBOLS = `/:;=?'"\\^~`;
  const keyboardCtx = {
    title: '', cb: null, secure: false, shift: false, value: '',
    open(title, cb, secure) {
      this.title = title; this.cb = cb; this.secure = secure; this.value = ''; this.shift = false;
      this.render();
    },
    render() {
      const ov = $('#overlay'); ov.hidden = false; ov.innerHTML = '';
      const panel = h('div', 'ov-panel'); panel.style.width = 'min(680px, 94vw)';
      panel.appendChild(h('div', 'ov-head', `<h2>${esc(this.title)}</h2><span class="ov-tag">A digita · B apaga · Y maiúsc.</span>`));
      const body = h('div', 'ov-body');
      this.display = h('div', 'kbd-display');
      body.appendChild(this.display);
      this.gridEl = h('div', 'kbd-grid');
      body.appendChild(this.gridEl);
      panel.appendChild(body); ov.appendChild(panel);
      this.renderKeys();
      this.updateDisplay();
      const first = $('.key', this.gridEl); if (first) setFocus(first, true);
    },
    renderKeys() {
      this.gridEl.innerHTML = '';
      KBD_ROWS.forEach((row, rowIndex) => {
        const line = h('div', 'kbd-row');
        for (const ch of (this.shift && rowIndex === 4 ? KBD_SHIFT_SYMBOLS : row)) {
          const c = this.shift ? ch.toUpperCase() : ch;
          const k = h('div', 'key focusable', esc(c)); k.tabIndex = -1; k.dataset.key = c;
          line.appendChild(k);
        }
        this.gridEl.appendChild(line);
      });
      const actions = h('div', 'kbd-row actions');
      [['shift', this.shift ? 'ABC' : 'abc', 'wide', 'shift'], ['space', 'espaço', 'wide'], ['back', 'apagar', 'wide', 'backspace'],
       ['ok', this.secure ? 'conectar' : this.title === 'Buscar jogo' ? 'buscar' : 'concluir', 'wide action', 'check']].forEach(([act, lbl, cls, glyph]) => {
        const k = h('div', 'key focusable ' + cls, (glyph ? icon(glyph) : '') + `<span>${lbl}</span>`); k.tabIndex = -1; k.dataset.act = act;
        actions.appendChild(k);
      });
      this.gridEl.appendChild(actions);
    },
    updateDisplay() {
      const shown = this.secure ? '•'.repeat(this.value.length) : this.value;
      this.display.innerHTML = esc(shown) + '<span class="caret"></span>';
    },
    onAction(a) {
      if (['up', 'down', 'left', 'right'].includes(a)) { const n = nearestIn(a, '#overlay'); if (n) setFocus(n); return; }
      if (a === 'y') { this.shift = !this.shift; const f = focusedEl && (focusedEl.dataset.key || focusedEl.dataset.act); this.renderKeys();
        const el = f ? $(`[data-key="${f}"],[data-act="${f}"]`, this.gridEl) : $('.key', this.gridEl); if (el) setFocus(el, true); return; }
      if (a === 'b') {
        if (this.value.length) { this.value = this.value.slice(0, -1); this.updateDisplay(); Sound.back(); }
        else { $('#overlay').hidden = true; $('#overlay').innerHTML = ''; popCtx(true); Sound.back(); }
        return;
      }
      if (a === 'a' && focusedEl) {
        if (focusedEl.dataset.key) {
          if (this.value.length >= 63) return Sound.err();
          this.value += focusedEl.dataset.key; this.updateDisplay(); Sound.type(); return;
        }
        const act = focusedEl.dataset.act;
        if (act === 'shift') { handleAction('y'); return; }
        if (act === 'space') { if (this.value.length >= 63) return Sound.err(); this.value += ' '; this.updateDisplay(); Sound.type(); return; }
        if (act === 'back') { this.value = this.value.slice(0, -1); this.updateDisplay(); Sound.back(); return; }
        if (act === 'ok') {
          const v = this.value, cb = this.cb;
          $('#overlay').hidden = true; $('#overlay').innerHTML = ''; popCtx(true);
          Sound.confirm(); if (cb) cb(v);
        }
      }
    },
  };
  function pushKeyboard(title, cb, secure) { pushCtx(keyboardCtx); keyboardCtx.open(title, cb, secure); }

  /* ─────────────────── pilha ─────────────────── */
  function screenPulse() { // micro-transição de entrada da tela
    const scr = $('#screen');
    if (!scr) return;
    scr.classList.remove('screen-in');
    void scr.offsetWidth;
    scr.classList.add('screen-in');
  }
  function updateHints() {
    const ctx = top();
    $('[data-h="b"]', $('#hints')).hidden = ctx === homeScreen;
    const xHint = $('[data-h="x"]', $('#hints'));
    xHint.hidden = ctx !== bluetoothScreen && ctx !== consoleScreen && ctx !== gameDetailScreen && !(ctx === homeScreen && recents.length);
    $('em', xHint).textContent = ctx === bluetoothScreen ? 'Esquecer' : 'Favorito';
    $('[data-h="y"]', $('#hints')).hidden = ctx !== consoleScreen;
    $('[data-h="select"]', $('#hints')).hidden = ctx !== consoleScreen && ctx !== gameDetailScreen;
    $('em', $('[data-h="a"]', $('#hints'))).textContent = ctx === consoleScreen ? 'Jogar' : ctx === gameDetailScreen ? 'Escolher' : 'Confirmar';
    $('[data-h="start"]', $('#hints')).hidden = ctx === wizard || (window.innerWidth <= 520 && (ctx === consoleScreen || ctx === gameDetailScreen));
  }
  function pushCtx(ctx) {
    stack.push(ctx);
    updateHints();
    if (ctx !== powerCtx && ctx !== keyboardCtx && ctx !== avatarPicker) {
      ctx.render();
      $('#screen').scrollTop = 0; // nova tela não herda o scroll da biblioteca/home anterior
      ctx._rendered = true; screenPulse();
    }
    if (ctx.defaultFocus) ctx.defaultFocus();
  }
  function popCtx(silent) {
    if (stack.length <= 1) return;
    stack.pop();
    const ctx = top();
    updateHints();
    if (ctx && ctx._rendered) { ctx.render(); ctx.defaultFocus(); screenPulse(); }
  }

  /* ─────────────────── energia ─────────────────── */
  async function powerAction(kind) {
    const veil = h('div', '', `<div style="text-align:center">
      <img src="assets/rv-transparent-final-solid.png" style="width:110px;filter:drop-shadow(0 0 24px rgba(0,255,65,.55))">
      <div style="margin-top:18px;letter-spacing:.2em;text-transform:uppercase;color:#9fe5b0">${kind === 'reboot' ? 'Reiniciando…' : 'Desligando…'}</div></div>`);
    veil.style.cssText = 'position:fixed;inset:0;z-index:200;background:#020503;display:flex;align-items:center;justify-content:center;';
    document.body.appendChild(veil);
    try {
      const r = await RVBridge.power(kind);
      if (r && r.ok === false && r.error !== 'simulated') throw new Error('Falha no comando');
      if (r && r.ok === false && r.error === 'simulated') {
        await new Promise(r2 => setTimeout(r2, 900));
        if (kind === 'reboot') { location.reload(); return; }
        veil.remove(); toast('Simulação: no console, ele desligaria agora.');
      }
      // no hardware, o sistema desliga de verdade — não há retorno
    } catch (e) {
      await new Promise(r2 => setTimeout(r2, 900));
      veil.remove(); toast('Não foi possível ' + (kind === 'reboot' ? 'reiniciar' : 'desligar') + '.');
    }
  }

  /* ─────────────────── barra de status ─────────────────── */
  const statusCache = { wifi: null, ip: '', volume: 70, brightness: 85 };
  function refreshPlayerName() {
    const el = $('#sbPlayer'); if (!el) return;
    const n = RVProfile.name();
    if (n) { el.hidden = false; el.textContent = n; } else el.hidden = true;
  }
  function tickClock() {
    const d = new Date();
    $('#sbClock').textContent = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }
  async function refreshStatus(now) {
    try {
      const st = await RVBridge.status();
      statusCache.wifi = st.wifi; statusCache.ip = st.ip;
      const net = $('#sbNet');
      if (st.wifi && st.wifi.connected) { net.classList.add('online'); net.title = 'Wi-Fi: ' + st.wifi.ssid; }
      else { net.classList.remove('online'); net.title = 'Sem rede'; }
      const batt = $('#sbBatt');
      if (st.battery && st.battery.percent != null) {
        batt.hidden = false;
        $('#sbBattTxt').textContent = st.battery.percent + '%';
        batt.classList.toggle('low', st.battery.percent <= 20);
        batt.classList.toggle('charging', !!st.battery.charging);
      } else batt.hidden = true;
    } catch (e) { /* mantém último estado */ }
  }

  /* ───── inicialização: firmware cuida do splash, shell abre direto ───── */
  async function ensureCatalog() { // recarrega dinamicamente se o 1º load falhou
    for (let i = 0; i < 3; i++) {
      CAT = window.CATALOG || {}; SYS_IDS = Object.keys(CAT);
      if (SYS_IDS.length) return true;
      await new Promise(res => {
        const s = document.createElement('script');
        s.src = 'js/catalog.js?r=' + Date.now();
        s.onload = res; s.onerror = res;
        document.head.appendChild(s);
        setTimeout(res, 4000);
      });
    }
    return false;
  }

  async function initializeShell() {
    if (!(await ensureCatalog())) {
      $('#app').hidden = false;
      $('#screen').appendChild(h('div', 'empty-note', 'Catálogo não encontrado. Rode tools/sync-from-web.sh e recarregue a interface.'));
      return;
    }
    // Migra favoritos da shell antiga para o formato que o player já lê.
    favs = new Set([...favs].filter(key => SYS_IDS.some(sys =>
      (CAT[sys].games || []).some(g => sys + ':' + g.file === key))));
    saveFavs();
    RVProfile.syncName();
    await RVBridge.detect();
    $('#sbSim').hidden = !RVBridge.simulated;
    $('#app').hidden = false;
    pushCtx(store('rvos:setup:done') ? homeScreen : wizard);
    tickClock(); setInterval(tickClock, 10000);
    refreshPlayerName();
    refreshStatus(true); setInterval(refreshStatus, 20000);
  }

  /* ════════════════════ ASSISTENTE DE PRIMEIRO BOOT ════════════════════
     Mostrado uma única vez (flag rvos:setup:done). Etapas:
     boas-vindas → wi-fi (opcional) → teste de botões → nome → concluir.
     ═══════════════════════════════════════════════════════════════════ */
  const wizard = {
    step: 0,
    steps: ['welcome', 'wifi', 'buttons', 'name', 'done'],
    connectedSsid: null,
    seenBtns: new Set(),
    _raf: null,

    /* ciclo de vida do ctx */
    render() {
      if (this._raf) { cancelAnimationFrame(this._raf); this._raf = null; }
      const scr = $('#screen');
      scr.innerHTML = '';
      const wrap = h('div', 'wizard');
      scr.appendChild(wrap);
      this['step_' + this.steps[this.step]](wrap);
    },
    defaultFocus() {
      const el = $('#screen .wiz-btn.primary') || $('#screen .net-item') || $('#screen .focusable');
      if (el) setFocus(el, true);
    },

    header(wrap, titulo, sub) {
      const head = h('div', 'wiz-head', `
        <div class="wiz-step-n">${this.step + 1}/${this.steps.length}</div>
        <div><div class="wiz-title">${titulo}</div><div class="wiz-sub">${sub || ''}</div></div>`);
      wrap.appendChild(head);
    },
    dots(wrap) {
      const d = h('div', 'wiz-dots');
      this.steps.forEach((_, i) => d.appendChild(h('i', i === this.step ? 'on' : (i < this.step ? 'done' : ''))));
      wrap.appendChild(d);
    },
    btn(wrap, label, act, cls) {
      const next = /\s*▶$/.test(label);
      const b = h('div', 'wiz-btn focusable' + (cls ? ' ' + cls : ''), `<span>${esc(label.replace(/\s*▶$/, ''))}</span>${next ? icon('arrowRight') : ''}`);
      b.tabIndex = -1; b.dataset.act = act;
      wrap.appendChild(b);
      return b;
    },
    next(silent) {
      this.step++;
      if (this.step >= this.steps.length) return this.finish();
      this.render();
      this.defaultFocus();
      Sound.open();
    },
    finish(skip) {
      store('rvos:setup:done', true);
      if (this._raf) { cancelAnimationFrame(this._raf); this._raf = null; }
      refreshPlayerName();
      stack.pop();
      $('#screen').innerHTML = '';
      if (!skip) Sound.success();
      pushCtx(homeScreen);
      if (!skip) setTimeout(() => toast(`Bem-vindo(a), ${this.playerName()}!`, 2200, 'gamepad'), 700);
    },
    playerName() { return RVProfile.name() || 'Jogador'; },

    /* ── 1. boas-vindas ── */
    step_welcome(wrap) {
      wrap.insertAdjacentHTML('beforeend', `
        <div class="wiz-hero">
          <img src="assets/rv-transparent-final-solid.png" alt="">
          <div class="wiz-big">Bem-vindo ao <b>RetroVault OS</b></div>
          <div class="wiz-text">Seu console portátil está quase pronto. Vamos configurar
          rede, controle e seu nome de jogador em menos de um minuto.</div>
        </div>`);
      this.btn(wrap, 'Começar  ▶', 'go', 'primary');
      this.dots(wrap);
      wrap.appendChild(h('div', 'wiz-hint', '<b>A</b> começar · <b>B</b> pular tudo'));
    },

    /* ── 2. wi-fi (opcional) ── */
    async step_wifi(wrap) {
      this.header(wrap, 'Conectar ao Wi-Fi', 'Para baixar jogos e capas. É opcional — ROMs no cartão funcionam offline.');
      const list = h('div', 'wiz-list');
      list.appendChild(h('div', 'spinner'));
      wrap.appendChild(list);
      let nets = [], scanFailed = false;
      try { nets = ((await RVBridge.wifiScan()).networks || []).sort((a, b) => (b.signal || 0) - (a.signal || 0)); }
      catch (e) { scanFailed = true; }
      if (!list.isConnected) return;
      $('.spinner', list) && $('.spinner', list).remove();
      nets.slice(0, 6).forEach(n => {
        const it = h('div', 'net-item focusable' + ((n.connected || this.connectedSsid === n.ssid) ? ' connected' : ''));
        it.tabIndex = -1; it.dataset.ssid = n.ssid; it.dataset.secure = n.secure ? '1' : '';
        const pct = Math.round(n.signal || 0);
        it.innerHTML = `<svg class="net-sig" viewBox="0 0 24 24" fill="currentColor" opacity="${Math.max(0.25, pct / 100)}"><path d="M12 21l3.5-4.5c-.9-.7-2.1-1.2-3.5-1.2s-2.6.4-3.5 1.2L12 21z"/></svg>
          <div><div class="lbl">${esc(n.ssid)}</div><div class="sub">${(n.connected || this.connectedSsid === n.ssid) ? 'Conectado' : (n.secure ? 'Protegida' : 'Aberta')}</div></div>
          <span class="sig">${pct}%</span>`;
        list.appendChild(it);
      });
      if (!nets.length) list.appendChild(h('div', 'empty-note', scanFailed ? 'Wi-Fi indisponível. Confira adaptador e NetworkManager; você pode continuar offline.' : 'Nenhuma rede encontrada. Você pode continuar offline.'));
      this.btn(wrap, this.connectedSsid ? 'Avançar  ▶' : 'Continuar sem Wi-Fi', 'go', this.connectedSsid ? 'primary' : '');
      this.dots(wrap);
      wrap.appendChild(h('div', 'wiz-hint', '<b>A</b> conectar/avançar · <b>B</b> voltar'));
      this.defaultFocus();
    },

    /* ── 3. teste de botões ── */
    step_buttons(wrap) {
      this.header(wrap, 'Testar o controle', 'Aperte os botões do console e veja acender na tela.');
      wrap.insertAdjacentHTML('beforeend', `
        <div class="padtest" id="padTest">
          <div class="pt-cluster">
            <div class="pt-dpad">
              <i data-b="12" class="pt up">▲</i><i data-b="14" class="pt lf">◀</i>
              <i data-b="15" class="pt rt">▶</i><i data-b="13" class="pt dn">▼</i>
            </div>
          </div>
          <div class="pt-cluster">
            <div class="pt-shoulders"><i data-b="4" class="pt sh">L</i><i data-b="5" class="pt sh">R</i></div>
            <div class="pt-face">
              <i data-b="3" class="pt y">Y</i><i data-b="2" class="pt x">X</i>
              <i data-b="1" class="pt b">B</i><i data-b="0" class="pt a">A</i>
            </div>
          </div>
          <div class="pt-cluster">
            <div class="pt-mid"><i data-b="8" class="pt mid">SELECT</i><i data-b="9" class="pt mid">START</i></div>
          </div>
        </div>
        <div class="wiz-text center" id="padStatus">Detectando controle…</div>`);
      this.btn(wrap, 'Avançar  ▶', 'go', 'primary');
      this.dots(wrap);
      wrap.appendChild(h('div', 'wiz-hint', 'Sem controle agora? Avance e teste os botões depois.'));
      const loop = () => {
        if (!$('#padTest')) return;
        const pads = navigator.getGamepads ? Array.from(navigator.getGamepads()).filter(p => p && p.connected) : [];
        const st = $('#padStatus');
        if (!pads.length) st.textContent = 'Nenhum controle físico detectado — setas + Enter funcionam.';
        else {
          let pressedNames = [];
          pads.forEach(gp => {
            gp.buttons.forEach((b, bi) => {
              const el = $(`#padTest [data-b="${bi}"]`);
              if (el && b.pressed) { el.classList.add('on'); this.seenBtns.add(bi); pressedNames.push(bi); }
            });
          });
          st.textContent = `Controle: ${pads[0].id.slice(0, 32)} · ${this.seenBtns.size} botões testados`;
        }
        this._raf = requestAnimationFrame(loop);
      };
      loop();
    },

    /* ── 4. nome do jogador ── */
    step_name(wrap) {
      this.header(wrap, 'Como te chamamos?', 'Sem login, sem conta: é só um apelido local do console.');
      wrap.insertAdjacentHTML('beforeend', `<div class="wiz-name" id="wizName">${esc(this.playerName())}</div>`);
      const editBtn = this.btn(wrap, 'Alterar nome', 'edit'); editBtn.insertAdjacentHTML('afterbegin', icon('edit'));
      this.btn(wrap, 'Avançar  ▶', 'go', 'primary');
      this.dots(wrap);
      wrap.appendChild(h('div', 'wiz-hint', '<b>A</b> escolher · <b>B</b> voltar'));
      const go = $$('.wiz-btn', wrap).find(b => b.dataset.act === 'go');
      if (go) setFocus(go, true);
    },

    /* ── 5. pronto ── */
    step_done(wrap) {
      wrap.insertAdjacentHTML('beforeend', `
        <div class="wiz-hero">
          <img src="assets/rv-transparent-final-solid.png" alt="">
          <div class="wiz-big">Tudo pronto, <b>${esc(this.playerName())}</b>!</div>
          <div class="wiz-text">
            Rede: <b>${this.connectedSsid ? esc(this.connectedSsid) : 'offline (ROMs no cartão)'}</b><br>
            Controle: ${this.seenBtns.size ? `<b>${this.seenBtns.size} botões testados</b>` : 'não testado (valide no console)'}<br><br>
            Dica: dentro de qualquer jogo, segure <b>START + SELECT</b> para abrir o menu do jogo.
          </div>
        </div>`);
      this.btn(wrap, 'Entrar no RetroVault  ▶', 'finish', 'primary');
      this.dots(wrap);
      wrap.appendChild(h('div', 'wiz-hint', '<b>A</b> concluir'));
    },

    /* ── ações ── */
    onAction(a) {
      const step = this.steps[this.step];
      if (a === 'b') {
        if (step === 'welcome') { this.finish(true); return; }
        this.step--; this.render(); Sound.back(); return;
      }
      if (['left', 'right', 'up', 'down'].includes(a)) {
        const n = nearestIn(a, $('#screen'));
        if (n) setFocus(n);
        return;
      }
      if (a !== 'a' || !focusedEl) return;
      const act = focusedEl.dataset.act;
      if (act === 'go') return this.next();
      if (act === 'finish') return this.finish();
      if (act === 'edit') {
        pushKeyboard('Seu nome de jogador', (v) => {
          const val = v.trim().slice(0, 18);
          if (RVProfile.saveName(val)) { refreshPlayerName(); toast(`Olá, ${RVProfile.name()}!`); }
          this.render();
        }, false);
        return;
      }
      if (focusedEl.dataset.ssid) { // rede do passo wi-fi
        const ssid = focusedEl.dataset.ssid;
        const secure = focusedEl.dataset.secure === '1';
        Sound.confirm();
        const connect = async (psk) => {
          toast(`Conectando a “${ssid}”…`, 6000);
          try {
            const r = await RVBridge.wifiConnect(ssid, psk || '');
            if (r && r.ok === false) throw new Error('falhou');
            this.connectedSsid = ssid; statusCache.wifi = { connected: true, ssid };
            refreshStatus(true); toast('Conectado', 2200, 'check'); Sound.confirm();
          } catch (e) { toast('Falha ao conectar. Verifique a senha.'); Sound.err(); }
          this.render();
        };
        if (secure) pushKeyboard(`Senha — ${ssid}`, (pwd) => connect(pwd), true);
        else connect('');
      }
    },
  };

  /* Clique no PC ainda seleciona itens na prévia; nenhum controle virtual é desenhado.
     No aparelho a navegação continua pela Gamepad API do controle físico. */
  function setupPointerPreview() {
    document.addEventListener('pointerdown', (e) => {
      const el = e.target.closest('.focusable');
      if (!el) return;
      e.preventDefault();
      setFocus(el, true);
      handleAction('a');
    }, { passive: false });
  }

  /* ─────────────────── arranque ─────────────────── */
  window.addEventListener('gamepadconnected', () => toast('Controle conectado', 2200, 'gamepad'));
  RVInput.onAction(handleAction);
  setupPointerPreview();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initializeShell);
  else initializeShell();
})();

/* ═══════════════════════════════════════════════════════════
   RETROVAULT WEB — EXTRAS   (js/rv-extras.js)
   ───────────────────────────────────────────────────────────
   Recursos de produto usados pelas páginas (index/games/profile):

   • RVX.randomGame()         → jogo aleatório (respeita o Controle dos pais)
   • RVX.status / filtros     → "jogando / zerado / quero zerar" (rv_status)
   • RVX.playtime             → tempo de jogo real (rv_playtime) + atividade
                                diária (rv_activity) — gravados na play.html
   • RVX.heatmap(el)          → calendário de atividade + streak
   • RVX.COLLECTIONS          → coleções curadas (coleção por console)
   • RVX.whatsNew()           → modal "O que há de novo" (1× por versão)
   • RVX.shareAchievement()   → card PNG da conquista (baixar/compartilhar)
   • RVX.shareProfileCard()   → card PNG do perfil com estatísticas
   • Instalar o app           → botão quando o navegador oferece a instalação
   • Pílula de atualização    → avisa quando o site atualizou no fundo

   Tudo em modo convidado funciona: os dados usam o RVStore (dono atual).
   ═══════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';

  var VERSION = '2026.09.20'; /* mude para reabrir as novidades 1x por perfil */
  var K_STATUS = 'rv_status';
  var K_TIME = 'rv_playtime';
  var K_ACT = 'rv_activity';

  var CORES = {
    snes: 'snes', nes: 'nes', gba: 'gba', gbc: 'gbc', sega: 'segaMD',
    arcade: 'fbneo', n64: 'n64', psx: 'pcsx_rearmed', nds: 'nds',
    segacd: 'segaCD', gamegear: 'segaGG', mastersystem: 'segaMS', atari2600: 'atari2600'
  };
  var CONSOLE_NAMES = {
    snes: 'Super Nintendo', nes: 'Nintendo', gba: 'GBA', gbc: 'Game Boy Color',
    sega: 'Mega Drive', arcade: 'Arcade', n64: 'Nintendo 64', psx: 'PlayStation',
    nds: 'Nintendo DS', segacd: 'Sega CD', gamegear: 'Game Gear',
    mastersystem: 'Master System', atari2600: 'Atari 2600'
  };

  /* ── base ── */
  function storeGet(k) {
    try { return global.RVStore ? RVStore.getItem(k) : localStorage.getItem(k); } catch (e) { return null; }
  }
  function storeSet(k, v) {
    try { if (global.RVStore) { RVStore.setItem(k, v); return; } localStorage.setItem(k, v); } catch (e) { }
  }
  function jget(k, fb) { try { var v = JSON.parse(storeGet(k)); return v === null || v === undefined ? fb : v; } catch (e) { return fb; } }
  function jset(k, v) { storeSet(k, JSON.stringify(v)); }
  function catalogGames(consoleKey) {
    var c = global.CATALOG && CATALOG[consoleKey];
    return (c && c.games) || [];
  }
  function allConsoles() { return global.CATALOG ? Object.keys(CATALOG) : Object.keys(CORES); }
  function gameKey(consoleKey, file) { return consoleKey + '/' + file; }
  function todayKey(d) {
    d = d || new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function emit(name, detail) { try { global.dispatchEvent(new CustomEvent(name, { detail: detail })); } catch (e) { } }

  /* ── consoles permitidos (Controle dos pais da config.html) ── */
  function allowedConsoles() {
    var cfg = jget('rv_emu_settings_v1', {}) || {};
    if (!cfg.parentPin) return allConsoles();
    var ok = Array.isArray(cfg.parentConsoles) ? cfg.parentConsoles : [];
    return ok.length ? ok : allConsoles();
  }

  /* ═════════ JOGO ALEATÓRIO ═════════ */
  function randomGame(consoleKey) {
    var pools = (consoleKey ? [consoleKey] : allowedConsoles()).filter(function (c) { return catalogGames(c).length; });
    if (!pools.length) return null;
    var c = pools[Math.floor(Math.random() * pools.length)];
    var games = catalogGames(c);
    var g = games[Math.floor(Math.random() * games.length)];
    return {
      console: c, file: g.file, name: g.name,
      url: 'play.html?core=' + CORES[c] + '&game=' + c + '/' + encodeURIComponent(g.file)
    };
  }
  function goToRandomGame(consoleKey) {
    var pick = randomGame(consoleKey);
    if (pick) global.location.href = pick.url;
  }

  /* ═════════ STATUS DO JOGO (jogando / zerado / quero zerar) ═════════ */
  var STATUS_CYCLE = ['playing', 'done', 'wish'];
  var STATUS_LABEL = { playing: 'Jogando', done: 'Zerado', wish: 'Quero zerar' };
  function statusMap() { return jget(K_STATUS, {}) || {}; }
  function statusOf(gkey) { var m = statusMap()[gkey]; return m ? m.s : ''; }
  function setStatus(gkey, s) {
    var m = statusMap();
    if (!s) delete m[gkey]; else m[gkey] = { s: s, at: Date.now() };
    jset(K_STATUS, m);
    emit('rvx-status-changed', { key: gkey, status: s });
  }
  function cycleStatus(gkey) {
    var cur = statusOf(gkey);
    var next = STATUS_CYCLE[(STATUS_CYCLE.indexOf(cur) + 1) % (STATUS_CYCLE.length + 1)] || '';
    setStatus(gkey, next);
    return next;
  }
  function statusCounts() {
    var m = statusMap(), out = { playing: 0, done: 0, wish: 0 };
    Object.keys(m).forEach(function (k) { if (out[m[k].s] !== undefined) out[m[k].s]++; });
    return out;
  }

  /* ═════════ TEMPO DE JOGO / ATIVIDADE ═════════ */
  function playtimeMap() { return jget(K_TIME, {}) || {}; }
  function playtimeOf(gkey) { return playtimeMap()[gkey] || 0; }
  function totalPlaytime() {
    var m = playtimeMap(), t = 0;
    Object.keys(m).forEach(function (k) { t += m[k] || 0; });
    return t;
  }
  function activityMap() { return jget(K_ACT, {}) || {}; }
  function fmtTime(sec) {
    sec = Math.max(0, Math.round(sec));
    var h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60);
    if (h >= 1) return h + 'h ' + (m ? m + 'min' : '').trim();
    if (m >= 1) return m + 'min';
    return sec > 0 ? 'menos de 1min' : '0min';
  }
  function streakDays() {
    var act = activityMap(), streak = 0;
    var d = new Date();
    /* hoje sem atividade ainda não quebra a sequência: começa de ontem */
    if (!act[todayKey(d)]) d.setDate(d.getDate() - 1);
    while (act[todayKey(d)]) { streak++; d.setDate(d.getDate() - 1); }
    return streak;
  }
  function topPlayed(n) {
    n = n || 5;
    var m = playtimeMap();
    return Object.keys(m).map(function (k) {
      var parts = k.split('/');
      var g = catalogGames(parts[0]).filter(function (x) { return x.file === parts[1]; })[0];
      return { key: k, console: parts[0], file: parts[1], name: g ? g.name : parts[1], seconds: m[k] };
    }).filter(function (x) { return x.seconds > 30; })
      .sort(function (a, b) { return b.seconds - a.seconds; }).slice(0, n);
  }

  /* ═════════ HEATMAP DE ATIVIDADE ═════════ */
  function renderHeatmap(el, weeks) {
    weeks = weeks || 15;
    if (!el) return;
    var act = activityMap();
    var end = new Date(); end.setHours(0, 0, 0, 0);
    var start = new Date(end); start.setDate(start.getDate() - (weeks * 7 - 1));
    start.setDate(start.getDate() - start.getDay()); /* começa no domingo */
    var html = '<div class="rvx-heat-grid" role="img" aria-label="Calendário de tempo de jogo">';
    var d = new Date(start), total = 0;
    while (d <= end) {
      var k = todayKey(d), sec = act[k] || 0; total += sec;
      var lvl = sec <= 0 ? 0 : sec < 900 ? 1 : sec < 2700 ? 2 : sec < 5400 ? 3 : 4;
      html += '<span class="rvx-heat-cell lv' + lvl + '" title="' +
        d.toLocaleDateString('pt-BR') + ' · ' + fmtTime(sec) + '"></span>';
      d.setDate(d.getDate() + 1);
    }
    html += '</div>';
    html += '<div class="rvx-heat-legend"><span>' + fmtTime(total) + ' nos últimos ' + weeks + ' semanas</span>' +
      '<span class="rvx-heat-scale">menos <i class="lv0"></i><i class="lv1"></i><i class="lv2"></i><i class="lv3"></i><i class="lv4"></i> mais</span></div>';
    el.innerHTML = html;
  }

  /* ═════════ COLEÇÕES CURADAS ═════════ */
  var COLLECTIONS = [
    {
      id: 'brasil', name: 'Clássicos do Brasil', desc: 'Tec Toy, traduções e lembranças de sessão da tarde',
      items: [
        { c: 'sega', f: 'Show do Milhao (Brazil).md' }, { c: 'sega', f: 'Felix - Detona Ralph.bin' },
        { c: 'mastersystem', f: 'Phantasy Star (Brazil).sms' },
        { c: 'mastersystem', f: 'Mortal Kombat 3 (Brazil) (En).sms' },
        { c: 'mastersystem', f: 'Castle of Illusion Starring Mickey Mouse (USA, Europe, Brazil) (En) (Rev 1).sms' },
        { c: 'mastersystem', f: 'Alex Kidd in Miracle World (USA, Europe, Brazil) (En) (Rev 1).sms' },
        { c: 'nes', f: 'Super Mario Bros 2 (PT-BR).nes' }, { c: 'nes', f: 'Super Mario Bros 3 (PT-BR).nes' },
        { c: 'gbc', f: 'Spider-Man (PT-BR).gbc' }, { c: 'gba', f: 'Carros Disney.gba' }
      ]
    },
    {
      id: 'rapidinhas', name: 'Zeráveis num fim de semana', desc: 'Diversão direta ao ponto, do arcade ao Atari',
      items: [
        { c: 'arcade', f: 'kof97.zip' }, { c: 'arcade', f: 'mslug.zip' }, { c: 'arcade', f: 'samsho2.zip' },
        { c: 'arcade', f: 'sfa3.zip' }, { c: 'arcade', f: 'vsav.zip' }, { c: 'arcade', f: 'garou.zip' },
        { c: 'atari2600', f: 'Pitfall! (USA).bin' }, { c: 'atari2600', f: 'River Raid (USA).bin' },
        { c: 'atari2600', f: 'Enduro (USA).bin' }, { c: 'atari2600', f: 'Asteroids (USA).bin' },
        { c: 'atari2600', f: 'Adventure (USA).bin' }, { c: 'gamegear', f: 'Sonic The Hedgehog (World).gg' }
      ]
    },
    {
      id: 'dois', name: 'Para 2 jogadores', desc: 'Chame alguém: a ficha desses jogos diz que são de 2+', rule: 'jog2'
    },
    { id: 'rpg', name: 'RPG e Aventura', desc: 'Histórias longas para virar a madrugada', rule: 'rpg' }
  ];
  function collectionIncludes(col, consoleKey, file) {
    if (col.items) {
      return col.items.some(function (i) { return i.c === consoleKey && i.f === file; });
    }
    var ficha = global.RV_FICHAS && RV_FICHAS[file];
    if (col.rule === 'jog2') return !!(ficha && Number(ficha.jog) >= 2);
    if (col.rule === 'rpg') return !!(ficha && /rpg|aventura/i.test(String(ficha.gen || '')));
    return false;
  }
  function collectionGames(colId, consoleKey) {
    var col = COLLECTIONS.filter(function (c) { return c.id === colId; })[0];
    if (!col) return [];
    return catalogGames(consoleKey)
      .filter(function (g) { return collectionIncludes(col, consoleKey, g.file); })
      .map(function (g) { return g.file; });
  }

  /* ═════════ CARD COMPARTILHÁVEL (PNG via canvas) ═════════ */
  function paintCard(w, h, draw) {
    var cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    var x = cv.getContext('2d');
    var g = x.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, '#04120a'); g.addColorStop(1, '#020503');
    x.fillStyle = g; x.fillRect(0, 0, w, h);
    /* grid de fundo sutil */
    x.strokeStyle = 'rgba(0,255,65,.05)'; x.lineWidth = 1;
    for (var i = 20; i < w; i += 40) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, h); x.stroke(); }
    for (var j = 20; j < h; j += 40) { x.beginPath(); x.moveTo(0, j); x.lineTo(w, j); x.stroke(); }
    /* moldura neon */
    x.strokeStyle = '#00ff41'; x.lineWidth = 4;
    x.strokeRect(14, 14, w - 28, h - 28);
    x.strokeStyle = 'rgba(0,255,65,.25)'; x.lineWidth = 2;
    x.strokeRect(26, 26, w - 52, h - 52);
    draw(x, cv);
    return cv;
  }
  function cardFooter(x, w, h) {
    x.fillStyle = 'rgba(0,255,65,.75)';
    x.font = '700 26px Rajdhani, system-ui, sans-serif';
    x.textAlign = 'center';
    x.fillText('RETROVAULT WEB', w / 2, h - 46);
    x.fillStyle = 'rgba(143,163,192,.7)';
    x.font = '400 19px Rajdhani, system-ui, sans-serif';
    x.fillText('ENTER THE CLASSICS', w / 2, h - 76);
  }
  function deliverCard(cv, filename, shareText) {
    var done = function () { };
    var fallback = function () {
      cv.toBlob(function (blob) {
        if (!blob) return;
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = filename;
        a.click();
        setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
      }, 'image/png');
    };
    try {
      cv.toBlob(function (blob) {
        if (!blob) { fallback(); return; }
        var file;
        try { file = new File([blob], filename, { type: 'image/png' }); } catch (e) { file = null; }
        if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
          navigator.share({ files: [file], text: shareText || '' }).catch(function () { });
        } else fallback();
      }, 'image/png');
    } catch (e) { fallback(); }
    return { then: function (f) { done = f; } };
  }
  function shareAchievement(ach, playerName) {
    var w = 1000, h = 620;
    var cv = paintCard(w, h, function (x) {
      x.textAlign = 'center';
      x.fillStyle = '#00ff41';
      x.font = '700 30px Rajdhani, system-ui, sans-serif';
      x.fillText('CONQUISTA DESBLOQUEADA', w / 2, 110);
      x.fillStyle = '#ffffff';
      x.font = '900 62px Orbitron, Rajdhani, system-ui, sans-serif';
      var name = ach.name || '';
      x.fillText(name.length > 22 ? name.slice(0, 21) + '…' : name, w / 2, 220);
      x.fillStyle = '#c9d6e8';
      x.font = '400 30px Rajdhani, system-ui, sans-serif';
      var words = (ach.desc || '').split(' '), line = '', yy = 300;
      words.forEach(function (wd) {
        if ((line + ' ' + wd).length > 38) { x.fillText(line, w / 2, yy); yy += 44; line = wd; }
        else line = line ? line + ' ' + wd : wd;
      });
      if (line) x.fillText(line, w / 2, yy);
      if (ach.date) {
        x.fillStyle = 'rgba(0,255,65,.8)';
        x.font = '600 26px Rajdhani, system-ui, sans-serif';
        x.fillText('em ' + new Date(ach.date).toLocaleDateString('pt-BR'), w / 2, yy + 70);
      }
      if (playerName) {
        x.fillStyle = '#8ef0ff';
        x.font = '700 30px Rajdhani, system-ui, sans-serif';
        x.fillText('— ' + playerName + ' —', w / 2, h - 120);
      }
      cardFooter(x, w, h);
    });
    return deliverCard(cv, 'retrovault-conquista-' + ach.id + '.png', 'Minha conquista no RetroVault Web!');
  }
  function shareProfileCard(info) {
    var w = 1000, h = 720;
    var cv = paintCard(w, h, function (x) {
      x.textAlign = 'center';
      x.fillStyle = '#00ff41';
      x.font = '700 30px Rajdhani, system-ui, sans-serif';
      x.fillText('PLAYER CARD', w / 2, 110);
      x.fillStyle = '#ffffff';
      x.font = '900 58px Orbitron, Rajdhani, system-ui, sans-serif';
      x.fillText((info.name || 'JOGADOR').toUpperCase().slice(0, 18), w / 2, 190);
      var cols = info.stats || [];
      var cw = (w - 160) / Math.max(1, cols.length);
      cols.forEach(function (s, i) {
        var cx = 80 + cw * i + cw / 2;
        x.fillStyle = '#00ff41';
        x.font = '900 46px Orbitron, Rajdhani, system-ui, sans-serif';
        x.fillText(String(s.value), cx, 320);
        x.fillStyle = '#8fa3c0';
        x.font = '600 22px Rajdhani, system-ui, sans-serif';
        x.fillText(String(s.label), cx, 356);
      });
      if (info.streak) {
        x.fillStyle = '#8ef0ff';
        x.font = '700 30px Rajdhani, system-ui, sans-serif';
        x.fillText('Sequência de ' + info.streak + ' dia' + (info.streak > 1 ? 's' : ''), w / 2, 450);
      }
      if (info.top) {
        x.fillStyle = '#c9d6e8';
        x.font = '500 26px Rajdhani, system-ui, sans-serif';
        x.fillText('Mais jogado: ' + String(info.top).slice(0, 40), w / 2, 510);
      }
      cardFooter(x, w, h);
    });
    return deliverCard(cv, 'retrovault-perfil.png', 'Meu player card do RetroVault Web!');
  }

  /* ═════════ O QUE HÁ DE NOVO (ícones: SVG inline, padrão do sistema) ═════════ */
  var WN_ICO = 'viewBox="0 0 24 24" fill="none" stroke="#00ff41" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';
  var WHATS_NEW = [
    ['<rect x="3" y="3" width="18" height="18" rx="4"/><circle cx="8.5" cy="8.5" r="1.4" fill="#00ff41" stroke="none"/><circle cx="15.5" cy="8.5" r="1.4" fill="#00ff41" stroke="none"/><circle cx="12" cy="12" r="1.4" fill="#00ff41" stroke="none"/><circle cx="8.5" cy="15.5" r="1.4" fill="#00ff41" stroke="none"/><circle cx="15.5" cy="15.5" r="1.4" fill="#00ff41" stroke="none"/>',
     'Jogo Surpresa', 'Um botão que sorteia o próximo clássico, na home e na barra de filtros.'],
    ['<circle cx="12" cy="12" r="9"/><polygon points="10 8.5 16 12 10 15.5" fill="#00ff41" stroke="none"/>',
     'Continuar de onde parou', 'Ao reabrir um jogo, o RetroVault pergunta se você quer retomar do último instante salvo.'],
    ['<circle cx="12" cy="12" r="9"/><polyline points="8 12.5 11 15.5 16 9.5"/>',
     'Status dos jogos', 'Marque cada título como Jogando, Zerado ou Quero zerar — direto no card, com filtro na lista.'],
    ['<circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15.5 14"/>',
     'Tempo de jogo', 'O perfil mostra as horas dedicadas a cada título, com calendário de atividade e sequência de dias.'],
    ['<rect x="2" y="6" width="13" height="12" rx="2"/><polygon points="15 10.5 21 7.5 21 16.5 15 13.5" />',
     'Clipe de gameplay', 'Segure o botão MENU durante a partida e grave a tela — o vídeo baixa em WebM, com duração ajustável na config.'],
    ['<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>',
     'Cartucho (SRM)', 'Exporte e importe a memória de bateria dos jogos (Pokémon, Zelda...).'],
    ['<path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/><polyline points="12 11 12 17"/><polyline points="9.5 14.5 12 17 14.5 14.5"/>',
     'Jogo no offline', 'Baixe a ROM para o aparelho e continue jogando sem internet.'],
    ['<rect x="3" y="5" width="18" height="14" rx="2"/><rect x="7" y="9" width="10" height="6" rx="1"/>',
     'Moldura de tela', 'Opcional na página de Configurações: emoldura a abertura com a cor de cada console.'],
    ['<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/><circle cx="12" cy="15.5" r="1.3" fill="#00ff41" stroke="none"/>',
     'Controle dos pais', 'Defina um PIN e escolha quais consoles podem abrir jogos sem ele.'],
    ['<rect x="7" y="2.5" width="10" height="19" rx="2"/><polyline points="12 8 12 14"/><polyline points="9.5 11.5 12 14 14.5 11.5"/>',
     'Instalar o app', 'Adicione o RetroVault Web à tela inicial quando o navegador oferecer.']
  ];
  function ensureWhatsNewStyles() {
    if (document.getElementById('rvx-wn-style')) return;
    var st = document.createElement('style'); st.id = 'rvx-wn-style';
    st.textContent = [
      '.rvx-modal{position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;',
      'background:rgba(1,4,2,.82);backdrop-filter:blur(4px);padding:18px}',
      '.rvx-modal-box{background:#04120a;border:1px solid rgba(0,255,65,.4);border-radius:16px;max-width:520px;width:100%;',
      'max-height:82vh;overflow:auto;padding:22px;box-shadow:0 18px 60px rgba(0,0,0,.6);font-family:system-ui,sans-serif}',
      '.rvx-modal-box h3{margin:0 0 4px;color:#00ff41;font-size:1.15rem;letter-spacing:.5px}',
      '.rvx-modal-box .rvx-wn-sub{color:#8fa3c0;font-size:.8rem;margin:0 0 14px}',
      '.rvx-wn-item{display:flex;gap:12px;padding:9px 0;border-top:1px solid rgba(0,255,65,.12);align-items:flex-start}',
      '.rvx-wn-item svg{width:20px;height:20px;flex:none;margin-top:2px}',
      '.rvx-wn-item b{display:block;color:#e8f6ee;font-size:.9rem}',
      '.rvx-wn-item span{color:#9fb4cc;font-size:.8rem}',
      '.rvx-modal-box .rvx-btn{margin-top:16px;width:100%;padding:11px;border:0;border-radius:10px;cursor:pointer;',
      'background:#00ff41;color:#02120a;font-weight:800;font-family:inherit;letter-spacing:.6px}',
      '.rvx-pill{position:fixed;bottom:18px;left:50%;transform:translateX(-50%);z-index:99998;display:flex;gap:10px;',
      'align-items:center;background:#04120a;border:1px solid rgba(0,255,65,.5);color:#d7efe0;padding:10px 14px;',
      'border-radius:12px;font:600 .82rem system-ui,sans-serif;box-shadow:0 10px 30px rgba(0,0,0,.55)}',
      '.rvx-pill svg{width:16px;height:16px;flex:none}',
      '.rvx-pill button{border:0;border-radius:8px;background:#00ff41;color:#02120a;font-weight:800;padding:7px 12px;cursor:pointer}'
    ].join('');
    document.head.appendChild(st);
  }
  function whatsNew(force) {
    ensureWhatsNewStyles();
    var seen = storeGet('rv_whatsnew_seen');
    if (!force && seen === VERSION) return;
    storeSet('rv_whatsnew_seen', VERSION);
    var ov = document.createElement('div'); ov.className = 'rvx-modal';
    var items = WHATS_NEW.map(function (i) {
      return '<div class="rvx-wn-item"><svg ' + WN_ICO + ' aria-hidden="true">' + i[0] + '</svg><div><b>' + i[1] + '</b><span>' + i[2] + '</span></div></div>';
    }).join('');
    ov.innerHTML = '<div class="rvx-modal-box" role="dialog" aria-label="Novidades">' +
      '<h3>NOVIDADES DESTA VERSÃO</h3><p class="rvx-wn-sub">RetroVault Web · ' + VERSION + '</p>' + items +
      '<button class="rvx-btn" type="button">MANDAR VER</button></div>';
    ov.addEventListener('click', function (e) { if (e.target === ov || e.target.closest('.rvx-btn')) ov.remove(); });
    document.body.appendChild(ov);
  }

  /* ═════════ INSTALAR O APP ═════════ */
  var deferredInstall = null;
  global.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    deferredInstall = e;
    document.querySelectorAll('[data-rvx-install]').forEach(function (b) { b.hidden = false; });
    emit('rvx-install-available');
  });
  function bindInstallButtons() {
    document.querySelectorAll('[data-rvx-install]').forEach(function (b) {
      if (b.__rvxBind) return; b.__rvxBind = true;
      b.addEventListener('click', async function () {
        if (!deferredInstall) return;
        deferredInstall.prompt();
        try { await deferredInstall.userChoice; } catch (e) { }
        deferredInstall = null;
        b.hidden = true;
      });
    });
  }

  /* ═════════ PÍLULA DE ATUALIZAÇÃO ═════════ */
  function showPill(text, btnText, onBtn) {
    ensureWhatsNewStyles();
    if (document.querySelector('.rvx-pill')) return;
    var p = document.createElement('div'); p.className = 'rvx-pill';
    var ico = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    ico.setAttribute('viewBox', '0 0 24 24');
    ico.setAttribute('fill', 'none');
    ico.setAttribute('stroke', '#00ff41');
    ico.setAttribute('stroke-width', '2');
    ico.setAttribute('stroke-linecap', 'round');
    ico.setAttribute('stroke-linejoin', 'round');
    ico.setAttribute('aria-hidden', 'true');
    ico.innerHTML = '<circle cx="12" cy="12" r="9"/><polyline points="8 12.5 11 15.5 16 9.5"/>';
    var b = document.createElement('button'); b.textContent = btnText;
    b.addEventListener('click', function () { p.remove(); onBtn && onBtn(); });
    p.appendChild(ico);
    p.appendChild(document.createTextNode(text));
    p.appendChild(b);
    document.body.appendChild(p);
    setTimeout(function () { p.remove(); }, 30000);
  }
  if ('serviceWorker' in navigator) {
    var hadController = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.addEventListener('controllerchange', function () {
      if (!hadController) { hadController = true; return; } /* 1ª instalação não é atualização */
      if (sessionStorage.getItem('rvx_upgraded')) return;
      sessionStorage.setItem('rvx_upgraded', '1');
      showPill('Nova versão do site aplicada', 'Recarregar', function () { location.reload(); });
    });
  }

  /* ═════════ API pública ═════════ */
  global.RVX = {
    version: VERSION,
    CORES: CORES, CONSOLE_NAMES: CONSOLE_NAMES, COLLECTIONS: COLLECTIONS,
    STATUS_LABEL: STATUS_LABEL,
    randomGame: randomGame, goToRandomGame: goToRandomGame,
    statusOf: statusOf, setStatus: setStatus, cycleStatus: cycleStatus,
    statusCounts: statusCounts, statusMap: statusMap,
    playtimeOf: playtimeOf, totalPlaytime: totalPlaytime, playtimeMap: playtimeMap,
    activityMap: activityMap, fmtTime: fmtTime, streakDays: streakDays, topPlayed: topPlayed,
    renderHeatmap: renderHeatmap,
    collectionGames: collectionGames,
    whatsNew: whatsNew, shareAchievement: shareAchievement, shareProfileCard: shareProfileCard,
    bindInstallButtons: bindInstallButtons,
    gameKey: gameKey
  };
})(window);

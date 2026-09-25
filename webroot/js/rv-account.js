/* ═══════════════════════════════════════════════════════════
   RETROVAULT WEB — CONTA, SESSÃO E SINCRONIZAÇÃO   (js/rv-account.js)
   ───────────────────────────────────────────────────────────
   Resolve o problema de "perder o histórico": tudo que era gravado
   solto no navegador passa a ter DONO.

   O que este arquivo entrega:

   1. RVStore  — mesma API do localStorage (getItem/setItem/removeItem),
                 mas com as chaves separadas por usuário:
                 rv_recent  →  rv:<uid>:rv_recent
                 Trocar de usuário troca o histórico; atualizar o site
                 não apaga nada.

   2. RVAccount — login/cadastro em dois modos:
                 • NUVEM  (Firebase Auth + Firestore) quando js/rv-config.js
                   estiver preenchido: histórico e saves seguem você em
                   qualquer PC/celular, sobrevivem a limpar o cache.
                 • LOCAL  (perfil + PIN neste navegador) quando não houver
                   configuração ou não houver internet.

   3. Sincronização com MESCLAGEM (nunca sobrescreve cegamente):
                 conquistas, favoritos e jogos jogados são unidos;
                 contadores usam o maior valor; recentes usam o mais novo.

   4. Save-states na nuvem: comprimidos (gzip) e gravados em pedaços
      no Firestore — sem precisar do plano pago do Firebase Storage.
   ═══════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';

  var CFG = global.RV_CONFIG || {};
  var FB_CFG = CFG.firebase || {};
  var SYNC_CFG = CFG.sync || {};
  var SDK = CFG.firebaseSdkVersion || '10.12.5';

  /* Nuvem só é considerada configurada se houver apiKey + projectId reais. */
  var CLOUD_CONFIGURED = !!(FB_CFG.apiKey && FB_CFG.projectId &&
    !/^(cole|seu|your|xxx|todo)/i.test(String(FB_CFG.apiKey)));

  /* ── Chaves globais (fora do namespace do usuário) ── */
  var SESSION_KEY = 'rv_session';
  var PROFILES_KEY = 'rv_local_profiles';

  /* Chaves de dados que pertencem ao jogador e entram na sincronização. */
  var DATA_KEYS = [
    'rv_recent', 'rv_favorites', 'rv_achievements', 'rv_played_games',
    'rv_sessions', 'rv_consoles_played', 'rv_screenshots', 'rv_player_name', 'rv_avatar',
    'rv_pad_mode', 'rv_playtime', 'rv_activity', 'rv_status'
  ];

  var SAVES_DB = 'RetroVault-saves';
  var SAVES_DB_LEGACY = 'RetroVerso-saves'; /* nome do banco em versões antigas — só leitura p/ migração */
  var SAVES_STORE = 'saves';

  /* ═══════════════ utilidades básicas ═══════════════ */

  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } }
  function lsDel(k) { try { localStorage.removeItem(k); } catch (e) { } }
  function jparse(v, fb) { try { var p = JSON.parse(v); return p === null ? fb : p; } catch (e) { return fb; } }

  function uuid() {
    if (global.crypto && crypto.randomUUID) return crypto.randomUUID().replace(/-/g, '').slice(0, 16);
    return 'x' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  }

  async function sha256(text) {
    if (!(global.crypto && crypto.subtle)) {
      /* Fallback bobo para contextos sem WebCrypto (http://). Só protege
         contra olhar casual — PIN local nunca foi segurança de verdade. */
      var h = 0, i;
      for (i = 0; i < text.length; i++) { h = ((h << 5) - h + text.charCodeAt(i)) | 0; }
      return 'w' + (h >>> 0).toString(16);
    }
    var buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return Array.from(new Uint8Array(buf)).map(function (b) { return b.toString(16).padStart(2, '0'); }).join('');
  }

  /* ═══════════════ sessão ═══════════════ */

  var session = jparse(lsGet(SESSION_KEY), null);
  if (session && !session.uid) session = null;

  function currentUid() { return session ? session.uid : 'convidado'; }
  function isCloudSession() { return !!(session && session.mode === 'cloud'); }

  function writeSession(s) {
    session = s;
    if (s) lsSet(SESSION_KEY, JSON.stringify(s)); else lsDel(SESSION_KEY);
    emit('change', s);
  }

  /* ═══════════════ RVStore — localStorage por usuário ═══════════════ */

  function nsKey(key, uid) { return 'rv:' + (uid || currentUid()) + ':' + key; }

  var pushTimer = null;
  function markDirty(key) {
    if (DATA_KEYS.indexOf(key) === -1) return;
    lsSet(nsKey('rv_updated_at'), String(Date.now()));
    try { global.dispatchEvent(new CustomEvent('rv-data-changed', { detail: { key: key } })); } catch (e) { }
    if (!isCloudSession() || SYNC_CFG.profile === false) return;
    clearTimeout(pushTimer);
    pushTimer = setTimeout(function () { pushProfile().catch(function () { }); }, 1500);
  }

  var RVStore = {
    /* API compatível com localStorage — a troca no código é 1 para 1. */
    getItem: function (key) { return lsGet(nsKey(key)); },
    setItem: function (key, value) { var ok = lsSet(nsKey(key), String(value)); markDirty(key); return ok; },
    removeItem: function (key) { lsDel(nsKey(key)); markDirty(key); },

    /* Açúcar sintático para quem quiser JSON direto. */
    get: function (key, fallback) { return jparse(lsGet(nsKey(key)), fallback); },
    set: function (key, value) { return RVStore.setItem(key, JSON.stringify(value)); },

    uid: currentUid,

    /* Todos os dados do usuário atual, prontos para backup/nuvem. */
    dump: function (uid) {
      var out = {};
      DATA_KEYS.forEach(function (k) {
        var raw = lsGet(nsKey(k, uid));
        if (raw !== null) out[k] = k === 'rv_player_name' ? raw : jparse(raw, raw);
      });
      return out;
    },

    /* Grava um pacote inteiro de dados (usado pela nuvem e pelo import). */
    load: function (data, uid) {
      if (!data) return;
      DATA_KEYS.forEach(function (k) {
        if (!(k in data)) return;
        var v = data[k];
        if (v === null || v === undefined) { lsDel(nsKey(k, uid)); return; }
        lsSet(nsKey(k, uid), (k === 'rv_player_name' && typeof v === 'string') ? v : JSON.stringify(v));
      });
    },

    clearUser: function (uid) {
      DATA_KEYS.forEach(function (k) { lsDel(nsKey(k, uid)); });
      lsDel(nsKey('rv_updated_at', uid));
    },

    updatedAt: function (uid) { return parseInt(lsGet(nsKey('rv_updated_at', uid)) || '0', 10) || 0; },

    isEmpty: function (uid) {
      return DATA_KEYS.every(function (k) { return lsGet(nsKey(k, uid)) === null; });
    }
  };

  /* ── Migração: dados antigos (sem dono) viram dados do 1º usuário ──
     Só acontece UMA vez: o segundo perfil criado no mesmo navegador começa
     limpo, sem herdar o histórico de quem chegou primeiro. */
  var LEGACY_FLAG = 'rv_legacy_migrated_to';

  function adoptLegacyData(uid) {
    if (lsGet(LEGACY_FLAG)) return false;
    if (!RVStore.isEmpty(uid)) return false;
    var found = false;
    DATA_KEYS.forEach(function (k) {
      var raw = lsGet(k);
      if (raw !== null) { lsSet(nsKey(k, uid), raw); found = true; }
    });
    /* Marca como migrado mesmo sem dados: evita que um perfil futuro
       adote resíduos deixados por versões antigas do site. */
    lsSet(LEGACY_FLAG, uid);
    if (found) lsSet(nsKey('rv_updated_at', uid), String(Date.now()));
    return found;
  }

  /* ═══════════════ IndexedDB dos save-states ═══════════════ */

  function idbOpen() {
    return new Promise(function (resolve, reject) {
      if (!global.indexedDB) { reject(new Error('IndexedDB indisponível')); return; }
      var req = indexedDB.open(SAVES_DB, 1);
      req.onupgradeneeded = function () { req.result.createObjectStore(SAVES_STORE); };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
    });
  }

  /* ── Migração única do banco com nome antigo ──
     Na 1ª abertura após o rebrand, copia os saves do banco legado para o
     novo nome, sem apagar o banco antigo. Roda uma única vez por navegador
     (flag rv_saves_db_migrated) e é best-effort: qualquer falha só pula a
     migração — o app segue funcionando normalmente. */
  function idbOpenNamed(name) {
    return new Promise(function (resolve, reject) {
      var req = indexedDB.open(name); /* sem versão: nunca força upgrade */
      req.onupgradeneeded = function () {
        try { req.result.createObjectStore(SAVES_STORE); } catch (e) { }
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
    });
  }
  function idbGetAllRows(db) {
    return new Promise(function (resolve, reject) {
      var out = [];
      try {
        var cursor = db.transaction(SAVES_STORE, 'readonly').objectStore(SAVES_STORE).openCursor();
        cursor.onsuccess = function () {
          var c = cursor.result;
          if (c) { out.push({ k: c.key, v: c.value }); c.continue(); }
          else resolve(out);
        };
        cursor.onerror = function () { reject(cursor.error); };
      } catch (e) { reject(e); }
    });
  }
  function idbPutAllRows(db, rows) {
    return new Promise(function (resolve, reject) {
      try {
        var tx = db.transaction(SAVES_STORE, 'readwrite');
        var st = tx.objectStore(SAVES_STORE);
        rows.forEach(function (r) { try { st.put(r.v, r.k); } catch (e) { } });
        tx.oncomplete = function () { resolve(); };
        tx.onerror = function () { reject(tx.error); };
        tx.onabort = function () { reject(tx.error); };
      } catch (e) { reject(e); }
    });
  }
  async function migrateSavesDbOnce() {
    if (!global.indexedDB || lsGet('rv_saves_db_migrated') === '1') return;
    var db = await idbOpenNamed(SAVES_DB);
    try {
      var current = await idbGetAllRows(db).catch(function () { return []; });
      if (current.length) { lsSet('rv_saves_db_migrated', '1'); return; }
      /* Evita criar um banco legado vazio em navegadores novos. */
      if (global.indexedDB.databases) {
        var list = await global.indexedDB.databases().catch(function () { return null; });
        var exists = !!(list && list.some(function (d) { return d && d.name === SAVES_DB_LEGACY; }));
        if (!exists) { lsSet('rv_saves_db_migrated', '1'); return; }
      }
      var oldDb = await idbOpenNamed(SAVES_DB_LEGACY).catch(function () { return null; });
      if (!oldDb) { lsSet('rv_saves_db_migrated', '1'); return; }
      var rows = await idbGetAllRows(oldDb).catch(function () { return []; });
      oldDb.close();
      if (rows.length) await idbPutAllRows(db, rows).catch(function () { });
      lsSet('rv_saves_db_migrated', '1');
    } finally {
      try { db.close(); } catch (e) { }
    }
  }
  var savesDbMigratePromise = null;
  function ensureSavesDbMigrated() {
    if (!savesDbMigratePromise) {
      savesDbMigratePromise = migrateSavesDbOnce().catch(function () { /* best-effort */ });
    }
    return savesDbMigratePromise;
  }
  function idbRun(mode, op) {
    return ensureSavesDbMigrated().then(function () { return idbOpen(); }).then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(SAVES_STORE, mode);
        var req = op(tx.objectStore(SAVES_STORE));
        tx.oncomplete = function () { db.close(); resolve(req && req.result); };
        tx.onerror = function () { db.close(); reject(tx.error); };
        tx.onabort = function () { db.close(); reject(tx.error); };
      });
    });
  }
  var idbGet = function (k) { return idbRun('readonly', function (st) { return st.get(k); }); };
  var idbPut = function (k, v) { return idbRun('readwrite', function (st) { return st.put(v, k); }); };
  var idbDel = function (k) { return idbRun('readwrite', function (st) { return st.delete(k); }); };
  var idbKeys = function () { return idbRun('readonly', function (st) { return st.getAllKeys(); }); };

  /* Saves antigos (chave "core|arquivo") passam a pertencer ao 1º usuário
     que fizer login, virando "uid::core|arquivo". Também roda uma vez só. */
  var LEGACY_SAVES_FLAG = 'rv_legacy_saves_migrated_to';

  async function adoptLegacySaves(uid) {
    if (lsGet(LEGACY_SAVES_FLAG)) return 0;
    try {
      var keys = await idbKeys();
      var legacy = keys.filter(function (k) { return typeof k === 'string' && k.indexOf('::') === -1; });
      lsSet(LEGACY_SAVES_FLAG, uid);
      if (!legacy.length) return 0;
      for (var i = 0; i < legacy.length; i++) {
        var rec = await idbGet(legacy[i]);
        if (rec) await idbPut(uid + '::' + legacy[i], rec);
      }
      return legacy.length;
    } catch (e) { return 0; }
  }

  /* ═══════════════ Firebase (carregado sob demanda) ═══════════════ */

  var fbPromise = null;
  function firebase() {
    if (!CLOUD_CONFIGURED) return Promise.resolve(null);
    if (fbPromise) return fbPromise;
    fbPromise = (async function () {
      var base = 'https://www.gstatic.com/firebasejs/' + SDK + '/';
      var appMod = await import(base + 'firebase-app.js');
      var authMod = await import(base + 'firebase-auth.js');
      var fsMod = await import(base + 'firebase-firestore.js');
      var app = appMod.getApps && appMod.getApps().length ? appMod.getApps()[0] : appMod.initializeApp(FB_CFG);
      return { app: app, A: authMod, F: fsMod, auth: authMod.getAuth(app), db: fsMod.getFirestore(app) };
    })().catch(function (err) {
      console.warn('[RetroVault Web] Firebase indisponível — seguindo em modo local.', err);
      fbPromise = null;
      return null;
    });
    return fbPromise;
  }

  function authErrorMessage(err) {
    var code = (err && err.code) || '';
    var map = {
      'auth/invalid-email': 'E-mail inválido.',
      'auth/missing-password': 'Digite a senha.',
      'auth/weak-password': 'A senha precisa de pelo menos 6 caracteres.',
      'auth/email-already-in-use': 'Este e-mail já tem conta. Use "Entrar".',
      'auth/invalid-credential': 'E-mail ou senha incorretos.',
      'auth/wrong-password': 'Senha incorreta.',
      'auth/user-not-found': 'Não existe conta com este e-mail.',
      'auth/too-many-requests': 'Muitas tentativas. Aguarde um pouco.',
      'auth/network-request-failed': 'Sem conexão com a internet.',
      'auth/popup-closed-by-user': 'Janela do Google fechada antes de concluir.',
      'auth/cancelled-popup-request': 'Janela do Google fechada antes de concluir.',
      'auth/popup-blocked': 'O navegador bloqueou a janela do Google. Libere os pop-ups e tente de novo.',
      'auth/operation-not-allowed': 'Este jeito de entrar não está habilitado no Firebase.',
      'auth/unauthorized-domain': 'Este endereço não está liberado no Firebase Auth.',
      'auth/account-exists-with-different-credential': 'Já existe conta com este e-mail criada de outro jeito.',
      'auth/operation-not-allowed': 'Ative "E-mail/senha" no Firebase Console → Authentication.',
      'auth/unauthorized-domain': 'Adicione este domínio em Authentication → Settings → Domínios autorizados.'
    };
    return map[code] || (err && err.message) || 'Falha inesperada.';
  }

  /* ═══════════════ Sincronização do perfil ═══════════════ */

  function uniqBy(list, keyFn) {
    var seen = {}, out = [];
    (list || []).forEach(function (item) {
      if (!item) return;
      var k = keyFn(item);
      if (seen[k]) return;
      seen[k] = 1; out.push(item);
    });
    return out;
  }
  var gameId = function (g) { return String(g && (g.console || '')) + '/' + String(g && (g.file || '')); };

  /* Mescla dois pacotes de dados sem perder nada de nenhum dos lados. */
  function mergeData(a, b, aNewer) {
    a = a || {}; b = b || {};
    var num = function (k) { return Math.max(Number(a[k]) || 0, Number(b[k]) || 0); };
    var arr = function (k) {
      var l = (Array.isArray(a[k]) ? a[k] : []).concat(Array.isArray(b[k]) ? b[k] : []);
      return l.filter(function (v, i) { return l.indexOf(v) === i; });
    };
    /* Objetos numéricos (tempo de jogo, atividade diária): maior valor por chave. */
    function objMax(x, y) {
      x = (x && typeof x === 'object') ? x : {}; y = (y && typeof y === 'object') ? y : {};
      var out = {};
      Object.keys(x).concat(Object.keys(y)).forEach(function (k) {
        out[k] = Math.max(Number(x[k]) || 0, Number(y[k]) || 0);
      });
      return out;
    }
    /* Status por jogo: fica o marcado mais recentemente. */
    function objNewer(x, y) {
      x = (x && typeof x === 'object') ? x : {}; y = (y && typeof y === 'object') ? y : {};
      var out = {};
      Object.keys(x).concat(Object.keys(y)).forEach(function (k) {
        var xa = x[k] || {}, ya = y[k] || {};
        if (!xa.s && !ya.s) return;
        out[k] = ((ya.at || 0) > (xa.at || 0)) ? ya : xa;
      });
      return out;
    }
    var merged = {
      rv_recent: uniqBy(
        (Array.isArray(a.rv_recent) ? a.rv_recent : []).concat(Array.isArray(b.rv_recent) ? b.rv_recent : [])
          .sort(function (x, y) { return (y.timestamp || 0) - (x.timestamp || 0); }),
        gameId).slice(0, 8),
      rv_favorites: uniqBy(
        (Array.isArray(a.rv_favorites) ? a.rv_favorites : []).concat(Array.isArray(b.rv_favorites) ? b.rv_favorites : []),
        gameId),
      rv_played_games: arr('rv_played_games'),
      rv_consoles_played: arr('rv_consoles_played'),
      rv_sessions: num('rv_sessions'),
      rv_screenshots: num('rv_screenshots'),
      rv_achievements: {},
      rv_player_name: aNewer ? (a.rv_player_name || b.rv_player_name || '') : (b.rv_player_name || a.rv_player_name || ''),
      rv_avatar: aNewer ? (a.rv_avatar || b.rv_avatar || '') : (b.rv_avatar || a.rv_avatar || ''),
      rv_pad_mode: aNewer ? (a.rv_pad_mode || b.rv_pad_mode || 'auto') : (b.rv_pad_mode || a.rv_pad_mode || 'auto'),
      rv_playtime: objMax(a.rv_playtime, b.rv_playtime),
      rv_activity: objMax(a.rv_activity, b.rv_activity),
      rv_status: objNewer(a.rv_status, b.rv_status)
    };
    /* Conquista mantém a data mais antiga (foi quando foi desbloqueada). */
    var ach = {};
    [a.rv_achievements, b.rv_achievements].forEach(function (src) {
      if (!src || typeof src !== 'object') return;
      Object.keys(src).forEach(function (id) {
        if (!ach[id] || (src[id] && src[id].date && src[id].date < ach[id].date)) ach[id] = src[id];
      });
    });
    merged.rv_achievements = ach;
    return merged;
  }

  async function pullProfile() {
    var ctx = await firebase();
    if (!ctx || !isCloudSession()) return null;
    var d = ctx.F;
    var snap = await d.getDoc(d.doc(ctx.db, 'users', session.uid));
    return snap.exists() ? (snap.data() || {}) : null;
  }

  async function pushProfile() {
    var ctx = await firebase();
    if (!ctx || !isCloudSession() || SYNC_CFG.profile === false) return false;
    var d = ctx.F;
    await d.setDoc(d.doc(ctx.db, 'users', session.uid), {
      email: session.email || '',
      name: RVStore.getItem('rv_player_name') || session.name || '',
      data: RVStore.dump(),
      clientAt: RVStore.updatedAt() || Date.now(),
      updatedAt: d.serverTimestamp()
    }, { merge: true });
    emit('sync', { pushed: true });
    return true;
  }

  /* Baixa, mescla com o que existe no aparelho e devolve tudo sincronizado. */
  async function syncProfile() {
    if (!isCloudSession() || SYNC_CFG.profile === false) return false;
    try {
      var cloud = await pullProfile();
      var localData = RVStore.dump();
      var localAt = RVStore.updatedAt();
      var cloudAt = (cloud && cloud.clientAt) || 0;
      var merged = mergeData(localData, (cloud && cloud.data) || {}, localAt >= cloudAt);
      RVStore.load(merged);
      lsSet(nsKey('rv_updated_at'), String(Math.max(localAt, cloudAt, Date.now())));
      await pushProfile();
      emit('sync', { pulled: true });
      return true;
    } catch (err) {
      console.warn('[RetroVault Web] sincronização do perfil falhou:', err);
      emit('sync', { error: err });
      return false;
    }
  }

  /* ═══════════════ Save-states na nuvem (Firestore, compactado) ═══════════════ */

  function toBytes(state) {
    if (!state) return new Uint8Array(0);
    if (state instanceof Uint8Array) return state;
    if (state instanceof ArrayBuffer) return new Uint8Array(state);
    if (ArrayBuffer.isView(state)) return new Uint8Array(state.buffer, state.byteOffset, state.byteLength);
    if (Array.isArray(state)) return new Uint8Array(state);
    return new Uint8Array(0);
  }

  async function gzipBytes(u8) {
    if (!global.CompressionStream) return { codec: 'raw', bytes: u8 };
    try {
      var cs = new CompressionStream('gzip');
      var stream = new Blob([u8]).stream().pipeThrough(cs);
      var buf = await new Response(stream).arrayBuffer();
      return { codec: 'gzip', bytes: new Uint8Array(buf) };
    } catch (e) { return { codec: 'raw', bytes: u8 }; }
  }
  async function gunzipBytes(u8, codec) {
    if (codec !== 'gzip' || !global.DecompressionStream) return u8;
    var ds = new DecompressionStream('gzip');
    var stream = new Blob([u8]).stream().pipeThrough(ds);
    var buf = await new Response(stream).arrayBuffer();
    return new Uint8Array(buf);
  }

  /* Cede o turno ao jogo entre fatias: um state de dezenas de MB não pode
     congelar a tela por segundos durante a conversão base64. */
  function b64tick() { return new Promise(function (r) { setTimeout(r, 0); }); }
  async function bytesToB64(u8) {
    var CH = 0x8000, parts = [];
    for (var i = 0; i < u8.length; i += CH) {
      parts.push(String.fromCharCode.apply(null, u8.subarray(i, i + CH)));
      if ((i / CH) % 16 === 15) await b64tick(); /* a cada ~512KB */
    }
    return btoa(parts.join(''));
  }
  async function b64ToBytes(b64) {
    var CH = 1048576; /* múltiplo de 4: permite atob em fatias */
    var out = new Uint8Array(Math.ceil(b64.length * 3 / 4)), pos = 0;
    for (var i = 0; i < b64.length; i += CH) {
      var bin = atob(b64.slice(i, i + CH));
      for (var j = 0; j < bin.length; j++) out[pos++] = bin.charCodeAt(j);
      await b64tick();
    }
    return out.slice(0, pos);
  }
  function docIdFor(key) {
    return btoa(unescape(encodeURIComponent(key))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  var CHUNK = 700000; /* caracteres base64 por documento (limite do Firestore é 1 MiB) */

  async function uploadSave(key, rec) {
    var ctx = await firebase();
    if (!ctx || !isCloudSession() || SYNC_CFG.saves === false) return { ok: false, reason: 'offline' };
    var d = ctx.F;
    var raw = toBytes(rec.state);
    var packed = await gzipBytes(raw);
    var limit = (CFG.maxCloudSaveMB || 8) * 1024 * 1024;
    /* Recusa ANTES do base64: state grande demais nem chega a converter. */
    if (packed.bytes.length > limit) return { ok: false, reason: 'too_big', size: packed.bytes.length };
    var b64 = await bytesToB64(packed.bytes);

    var id = docIdFor(key);
    var metaRef = d.doc(ctx.db, 'users', session.uid, 'saves', id);
    var prev = null;
    try { var s = await d.getDoc(metaRef); prev = s.exists() ? s.data() : null; } catch (e) { }

    var chunks = [];
    for (var i = 0; i < b64.length; i += CHUNK) chunks.push(b64.slice(i, i + CHUNK));

    for (var c = 0; c < chunks.length; c++) {
      await d.setDoc(d.doc(ctx.db, 'users', session.uid, 'saves', id, 'parts', String(c)), { d: chunks[c] });
    }
    /* Remove sobras de um save anterior maior. */
    if (prev && prev.chunks > chunks.length) {
      for (var k = chunks.length; k < prev.chunks; k++) {
        try { await d.deleteDoc(d.doc(ctx.db, 'users', session.uid, 'saves', id, 'parts', String(k))); } catch (e) { }
      }
    }
    await d.setDoc(metaRef, {
      key: key, rom: rec.rom || '', core: rec.core || '',
      bytes: raw.length, packedBytes: packed.bytes.length, codec: packed.codec,
      chunks: chunks.length, savedAt: rec.savedAt || new Date().toISOString(),
      updatedAt: d.serverTimestamp()
    });
    return { ok: true, bytes: raw.length, packedBytes: packed.bytes.length };
  }

  async function downloadSave(key) {
    var ctx = await firebase();
    if (!ctx || !isCloudSession() || SYNC_CFG.saves === false) return null;
    var d = ctx.F, id = docIdFor(key);
    var snap = await d.getDoc(d.doc(ctx.db, 'users', session.uid, 'saves', id));
    if (!snap.exists()) return null;
    var meta = snap.data() || {};
    var b64 = '';
    for (var i = 0; i < (meta.chunks || 0); i++) {
      var part = await d.getDoc(d.doc(ctx.db, 'users', session.uid, 'saves', id, 'parts', String(i)));
      if (!part.exists()) return null;
      b64 += (part.data() || {}).d || '';
    }
    if (!b64) return null;
    var state = await gunzipBytes(await b64ToBytes(b64), meta.codec);
    return {
      game: key, rom: meta.rom || '', core: meta.core || '',
      bytes: meta.bytes || state.length, savedAt: meta.savedAt, state: state, fromCloud: true
    };
  }

  async function listCloudSaves() {
    var ctx = await firebase();
    if (!ctx || !isCloudSession()) return [];
    var d = ctx.F;
    var qs = await d.getDocs(d.collection(ctx.db, 'users', session.uid, 'saves'));
    var out = [];
    qs.forEach(function (docSnap) { out.push(docSnap.data()); });
    return out;
  }

  async function deleteCloudSave(key) {
    var ctx = await firebase();
    if (!ctx || !isCloudSession()) return false;
    var d = ctx.F, id = docIdFor(key);
    var ref = d.doc(ctx.db, 'users', session.uid, 'saves', id);
    var snap = await d.getDoc(ref);
    var n = snap.exists() ? (snap.data().chunks || 0) : 0;
    for (var i = 0; i < n; i++) {
      try { await d.deleteDoc(d.doc(ctx.db, 'users', session.uid, 'saves', id, 'parts', String(i))); } catch (e) { }
    }
    await d.deleteDoc(ref);
    return true;
  }

  /* ═══════════════ eventos ═══════════════ */

  var listeners = {};
  function on(evt, cb) { (listeners[evt] = listeners[evt] || []).push(cb); return function () { off(evt, cb); }; }
  function off(evt, cb) { listeners[evt] = (listeners[evt] || []).filter(function (f) { return f !== cb; }); }
  function emit(evt, payload) { (listeners[evt] || []).forEach(function (f) { try { f(payload); } catch (e) { } }); }

  /* ═══════════════ perfis locais (sem internet / sem Firebase) ═══════════════ */

  function localProfiles() { return jparse(lsGet(PROFILES_KEY), []) || []; }
  function saveLocalProfiles(list) { lsSet(PROFILES_KEY, JSON.stringify(list)); }

  async function createLocalProfile(name, pin, avatar) {
    name = String(name || '').trim().slice(0, 20);
    if (!name) throw new Error('Escolha um nome de jogador.');
    var list = localProfiles();
    if (list.some(function (p) { return p.name.toLowerCase() === name.toLowerCase(); })) {
      throw new Error('Já existe um perfil com este nome neste aparelho.');
    }
    var uid = 'local_' + uuid();
    var profile = {
      uid: uid, name: name, createdAt: Date.now(),
      pin: pin ? await sha256(uid + ':' + pin) : '',
      avatar: String(avatar || '').slice(0, 500)
    };
    list.push(profile);
    saveLocalProfiles(list);
    await startSession({ uid: uid, mode: 'local', name: name, email: '', avatar: profile.avatar });
    RVStore.setItem('rv_player_name', name);
    return profile;
  }

  async function signInLocal(uid, pin) {
    var profile = localProfiles().filter(function (p) { return p.uid === uid; })[0];
    if (!profile) throw new Error('Perfil não encontrado.');
    if (profile.pin) {
      var hash = await sha256(uid + ':' + (pin || ''));
      if (hash !== profile.pin) throw new Error('PIN incorreto.');
    }
    await startSession({ uid: uid, mode: 'local', name: profile.name, email: '', avatar: profile.avatar || '' });
    return profile;
  }

  function updateLocalProfile(uid, patch) {
    var list = localProfiles();
    var profile = list.filter(function (p) { return p.uid === uid; })[0];
    if (!profile) return false;
    if (patch && patch.avatar !== undefined) profile.avatar = String(patch.avatar || '').slice(0, 500);
    if (patch && patch.name !== undefined) profile.name = String(patch.name || '').trim().slice(0, 20);
    saveLocalProfiles(list);
    /* O avatar do perfil salvo e o avatar da sessão atual são a mesma escolha. */
    if (session && session.uid === uid && patch && patch.avatar !== undefined) {
      if (profile.avatar) RVStore.setItem('rv_avatar', profile.avatar);
      else RVStore.removeItem('rv_avatar');
    }
    return profile;
  }

  function deleteLocalProfile(uid) {
    saveLocalProfiles(localProfiles().filter(function (p) { return p.uid !== uid; }));
    RVStore.clearUser(uid);
    if (session && session.uid === uid) writeSession(null);
  }

  /* ═══════════════ ciclo de vida da sessão ═══════════════ */

  async function startSession(s) {
    writeSession(s);
    adoptLegacyData(s.uid);
    await adoptLegacySaves(s.uid);
    if (!RVStore.getItem('rv_player_name') && s.name) RVStore.setItem('rv_player_name', s.name);
    if (s.mode === 'local' && s.avatar !== undefined) {
      if (s.avatar) RVStore.setItem('rv_avatar', s.avatar);
      else RVStore.removeItem('rv_avatar');
    }
    if (s.mode === 'cloud') { syncProfile().catch(function () { }); }
    return s;
  }

  async function signUp(email, password, name) {
    var ctx = await firebase();
    if (!ctx) throw new Error('Login na nuvem não está configurado. Use um perfil local ou preencha js/rv-config.js.');
    try {
      var cred = await ctx.A.createUserWithEmailAndPassword(ctx.auth, String(email).trim(), password);
      if (name) { try { await ctx.A.updateProfile(cred.user, { displayName: name }); } catch (e) { } }
      return await startSession({
        uid: cred.user.uid, mode: 'cloud', email: cred.user.email || '',
        name: name || (cred.user.email || '').split('@')[0]
      });
    } catch (err) { throw new Error(authErrorMessage(err)); }
  }

  async function signIn(email, password) {
    var ctx = await firebase();
    if (!ctx) throw new Error('Login na nuvem não está configurado. Use um perfil local ou preencha js/rv-config.js.');
    try {
      var cred = await ctx.A.signInWithEmailAndPassword(ctx.auth, String(email).trim(), password);
      return await startSession({
        uid: cred.user.uid, mode: 'cloud', email: cred.user.email || '',
        name: cred.user.displayName || (cred.user.email || '').split('@')[0]
      });
    } catch (err) { throw new Error(authErrorMessage(err)); }
  }

  /* Login com a conta Google. Precisa do provedor "Google" habilitado no
     console do Firebase (Authentication → Sign-in method) e do domínio do
     site em Authentication → Settings → Authorized domains. */
  async function signInWithGoogle() {
    var ctx = await firebase();
    if (!ctx) throw new Error('A conta na nuvem ainda não está ativa neste site.');
    try {
      var prov = new ctx.A.GoogleAuthProvider();
      prov.setCustomParameters({ prompt: 'select_account' });
      var cred = await ctx.A.signInWithPopup(ctx.auth, prov);
      var u = cred.user;
      return await startSession({
        uid: u.uid, mode: 'cloud', email: u.email || '',
        name: u.displayName || (u.email || '').split('@')[0] || 'jogador'
      });
    } catch (err) { throw new Error(authErrorMessage(err)); }
  }

  async function resetPassword(email) {
    var ctx = await firebase();
    if (!ctx) throw new Error('Recuperação de senha exige a nuvem configurada.');
    try { await ctx.A.sendPasswordResetEmail(ctx.auth, String(email).trim()); return true; }
    catch (err) { throw new Error(authErrorMessage(err)); }
  }

  async function signOut(opts) {
    opts = opts || {};
    try { if (isCloudSession() && opts.sync !== false) await pushProfile(); } catch (e) { }
    try { var ctx = await firebase(); if (ctx) await ctx.A.signOut(ctx.auth); } catch (e) { }
    writeSession(null);
  }

  /* ═══════════════ backup manual (funciona nos dois modos) ═══════════════ */

  function exportBackup() {
    return {
      app: 'RetroVault Web', version: 1, exportedAt: new Date().toISOString(),
      user: session ? { uid: session.uid, name: session.name, email: session.email, mode: session.mode } : null,
      data: RVStore.dump()
    };
  }
  function importBackup(json, mergeWithCurrent) {
    var pack = typeof json === 'string' ? JSON.parse(json) : json;
    if (!pack || !pack.data) throw new Error('Arquivo de backup inválido.');
    var data = mergeWithCurrent === false ? pack.data : mergeData(RVStore.dump(), pack.data, false);
    RVStore.load(data);
    lsSet(nsKey('rv_updated_at'), String(Date.now()));
    if (isCloudSession()) pushProfile().catch(function () { });
    return data;
  }

  /* ═══════════════ proteção de páginas ═══════════════ */

  function guard() {
    if (session) return true;
    if (CFG.requireLogin === false) return true;
    var here = location.pathname.split('/').pop() || 'index.html';
    if (here === 'login.html') return true;
    var next = here + location.search + location.hash;
    location.replace('login.html?next=' + encodeURIComponent(next));
    return false;
  }

  /* ═══════════════ API pública ═══════════════ */

  var RVAccount = {
    /* estado */
    user: function () { return session; },
    uid: currentUid,
    name: function () { return (session && (RVStore.getItem('rv_player_name') || session.name)) || ''; },
    isLogged: function () { return !!session; },
    isCloud: isCloudSession,
    cloudConfigured: CLOUD_CONFIGURED,
    cloudEnabled: function () { return CLOUD_CONFIGURED && isCloudSession(); },

    /* autenticação */
    signUp: signUp, signIn: signIn, signInWithGoogle: signInWithGoogle,
    signOut: signOut, resetPassword: resetPassword,
    localProfiles: localProfiles, createLocalProfile: createLocalProfile,
    signInLocal: signInLocal, deleteLocalProfile: deleteLocalProfile, updateLocalProfile: updateLocalProfile,

    /* dados */
    store: RVStore,
    syncNow: syncProfile, pushProfile: pushProfile, pullProfile: pullProfile,
    exportBackup: exportBackup, importBackup: importBackup,

    /* saves */
    saveKeyFor: function (core, file) { return currentUid() + '::' + core + '|' + file; },
    localSaveGet: idbGet, localSavePut: idbPut, localSaveDel: idbDel, localSaveKeys: idbKeys,
    uploadSave: uploadSave, downloadSave: downloadSave,
    listCloudSaves: listCloudSaves, deleteCloudSave: deleteCloudSave,

    /* utilidades */
    guard: guard, on: on, off: off,
    config: CFG
  };

  global.RVStore = RVStore;
  global.RVAccount = RVAccount;

  /* Se a sessão é da nuvem, revalida o token e sincroniza ao abrir a página. */
  if (isCloudSession()) {
    firebase().then(function (ctx) {
      if (!ctx) return;
      ctx.A.onAuthStateChanged(ctx.auth, function (user) {
        if (user && user.uid === session.uid) { syncProfile().catch(function () { }); }
        else if (!user) { /* token expirou: mantém os dados locais, pede login de novo */ writeSession(null); }
      });
    });
    /* Última chance de subir alterações ao fechar a aba. */
    global.addEventListener('pagehide', function () { try { pushProfile(); } catch (e) { } });
  }
})(window);

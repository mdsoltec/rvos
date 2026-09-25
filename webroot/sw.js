/* ═══════════════════════════════════════════════════════════
   RETROVAULT WEB — Service Worker (v9)
   O que mudou nesta versão:
   1. EmulatorJS (CDN) agora é cacheado com stale-while-revalidate:
      a 2ª abertura de um jogo usa o núcleo WASM do cache (quase
      instantânea) e o cache é atualizado em background quando há rede.
   2. Warmup não-bloqueante na ativação: loader.js + emulator.min.js
      já entram em cache no 1º acesso, sem atrasar a ativação do SW.
   3. STATIC_ASSETS agora inclui js/audio.js, js/overlay-parser.js e
      calibrate.html (faltavam → offline quebrava o player).
   4. Versão fixada do EmulatorJS (4.2.3) no warmup — veja play.html.
   ═══════════════════════════════════════════════════════════ */
const CACHE_NAME = 'retrovault-v10';
const CACHE_EJS = CACHE_NAME + '-ejs'; // núcleos/framework do EmulatorJS
const CACHE_COVERS = 'retrovault-covers'; // capas baixadas automaticamente da web
const CACHE_ROMS = 'retrovault-roms-v1'; // ROMs que o jogador escolheu levar para o offline
const EJS_CDN = 'https://cdn.emulatorjs.org/4.2.3/data/';

const STATIC_ASSETS = [
  'index.html',
  'games.html',
  'play.html',
  'profile.html',
  'login.html',
  'config.html',
  '404.html',
  'calibrate.html',
  'css/style.css?v=20260922',
  'assets/rv-icon.png',
  'assets/avatar-01.png',
  'assets/avatar-02.png',
  'assets/avatar-03.png',
  'assets/avatar-04.png',
  'assets/avatar-05.png',
  'assets/avatar-06.png',
  'assets/avatar-07.png',
  'assets/avatar-08.png',
  'assets/avatar-09.png',
  'assets/avatar-10.png',
  'assets/avatar-11.png',
  'assets/avatar-12.png',
  'assets/avatar-13.png',
  'assets/avatar-14.png',
  'assets/avatar-15.png',
  'assets/avatar-16.png',
  'assets/avatar-17.png',
  'assets/avatar-18.png',
  'assets/avatar-19.png',
  'assets/avatar-20.png',
  'manifest.json',
  'js/audio.js?v=20260922',
  'js/rv-config.js?v=20260922',
  'js/rv-account.js?v=20260922',
  'js/rv-input-mode.js?v=20260922',
  'js/covers.js?v=20260922',
  'js/covers-map.js?v=20260922',
  'js/fichas.js?v=20260922',
  'js/card-info.js?v=20260922',
  'js/rv-ui.js?v=20260922',
  'js/overlay-parser.js?v=20260922',
  'js/catalog.js?v=20260922',
  'js/rv-extras.js?v=20260922',
  // Base de cheats dinâmica do EmulatorJS
  'cheats/cheats.json',
  'cheats/nes.json',
  'cheats/snes.json',
  'cheats/gba.json',
  'cheats/gbc.json',
  'cheats/gb.json',
  'cheats/n64.json',
  'cheats/pcsx_rearmed.json',
  'cheats/segaMD.json',
  'cheats/segaCD.json',
  'cheats/segaGG.json',
  'cheats/segaMS.json',
  'cheats/nds.json',
  'cheats/fbneo.json'
];

// Install — cache static assets
// IMPORTANTE: cache.addAll() é "tudo ou nada" — um único arquivo ausente
// (ex.: uma página listada aqui que não existe mais no repositório) fazia a
// instalação inteira falhar e o app ficava SEM cache offline. Agora cada
// arquivo é buscado isoladamente: o que existir entra, o que faltar é ignorado.
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => Promise.all(
      STATIC_ASSETS.map(url =>
        cache.add(url).catch(err => {
          console.warn('[RetroVault Web SW] recurso ignorado no cache:', url, err && err.message);
        })
      )
    ))
  );
  self.skipWaiting();
});

// Activate — clean old caches + warmup do framework EJS (não-bloqueante)
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME && k !== CACHE_EJS && k !== CACHE_COVERS && k !== CACHE_ROMS).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );

  // Warmup: já deixa o motor do emulador em cache no 1º acesso.
  // Fora do waitUntil para nunca atrasar a ativação (offline incluso).
  caches.open(CACHE_EJS).then(cache => {
    [EJS_CDN + 'loader.js', EJS_CDN + 'emulator.min.js'].forEach(url => {
      fetch(url)
        .then(res => { if (res.ok) cache.put(url, res); })
        .catch(() => {});
    });
  });
});

// Fetch — network first, fallback to cache
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Skip non-GET requests
  if (event.request.method !== 'GET') return;

  // EmulatorJS (núcleos WASM): stale-while-revalidate.
  // 1º acesso baixa do CDN e guarda; 2º acesso (e offline) sai do cache;
  // em background o cache é atualizado quando há rede. URLs versionadas
  // (4.2.3, futuras) viram entradas separadas — nunca mistura versões.
  if (url.origin === 'https://cdn.emulatorjs.org') {
    event.respondWith(
      caches.open(CACHE_EJS).then(async cache => {
        const cached = await cache.match(event.request);
        const network = fetch(event.request)
          .then(res => {
            if (res && res.ok) cache.put(event.request, res.clone());
            return res;
          })
          .catch(() => cached);
        return cached || network;
      })
    );
    return;
  }

  // Capas remotas (libretro-thumbnails): cache-first, para não rebaixar
  // as mesmas imagens toda vez e funcionar offline depois da 1ª vez.
  if (url.hostname === 'thumbnails.libretro.com') {
    event.respondWith(
      caches.open(CACHE_COVERS).then(async cache => {
        const cached = await cache.match(event.request);
        if (cached) return cached;
        try {
          const res = await fetch(event.request);
          if (res && res.ok) cache.put(event.request, res.clone());
          return res;
        } catch (e) {
          return cached || Response.error();
        }
      })
    );
    return;
  }

  // ROMs guardadas pelo jogador ("Offline" no menu do jogo): cache-first.
  // Só atende o que ESTÁ no cache — quem não foi baixado segue para a rede.
  if (url.hostname === 'retroverse-roms.mdsoltec.workers.dev') {
    event.respondWith(
      caches.open(CACHE_ROMS).then(async cache => {
        const cached = await cache.match(event.request);
        if (cached) return cached;
        return fetch(event.request);
      })
    );
    return;
  }

  // Skip external CDN and ROM requests (too large to cache)
  if (url.hostname !== self.location.hostname) return;

  // Skip overlay images and covers (too many, too large)
  if (url.pathname.includes('/overlays/') || url.pathname.includes('/covers/')) return;

  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Clone and cache successful responses
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() =>
        // Offline ou recurso ausente: navegação cai na página 404 estilizada.
        event.request.mode === 'navigate'
          ? caches.match('404.html').then(r => r || caches.match('/404.html'))
          : caches.match(event.request)
      )
  );
});

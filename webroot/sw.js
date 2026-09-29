/* RetroVault OS — cache leve da interface. ROMs, APIs, saves e CDN nunca entram no cache. */
const CACHE_NAME = 'rvos-shell-v14';
const SHELL = [
  './', 'index.html', 'player.html', 'fonts.css', 'icons.css', 'shell.css', 'shell.js', 'profile-data.js',
  'theme.js', 'theme.css', 'player-theme.css',
  'bridge.js', 'input.js', 'icons.js', 'ui/system-gear.png', 'js/catalog.js', 'js/fichas.js', 'js/rv-os-exit.js',
  'js/rv-config.js', 'js/rv-account.js', 'js/rv-input-mode.js',
  'js/audio.js', 'js/overlay-parser.js', 'js/rv-extras.js',
  'fonts/rajdhani-400.woff2', 'fonts/rajdhani-600.woff2',
  'fonts/rajdhani-700.woff2', 'fonts/orbitron-700.woff2',
  ...Array.from({ length: 20 }, (_, i) => `assets/avatar-${String(i + 1).padStart(2, '0')}.png`)
];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => Promise.all(
    SHELL.map(path => cache.add(path).catch(() => {}))
  )).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(
    keys.filter(k => k !== CACHE_NAME && (k.startsWith('rvos-shell-') || /^retrovault-v\d/.test(k) || k === 'retrovault-covers')).map(k => caches.delete(k))
  )).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || /^\/(api|roms|vendor|covers|cheats)\//.test(url.pathname)) return;
  if (url.pathname.endsWith('/sw.js')) return;
  const isShell = SHELL.some(path => new URL(path, self.registration.scope).pathname === url.pathname);
  if (!isShell) return; // arquivos grandes e imagens ficam fora do CacheStorage
  event.respondWith(fetch(request).then(response => {
    if (response.ok) {
      const copy = response.clone();
      event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.put(request, copy)));
    }
    return response;
  }).catch(async () => (await caches.match(request, { ignoreSearch: true })) || Response.error()));
});

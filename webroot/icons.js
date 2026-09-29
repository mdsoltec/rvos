/* RetroVault OS — família de ícones vetoriais 24×24.
   Traço único, cantos arredondados e cor herdada do contexto (--sc/--gc).
   Nenhum emoji, webfont ou recurso externo necessário. */
(function (global) {
  'use strict';
  const shapes = {
    system: '<rect x="4" y="4" width="16" height="16" rx="3"/><rect x="8.5" y="8.5" width="7" height="7" rx="1.5"/><path d="M9 1.5v2.5m6-2.5v2.5M9 20v2.5m6-2.5v2.5M1.5 9H4m-2.5 6H4m16-6h2.5M20 15h2.5"/><path d="M11 10.5v3l2-2h-2"/>',
    settings: '<path d="M10 2h4l.55 2.3c.48.2.95.47 1.38.8l2.3-.69 2 3.46-1.74 1.65c.08.49.08 1.01 0 1.5l1.74 1.64-2 3.46-2.3-.68c-.43.32-.9.59-1.38.79L14 20h-4l-.55-2.3c-.48-.2-.95-.47-1.38-.8l-2.3.69-2-3.46 1.74-1.65a8 8 0 0 1 0-1.5L3.77 9.34l2-3.46 2.3.68c.43-.32.9-.59 1.38-.79L10 2Z" transform="translate(0 1) scale(1 .92)"/><circle cx="12" cy="12" r="2.7"/>',
    heart: '<path d="M20.8 8.8c0 5.2-8.8 10.2-8.8 10.2S3.2 14 3.2 8.8A4.8 4.8 0 0 1 12 6.2a4.8 4.8 0 0 1 8.8 2.6Z"/>',
    search: '<circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 4.5 4.5"/>',
    wifi: '<path d="M2.2 8.3a15 15 0 0 1 19.6 0M5.4 11.8a10 10 0 0 1 13.2 0M8.7 15.3a5 5 0 0 1 6.6 0"/><circle cx="12" cy="19" r=".8" fill="currentColor" stroke="none"/>',
    bluetooth: '<path d="M12 2v20l7-5.5-14-9M5 16.5l14-9L12 2"/>',
    lock: '<rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8 10.5V7a4 4 0 0 1 8 0v3.5"/>',
    battery: '<rect x="4" y="5.5" width="15.5" height="13" rx="2"/><path d="M21 10v4"/><path d="M7 9v6"/>',
    volume: '<path d="M4 9h4l5-4v14l-5-4H4V9Z"/><path d="M16 9a4.5 4.5 0 0 1 0 6m2.5-9a8 8 0 0 1 0 12"/>',
    brightness: '<circle cx="12" cy="12" r="4"/><path d="M12 1.8v2.1M12 20.1v2.1M1.8 12h2.1m16.2 0h2.1M4.8 4.8l1.5 1.5m11.4 11.4 1.5 1.5m0-14.4-1.5 1.5M6.3 17.7l-1.5 1.5"/>',
    info: '<circle cx="12" cy="12" r="9.3"/><path d="M12 10.7v5.6"/><circle cx="12" cy="7.7" r=".8" fill="currentColor" stroke="none"/>',
    profile: '<circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 2v6M17 2v6M3 10h18M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01"/>',
    video: '<rect x="2" y="5" width="20" height="14" rx="4"/><path d="m10 9 5 3-5 3V9Z"/>',
    film: '<rect x="4" y="2.5" width="16" height="19" rx="2"/><path d="M8 2.5v19M16 2.5v19M4 8h4m-4 6h4m8-6h4m-4 6h4"/>',
    music: '<path d="M9 18V5l11-2v13M9 8l11-2"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>',
    folder: '<path d="M3 6a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6Z"/>',
    external: '<path d="M13 4h7v7m0-7-9 9"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
    file: '<path d="M6 2h9l5 5v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Z"/><path d="M15 2v6h5M8 13h8M8 17h6"/>',
    refresh: '<path d="M20 11a8 8 0 1 0-2.4 6.4M20 4v7h-7"/>',
    reboot: '<path d="M20.5 10a8.5 8.5 0 1 1-2.9-5.1"/><path d="M20.5 3.5v6h-6"/>',
    power: '<path d="M12 2.5v9.2M7.3 5.6a8.5 8.5 0 1 0 9.4 0"/>',
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    gamepad: '<path d="M7 8h10a4 4 0 0 1 3.8 5.2l-1.1 3.4a2 2 0 0 1-3.5.6L14.8 15H9.2l-1.4 2.2a2 2 0 0 1-3.5-.6l-1.1-3.4A4 4 0 0 1 7 8Z"/><path d="M7 10v4M5 12h4M16.5 11.5h.01M18.5 13.5h.01"/>',
    edit: '<path d="M4 20h4l11-11a2.1 2.1 0 0 0-4-4L4 16v4Z"/><path d="m13 7 4 4"/>',
    check: '<path d="m4.5 12.5 5 5 10-11"/>',
    arrowRight: '<path d="M4 12h15m-6-6 6 6-6 6"/>',
    chevronRight: '<path d="m9 5 7 7-7 7"/>',
    shift: '<path d="m12 3-8 8h4v9h8v-9h4l-8-8Z"/>',
    backspace: '<path d="M9 5H21v14H9l-6-7 6-7Z"/><path d="m12 10 5 5m0-5-5 5"/>',
    save: '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z"/><path d="M7 3v6h9M7 21v-8h10v8"/>',
    load: '<path d="M3 16v3a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-3M12 3v12m-4-4 4 4 4-4"/>',
    resume: '<path d="M7 4.5v15l12-7.5-12-7.5Z"/>',
    play: '<path d="M7 4.5v15l12-7.5-12-7.5Z"/>',
    exit: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4m7 4 5 5-5 5M21 12H9"/>',
    camera: '<rect x="2.5" y="6" width="19" height="14" rx="2"/><path d="m7 6 1.5-2h7L17 6"/><circle cx="12" cy="13" r="3"/>',
    cloud: '<path d="M6.5 18a4.5 4.5 0 0 1-.2-9 6 6 0 0 1 11.4-1 5 5 0 0 1 .5 10H6.5Z"/>',
    warning: '<path d="M10.2 3.5a2 2 0 0 1 3.6 0L22 18a2 2 0 0 1-1.8 3H3.8A2 2 0 0 1 2 18l8.2-14.5Z"/><path d="M12 9v5.5M12 17.5h.01"/>',
    sparkle: '<path d="m12 2.5 2.2 6.3 6.3 2.2-6.3 2.2-2.2 6.3-2.2-6.3L3.5 11l6.3-2.2L12 2.5Z"/><path d="m19 17 .8 1.2 1.2.8-1.2.8L19 21l-.8-1.2L17 19l1.2-.8L19 17Z"/>',
    trophy: '<path d="M7 3h10v7a5 5 0 0 1-10 0V3Zm0 2H4v3a4 4 0 0 0 3 3m10-6h3v3a4 4 0 0 1-3 3M12 15v4m-4 2h8m-9-2h10"/>',
    theater: '<rect x="2.5" y="4" width="19" height="16" rx="2"/><path d="M2.5 9h19M8 4l-2 5m8-5-2 5m8-5-2 5"/>',
    fullscreen: '<path d="M9 3H3v6m12-6h6v6M3 15v6h6m12-6v6h-6"/>',
    screenshot: '<rect x="2.5" y="3.5" width="19" height="17" rx="2"/><circle cx="8.5" cy="9" r="1"/><path d="m4 17 5-5 3.5 3.5 2-2 5 5"/>'
  };
  function render(name, classes) {
    if (!Object.prototype.hasOwnProperty.call(shapes, name)) throw new Error('Ícone desconhecido: ' + name);
    const cls = (classes || '').replace(/[^a-zA-Z0-9 _-]/g, '');
    return `<svg class="rv-icon${cls ? ' ' + cls : ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${shapes[name]}</svg>`;
  }
  function hydrate(root) {
    (root || document).querySelectorAll('[data-rv-icon]').forEach(el => {
      el.innerHTML = render(el.dataset.rvIcon);
      el.removeAttribute('data-rv-icon');
    });
  }
  global.RVIcons = Object.freeze({ render, hydrate, names: Object.freeze(Object.keys(shapes)) });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => hydrate());
  else hydrate();
})(window);

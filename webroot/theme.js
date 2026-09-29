/* RetroVault OS — quatro identidades visuais, uma preferência local.
   Rodar no <head> evita flash de tema ao abrir a shell ou o player. */
(function (global) {
  'use strict';
  const KEY = 'rvos:theme';
  const themes = Object.freeze([
    Object.freeze({ id: 'vault', name: 'Vault Neon', note: 'A assinatura verde do RetroVault', colors: ['#030a06', '#00ff41', '#5cff8a'] }),
    Object.freeze({ id: 'orbit', name: 'Órbita', note: 'Violeta elétrico e azul-celeste', colors: ['#101026', '#bc88ff', '#62d8ff'] }),
    Object.freeze({ id: 'sunset', name: 'Arcade Sunset', note: 'Âmbar, coral e noite profunda', colors: ['#18101c', '#ffc36c', '#ff7885'] }),
    Object.freeze({ id: 'polar', name: 'Polar', note: 'Luz, clareza e contraste', colors: ['#eaf2f9', '#1164ac', '#297eaa'] }),
  ]);
  function valid(id) { return themes.some(t => t.id === id); }
  function saved() {
    try { const id = global.localStorage.getItem(KEY); return valid(id) ? id : 'vault'; }
    catch (e) { return 'vault'; }
  }
  function preview(id) {
    const safe = valid(id) ? id : 'vault';
    global.document.documentElement.dataset.rvTheme = safe;
    return safe;
  }
  function commit(id) {
    if (!valid(id)) return false;
    try { global.localStorage.setItem(KEY, id); preview(id); return true; }
    catch (e) { return false; }
  }
  global.RVTheme = Object.freeze({ themes, saved, preview, commit });
  preview(saved());
  global.addEventListener('storage', e => { if (e.key === KEY) preview(saved()); });
})(window);

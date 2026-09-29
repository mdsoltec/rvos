/* RetroVault OS — leitura segura dos dados locais já gravados pelo player.
   O console não tem login: o player usa o namespace RVStore do convidado. */
(function (global) {
  'use strict';
  const prefix = 'rv:convidado:';
  function raw(key) { try { return global.localStorage.getItem(prefix + key); } catch (e) { return null; } }
  function get(key, fallback) {
    try { const value = JSON.parse(raw(key)); return value == null ? fallback : value; }
    catch (e) { return fallback; }
  }
  function obj(v) { return v && typeof v === 'object' && !Array.isArray(v) ? v : {}; }
  function arr(v) { return Array.isArray(v) ? v : []; }
  function sec(v) { return typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.min(v, 1e9) : 0; }
  function name() {
    try {
      const old = JSON.parse(global.localStorage.getItem('rvos:profile:name'));
      if (typeof old === 'string' && old.trim()) return old.trim().slice(0, 18);
    } catch (e) { /* sem preferência antiga */ }
    const fromPlayer = raw('rv_player_name'); // texto puro no RVStore, não JSON
    return typeof fromPlayer === 'string' ? fromPlayer.trim().slice(0, 18) : '';
  }
  function saveName(value) {
    const clean = String(value || '').trim().slice(0, 18);
    if (!clean) return false;
    global.localStorage.setItem('rvos:profile:name', JSON.stringify(clean));
    global.localStorage.setItem(prefix + 'rv_player_name', clean);
    return true;
  }
  function syncName() {
    const current = name();
    if (current && !raw('rv_player_name')) {
      try { global.localStorage.setItem(prefix + 'rv_player_name', current); } catch (e) { /* armazenamento bloqueado */ }
    }
  }
  const AVATARS = Object.freeze(Array.from({ length: 20 }, (_, i) => `assets/avatar-${String(i + 1).padStart(2, '0')}.png`));
  function avatar() {
    const value = raw('rv_avatar'); // RVStore guarda texto puro, como rv_player_name
    return AVATARS.includes(value) ? value : AVATARS[0];
  }
  function saveAvatar(value) {
    if (!AVATARS.includes(value)) return false;
    try { global.localStorage.setItem(prefix + 'rv_avatar', value); return true; }
    catch (e) { return false; }
  }
  function dayKey(date) {
    return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
  }
  function fmtTime(value) {
    const n = Math.floor(sec(value));
    if (n >= 3600) return `${Math.floor(n / 3600)}h${Math.floor(n % 3600 / 60) ? ' ' + Math.floor(n % 3600 / 60) + 'min' : ''}`;
    return n >= 60 ? Math.floor(n / 60) + 'min' : n > 0 ? 'menos de 1min' : '0min';
  }
  const DEFS = [
    ['first_game', 'Primeira Aventura', 'Abra seu primeiro jogo', s => s.sessions >= 1],
    ['five_games', 'Explorador', 'Jogue 5 jogos diferentes', s => s.played >= 5],
    ['ten_games', 'Veterano', 'Jogue 10 jogos diferentes', s => s.played >= 10],
    ['twenty_games', 'Lenda Retro', 'Jogue 20 jogos diferentes', s => s.played >= 20],
    ['three_consoles', 'Multiverso', 'Jogue em 3 consoles diferentes', s => s.consoles >= 3],
    ['all_consoles', 'Mestre dos Mundos', 'Jogue em todos os consoles', s => s.consoles >= 11],
    ['first_fav', 'Favorito!', 'Favorite seu primeiro jogo', s => s.favorites >= 1],
    ['five_favs', 'Curador', 'Favorite 5 jogos', s => s.favorites >= 5],
    ['ten_sessions', 'Dedicado', 'Abra 10 sessões de jogo', s => s.sessions >= 10],
    ['fifty_sessions', 'Hardcore', 'Abra 50 sessões de jogo', s => s.sessions >= 50],
    ['first_screenshot', 'Fotógrafo', 'Tire seu primeiro screenshot', s => s.screenshots >= 1],
    ['ten_screenshots', 'Galeria', 'Tire 10 screenshots', s => s.screenshots >= 10],
  ];
  function snapshot(catalog, favorites, now = new Date()) {
    const playtime = obj(get('rv_playtime', {}));
    const activity = obj(get('rv_activity', {}));
    const stats = {
      sessions: Math.floor(sec(get('rv_sessions', 0))),
      played: new Set(arr(get('rv_played_games', [])).filter(v => typeof v === 'string')).size,
      consoles: new Set(arr(get('rv_consoles_played', [])).filter(v => typeof v === 'string')).size,
      screenshots: Math.floor(sec(get('rv_screenshots', 0))),
      favorites: favorites instanceof Set ? favorites.size : arr(get('rv_favorites', [])).length,
    };
    let seconds = 0;
    const top = Object.entries(playtime).filter(([key]) => typeof key === 'string').map(([key, value]) => {
      const duration = sec(value); seconds += duration;
      const slash = key.indexOf('/'), sys = slash < 0 ? '' : key.slice(0, slash), file = key.slice(slash + 1);
      const game = catalog[sys]?.games?.find(g => g.file === file);
      return { sys, name: game?.name || file || key, seconds: duration };
    }).filter(row => row.seconds > 0).sort((a, b) => b.seconds - a.seconds).slice(0, 5);
    stats.seconds = seconds;
    const today = new Date(now); today.setHours(0, 0, 0, 0);
    const start = new Date(today);
    start.setDate(start.getDate() - start.getDay() - 11 * 7); // 12 semanas, domingo a sábado
    const days = [];
    for (let i = 0; i < 84; i++) {
      const d = new Date(start); d.setDate(start.getDate() + i);
      days.push({ key: dayKey(d), seconds: d <= today ? sec(activity[dayKey(d)]) : 0, future: d > today });
    }
    let streak = 0;
    const cur = new Date(today);
    if (!sec(activity[dayKey(cur)])) cur.setDate(cur.getDate() - 1);
    while (streak < 3660 && sec(activity[dayKey(cur)])) { streak++; cur.setDate(cur.getDate() - 1); }
    const saved = obj(get('rv_achievements', {}));
    let changed = false;
    const achievements = DEFS.map(([id, title, desc, earned]) => {
      if (!saved[id] && earned(stats)) { saved[id] = { name: title, desc, date: Date.now() }; changed = true; }
      return { id, title, desc, unlocked: !!saved[id] };
    });
    if (changed) {
      try { global.localStorage.setItem(prefix + 'rv_achievements', JSON.stringify(saved)); }
      catch (e) { /* quota indisponível: ainda mostra o que foi conquistado */ }
    }
    return { name: name() || 'Jogador', avatar: avatar(), stats, top, days, streak, achievements,
      earned: achievements.filter(a => a.unlocked).length };
  }
  global.RVProfile = Object.freeze({ snapshot, name, saveName, syncName, avatar, saveAvatar, avatars: AVATARS, fmtTime });
})(window);

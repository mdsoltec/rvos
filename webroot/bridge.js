/* ═══════════════════════════════════════════════════════════════════
   RetroVault OS — ponte com o hardware ("bridge")
   No console, um daemon local (firmware/rootfs/opt/retrovault/bridge.py)
   serve o próprio site e responde /api/*: wi-fi, volume, brilho,
   bateria e energia. Fora do console (navegador comum), cai no modo
   SIMULAÇÃO para a shell funcionar em qualquer lugar.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const TIMEOUT = 2500;
  let available = null; // null = ainda não detectado

  function req(path, opts, timeout = TIMEOUT) {
    return new Promise((resolve, reject) => {
      const ctl = new AbortController();
      const t = setTimeout(() => { ctl.abort(); reject(new Error('timeout')); }, timeout);
      fetch(path, Object.assign({ signal: ctl.signal }, opts || {}))
        .then(r => { clearTimeout(t); if (!r.ok) throw new Error('http ' + r.status); return r.json(); })
        .then(r => { if (r.ok === false) throw new Error(r.error || r.detail || 'Falha na API'); return r; })
        .then(resolve, (e) => { clearTimeout(t); reject(e); });
    });
  }
  function post(path, body, timeout) {
    return req(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) }, timeout);
  }

  /* ── Estado simulado (preview/dev fora do hardware) ── */
  const sim = {
    volume: parseInt(localStorage.getItem('rvos:volume') || '70', 10),
    brightness: parseInt(localStorage.getItem('rvos:brightness') || '85', 10),
    wifi: { connected: true, ssid: 'Rede Simulada', signal: 82 },
    nets: [
      { ssid: 'Rede Simulada', signal: 82, secure: true, connected: true },
      { ssid: 'VIZINHO_5G', signal: 46, secure: true },
      { ssid: 'Cafe Retro', signal: 31, secure: false },
    ],
  };

  const Bridge = {
    simulated: true,

    async detect() {
      try { await req('/api/status'); available = true; } catch (e) { available = false; }
      Bridge.simulated = !available;
      return available;
    },

    async status() {
      if (available) return req('/api/status');
      return {
        ok: true, simulated: true,
        wifi: sim.wifi, battery: null, // sem bateria na simulação
        volume: sim.volume, brightness: sim.brightness,
        ip: '—', version: 'dev',
      };
    },

    async setVolume(v) {
      v = Math.max(0, Math.min(100, v | 0));
      if (available) return post('/api/volume', { value: v });
      sim.volume = v; localStorage.setItem('rvos:volume', String(v));
      return { ok: true, value: v };
    },

    async setBrightness(v) {
      v = Math.max(10, Math.min(100, v | 0));
      if (available) return post('/api/brightness', { value: v });
      sim.brightness = v; localStorage.setItem('rvos:brightness', String(v));
      document.querySelector('.crt-vignette').style.opacity = String(1.4 - v / 100 * 0.9);
      return { ok: true, value: v };
    },

    async wifiScan() {
      if (available) return req('/api/wifi/scan', null, 18000);
      return { ok: true, networks: sim.nets };
    },

    async wifiConnect(ssid, psk) {
      if (available) return post('/api/wifi/connect', { ssid: ssid, psk: psk || '' }, 45000);
      await new Promise(r => setTimeout(r, 1200)); // finge handshake
      sim.wifi = { connected: true, ssid: ssid, signal: 75 };
      sim.nets.forEach(n => n.connected = n.ssid === ssid);
      return { ok: true };
    },

    async power(action) { // 'shutdown' | 'reboot'
      if (available) return post('/api/system', { action: action });
      return { ok: false, error: 'simulated' };
    },
  };

  window.RVBridge = Bridge;
})();

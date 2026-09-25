/* ═══════════════════════════════════════════════════════════
   RETROVAULT WEB AUDIO ENGINE
   Sons sintéticos via Web Audio API (sem arquivos externos)
═══════════════════════════════════════════════════════════ */
const RV_AUDIO = (function() {
  let ctx = null;
  let enabled = true;
  let volume = 0.3;

  function getCtx() {
    if (!ctx) {
      try { ctx = new (window.AudioContext || window.webkitAudioContext)(); }
      catch(e) { enabled = false; }
    }
    return ctx;
  }

  // Desbloqueia o AudioContext na primeira interação do usuário
  // (navegadores bloqueiam áudio antes de um clique/toque)
  function unlockAudio() {
    const c = getCtx();
    if (c && c.state === 'suspended') {
      c.resume().then(() => {
        console.log('[RV_AUDIO] AudioContext unlocked');
      });
    }
  }

  // Adiciona listeners quando o DOM estiver pronto
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      document.addEventListener('click', unlockAudio);
      document.addEventListener('touchstart', unlockAudio);
      document.addEventListener('keydown', unlockAudio);
    });
  } else {
    document.addEventListener('click', unlockAudio);
    document.addEventListener('touchstart', unlockAudio);
    document.addEventListener('keydown', unlockAudio);
  }

  function playTone(freq, duration, type = 'square', vol = volume, delay = 0) {
    if (!enabled) return;
    const c = getCtx();
    if (!c) return;
    if (c.state === 'suspended') { c.resume(); }
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, c.currentTime + delay);
    gain.gain.setValueAtTime(vol, c.currentTime + delay);
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + delay + duration);
    osc.connect(gain);
    gain.connect(c.destination);
    osc.start(c.currentTime + delay);
    osc.stop(c.currentTime + delay + duration);
  }

  function playNoise(duration, vol = volume * 0.5, delay = 0) {
    if (!enabled) return;
    const c = getCtx();
    if (!c) return;
    if (c.state === 'suspended') c.resume();
    const bufferSize = c.sampleRate * duration;
    const buffer = c.createBuffer(1, bufferSize, c.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    const source = c.createBufferSource();
    source.buffer = buffer;
    const gain = c.createGain();
    gain.gain.setValueAtTime(vol, c.currentTime + delay);
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + delay + duration);
    source.connect(gain);
    gain.connect(c.destination);
    source.start(c.currentTime + delay);
  }

  // ═══ UI SOUNDS ═══
  function uiClick() {
    playTone(800, 0.06, 'square', volume * 0.6);
    playTone(1200, 0.04, 'square', volume * 0.3, 0.03);
  }

  function uiHover() {
    playTone(600, 0.03, 'sine', volume * 0.2);
  }

  function uiTransition() {
    playTone(400, 0.15, 'sine', volume * 0.3);
    playTone(600, 0.12, 'sine', volume * 0.25, 0.05);
    playTone(800, 0.1, 'sine', volume * 0.2, 0.1);
  }

  // ═══ BOOT SOUNDS POR CONSOLE ═══
  function bootNintendo() {
    // Clássico "ding" do Nintendo
    playTone(1047, 0.15, 'square', volume * 0.5);
    playTone(1319, 0.15, 'square', volume * 0.4, 0.08);
    playTone(1568, 0.3, 'square', volume * 0.35, 0.16);
  }

  function bootSuperNintendo() {
    // SNES startup — notas descendentes suaves
    playTone(880, 0.2, 'sine', volume * 0.4);
    playTone(660, 0.2, 'sine', volume * 0.35, 0.15);
    playTone(440, 0.4, 'sine', volume * 0.3, 0.3);
    playNoise(0.1, volume * 0.1, 0.05);
  }

  function bootN64() {
    // N64 chime — acorde brilhante
    playTone(523, 0.3, 'sine', volume * 0.4);
    playTone(659, 0.3, 'sine', volume * 0.3, 0.05);
    playTone(784, 0.4, 'sine', volume * 0.35, 0.1);
    playTone(1047, 0.5, 'sine', volume * 0.25, 0.2);
  }

  function bootSega() {
    // "SEEEGAAA" — sweep ascendente
    for (let i = 0; i < 8; i++) {
      playTone(200 + i * 80, 0.12, 'sawtooth', volume * (0.4 - i * 0.03), i * 0.04);
    }
    playTone(1200, 0.3, 'sawtooth', volume * 0.25, 0.35);
  }

  function bootPlayStation() {
    // PS1 — ambiente dramático
    playNoise(0.3, volume * 0.15);
    playTone(130, 0.6, 'sine', volume * 0.3, 0.1);
    playTone(196, 0.5, 'sine', volume * 0.25, 0.3);
    playTone(262, 0.5, 'sine', volume * 0.2, 0.5);
    playTone(392, 0.6, 'sine', volume * 0.3, 0.7);
    playTone(523, 0.4, 'triangle', volume * 0.25, 0.9);
  }

  function bootGBA() {
    // GBA — ding rápido + jingle
    playTone(1319, 0.08, 'square', volume * 0.4);
    playNoise(0.05, volume * 0.15, 0.05);
    playTone(1047, 0.12, 'square', volume * 0.3, 0.15);
    playTone(1319, 0.12, 'square', volume * 0.3, 0.22);
    playTone(1568, 0.2, 'square', volume * 0.25, 0.3);
  }

  function bootGBC() {
    // GBC — plim plim
    playTone(1568, 0.1, 'square', volume * 0.35);
    playTone(2093, 0.15, 'square', volume * 0.3, 0.12);
    playNoise(0.04, volume * 0.1, 0.08);
  }

  function bootArcade() {
    // Arcade — coin insert + ready
    playTone(1200, 0.05, 'square', volume * 0.5);
    playTone(1600, 0.05, 'square', volume * 0.4, 0.08);
    playTone(800, 0.08, 'square', volume * 0.35, 0.2);
    playTone(1000, 0.08, 'square', volume * 0.35, 0.28);
    playTone(1200, 0.08, 'square', volume * 0.35, 0.36);
    playTone(1600, 0.15, 'square', volume * 0.3, 0.44);
  }

  function bootNDS() {
    // NDS — bleeps duplos
    playTone(880, 0.1, 'square', volume * 0.35);
    playTone(1175, 0.1, 'square', volume * 0.3, 0.12);
    playNoise(0.04, volume * 0.1, 0.06);
    playTone(880, 0.08, 'sine', volume * 0.25, 0.25);
    playTone(1319, 0.15, 'sine', volume * 0.3, 0.3);
  }

  function bootGameGear() {
    // Game Gear — curto e energético
    playTone(440, 0.1, 'sawtooth', volume * 0.3);
    playTone(660, 0.1, 'sawtooth', volume * 0.25, 0.08);
    playTone(880, 0.15, 'sawtooth', volume * 0.2, 0.16);
  }

  function bootSegaCD() {
    // Sega CD — versão expandida do Sega
    playNoise(0.2, volume * 0.1);
    for (let i = 0; i < 6; i++) {
      playTone(250 + i * 100, 0.15, 'sawtooth', volume * (0.35 - i * 0.03), 0.1 + i * 0.05);
    }
    playTone(1400, 0.35, 'sawtooth', volume * 0.2, 0.45);
    playTone(700, 0.3, 'sine', volume * 0.15, 0.5);
  }

  // Mapa de boot sounds
  const BOOT_SOUNDS = {
    snes: bootSuperNintendo,
    nes: bootNintendo,
    n64: bootN64,
    pcsx_rearmed: bootPlayStation,
    segaMD: bootSega,
    segaCD: bootSegaCD,
    segaGG: bootGameGear,
    gba: bootGBA,
    gbc: bootGBC,
    nds: bootNDS,
    fbneo: bootArcade,
  };

  function playBoot(core) {
    const fn = BOOT_SOUNDS[core];
    if (fn) {
      try { fn(); } catch(e) {}
    }
  }

  // ═══ TOGGLE ═══
  function toggle() {
    enabled = !enabled;
    localStorage.setItem('rv_audio_enabled', JSON.stringify(enabled));
    return enabled;
  }

  function loadPreference() {
    try {
      const saved = JSON.parse(localStorage.getItem('rv_audio_enabled'));
      if (saved !== null) enabled = saved;
    } catch(e) {}
  }

  loadPreference();

  return {
    uiClick, uiHover, uiTransition,
    playBoot, toggle,
    get enabled() { return enabled; },
    setVolume(v) { volume = Math.max(0, Math.min(1, v)); }
  };
})();

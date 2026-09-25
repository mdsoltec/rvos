/**
 * RetroVault Web - RetroArch Overlay CFG Parser & Automatic Touch Engine (PocketArch Compatible)
 * 
 * Converte automaticamente qualquer arquivo .cfg do RetroArch / Libretro (ex: PocketArch)
 * e suas imagens de overlay em um sistema de controle touch dinâmico e calibrado.
 * 
 * Suporta:
 * - Tela inteira nativa (100% largura x 100% altura) sem cortar a parte inferior (MENU/START)
 * - Mapeamento de coordenadas (x, y) 100% sincronizado entre a imagem visual e a zona de toque do .cfg
 * - Mapeamento automático para window.EJS_emulator.gameManager.simulateInput(0, id, val)
 * - Renderização de imagens individuais de botões (ex: a-n64-grey.png, d-pad white.png, thumbstick.png)
 * - Analógico arrastável com movimento real
 * - ZERO efeitos visuais verdes desnecessários (100% limpo como um controle original)
 * - Sistema Inteligente de Prioridade de CFGs para GBA, PSX (DualShock), NDS e Saturn 6 Botões no Arcade
 */

(function(global) {
  'use strict';

  // Tabela de conversão de botões RetroArch -> EmulatorJS
  // Inclui suporte a layouts de 6 botões (Sega Saturn: A, B, C, X, Y, Z) para jogos de Luta no Arcade
  const RA_TO_EJS = {
    'b': 'B',
    'y': 'Y',
    'a': 'A',
    'fire': 'B',      // Atari 2600: o FIRE é o input 0 = botão B (scheme do EJS)
    'fire1': 'B',     // variação de nome (alguns CFGs usam fire1)
    'x': 'X',
    'c': 'R',  // No layout Saturn 6 botões (A B C / X Y Z), 'c' aciona R (Chute Forte/Médio)
    'z': 'L',  // No layout Saturn 6 botões, 'z' aciona L (Soco Forte/Médio)
    'start': 'START',
    'select': 'SELECT',
    'l': 'L',
    'r': 'R',
    'l2': 'L2', // Z-Trigger no N64 / L2 no PSX
    'r2': 'R2',
    'l3': 'L3',
    'r3': 'R3',
    'up': 'UP',
    'down': 'DOWN',
    'left': 'LEFT',
    'right': 'RIGHT',
    'r_y_plus': 'RSTICK_UP',    // C-Up no N64
    'r_y_minus': 'RSTICK_DOWN', // C-Down no N64
    'r_x_minus': 'RSTICK_LEFT', // C-Left no N64
    'r_x_plus': 'RSTICK_RIGHT', // C-Right no N64
  };

  const EJS_INPUT_CODES = {
    B:0, Y:1, SELECT:2, START:3,
    UP:4, DOWN:5, LEFT:6, RIGHT:7,
    A:8, X:9, L:10, R:11, L2:12, R2:13,
    L3:14, R3:15,
    LSTICK_RIGHT:16, LSTICK_LEFT:17, LSTICK_DOWN:18, LSTICK_UP:19,
    RSTICK_RIGHT:20, RSTICK_LEFT:21, RSTICK_DOWN:22, RSTICK_UP:23,
  };

  class RetroArchOverlayEngine {
    constructor(wrapEl, cfgText, basePath, options = {}) {
      this.wrapEl = wrapEl;
      this.basePath = basePath.replace(/\/$/, '') + '/';
      this.debug = options.debug || new URLSearchParams(window.location.search).has('debug')
        || window.location.search.toLowerCase().includes('debug');
      this.isPortrait = options.isPortrait !== undefined ? options.isPortrait : (window.innerHeight > window.innerWidth);
      
      this.overlays = {};
      this.activeOverlayId = null;
      this.activeTouches = new Map(); // identifier -> list of { type, input, desc }
      this.activeStylus = new Set(); // toques sem zona de botão no DS
      this.activeButtons = new Set(); // EJS_INPUT codes atualmente pressionados
      this.activeHolds = new Map();   // identifier -> Set de ações "segurar" (fast_forward, rewind)
      this.menuPresses = new Map();   // identifier -> { timer, firedLong } para tap=cheats / hold=barra de sistema
      // Estado do analógico analógico (contínuo) + rebase "seguir o dedo"
      this.activeAnalog = new Map();  // touchId -> { axis, nx, ny }
      this.analogBase = new Map();    // touchId -> { axis, desc, originX, originY }
      this.dpadVisual = new Map();    // touchId -> { desc, originX, originY } (stick animado)
      this.AV = 0x7fff;               // amplitude máxima do analógico (valor do RetroArch)
      // Fator de inflação da zona de toque (hitbox maior que o visual)
      this.HIT_SCALE = 1.4;

      this.parseCfg(cfgText);
      this.init();
    }

    parseCfg(cfgText) {
      const lines = cfgText.split(/\r?\n/);
      const data = {};

      for (let line of lines) {
        line = line.trim();
        if (!line || line.startsWith('#')) continue;
        const eqIndex = line.indexOf('=');
        if (eqIndex === -1) continue;

        const key = line.substring(0, eqIndex).trim();
        let val = line.substring(eqIndex + 1).trim();
        if (val.startsWith('"') && val.endsWith('"')) {
          val = val.slice(1, -1);
        }
        data[key] = val;
      }

      const totalOverlays = parseInt(data['overlays'] || '1', 10);
      this.overlayOrder = [];
      for (let i = 0; i < totalOverlays; i++) {
        const prefix = `overlay${i}_`;
        const ov = {
          id: `overlay${i}`,
          name: data[prefix + 'name'] || `overlay_${i}`,
          overlayImage: data[prefix + 'overlay'] || '',
          aspectRatio: parseFloat(data[prefix + 'aspect_ratio'] || '0'),
          descs: [],
        };

        const totalDescs = parseInt(data[prefix + 'descs'] || '0', 10);
        for (let d = 0; d < totalDescs; d++) {
          const dKey = `${prefix}desc${d}`;
          const dVal = data[dKey];
          if (!dVal) continue;

          const parts = dVal.split(',').map(p => p.trim());
          if (parts.length < 6) continue;

          const desc = {
            index: d,
            button: parts[0],
            x: parseFloat(parts[1]),
            y: parseFloat(parts[2]),
            type: parts[3], // 'radial' ou 'rect'
            rx: parseFloat(parts[4]),
            ry: parseFloat(parts[5]),
            nextTarget: data[`${dKey}_next_target`] || null,
            up: data[`${dKey}_up`] || null,
            down: data[`${dKey}_down`] || null,
            left: data[`${dKey}_left`] || null,
            right: data[`${dKey}_right`] || null,
            overlayImg: data[`${dKey}_overlay`] || null,
            overlayKey: ov.id,
            imgEl: null,
          };
          ov.descs.push(desc);
        }

        this.overlays[ov.id] = ov;
        this.overlays[ov.name] = ov;
        this.overlayOrder.push(ov.id);
      }

      this.selectDefaultOverlay();
    }

    isPauseOverlay(overlay) {
      if (!overlay) return false;
      const label = `${overlay.name || ''} ${overlay.overlayImage || ''}`.toLowerCase();
      return /(^|[\s_\-/])(pause|menu)([\s_\-/.]|$)/i.test(label);
    }

    getUniqueOverlays() {
      return Object.values(this.overlays).filter((overlay, index, list) =>
        overlay && list.findIndex(item => item.id === overlay.id) === index
      );
    }

    selectDefaultOverlay() {
      const overlays = this.getUniqueOverlays();
      const preferredId = this.isPortrait
        ? 'overlay0'
        : (this.overlays['overlay2'] ? 'overlay2' : 'overlay0');
      const preferred = this.overlays[preferredId];

      // phone_portrait_pause.png é apenas a tela de menu/pause do pacote
      // RetroArch. Ela não deve ser usada como overlay inicial do jogo.
      if (preferred && !this.isPauseOverlay(preferred)) {
        this.activeOverlayId = preferred.id;
        return;
      }

      const normalOverlay = overlays.find(overlay => !this.isPauseOverlay(overlay));
      this.activeOverlayId = normalOverlay?.id || preferred?.id || overlays[0]?.id || null;
    }

    init() {
      if (!this.activeOverlayId || !this.wrapEl) return;
      // remove listeners de uma inicialização anterior (evita acúmulo)
      this.destroy();
      this.renderOverlay(this.activeOverlayId);
      // DIAGNÓSTICO: mostra qual overlay está ativo e quantas zonas tem
      if (this.debug) {
        const ov = this.overlays[this.activeOverlayId];
        console.log(`[RA] Overlay ativo: ${this.activeOverlayId} (${this.overlays[this.activeOverlayId]?.name})`, 
          `| zonas: ${ov ? ov.descs.length : 0}`, `| usáveis: ${this.hasUsableZones()}`,
          `| portrait: ${this.isPortrait}`);
      }

      // Listeners Touch globais no container. A primeira ocorrência de um
      // TouchEvent nativo marca que o canal touch do aparelho está OK.
      this._touchStart = (e) => { this._nativeTouchOk = true; this.onTouchStart(e); };
      this._touchMove = (e) => this.onTouchMove(e);
      this._touchEnd = (e) => this.onTouchEnd(e);
      this._mouseDown = (e) => this.onMouseDown(e);
      this._mouseMove = (e) => this.onMouseMove(e);
      this._mouseUp = (e) => this.onMouseUp(e);
      this._resize = () => {
        this.isPortrait = window.innerHeight > window.innerWidth;
        this.renderOverlay(this.activeOverlayId);
      };

      this.wrapEl.addEventListener('touchstart', this._touchStart, { passive: false });
      this.wrapEl.addEventListener('touchmove', this._touchMove, { passive: false });
      this.wrapEl.addEventListener('touchend', this._touchEnd, { passive: false });
      this.wrapEl.addEventListener('touchcancel', this._touchEnd, { passive: false });

      this.wrapEl.addEventListener('mousedown', this._mouseDown);
      window.addEventListener('mousemove', this._mouseMove);
      window.addEventListener('mouseup', this._mouseUp);
      window.addEventListener('resize', this._resize);

      // ── Canal POINTER EVENTS (plano B) ──
      // Só entra em ação em shells que NÃO têm a API TouchEvent (alguns
      // WebViews/shells de PWA com input via pointer apenas). Em celulares e
      // navegadores com touch normal, nada muda: o canal touch continua.
      if (!('ontouchstart' in window) && typeof window.PointerEvent !== 'undefined') {
        const adapt = (handler) => (e) => {
          const t = { identifier: 'ptr' + (e.pointerId || 1), clientX: e.clientX, clientY: e.clientY, target: e.target };
          handler.call(this, { changedTouches: [t], touches: [t], preventDefault: () => { try { e.preventDefault(); } catch (_) { } } });
        };
        this._ptrDown = adapt(this.onTouchStart);
        this._ptrMove = adapt(this.onTouchMove);
        this._ptrUp = adapt(this.onTouchEnd);
        this.wrapEl.addEventListener('pointerdown', this._ptrDown);
        this.wrapEl.addEventListener('pointermove', this._ptrMove);
        this.wrapEl.addEventListener('pointerup', this._ptrUp);
        this.wrapEl.addEventListener('pointercancel', this._ptrUp);
      }
    }

    /** Remove todos os listeners para poder re-inicializar sem acumular */
    destroy() {
      if (this._touchStart) {
        this.wrapEl.removeEventListener('touchstart', this._touchStart);
        this.wrapEl.removeEventListener('touchmove', this._touchMove);
        this.wrapEl.removeEventListener('touchend', this._touchEnd);
        this.wrapEl.removeEventListener('touchcancel', this._touchEnd);
        this.wrapEl.removeEventListener('mousedown', this._mouseDown);
        window.removeEventListener('mousemove', this._mouseMove);
        window.removeEventListener('mouseup', this._mouseUp);
        window.removeEventListener('resize', this._resize);
        if (this._ptrDown) {
          this.wrapEl.removeEventListener('pointerdown', this._ptrDown);
          this.wrapEl.removeEventListener('pointermove', this._ptrMove);
          this.wrapEl.removeEventListener('pointerup', this._ptrUp);
          this.wrapEl.removeEventListener('pointercancel', this._ptrUp);
          this._ptrDown = null;
        }
        this._touchStart = null;
      }
    }

    /**
     * Verifica se o overlay atual tem ao menos UMA zona de toque utilizável.
     * Se não tiver, o loadRetroArchOverlay retornará null (fallback p/ controle padrão).
     */
    hasUsableZones() {
      const ov = this.overlays[this.activeOverlayId];
      if (!ov) return false;
      return ov.descs.some(d => d.x >= 0 && d.y >= 0);
    }

    renderOverlay(overlayId) {
      const ov = this.overlays[overlayId];
      if (!ov) return;
      this.activeOverlayId = overlayId;

      this.wrapEl.innerHTML = '';
      const W = window.innerWidth;
      const H = window.innerHeight;

      // O container principal ocupa a tela inteira (100vw x 100vh) desde o topo (0,0)
      Object.assign(this.wrapEl.style, {
        width: '100%',
        height: '100%',
        position: 'fixed',
        top: '0',
        left: '0',
        zIndex: '5000',
        pointerEvents: 'auto',
        display: 'block',
        touchAction: 'none', // garante o canal pointer em shells sem TouchEvent
      });

      // 1) Imagem base de fundo (ex: snes_phone_portrait_purple.png ou n64_phone_portrait_green.png)
      // Com object-fit: fill na tela inteira, a imagem cobre perfeitamente a largura horizontal, sem cortar o MENU, SELECT e START em baixo!
      if (ov.overlayImage) {
        const img = document.createElement('img');
        img.className = 'rv-ra-overlay-img';
        img.src = this.basePath + ov.overlayImage;
        img.draggable = false;
        Object.assign(img.style, {
          width: '100%',
          height: '100%',
          objectFit: 'fill',
          position: 'absolute',
          top: '0',
          left: '0',
          pointerEvents: 'none',
          zIndex: '1',
        });
        img.onerror = () => {
          img.style.display = 'none';
        };
        this.wrapEl.appendChild(img);
      }

      // 2) Imagens individuais por botão/desc (ex: a-n64-grey.png, d-pad white.png, thumbstick.png)
      for (const desc of ov.descs) {
        if (desc.overlayImg) {
          const btnImg = document.createElement('img');
          btnImg.className = 'rv-ra-desc-img';
          btnImg.src = this.basePath + desc.overlayImg;
          btnImg.draggable = false;
          const leftPct = (desc.x - desc.rx) * 100;
          const topPct = (desc.y - desc.ry) * 100;
          const widthPct = desc.rx * 2 * 100;
          const heightPct = desc.ry * 2 * 100;

          Object.assign(btnImg.style, {
            position: 'absolute',
            left: leftPct + '%',
            top: topPct + '%',
            width: widthPct + '%',
            height: heightPct + '%',
            objectFit: 'contain',
            pointerEvents: 'none',
            zIndex: '2',
          });
          btnImg.onerror = () => {
            btnImg.style.display = 'none';
          };
          this.wrapEl.appendChild(btnImg);
          desc.imgEl = btnImg;
        }
      }

      // Modo debug visual (?debug=1 na URL)
      if (this.debug) {
        this.renderDebugZones(ov);
      }
    }

    renderDebugZones(ov) {
      const debugContainer = document.createElement('div');
      debugContainer.className = 'rv-ra-debug-container';
      Object.assign(debugContainer.style, {
        position: 'absolute',
        inset: '0',
        pointerEvents: 'none',
        zIndex: 9999,
      });

      for (const desc of ov.descs) {
        if (desc.x < 0 || desc.y < 0) continue;
        const box = document.createElement('div');
        const leftPct = (desc.x - desc.rx) * 100;
        const topPct = (desc.y - desc.ry) * 100;
        const widthPct = desc.rx * 2 * 100;
        const heightPct = desc.ry * 2 * 100;

        Object.assign(box.style, {
          position: 'absolute',
          left: leftPct + '%',
          top: topPct + '%',
          width: widthPct + '%',
          height: heightPct + '%',
          border: '1.5px dashed rgba(0, 255, 65, 0.85)',
          background: 'rgba(0, 255, 65, 0.15)',
          color: '#00ff41',
          fontSize: '9px',
          fontFamily: 'monospace',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          overflow: 'hidden',
          textShadow: '0 0 2px #000',
        });
        box.innerText = desc.button;
        debugContainer.appendChild(box);
      }
      this.wrapEl.appendChild(debugContainer);
    }

    /**
     * Converte coordenada do toque (px) para (nX, nY) normalizado entre 0.0 e 1.0 na tela inteira
     */
    getNormalizedCoords(clientX, clientY) {
      const rect = this.wrapEl.getBoundingClientRect();
      const nX = (clientX - rect.left) / rect.width;
      const nY = (clientY - rect.top) / rect.height;
      return { nX: Math.max(0, Math.min(1, nX)), nY: Math.max(0, Math.min(1, nY)) };
    }

    findHitDescs(nX, nY) {
      const ov = this.overlays[this.activeOverlayId];
      if (!ov) return [];

      const hits = [];
      const HS = this.HIT_SCALE || 1.4;
      for (const desc of ov.descs) {
        if (desc.x < 0 || desc.y < 0) continue;

        let isHit = false;
        const dx = Math.abs(nX - desc.x);
        const dy = Math.abs(nY - desc.y);
        // Hitbox INFLADA: zona de toque maior que o visual (melhor acerto no celular)
        const rx = desc.rx * HS;
        const ry = desc.ry * HS;

        if (desc.type === 'radial') {
          const dist = (dx * dx) / (rx * rx) + (dy * dy) / (ry * ry);
          if (dist <= 1.0) isHit = true;
        } else {
          if (dx <= rx && dy <= ry) isHit = true;
        }

        if (isHit) {
          hits.push(desc);
        }
      }
      return hits;
    }

    /**
     * Apenas movimento físico do analógico arrastável (ZERO efeito verde ou brilhos desnecessários)
     */
    setDescHighlight(desc, active, moveX = 0, moveY = 0) {
      if (!desc) return;
      if ((desc.button === 'analog_left' || desc.button === 'analog_right' || desc.button === 'dpad_area') && desc.imgEl) {
        if (active) {
          desc.imgEl.style.transform = `translate(${moveX}px, ${moveY}px)`;
        } else {
          desc.imgEl.style.transform = 'translate(0px, 0px)';
        }
      }
    }

    processDescTouch(desc, nX, nY) {
      const actions = [];

      if (desc.button === 'overlay_next') {
        let target = desc.nextTarget || null;
        if ((!target || !this.overlays[target]) && Array.isArray(this.overlayOrder) && this.overlayOrder.length > 1) {
          // RetroArch: overlay_next sem next_target avança para o PRÓXIMO
          // overlay declarado no CFG (e o último cicla de volta ao primeiro).
          const cur = this.overlayOrder.indexOf(desc.overlayKey);
          if (cur !== -1) target = this.overlayOrder[(cur + 1) % this.overlayOrder.length];
        }
        if (target && this.overlays[target]) {
          // Overlays de pausa se comportam como o botão MENU do RetroVault Web:
          // toque rápido = cheats / segurar = barra de sistema.
          if (this.isPauseOverlay(this.overlays[target])) {
            return [{ type: 'system_menu', action: 'open_cheats', desc }];
          }
          return [{ type: 'system', action: 'overlay_change', target, desc }];
        }
        return [];
      }

      // Alguns CFGs do RetroArch chamam este botão de menu_toggle.
      // No RetroVault Web: toque rápido abre os cheats (execução deferida ao
      // touchend); SEGURAR abre a mini-barra com as ações de sistema.
      const systemButton = String(desc.button || '').toLowerCase();
      if (['menu_toggle', 'menu', 'retroarch_menu', 'menu_bar_button'].includes(systemButton)) {
        return [{ type: 'system_menu', action: 'open_cheats', desc }];
      }

      if (['save_state', 'load_state', 'reset', 'toggle_fast_forward', 'close_content'].includes(systemButton)) {
        return [{ type: 'system', action: systemButton, desc }];
      }

      // Ações de SEGURAR (estilo RetroArch hold-to-*): ativas enquanto o dedo
      // estiver no botão, desativam ao soltar. Antes caíam no fallback de input
      // (toUpperCase → código inexistente) e os botões eram completamente mortos.
      if (systemButton === 'hold_fast_forward') {
        return [{ type: 'system_hold', action: 'fast_forward', desc }];
      }
      if (systemButton === 'rewind') {
        return [{ type: 'system_hold', action: 'rewind', desc }];
      }

      // D-Pad Direcional com 8 direções e diagonais
      if (desc.button === 'dpad_area') {
        const dx = nX - desc.x;
        const dy = nY - desc.y;
        const angle = Math.atan2(dy, dx) * (180 / Math.PI);
        const dist = Math.hypot(dx / desc.rx, dy / desc.ry);

        if (dist > 0.15) {
          if (angle > -157.5 && angle <= -22.5 && dy < 0) {
            if (angle > -112.5 && angle <= -67.5) actions.push('UP');
            else if (angle > -157.5 && angle <= -112.5) actions.push('UP', 'LEFT');
            else if (angle > -67.5 && angle <= -22.5) actions.push('UP', 'RIGHT');
          }
          if (angle > 22.5 && angle <= 157.5 && dy > 0) {
            if (angle > 67.5 && angle <= 112.5) actions.push('DOWN');
            else if (angle > 112.5 && angle <= 157.5) actions.push('DOWN', 'LEFT');
            else if (angle > 22.5 && angle <= 67.5) actions.push('DOWN', 'RIGHT');
          }
          if (Math.abs(angle) > 135) actions.push('LEFT');
          if (Math.abs(angle) < 45) actions.push('RIGHT');
        }
        return actions.map(a => ({ type: 'button', input: a, desc }));
      }

      // N64 C-Buttons (abxy_area -> RSTICK no EJS_INPUT)
      if (desc.button === 'abxy_area') {
        const dx = nX - desc.x;
        const dy = nY - desc.y;
        if (Math.abs(dx) > Math.abs(dy)) {
          if (dx < 0) actions.push(desc.left || 'r_x_minus');
          else actions.push(desc.right || 'r_x_plus');
        } else {
          if (dy < 0) actions.push(desc.up || 'r_y_plus');
          else actions.push(desc.down || 'r_y_minus');
        }
        return actions.map(a => {
          const ejsBtn = RA_TO_EJS[a];
          return ejsBtn ? { type: 'button', input: ejsBtn, desc } : null;
        }).filter(Boolean);
      }

      // Analógico (esquerdo/direito) — analógico ANALÓGICO de verdade
      // (retorna tipo 'analog'; o controle de posição contínua é feito nas
      //  handlers via moveAnalog/sendAnalog, com "seguir o dedo" e intensidade)
      if (desc.button === 'analog_left' || desc.button === 'analog_right') {
        return [{ type: 'analog', axis: desc.button === 'analog_right' ? 'RSTICK' : 'LSTICK', desc }];
      }

      if (desc.button.includes('|')) {
        const subBtns = desc.button.split('|');
        for (const sb of subBtns) {
          const ejsBtn = RA_TO_EJS[sb] || sb.toUpperCase();
          actions.push({ type: 'button', input: ejsBtn, desc });
        }
        return actions;
      }

      const ejsBtn = RA_TO_EJS[desc.button] || desc.button.toUpperCase();
      if (ejsBtn) {
        actions.push({ type: 'button', input: ejsBtn, desc });
      }
      return actions;
    }

    triggerSystemAction(action, target) {
      if (action === 'overlay_change' && target) {
        const targetOverlay = this.overlays[target];
        if (this.isPauseOverlay(targetOverlay)) {
          if (typeof window.openRvCheats === 'function') {
            window.openRvCheats();
          }
          return;
        }
        this.renderOverlay(target);
        return;
      }

      if (action === 'open_cheats') {
        if (typeof window.openRvCheats === 'function') {
          window.openRvCheats();
        } else {
          // Fallback caso o parser seja usado fora do play.html.
          const emulator = window.EJS_emulator;
          if (emulator?.cheatMenu) emulator.cheatMenu.style.display = '';
        }
        return;
      }

      try {
        const gm = window.EJS_emulator?.gameManager || window.EJS_emulator;
        if (!gm) return;
        // Salvar/carregar passa antes pelo sistema de saves do RetroVault Web
        // (play.html): é o MESMO slot mostrado na barra de sistema, com data
        // e tamanho — o botão do overlay e a barra nunca divergem.
        // Fallback: quickSave/quickLoad do EJS (gm.saveState não existe na
        // runtime atual — por isso save_state era no-op silencioso).
        if (action === 'save_state') {
          if (typeof window.rvSaveNow === 'function') { window.rvSaveNow(); return; }
          const fn = gm.quickSave || gm.saveState; if (fn) fn.call(gm);
        }
        else if (action === 'load_state') {
          if (typeof window.rvLoadNow === 'function') { window.rvLoadNow(); return; }
          const fn = gm.quickLoad || gm.loadState; if (fn) fn.call(gm);
        }
        else if (action === 'reset' && gm.restart) gm.restart();
        else if (action === 'toggle_fast_forward' && gm.toggleFastForward) {
          // toggle requer 1/0 explícito: sem argumento o cwrap recebia undefined
          // (→ 0) e o botão nunca ativava o fast-forward. Sincronizamos a flag
          // isFastForward do emulador para o próximo toque inverter corretamente.
          const em = window.EJS_emulator;
          const isOn = em && em.isFastForward;
          gm.toggleFastForward(isOn ? 0 : 1);
          if (em) em.isFastForward = !isOn;
        }
        else if (action === 'close_content') {
          window.location.href = 'index.html';
        }
      } catch(e) {}
    }

    /**
     * Ações de SEGURAR: liga ao pressionar, desliga ao soltar/sair do botão.
     */
    triggerSystemHoldAction(action, pressed) {
      try {
        const gm = window.EJS_emulator?.gameManager;
        if (!gm) return;
        if (action === 'fast_forward' && gm.toggleFastForward) gm.toggleFastForward(pressed ? 1 : 0);
        else if (action === 'rewind' && gm.toggleRewind) gm.toggleRewind(pressed ? 1 : 0);
      } catch (e) {}
    }

    /**
     * Sincroniza as ações de segurar deste toque com os descs atualmente
     * atingidos: liga o que entrou, desliga o que saiu (move/end inclusos).
     */
    syncHoldActions(touchId, items) {
      const desired = new Set((items || []).filter(it => it && it.type === 'system_hold').map(it => it.action));
      const current = this.activeHolds.get(touchId) || new Set();
      current.forEach(a => { if (!desired.has(a)) this.triggerSystemHoldAction(a, false); });
      desired.forEach(a => { if (!current.has(a)) this.triggerSystemHoldAction(a, true); });
      if (desired.size) this.activeHolds.set(touchId, desired);
      else this.activeHolds.delete(touchId);
    }

    releaseHoldActions(touchId) {
      const current = this.activeHolds.get(touchId);
      if (current) current.forEach(a => this.triggerSystemHoldAction(a, false));
      this.activeHolds.delete(touchId);
    }

    /**
     * MENU com detecção de long-press: a ação de cheats só dispara no touchend
     * (tap rápido). Segurar MENU_LONG_PRESS_MS abre a mini-barra de sistema.
     */
    startMenuPress(touchId, hasMenuDesc) {
      this.cancelMenuPress(touchId);
      if (!hasMenuDesc) return;
      const pending = {
        firedLong: false,
        timer: setTimeout(() => {
          pending.firedLong = true;
          this.vibrate();
          if (typeof window.openRvSystemBar === 'function') window.openRvSystemBar();
          else if (typeof window.openRvCheats === 'function') window.openRvCheats();
          this.menuPresses.delete(touchId);
        }, 500)
      };
      this.menuPresses.set(touchId, pending);
    }

    updateMenuPress(touchId, stillOnMenu) {
      // Dedo saiu do botão antes do long-press: cancela (nem cheats nem barra).
      if (this.menuPresses.has(touchId) && !stillOnMenu) this.cancelMenuPress(touchId);
    }

    endMenuPress(touchId) {
      const pending = this.menuPresses.get(touchId);
      if (!pending) return;
      this.menuPresses.delete(touchId);
      if (!pending.firedLong) {
        clearTimeout(pending.timer);
        if (typeof window.openRvCheats === 'function') window.openRvCheats();
      }
    }

    cancelMenuPress(touchId) {
      const pending = this.menuPresses.get(touchId);
      if (pending) clearTimeout(pending.timer);
      this.menuPresses.delete(touchId);
    }

    /**
     * Mapeamento direto de cliques e toques para o emulador EmulatorJS
     */
    simulateInput(inputCode, pressed) {
      const code = typeof inputCode === 'number'
        ? inputCode
        : ((typeof window.EJS_INPUT !== 'undefined' && window.EJS_INPUT[inputCode] !== undefined)
          ? window.EJS_INPUT[inputCode]
          : EJS_INPUT_CODES[inputCode]);
      if (this.debug) console.log(`[RA] simulateInput ${inputCode} -> code=${code} pressed=${pressed ? 1 : 0} | EJS pronto: ${!!(window.EJS_emulator?.gameManager)}`);
      if (code === undefined) return;
      // IMPORTANTE (fix UP/DOWN do NES): o EmulatorJS espera 32767 como valor
      // "pressionado" para os inputs DIRECIONAIS (UP/DOWN/LEFT/RIGHT = códigos
      // 4-7) — é o que o controle virtual padrão envia. Enviar 1 fazia LEFT/RIGHT
      // funcionarem em alguns cores, mas UP/DOWN (eixos verticais) ficarem mortos
      // no fceumm/nestopia. Botões (A/B/START/SELECT) seguem com valor 1.
      const val = pressed ? (code >= 4 && code <= 7 ? 32767 : 1) : 0;
      // HUD de diagnóstico (?paddebug=1): play.html exibe cada input na tela.
      if (typeof window.__rvPadHUD === 'function') { try { window.__rvPadHUD(inputCode, pressed); } catch (hudErr) { } }
      try {
        if (window.EJS_emulator && window.EJS_emulator.gameManager) {
          window.EJS_emulator.gameManager.simulateInput(0, code, val);
        } else if (window.EJS_emulator && typeof window.EJS_emulator.simulateInput === 'function') {
          window.EJS_emulator.simulateInput(0, code, val);
        }
      } catch(e) {}
    }

    updatePressedButtons() {
      const nextPressed = new Set();

      for (const actions of this.activeTouches.values()) {
        for (const act of actions) {
          if (act.type === 'button') {
            nextPressed.add(act.input);
          }
        }
      }

      for (const btn of this.activeButtons) {
        if (!nextPressed.has(btn)) {
          this.simulateInput(btn, false);
          this.activeButtons.delete(btn);
        }
      }

      for (const btn of nextPressed) {
        if (!this.activeButtons.has(btn)) {
          this.simulateInput(btn, true);
          this.activeButtons.add(btn);
        }
      }
    }

    /** Envia valor cru (não 0/1) para o emulador — usado p/ analógico contínuo */
    sendRawInput(code, val) {
      try {
        // Os analógicos são contínuos: também notificam o HUD de diagnóstico.
      if (typeof window.__rvPadHUD === 'function') { try { window.__rvPadHUD(code, val !== 0); } catch (hudErr) { } }
      if (window.EJS_emulator?.gameManager) window.EJS_emulator.gameManager.simulateInput(0, code, val);
        else if (window.EJS_emulator && typeof window.EJS_emulator.simulateInput === 'function')
          window.EJS_emulator.simulateInput(0, code, val);
      } catch (e) {}
    }

    /** Envia o analógico contínuo em -1..1 para os eixos LSTICK/RSTICK */
    sendAnalog(axis, nx, ny) {
      const AV = this.AV;
      const isR = axis === 'RSTICK';
      const R = isR ? EJS_INPUT_CODES.RSTICK_RIGHT : EJS_INPUT_CODES.LSTICK_RIGHT;
      const L = isR ? EJS_INPUT_CODES.RSTICK_LEFT  : EJS_INPUT_CODES.LSTICK_LEFT;
      const D = isR ? EJS_INPUT_CODES.RSTICK_DOWN  : EJS_INPUT_CODES.LSTICK_DOWN;
      const U = isR ? EJS_INPUT_CODES.RSTICK_UP    : EJS_INPUT_CODES.LSTICK_UP;
      this.sendRawInput(R, nx > 0 ? Math.round(nx * AV) : 0);
      this.sendRawInput(L, nx < 0 ? Math.round(-nx * AV) : 0);
      this.sendRawInput(D, ny > 0 ? Math.round(ny * AV) : 0);
      this.sendRawInput(U, ny < 0 ? Math.round(-ny * AV) : 0);
    }

    /** Feedback háptico (vibração) no toque — só em dispositivos que suportam.
     *  Obs.: iPhone/iPad (Safari) não suporta navigator.vibrate (limitação Apple). */
    vibrate(ms = 20) {
      try {
        if (navigator.vibrate) {
          navigator.vibrate(ms);
          // tenta padrão curto-duplo para dar "tique" mais perceptível em alguns Androids
          if (window.navigator.vibratePattern) window.navigator.vibratePattern(ms);
        }
      } catch (e) {}
    }

    /** Inicia o analógico num toque — fixa a origem no ponto do toque (seguir o dedo) */
    startAnalog(touchId, desc, nX, nY) {
      const axis = desc.button === 'analog_right' ? 'RSTICK' : 'LSTICK';
      this.analogBase.set(touchId, { axis, desc, originX: nX, originY: nY });
      this.activeAnalog.set(touchId, { axis, nx: 0, ny: 0 });
      this.moveAnalog(touchId, nX, nY);
    }

    /** Move o analógico: calcula deslocamento contínuo, com rebase (seguir o dedo) */
    moveAnalog(touchId, nX, nY) {
      const base = this.analogBase.get(touchId);
      if (!base) return;
      let dx = nX - base.originX;
      let dy = nY - base.originY;
      const rx = base.desc.rx || 0.15;
      const ry = base.desc.ry || 0.15;
      // clamp ao círculo do analógico (elipse)
      const mag = Math.hypot(dx / rx, dy / ry);
      if (mag > 1) {
        dx = dx / mag;
        dy = dy / mag;
        // rebase: recentraliza a origem para o dedo "arrastar" o stick
        base.originX = nX - dx;
        base.originY = nY - dy;
      }
      const nx = dx / rx;
      const ny = dy / ry;
      this.activeAnalog.set(touchId, { axis: base.axis, nx, ny });
      // feedback visual (move o desenho do stick)
      const maxMovePx = 30;
      this.setDescHighlight(base.desc, true, nx * maxMovePx, ny * maxMovePx);
      this.sendAnalog(base.axis, nx, ny);
    }

    /** Inicia o visual do D-PAD (joystick) — o stick se move com o dedo */
    startDpadVisual(touchId, desc, nX, nY) {
      if (!desc || !desc.imgEl) return;
      this.dpadVisual.set(touchId, { desc, originX: nX, originY: nY });
      this.moveDpadVisual(touchId, nX, nY);
    }

    /** Move o visual do D-PAD (joystick) seguindo o dedo, clampado ao raio */
    moveDpadVisual(touchId, nX, nY) {
      const v = this.dpadVisual.get(touchId);
      if (!v) return;
      let dx = nX - v.originX;
      let dy = nY - v.originY;
      const rx = v.desc.rx || 0.15;
      const ry = v.desc.ry || 0.15;
      const mag = Math.hypot(dx / rx, dy / ry);
      if (mag > 1) { dx /= mag; dy /= mag; }
      const nx = dx / rx;
      const ny = dy / ry;
      const maxMovePx = 30;
      this.setDescHighlight(v.desc, true, nx * maxMovePx, ny * maxMovePx);
    }

    /** Libera o visual do D-PAD (volta ao centro) */
    releaseDpadVisual(touchId) {
      const v = this.dpadVisual.get(touchId);
      if (v) this.setDescHighlight(v.desc, false);
      this.dpadVisual.delete(touchId);
    }

    /** Libera o analógico (volta ao centro e zera os eixos) */
    releaseAnalog(touchId) {
      const st = this.activeAnalog.get(touchId);
      const base = this.analogBase.get(touchId);
      if (st) this.sendAnalog(st.axis, 0, 0);
      if (base) this.setDescHighlight(base.desc, false);
      this.activeAnalog.delete(touchId);
      this.analogBase.delete(touchId);
    }

    onTouchStart(e) {
      e.preventDefault();
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        const { nX, nY } = this.getNormalizedCoords(touch.clientX, touch.clientY);
        const hitDescs = this.findHitDescs(nX, nY);

        // No DS, uma área sem botão representa a tela inferior/stylus.
        if (window.__RV_IS_NDS && hitDescs.length === 0
            && typeof window.RV_NDS_STYLUS === 'function'
            && window.RV_NDS_STYLUS('start', touch)) {
          this.activeStylus.add(touch.identifier);
          continue;
        }

        const actions = [];

        // DIAGNÓSTICO: mostra o toque e quantas zonas bateram
        if (this.debug) {
          console.log(`[RA] touchstart (${nX.toFixed(3)},${nY.toFixed(3)})`,
            `| zonas batidas: ${hitDescs.length}`, hitDescs.map(d=>d.button));
        }

        const holdItems = [];
        let menuFound = false;
        for (const desc of hitDescs) {
          // stick animado: inicia o visual do joystick no toque
          if (desc.button === 'dpad_area' && desc.imgEl && !this.dpadVisual.has(touch.identifier)) {
            this.startDpadVisual(touch.identifier, desc, nX, nY);
          }
          const res = this.processDescTouch(desc, nX, nY);
          for (const item of res) {
            if (item.type === 'system') {
              this.triggerSystemAction(item.action, item.target);
            } else if (item.type === 'analog') {
              this.startAnalog(touch.identifier, item.desc, nX, nY);
              this.vibrate();
            } else if (item.type === 'system_hold') {
              holdItems.push(item);
            } else if (item.type === 'system_menu') {
              menuFound = true;
            } else {
              actions.push(item);
            }
          }
        }
        this.syncHoldActions(touch.identifier, holdItems);
        this.startMenuPress(touch.identifier, menuFound);
        if (actions.length) this.vibrate();
        this.activeTouches.set(touch.identifier, actions);
      }
      this.updatePressedButtons();
    }

    onTouchMove(e) {
      e.preventDefault();
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        const { nX, nY } = this.getNormalizedCoords(touch.clientX, touch.clientY);

        // Mantém o stylus mesmo quando o dedo sai da área inicial da tela.
        if (this.activeStylus.has(touch.identifier)) {
          if (typeof window.RV_NDS_STYLUS === 'function') window.RV_NDS_STYLUS('move', touch);
          continue;
        }

        // Se este toque já é um analógico, move o stick (seguir o dedo) e para aqui
        if (this.analogBase.has(touch.identifier)) {
          this.moveAnalog(touch.identifier, nX, nY);
          continue;
        }

        // stick animado do D-PAD: move o visual junto com o dedo
        if (this.dpadVisual.has(touch.identifier)) {
          this.moveDpadVisual(touch.identifier, nX, nY);
        }

        const hitDescs = this.findHitDescs(nX, nY);
        const actions = [];
        const holdItems = [];
        let menuFound = false;

        for (const desc of hitDescs) {
          const res = this.processDescTouch(desc, nX, nY);
          for (const item of res) {
            if (item.type === 'analog') {
              this.startAnalog(touch.identifier, item.desc, nX, nY);
            } else if (item.type === 'system_hold') {
              holdItems.push(item);
            } else if (item.type === 'system_menu') {
              menuFound = true;
            } else if (item.type === 'button') {
              actions.push(item);
            }
          }
        }
        this.syncHoldActions(touch.identifier, holdItems);
        this.updateMenuPress(touch.identifier, menuFound);
        this.activeTouches.set(touch.identifier, actions);
      }
      this.updatePressedButtons();
    }

    onTouchEnd(e) {
      e.preventDefault();
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        if (this.activeStylus.has(touch.identifier)) {
          if (typeof window.RV_NDS_STYLUS === 'function') window.RV_NDS_STYLUS('end', touch);
          this.activeStylus.delete(touch.identifier);
          continue;
        }
        // libera analógico e o stick do D-PAD deste toque (reseta visual)
        this.releaseAnalog(touch.identifier);
        this.releaseDpadVisual(touch.identifier);
        this.releaseHoldActions(touch.identifier);
        this.endMenuPress(touch.identifier);
        const descActs = this.activeTouches.get(touch.identifier) || [];
        for (const act of descActs) {
          if (act.desc && (act.desc.button === 'analog_left' || act.desc.button === 'analog_right')) {
            this.setDescHighlight(act.desc, false);
          }
        }
        this.activeTouches.delete(touch.identifier);
      }
      // Trava de segurança: se NENHUM dedo resta na tela mas algum estado
      // ficou preso (touchend perdido por gesto do sistema, PiP, chamada,
      // identifier divergente em shells incomuns), varre TUDO e solta
      // todos os botões — senão um único evento perdido deixaria um botão
      // "grudado" para sempre (mata o controle até recarregar a página).
      if (e.touches && e.touches.length === 0) {
        if (this.activeTouches.size || this.analogBase.size || this.activeHolds.size || this.activeStylus.size || this.menuPresses.size) {
          this.activeTouches.clear();
          for (const id of [...this.analogBase.keys()]) this.releaseAnalog(id);
          for (const id of [...this.dpadVisual.keys()]) this.releaseDpadVisual(id);
          for (const id of [...this.activeHolds.keys()]) this.releaseHoldActions(id);
          this.activeStylus.clear();
          this.menuPresses.forEach(p => { try { clearTimeout(p.timer); } catch (_) { } });
          this.menuPresses.clear();
        }
      }
      this.updatePressedButtons();
    }

    onMouseDown(e) {
      const { nX, nY } = this.getNormalizedCoords(e.clientX, e.clientY);
      const hitDescs = this.findHitDescs(nX, nY);
      if (window.__RV_IS_NDS && hitDescs.length === 0
          && typeof window.RV_NDS_STYLUS === 'function'
          && window.RV_NDS_STYLUS('start', e)) {
        this.activeStylus.add('mouse');
        return;
      }
      const actions = [];
      const holdItems = [];
      let menuFound = false;
      for (const desc of hitDescs) {
        const res = this.processDescTouch(desc, nX, nY);
        for (const item of res) {
          if (item.type === 'system') this.triggerSystemAction(item.action, item.target);
          else if (item.type === 'analog') this.startAnalog('mouse', item.desc, nX, nY);
          else if (item.type === 'system_hold') holdItems.push(item);
          else if (item.type === 'system_menu') menuFound = true;
          else actions.push(item);
        }
      }
      this.syncHoldActions('mouse', holdItems);
      this.startMenuPress('mouse', menuFound);
      if (actions.length) this.vibrate();
      this.activeTouches.set('mouse', actions);
      this.updatePressedButtons();
    }

    onMouseMove(e) {
      if (this.activeStylus.has('mouse')) {
        if (typeof window.RV_NDS_STYLUS === 'function') window.RV_NDS_STYLUS('move', e);
        return;
      }
      if (this.analogBase.has('mouse')) {
        const { nX, nY } = this.getNormalizedCoords(e.clientX, e.clientY);
        this.moveAnalog('mouse', nX, nY);
        return;
      }
      if (!this.activeTouches.has('mouse')) return;
      const { nX, nY } = this.getNormalizedCoords(e.clientX, e.clientY);
      const hitDescs = this.findHitDescs(nX, nY);
      const actions = [];
      const holdItems = [];
      let menuFound = false;
      for (const desc of hitDescs) {
        const res = this.processDescTouch(desc, nX, nY);
        for (const item of res) {
          if (item.type === 'analog') this.startAnalog('mouse', item.desc, nX, nY);
          else if (item.type === 'system_hold') holdItems.push(item);
          else if (item.type === 'system_menu') menuFound = true;
          else if (item.type === 'button') actions.push(item);
        }
      }
      this.syncHoldActions('mouse', holdItems);
      this.updateMenuPress('mouse', menuFound);
      this.activeTouches.set('mouse', actions);
      this.updatePressedButtons();
    }

    onMouseUp(e) {
      if (this.activeStylus.has('mouse')) {
        if (typeof window.RV_NDS_STYLUS === 'function') window.RV_NDS_STYLUS('end', e);
        this.activeStylus.delete('mouse');
        return;
      }
      this.releaseAnalog('mouse');
      this.releaseHoldActions('mouse');
      this.endMenuPress('mouse');
      const descActs = this.activeTouches.get('mouse') || [];
      for (const act of descActs) {
        if (act.desc && (act.desc.button === 'analog_left' || act.desc.button === 'analog_right')) {
          this.setDescHighlight(act.desc, false);
        }
      }
      this.activeTouches.delete('mouse');
      this.updatePressedButtons();
    }
  }

  global.RetroArchOverlayEngine = RetroArchOverlayEngine;

  global.loadRetroArchOverlay = async function(core, wrapEl, options = {}) {
    // Tabela de perfis com pastas e arquivos candidatos em ordem de preferência
    // Dá prioridade para DualShock no PSX, Saturn (6 botões + analógico) no Arcade e reconhece variações do PocketArch
    const coreProfiles = {
      'snes': { folders: ['snes', 'SNES'], files: ['snes.cfg'] },
      'nes': { folders: ['nes', 'NES'], files: ['nes.cfg'] },
      'gba': { folders: ['gba', 'GBA'], files: ['gba.cfg', 'gba_phone_portrait_red.cfg', 'gba_phone_yellow_animated.cfg'] },
      'gbc': {
        folders: ['gbc', 'GBC', 'GAMEGEAR', 'GameGear', 'gamegear', 'GB', 'gb', 'GBA', 'gba', 'Universal', 'universal'],
        files: ['gbc.cfg', 'gbc_phone_animated_blue.cfg', 'gg.cfg', 'gamegear.cfg', 'GameGear.cfg', 'gbc_phone_portrait.cfg', 'gb.cfg', 'gb_phone_portrait.cfg', 'gba.cfg', 'gba_phone_portrait.cfg', 'Universal.cfg', 'universal.cfg', 'overlay.cfg', 'config.cfg']
      },
      'gb': {
        folders: ['gbc', 'GBC', 'gb', 'GB'],
        files: ['gbc.cfg', 'gb.cfg', 'gb_phone_portrait.cfg', 'overlay.cfg', 'config.cfg']
      },
      'n64': { folders: ['n64', 'N64'], files: ['n64.cfg'] },
      'pcsx_rearmed': {
        folders: ['psx', 'PSX', 'PS1', 'ps1'],
        files: ['psx.cfg', 'psx_phone_transparent.cfg']
      },
      'ps1': { folders: ['psx', 'PSX', 'PS1', 'ps1'], files: ['psx.cfg', 'psx_phone_transparent.cfg'] },
      'segaMS': {
        folders: ['mastersystem', 'segaMS', 'SegaMS', 'SMS', 'sms'],
        files: ['mastersystem.cfg', 'segaMS.cfg', 'sms.cfg', 'SMS.cfg', 'overlay.cfg', 'config.cfg']
      },
      'atari2600': {
        folders: ['atari2600', 'Atari2600', 'ATARI2600'],
        files: ['atari2600.cfg', 'overlay.cfg', 'config.cfg']
      },
      'segaMD': { folders: ['segaMD'], files: ['segaMD.cfg'] },
      'segaCD': {
        folders: ['segaCD', 'segacd', 'SegaCD', 'Genesis', 'genesis'],
        files: ['segacd.cfg', 'segaCD.cfg', 'genesis_phone_portrait.cfg', 'genesis.cfg', 'Genesis.cfg', 'overlay.cfg', 'config.cfg']
      },
      'segaGG': {
        folders: ['GAMEGEAR', 'GameGear', 'gamegear', 'gg', 'GG', 'segaGG', 'SEGGG', 'gbc', 'GBC'],
        files: ['gg.cfg', 'gamegear.cfg', 'GameGear.cfg', 'gbc_phone_portrait.cfg', 'gbc.cfg', 'gb_phone_portrait.cfg', 'gb.cfg', 'gba_phone_portrait.cfg', 'gba.cfg', 'Universal.cfg', 'universal.cfg', 'overlay.cfg', 'config.cfg']
      },
      'nds': {
        folders: ['nds', 'NDS', 'ds', 'DS'],
        files: ['nds.cfg', 'nds_phone_white.cfg', 'nds_phone_white_animated.cfg', 'nds_phone_portrait.cfg', 'ds_phone_portrait.cfg', 'NDS.cfg', 'DS.cfg', 'ds.cfg', 'overlay.cfg', 'config.cfg']
      },
      // Arcade: o arcade.cfg real vem primeiro (é o comportamento ao vivo hoje);
      // Saturn (6 botões) permanece como fallback — a pasta é "SATURN", em
      // maiúsculas, e por isso nunca era encontrada pelas variantes em minúsculas.
      'fbneo': {
        folders: ['arcade', 'Arcade', 'SATURN', 'Saturn', 'saturn', 'Universal', 'universal'],
        files: ['arcade.cfg', 'saturn.cfg', 'Saturn.cfg', 'saturn_phone_portrait.cfg', 'Universal.cfg', 'universal.cfg', 'overlay.cfg', 'config.cfg']
      },
      'arcade': {
        folders: ['arcade', 'Arcade', 'SATURN', 'Saturn', 'saturn', 'Universal', 'universal'],
        files: ['arcade.cfg', 'saturn.cfg', 'Saturn.cfg', 'saturn_phone_portrait.cfg', 'Universal.cfg', 'universal.cfg', 'overlay.cfg', 'config.cfg']
      }
      // Perfil 'psp' removido: o projeto não tem catálogo, ROMs nem núcleo PSP.
    };

    const profile = coreProfiles[core];
    const folders = profile ? profile.folders : [core, core.toLowerCase(), core.toUpperCase()];
    const files = profile ? profile.files : [`${core}.cfg`, `${core.toLowerCase()}.cfg`, `${core.toUpperCase()}.cfg`, 'overlay.cfg', 'config.cfg'];
    const candidateUrls = [];

    for (const f of folders) {
      for (const file of files) {
        candidateUrls.push({ url: `overlays/${f}/${file}`, base: `overlays/${f}/` });
      }
    }

    for (const cand of candidateUrls) {
      try {
        const resp = await fetch(cand.url);
        if (resp.ok) {
          const cfgText = await resp.text();
          console.log(`[RetroArchOverlay] Sucesso ao carregar ${cand.url} (Compatível com PocketArch)`);
          const engine = new RetroArchOverlayEngine(wrapEl, cfgText, cand.base, options);
          // Segurança: se o CFG carregou mas NÃO tem zona de toque utilizável,
          // devolve null p/ o site cair no controle padrão (em vez de "engolir" o toque).
          if (!engine.hasUsableZones()) {
            console.warn(`[RetroArchOverlay] ${cand.url} não tem zonas de toque utilizáveis. Fallback p/ controle padrão.`);
            return null;
          }
          return engine;
        }
      } catch (err) {}
    }

    console.warn(`[RetroArchOverlay] Arquivo CFG não encontrado para o core "${core}". Fallback para SKINS[core].`);
    return null;
  };

})(window);

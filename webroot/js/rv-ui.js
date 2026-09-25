/* ═══════════════════════════════════════════════════════════
   RETROVAULT WEB 2.0 — MICRO-INTERAÇÕES (rv-ui.js)
   Camada puramente visual: não altera dados nem navegação.
   Tudo aqui é defensivo (se o elemento não existe, ignora) e
   respeita prefers-reduced-motion.
   ═══════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var calm = false;
  try { calm = matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}

  function onReady(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }

  onReady(function () {

    /* ── 1. Navbar: sombra ao rolar ── */
    var nav = document.querySelector('.navbar');
    if (nav) {
      var onScroll = function () { nav.classList.toggle('scrolled', window.scrollY > 12); };
      addEventListener('scroll', onScroll, { passive: true });
      onScroll();
    }

    /* ── 1b. Scroll-spy dos links âncora (Consoles / Gamepass) ──
       Clicar marca na hora e "vence" por 1,2s (a rolagem suave não pode
       reverter a escolha); o hash da URL também manda — cliques no rodapé
       e chegadas de outras páginas acertam a seleção. Navbar e rodapé
       acendem juntos (no celular só o rodapé existe — ele mostra tudo). */
    (function scrollSpy() {
      var links = Array.prototype.slice.call(document.querySelectorAll(
        '.nav-link[data-spy], .footer-links a[data-spy]'
      ));
      if (!links.length) return;
      /* Sem as seções na página (games/perfil), nem liga: links valem nativos. */
      var seenIds = {};
      var sections = links
        .map(function (a) { return a.getAttribute('data-spy'); })
        .filter(function (id) { return id !== 'top' && !seenIds[id]; })
        .map(function (id) { seenIds[id] = 1; return document.getElementById(id); })
        .filter(Boolean);
      if (!sections.length) return;
      var lastClick = 0;
      function setActive(id, force) {
        if (!force && Date.now() - lastClick < 1200) return;
        links.forEach(function (a) {
          a.classList.toggle('active', a.getAttribute('data-spy') === id);
        });
      }
      links.forEach(function (a) {
        a.addEventListener('click', function () {
          lastClick = Date.now();
          setActive(a.getAttribute('data-spy'), true);
        });
      });
      function idFromHash() {
        var h = (location.hash || '').replace(/^#/, '');
        if (!h) return 'top';
        for (var i = 0; i < links.length; i++) {
          if (links[i].getAttribute('data-spy') === h) return h;
        }
        return null;
      }
      /* Recarregar no topo com hash velho (#consoles) não pode acender a
         seção: no topo, manda o Início; se um salto p/ hash vier a seguir,
         o observer corrige sozinho. */
      var initial = (window.scrollY || 0) < 180 ? 'top' : idFromHash();
      if (initial) setActive(initial, true);
      window.addEventListener('hashchange', function () {
        var id = idFromHash();
        if (id) { lastClick = Date.now(); setActive(id, true); }
      });
      if (!('IntersectionObserver' in window)) return;
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) setActive(en.target.id);
        });
      }, { rootMargin: '-25% 0px -60% 0px' });
      sections.forEach(function (s) { io.observe(s); });
      /* Volta ao topo: só age na TRAVESSIA de 180px descendo (chegar no topo
         rolando) — nunca num load parado no topo (não mata salto p/ #hash). */
      var lastY = window.scrollY || 0;
      addEventListener('scroll', function () {
        var y = window.scrollY || 0;
        var crossedTop = lastY >= 180 && y < 180;
        lastY = y;
        if (!crossedTop || Date.now() - lastClick <= 1200) return;
        if (location.hash) {
          try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {}
        }
        setActive('top');
      }, { passive: true });
    })();

    /* ── 2. Reveal on scroll ──
       Adiciona .reveal automaticamente nas seções/cards principais
       (com atraso em cascata dentro de cada grade). */
    function armReveals() {
      var groups = document.querySelectorAll(
        '.category-section, .user-section, .hero-stats, .marquee, .profile-wrap > *, .card, .stats-grid'
      );
      groups.forEach(function (el) {
        if (!el.classList.contains('no-reveal')) el.classList.add('reveal');
      });
      document.querySelectorAll('.grid-container').forEach(function (grid) {
        Array.prototype.forEach.call(grid.children, function (child, i) {
          child.classList.add('reveal');
          child.style.setProperty('--d', Math.min(i * 0.05, 0.4) + 's');
        });
      });

      /* Grids renderizados depois (games.html) — observa e arma ao chegar. */
      if ('MutationObserver' in window) {
        var obs = new MutationObserver(function () {
          document.querySelectorAll('.grid-container').forEach(function (grid) {
            Array.prototype.forEach.call(grid.children, function (child, i) {
              if (!child.classList.contains('reveal')) {
                child.classList.add('reveal');
                child.style.setProperty('--d', Math.min(i * 0.03, 0.3) + 's');
                io.observe(child);
              }
            });
          });
        });
        obs.observe(document.body, { childList: true, subtree: true });
      }

      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
        });
      }, { threshold: 0.08, rootMargin: '0px 0px -4% 0px' });

      document.querySelectorAll('.reveal').forEach(function (el) { io.observe(el); });
    }
    if (!calm && 'IntersectionObserver' in window) armReveals();
    else document.querySelectorAll('.reveal').forEach(function (el) { el.classList.add('in'); });

    /* ── 3. Spotlight nos cards de console (segue o mouse) ── */
    if (!calm && matchMedia('(pointer: fine)').matches) {
      document.addEventListener('pointermove', function (e) {
        var card = e.target.closest && e.target.closest('.console-card');
        if (!card) return;
        var r = card.getBoundingClientRect();
        card.style.setProperty('--mx', ((e.clientX - r.left) / r.width * 100).toFixed(1) + '%');
        card.style.setProperty('--my', ((e.clientY - r.top) / r.height * 100).toFixed(1) + '%');
      }, { passive: true });
    }

    /* ── 4. Atalho "/" foca a busca ── */
    addEventListener('keydown', function (e) {
      if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) return;
      var tag = (document.activeElement && document.activeElement.tagName) || '';
      if (/INPUT|TEXTAREA|SELECT/.test(tag)) return;
      var input = document.getElementById('global-search') || document.getElementById('game-search');
      if (input) { e.preventDefault(); input.focus(); }
    });

    /* ── 5. Setas nas fileiras horizontais (desktop, só com overflow) ── */
    var navUpdaters = [];
    document.querySelectorAll('.user-section').forEach(function (sec) {
      var row = sec.querySelector('.user-games-row');
      var header = sec.querySelector('.user-section-header');
      if (!row || !header || header.querySelector('.row-nav')) return;
      var tools = header.querySelector('.user-section-tools');
      if (!tools) {
        tools = document.createElement('div');
        tools.className = 'user-section-tools';
        var clear = header.querySelector('.user-section-clear');
        if (clear) header.appendChild(tools), tools.appendChild(clear);
        else header.appendChild(tools);
      }
      function btn(dir, label) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'row-nav';
        b.setAttribute('aria-label', label);
        b.innerHTML = dir < 0 ? '‹' : '›';
        b.addEventListener('click', function () {
          row.scrollBy({ left: dir * Math.max(row.clientWidth * 0.8, 320), behavior: calm ? 'auto' : 'smooth' });
        });
        return b;
      }
      var bL = btn(-1, 'Rolar para a esquerda');
      var bR = btn(1, 'Rolar para a direita');
      tools.insertBefore(bL, tools.firstChild);
      tools.insertBefore(bR, tools.children[1] || null);
      function updateNav() {
        var show = row.scrollWidth > row.clientWidth + 1 ? '' : 'none';
        bL.style.display = show;
        bR.style.display = show;
      }
      navUpdaters.push(updateNav);
      if ('MutationObserver' in window) {
        new MutationObserver(updateNav).observe(row, { childList: true });
        new MutationObserver(updateNav).observe(sec, { attributes: true, attributeFilter: ['style'] });
      }
      updateNav();
    });
    var navT = null;
    addEventListener('resize', function () {
      clearTimeout(navT);
      navT = setTimeout(function () { navUpdaters.forEach(function (u) { u(); }); }, 150);
    }, { passive: true });

    /* ── 6. Bottom nav: marca a página ativa ── */
    try {
      /* Firebase Hosting (cleanUrls) serve /games e /profile sem ".html" —
         normalizamos os dois lados para a marcação funcionar nos dois casos. */
      var here = (location.pathname.split('/').pop() || 'index.html').toLowerCase().replace(/\.html?$/, '');
      document.querySelectorAll('.bottom-nav .bn-item[data-page]').forEach(function (a) {
        var pages = (a.getAttribute('data-page') || '').split(' ').map(function (p) {
          return p.toLowerCase().replace(/\.html?$/, '');
        });
        if (pages.indexOf(here) >= 0) a.classList.add('active');
      });
      /* Barra mobile = abas: o toque escolhe o ativo; rolar não muda nada. */
      document.querySelectorAll('.bottom-nav .bn-item[href^="#"]').forEach(function (a) {
        a.addEventListener('click', function () {
          document.querySelectorAll('.bottom-nav .bn-item.active').forEach(function (x) { x.classList.remove('active'); });
          a.classList.add('active');
        });
      });
      var searchBtn = document.querySelector('.bottom-nav .bn-item[data-action="search"]');
      if (searchBtn) searchBtn.addEventListener('click', function () {
        var input = document.getElementById('global-search') || document.getElementById('game-search');
        if (input) {
          input.scrollIntoView({ behavior: calm ? 'auto' : 'smooth', block: 'center' });
          setTimeout(function () { input.focus({ preventScroll: true }); }, calm ? 0 : 450);
        } else { location.href = 'index.html'; }
      });
    } catch (e) {}

    /* ── 7. Contadores do hero animados ── */
    if (!calm) {
      ['hero-consoles', 'hero-games'].forEach(function (id) {
        var el = document.getElementById(id);
        if (!el) return;
        var target = parseInt(el.textContent, 10);
        if (!isFinite(target) || target <= 0) {
          /* O valor chega via renderHeroStats() — observa a primeira mudança. */
          var obs = new MutationObserver(function () {
            var t = parseInt(el.textContent, 10);
            if (isFinite(t) && t > 0) { obs.disconnect(); countUp(el, t); }
          });
          obs.observe(el, { childList: true, characterData: true, subtree: true });
          setTimeout(function () { obs.disconnect(); }, 4000);
          return;
        }
        countUp(el, target);
      });
      function countUp(el, target) {
        var start = null, dur = 900;
        el.textContent = '0';
        function tick(now) {
          if (!start) start = now;
          var p = Math.min((now - start) / dur, 1);
          var eased = 1 - Math.pow(1 - p, 3);
          el.textContent = String(Math.round(target * eased));
          if (p < 1) requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);
      }
    }

    /* ── 8. Tilt 3D sutil no emblema do hero (mouse) ── */
    if (!calm && matchMedia('(pointer: fine)').matches) {
      var emblem = document.querySelector('.hero-emblem');
      var visual = document.querySelector('.hero-visual');
      if (emblem && visual) {
        visual.addEventListener('pointermove', function (e) {
          var r = visual.getBoundingClientRect();
          var x = (e.clientX - r.left) / r.width - 0.5;
          var y = (e.clientY - r.top) / r.height - 0.5;
          emblem.style.transform = 'rotateY(' + (x * 18).toFixed(1) + 'deg) rotateX(' + (-y * 18).toFixed(1) + 'deg)';
        });
        visual.addEventListener('pointerleave', function () { emblem.style.transform = ''; });
      }
    }

  });
})();

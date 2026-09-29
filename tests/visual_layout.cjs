// Com o servidor de simulação em :8080: node tests/visual_layout.cjs
const assert = require('node:assert/strict');
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  try {
    for (const viewport of [{ width: 800, height: 480 }, { width: 480, height: 320 }]) {
      const context = await browser.newContext({ viewport, serviceWorkers: 'block' });
      await context.addInitScript(() => {
        localStorage.setItem('rvos:setup:done', 'true');
        localStorage.setItem('rvos:favs', JSON.stringify(['snes:Aladdin (USA).sfc']));
      });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, route => route.abort());
      await page.route('**/roms/**', route => route.fulfill({ status: 404, body: '' }));
      await page.goto(process.env.RVOS_URL || 'http://127.0.0.1:8080/');
      await page.locator('#app:not([hidden]) .sys-grid').waitFor();
      assert(await page.locator('#boot, .tpad, .tp').count() === 0, 'controles virtuais ou splash web presentes');
      await page.waitForTimeout(220); // espera a transição do foco terminar
      const homeFocus = await page.locator('.sys-card.focused').evaluate(el => {
        const r = el.getBoundingClientRect();
        return { left: r.left, right: r.right, width: innerWidth, shadow: getComputedStyle(el).boxShadow };
      });
      assert(homeFocus.left >= 11 && homeFocus.right <= homeFocus.width - 11,
        'halo do card em foco deve ter margem nas bordas da tela');
      assert(!homeFocus.shadow.includes('44px'), 'glow antigo muito forte no card');
      await page.locator('.sys-card[data-sys="snes"]').click();
      if (viewport.height <= 380) {
        const top = await page.evaluate(() => {
          const r = document.querySelector('.console-hero').getBoundingClientRect();
          const bar = document.querySelector('#statusbar').getBoundingClientRect();
          return { heroTop: r.top, barBottom: bar.bottom };
        });
        assert(top.heroTop >= top.barBottom, 'nome do console escondido na abertura da biblioteca');
        assert(await page.locator('.library-filter.focused').count() === 1, 'filtros devem iniciar focados em 480×320');
      }
      await page.keyboard.press('Escape');
      await page.locator('.sys-card[data-sys="@fav"]').click();
      const fav = await page.evaluate(() => {
        const bounds = sel => { const r = document.querySelector(sel).getBoundingClientRect(); return { left: r.left, top: r.top, right: r.right, bottom: r.bottom }; };
        return { hero: bounds('.console-hero'), bar: bounds('#statusbar'), chip: bounds('.game-card .chip'), badge: bounds('.game-card .rom-badge'), heart: bounds('.game-card .fav'), count: document.querySelector('.library-count').textContent };
      });
      assert(fav.hero.top >= fav.bar.bottom, 'favoritos abriu com título escondido');
      const overlap = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
      assert(!overlap(fav.chip, fav.badge) && !overlap(fav.badge, fav.heart), 'marcas de favoritos sobrepostas');
      assert(fav.count.includes('1 jogo exibido'), 'contagem singular incorreta');
      await page.keyboard.press('Escape');
      await page.locator('[data-sys="@settings"]').click();
      await page.locator('[data-set="about"]').click();
      await page.locator('#aboutBody .about-logo img').evaluate(el => el.decode().catch(() => {}));
      const before = await page.locator('#aboutBody').evaluate(el => el.scrollTop);
      for (let i = 0; i < 5; i++) await page.keyboard.press('ArrowDown');
      const about = await page.locator('#aboutBody').evaluate(el => ({
        scrollTop: el.scrollTop,
        lastBottom: el.querySelector('.a-row:last-child').getBoundingClientRect().bottom,
        viewBottom: el.getBoundingClientRect().bottom
      }));
      assert(about.scrollTop > before, 'ficha Sobre não pode ser rolada por controle');
      assert(about.lastBottom <= about.viewBottom + 1, 'última linha de Sobre inacessível');
      await page.keyboard.press('Escape');
      await page.locator('[data-set="wifi"]').click();
      await page.locator('.net-item').first().waitFor();
      await page.locator('.net-item[data-ssid="VIZINHO_5G"]').click();
      const keyBottom = await page.locator('.kbd-row.actions .key[data-act="ok"]').evaluate(el => el.getBoundingClientRect().bottom);
      assert(keyBottom <= viewport.height, 'teclado não mostra Conectar');
      await page.keyboard.press('Escape'); // senha → Wi-Fi
      await page.keyboard.press('Escape'); // Wi-Fi → Ajustes
      await page.locator('[data-set="bluetooth"]').click();
      await page.locator('.bt-device').first().waitFor({ timeout: 6000 });
      assert(await page.locator('.bt-device .rv-icon').count() > 0, 'dispositivos Bluetooth sem SVG');
      assert((await page.locator('#hints [data-h="x"]').textContent()).includes('Esquecer'), 'dica X do Bluetooth ausente');
      const bluetoothBounds = await page.locator('.bt-device').first().evaluate(el => ({
        left: el.getBoundingClientRect().left, right: el.getBoundingClientRect().right, width: innerWidth
      }));
      assert(bluetoothBounds.left >= 0 && bluetoothBounds.right <= bluetoothBounds.width, 'lista Bluetooth excede a tela');
      assert(errors.length === 0, errors.join('; '));
      await context.close();

      // Assistente inicial: todas as etapas sem título/botão encoberto.
      const wizardContext = await browser.newContext({ viewport, serviceWorkers: 'block' });
      const wizardPage = await wizardContext.newPage();
      await wizardPage.goto(process.env.RVOS_URL || 'http://127.0.0.1:8080/');
      await wizardPage.locator('.wizard').waitFor();
      for (const step of ['boas-vindas', 'rede', 'botões', 'nome', 'concluído']) {
        await wizardPage.waitForTimeout(180); // CSS do foco estável antes da medição
        const bounds = await wizardPage.evaluate(() => {
          const screen = document.querySelector('#screen').getBoundingClientRect();
          const nodes = document.querySelectorAll('.wizard > *');
          const btn = document.querySelector('.wizard .wiz-btn.focused');
          const focus = btn && btn.getBoundingClientRect();
          return { top: screen.top, bottom: screen.bottom,
            first: nodes[0].getBoundingClientRect().top,
            last: nodes[nodes.length - 1].getBoundingClientRect().bottom,
            btns: Array.from(document.querySelectorAll('.wiz-btn')).map(el => el.getBoundingClientRect().bottom),
            focus: focus && { left: focus.left, right: focus.right } };
        });
        assert(bounds.first >= bounds.top - 1, `${step}: título acima da viewport (${viewport.width})`);
        assert(bounds.last <= bounds.bottom + 1, `${step}: dica cortada (${viewport.width})`);
        assert(bounds.btns.every(bottom => bottom <= bounds.bottom + 1), `${step}: botão cortado (${viewport.width})`);
        if (bounds.focus) assert(bounds.focus.left >= 11 && bounds.focus.right <= viewport.width - 11,
          `${step}: glow do botão encostando na borda (${viewport.width})`);
        if (step === 'concluído') break;
        await wizardPage.locator('.wiz-btn[data-act="go"]').click();
        if (step === 'boas-vindas') await wizardPage.locator('.wiz-list .spinner').waitFor({ state: 'hidden' });
      }
      await wizardContext.close();
      console.log(`${viewport.width}×${viewport.height}: biblioteca, favoritos, Sobre, Wi-Fi e 5 etapas do assistente OK`);
    }
  } finally { await browser.close(); }
})().catch(err => { console.error(err); process.exitCode = 1; });

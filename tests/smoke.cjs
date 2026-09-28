// npm install --no-save playwright && node tests/smoke.cjs
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
(async () => {
  const url = process.env.RVOS_URL || 'http://127.0.0.1:8080/';
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  try {
    for (const viewport of [{ width: 800, height: 480 }, { width: 480, height: 320 }]) {
      const context = await browser.newContext({ viewport });
      await context.addInitScript(() => localStorage.setItem('rvos:setup:done', 'true'));
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      // Sem distribuir ROM: HEAD fictício comprova detecção sem baixar jogo.
      await page.route('**/roms/snes/Aladdin*', route => route.fulfill({ status: 200, body: '' }));
      await page.goto(url);
      await page.locator('#boot.done').waitFor({ timeout: 15000 });
      assert(await page.locator('.sys-card').count() > 5, 'catálogo ausente');
      const systemArt = page.locator('[data-sys="@settings"] .sys-art img');
      assert(await systemArt.count() === 1, 'Sistema deve usar a arte PNG indicada');
      assert(await systemArt.evaluate(el => el.complete && el.naturalWidth > 0), 'arte do Sistema não carregou');
      assert(await systemArt.evaluate(el => el.getBoundingClientRect().width) >= 58, 'arte do Sistema pequena');
      assert(await page.locator('#sbSim').isVisible(), 'preview deve usar simulação');
      await page.keyboard.press('Enter'); // console em foco
      await page.locator('#gameGrid .game-card').first().waitFor();
      assert(await page.locator('.library-filter').count() === 5);
      await page.locator('.library-filter[data-filter="local"]').click();
      assert(await page.locator('.library-filter.active').textContent() === 'No cartão');
      await page.locator('#gameGrid .game-card').first().waitFor({ timeout: 5000 });
      assert((await page.locator('.rom-badge').first().textContent()).includes('NO CARTÃO'));
      await page.locator('.library-filter[data-filter="all"]').click();
      await page.locator('.library-search').click();
      await page.locator('#overlay .key[data-key="m"]').click();
      const keyOk = page.locator('#overlay .key[data-act="ok"]');
      assert(await keyOk.evaluate(el => el.getBoundingClientRect().bottom <= innerHeight), 'tecla de confirmação fora da tela');
      await keyOk.click();
      assert((await page.locator('.library-search').textContent()).includes('m'));
      await page.keyboard.press('Escape'); // voltar à home
      await page.locator('.sys-grid').waitFor();
      await page.locator('[data-sys="@settings"]').click();
      assert(await page.locator('.set-item .rv-icon').count() >= 7, 'Ajustes sem ícones padronizados');
      await page.locator('[data-set="effects"]').click();
      assert(await page.locator('html').getAttribute('data-effects') === 'off');
      await page.keyboard.press('ArrowDown'); // navegação por controle no menu de ajustes
      await page.keyboard.press('Escape');
      if (errors.length) throw new Error(`${viewport.width}x${viewport.height}: ${errors.join('; ')}`);
      const dims = await page.evaluate(() => ({
        width: document.documentElement.clientWidth, bodyWidth: document.body.scrollWidth,
        text: getComputedStyle(document.querySelector('.sys-card .sys-name')).fontSize
      }));
      assert(dims.bodyWidth <= dims.width + 1, 'overflow horizontal');
      console.log(`${viewport.width}x${viewport.height}: OK; ${dims.text} no card; sem erros JS`);
      await context.close();
    }
    // Primeiro boot nunca deve travar se a bridge não estiver disponível.
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(url);
    await page.locator('.wizard').waitFor({ timeout: 15000 });
    await page.keyboard.press('Escape');
    await page.locator('.sys-grid').waitFor();
    console.log('Assistente inicial: OK');
    await context.close();
    const gameCtx = await browser.newContext();
    const gamePage = await gameCtx.newPage();
    await gamePage.route(/retroverse-roms\.mdsoltec\.workers\.dev/, route => route.abort());
    await gamePage.route(/cdn\.emulatorjs\.org/, route => route.abort());
    await gamePage.goto(url + 'player.html?core=snes&game=snes%2FSuper%20Mario%20World%20(USA).sfc&os=1', { waitUntil: 'domcontentloaded' });
    assert(!gamePage.url().includes('login.html'), 'player OS não pode exigir login');
    await gamePage.evaluate(() => {
      window.__testPad = { connected: true, id: 'Controle teste', mapping: 'standard', axes: [0, 0],
        buttons: Array.from({ length: 17 }, () => ({ pressed: false })) };
      Object.defineProperty(navigator, 'getGamepads', { configurable: true, value: () => [window.__testPad] });
      window.__testPad.buttons[8].pressed = window.__testPad.buttons[9].pressed = true;
    });
    await gamePage.locator('#rv-os-menu button').first().waitFor({ timeout: 5000 });
    assert(await gamePage.locator('#rv-os-menu button .rv-icon').count() === 5, 'Menu do jogo sem SVGs');
    await gamePage.evaluate(() => { window.__testPad.buttons[8].pressed = window.__testPad.buttons[9].pressed = false; });
    await gamePage.locator('#rv-os-menu button').first().waitFor();
    await gamePage.keyboard.press('ArrowDown');
    assert((await gamePage.locator('#rv-os-menu button.selected').textContent()).includes('Salvar'));
    await gamePage.keyboard.press('Escape');
    assert(await gamePage.locator('#rv-os-menu').count() === 0);
    await gamePage.evaluate(() => {
      window.EJS_emulator = { started: true, paused: false,
        gameManager: { toggleMainLoop() {}, getState: () => new Uint8Array([1,2,3,4]), loadState() {} } };
      window.RVOSMenu.open();
    });
    await gamePage.locator('#rv-os-menu [data-action="save"]').click();
    await gamePage.locator('#rv-os-menu .message').filter({ hasText: 'Estado salvo' }).waitFor({ timeout: 6000 });
    await gamePage.locator('#rv-os-menu [data-action="load"]').click();
    await gamePage.locator('#rv-os-menu .message').filter({ hasText: 'Save carregado' }).waitFor({ timeout: 6000 });
    console.log('Player sem login, combo e save/load simulados: OK');
    await gameCtx.close();
  } finally { await browser.close(); }
})().catch(err => { console.error(err); process.exitCode = 1; });

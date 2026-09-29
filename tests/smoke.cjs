// npm install --no-save playwright && node tests/smoke.cjs
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
(async () => {
  const url = process.env.RVOS_URL || 'http://127.0.0.1:8080/';
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  try {
    for (const viewport of [{ width: 800, height: 480 }, { width: 480, height: 320 }]) {
      const context = await browser.newContext({ viewport });
      await context.addInitScript(() => {
        localStorage.setItem('rvos:setup:done', 'true');
        localStorage.setItem('rvos:effects', 'on'); // preferência antiga não pode restaurar o efeito
      });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      // Sem distribuir ROM: HEAD fictício comprova detecção sem baixar jogo.
      await page.route('**/roms/snes/Aladdin*', route => route.fulfill({ status: 200, body: '' }));
      await page.goto(url);
      await page.locator('#app:not([hidden]) .sys-grid').waitFor({ timeout: 15000 });
      assert(await page.locator('#boot, .tpad, .tp').count() === 0, 'boot web ou controle virtual ainda visível');
      assert(await page.locator('.crt-scanlines, .crt-vignette, .crt-overlay').count() === 0, 'camada CRT ainda existe');
      assert(await page.locator('html').getAttribute('data-effects') === null, 'preferência antiga restaurou o CRT');
      assert(await page.locator('body').evaluate(el => getComputedStyle(el, '::before').content === 'none'), 'grade que simula linhas ainda visível');
      assert(await page.locator('.sys-card').count() > 5, 'catálogo ausente');
      const systemArt = page.locator('[data-sys="@settings"] .sys-art img');
      assert(await systemArt.count() === 1, 'Sistema deve usar a arte PNG indicada');
      await systemArt.evaluate(el => el.decode().catch(() => {}));
      assert(await systemArt.evaluate(el => el.complete && el.naturalWidth > 0), 'arte do Sistema não carregou');
      assert(await systemArt.evaluate(el => el.getBoundingClientRect().width) >= 58, 'arte do Sistema pequena');
      assert(await page.locator('#sbSim').isVisible(), 'preview deve usar simulação');
      await page.keyboard.press('Enter'); // console em foco
      await page.locator('#gameGrid .game-card').first().waitFor();
      assert(await page.locator('.library-tools .library-filter').count() === 5);
      assert(await page.locator('.library-refine .library-filter').count() === 3, 'filtros de status, gênero e jogadores ausentes');
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
      assert(await page.locator('[data-set="effects"]').count() === 0, 'opção CRT ainda disponível');
      await page.waitForFunction(() => document.querySelector('[data-set="brightness"] .num')?.textContent === '85%');
      await page.locator('[data-set="brightness"]').click();
      await page.keyboard.press('ArrowRight');
      assert((await page.locator('[data-set="brightness"] .num').textContent()) === '90%', 'ajuste de brilho da simulação falhou');
      await page.keyboard.press('ArrowDown'); // navegação por controle no menu de ajustes
      await page.locator('[data-set="wifi"]').click();
      await page.locator('.net-item[data-ssid="VIZINHO_5G"]').click();
      await page.locator('#overlay .key[data-act="shift"]').click();
      assert(await page.locator('#overlay .key[data-key="/"]').count() === 1, 'símbolos de senha Wi-Fi indisponíveis no teclado');
      await page.locator('#overlay .key[data-key="/"]').click();
      assert((await page.locator('.kbd-display').textContent()).includes('•'), 'senha deve aparecer mascarada');
      await page.keyboard.press('Escape'); // apaga caractere
      await page.keyboard.press('Escape'); // fecha teclado
      await page.keyboard.press('Escape'); // volta a Ajustes
      await page.locator('[data-set="bluetooth"]').click();
      const controller = page.locator('.bt-device[data-address="02:11:22:33:44:55"]');
      await controller.waitFor({ timeout: 6000 });
      await controller.click(); // parear + conectar na simulação
      await page.locator('.bt-device[data-address="02:11:22:33:44:55"].connected').waitFor({ timeout: 6000 });
      await page.locator('.bt-device[data-address="02:11:22:33:44:55"]').click(); // desconectar
      await page.locator('.bt-device[data-address="02:11:22:33:44:55"]:not(.connected)').waitFor({ timeout: 6000 });
      await page.keyboard.press('Escape'); // voltar a Ajustes
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
    // Mesmo com touchscreen simulado, não se desenha gamepad de teste.
    const touchContext = await browser.newContext({ viewport: { width: 480, height: 320 }, hasTouch: true, isMobile: true });
    await touchContext.addInitScript(() => localStorage.setItem('rvos:setup:done', 'true'));
    const touchPage = await touchContext.newPage();
    await touchPage.goto(url);
    await touchPage.locator('#app:not([hidden]) .sys-grid').waitFor({ timeout: 15000 });
    assert(await touchPage.locator('.tpad, .tp, #boot').count() === 0, 'controle virtual apareceu em touchscreen');
    await touchContext.close();
    // Primeiro uso continua acessível sem a tela de boot web.
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(url);
    await page.locator('.wizard').waitFor({ timeout: 15000 });
    assert(await page.locator('#boot').count() === 0 && await page.locator('#app').isVisible(), 'assistente deve abrir direto');
    await page.keyboard.press('Escape');
    await page.locator('.sys-grid').waitFor();
    console.log('Assistente inicial: OK');
    await context.close();
    const gameCtx = await browser.newContext();
    await gameCtx.addInitScript(() => localStorage.setItem('rv_emu_settings_v1', JSON.stringify({ bezel:'crt', shader:'crt-geom' })));
    const gamePage = await gameCtx.newPage();
    await gamePage.route(/retroverse-roms\.mdsoltec\.workers\.dev/, route => route.abort());
    await gamePage.route(/cdn\.emulatorjs\.org/, route => route.abort());
    await gamePage.goto(url + 'player.html?core=snes&game=snes%2FSuper%20Mario%20World%20(USA).sfc&os=1', { waitUntil: 'domcontentloaded' });
    assert(!gamePage.url().includes('login.html'), 'player OS não pode exigir login');
    assert(await gamePage.locator('body.rv-bezel-crt').count() === 0, 'moldura CRT antiga reaplicada');
    assert(await gamePage.evaluate(() => !/crt|scan.?line/i.test(EJS_defaultOptions.shader || '')), 'shader CRT antigo reaplicado');
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
    // A shell e o player OS não podem recriar controles virtuais quando o
    // gamepad desconecta, mesmo em touchscreen com preferência antiga pad=on.
    const mobileGameCtx = await browser.newContext({ viewport: { width: 480, height: 320 }, hasTouch: true, isMobile: true, serviceWorkers: 'block' });
    await mobileGameCtx.addInitScript(() => localStorage.setItem('rv_pad_mode', '"on"'));
    const mobileGame = await mobileGameCtx.newPage();
    await mobileGame.route(/retroverse-roms\.mdsoltec\.workers\.dev|cdn\.emulatorjs\.org/, route => route.abort());
    await mobileGame.goto(url + 'player.html?core=snes&game=snes%2FSuper%20Mario%20World%20(USA).sfc&os=1&pad=on', { waitUntil: 'domcontentloaded' });
    await mobileGame.waitForFunction(() => !!window.RVInput && !!document.body.classList.contains('rv-os-player'));
    assert(await mobileGame.evaluate(() => !RVInput.shouldShowVirtualPad()), 'player OS não pode oferecer controle virtual');
    assert(await mobileGame.locator('#rv-pad').evaluate(el => getComputedStyle(el).display === 'none'), 'pad virtual visível no player OS');
    await mobileGameCtx.close();
  } finally { await browser.close(); }
})().catch(err => { console.error(err); process.exitCode = 1; });

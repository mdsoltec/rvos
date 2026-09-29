// Quatro temas: prévia, cancelar/aplicar, persistência e player sem colorir o jogo.
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const url = process.env.RVOS_URL || 'http://127.0.0.1:8080/';
(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  try {
    for (const viewport of [{ width: 800, height: 480 }, { width: 480, height: 320 }]) {
      const context = await browser.newContext({ viewport, serviceWorkers: 'block' });
      await context.addInitScript(() => localStorage.setItem('rvos:setup:done', 'true'));
      const page = await context.newPage();
      const errors = []; page.on('pageerror', e => errors.push(e.message));
      await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, route => route.abort());
      await page.route('**/roms/**', route => route.fulfill({ status: 404, body: '' }));
      await page.goto(url);
      await page.locator('.sys-grid').waitFor();
      assert(await page.evaluate(() => document.documentElement.dataset.rvTheme) === 'vault');
      await page.locator('[data-sys="@settings"]').click();
      for (let n = 0; n < 3; n++) await page.keyboard.press('ArrowDown');
      assert(await page.locator('.set-item.focused[data-set="appearance"]').count() === 1, 'Aparência inacessível pelo controle');
      await page.keyboard.press('Enter');
      assert(await page.locator('.theme-card').count() === 4);
      assert(await page.locator('.theme-preview').count() === 4);
      assert(await page.locator('.theme-card.applied[data-theme="vault"]').count() === 1);
      await page.keyboard.press('ArrowRight'); // seleciona/visualiza Órbita sem gravar
      assert(await page.locator('.theme-card.focused[data-theme="orbit"]').count() === 1);
      assert(await page.evaluate(() => document.documentElement.dataset.rvTheme) === 'orbit');
      assert(await page.evaluate(() => localStorage.getItem('rvos:theme')) === null);
      await page.keyboard.press('Escape');
      assert(await page.evaluate(() => document.documentElement.dataset.rvTheme) === 'vault', 'B não cancelou a prévia');
      assert(await page.locator('[data-set="appearance"].focused').count() === 1, 'B não restaurou o foco nos Ajustes');
      await page.keyboard.press('Enter');
      await page.keyboard.press('ArrowRight'); await page.keyboard.press('Enter');
      assert(await page.evaluate(() => localStorage.getItem('rvos:theme')) === 'orbit');
      await page.keyboard.press('ArrowDown');
      assert(await page.evaluate(() => document.documentElement.dataset.rvTheme) === 'polar');
      await page.keyboard.press('Escape');
      assert(await page.evaluate(() => document.documentElement.dataset.rvTheme) === 'orbit', 'B após aplicar não restaurou o tema salvo');
      await page.keyboard.press('Escape');
      assert(await page.locator('.sys-grid').count() === 1);
      assert(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--green').trim()) === '#bc88ff');
      // A seleção por clique também deve funcionar na prévia sem controle.
      const themes = { sunset: '#ffc36c', polar: '#1164ac', vault: '#00ff41' };
      for (const [id, color] of Object.entries(themes)) {
        await page.locator('[data-sys="@settings"]').click();
        await page.locator('[data-set="appearance"]').click();
        await page.locator(`.theme-card[data-theme="${id}"]`).click();
        assert(await page.evaluate(() => localStorage.getItem('rvos:theme')) === id);
        assert((await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--green').trim())) === color);
        const layout = await page.locator('.theme-card.focused').evaluate(el => {
          const r = el.getBoundingClientRect(); const grid = document.querySelector('.theme-grid').getBoundingClientRect();
          return { top:r.top, bottom:r.bottom, viewTop:grid.top, viewBottom:document.querySelector('#hints').getBoundingClientRect().top, right:r.right, width:innerWidth };
        });
        assert(layout.top >= layout.viewTop - 1 && layout.bottom < layout.viewBottom && layout.right <= layout.width,
          `${id} cortado em ${viewport.width}×${viewport.height}`);
        await page.keyboard.press('Escape'); await page.keyboard.press('Escape');
      }
      await page.locator('[data-sys="@settings"]').click();
      await page.locator('[data-set="appearance"]').click();
      await page.locator('.theme-card[data-theme="polar"]').click();
      await page.keyboard.press('Escape'); await page.keyboard.press('Escape');
      await page.reload(); await page.locator('.sys-grid').waitFor();
      assert(await page.evaluate(() => document.documentElement.dataset.rvTheme) === 'polar', 'tema não persistiu após recarga');
      const contrast = await page.evaluate(() => ({
        text: getComputedStyle(document.documentElement).getPropertyValue('--text').trim(),
        bg: getComputedStyle(document.documentElement).getPropertyValue('--bg').trim(),
        settings: getComputedStyle(document.querySelector('.sys-card[data-sys="@settings"]')).color,
        card: getComputedStyle(document.querySelector('.sys-card[data-sys="snes"]')).color
      }));
      assert.equal(contrast.text, '#172c40'); assert.equal(contrast.bg, '#eaf2f9');
      assert(contrast.card === 'rgb(255, 255, 255)', 'arte do card de console precisa manter texto branco no tema claro');
      // Player OS herda o tema, preserva #game em preto e remove scanlines de carregamento.
      await page.goto(url + 'player.html?core=snes&game=snes%2FSuper%20Mario%20World%20(USA).sfc&os=1', { waitUntil: 'domcontentloaded' });
      const player = await page.evaluate(() => ({
        theme:document.documentElement.dataset.rvTheme,
        bg:getComputedStyle(document.getElementById('rv-loading')).backgroundColor,
        game:getComputedStyle(document.getElementById('game')).backgroundColor,
        crt:getComputedStyle(document.querySelector('.rv-bg'),'::after').content,
        menu:getComputedStyle(document.querySelector('.ejs_parent') || document.body).getPropertyValue('--rv-menu-bg').trim(),
      }));
      assert.equal(player.theme, 'polar');
      assert(player.bg === 'rgb(234, 242, 249)', 'player não adotou o tema claro');
      assert.equal(player.game, 'rgb(0, 0, 0)', 'tema alterou o fundo da imagem do jogo');
      assert.equal(player.crt, 'none', 'scanlines permanecem no carregamento');
      await page.waitForFunction(() => !!window.RVOSMenu);
      await page.evaluate(() => RVOSMenu.open());
      const menuColor = await page.locator('#rv-os-menu .panel').evaluate(el => getComputedStyle(el).backgroundColor);
      assert.equal(menuColor, 'rgb(255, 255, 255)', 'menu START+SELECT não adotou o tema claro');
      await page.keyboard.press('Escape');
      assert(await page.locator('#rv-os-menu').count() === 0, 'menu do jogo não fechou com B');
      await page.evaluate(() => localStorage.setItem('rvos:theme', 'vault'));
      await page.reload({ waitUntil: 'domcontentloaded' });
      assert(await page.evaluate(() => EJS_color) === '#00ff41', 'player padrão perdeu a cor do core');
      assert(errors.length === 0, errors.join('; '));
      await context.close();
      const wizardContext = await browser.newContext({ viewport, serviceWorkers: 'block' });
      await wizardContext.addInitScript(() => localStorage.setItem('rvos:theme', 'polar'));
      const wizardPage = await wizardContext.newPage();
      await wizardPage.goto(url);
      await wizardPage.locator('.wizard').waitFor();
      assert(await wizardPage.evaluate(() => document.documentElement.dataset.rvTheme) === 'polar', 'assistente não herdou o tema');
      const wizardButton = await wizardPage.locator('.wiz-btn.primary').first().evaluate(el => el.getBoundingClientRect().bottom);
      assert(wizardButton <= viewport.height, 'tema claro ocultou o botão do assistente');
      await wizardContext.close();
      console.log(`${viewport.width}×${viewport.height}: 4 temas, prévia/cancelamento, player, assistente e persistência OK`);
    }
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });

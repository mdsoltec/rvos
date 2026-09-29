// Perfil local: dados reais do namespace convidado, LCDs 800×480 e 480×320.
// npm install --no-save playwright && node tests/profile.cjs (servidor em :8080)
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
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, route => route.abort());
      await page.goto(url);
      await page.locator('.sys-grid').waitFor();
      await page.locator('[data-sys="@settings"]').click();
      assert(await page.locator('[data-set="profile"] .ic .rv-icon').count() === 1, 'Ajustes: Perfil sem SVG');
      assert((await page.locator('[data-set="profile"] .lbl').textContent()) === 'Perfil', 'item deve se chamar apenas Perfil');
      // D-pad real também alcança o item inserido, sem botão na home.
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('ArrowDown');
      assert(await page.locator('.set-item.focused[data-set="profile"]').count() === 1, 'perfil não alcançável pelas setas');
      await page.keyboard.press('Enter');
      await page.locator('.profile-panel').waitFor();
      assert((await page.locator('.profile-name').textContent()) === 'Jogador');
      assert((await page.locator('.profile-avatar img').getAttribute('src')) === 'assets/avatar-01.png', 'avatar padrão ausente');
      assert((await page.locator('.profile-time').textContent()).includes('0min'));
      assert((await page.locator('.profile-stats').textContent()).includes('0'));
      assert((await page.locator('.profile-empty').textContent()).includes('Nenhum jogo'));
      assert(await page.locator('.profile-badge').count() === 12);
      assert(await page.locator('.profile-badge.earned').count() === 0);
      assert(await page.locator('.profile-calendar i').count() === 84);
      await page.keyboard.press('ArrowRight');
      assert(await page.locator('.profile-avatar-action.focused').count() === 1, 'D-pad não alcança o seletor de avatar');
      await page.keyboard.press('Enter');
      assert(await page.locator('.avatar-option').count() === 20, '20 avatares locais devem estar disponíveis');
      assert(await page.locator('.avatar-option.selected.focused').count() === 1, 'avatar atual não ficou pré-selecionado');
      const modalBounds = await page.locator('.avatar-picker').evaluate(el => {
        const r = el.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, view: innerHeight };
      });
      assert(modalBounds.top >= 0 && modalBounds.bottom <= modalBounds.view + 1, 'seletor cortado no LCD');
      await page.keyboard.press('ArrowRight');
      assert((await page.locator('.avatar-option.focused').getAttribute('data-avatar')) === 'assets/avatar-02.png');
      await page.keyboard.press('Enter');
      assert((await page.locator('.profile-avatar img').getAttribute('src')) === 'assets/avatar-02.png');
      assert((await page.evaluate(() => localStorage.getItem('rv:convidado:rv_avatar'))) === 'assets/avatar-02.png', 'avatar não persistido no RVStore convidado');
      assert(!(await page.evaluate(() => RVProfile.saveAvatar('javascript:alert(1)'))), 'avatar não deve aceitar URL externa');
      assert((await page.evaluate(() => localStorage.getItem('rv:convidado:rv_avatar'))) === 'assets/avatar-02.png');
      await page.keyboard.press('Enter'); // reabrir na opção Avatar, não em Editar nome
      await page.keyboard.press('ArrowRight');
      await page.keyboard.press('Escape'); // cancelar não altera a seleção
      assert((await page.evaluate(() => localStorage.getItem('rv:convidado:rv_avatar'))) === 'assets/avatar-02.png');
      // Corrupção de uma chave não derruba o perfil.
      await page.evaluate(() => {
        localStorage.setItem('rv:convidado:rv_playtime', '{malformado');
        localStorage.setItem('rv:convidado:rv_activity', 'null');
      });
      await page.keyboard.press('Escape');
      await page.locator('[data-set="profile"]').click();
      assert((await page.locator('.profile-time').textContent()).includes('0min'));
      await page.evaluate(() => {
        const k = key => 'rv:convidado:' + key;
        const d = new Date();
        const today = [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-');
        const a = 'snes/Aladdin (USA).sfc', b = 'snes/Chrono Trigger (USA).sfc';
        localStorage.setItem(k('rv_player_name'), '<img src=x onerror=alert(1)>');
        localStorage.setItem(k('rv_playtime'), JSON.stringify({ [a]: 3660, [b]: 1200 }));
        localStorage.setItem(k('rv_activity'), JSON.stringify({ [today]: 3660 }));
        localStorage.setItem(k('rv_played_games'), JSON.stringify([a, b]));
        localStorage.setItem(k('rv_consoles_played'), JSON.stringify(['snes']));
        localStorage.setItem(k('rv_sessions'), '2');
        localStorage.setItem(k('rv_screenshots'), '1');
        localStorage.setItem(k('rv_favorites'), JSON.stringify([{ console: 'snes', file: 'Aladdin (USA).sfc' }]));
        localStorage.setItem(k('rv_achievements'), '{}');
      });
      await page.reload();
      await page.locator('.sys-grid').waitFor();
      await page.locator('[data-sys="@settings"]').click();
      await page.locator('[data-set="profile"]').click();
      assert((await page.locator('.profile-name').textContent()) === '<img src=x onerror=alert(1)>'.slice(0, 18));
      assert(await page.locator('.profile-identity img').count() === 0, 'nome interpretado como HTML');
      assert((await page.locator('.profile-avatar img').getAttribute('src')) === 'assets/avatar-02.png', 'avatar não persistiu após recarga');
      assert((await page.locator('.profile-time').textContent()).includes('1h 21min'));
      const stats = await page.locator('.profile-stat').allTextContents();
      assert.deepEqual(stats.map(s => s.replace(/\s+/g, '')), ['2Sessões', '2Jogos', '1Consoles', '1Favoritos']);
      assert((await page.locator('.profile-game').first().textContent()).includes('Aladdin'));
      assert(await page.locator('.profile-calendar .lv3').count() === 1);
      assert(await page.locator('.profile-badge.earned').count() === 3, 'primeira sessão, favorito e screenshot');
      assert((await page.evaluate(() => JSON.parse(localStorage.getItem('rv:convidado:rv_achievements')))).first_fav, 'conquista calculada não persistida');
      const body = page.locator('#profileBody');
      for (let i = 0; i < 28; i++) await page.keyboard.press('ArrowDown');
      const scrolled = await body.evaluate(el => ({ top: el.scrollTop, end: el.querySelector('.profile-note').getBoundingClientRect().bottom, bottom: el.getBoundingClientRect().bottom }));
      assert(scrolled.top > 0, 'D-pad não rolou o conteúdo');
      assert(scrolled.end <= scrolled.bottom + 2, 'última linha do perfil inacessível');
      // A continua focado na ação de editar mesmo após rolar; teclado físico seleciona as teclas.
      await page.keyboard.press('Enter');
      await page.locator('.kbd-grid').waitFor();
      for (const letter of 'nova') await page.locator(`.key[data-key="${letter}"]`).click();
      await page.locator('.key[data-act="ok"]').click();
      assert((await page.locator('.profile-name').textContent()) === 'nova');
      assert((await page.locator('#sbPlayer').textContent()) === 'nova');
      assert((await body.evaluate(el => el.scrollTop)) > 0, 'edição perdeu posição de leitura');
      const names = await page.evaluate(() => [localStorage.getItem('rvos:profile:name'), localStorage.getItem('rv:convidado:rv_player_name')]);
      assert.deepEqual(names, ['"nova"', 'nova'], 'apelido não salvo na shell e no player');
      await page.keyboard.press('Escape');
      assert(await page.locator('.set-item.focused').count() === 1, 'B não voltou aos Ajustes');
      await page.reload();
      await page.locator('.sys-grid').waitFor();
      await page.locator('[data-sys="@settings"]').click();
      await page.locator('[data-set="profile"]').click();
      assert((await page.locator('.profile-name').textContent()) === 'nova');
      assert((await page.locator('.profile-avatar img').getAttribute('src')) === 'assets/avatar-02.png');
      assert(await page.locator('.profile-badge.earned').count() === 3);
      assert(errors.length === 0, errors.join('; '));
      console.log(`${viewport.width}×${viewport.height}: perfil, 20 avatares, D-pad, edição, rolagem e persistência OK`);
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });

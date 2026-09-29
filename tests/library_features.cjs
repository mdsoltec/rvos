// Biblioteca: ficha, filtros e marcações por controle em LCD 800×480 / 480×320.
// Rodar com a simulação em :8080: node tests/library_features.cjs
const assert = require('node:assert/strict');
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const url = process.env.RVOS_URL || 'http://127.0.0.1:8080/';
  try {
    for (const viewport of [{ width: 800, height: 480 }, { width: 480, height: 320 }]) {
      const context = await browser.newContext({ viewport, serviceWorkers: 'block' });
      await context.addInitScript(() => localStorage.setItem('rvos:setup:done', 'true'));
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, route => route.abort());
      await page.route('**/roms/**', route => route.fulfill({ status: 404, body: '' }));
      await page.goto(url);
      await page.locator('.sys-grid').waitFor();
      await page.locator('.sys-card[data-sys="snes"]').click();
      assert(await page.locator('.library-refine-item').count() === 3, 'filtros de metadados ausentes');
      assert((await page.locator('.library-count').textContent()).includes('35 jogos'));
      for (let i = 0; i < 4 && !(await page.locator('.game-card.focused').count()); i++) await page.keyboard.press('ArrowDown');
      const focus = page.locator('.game-card.focused');
      assert(await focus.count() === 1 && await focus.getAttribute('data-file') === 'Aladdin (USA).sfc', 'controle não alcança a grade de jogos');
      await page.keyboard.press('y'); // Y = ficha
      await page.locator('.detail-sheet').waitFor();
      assert((await page.locator('.detail-intro').textContent()).includes('Aladdin'));
      assert((await page.locator('.detail-pills').textContent()).includes('1993'));
      assert((await page.locator('.detail-pills').textContent()).includes('Plataforma'));
      assert((await page.locator('.detail-description').textContent()).includes('Disney'));
      assert(await page.locator('.detail-actions .rv-icon').count() === 3, 'botões de ficha sem SVG');
      const bounds = await page.locator('.detail-actions').evaluate(el => ({ bottom: el.getBoundingClientRect().bottom, footer: document.querySelector('#hints').getBoundingClientRect().top }));
      assert(bounds.bottom <= bounds.footer + 1, 'ações da ficha encobertas pela barra de dicas');
      await page.locator('[data-detail="status"]').click();
      assert((await page.locator('[data-detail="status"]').textContent()).includes('Jogando'));
      await page.locator('[data-detail="favorite"]').click();
      const saved = await page.evaluate(() => ({
        status: JSON.parse(localStorage.getItem('rv:convidado:rv_status')),
        favorites: JSON.parse(localStorage.getItem('rv:convidado:rv_favorites'))
      }));
      assert(saved.status['snes/Aladdin (USA).sfc'].s === 'playing', 'status incompatível com os dados do player');
      assert(saved.favorites.some(f => f.console === 'snes' && f.file === 'Aladdin (USA).sfc'), 'favorito não chegou ao player');
      await page.keyboard.press('Escape');
      assert(await page.locator('.game-card.focused[data-file="Aladdin (USA).sfc"]').count() === 1, 'B não restaurou o card selecionado');
      assert((await page.locator('.game-card.focused .game-status').textContent()).includes('Jogando'));
      await page.locator('.library-refine-item[data-refine="status"]').click();
      assert((await page.locator('.library-count').textContent()).includes('1 jogo exibido'), 'filtro Jogando não mostrou o jogo marcado');
      for (let i = 0; i < 3; i++) await page.locator('.library-refine-item[data-refine="status"]').click(); // Zerado → Quero zerar → Todos
      assert((await page.locator('.library-count').textContent()).includes('35 jogos'));
      for (let i = 0; i < 3; i++) await page.locator('.library-refine-item[data-refine="genre"]').click(); // Ação → Aventura → Plataforma
      assert((await page.locator('.library-refine-item[data-refine="genre"]').textContent()).includes('Plataforma'));
      assert(await page.locator('.game-card[data-file="Aladdin (USA).sfc"]').count() === 1);
      await page.locator('.library-refine-item[data-refine="players"]').click(); // 1 jogador
      assert(await page.locator('.game-card[data-file="Aladdin (USA).sfc"]').count() === 1);
      await page.locator('.library-refine-item[data-refine="players"]').click(); // 2+
      assert(await page.locator('.game-card[data-file="Aladdin (USA).sfc"]').count() === 0);
      await page.locator('.library-refine-item[data-refine="players"]').click();
      await page.locator('.library-refine-item[data-refine="players"]').click(); // Todos
      // A preferência salva volta após recarga.
      await page.reload();
      await page.locator('.sys-grid').waitFor();
      assert(await page.locator('.sys-card[data-sys="@fav"]').count() === 1, 'favorito não persistiu');
      await page.locator('.sys-card[data-sys="snes"]').click();
      assert((await page.locator('.game-card[data-file="Aladdin (USA).sfc"] .game-status').textContent()).includes('Jogando'), 'status não persistiu');
      for (let i = 0; i < 4 && !(await page.locator('.game-card.focused').count()); i++) await page.keyboard.press('ArrowDown');
      await page.keyboard.press('s'); // SELECT no card alterna diretamente, sem ficha
      assert((await page.locator('.game-card[data-file="Aladdin (USA).sfc"] .game-status').textContent()).includes('Zerado'), 'SELECT não alterou o status');
      assert(errors.length === 0, errors.join('; '));
      console.log(`${viewport.width}×${viewport.height}: ficha, status, filtros, favorito e persistência OK`);
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(err => { console.error(err); process.exitCode = 1; });

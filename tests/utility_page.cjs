// Segunda home: ombros só nas homes, cards, gerenciador e layouts 800×480/480×320.
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const url = process.env.RVOS_URL || 'http://127.0.0.1:8080/';
(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  try {
    for (const viewport of [{width:800,height:480},{width:480,height:320}]) {
      const context = await browser.newContext({ viewport, serviceWorkers:'block' });
      await context.addInitScript(() => localStorage.setItem('rvos:setup:done','true'));
      const page = await context.newPage();
      const errors = []; page.on('pageerror', e => errors.push(e.message));
      await page.route('**/roms/**', route => route.fulfill({status:404,body:''}));
      await page.goto(url);
      await page.locator('.sys-grid').waitFor();
      assert(await page.locator('[data-h="r"]').isVisible());
      await page.keyboard.press('e'); // R1
      await page.locator('.apps-grid').waitFor();
      assert.equal(await page.locator('.app-card').count(),4);
      assert.equal(await page.locator('.app-card .rv-icon').count(),8);
      assert(await page.locator('[data-h="l"]').isVisible());
      assert(!(await page.locator('[data-h="r"]').isVisible()));
      await page.keyboard.down('e'); await page.waitForTimeout(600); await page.keyboard.up('e');
      assert(await page.locator('.apps-grid').count() === 1,'R1 repetido trocou a página');
      const layout = await page.evaluate(() => ({
        width:document.documentElement.clientWidth,body:document.body.scrollWidth,
        cards:[...document.querySelectorAll('.app-card')].map(el=>({r:el.getBoundingClientRect().right,l:el.getBoundingClientRect().left})),
        footer:document.querySelector('#hints').getBoundingClientRect().top
      }));
      assert(layout.body <= layout.width+1, 'overflow horizontal nos apps');
      assert(layout.cards.every(({r,l})=>l>=10 && r<=layout.width-10), 'cards de app cortados nas bordas');
      await page.locator('.app-card[data-app="files"]').click();
      await page.locator('.files-panel').waitFor();
      assert(!(await page.locator('[data-h="l"]').isVisible()), 'ombros não podem aparecer no gerenciador');
      await page.keyboard.press('q'); await page.keyboard.press('e');
      assert(await page.locator('.files-panel').count() === 1, 'ombros atuaram em tela interna');
      await page.keyboard.press('Escape');
      assert(await page.locator('.apps-grid').count() === 1, 'B não retornou para os apps');
      await page.keyboard.press('q');
      await page.locator('.sys-grid').waitFor();
      await page.locator('[data-sys="@settings"]').click();
      await page.keyboard.press('e'); await page.keyboard.press('q');
      assert(await page.locator('.set-item').count()>0, 'ombros trocaram página nos Ajustes');
      await page.keyboard.press('Escape');
      await page.keyboard.press('e');
      await page.locator('.apps-grid').waitFor();
      await page.reload();
      await page.locator('.apps-grid').waitFor(); // mantém página ao retornar de website
      for (const [id, host] of [['netflix','www.netflix.com'], ['youtube','www.youtube.com'], ['spotify','open.spotify.com']]) {
        await page.route(`https://${host}/**`, route => route.fulfill({status:200,contentType:'text/html',body:'<title>Site externo</title>'}));
        await page.locator(`.app-card[data-app="${id}"]`).click();
        await page.waitForURL(u => u.hostname === host);
        assert.equal(new URL(page.url()).hostname, host, `${id} não abriu o serviço real`);
        await page.goto(url); // extensão kiosk usa o mesmo URL ao voltar pelo controle
        await page.locator('.apps-grid').waitFor();
      }
      assert(errors.length === 0, `${viewport.width}: ${errors.join('; ')}`);
      // Integração de UI com bridge interceptada: entra em ROMs, copia USB→ROMs e exclui.
      let copied = false, deleted = false, created = false;
      await page.route('**/api/files/**', route => {
        const u = new URL(route.request().url());
        let data;
        if (u.pathname.endsWith('/roots')) data = {ok:true,roots:[{id:'roms',label:'ROMs'},{id:'usb:sda1',label:'USB · sda1'}]};
        else if (u.pathname.endsWith('/list')) {
          const root = u.searchParams.get('root'), path = u.searchParams.get('path');
          data = {ok:true,entries: root === 'roms' && !path ? [...[{name:'snes',directory:true,size:0}], ...(created ? [{name:'gba',directory:true,size:0}] : [])] :
            root === 'roms' && path === 'snes' && copied && !deleted ? [{name:'Demo.sfc',directory:false,size:2048}] :
            root === 'usb:sda1' && !path ? [{name:'Demo.sfc',directory:false,size:2048}] : []};
        } else { const request = JSON.parse(route.request().postData());
          if (request.action === 'copy') copied = true;
          if (request.action === 'delete') deleted = true;
          if (request.action === 'mkdir' && request.name === 'gba') created = true;
          data = {ok:true}; }
        return route.fulfill({contentType:'application/json',body:JSON.stringify(data)});
      });
      // A bridge é detectada na carga; a simulação não finge operações destrutivas.
      await page.route('**/api/status', route => route.fulfill({contentType:'application/json',body:JSON.stringify({ok:true,wifi:{connected:true},ip:'',volume:70,brightness:85})}));
      await page.reload(); await page.locator('.apps-grid').waitFor();
      await page.locator('[data-app="files"]').click();
      await page.locator('[data-file-root="usb:sda1"]').waitFor();
      await page.locator('[data-file-new]').click();
      for (const letter of 'gba') await page.locator(`#overlay [data-key="${letter}"]`).click();
      await page.locator('#overlay [data-act="ok"]').click();
      await page.waitForFunction(() => document.querySelector('.files-panel')?.textContent.includes('gba'));
      assert(created, 'pasta não foi criada pela bridge');
      await page.locator('[data-file-root="usb:sda1"]').click();
      await page.waitForFunction(() => document.querySelector('.files-breadcrumb')?.textContent.includes('USB · sda1'));
      await page.locator('[data-file-index="0"]').waitFor();
      await page.keyboard.press('f'); // X copia
      await page.locator('[data-file-root="roms"]').click();
      await page.waitForFunction(() => document.querySelector('.files-breadcrumb')?.textContent.includes('ROMs'));
      await page.locator('[data-file-index="0"]').click(); // entra em snes
      await page.waitForFunction(() => document.querySelector('.files-breadcrumb')?.textContent.includes('snes'));
      await page.keyboard.press('y'); // cola
      await page.locator('[data-file-index="0"]').waitFor();
      assert(copied, 'cópia pela UI não foi enviada à bridge');
      await page.keyboard.press('ArrowDown'); // de '..' para Demo.sfc
      await page.keyboard.press('s'); // SELECT excluir
      await page.locator('[data-file-confirm]').waitFor();
      await page.keyboard.press('Enter');
      await page.locator('[data-file-index="0"]').waitFor({state:'detached'});
      assert(deleted, 'exclusão pela UI não foi enviada à bridge');
      assert(errors.length === 0, `${viewport.width}: ${errors.join('; ')}`);
      console.log(`${viewport.width}×${viewport.height}: apps reais, controle, gerenciador e retorno OK`);
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exit(1)});

// Fluxo REAL da shell via Gamepad API simulada: sem teclado nem mouse.
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const url = process.env.RVOS_URL || 'http://127.0.0.1:8080/';
(async () => {
  const browser = await chromium.launch({ args:['--no-sandbox'] });
  try {
    for (const viewport of [{width:800,height:480},{width:480,height:320}]) {
      const context = await browser.newContext({ viewport, serviceWorkers:'block' });
      await context.addInitScript(() => {
        localStorage.setItem('rvos:setup:done','true');
        const pad = { id:'Controle de teste',connected:true,mapping:'standard',
          buttons:Array.from({length:17},()=>({pressed:false})),axes:[0,0,0,0] };
        Object.defineProperty(navigator,'getGamepads',{ configurable:true,value:()=>[pad] });
        window.__testPad = pad;
      });
      const page = await context.newPage();
      const errors=[]; page.on('pageerror',e=>errors.push(e.message));
      await page.route('https://www.youtube.com/**',route=>route.fulfill({contentType:'text/html',body:'<h1>Site aberto com A</h1>'}));
      await page.goto(url); await page.locator('.sys-grid').waitFor();
      const press = async (button, target) => {
        await page.evaluate(i => window.__testPad.buttons[i].pressed = true,button);
        if (target) await page.locator(target).waitFor({timeout:3000});
        else await page.waitForTimeout(85);
        await page.evaluate(i => window.__testPad.buttons[i].pressed = false,button);
        await page.waitForTimeout(90); // rAF registra a soltura antes do próximo aperto
      };
      await press(5,'.app-card[data-app="netflix"].focused'); // R1
      const shadow = await page.locator('.app-card[data-app="netflix"]').evaluate(el=>getComputedStyle(el).boxShadow);
      assert.notEqual(shadow,'none','o foco pelo controle estava invisível');
      await press(15,'.app-card[data-app="youtube"].focused'); // D-pad direita
      await press(0,'h1'); // A abre serviço real (neste teste interceptado)
      assert.equal(new URL(page.url()).hostname,'www.youtube.com');
      await page.goto(url); await page.locator('.app-card[data-app="netflix"].focused').waitFor();
      await press(15,'.app-card[data-app="youtube"].focused');
      await page.evaluate(() => window.__testPad.axes[0] = .9); // analógico direito
      await page.waitForTimeout(95);
      await page.evaluate(() => window.__testPad.axes[0] = 0);
      await page.locator('.app-card[data-app="spotify"].focused').waitFor({timeout:3000});
      await page.waitForTimeout(110);
      await press(15,'.app-card[data-app="files"].focused');
      await press(0,'.files-panel'); // A abre gerenciador
      await press(4); await press(5); // ombros não trocam página em tela interna
      assert(await page.locator('.files-panel').count() === 1,'ombros atuaram no gerenciador');
      await press(1,'.apps-grid'); // B retorna
      await press(4,'.sys-grid'); // L1 volta aos jogos
      assert(errors.length === 0, errors.join('; '));
      console.log(`${viewport.width}×${viewport.height}: R1, foco visível, D-pad, analógico, A, B e L1 via gamepad OK`);
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exit(1)});

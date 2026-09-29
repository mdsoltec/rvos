// Extensão REAL no Chromium, sites externos interceptados (sem rede/conta/DRM).
const assert = require('node:assert/strict');
const path = require('node:path');
const os = require('node:os');
const fs = require('node:fs');
const { chromium } = require('playwright');
(async () => {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'rvos-ext-'));
  const ext = path.resolve(__dirname, '../webroot/extension/return-home');
  const context = await chromium.launchPersistentContext(profile, {
    channel:'chromium', headless:true, viewport:{width:800,height:480},
    args:[`--disable-extensions-except=${ext}`,`--load-extension=${ext}`]
  });
  try {
    const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
    const id = await worker.evaluate(() => chrome.runtime.id);
    assert(id && id.length === 32, 'extensão não foi carregada');
    const page = context.pages()[0] || await context.newPage();
    const cdp = await context.newCDPSession(page); await cdp.send('Runtime.enable');
    let extensionContext;
    cdp.on('Runtime.executionContextCreated',ev=>{ if(ev.context.origin === `chrome-extension://${id}`) extensionContext = ev.context.id; });
    await page.addInitScript(() => localStorage.setItem('rvos:setup:done','true'));
    await page.route('https://www.youtube.com/**', route => route.fulfill({contentType:'text/html',body:`
      <html><body><button id="try" style="position:fixed;top:215px;left:350px;width:100px;height:60px">Abrir</button><input id="search" placeholder="Pesquisar"><input id="email" type="email" placeholder="E-mail"><div id="result"></div>
      <script>document.getElementById('try').onclick=()=>document.getElementById('result').textContent='abriu';</script></body></html>`}));
    await page.goto('http://127.0.0.1:8080/');
    await page.locator('.sys-grid').waitFor();
    await page.keyboard.press('e');
    await page.locator('.apps-grid').waitFor();
    await page.locator('[data-app="youtube"]').click();
    await page.waitForURL('https://www.youtube.com/');
    await page.locator('#rvos-pad-hud').waitFor({ timeout:10000 });
    const home = await worker.evaluate(async () => chrome.storage.session.get(null));
    assert(Object.values(home).includes('http://127.0.0.1:8080/'),'URL de retorno não reflete a porta do navegador');
    const unrelated = await context.newPage();
    await unrelated.route('https://www.youtube.com/**', route => route.fulfill({contentType:'text/html',body:'<h1>Outra aba</h1>'}));
    await unrelated.goto('https://www.youtube.com/');
    assert.equal(await unrelated.locator('#rvos-pad-hud').count(), 0, 'extensão alterou aba que não veio da shell');
    await unrelated.close();
    assert(extensionContext, 'content script isolado não iniciou');
    async function evalPad(expression) {
      const result = await cdp.send('Runtime.evaluate', { contextId:extensionContext, expression, returnByValue:true });
      if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
      return result.result.value;
    }
    await evalPad(`window.__rvosFakePad={connected:true,axes:[0,0,0,0],buttons:Array.from({length:16},()=>({pressed:false}))};Object.defineProperty(navigator,'getGamepads',{configurable:true,value:()=>[window.__rvosFakePad]});`);
    await page.locator('#rvos-pad-cursor:not([hidden])').waitFor();
    const before = await page.locator('#rvos-pad-cursor').evaluate(el=>el.style.transform);
    await evalPad('window.__rvosFakePad.axes[0]=1');
    await page.waitForTimeout(120);
    await evalPad('window.__rvosFakePad.axes[0]=0');
    const after = await page.locator('#rvos-pad-cursor').evaluate(el=>el.style.transform);
    assert.notEqual(before, after, 'analógico não moveu cursor');
    await evalPad('window.__rvosFakePad.axes[0]=-1');
    await page.waitForTimeout(120);
    await evalPad('window.__rvosFakePad.axes[0]=0');
    await evalPad('window.__rvosFakePad.buttons[0].pressed=true');
    await page.locator('#result').filter({hasText:'abriu'}).waitFor();
    await evalPad('window.__rvosFakePad.buttons[0].pressed=false');
    await page.evaluate(() => { history.pushState({}, '', '/step2'); document.body.style.height='1600px'; });
    await evalPad('window.__rvosFakePad.buttons[3].pressed=true');
    await page.waitForFunction(() => scrollY > 0);
    await evalPad('window.__rvosFakePad.buttons[3].pressed=false');
    await evalPad('window.__rvosFakePad.buttons[1].pressed=true');
    await page.waitForURL('https://www.youtube.com/');
    await evalPad('window.__rvosFakePad.buttons[1].pressed=false');
    await page.locator('#search').click();
    await evalPad('window.__rvosFakePad.buttons[2].pressed=true');
    await page.locator('#rvos-pad-keyboard:not([hidden])').waitFor();
    await evalPad('window.__rvosFakePad.buttons[2].pressed=false');
    await evalPad('window.__rvosFakePad.buttons[0].pressed=true');
    await page.waitForFunction(()=>document.querySelector('#search').value.startsWith('1'));
    await evalPad('window.__rvosFakePad.buttons[0].pressed=false');
    await page.locator('#rvos-pad-keyboard [data-rv-key="Fechar"]').click();
    await page.locator('#search').fill('');
    await page.locator('[data-rv-keyboard]').click();
    await page.locator('#rvos-pad-keyboard:not([hidden])').waitFor();
    for (const letter of 'teste') await page.locator(`#rvos-pad-keyboard [data-rv-key="${letter}"]`).click();
    assert.equal(await page.locator('#search').inputValue(),'teste','teclado não preencheu campo');
    await page.locator('#rvos-pad-keyboard [data-rv-key="Fechar"]').click();
    await page.locator('#email').click();
    await page.locator('[data-rv-keyboard]').click();
    for (const letter of 'a@b.com') await page.locator(`#rvos-pad-keyboard [data-rv-key="${letter}"]`).click();
    assert.equal(await page.locator('#email').inputValue(),'a@b.com','campo de e-mail rejeitou teclado');
    await page.locator('#rvos-pad-keyboard [data-rv-key="Fechar"]').click();
    await evalPad('window.__rvosFakePad.buttons[8].pressed=true;window.__rvosFakePad.buttons[9].pressed=true');
    await page.waitForURL('http://127.0.0.1:8080/', {timeout:5000});
    await page.waitForURL('http://127.0.0.1:8080/');
    await page.locator('.apps-grid').waitFor();
    console.log('Chromium real: analógico, A, X, teclado, START+SELECT e retorno dinâmico OK');
  } finally { await context.close(); fs.rmSync(profile,{recursive:true,force:true}); }
})().catch(e=>{console.error(e);process.exit(1)});

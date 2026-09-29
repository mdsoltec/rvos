// Verificações rápidas da extensão; fluxo real em external_controller.cjs.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const base = path.join(__dirname,'../webroot/extension/return-home');
const manifest = JSON.parse(fs.readFileSync(path.join(base,'manifest.json')));
assert(manifest.content_scripts[0].matches.includes('https://*/*'));
assert(manifest.content_scripts[0].matches.includes('http://*/*'));
assert.deepEqual(manifest.permissions,['storage']);
assert.equal(manifest.background.service_worker,'background.js');
const scripts = ['background.js','return.js','return.css'];
for (const script of scripts) assert(fs.statSync(path.join(base,script)).size > 500);
console.log('Extensão externa: manifest, registro de aba e arquivos OK');

/* Registro por aba: somente uma shell local pode habilitar o overlay nas páginas
   externas abertas naquela aba. Sem captura de senha, rede ou histórico. */
const SHELL_HOST = host => host === '127.0.0.1' || host === 'localhost' || host.endsWith('.e2b.app');
const key = tabId => 'rvos-tab-' + tabId;
chrome.runtime.onMessage.addListener((message, sender, reply) => {
  if (!sender.tab || !Number.isInteger(sender.tab.id)) return false;
  const tabId = sender.tab.id;
  if (message?.type === 'registerShell') {
    try {
      const url = new URL(sender.url);
      if (!SHELL_HOST(url.hostname) || !['http:', 'https:'].includes(url.protocol)) return false;
      const home = url.origin + '/';
      chrome.storage.session.set({ [key(tabId)]: home }).then(() => reply({ ok: true }));
      return true;
    } catch (e) { return false; }
  }
  if (message?.type === 'getHome') {
    chrome.storage.session.get(key(tabId)).then(data => reply({ home: data[key(tabId)] || null }));
    return true;
  }
  return false;
});
chrome.tabs.onRemoved.addListener(tabId => chrome.storage.session.remove(key(tabId)));
chrome.tabs.onCreated.addListener(tab => {
  if (tab.openerTabId == null) return;
  chrome.storage.session.get(key(tab.openerTabId)).then(data => {
    const home = data[key(tab.openerTabId)];
    if (home) return chrome.storage.session.set({ [key(tab.id)]: home });
  });
});

/* ═══════════════════════════════════════════════════════════
   RETROVAULT WEB — CONFIGURAÇÃO DA CONTA / NUVEM
   ───────────────────────────────────────────────────────────
   Nuvem LIGADA: login por e-mail + sincronização entre dispositivos.
   ═══════════════════════════════════════════════════════════ */
window.RV_CONFIG = {

  /* ─── 1. Credenciais do Firebase (cole o objeto firebaseConfig) ─── */
  /* IDs do projeto Firebase: infraestrutura ativa (auth/storage/firestore).
     Não renomear — mudá-los quebra login e sincronização. */
  firebase: {
    apiKey:            'AIzaSyAMfGOsGFsYhoT_ujQzTKx-Zsx3VMkiets',
    authDomain:        'retroverso-3536c.firebaseapp.com',
    projectId:         'retroverso-3536c',
    storageBucket:     'retroverso-3536c.firebasestorage.app',
    messagingSenderId: '502704861004',
    appId:             '1:502704861004:web:8e2b71ce0f602bd1c2a9e9'
  },

  /* ─── 2. O que sincronizar ─── */
  sync: {
    // Histórico, favoritos, conquistas, estatísticas e nome do jogador.
    profile: true,
    // Save-states (o "Salvar" da barra de sistema dentro do jogo).
    saves: true,
    // Enviar o save para a nuvem automaticamente ao salvar no jogo.
    autoUploadSaves: true,
    // Ao abrir um jogo, buscar na nuvem um save mais novo que o local.
    autoDownloadSaves: true
  },

  /* ─── 3. Limites de segurança dos saves na nuvem ─── */
  // Saves são compactados (gzip) e gravados em pedaços no Firestore,
  // que é gratuito até 1 GiB. Save maior que isto fica só no aparelho.
  maxCloudSaveMB: 8,

  /* ─── 4. Versão do SDK do Firebase carregado via CDN ─── */
  firebaseSdkVersion: '10.12.5',

  /* ─── 5. Login obrigatório? ───
     true  = as páginas redirecionam para login.html quando não há sessão
     false = navegação livre; o login vira opcional */
  requireLogin: true
};
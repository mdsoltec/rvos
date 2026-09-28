# RetroVault OS

> O sistema operacional do console portátil RetroVault.
> **Projeto independente** do [RetroVault WEB](../retrovault) — boot direto na
> interface, sem login, sem navegador à vista, navegação 100% por botões físicos.

Versão web e OS **não compartilham código em runtime**: este repositório tem
seu próprio front (fork do player) e sua própria interface. O que vem da web
são os **dados** (catálogo, capas, cheats, assets), importados por
`tools/sync-from-web.sh` — a web continua sendo a dona deles.

```
retrovault-os/
├─ webroot/                    ← O SISTEMA (raiz servida no console)
│  ├─ index.html               ← boot → shell (este arquivo É o SO)
│  ├─ shell.css / shell.js     ← interface do console (gamepad-first)
│  ├─ icons.css / icons.js     ← ícones SVG compartilhados (sem emojis)
│  ├─ input.js                 ← Gamepad API + teclado físico → ações
│  ├─ bridge.js                ← fala com o hardware (ou modo simulação)
│  ├─ player.html              ← fork do play.html da web (lógica completa:
│  │                             saves, cheats, BIOS, overlays, EmulatorJS)
│  ├─ js/, css/                ← lógica do site que o player precisa
│  │   └ rv-os-exit.js         ← START+SELECT abre menu do jogo (sempre ativo)
│  ├─ covers/ assets/ cheats/  ← DADOS da web (sync; no dev são symlinks)
│  ├─ vendor/emulatorjs/       ← EmulatorJS 4.2.3 local (offline! rode
│  │                             tools/fetch-emulatorjs.sh) c/ fallback ao CDN
│  └─ roms → /roms             ← symlink p/ cartão de dados (no console)
│
├─ firmware/                   ← a imagem do aparelho
│  ├─ build-image.sh           ← gera retrovault-os.img.xz (Pi OS + kiosk)
│  ├─ HARDWARE.md              ← botões, telas, bateria, áudio
│  └─ rootfs/opt/retrovault/
│     ├─ bridge.py             ← serve webroot/ + /api/* (wi-fi, volume…)
│     └─ kiosk.sh + systemd    ← Chromium fullscreen (cage/Wayland) no boot
│
├─ tools/
│  ├─ sync-from-web.sh         ← importa capas/assets/catálogo da web
│  └─ fetch-emulatorjs.sh      ← baixa EmulatorJS p/ rodar offline
│
└─ roms/                       ← suas ROMs (gitignored): roms/<console>/<arquivo>
```

## Fluxo do console

```
liga → bridge (site + API) → Chromium kiosk abre http://127.0.0.1/ →
boot RetroVault OS → home (continuar · consoles · jogos) → A:
player.html (EmulatorJS local) → START+SELECT: menu do jogo (salvar/carregar/voltar à shell)
```

## Diferenças do fork do player vs. web

| Peça | Web | OS |
|---|---|---|
| Entrada | `index.html` (home do site) | **shell própria** |
| Login / nuvem | opcional (Firebase) | **ausente** — tudo local |
| EmulatorJS | CDN | **local (`vendor/`)** + fallback CDN |
| ROMs | remoto + `roms/` | **`roms/` (cartão) primeiro**, remoto fallback |
| Sair do jogo | botão na UI | **START+SELECT** abre menu (salvar/carregar/voltar); **HOME** volta direto |
| Analytics/CF insights | presente | **removido** |
| Overlays de toque | sim (celular) | desnecessários (botões físicos) |

## Desenvolvimento (qualquer PC)

```bash
./tools/sync-from-web.sh --dev          # cria os symlinks (1ª vez)
python3 firmware/rootfs/opt/retrovault/bridge.py \
  --root "$PWD/webroot" --port 8080     # serve o sistema
# abra http://localhost:8080/   ← boot direto na shell
chromium --kiosk http://localhost:8080/ # como no console
```

Teclado = controle: **setas** D-pad, **Enter** A, **Esc** B (segurar 1s dentro
do jogo volta à shell), **F** favorito, **P** START (menu energia).
No aparelho, **START sozinho** abre o menu de energia na shell; dentro do
jogo **START+SELECT por 0,8 s** abre o menu físico de salvar/carregar/retomar/sair.
O botão **HOME/GUIDE** sai direto do jogo (captura checkpoint antes de sair).

### Testar a interface sem hardware

```bash
# depois de sincronizar catálogo/assets com tools/sync-from-web.sh
python3 -m http.server 8080 --bind 0.0.0.0 --directory webroot
# abra http://localhost:8080/ (mostra SIMULAÇÃO)
```

Na simulação, o navegador não recebe comandos de desligamento/Wi-Fi reais.
**Busca, filtros, favoritos, assistente, teclado virtual e modo sem CRT** podem
ser testados sem ROM. Para iniciar um jogo, adicione sua ROM em
`webroot/roms/<console>/<arquivo>` (dev), ou use o fallback remoto caso
esteja disponível. No aparelho as ROMs ficam em `/roms`.

A bridge por padrão aceita **somente loopback**; execução no PC:
`python3 firmware/rootfs/opt/retrovault/bridge.py --root webroot --port 8080`.
Não a exponha na LAN: mesmo com os POSTs administrativos restritos ao localhost,
o endpoint de status é destinado ao próprio aparelho.

Testes de regressão: `python3 -m unittest discover -s tests -v` e
`node tests/test_input.cjs`. Opcional (com Playwright instalado):
`node tests/smoke.cjs` contra a simulação servida na porta 8080.

## ROMs

`roms/<console>/<arquivo>` com o nome **exato** do campo `file` do catálogo
(ex.: `roms/snes/Super Mario World (USA).sfc`). Sem elas, o player usa o
servidor remoto da web como fallback (precisa de internet).

## Firmware (imagem pronta)

```bash
./tools/sync-from-web.sh                # materializa os dados (cópia real)
./tools/fetch-emulatorjs.sh             # EmulatorJS offline (1ª vez)
cd firmware && sudo ./build-image.sh    # → retrovault-os.img.xz
```

O build sincroniza catálogo/arte quando não estiverem presentes e baixa o EmulatorJS se não existir no
`webroot/vendor/`. Sem estes dados a shell não inicia; sem o motor local o
player só funciona com internet. Grave no SD com Raspberry Pi Imager e ligue.
Detalhes de montagem física
(botões, tela, bateria) em [`firmware/HARDWARE.md`](firmware/HARDWARE.md).

## Roadmap

- [x] Shell própria (boot → home → jogos) 100% por botões
- [x] Projeto separado da web; player forkado com a lógica original
- [x] Bridge de hardware + kiosk + build de imagem
- [x] Assistente de primeiro boot (Wi-Fi, teste de botões, apelido; idioma ainda fixo em PT-BR)
- [ ] Scraper/ficha do jogo na shell (dados de `fichas.js`)
- [ ] Pareamento Bluetooth de controles pela bridge
- [ ] OTA assinado A/B

## Melhorias nesta versão

- Boot do firmware aponta para `webroot` e a bridge atende apenas loopback.
- Shell: START físico, navegação em ajustes/Wi-Fi, confirmação de energia e
  prazos adequados para varredura/conexão Wi-Fi.
- Biblioteca: busca por teclado virtual, filtros, indicação da ROM no cartão
  (checagem HEAD), último save local e layout compacto para 480×320.
- Player local sem login/nuvem; menu por START+SELECT com saves/checkpoint/saída.
- Cache do OS separado da versão web; ROMs, API e motor de emulação fora do SW.
- Opção de desligar efeitos CRT em Ajustes → Efeitos CRT.

**Limites da simulação:** ligação GPIO, backlight, áudio ALSA, consumo/bateria,
performance real dos núcleos e gravação da imagem do Raspberry Pi exigem teste
no hardware. Indicador “só via rede” é uma possibilidade, não garantia de que
a ROM remota exista. Distribua sem ROMs comerciais não autorizadas.

## Identidade visual dos ícones

A shell e o player usam **`webroot/icons.js`** e **`webroot/icons.css`**: uma
família de SVGs com grade 24×24, traço 1,8, cantos arredondados e `currentColor`.
Em JavaScript use `RVIcons.render('system')`; em HTML estático use
`<span data-rv-icon="system"></span>`. A biblioteca não precisa de CDN. O card
**Sistema** usa a arte PNG 3D em `webroot/ui/system-gear.png`, no mesmo layout
dos consoles. A arte é adaptada da [imagem indicada pelo usuário](https://www.pngwing.com/en/free-png-aqhfi);
confirme os direitos de uso antes de distribuir comercialmente.
Evite inserir emoji ou símbolos tipográficos como ícones nas novas telas;
letras A/B/X/Y do controle e legendas são texto, não ícones decorativos.

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
│  ├─ input.js                 ← Gamepad API + teclado físico → ações
│  ├─ bridge.js                ← fala com o hardware (ou modo simulação)
│  ├─ player.html              ← fork do play.html da web (lógica completa:
│  │                             saves, cheats, BIOS, overlays, EmulatorJS)
│  ├─ js/, css/                ← lógica do site que o player precisa
│  │   └ rv-os-exit.js         ← START+SELECT volta à shell (sempre ativo)
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
player.html (EmulatorJS local) → START+SELECT: volta à shell
```

## Diferenças do fork do player vs. web

| Peça | Web | OS |
|---|---|---|
| Entrada | `index.html` (home do site) | **shell própria** |
| Login / nuvem | opcional (Firebase) | **ausente** — tudo local |
| EmulatorJS | CDN | **local (`vendor/`)** + fallback CDN |
| ROMs | remoto + `roms/` | **`roms/` (cartão) primeiro**, remoto fallback |
| Sair do jogo | botão na UI | **START+SELECT / HOME** físicos |
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

Grave no SD com Raspberry Pi Imager e ligue. Detalhes de montagem física
(botões, tela, bateria) em [`firmware/HARDWARE.md`](firmware/HARDWARE.md).

## Roadmap

- [x] Shell própria (boot → home → jogos) 100% por botões
- [x] Projeto separado da web; player forkado com a lógica original
- [x] Bridge de hardware + kiosk + build de imagem
- [ ] Assistente de primeiro boot (idioma, wi-fi, calibrar botões)
- [ ] Scraper/ficha do jogo na shell (dados de `fichas.js`)
- [ ] Pareamento Bluetooth de controles pela bridge
- [ ] OTA assinado A/B

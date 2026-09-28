# RetroVault OS — Firmware

Firmware único para o console portátil RetroVault: **Raspberry Pi OS Lite (64-bit) →
bridge (este diretório) → Chromium kiosk em Wayland (cage) → `/` (a própria shell)**.

O console liga e cai direto na interface RetroVault OS, navegável pelos
botões físicos. Os jogos rodam no **fork local do player da versão web** — saves e EmulatorJS; não há login nem nuvem no OS.

```
┌────────────────────────── hardware ──────────────────────────┐
│ botões (encoder USB ou GPIO) · tela LCD · amp I2S · bateria  │
└──────────────┬───────────────────────────────────────────────┘
               │ /dev/input (gamepad)      │ sysfs/amixer/nmcli
┌──────────────▼───────────┐   ┌───────────▼──────────────────┐
│ Chromium (kiosk, cage)    │   │ bridge.py (root, :80)        │
│  index.html (shell do OS)   │◄─►│  serve webroot/ + /api/*      │
│  Gamepad API nativa       │   │  wi-fi, volume, brilho,      │
└───────────────────────────┘   │  bateria, desligar/reiniciar │
                                └──────────────────────────────┘
```

## Por que assim (e não EmulationStation/RetroArch)

- **Zero duplicação**: catálogo, capas, fichas, saves, sync (somente na versão web) e o
  player EmulatorJS são os da web. Jogo novo no `catalog.js` aparece no console.
- **Firmware único**: uma imagem `.img` gravada no SD é o produto inteiro.
- **Atualização OTA trivial**: o "sistema" é um site estático — atualizar é
  `git pull` + recarregar.

## Estrutura

```
firmware/
├─ build-image.sh            ← gera retrovault-os.img(.xz) pronto p/ gravar
├─ HARDWARE.md               ← botões físicos, tela, bateria, áudio
└─ rootfs/                   ← copiado 1:1 para a raiz da imagem
   ├─ opt/retrovault/
   │  ├─ bridge.py           ← site estático + /api/* (wi-fi/volume/brilho/energia)
   │  └─ kiosk.sh            ← Chromium --kiosk http://127.0.0.1/
   ├─ etc/systemd/system/
   │  ├─ retrovault-bridge.service
   │  └─ retrovault-shell.service   (cage na tty1, usuário rv)
   └─ etc/udev/rules.d/99-retrovault.rules
```

## Build da imagem

```bash
cd firmware
sudo ./build-image.sh                 # baixa o Pi OS Lite e gera retrovault-os.img.xz
# grave com Raspberry Pi Imager / balenaEtcher
```

Primeiro boot: expande-se sozinho e abre a shell. Conecte o Wi-Fi em
**Ajustes → Wi-Fi** (com o teclado virtual na tela) — ou deixe tudo offline.

## ROMs no cartão

O `player.html` procura a ROM **primeiro** em `roms/<console>/<arquivo>` antes de
ir ao servidor online — no console isso vira um symlink para `/roms`:

```bash
# com o SD montado no PC, ou via scp:
mkdir -p /roms/snes
scp "Super Mario World (USA).sfc" rv@<ip-do-console>:/roms/snes/
```

O nome do arquivo deve ser **exatamente** o do `catalog.js` (campo `file`).
Sem internet, só o que estiver em `/roms` abre; com internet, o Worker remoto
continua funcionando como fallback (como na web).

## Modo desenvolvedor (em qualquer Linux, sem hardware)

```bash
# 1. sirva o site com a bridge (porta 8080 evita root)
python3 firmware/rootfs/opt/retrovault/bridge.py --root webroot --port 8080

# 2. abra a shell
chromium --kiosk http://localhost:8080/
```

Wi-fi/volume/brilho caem no que existir no host (ou em simulação). Sem bridge,
a shell detecta sozinha e roda em **modo simulação** (indicado na barra).

## Atualização do firmware (OTA caseira)

```bash
ssh rv@<ip-do-console>  # habilite o ssh no primeiro acesso
# O build copia os arquivos, mas NÃO inclui um checkout Git no aparelho.
# Copie um release autenticado para /opt/retrovault e reinicie a bridge/kiosk.
sudo systemctl restart retrovault-bridge retrovault-shell
```

## Segurança (antes de vender/distribuir)

- A bridge já escuta apenas em `127.0.0.1:80` por padrão, inclusive no serviço systemd.
  Evite `--host 0.0.0.0` no aparelho: a API é para uso local.
- Troque a senha do usuário `rv` e desabilite SSH na imagem de produção.
- Distribua **sem ROMs** — cada usuário copia as próprias (como na web).

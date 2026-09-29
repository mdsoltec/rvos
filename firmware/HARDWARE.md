# RetroVault OS — Hardware do console portátil

A shell fala com os botões pela **Gamepad API do Chromium**: qualquer controle
que vire um joystick USB Linux (`/dev/input/js0`) funciona sem código extra.

## 1. Botões físicos — duas rotas

### A) Encoder USB (recomendado p/ protótipo) — 0 código

Placas "zero delay USB encoder" (~R$ 30): cada botão liga em um borne, a placa
se apresenta como joystick USB. Chromium reconhece na hora.

Mínimo para a shell + jogos: **D-pad · A · B · X · Y · L · R · START · SELECT**.
Opcionais: L2/R2 (psx/n64), botão HOME dedicado (atalho global p/ voltar à shell
dentro do jogo) e 2 analógicos.

### B) GPIO direto (produto final, estilo handheld comercial)

Overlay `mk_arcade_joystick_rpi`: os GPIOs viram um joystick do kernel.

```
# /boot/firmware/config.txt
dtoverlay=mk_arcade_joystick_rpi
# mapa padrão wiringPi — ajuste conforme sua placa:
# up=4 down=17 left=27 right=22 a=5 b=6 x=13 y=19 l=12 r=16 start=20 select=21
```

Alternativa com analógico: ADC ADS1115 (I2C) + módulo analógico de PS2, lidos
por um pequeno daemon `evdev` (há projetos prontos: `gpioneer`, `analog2joy`).

## 1.1 Mapa de botões (padrão W3C que a shell espera)

| Botão físico | W3C | Na shell | No jogo (EmulatorJS) |
|---|---|---|---|
| A (sul)     | 0  | Confirmar / Jogar        | botão do jogo |
| B (leste)   | 1  | Voltar                   | botão do jogo |
| X (oeste)   | 2  | Favorito                 | botão do jogo |
| Y (norte)   | 3  | Shift (teclado virtual)  | botão do jogo |
| L / R       | 4/5 | (paginação futura)      | gatilhos |
| D-pad       | 12–15 | Navegação             | direção |
| START       | 9  | Menu de energia (ao soltar) | start |
| SELECT      | 8  | (reservado)              | select |
| **START+SELECT (segurar 0,8s)** | — | **dentro do jogo: abre menu de save/carregar/sair** | — |
| HOME/GUIDE  | 16 | Menu de energia          | volta à shell |

Encoders chineses genéricos geralmente não seguem a ordem exata: se A e B
saírem trocados, o caminho honesto é remapear no próprio encoder ou via
`udev`/`SDL_GAMECONTROLLERCONFIG` — HARDWARE ainda é a parte artesanal. O combo
START+SELECT do menu do jogo é implementado em `js/rv-os-exit.js` e funciona com
qualquer par de botões 8/9.

## 2. Tela

| Opção | Interface | Notas |
|---|---|---|
| 5"–7" HDMI (800×480 / 1024×600) | HDMI + USB touch* | mais fácil; *toque não é usado |
| 3.5"–4" DSI oficial | DSI | melhor brilho/consumo, backlight via sysfs |
| SPI (ili9341) | SPI + fbcp | barata mas ~25 fps — evitar p/ ação |

A shell é responsiva (`clamp()` por todo lado): 480p fica nítido, 720p fica
luxuoso. Ajuste fino de brilho sai pela **Ajustes → Brilho** (`/sys/class/backlight`).

## 3. Energia e bateria

- **UPS HAT / PiSugar / UPS-Lite**: aparece em `/sys/class/power_supply/` → a
  bridge já expõe `%` e o ícone de bateria na barra de status.
- **Desligar com segurança**: use a shell (START → Desligar) ou botão liga/desliga
  no GPIO 3 (`dtoverlay=gpio-shutdown`). Nunca corte energia direto (corrompe SD).

## 4. Áudio

- Simples: fone/speaker pelo **P2 jack** (`amixer` controla, zero esforço).
- Melhor: **DAC I2S** (PCM5102, MAX98357A com amp): overlay `dtoverlay=hifiberry-dac`
  e pronto — o controle de volume da shell já fala com o ALSA.

## 4.1 Redes e Bluetooth

- **Wi-Fi:** exige adaptador reconhecido pelo Linux, rádio ligado e NetworkManager
  ativo. A shell usa a bridge local para buscar, mostrar sinal e conectar pelo
  `nmcli`; a senha não volta na resposta da API. O assistente permite seguir
  offline. Teste com redes abertas e WPA/WPA2 reais no aparelho.
- **Bluetooth:** exige adaptador reconhecido, `bluetooth.service` ativo e rádio
  ligado. O build instala `bluez`. Ajustes → Bluetooth lista, busca, pareia,
  conecta, desconecta e esquece via bridge/`bluetoothctl`. O controle antigo
  deve permanecer disponível enquanto o novo é pareado. O agente
  `NoInputNoOutput` serve a dispositivos compatíveis com *Just Works*; alguns
  controles pedem confirmação ou PIN e precisarão de outro fluxo de agente.
  Teste a navegação Gamepad API do Chromium com o controle efetivamente pareado.
- **Fones Bluetooth:** conectar não seleciona perfil nem roteia áudio
  automaticamente; ALSA/PipeWire exigem configuração própria para isso.
- **Sem rádio:** a bridge avisa indisponibilidade. Só o site estático, sem bridge,
  usa dispositivos de exemplo marcados como **SIMULAÇÃO**.

## 5. Carcaça de referência (caminho comum)

1. **Protótipo**: Raspberry Pi Zero 2 W + tela 4.3" HDMI 800×480 + encoder USB
   + powerbank → valida tudo em um fim de semana.
2. **V1 impressão 3D**: CM4 ou Pi 4 (psx/n64/ds com folga), placa de botões
   própria (GPIO), UPS, DAC I2C, caixa estilo Steam Deck mini.
3. Desempenho por núcleo (EmulatorJS/Chromium): até GBC/SNES/MD roda até no
   Zero 2 W; **PSX/N64/NDS pedem Pi 4/CM4**.

## 6. Storage

- SD A1/A2 64 GB+: SO na raiz, ROMs em `/roms` (ext4 do próprio SD).
- Pendrive USB com pasta `roms/` na raiz também funciona: monte em `/roms`
  via `/etc/fstab` (`UUID=…  /roms  exfat  defaults,nofail  0  2`).

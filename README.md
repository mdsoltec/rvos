# RetroVault OS

> O sistema operacional do console portátil RetroVault.
> **Projeto independente** do [RetroVault WEB](../retrovault) — boot direto na
> interface, sem login na shell e navegável por botões físicos. Sites externos
> podem exigir conta, teclado e navegador/DRM compatível.

Versão web e OS **não compartilham código em runtime**: este repositório tem
seu próprio front (fork do player) e sua própria interface. O que vem da web
são os **dados** (catálogo, capas, cheats, assets), importados por
`tools/sync-from-web.sh` — a web continua sendo a dona deles.

```
retrovault-os/
├─ webroot/                    ← O SISTEMA (raiz servida no console)
│  ├─ index.html               ← shell direta (assistente 1º uso ou Home)
│  ├─ shell.css / shell.js     ← interface do console (gamepad-first)
│  ├─ icons.css / icons.js     ← ícones SVG compartilhados (sem emojis)
│  ├─ input.js                 ← Gamepad API + teclado físico → ações
│  ├─ bridge.js                ← fala com o hardware (ou modo simulação)
│  ├─ extension/return-home/   ← controle/teclado em sites externos e retorno
│  ├─ player.html              ← fork do play.html da web (lógica completa:
│  │                             saves, cheats, BIOS, overlays, EmulatorJS)
│  ├─ js/, css/                ← ficha dos jogos + lógica do player
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
│     ├─ bridge.py             ← serve webroot/ + /api/* (Wi-Fi, Bluetooth, volume…)
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
liga → boot do Linux → bridge (site + API) → Chromium kiosk abre http://127.0.0.1/ →
primeiro uso: assistente; demais usos: Home (continuar · consoles · jogos) → A:
player.html (EmulatorJS local) → START+SELECT: menu do jogo (salvar/carregar/voltar à shell)
```

Não há splash/intro de boot na interface web nem gamepad virtual. O visual do
boot personalizado do aparelho deve ser configurado no **firmware**; ainda não
foi implementado. O teclado virtual de **texto** permanece para rede, busca e nome.

## Segunda página: entretenimento e utilidades

Na **Home Jogos**, R1 abre **Entretenimento e Utilidades**; nessa segunda Home,
L1 volta aos jogos. Ombros não alternam telas dentro da biblioteca, Ajustes,
gerenciador ou diálogos. A segunda página traz **Netflix, YouTube e Spotify**:
pressionar A navega aos **sites reais** (não são iframes, simulações nem players
locais). A extensão local `webroot/extension/return-home/` cria, na mesma
aba, um **cursor pelo analógico/D-pad**, A para clicar, B para voltar no histórico,
Y para rolar (ou analógico direito), X para abrir o teclado virtual em campos de
texto e **START+SELECT por 0,8 s** para retornar à Home de apps. No teclado,
A escolhe, Y alterna maiúsculas, X apaga e B fecha. A extensão não guarda senhas.
Ela roda no Chromium kiosk e também pode ser instalada temporariamente num
Chrome/Chromium comum para testar com seu controle físico; veja abaixo.

**Limites:** os cliques e eventos de teclado enviados a sites de terceiros são
sintéticos. Alguns serviços podem recusá-los, alterar o layout, exigir CAPTCHA
ou um teclado USB. Internet, conta, Chromium ARM e DRM/Widevine são requisitos
de reprodução **a validar no Pi 4**. Abrir o site não prova que Netflix/Spotify
reproduzam mídia nele.

### Testar em um computador com controle físico

1. Extraia o ZIP e, dentro de `rvos/`, execute
   `python3 -m http.server 8080 --directory webroot` (no Windows, use `python`
   no lugar de `python3`). Abra **http://127.0.0.1:8080/** no Chrome/Chromium.
2. Em `chrome://extensions`, habilite **Modo do desenvolvedor** e escolha
   **Carregar sem compactação** apontando para
   `rvos/webroot/extension/return-home`. Recarregue a Home após instalá-la.
3. Conecte o controle ao computador, clique uma vez na página e pressione um
   botão. Teste **R1 → Netflix em foco → direcional/analógico entre os quatro
   cards → A para abrir → B para voltar**; L1 retorna aos jogos. No YouTube,
   teste cursor, busca com teclado na tela e START+SELECT para voltar. O foco
   dos cards deve aparecer como borda na cor do serviço. Para regressão sem
   controle físico, `node tests/app_gamepad.cjs` simula o Gamepad API nas duas
   resoluções de LCD.

Use uma janela/perfil de teste: a extensão pede acesso a sites HTTP/HTTPS para
continuar funcionando quando um serviço redireciona para sua página de login.
Ela só ativa o controle na **aba que abriu a shell**; desative/remova a extensão
ao terminar. A prévia embutida em iframe pode bloquear Gamepad API — neste
caso, use uma aba própria em `127.0.0.1`, não `file://` nem o visualizador do ZIP.
O gerenciador real exige a bridge; o servidor estático mostra uma mensagem de
simulação para arquivos em vez de fingir cópias/exclusões.

O card **Arquivos** abre um gerenciador limitado a `/roms` e aos volumes USB
montados em `/media/rv/<dispositivo>`. **A** abre pasta, **B** sobe/volta, **X**
copia um arquivo para a área temporária, **Y** cola na pasta atual (sem
sobrescrever), **Nova pasta** cria diretórios pelo teclado virtual, **SELECT**
pede confirmação antes de excluir um arquivo. Pastas
não podem ser excluídas; links simbólicos não são seguidos nem mostrados. No
preview servido apenas como estático, Arquivos informa que a bridge é necessária,
em vez de simular cópias ou exclusões. O firmware monta automaticamente partições
USB compatíveis em `/media/rv/`; ejetar/remover o pendrive durante cópia pode
falhar. Em volumes Linux, escrita depende das permissões do filesystem.

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

Alternativa no VS Code: abra a pasta **`webroot`**, clique com o botão direito
em **`index.html` → Open with Live Server**. Não abra via `file://`. Na primeira
visita, conclua o assistente; depois vá a **Sistema → Ajustes → Perfil**.
Use sempre o mesmo endereço/porta ao testar: o perfil é local ao navegador e
não se transfere automaticamente entre `localhost` e `127.0.0.1`.

Na simulação, o navegador não recebe comandos de desligamento/Wi-Fi/Bluetooth
reais: redes e dispositivos são exemplos. Com a bridge, Wi-Fi usa NetworkManager
(`nmcli`) e Bluetooth usa BlueZ (`bluetoothctl`); serviços, adaptadores e rádios
precisam estar ativos. Em Ajustes → Wi-Fi é possível buscar e conectar; em
Ajustes → Bluetooth, buscar/parear/conectar/desconectar com A e esquecer com X.
Pareamento automático é limitado a dispositivos compatíveis com *Just Works*;
PIN/passkey interativos e roteamento de áudio para fones não são implementados.
**Busca, filtros, favoritos, assistente e teclado virtual** podem ser testados
sem ROM. A biblioteca agora traz ficha com ano, gênero, desenvolvedora e jogadores,
status (Jogando/Zerado/Quero zerar) e filtros por status, gênero e jogadores.
Use **Y** no card para abrir a ficha, **SELECT** para alternar o status e **A**
para percorrer filtros; os favoritos marcados na shell também chegam aos dados
locais do player. No teclado de testes: **Y**, **S** (SELECT), **Enter** (A),
**Esc** (B), **F** (X).

**Perfil:** abra **Sistema → Ajustes → Perfil**. Mostra nome, tempo
acumulado, sessões, jogos/consoles explorados, favoritos, mais jogados, atividade
(12 semanas) e 12 conquistas. Use **←/→** para alternar entre **Editar nome** e
**Avatar**; **Enter/A** abre o teclado ou a galeria de 20 avatares locais. Na
galeria, use o D-pad e **A** para escolher ou **B** para cancelar. No perfil,
**↑/↓** rola o conteúdo e **Esc/B** volta. Os números vêm do player no
armazenamento do convidado deste navegador, sem login; ficam vazios até jogar
(com uma ROM) ou marcar favoritos. O apelido e o avatar escolhidos são salvos no
formato que o player lê. O tempo é computado pelo player, não pela ficha da biblioteca.
O perfil não adiciona card à home. Não há controle virtual de teste na tela.

**Temas completos:** em **Sistema → Ajustes → Aparência**, escolha Vault Neon,
Órbita, Arcade Sunset ou Polar. As setas mostram uma prévia ao vivo; **A/Enter**
salva o tema e **B/Esc** sai, desfazendo apenas uma prévia não aplicada. A
preferência é local (`rvos:theme`) e acompanha a shell, assistente, fichas,
teclado e menus do player. O tema **não altera os pixels do jogo nem as capas**;
funciona offline e mantém o CRT removido. Teste também o tema claro em 480×320.

As camadas de scanlines e vinheta CRT foram removidas da shell. Para iniciar um jogo, adicione sua ROM em
`webroot/roms/<console>/<arquivo>` (dev), ou use o fallback remoto caso
esteja disponível. No aparelho as ROMs ficam em `/roms`.

A bridge por padrão aceita **somente loopback**; execução no PC:
`python3 firmware/rootfs/opt/retrovault/bridge.py --root webroot --port 8080`.
Não a exponha na LAN: mesmo com os POSTs administrativos restritos ao localhost,
o endpoint de status é destinado ao próprio aparelho.

Testes de regressão: `python3 -m unittest discover -s tests -v` e
`node tests/test_input.cjs`. Opcional (com Playwright instalado):
`node tests/smoke.cjs`, `node tests/visual_layout.cjs`,
`node tests/library_features.cjs`, `node tests/profile.cjs` e
`node tests/themes.cjs` contra a simulação servida na porta 8080. O teste de
temas cobre as quatro opções, prévia, cancelamento, player e persistência.
O teste do perfil cobre estado vazio e preenchido, galeria de avatares,
rolagem por controle, edição, persistência e dados inválidos.
Os testes visuais e de biblioteca cobrem 800×480 e 480×320,
inclusive assistente, teclado, Favoritos, Wi-Fi, Bluetooth e rolagem pelo
controle na ficha Sobre. Os testes de navegador exercitam a simulação: só o
Raspberry Pi com adaptadores pode validar pareamento/conexão reais.

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

- [x] Shell própria (assistente no primeiro uso → home → jogos) por botões
- [x] Projeto separado da web; player forkado com a lógica original
- [x] Bridge de hardware + kiosk + build de imagem
- [x] Assistente de primeiro boot (Wi-Fi, teste de botões, apelido; idioma ainda fixo em PT-BR)
- [x] Ficha do jogo na shell (dados de `fichas.js`), status e filtros por metadados
- [x] Perfil local na shell (tempo de jogo, atividade e conquistas do player convidado)
- [x] Quatro temas completos, seleção por controle e preferência compartilhada com o player
- [x] Pareamento Bluetooth pela bridge (Just Works; requer validação em aparelho)
- [ ] OTA assinado A/B

## Melhorias nesta versão

- Boot do firmware aponta para `webroot` e a bridge atende apenas loopback.
- Shell: START físico, navegação em Ajustes → Wi-Fi/Bluetooth, confirmação de
  energia e prazos adequados para varredura/conexão. Wi-Fi via `nmcli`,
  Bluetooth via BlueZ; a imagem instala/habilita `bluez`. Sem hardware, a bridge
  mostra indisponibilidade; somente o site estático usa simulação.
- Biblioteca: busca por teclado virtual, indicação da ROM no cartão (checagem
  HEAD), último save local, fichas de `js/fichas.js`, status locais compartilhados
  com o player e filtros de gênero/jogadores/status, inclusive em 480×320.
- Player local sem login/nuvem; menu por START+SELECT com saves/checkpoint/saída.
- Perfil em Ajustes lê os mesmos dados do player convidado, sem conta,
  inclui nome editável, galeria de 20 avatares, 12 semanas de atividade e conquistas persistidas.
- Quatro temas: Vault Neon, Órbita, Arcade Sunset e Polar, com prévia ao vivo,
  seleção por controle e aparência compartilhada com os menus do player.
- Cache do OS separado da versão web; ROMs, API e motor de emulação fora do SW.
- Removidos de vez a camada CRT (scanlines/vinheta), a opção em Ajustes e a
  antiga moldura CRT do player; preferências antigas não reativam o efeito.
  Os temas mantêm transições leves, com respeito a movimento reduzido.
- Foco visual com halo curto e expansão sutil nos cards, filtros, teclado e botões;
  evita cortar o brilho nas bordas das telas de 480×320 e 800×480.
- Removidos o splash de boot web e o gamepad virtual de teste da shell;
  no player OS, o pad virtual também fica desligado mesmo sem controle conectado.
  Mantidos o assistente de primeiro uso e o teclado virtual para entrada de texto.

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

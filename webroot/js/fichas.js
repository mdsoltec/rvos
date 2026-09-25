/* ═══════════════════════════════════════════════════════════
   RETROVAULT WEB — BASE DE FICHAS DOS JOGOS
   Fonte única de metadados. A chave é o nome EXATO do arquivo
   da ROM (padrão No-Intro), igual ao campo `file:` do catálogo
   e ao que aparece no href dos cards (play.html?game=...).
   O js/ficha-modal.js procura a ficha por essa chave.

   Campos:
     ano  – ano de lançamento (plataforma/edição)
     gen  – gênero (curto, pt-BR)
     dev  – desenvolvedora
     jog  – jogadores suportados
     desc – descrição nostálgica curta
     c:1  – marcador: dados de memória, vale conferir antes de divulgar
   ═══════════════════════════════════════════════════════════ */
window.RV_FICHAS = {

/* ── ATARI 2600 ──────────────────────────────────────────── */
"Pac-Man (USA).bin":
  { ano: 1982, gen: "Arcade", dev: "Atari", jog: 2, desc: "O fenômeno dos fliperamas no console — o jogo que fez o Atari vender milhões e virou febre no mundo inteiro." },
"Pitfall! (USA).bin":
  { ano: 1982, gen: "Plataforma", dev: "Activision", jog: 1, desc: "Pitfall Harry correndo pela selva — o jogo mais vendido do Atari e a aventura que definiu o gênero." },
"River Raid (USA).bin":
  { ano: 1982, gen: "Tiro", dev: "Activision", jog: 1, desc: "Sobrevoe o rio, desvie de pontes e reabasteça — um dos jogos mais amados do Atari no Brasil." },
"Enduro (USA).bin":
  { ano: 1983, gen: "Corrida", dev: "Activision", jog: 1, desc: "Corra do amanhecer ao anoitecer, desviando de carros na neve e na chuva — o endurance definitivo." },
"Space Invaders (USA).bin":
  { ano: 1980, gen: "Tiro Fixo", dev: "Atari", jog: 2, desc: "O jogo que quase quebrou o Japão chega ao console — a versão que fez o Atari 2600 decolar." },
"Adventure (USA).bin":
  { ano: 1979, gen: "Aventura", dev: "Atari", jog: 1, desc: "O primeiro jogo de aventura da história com dragão — e o primeiro easter egg já criado." },
"Yars' Revenge (USA).bin":
  { ano: 1982, gen: "Tiro", dev: "Atari", jog: 1, desc: "A obra-prima de Howard Scott Warshaw — o tiro mais bonito e estratégico do Atari." },
"Missile Command (USA).bin":
  { ano: 1980, gen: "Estratégia", dev: "Atari", jog: 2, desc: "Defenda suas cidades dos mísseis com o trackball — a tensão da Guerra Fria num cartucho." },
"Combat (USA).bin":
  { ano: 1977, gen: "Ação", dev: "Atari", jog: 2, desc: "O jogo que vinha de fábrica no console — tanques, aviões e o duelo de 2 jogadores que abria toda sessão." },
"Breakout (USA).bin":
  { ano: 1978, gen: "Quebra-cabeça", dev: "Atari", jog: 2, desc: "Quebre os tijolos com a raquete — o clássico de Arnie (sim, aquele) e Steve Jobs." },
"Frogger (USA).bin":
  { ano: 1982, gen: "Ação", dev: "Parker Brothers", jog: 2, desc: "Atravesse a rua e o rio com o sapo — timing perfeito e a trilha sonora mais grudenta do Atari." },
"Donkey Kong (USA).bin":
  { ano: 1982, gen: "Plataforma", dev: "Coleco", jog: 1, desc: "O gorila, a donzela e o encanador — a versão caseira do clássico da Nintendo." },
"Joust (USA).bin":
  { ano: 1982, gen: "Ação", dev: "Atari", jog: 2, desc: "Cavalgue avestruzes e lute no ar — o duelo de lanceiros mais divertido do Atari." },
"Defender (USA).bin":
  { ano: 1982, gen: "Tiro", dev: "Atari", jog: 1, desc: "Proteja os humanos dos alienígenas em um mundo que rola para os dois lados." },
"Berzerk (USA).bin":
  { ano: 1982, gen: "Tiro", dev: "Atari", jog: 1, desc: "Labirintos, robôs e o famoso 'Intruder Alert!' — um dos jogos mais tensos do console." },
"Keystone Kapers (USA).bin":
  { ano: 1983, gen: "Plataforma", dev: "Activision", jog: 1, desc: "O policial Kelly atrás do ladrão — escadas, roletas e muito humor." },
"Kaboom! (USA).bin":
  { ano: 1981, gen: "Quebra-cabeça", dev: "Activision", jog: 1, desc: "Pegue as bombas com os baldes — o jogo que exigia reflexos (e um controle de paddle)." },
"Galaxian (USA).bin":
  { ano: 1983, gen: "Tiro", dev: "Atari", jog: 1, desc: "Naves que mergulham em você — o clássico espacial em versão caseira." },
"Phoenix (USA).bin":
  { ano: 1982, gen: "Tiro", dev: "Amiga Corporation", jog: 1, desc: "A batalha final contra a nave-mãe — um dos tiros mais bonitos do Atari.", c: 1 },
"E.T. The Extra Terrestrial (USA).bin":
  { ano: 1982, gen: "Aventura", dev: "Atari", jog: 1, desc: "O jogo mais infame da história — causou o crash de 1983 e virou lenda (e os cartuchos, lenda enterrada no deserto). Jogue e forme sua opinião." },

/* ── NES ─────────────────────────────────────────────────── */
"Castlevania III - Dracula's Curse (USA).nes":
  { ano: 1989, gen: "Plataforma / Ação", dev: "Konami", jog: 1, desc: "O terceiro Castlevania: três caminhos possíveis, aliados recrutáveis e a trilha mais épica do NES." },
"Contra (USA).nes":
  { ano: 1987, gen: "Run 'n' Gun", dev: "Konami", jog: 2, desc: "Konami Code! O tiro em dupla mais clássico do NES — e o mais difícil também." },
"Duck Hunt (World).nes":
  { ano: 1984, gen: "Tiro ao Alvo", dev: "Nintendo", jog: 2, desc: "O pato mais caçado da história. Com a Zapper na mão, ninguém ficava parado." },
"Mega Man 2 (USA).nes":
  { ano: 1988, gen: "Ação / Plataforma", dev: "Capcom", jog: 1, desc: "O ápice da série clássica: 8 robôs mestres, a trilha inesquecível e a dificuldade lendária." },
"Super Mario Bros (World).nes":
  { ano: 1985, gen: "Plataforma", dev: "Nintendo", jog: 2, desc: "O jogo que salvou a indústria dos games e definiu o gênero plataforma para sempre." },
"Super Mario Bros 2 (PT-BR).nes":
  { ano: 1988, gen: "Plataforma", dev: "Nintendo", jog: 2, desc: "A versão brasileira do SMB2 — jogar de Luigi, Toad ou a Princesa era o charme." },
"Super Mario Bros 3 (PT-BR).nes":
  { ano: 1990, gen: "Plataforma", dev: "Nintendo", jog: 2, desc: "O auge do NES: mapa mundial, power-ups novos e o clássico dos tanques voadores." },
"Zelda II - The Adventure of Link (USA).nes":
  { ano: 1987, gen: "Ação / RPG", dev: "Nintendo", jog: 1, desc: "O Zelda diferente: side-scrolling, magias, RPG e o maior desafio da série." },

/* ── SNES ────────────────────────────────────────────────── */
"Aladdin (USA).sfc":
  { ano: 1993, gen: "Plataforma", dev: "Capcom", jog: 1, desc: "A magia da Disney em 16 bits — animação de cinema e a maçã mais famosa dos games." },
"Chrono Trigger (USA).sfc":
  { ano: 1995, gen: "RPG", dev: "Square", jog: 1, desc: "A jornada no tempo que redefiniu o RPG: 12 finais, combate sem batalhas aleatórias e a trilha de Yasunori Mitsuda." },
"D-Force (USA).sfc":
  { ano: 1991, gen: "Tiro / Veículo", dev: "Asmik Ace", jog: 1, desc: "Helicóptero de ataque em missões de resgate — simulação de combate aéreo com cara de SNES.", c: 1 },
"Donkey Kong Classic.smc":
  { ano: 1995, gen: "Plataforma", dev: "Rare", jog: 2, desc: "A coletânea com os dois primeiros Donkey Kong Country num cartucho só — o dobro de bananas." },
"Donkey Kong Country (USA) (Rev 2).sfc":
  { ano: 1994, gen: "Plataforma", dev: "Rare", jog: 2, desc: "Gráficos pré-renderizados que deixaram todo mundo de queixo caído em 1994." },
"Donkey Kong Country 2 - Diddy's Kong Quest (USA) (En,Fr) (Rev 1).sfc":
  { ano: 1995, gen: "Plataforma", dev: "Rare", jog: 2, desc: "Diddy e Dixie atrás do DK sequestrado — o auge da trilogia da Rare." },
"Donkey Kong Country 3 - Dixie Kong's Double Trouble! (USA) (En,Fr).sfc":
  { ano: 1996, gen: "Plataforma", dev: "Rare", jog: 2, desc: "Dixie e Kiddy exploram as Northern Kremisphere num mundo aberto de segredos." },
"Flintstones, The (USA) (En,Fr,De,Es,It).sfc":
  { ano: 1993, gen: "Plataforma", dev: "Ocean", jog: 1, desc: "Fred e Barney em aventura pré-histórica inspirada no desenho (e no filme).", c: 1 },
"Kirby's Dream Land 3 (U).smc":
  { ano: 1997, gen: "Plataforma", dev: "HAL Laboratory", jog: 2, desc: "Kirby em 16 bits com a arte mais fofa do SNES — e parceria com o Gooey." },
"Legend of Zelda, The - A Link to the Past (USA).sfc":
  { ano: 1991, gen: "Aventura", dev: "Nintendo", jog: 1, desc: "O elo entre os mundos: Light e Dark World, a Master Sword e uma obra-prima absoluta." },
"Lost Vikings 2 (USA).sfc":
  { ano: 1997, gen: "Quebra-cabeça", dev: "Blizzard", jog: 2, desc: "Erik, Baleog e Olaf voltam com novas habilidades — quebra-cabeças brilhantes." },
"Lost Vikings, The (USA).sfc":
  { ano: 1993, gen: "Quebra-cabeça", dev: "Silicon & Synapse", jog: 2, desc: "Três vikings, um objetivo: cada um com sua habilidade, antes da Blizzard ser Blizzard." },
"Mickey Mania - The Timeless Adventures of Mickey Mouse (USA).sfc":
  { ano: 1994, gen: "Plataforma", dev: "Traveller's Tales", jog: 1, desc: "Mickey atravessa 60 anos de história do rato — do Steamboat Willie ao 16 bits." },
"Mighty Morphin Power Rangers - The Fighting Edition (USA).sfc":
  { ano: 1995, gen: "Luta", dev: "Bandai", jog: 2, desc: "Os Rangers em modo luta — morfando no ringue. It's morphin' time!", c: 1 },
"Pilotwings (USA).sfc":
  { ano: 1990, gen: "Simulação", dev: "Nintendo EAD", jog: 1, desc: "O voo que apresentou o Mode 7 ao mundo — paraquedas, asa-delta e ultraleve." },
"Road Runner's Death Valley Rally (USA).sfc":
  { ano: 1992, gen: "Plataforma", dev: "Sunsoft", jog: 1, desc: "Corra, Road Runner! Beep beep — o Coiote nunca desiste." },
"Space Invaders (USA).sfc":
  { ano: 1991, gen: "Tiro Fixo", dev: "Taito", jog: 2, desc: "O clássico que começou tudo, em versão SNES com bônus e desafios." },
"Super Bomberman (USA).sfc":
  { ano: 1993, gen: "Ação / Estratégia", dev: "Hudson Soft", jog: 4, desc: "O multijogador que virou sinônimo de festa no SNES — 4 jogadores, 1 TV, 0 amizades." },
"Super Bomberman 4.smc":
  { ano: 1996, gen: "Ação / Estratégia", dev: "Hudson Soft", jog: 4, desc: "O quarto Bomberman de 16 bits, com o divertido Battle Mode de sempre.", c: 1 },
"Super Bomberman 5 Gold Cartridge (J) [!].smc":
  { ano: 1997, gen: "Ação / Estratégia", dev: "Hudson Soft", jog: 4, desc: "O derradeiro Bomberman do SNES — cartucho dourado e o melhor Battle Mode da era." },
"Super Mario All-Stars (USA) (Wii).sfc":
  { ano: 1993, gen: "Plataforma", dev: "Nintendo", jog: 2, desc: "Os quatro Super Mario Bros em um cartucho só, com gráficos repaginados." },
"Super Mario Kart (USA).sfc":
  { ano: 1992, gen: "Corrida", dev: "Nintendo EAD", jog: 2, desc: "O pai de todos os karts: cascas de banana, estrelas e a grama traiçoeira." },
"Super Mario RPG - Legend of the Seven Stars (USA).sfc":
  { ano: 1996, gen: "RPG", dev: "Square", jog: 1, desc: "Mario encontra o RPG — e Geno rouba a cena. Humor, timing e a trilha da Square." },
"Super Mario World (USA).sfc":
  { ano: 1990, gen: "Plataforma", dev: "Nintendo EAD", jog: 2, desc: "Yoshi estreia no melhor Mario 16 bits — 96 saídas e segredos por toda parte." },
"Super Mario World 2 - Yoshi's Island (USA) (Rev 1).sfc":
  { ano: 1995, gen: "Plataforma", dev: "Nintendo EAD", jog: 1, desc: "Arte de livro infantil e a fase final mais difícil da série. Yoshi carrega o bebê Mario." },
"Super Metroid (Japan, USA) (En,Ja).sfc":
  { ano: 1994, gen: "Aventura", dev: "Nintendo R&D1", jog: 1, desc: "A atmosfera que criou o gênero metroidvania — solidão, suspense e exploração perfeitas." },
"Super Tennis (USA).sfc":
  { ano: 1991, gen: "Esporte", dev: "Toho", jog: 2, desc: "Tênis direto ao ponto: jogabilidade sólida e o melhor multiplayer local do SNES.", c: 1 },
"Taz-Mania (USA).sfc":
  { ano: 1993, gen: "Plataforma", dev: "Sculptured Software", jog: 1, desc: "O demônio da Tasmânia girando pelos cenários do desenho.", c: 1 },
"Tiny Toon Adventures - Buster Busts Loose! (USA).sfc":
  { ano: 1992, gen: "Plataforma", dev: "Konami", jog: 1, desc: "Buster Bunny em 16 bits pela Konami — pulos no capô e muita molecagem." },
"Tiny Toon Adventures - Wild & Wacky Sports (Europe).sfc":
  { ano: 1994, gen: "Esporte", dev: "Konami", jog: 4, desc: "Olimpíadas malucas dos Tiny Toons — de cabo de guerra a corrida de saco.", c: 1 },
"Top Gear (USA).sfc":
  { ano: 1992, gen: "Corrida", dev: "Gremlin Graphics", jog: 2, desc: "A corrida lendária com trilha de rock — 3 voltas pelo mundo, nitro na largada." },
"Top Gear 2 (USA).sfc":
  { ano: 1993, gen: "Corrida", dev: "Gremlin Graphics", jog: 2, desc: "Mais pistas, mais carros, mais velocidade — a sequência que melhorou tudo." },
"Top Gear 3000 (USA).sfc":
  { ano: 1995, gen: "Corrida", dev: "Gremlin Graphics", jog: 2, desc: "O futuro da franquia no SNES — naves, turbos e o limite de 16 bits.", c: 1 },
"Ultimate Mortal Kombat 3 (USA).sfc":
  { ano: 1995, gen: "Luta", dev: "Midway", jog: 2, desc: "O melhor MK do SNES — elenco gigante, combos e fatalities (com código)." },
"Urban Strike (USA).sfc":
  { ano: 1994, gen: "Ação / Tiro", dev: "Granite Bay Software", jog: 1, desc: "O terceiro da série Strike: helicóptero de combate agora nas cidades dos EUA.", c: 1 },

/* ── GAME BOY ADVANCE ────────────────────────────────────── */
"Carros Disney.gba":
  { ano: 2006, gen: "Corrida", dev: "Helixe", jog: 1, desc: "Lightning McQueen na estrada para a Copa Pistão — baseado no filme da Pixar.", c: 1 },
"Castlevania - Aria of Sorrow (USA).gba":
  { ano: 2003, gen: "Ação / Aventura", dev: "Konami", jog: 1, desc: "Soma Cruz e o poder de absorver almas — um dos melhores Castlevanias portáteis." },
"Classic NES Series - Pac-Man (USA, Europe).gba":
  { ano: 2004, gen: "Arcade", dev: "Namco", jog: 1, desc: "O Pac-Man clássico no bolso, dentro da série NES Classics do GBA." },
"Legend of Zelda, The - The Minish Cap (USA).gba":
  { ano: 2004, gen: "Aventura", dev: "Capcom", jog: 1, desc: "Encolha com o Minish e explore Hyrule em miniatura — arte impecável da Capcom." },
"Mario Kart - Super Circuit (USA).gba":
  { ano: 2001, gen: "Corrida", dev: "Intelligent Systems", jog: 4, desc: "Kart de bolso com as pistas clássicas do SNES desbloqueáveis." },
"Metroid Fusion (USA).gba":
  { ano: 2002, gen: "Aventura", dev: "Nintendo R&D1", jog: 1, desc: "Samus contra o parasita X — o Metroid mais tenso e linear da série." },
"Pokemon - Emerald Version (USA, Europe).gba":
  { ano: 2004, gen: "RPG", dev: "Game Freak", jog: 1, desc: "A versão definitiva de Hoenn: Battle Frontier, dupla de vilões e Rayquaza." },
"Pokemon - FireRed Version (USA, Europe) (Rev 1).gba":
  { ano: 2004, gen: "RPG", dev: "Game Freak", jog: 1, desc: "O remake de Kanto que trouxe a primeira geração ao GBA — Sevii Islands incluídas." },
"Pokemon - LeafGreen Version (USA, Europe) (Rev 1).gba":
  { ano: 2004, gen: "RPG", dev: "Game Freak", jog: 1, desc: "Kanto de novo, agora colorido e com os recursos da terceira geração." },

/* ── GAME BOY COLOR ──────────────────────────────────────── */
"Legend of Zelda, The - Link's Awakening DX (USA, Europe) (Rev 2) (SGB Enhanced) (GB Compatible).gbc":
  { ano: 1998, gen: "Aventura", dev: "Nintendo", jog: 1, desc: "O sonho de Link ganha cor no Game Boy Color — e a fotografia secreta." },
"Pokemon - Gold Version (USA, Europe) (SGB Enhanced) (GB Compatible).gbc":
  { ano: 1999, gen: "RPG", dev: "Game Freak", jog: 1, desc: "Johto, o ciclo dia/noite e 250 Pokémon — a segunda geração que virou febre." },
"Pokemon - Silver Version (USA, Europe) (SGB Enhanced) (GB Compatible).gbc":
  { ano: 1999, gen: "RPG", dev: "Game Freak", jog: 1, desc: "O lado prata da segunda geração — Lugia esperando no fundo do mar." },
"Spider-Man (PT-BR).gbc":
  { ano: 2000, gen: "Ação / Plataforma", dev: "Vicarious Visions", jog: 1, desc: "O Homem-Aranha em 8 bits portátil — e esta versão é em português!", c: 1 },
"Super Mario Bros. Deluxe (USA, Europe) (Rev 2).gbc":
  { ano: 1999, gen: "Plataforma", dev: "Nintendo", jog: 1, desc: "SMB 1 e o Lost Levels no bolso, com desafios extras e o Mario no GBC." },
"Tetris DX (World) (SGB Enhanced) (GB Compatible).gbc":
  { ano: 1998, gen: "Quebra-cabeça", dev: "Nintendo", jog: 2, desc: "O Tetris definitivo do portátil: modos, cores e o viciante marathon." },
"Tom & Jerry (USA).gbc":
  { ano: 1999, gen: "Plataforma", dev: "Cryo Interactive", jog: 1, desc: "O gato e o rato mais famosos em pegadinhas portáteis.", c: 1 },
"Wario Land 3 (World) (En,Ja).gbc":
  { ano: 2000, gen: "Plataforma", dev: "Nintendo R&D1", jog: 1, desc: "O roubo mais lucrativo do Wario: mundo aberto, tesouros e ovo musical." },
"Wario Land II (USA, Europe) (SGB Enhanced) (GB Compatible).gbc":
  { ano: 1998, gen: "Plataforma", dev: "Nintendo R&D1", jog: 1, desc: "Wario é invencível — caia, exploda, atravesse paredes. E os capítulos secretos." },

/* ── NINTENDO 64 ─────────────────────────────────────────── */
"Banjo-Kazooie (USA) (Rev 1).z64":
  { ano: 1998, gen: "Plataforma 3D", dev: "Rare", jog: 1, desc: "O urso e o pássaro que desafiaram o Mario 64 — humor, jigsaws e a melhor bruxa dos games." },
"GoldenEye 007 (USA).z64":
  { ano: 1997, gen: "Tiro em 1ª Pessoa", dev: "Rare", jog: 4, desc: "O FPS que definiu o multijogador de sofá — 4 jogadores, um monitor e nenhuma trégua." },
"Legend of Zelda, The - Ocarina of Time (USA) (Rev 2).z64":
  { ano: 1998, gen: "Aventura", dev: "Nintendo EAD", jog: 1, desc: "O jogo mais aclamado de todos os tempos — Link, a ocarina e 7 anos de jornada." },
"Mario Kart 64 (USA).z64":
  { ano: 1996, gen: "Corrida", dev: "Nintendo EAD", jog: 4, desc: "Kart em 3D com quatro jogadores — a ponte de arco-íris mais temida dos games." },
"Super Mario 64 (USA).z64":
  { ano: 1996, gen: "Plataforma 3D", dev: "Nintendo EAD", jog: 1, desc: "O salto que levou o Mario — e os videogames — ao 3D. 120 estrelas te esperam." },
"Super Smash Bros. (USA).z64":
  { ano: 1999, gen: "Luta", dev: "HAL Laboratory", jog: 4, desc: "Nintendo All-Stars num ringue — o começo do fenômeno que virou lenda." },

/* ── PLAYSTATION ─────────────────────────────────────────── */
"Castlevania - Symphony of the Night (USA).chd":
  { ano: 1997, gen: "Ação / Aventura", dev: "Konami", jog: 1, desc: "O castelo invertido e o Metroidvania perfeito — 'What is a man? A miserable little pile of secrets!'" },
"Crash Bandicoot - Warped (USA).chd":
  { ano: 1998, gen: "Plataforma", dev: "Naughty Dog", jog: 1, desc: "Crash viaja no tempo — o auge da trilogia, com motos, jet ski e dinossauros." },
"Crash Bandicoot 2 - Cortex Strikes Back (USA).chd":
  { ano: 1997, gen: "Plataforma", dev: "Naughty Dog", jog: 1, desc: "A fórmula aperfeiçoada do marsupial — cristais, gemas e os polos." },
"Crash Team Racing (USA).chd":
  { ano: 1999, gen: "Corrida", dev: "Naughty Dog", jog: 4, desc: "O kart do Crash — o 'Mario Kart' do PlayStation, com drift e turbo na medida." },
"Dino Crisis (USA).chd":
  { ano: 1999, gen: "Survival Horror", dev: "Capcom", jog: 1, desc: "Resident Evil com dinossauros — mesma fórmula da Capcom, mais presas e menos zumbis." },
"Gran Turismo 2 (USA).chd":
  { ano: 1999, gen: "Simulação / Corrida", dev: "Polyphony Digital", jog: 2, desc: "Centenas de carros, licenças e a simulação que virou referência do gênero." },
"Metal Gear Solid (USA) (Disc 1).chd":
  { ano: 1998, gen: "Ação / Stealth", dev: "Konami", jog: 1, desc: "O stealth cinematográfico de Kojima que mudou o PS1 — e os games de espionagem." },
"Metal Slug X (USA).chd":
  { ano: 2000, gen: "Run 'n' Gun", dev: "SNK", jog: 2, desc: "O fliperama da SNK em CD — bala, humor, reféns e explodir absolutamente tudo." },
"Resident Evil 3 - Nemesis (USA).chd":
  { ano: 1999, gen: "Survival Horror", dev: "Capcom", jog: 1, desc: "Raccoon City em chamas e o Nemesis — que nunca, nunca para de te perseguir." },
"Tekken (USA).chd":
  { ano: 1995, gen: "Luta", dev: "Namco", jog: 2, desc: "O pioneiro dos lutadores 3D no PlayStation — Kazuya, Nina e o King." },
"Tekken 3 (USA).chd":
  { ano: 1998, gen: "Luta", dev: "Namco", jog: 2, desc: "O melhor lutador da geração 32 bits — Jin, Bryan e o modo Tekken Ball." },
"Tony Hawk's Pro Skater 2 (USA).chd":
  { ano: 2000, gen: "Esporte Radical", dev: "Neversoft", jog: 2, desc: "Skate, trilha sonora e manobras lendárias — o auge da franquia do Tony Hawk." },

/* ── MEGA DRIVE ──────────────────────────────────────────── */
"Aladdin (USA).md":
  { ano: 1993, gen: "Plataforma", dev: "Virgin Interactive", jog: 1, desc: "O Aladdin da Virgin: animação desenhada à mão e a maçã letal do Genio." },
"Altered Beast (USA, Europe).md":
  { ano: 1989, gen: "Beat 'em Up", dev: "Sega", jog: 2, desc: "'Rise from your grave!' — o clássico que acompanhava o Mega Drive de fábrica." },
"Felix - Detona Ralph.bin":
  { ano: 2012, gen: "Arcade / Plataforma", dev: "Disney", jog: 1, desc: "O fliperama do filme Detona Ralph, de verdade, no Mega Drive — conserte as janelas!", c: 1 },
"Golden Axe II (World).md":
  { ano: 1991, gen: "Beat 'em Up", dev: "Sega", jog: 2, desc: "Espada, magia e bárbaros — a sequência do clássico da Sega, com o Gillius." },
"Great Circus Mystery Starring Mickey & Minnie, The (USA).md":
  { ano: 1994, gen: "Plataforma", dev: "Capcom", jog: 2, desc: "Mickey e Minnie com poderes de herói — Disney × Capcom num dos melhores do Mega." },
"Kid Chameleon (USA, Europe).md":
  { ano: 1992, gen: "Plataforma", dev: "Sega", jog: 1, desc: "Dezenas de máscaras e mais de 100 fases: o camaleão com a maior variedade do Mega." },
"Mickey's Ultimate Challenge (USA).md":
  { ano: 1994, gen: "Quebra-cabeça", dev: "Hi Tech Expressions", jog: 1, desc: "Quebra-cabeças da Disney numa visita ao castelo do Mickey.", c: 1 },
"Shinobi III - Return of the Ninja Master (USA).md":
  { ano: 1993, gen: "Ação", dev: "Sega", jog: 1, desc: "O ninja definitivo do Mega Drive — cavalgadas, espadas e a melhor trilha da série." },
"Show do Milhao (Brazil).md":
  { ano: 2001, gen: "Quiz", dev: "Tec Toy", jog: 1, desc: "O quiz do Silvio Santos em português, no Mega Drive — 'essa é fácil!'.", c: 1 },
"Sonic & Knuckles + Sonic The Hedgehog 2 (World).md":
  { ano: 1994, gen: "Plataforma", dev: "Sega", jog: 2, desc: "Lock-on technology: Knuckles jogável dentro do Sonic 2! O truque mais genial da Sega." },
"Sonic Compilation ~ Sonic Classics (USA, Europe, Korea) (Rev A).md":
  { ano: 1995, gen: "Plataforma", dev: "Sega", jog: 2, desc: "Sonic 1, Sonic 2 e Dr. Robotnik's Mean Bean Machine num cartucho só." },
"Streets of Rage 2 (USA).md":
  { ano: 1992, gen: "Beat 'em Up", dev: "Sega", jog: 2, desc: "O melhor beat 'em up de 16 bits — socos, arremessos e uma trilha eletrônica lendária." },
"Top Gear 2 (USA).md":
  { ano: 1993, gen: "Corrida", dev: "Gremlin Graphics", jog: 2, desc: "Rally, nitro e a melhor trilha de corrida do Mega Drive — o Top Gear dos anos 90." },

/* ── SEGA CD ─────────────────────────────────────────────── */
"Sonic CD (USA).chd":
  { ano: 1993, gen: "Plataforma", dev: "Sega", jog: 1, desc: "Tempo, passado e futuro — Sonic CD é um clássico atemporal com trilha inesquecível." },
"Snatcher (USA).chd":
  { ano: 1994, gen: "Aventura Cinematográfica", dev: "Konami", jog: 1, desc: "O cyberpunk de Hideo Kojima em CD — investigação, distopia e história completa." },
"Lunar - The Silver Star (USA).chd":
  { ano: 1993, gen: "RPG", dev: "Game Arts", jog: 1, desc: "O RPG em CD que emocionou uma geração — anime, música redbook e o Alex." },
"Lunar 2 - Eternal Blue (USA).chd":
  { ano: 1995, gen: "RPG", dev: "Game Arts", jog: 1, desc: "A continuação de Lunar: Hiro e Lucia numa aventura que o tempo não apagou.", c: 1 },
"Popful Mail (USA).chd":
  { ano: 1994, gen: "Ação / RPG", dev: "Falcom", jog: 1, desc: "A caçadora de recompensas mais atrapalhada — plataforma com humor e magias." },
"Shining Force CD (USA).chd":
  { ano: 1994, gen: "RPG Tático", dev: "Sonic! Software Planning", jog: 1, desc: "Os dois primeiros Shining Force remasterizados em CD — estratégia em estado puro." },
"Ecco the Dolphin - CD (USA).chd":
  { ano: 1993, gen: "Aventura", dev: "Novotrade", jog: 1, desc: "Um golfinho contra a invasão alienígena — atmosfera única e mistério profundo." },
"Final Fight CD (USA).chd":
  { ano: 1993, gen: "Beat 'em Up", dev: "Capcom", jog: 2, desc: "O beat 'em up do arcade com trilha sonora em CD — Haggar, Cody e Guy." },

/* ── GAME GEAR ───────────────────────────────────────────── */
"Sonic The Hedgehog (World).gg":
  { ano: 1991, gen: "Plataforma", dev: "Ancient", jog: 1, desc: "Sonic 8 bits — compacto, mas veloz. O ouriço cabe no bolso." },
"Sonic The Hedgehog 2 (World).gg":
  { ano: 1992, gen: "Plataforma", dev: "Ancient", jog: 1, desc: "Spin dash! O melhor Sonic portátil da era 8 bits — com Tails." },
"Shinobi (World).gg":
  { ano: 1991, gen: "Ação", dev: "Sega", jog: 1, desc: "O ninja no telãozinho de 8 bits — shurikens, magias e honra." },
"Shinobi II - The Silent Fury (World).gg":
  { ano: 1993, gen: "Ação", dev: "Sega", jog: 1, desc: "A vingança de Shinobi no Game Gear — o melhor da série portátil." },
"Columns (World).gg":
  { ano: 1990, gen: "Quebra-cabeça", dev: "Sega", jog: 2, desc: "O Tetris com joias — alinhe cores e combos num puzzle viciante da Sega." },
"Wonder Boy - The Dragon's Trap (USA, Europe).gg":
  { ano: 1989, gen: "Aventura / Plataforma", dev: "Westone", jog: 1, desc: "Vire um dragão (e outras formas) explorando a ilha amaldiçoada." },
"Land of Illusion Starring Mickey Mouse (World).gg":
  { ano: 1992, gen: "Plataforma", dev: "Sega", jog: 1, desc: "Mickey em uma das melhores aventuras do Game Gear — magia e segredos." },

/* ── MASTER SYSTEM ───────────────────────────────────────── */
"Alex Kidd in Miracle World (USA, Europe, Brazil) (En) (Rev 1).sms":
  { ano: 1986, gen: "Plataforma", dev: "Sega", jog: 1, desc: "O jogo que veio de fábrica no Master System brasileiro — Alex, o Janken e o vilão Janken the Great." },
"Alex Kidd in Shinobi World (USA, Europe, Brazil) (En).sms":
  { ano: 1990, gen: "Plataforma", dev: "Sega", jog: 1, desc: "Alex Kidd veste o uniforme de ninja — uma paródia de Shinobi com golpes de espada e muita ação." },
"Sonic The Hedgehog (USA, Europe, Brazil) (En).sms":
  { ano: 1991, gen: "Plataforma", dev: "Ancient", jog: 1, desc: "A versão 8 bits do ouriço: fases diferentes das do Mega Drive, mas a mesma velocidade." },
"Sonic The Hedgehog 2 (Europe, Brazil) (En) (Rev 1).sms":
  { ano: 1992, gen: "Plataforma", dev: "Ancient", jog: 1, desc: "O spin dash estreia no 8 bits — com Tails em algumas fases. O melhor Sonic do Master System." },
"Wonder Boy III - The Dragon's Trap (World) (Digital) (Unl).sms":
  { ano: 1989, gen: "Aventura / Plataforma", dev: "Westone", jog: 1, desc: "Vire um dragão, piranha, leão e mais — o metroidvania que é considerado um dos maiores do Master." },
"Wonder Boy in Monster Land (USA, Europe).sms":
  { ano: 1988, gen: "Ação / RPG", dev: "Westone", jog: 1, desc: "O Wonder Boy com elementos de RPG: dinheiro, lojas, armas e chefes. Pioneiro do gênero." },
"Phantasy Star (Brazil).sms":
  { ano: 1987, gen: "RPG", dev: "Sega", jog: 1, desc: "O RPG que desafiou Final Fantasy — a jovem Alis em busca de vingança no planeta Algol, com dungeons em 3D." },
"Golden Axe (USA, Europe, Brazil) (En).sms":
  { ano: 1989, gen: "Beat 'em Up", dev: "Sega", jog: 2, desc: "Bárbaros, magia e gnômulos — o clássico da Sega em 8 bits, com 2 jogadores." },
"OutRun (World).sms":
  { ano: 1987, gen: "Corrida", dev: "Sega", jog: 1, desc: "A Ferrari Testarossa na estrada, com a trilha inesquecível de Hiroshi Kawaguchi — escolha seu caminho." },
"After Burner (World).sms":
  { ano: 1987, gen: "Ação / Voo", dev: "Sega", jog: 1, desc: "Combate aéreo supersônico — caças, mísseis e a sensação de velocidade do fliperama." },
"Double Dragon (World).sms":
  { ano: 1988, gen: "Beat 'em Up", dev: "Sega", jog: 2, desc: "Billy e Jimmy resgatando a Marian — socos, chutes e barras de ferro no 8 bits." },
"California Games (USA, Europe, Brazil) (En).sms":
  { ano: 1988, gen: "Esporte", dev: "Epyx", jog: 2, desc: "Surfe, skate, footbag, BMX e mais — o esporte radical da Epyx no Master System." },
"Castle of Illusion Starring Mickey Mouse (USA, Europe, Brazil) (En) (Rev 1).sms":
  { ano: 1991, gen: "Plataforma", dev: "Sega", jog: 1, desc: "Mickey em busca da Minnie pelo castelo — um dos plataformas mais caprichados do 8 bits." },
"Psycho Fox (USA, Europe, Brazil) (En).sms":
  { ano: 1989, gen: "Plataforma", dev: "Sega", jog: 1, desc: "A raposa que vira tigre e macaco — um dos plataformas mais criativos do Master System." },
"Fantasy Zone (World) (Rev 1).sms":
  { ano: 1986, gen: "Tiro", dev: "Sega", jog: 1, desc: "Opa-Opa, o caça redondinho, num tiro colorido e alegre — 'Welcome to the Fantasy Zone!'" },
"Kung Fu Kid (USA, Europe, Brazil) (En).sms":
  { ano: 1987, gen: "Ação", dev: "Sega", jog: 1, desc: "Do monge ao mestre — o beat 'em up de artes marciais do 8 bits da Sega." },
"R-Type (World).sms":
  { ano: 1988, gen: "Tiro", dev: "Irem", jog: 1, desc: "O shmup brutal da Irem — o orb Force e a dificuldade lendária." },
"Space Harrier 3-D (USA, Europe, Brazil) (En).sms":
  { ano: 1988, gen: "Tiro", dev: "Sega", jog: 1, desc: "O Fantasy Zone em profundidade — feita para os óculos 3-D da Sega, com o mesmo voo arrojado de sempre.", c: 1 },
"Shinobi (USA, Europe, Brazil) (En) (Rev 1).sms":
  { ano: 1988, gen: "Ação", dev: "Sega", jog: 1, desc: "Joe Musashi em missão — shurikens, magias e reféns para salvar." },
"Mortal Kombat (Europe, Brazil) (En).sms":
  { ano: 1993, gen: "Luta", dev: "Probe / Acclaim", jog: 2, desc: "A versão 8 bits do fenômeno — capada, mas com os golpes e o Scorpion." },

/* ── NINTENDO DS ─────────────────────────────────────────── */
"New Super Mario Bros (USA).nds":
  { ano: 2006, gen: "Plataforma", dev: "Nintendo", jog: 2, desc: "O Mario 2D voltou — e o DS vendeu milhões com ele. Mega Mushroom incluído." },
"Mario Kart DS (USA).nds":
  { ano: 2005, gen: "Corrida", dev: "Nintendo", jog: 8, desc: "Kart portátil com pistas de todas as eras e o mítico modo missão." },
"Pokemon - HeartGold Version (USA).nds":
  { ano: 2009, gen: "RPG", dev: "Game Freak", jog: 1, desc: "Johto em duas telas — o remake mais amado da série, com seu Pokémon na Pokéwalker." },
"Legend of Zelda, The - Phantom Hourglass (USA).nds":
  { ano: 2007, gen: "Aventura", dev: "Nintendo", jog: 1, desc: "A continuação direta de Wind Waker — controle por toque na tela de baixo." },
"Castlevania - Dawn of Sorrow (USA).nds":
  { ano: 2005, gen: "Ação / Aventura", dev: "Konami", jog: 1, desc: "A continuação de Aria of Sorrow no DS — almas, selos mágicos e o castelo de novo." },
"Grand Theft Auto - Chinatown Wars (USA).nds":
  { ano: 2009, gen: "Ação / Mundo Aberto", dev: "Rockstar Leeds", jog: 1, desc: "GTA de verdade no DS — top-down, brutal e com tráfico de drogas no estilo cartoon." },
"Tony Hawk's American Sk8land (USA).nds":
  { ano: 2005, gen: "Esporte Radical", dev: "Vicarious Visions", jog: 4, desc: "Tony Hawk no DS com visual cel-shaded — manobras na tela de toque." },
"Contra 4 (USA).nds":
  { ano: 2007, gen: "Run 'n' Gun", dev: "WayForward", jog: 2, desc: "Contra em duas telas — duro, lindo e insano. O retorno digno da série." },
"Chrono Trigger (USA).nds":
  { ano: 2008, gen: "RPG", dev: "Square Enix", jog: 1, desc: "O clássico atemporal com telas duplas, dungeons extras e o novo final." },
"Tetris DS (USA).nds":
  { ano: 2006, gen: "Quebra-cabeça", dev: "Nintendo", jog: 8, desc: "Tetris com temas de clássicos Nintendo — e o modo multiplayer de 8 jogadores." },

/* ── ARCADE (FBNeo) ──────────────────────────────────────── */
"garou.zip":
  { ano: 1999, gen: "Luta", dev: "SNK", jog: 2, desc: "Garou: Mark of the Wolves — o canto do cisne da Fatal Fury, com arte e jogabilidade impecáveis." },
"kof97.zip":
  { ano: 1997, gen: "Luta", dev: "SNK", jog: 2, desc: "O KOF mais famoso do Brasil — os arcades lotavam com o time de Iori, Kyo e Benimaru." },
"kof98.zip":
  { ano: 1998, gen: "Luta", dev: "SNK", jog: 2, desc: "The Slugfest: o sonho nunca acaba — elenco gigante e o equilíbrio perfeito da série." },
"kof2002.zip":
  { ano: 2002, gen: "Luta", dev: "SNK", jog: 2, desc: "Máximo impacto: o retorno à era de ouro com o MAX mode e os combos infinitos." },
"mslug.zip":
  { ano: 1996, gen: "Run 'n' Gun", dev: "Nazca", jog: 2, desc: "Metal Slug — o run 'n' gun mais bonito e engraçado dos fliperamas. Heavy Machine Gun!" },
"mvsc.zip":
  { ano: 1998, gen: "Luta", dev: "Capcom", jog: 2, desc: "Marvel vs. Capcom: heróis contra o universo Capcom — tags, assistências e combos insanos." },
"rbffspec.zip":
  { ano: 1997, gen: "Luta", dev: "SNK", jog: 2, desc: "Real Bout Fatal Fury Special — ring-out, combos aéreos e o RBFF definitivo." },
"samsho2.zip":
  { ano: 1994, gen: "Luta", dev: "SNK", jog: 2, desc: "Samurai Shodown II — espadas, honra e a arte mais bonita da série Samurai." },
"sfa3.zip":
  { ano: 1998, gen: "Luta", dev: "Capcom", jog: 2, desc: "Street Fighter Alpha 3 — três estilos de luta e o elenco mais completo do Alpha." },
"vsav.zip":
  { ano: 1997, gen: "Luta", dev: "Capcom", jog: 2, desc: "Vampire Savior — Darkstalkers com o Dark Force: monstros da Capcom em luta frenética." },

/* ── ATARI 2600 · NOVOS ─────────────────────────────────── */
"Asteroids (USA).bin":
  { ano: 1979, gen: "Tiro", dev: "Atari", jog: 2, desc: "O asteroide clássico dos fliperamas — desvie, atire e sobreviva no espaço." },
"Centipede (USA).bin":
  { ano: 1982, gen: "Tiro Fixo", dev: "Atari", jog: 2, desc: "A centopeia que serpenteia pelos cogumelos — um dos arcades mais vendidos da história." },
"Q-bert (USA).bin":
  { ano: 1982, gen: "Quebra-cabeça", dev: "Gottlieb", jog: 1, desc: "O cubo roxo que pula nos degraus — o personagem mais icônico do começo dos anos 80." },
"Dig Dug (USA).bin":
  { ano: 1982, gen: "Ação", dev: "Namco", jog: 2, desc: "Cave túneis, encha os inimigos de ar e fuja dos dragões — clássico do arcade." },
"Demon Attack (USA).bin":
  { ano: 1982, gen: "Tiro", dev: "Imagic", jog: 2, desc: "Um dos tiros mais vendidos do Atari — demônios em formação, com gráficos impressionantes." },
"Warlords (USA).bin":
  { ano: 1980, gen: "Ação", dev: "Atari", jog: 4, desc: "O melhor multiplayer do Atari: 4 jogadores, 4 castelos e uma bola de fogo traiçoeira." },
"Bowling (USA).bin":
  { ano: 1978, gen: "Esporte", dev: "Atari", jog: 2, desc: "Um dos jogos de lançamento do console — boliche simples, direto e viciante." },
"Freeway (USA).bin":
  { ano: 1981, gen: "Ação", dev: "Activision", jog: 2, desc: "Atravesse a rodovia com seus frangos — a febre da Activision no Brasil." },
"Cosmic Ark (USA).bin":
  { ano: 1982, gen: "Tiro", dev: "Imagic", jog: 1, desc: "Defenda sua nave e colete criaturas alienígenas — a atmosfera espacial da Imagic." },
"Frostbite (USA).bin":
  { ano: 1983, gen: "Plataforma", dev: "Activision", jog: 1, desc: "O urso que pula nos blocos de gelo para construir um iglu — genial e viciante." },
"Seaquest (USA).bin":
  { ano: 1982, gen: "Tiro", dev: "Activision", jog: 1, desc: "Resgate mergulhadores no fundo do mar enquanto o oxigênio acaba." },
"Mario Bros. (USA).bin":
  { ano: 1983, gen: "Plataforma", dev: "Atari", jog: 2, desc: "O Mario antes do Mario World — encanadores batendo nas tartarugas pelos canos." },
"Popeye (USA).bin":
  { ano: 1983, gen: "Plataforma", dev: "Parker Brothers", jog: 2, desc: "O marinheiro mais famoso dos games — apanhe o espinafre e salve a Olívia." },
"Carnival (USA).bin":
  { ano: 1982, gen: "Tiro", dev: "Coleco", jog: 2, desc: "Tiro no parque de diversões — acerte os patos e ganhe o prêmio." },
"Atlantis (USA).bin":
  { ano: 1982, gen: "Tiro", dev: "Imagic", jog: 1, desc: "Defenda a cidade submersa dos invasores — a tensão de um bombardeio iminente." },
"Haunted House (USA).bin":
  { ano: 1982, gen: "Aventura", dev: "Atari", jog: 1, desc: "A casa mal-assombrada com atmosfera única — ache as peças da urna no escuro." },

/* ── MASTER SYSTEM · NOVOS ───────────────────────────────── */
"Sonic Chaos (Europe, Brazil) (En).sms":
  { ano: 1993, gen: "Plataforma", dev: "Sega", jog: 1, desc: "O Sonic 8 bits mais veloz — spin dash e as Esmeraldas do Caos. O melhor ouriço do Master." },
"Golden Axe Warrior (USA, Europe, Brazil) (En).sms":
  { ano: 1991, gen: "Ação / RPG", dev: "Sega", jog: 1, desc: "O 'Zelda do Master System' — espada, magia e um mundo para explorar. Tesouro escondido." },
"Wonder Boy in Monster World (Europe).sms":
  { ano: 1991, gen: "Aventura / Plataforma", dev: "Westone", jog: 1, desc: "A continuação do Dragon's Trap — o melhor da série no Master, com o Genie." },
"Hang On (Europe).sms":
  { ano: 1987, gen: "Corrida", dev: "Sega", jog: 1, desc: "O clássico de moto que vinha com o console — curva, acelera e não cai." },
"Alex Kidd - The Lost Stars (World).sms":
  { ano: 1988, gen: "Plataforma", dev: "Sega", jog: 1, desc: "Alex Kidd em busca das estrelas perdidas — mais rápido e variado que o original." },
"Batman Returns (Europe, Brazil) (En).sms":
  { ano: 1992, gen: "Ação / Plataforma", dev: "Sega", jog: 1, desc: "O Batman do filme de 92 — o Pinguim toma Gotham e a Mulher-Gato cruza o caminho do morcego em ação 8 bits.", c: 1 },
"Asterix (Europe, Brazil) (En,Fr) (Rev 1).sms":
  { ano: 1991, gen: "Plataforma", dev: "Sega", jog: 1, desc: "O gaulês mais famoso — pule, bata e colete menires pelos cenários da Gália." },
"Operation Wolf (Europe, Brazil) (En).sms":
  { ano: 1989, gen: "Tiro", dev: "Taito", jog: 1, desc: "O comando de elite contra a guerrilha — o rail shooter do fliperama no Master." },
"E-SWAT (USA, Europe, Brazil) (En).sms":
  { ano: 1990, gen: "Ação", dev: "Sega", jog: 1, desc: "O policial ciborgue em missão — run 'n' gun com direito a jetpack nas fases finais." },
"Power Strike (USA, Europe, Brazil) (En).sms":
  { ano: 1988, gen: "Tiro", dev: "Compile", jog: 1, desc: "O melhor shooter do Master System — naves, power-ups e dificuldade justa." },
"Master of Darkness (Europe, Brazil) (En).sms":
  { ano: 1993, gen: "Ação / Aventura", dev: "Sega", jog: 1, desc: "O 'Castlevania do Master' — Dr. Feud e sua horda de vampiros na Londres vitoriana." },
"Michael Jackson's Moonwalker (USA, Europe, Brazil) (En).sms":
  { ano: 1990, gen: "Plataforma", dev: "Sega", jog: 1, desc: "O Rei do Pop em 8 bits — resgate as crianças, use a magia e dance para vencer." },
"Mortal Kombat II (Europe, Brazil) (En).sms":
  { ano: 1994, gen: "Luta", dev: "Acclaim", jog: 2, desc: "Shao Kahn manda no torneio — novos lutadores, fatalities e o fenômeno do fliperama rodando em 8 bits.", c: 1 },
"Mortal Kombat 3 (Brazil) (En).sms":
  { ano: 1995, gen: "Luta", dev: "Tec Toy", jog: 2, desc: "A Tec Toy trouxe o MK3 até para o Master — quase um exclusivo brasileiro, com os novos lutadores e os fatalities de sempre.", c: 1 },

};

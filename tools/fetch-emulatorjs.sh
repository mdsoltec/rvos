#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════
# RetroVault OS — baixa o EmulatorJS 4.2.3 para rodar OFFLINE
#
# O player tenta webroot/vendor/emulatorjs/loader.js ANTES do CDN.
# Rode UMA vez (com internet) e o console fica 100% independente:
#
#   ./tools/fetch-emulatorjs.sh
#
# Estratégia: clona o repositório oficial (que contém o data/ com o
# loader, o runtime e os cores) e copia para vendor/emulatorjs/.
# Se o layout do repo mudar, cai para o download direto do CDN.
# ═══════════════════════════════════════════════════════════════════
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
DEST="$(dirname "$HERE")/webroot/vendor/emulatorjs"
VER="4.2.3"
TMP="ejs-tmp-$$"
trap 'rm -rf "$TMP"' EXIT

echo ">> alvo: $DEST"
mkdir -p "$DEST"

if git clone --depth 1 --branch "$VER" https://github.com/EmulatorJS/EmulatorJS.git "$TMP" 2>/dev/null; then
  if [ -f "$TMP/data/loader.js" ]; then
    cp -r "$TMP/data/." "$DEST/"
    echo "✔ EmulatorJS $VER copiado do repositório oficial ($(du -sh "$DEST" | cut -f1))"
    exit 0
  fi
  echo "!! layout do repo sem data/ pronto; tentando CDN…"
fi

# ── fallback: CDN, arquivos essenciais + cores usados pelo catálogo ──
CDN="https://cdn.emulatorjs.org/$VER/data"
CORES="snes9x fceumm mgba gambatte mupen64plus_next pcsx_rearmed genesis_plus_gx melonds stella2014 fbneo mednafen_psx parallel_n64"
fetch() { curl -fsSL "$1" -o "$2" 2>/dev/null && echo "  ✔ $(basename "$2")" || { rm -f "$2"; echo "  ✖ falhou: $1"; }; }

fetch "$CDN/loader.js" "$DEST/loader.js" || true
fetch "$CDN/version.json" "$DEST/version.json" || true
fetch "$CDN/emulator.min.js" "$DEST/emulator.min.js" || true
fetch "$CDN/emulator.min.css" "$DEST/emulator.min.css" || true
mkdir -p "$DEST/cores"
for c in $CORES; do
  fetch "$CDN/cores/$c.js" "$DEST/cores/$c.js" || true
  fetch "$CDN/cores/$c-wasm.data" "$DEST/cores/$c-wasm.data" || true
  fetch "$CDN/cores/$c-thread-wasm.data" "$DEST/cores/$c-thread-wasm.data" || true
done

[ -f "$DEST/loader.js" ] && echo "✔ base do EmulatorJS baixada (verifique a lista de ✖ acima; cores que faltam caem no CDN em tempo de jogo)" \
  || { echo "✖ não consegui baixar nada — verifique a internet"; exit 1; }

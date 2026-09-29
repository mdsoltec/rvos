#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════
# RetroVault OS — sincroniza os DADOS compartilhados do RetroVault WEB
#
# O catálogo, as capas e os assets visuais têm UM dono: o repositório
# web. Este script importa de lá (o OS nunca edita esses dados).
#
#   ./tools/sync-from-web.sh             copia real (usar antes do build da imagem)
#   ./tools/sync-from-web.sh --dev       symlinks locais p/ desenvolvimento/preview
#   RETROVAULT_WEB=/caminho/retrovault ./tools/sync-from-web.sh
# ═══════════════════════════════════════════════════════════════════
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(dirname "$HERE")"
WEB_SRC="${RETROVAULT_WEB:-$(dirname "$ROOT")/retrovault}/public"
DEV=0
[ "${1:-}" = "--dev" ] && DEV=1

[ -f "$WEB_SRC/js/catalog.js" ] || { echo "✖ não achei o catálogo em $WEB_SRC (defina RETROVAULT_WEB)"; exit 1; }
[ -f "$WEB_SRC/js/fichas.js" ] || { echo "✖ não achei as fichas em $WEB_SRC/js/fichas.js"; exit 1; }
echo ">> fonte: $WEB_SRC"

link_or_copy() { # link_or_copy <origem> <destino>
  local src="$1" dst="$2"
  rm -rf "$dst"
  if [ "$DEV" = 1 ]; then
    ln -sfn "$(realpath --relative-to="$(dirname "$dst")" "$src")" "$dst"
  else
    cp -rL "$src" "$dst"
  fi
}

link_or_copy "$WEB_SRC/covers"   "$ROOT/webroot/covers"
link_or_copy "$WEB_SRC/assets"   "$ROOT/webroot/assets"
link_or_copy "$WEB_SRC/cheats"   "$ROOT/webroot/cheats"
link_or_copy "$WEB_SRC/js/catalog.js" "$ROOT/webroot/js/catalog.js"
link_or_copy "$WEB_SRC/js/fichas.js"  "$ROOT/webroot/js/fichas.js"

# overlays (controles virtuais de toque) NÃO entram no console: 92 MB e
# servem só para celular. Se quiser mesmo assim: --overlays
if [ "${1:-}" = "--overlays" ] || [ "${2:-}" = "--overlays" ]; then
  link_or_copy "$WEB_SRC/overlays" "$ROOT/webroot/overlays"
fi

echo "✔ dados sincronizados ($([ "$DEV" = 1 ] && echo symlinks || echo cópia real))"

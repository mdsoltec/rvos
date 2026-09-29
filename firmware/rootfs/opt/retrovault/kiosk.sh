#!/bin/sh
# ═══════════════════════════════════════════════════════════════════
# RetroVault OS — lançador do kiosk (Chromium em tela cheia)
# Rodado dentro do 'cage' (Wayland) pela unidade retrovault-shell.service
# ═══════════════════════════════════════════════════════════════════

URL="http://127.0.0.1/"

# Espera a bridge (site + API) ficar de pé
i=0
while [ $i -lt 60 ]; do
  if curl -fsS -o /dev/null "http://127.0.0.1/api/status" 2>/dev/null; then break; fi
  i=$((i + 1)); sleep 0.5
done

CHROME=$(command -v chromium || command -v chromium-browser)
[ -z "$CHROME" ] && { echo "chromium não encontrado"; exit 1; }

# Desliga o descanso de tela do console
export WLR_DRM_NO_ATOMIC=1

exec "$CHROME" \
  --kiosk "$URL" \
  --ozone-platform=wayland \
  --no-sandbox \
  --load-extension=/opt/retrovault/webroot/extension/return-home \
  --disable-extensions-except=/opt/retrovault/webroot/extension/return-home \
  --no-first-run --no-default-browser-check \
  --noerrdialogs --disable-infobars --disable-session-crashed-bubble \
  --disable-features=TranslateUI,InterestFeedContentSuggestions \
  --autoplay-policy=no-user-gesture-required \
  --disable-pinch --overscroll-history-navigation=0 \
  --hide-scrollbars --force-device-scale-factor=1 \
  --check-for-update-interval=31536000 \
  --disk-cache-dir=/tmp/rv-cache --disk-cache-size=268435456 \
  --enable-unsafe-swiftshader

#!/usr/bin/env python3
# ═══════════════════════════════════════════════════════════════════
# RetroVault OS — "bridge": servidor do site + API de hardware
#
# Um único processo Python (stdlib, sem dependências) que:
#   1. serve o front estático (public/) em http://0.0.0.0:80
#   2. responde /api/* para a shell controlar o aparelho:
#      GET  /api/status          → rede, bateria, volume, brilho, ip
#      GET  /api/wifi/scan       → redes visíveis (NetworkManager)
#      POST /api/wifi/connect    → {ssid, psk}
#      POST /api/volume          → {value: 0..100}
#      POST /api/brightness      → {value: 10..100}
#      POST /api/system          → {action: "shutdown"|"reboot"}
#
# O play.html procura ROMs em roms/ — basta um symlink
#   /opt/retrovault/webroot/roms → /roms (cartão/partição de dados)
# ═══════════════════════════════════════════════════════════════════

import argparse
import glob
import json
import os
import re
import socket
import subprocess
import threading
import time
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse
import ipaddress

VERSION = "1.0.0"
START = time.time()

# ───────────────────────── helpers de sistema ─────────────────────────


def sh(cmd, timeout=8):
    """Roda comando e devolve stdout (string), nunca levanta exceção."""
    try:
        out = subprocess.run(cmd, shell=True, capture_output=True,
                             text=True, timeout=timeout)
        return out.stdout.strip()
    except Exception:
        return ""


def read_first(pattern):
    for p in glob.glob(pattern):
        try:
            with open(p) as f:
                return f.read().strip(), p
        except Exception:
            pass
    return None, None


def get_wifi_status():
    ssid = sh("nmcli -t -f ACTIVE,SSID dev wifi 2>/dev/null | grep '^sim:' | cut -d: -f2-")
    if not ssid:
        # nmcli em inglês/português varia: tenta via iwgetid
        ssid = sh("iwgetid -r 2>/dev/null")
    sig = sh("nmcli -t -f IN-USE,SIGNAL dev wifi 2>/dev/null | grep '^\\*' | cut -d: -f2")
    return {
        "connected": bool(ssid),
        "ssid": ssid or None,
        "signal": int(sig) if sig.isdigit() else None,
    }


def get_battery():
    for cap in glob.glob("/sys/class/power_supply/*/capacity"):
        base = os.path.dirname(cap)
        try:
            with open(os.path.join(base, "type")) as f:
                if f.read().strip().lower() != "battery":
                    continue
            with open(cap) as f:
                pct = int(f.read().strip())
            status = ""
            st_path = os.path.join(base, "status")
            if os.path.exists(st_path):
                with open(st_path) as f:
                    status = f.read().strip().lower()
            return {"percent": pct, "charging": status == "charging", "status": status}
        except Exception:
            continue
    return None


def backlight():
    val, path = read_first("/sys/class/backlight/*/brightness")
    if not path:
        return None, None, None
    maxv, _ = read_first(os.path.join(os.path.dirname(path), "max_brightness"))
    try:
        return int(val), int(maxv or 255), path
    except Exception:
        return None, None, path


def get_brightness():
    cur, maxv, _ = backlight()
    if cur is None or not maxv:
        return 100
    return max(10, min(100, round(cur * 100 / maxv)))


def set_brightness(pct):
    _, maxv, path = backlight()
    if not path or not maxv:
        return False
    pct = max(10, min(100, int(pct)))
    try:
        with open(path, "w") as f:
            f.write(str(round(maxv * pct / 100)))
        return True
    except Exception:
        return False


def get_volume():
    out = sh("amixer -M sget Master 2>/dev/null | grep -o '\\[.*%\\]' | head -1")
    if not out:
        out = sh("amixer -M sget PCM 2>/dev/null | grep -o '\\[.*%\\]' | head -1")
    m = re.search(r"\[(\d+)%\]", out or "")
    return int(m.group(1)) if m else 70


def set_volume(pct):
    pct = max(0, min(100, int(pct)))
    ok = False
    for channel in ("Master", "PCM"):
        try:
            result = subprocess.run(["amixer", "-q", "-M", "sset", channel, f"{pct}%"],
                                    capture_output=True, timeout=5)
            ok = ok or result.returncode == 0
        except (OSError, subprocess.TimeoutExpired):
            pass
    return ok


def get_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return sh("hostname -I | awk '{print $1}'") or "—"


def wifi_scan():
    sh("nmcli dev wifi rescan 2>/dev/null", timeout=10)
    time.sleep(0.8)
    out = sh("nmcli -t -f IN-USE,SSID,SIGNAL,SECURITY dev wifi list 2>/dev/null", timeout=15)
    nets, seen = [], set()
    for line in out.splitlines():
        parts = line.split(":")
        if len(parts) < 4:
            continue
        inuse, ssid, sig, sec = parts[0], parts[1], parts[2], ":".join(parts[3:])
        if not ssid or ssid in seen:
            continue
        seen.add(ssid)
        nets.append({
            "ssid": ssid,
            "signal": int(sig) if sig.isdigit() else 0,
            "secure": sec not in ("", "--"),
            "connected": inuse == "*",
        })
    return nets


def wifi_connect(ssid, psk):
    cmd = "nmcli dev wifi connect %s" % shell_quote(ssid)
    if psk:
        cmd += " password %s" % shell_quote(psk)
    out = sh(cmd, timeout=40)
    ok = ("successfully activated" in out) or (get_wifi_status().get("ssid") == ssid)
    return ok, out


def shell_quote(s):
    return "'" + str(s).replace("'", "'\\''") + "'"


# ───────────────────────── servidor HTTP ─────────────────────────


class Handler(SimpleHTTPRequestHandler):
    root = "/opt/retrovault/webroot"
    scan_cache = {"t": 0, "nets": None}

    def __init__(self, *a, **kw):
        super().__init__(*a, directory=self.root, **kw)

    # ---------- API ----------
    def _json(self, obj, code=200):
        data = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(data)

    def _body(self):
        try:
            n = int(self.headers.get("Content-Length") or 0)
            if n < 0 or n > 4096:
                raise ValueError("payload inválido")
            raw = self.rfile.read(n) if n else b"{}"
            return json.loads(raw.decode() or "{}")
        except Exception:
            return {}

    def do_GET(self):
        if self.path.startswith("/api/") and not self._local_request():
            return self._json({"ok": False, "error": "acesso local obrigatório"}, 403)
        if self.path == "/api/status":
            return self._json({
                "ok": True,
                "version": VERSION,
                "uptime": int(time.time() - START),
                "wifi": get_wifi_status(),
                "battery": get_battery(),
                "volume": get_volume(),
                "brightness": get_brightness(),
                "ip": get_ip(),
            })
        if self.path == "/api/wifi/scan":
            if time.time() - self.scan_cache["t"] < 5 and self.scan_cache["nets"] is not None:
                return self._json({"ok": True, "networks": self.scan_cache["nets"]})
            try:
                nets = wifi_scan()
                self.scan_cache.update({"t": time.time(), "nets": nets})
                return self._json({"ok": True, "networks": nets})
            except Exception as e:
                return self._json({"ok": False, "error": str(e), "networks": []}, 500)
        return super().do_GET()  # arquivos estáticos (site)

    def _local_request(self):
        # API administrativa apenas no próprio aparelho, inclusive em --host 0.0.0.0.
        try:
            if not ipaddress.ip_address(self.client_address[0]).is_loopback:
                return False
        except ValueError:
            return False
        origin = self.headers.get("Origin")
        if origin:
            parsed = urlparse(origin)
            try:
                port = parsed.port or 80
            except ValueError:
                return False
            if parsed.scheme != "http" or parsed.hostname not in ("127.0.0.1", "localhost") or port != self.server.server_port:
                return False
        return True

    def do_POST(self):
        if not self._local_request():
            return self._json({"ok": False, "error": "acesso local obrigatório"}, 403)
        if self.headers.get("Content-Type", "").split(";", 1)[0].strip() != "application/json":
            return self._json({"ok": False, "error": "Content-Type deve ser application/json"}, 415)
        body = self._body()
        if not isinstance(body, dict):
            return self._json({"ok": False, "error": "JSON inválido"}, 400)
        try:
            if self.path in ("/api/volume", "/api/brightness"):
                value = int(body["value"])
                if not 0 <= value <= 100:
                    raise ValueError("faixa inválida")
            elif self.path == "/api/wifi/connect":
                if not isinstance(body.get("ssid"), str) or not 1 <= len(body["ssid"]) <= 32 or not isinstance(body.get("psk", ""), str) or len(body["psk"]) > 63:
                    raise ValueError("credenciais inválidas")
        except (ValueError, TypeError, KeyError):
            return self._json({"ok": False, "error": "parâmetros inválidos"}, 400)
        if self.path == "/api/volume":
            ok = set_volume(value)
            return self._json({"ok": ok, "value": get_volume()}, 200 if ok else 500)
        if self.path == "/api/brightness":
            ok = set_brightness(value)
            return self._json({"ok": ok, "value": get_brightness()}, 200 if ok else 500)
        if self.path == "/api/wifi/connect":
            ok, out = wifi_connect(body.get("ssid", ""), body.get("psk", ""))
            return self._json({"ok": ok, "detail": out[-400:]}, 200 if ok else 500)
        if self.path == "/api/system":
            act = body.get("action")
            if act in ("shutdown", "reboot"):
                self._json({"ok": True})
                time.sleep(0.4)
                sh("systemctl poweroff" if act == "shutdown" else "systemctl reboot")
                return
            return self._json({"ok": False, "error": "ação inválida"}, 400)
        return self._json({"ok": False, "error": "rota desconhecida"}, 404)

    # ---------- estáticos: cache amigável + log enxuto ----------
    def end_headers(self):
        if not self.path.startswith("/api/"):
            if self.path.endswith(("/", ".html")):
                self.send_header("Cache-Control", "no-cache")
            else:
                self.send_header("Cache-Control", "public, max-age=900")
        super().end_headers()

    def log_message(self, fmt, *args):
        if "/api/" in (self.path or ""):
            super().log_message(fmt, *args)


def main():
    ap = argparse.ArgumentParser(description="RetroVault OS bridge")
    ap.add_argument("--root", default="/opt/retrovault/webroot")
    ap.add_argument("--port", type=int, default=80)
    ap.add_argument("--host", default="127.0.0.1", help="endereço da interface HTTP; em produção use loopback")
    args = ap.parse_args()

    Handler.root = args.root
    srv = ThreadingHTTPServer((args.host, args.port), Handler)
    print(f"[retrovault-bridge] v{VERSION} servindo {args.root} em {args.host}:{args.port}")
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()

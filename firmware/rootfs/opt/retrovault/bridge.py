#!/usr/bin/env python3
# ═══════════════════════════════════════════════════════════════════
# RetroVault OS — "bridge": servidor do site + API de hardware
#
# Um único processo Python (stdlib, sem dependências) que:
#   1. serve o front estático (webroot/) em http://127.0.0.1:80
#   2. responde /api/* para a shell controlar o aparelho:
#      GET  /api/status          → rede, bateria, volume, brilho, ip
#      GET  /api/wifi/scan       → redes visíveis (NetworkManager)
#      POST /api/wifi/connect    → {ssid, psk}
#      GET  /api/bluetooth/status|scan → adaptador e dispositivos (BlueZ)
#      POST /api/bluetooth/action → {address, action: pair|connect|disconnect|remove}
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
import shutil

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


def run_argv(argv, timeout=10):
    """Comandos sem shell (nunca interpolar SSID, senha ou endereço)."""
    try:
        p = subprocess.run(argv, capture_output=True, text=True, timeout=timeout,
                           env={**os.environ, "LC_ALL": "C"})
        return p.returncode, p.stdout.strip(), p.stderr.strip()
    except (OSError, subprocess.TimeoutExpired):
        return 124, "", "indisponível ou tempo esgotado"


def nmcli_fields(line):
    """Campos -t do nmcli escapam dois-pontos e barras; split(':') quebra SSID."""
    fields, field, escaped = [], [], False
    for ch in line:
        if escaped:
            field.append(ch)
            escaped = False
        elif ch == "\\":
            escaped = True
        elif ch == ":":
            fields.append("".join(field))
            field = []
        else:
            field.append(ch)
    if escaped:
        field.append("\\")
    fields.append("".join(field))
    return fields


def wifi_adapters():
    code, text, _ = run_argv(["nmcli", "-t", "-f", "DEVICE,TYPE", "device", "status"])
    if code:
        return []
    return [parts[0] for line in text.splitlines()
            if (parts := nmcli_fields(line))[1:2] == ["wifi"]]


def get_wifi_status():
    adapters = wifi_adapters()
    code, radio, _ = run_argv(["nmcli", "radio", "wifi"])
    enabled = code == 0 and radio.strip().lower() == "enabled"
    code, out, _ = run_argv(["nmcli", "-t", "-f", "IN-USE,SSID,SIGNAL", "device", "wifi", "list"])
    for line in out.splitlines() if code == 0 else []:
        parts = nmcli_fields(line)
        if len(parts) >= 3 and parts[0] == "*":
            return {"connected": True, "ssid": parts[1], "signal": int(parts[2]) if parts[2].isdigit() else None,
                    "available": bool(adapters), "enabled": enabled}
    return {"connected": False, "ssid": None, "signal": None,
            "available": bool(adapters), "enabled": enabled}


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
    if not wifi_adapters():
        raise RuntimeError("Adaptador Wi-Fi ou NetworkManager indisponível")
    if not get_wifi_status()["enabled"]:
        raise RuntimeError("Wi-Fi desligado no sistema")
    # A falha de rescan não impede devolver a lista já conhecida pelo NM.
    run_argv(["nmcli", "device", "wifi", "rescan"], timeout=10)
    code, out, _ = run_argv(["nmcli", "-t", "-f", "IN-USE,SSID,SIGNAL,SECURITY", "device", "wifi", "list"], timeout=15)
    if code:
        raise RuntimeError("Falha ao buscar redes Wi-Fi")
    nets = {}
    for line in out.splitlines():
        parts = nmcli_fields(line)
        if len(parts) != 4:
            continue
        inuse, ssid, sig, sec = parts
        if not ssid:
            continue
        network = {"ssid": ssid, "signal": int(sig) if sig.isdigit() else 0,
                   "secure": sec not in ("", "--"), "connected": inuse == "*"}
        if ssid not in nets or network["connected"] or network["signal"] > nets[ssid]["signal"]:
            nets[ssid] = network
    return sorted(nets.values(), key=lambda n: (not n["connected"], -n["signal"]))


def wifi_connect(ssid, psk):
    argv = ["nmcli", "--wait", "40", "device", "wifi", "connect", ssid]
    if psk:
        argv.extend(["password", psk])
    code, _, _ = run_argv(argv, timeout=45)
    # Evita expor mensagens do nmcli que podem incluir SSID/credenciais.
    ok = code == 0 and get_wifi_status().get("ssid") == ssid
    return ok, "Conectado" if ok else "Não foi possível conectar. Verifique a senha, o sinal e o adaptador."


BT_ADDRESS = re.compile(r"^[0-9A-Fa-f]{2}(?::[0-9A-Fa-f]{2}){5}$")


def bt_exec(*args, timeout=10):
    argv = ["bluetoothctl", "--timeout", str(timeout)]
    if args and args[0] == "pair":
        # Just Works: sem aceitar PIN na web. Controles com código exigem agente dedicado.
        argv.append("--agent=NoInputNoOutput")
    return run_argv([*argv, *args], timeout=timeout + 3)


def bluetooth_status(include_devices=True):
    if not shutil.which("bluetoothctl"):
        return {"available": False, "powered": False, "devices": []}
    code, out, _ = bt_exec("show")
    if code or "No default controller" in out or not re.search(r"^Controller\s", out, re.M):
        return {"available": False, "powered": False, "devices": []}
    powered = bool(re.search(r"^\s*Powered:\s*yes", out, re.M | re.I))
    return {"available": True, "powered": powered,
            "devices": bluetooth_devices() if powered and include_devices else []}


def bluetooth_devices():
    code, out, _ = bt_exec("devices")
    if code:
        return []
    devices = []
    for line in out.splitlines():
        match = re.match(r"^Device\s+([0-9A-Fa-f:]{17})\s+(.+)$", line)
        if not match or not BT_ADDRESS.fullmatch(match.group(1)):
            continue
        address, name = match.groups()
        _, info, _ = bt_exec("info", address, timeout=3)
        devices.append({"address": address.upper(), "name": name[:80],
                        "paired": bool(re.search(r"^\s*Paired:\s*yes", info, re.M | re.I)),
                        "connected": bool(re.search(r"^\s*Connected:\s*yes", info, re.M | re.I))})
        if len(devices) >= 12:  # evita bloquear a UI quando há muitos aparelhos próximos
            break
    return sorted(devices, key=lambda d: (not d["connected"], not d["paired"], d["name"].lower()))


def bluetooth_scan():
    status = bluetooth_status(include_devices=False)
    if not status["available"]:
        raise RuntimeError("Adaptador Bluetooth ou BlueZ indisponível")
    if not status["powered"]:
        code, _, _ = bt_exec("power", "on")
        if code:
            raise RuntimeError("Não foi possível ligar o Bluetooth")
    code, _, _ = bt_exec("scan", "on", timeout=9)
    if code:
        raise RuntimeError("Falha ao buscar dispositivos Bluetooth")
    return bluetooth_status()


def bluetooth_action(address, action):
    if not BT_ADDRESS.fullmatch(address):
        return False, "Endereço Bluetooth inválido"
    address = address.upper()
    status = bluetooth_status()
    if not status["available"] or not status["powered"]:
        return False, "Adaptador Bluetooth indisponível"
    if address not in {d["address"] for d in status["devices"]}:
        return False, "Dispositivo não encontrado. Atualize a busca."
    if action == "pair":
        code, _, _ = bt_exec("pair", address, timeout=30)
        _, info, _ = bt_exec("info", address)
        if code or not re.search(r"^\s*Paired:\s*yes", info, re.M | re.I):
            return False, "Pareamento falhou. Ative o modo de pareamento e tente novamente."
        bt_exec("trust", address)
        code, _, _ = bt_exec("connect", address, timeout=20)
        if code:
            return False, "Pareado, mas não conectado. Tente conectar novamente."
    else:
        command = {"connect": "connect", "disconnect": "disconnect", "remove": "remove"}.get(action)
        if not command:
            return False, "Ação inválida"
        code, _, _ = bt_exec(command, address, timeout=20)
        if code:
            return False, "Não foi possível completar a ação Bluetooth"
    if action in ("pair", "connect", "disconnect", "remove"):
        _, info, _ = bt_exec("info", address)
        if action in ("pair", "connect") and not re.search(r"^\s*Connected:\s*yes", info, re.M | re.I):
            return False, "Dispositivo não conectado. Verifique se está ligado e próximo."
        if action == "disconnect" and re.search(r"^\s*Connected:\s*yes", info, re.M | re.I):
            return False, "Dispositivo ainda conectado. Tente novamente."
        if action == "remove" and re.search(r"^\s*Paired:\s*yes", info, re.M | re.I):
            return False, "Pareamento ainda ativo. Tente novamente."
    return True, "Concluído"


# ───────────────────────── servidor HTTP ─────────────────────────


class Handler(SimpleHTTPRequestHandler):
    root = "/opt/retrovault/webroot"
    scan_cache = {"t": 0, "nets": None}
    bt_lock = threading.Lock()

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
            except RuntimeError as e:
                return self._json({"ok": False, "error": str(e), "networks": []}, 503)
        if self.path == "/api/bluetooth/status":
            return self._json({"ok": True, **bluetooth_status()})
        if self.path == "/api/bluetooth/scan":
            if not self.bt_lock.acquire(blocking=False):
                return self._json({"ok": False, "error": "Busca Bluetooth em andamento"}, 409)
            try:
                return self._json({"ok": True, **bluetooth_scan()})
            except RuntimeError as e:
                return self._json({"ok": False, "error": str(e)}, 503)
            finally:
                self.bt_lock.release()
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
                ssid, psk = body.get("ssid"), body.get("psk", "")
                if (not isinstance(ssid, str) or not 1 <= len(ssid.encode("utf-8")) <= 32
                        or any(ord(c) < 32 for c in ssid) or not isinstance(psk, str)
                        or len(psk) > 63 or any(ord(c) < 32 for c in psk)):
                    raise ValueError("credenciais inválidas")
            elif self.path == "/api/bluetooth/action":
                if (body.get("action") not in ("pair", "connect", "disconnect", "remove")
                        or not isinstance(body.get("address"), str)
                        or not BT_ADDRESS.fullmatch(body["address"])):
                    raise ValueError("ação ou endereço Bluetooth inválido")
        except (ValueError, TypeError, KeyError):
            return self._json({"ok": False, "error": "parâmetros inválidos"}, 400)
        if self.path == "/api/volume":
            ok = set_volume(value)
            return self._json({"ok": ok, "value": get_volume()}, 200 if ok else 500)
        if self.path == "/api/brightness":
            ok = set_brightness(value)
            return self._json({"ok": ok, "value": get_brightness()}, 200 if ok else 500)
        if self.path == "/api/wifi/connect":
            ok, detail = wifi_connect(body["ssid"], body.get("psk", ""))
            if ok:
                self.scan_cache.update({"t": 0, "nets": None})
            return self._json({"ok": ok, "detail": detail}, 200 if ok else 503)
        if self.path == "/api/bluetooth/action":
            if not self.bt_lock.acquire(blocking=False):
                return self._json({"ok": False, "error": "Bluetooth ocupado. Tente novamente."}, 409)
            try:
                ok, detail = bluetooth_action(body["address"], body["action"])
                return self._json({"ok": ok, "detail": detail}, 200 if ok else 503)
            finally:
                self.bt_lock.release()
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

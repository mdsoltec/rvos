"""Teste local da bridge sem acessar hardware. python3 -m unittest discover -s tests"""
import importlib.util
import json
from pathlib import Path
import tempfile
import threading
import unittest
from http.server import ThreadingHTTPServer
from unittest.mock import patch
from urllib.error import HTTPError
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("rvos_bridge", ROOT / "firmware/rootfs/opt/retrovault/bridge.py")
bridge = importlib.util.module_from_spec(spec)
spec.loader.exec_module(bridge)


class BridgeTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.dir = tempfile.TemporaryDirectory()
        Path(cls.dir.name, "index.html").write_text("RVOS OK")
        bridge.Handler.root = cls.dir.name
        cls.server = ThreadingHTTPServer(("127.0.0.1", 0), bridge.Handler)
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()
        cls.base = f"http://127.0.0.1:{cls.server.server_port}"

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.dir.cleanup()

    def request(self, path, body=None, origin=None, content_type="application/json"):
        headers = {"Content-Type": content_type}
        if origin:
            headers["Origin"] = origin
        req = Request(self.base + path, data=json.dumps(body).encode() if body is not None else None, headers=headers)
        try:
            with urlopen(req, timeout=5) as res:
                return res.status, res.read()
        except HTTPError as err:
            return err.code, err.read()

    def test_static_root_matches_systemd(self):
        unit = (ROOT / "firmware/rootfs/etc/systemd/system/retrovault-bridge.service").read_text()
        self.assertIn("--root /opt/retrovault/webroot", unit)
        self.assertIn("--host 127.0.0.1", unit)
        self.assertEqual(self.request("/")[1], b"RVOS OK")

    def test_power_rejects_other_origins_and_content_types(self):
        bad = self.request("/api/system", {"action": "shutdown"}, origin="http://example.org")
        self.assertEqual(bad[0], 403)
        bad = self.request("/api/system", {"action": "shutdown"}, content_type="text/plain")
        self.assertEqual(bad[0], 415)
        bad = self.request("/api/system", {"action": "invalid"})
        self.assertEqual(bad[0], 400)

    def test_valid_requests_and_validation(self):
        with patch.object(bridge, "set_volume", return_value=True), patch.object(bridge, "get_volume", return_value=45):
            status, body = self.request("/api/volume", {"value": 45}, origin=self.base)
            self.assertEqual(status, 200)
            self.assertEqual(json.loads(body)["value"], 45)
            self.assertEqual(self.request("/api/volume", {"value": "xyz"})[0], 400)
        with patch.object(bridge, "wifi_connect", return_value=(True, "ok")):
            self.assertEqual(self.request("/api/wifi/connect", {"ssid": "rede", "psk": "segredo"})[0], 200)
            self.assertEqual(self.request("/api/wifi/connect", {"ssid": ""})[0], 400)

    def test_remote_ip_cannot_modify_hardware(self):
        handler = object.__new__(bridge.Handler)
        handler.client_address = ("192.168.0.21", 1234)
        self.assertFalse(handler._local_request())


if __name__ == "__main__":
    unittest.main()

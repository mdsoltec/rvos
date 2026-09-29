"""Gerenciador: raízes permitidas e cópia/exclusão seguras, sem hardware."""
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch
import json
import unittest

from test_bridge import BridgeTests, bridge


class FilesOnlyTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        BridgeTests.setUpClass()
        cls.bridge_test = BridgeTests()

    @classmethod
    def tearDownClass(cls):
        BridgeTests.tearDownClass()

    def request(self, path, body=None, origin=None):
        return self.bridge_test.request(path, body, origin)

    def test_roms_usb_copy_delete_and_confinement(self):
        with TemporaryDirectory() as tmp:
            base = Path(tmp)
            roms, usb, forbidden = base / 'roms', base / 'usb', base / 'private'
            for folder in [roms, usb, forbidden]: folder.mkdir()
            (usb / 'snes').mkdir()
            (roms / 'snes').mkdir()
            (usb / 'snes' / 'Demo.sfc').write_bytes(b'ROM test')
            (forbidden / 'secret.txt').write_text('NÃO PODE LER')
            (usb / 'shortcut').symlink_to(forbidden, target_is_directory=True)
            (usb / 'snes' / 'leak').symlink_to(forbidden / 'secret.txt')
            with patch.object(bridge, 'file_roots', return_value={'roms': str(roms), 'usb:sda1': str(usb)}):
                status, payload = self.request('/api/files/roots')
                self.assertEqual(status, 200)
                self.assertEqual(len(json.loads(payload)['roots']), 2)
                self.assertEqual(self.request('/api/files/action', {'action':'mkdir','root':'roms','path':'','name':'gba'})[0], 200)
                self.assertTrue((roms / 'gba').is_dir())
                self.assertEqual(self.request('/api/files/action', {'action':'mkdir','root':'roms','path':'','name':'../private'})[0], 400)
                self.assertEqual(self.request('/api/files/action', {'action':'mkdir','root':'usb:sda1','path':'shortcut','name':'escape'})[0], 400)
                status, payload = self.request('/api/files/list?root=usb%3Asda1&path=snes')
                self.assertEqual(status, 200)
                self.assertEqual([e['name'] for e in json.loads(payload)['entries']], ['Demo.sfc'])
                for path in ('..', '../private', '/etc', 'shortcut', 'snes/../../private', 'snes//'):
                    status, _ = self.request('/api/files/list?root=usb%3Asda1&path=' + path.replace('/', '%2F'))
                    self.assertEqual(status, 400, path)
                payload = {'action': 'copy', 'root': 'usb:sda1', 'path': 'snes/Demo.sfc', 'destinationRoot': 'roms', 'destination': 'snes'}
                self.assertEqual(self.request('/api/files/action', payload)[0], 200)
                self.assertEqual((roms / 'snes' / 'Demo.sfc').read_bytes(), b'ROM test')
                # O endpoint estático do player também não pode seguir symlinks para o SO.
                (roms / 'snes' / 'leak').symlink_to(forbidden / 'secret.txt')
                static_link = Path(bridge.Handler.root, 'outside')
                static_link.symlink_to(forbidden, target_is_directory=True)
                try:
                    with patch.object(bridge.Handler, 'roms_root', str(roms)):
                        self.assertEqual(self.request('/roms/snes/Demo.sfc'), (200, b'ROM test'))
                        self.assertEqual(self.request('/roms/snes/leak')[0], 404)
                        self.assertEqual(self.request('/outside/secret.txt')[0], 403)
                finally:
                    static_link.unlink()
                self.assertEqual(self.request('/api/files/action', payload)[0], 409)  # não sobrescreve
                self.assertEqual(self.request('/api/files/action', {'action':'copy', 'root':'usb:sda1', 'path':'snes/leak', 'destinationRoot':'roms', 'destination':'snes'})[0], 400)
                self.assertEqual(self.request('/api/files/action', {'action':'delete', 'root':'usb:sda1', 'path':'snes'})[0], 400)
                self.assertEqual(self.request('/api/files/action', {'action':'delete', 'root':'roms', 'path':'snes/Demo.sfc'}, origin='https://evil.test')[0], 403)
                self.assertEqual(self.request('/api/files/action', {'action':'delete', 'root':'roms', 'path':'snes/Demo.sfc'})[0], 200)
                self.assertFalse((roms / 'snes' / 'Demo.sfc').exists())
                self.assertTrue((forbidden / 'secret.txt').exists())

if __name__ == '__main__': unittest.main()

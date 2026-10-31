"""Pruebas HTTP de pagos con un proceso propio y sin tocar la demo abierta."""
import concurrent.futures
import json
from pathlib import Path
import socket
import subprocess
import sys
import tempfile
import time
import unittest
from urllib.error import HTTPError
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]


class PagosHTTP(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp = tempfile.TemporaryDirectory()
        cls.addClassCleanup(cls.temp.cleanup)
        cls.start_service()
        cls.addClassCleanup(cls.stop_service)

    @classmethod
    def start_service(cls):
        with socket.socket() as sock:
            sock.bind(('127.0.0.1', 0))
            port = sock.getsockname()[1]
        cls.url = f'http://127.0.0.1:{port}'
        cls.log = open(Path(cls.temp.name) / 'uvicorn.log', 'w+')
        cls.process = subprocess.Popen(
            [sys.executable, '-m', 'uvicorn', 'main:app', '--app-dir',
             str(ROOT / 'ms-pagos'), '--host', '127.0.0.1', '--port', str(port)],
            cwd=cls.temp.name, stdout=cls.log, stderr=subprocess.STDOUT,
        )
        deadline = time.monotonic() + 10
        while time.monotonic() < deadline:
            if cls.process.poll() is not None:
                break
            try:
                if cls.request('GET', '/pagos/health')[0] == 200:
                    return
            except OSError:
                time.sleep(0.05)
        cls.stop_service()
        raise RuntimeError('No arranco pagos. Revisar dependencias y permiso para abrir localhost.')

    @classmethod
    def stop_service(cls):
        if cls.process.poll() is None:
            cls.process.terminate()
            try:
                cls.process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                cls.process.kill()
                cls.process.wait(timeout=5)
        cls.log.close()

    @classmethod
    def request(cls, method, path, body=None):
        data = json.dumps(body).encode() if body is not None else None
        req = Request(cls.url + path, data=data, method=method,
                      headers={'Content-Type': 'application/json'})
        try:
            response = urlopen(req, timeout=2)
        except HTTPError as error:
            response = error
        with response:
            return response.status, json.load(response)

    def pay(self, reserva, **extra):
        body = dict(reserva_id=reserva, cliente_nombre='Cliente de prueba',
                    monto=80, metodo_pago='Yape')
        return self.request('POST', '/pagos/procesar', {**body, **extra})

    def test_health(self):
        code, body = self.request('GET', '/pagos/health')
        self.assertEqual(code, 200)
        self.assertEqual(body['service'], 'ms-pagos')
        self.assertEqual(body['almacenamiento'], 'memoria')

    def test_aprobacion_consultas_historial(self):
        code, pago = self.pay(101)
        self.assertEqual(code, 200)
        self.assertEqual(pago['estado'], 'APROBADO')
        self.assertEqual(self.request('GET', '/pagos/' + pago['transaccion_id']), (200, pago))
        self.assertEqual(self.request('GET', '/pagos/reserva/101'), (200, pago))
        code, historial = self.request('GET', '/pagos/')
        self.assertEqual(code, 200)
        self.assertEqual(historial['total'], len(historial['transacciones']))
        self.assertIn(pago, historial['transacciones'])

    def test_rechazo_y_reintento(self):
        code, pago = self.pay(102, simulacion_resultado='forzar_rechazado')
        self.assertEqual(code, 200)
        self.assertEqual(pago['estado'], 'RECHAZADO')
        code, ultimo = self.pay(102, simulacion_resultado='forzar_aprobado')
        self.assertEqual(code, 200)
        self.assertEqual(ultimo['estado'], 'APROBADO')
        self.assertNotEqual(ultimo['transaccion_id'], pago['transaccion_id'])
        self.assertEqual(self.request('GET', '/pagos/reserva/102'), (200, ultimo))

    def test_limite_automatico(self):
        self.assertEqual(self.pay(103, monto=1001)[1]['estado'], 'RECHAZADO')
        self.assertEqual(self.pay(104, monto=1000)[1]['estado'], 'APROBADO')

    def test_monto_no_positivo(self):
        for monto in [0, -10]:
            with self.subTest(monto=monto):
                self.assertEqual(self.pay(105, monto=monto)[0], 400)

    def test_datos_invalidos(self):
        for extra in [dict(cliente_nombre=''), dict(cliente_nombre='   '),
                      dict(reserva_id=0), dict(reserva_id=-1),
                      dict(metodo_pago='Otro'), dict(simulacion_resultado='otro'),
                      dict(monto='NaN'), dict(monto='Infinity')]:
            with self.subTest(extra=extra):
                self.assertEqual(self.pay(106, **extra)[0], 422)

    def test_consultas_inexistentes(self):
        self.assertEqual(self.request('GET', '/pagos/no-existe')[0], 404)
        self.assertEqual(self.request('GET', '/pagos/reserva/999999')[0], 404)

    def test_no_duplica_aprobado(self):
        self.assertEqual(self.pay(107)[0], 200)
        self.assertEqual(self.pay(107)[0], 409)

    def test_pagos_simultaneos_misma_reserva(self):
        with concurrent.futures.ThreadPoolExecutor(max_workers=4) as executor:
            respuestas = list(executor.map(lambda _: self.pay(108)[0], range(4)))
        self.assertEqual(sorted(respuestas), [200, 409, 409, 409])

    def test_z_reinicio_borra_historial(self):
        self.assertEqual(self.pay(109)[0], 200)
        self.stop_service()
        self.start_service()
        self.assertEqual(self.request('GET', '/pagos/')[1]['total'], 0)
        self.assertEqual(self.request('GET', '/pagos/reserva/109')[0], 404)


if __name__ == '__main__':
    unittest.main(verbosity=2)

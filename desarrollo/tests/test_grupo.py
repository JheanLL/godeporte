"""Contratos funcionales del grupo: requieren los servicios reales iniciados.

Ver CONTRATOS.md. Se agregan registros ficticios a SQLite.
"""
import json
from datetime import date, timedelta
import time
import unittest
from urllib.error import HTTPError
from urllib.request import Request, urlopen
from uuid import uuid4


def request(port, method, path, body=None):
    data = json.dumps(body).encode() if body is not None else None
    req = Request(f'http://127.0.0.1:{port}' + path, method=method, data=data,
                  headers={'Content-Type': 'application/json'})
    try:
        response = urlopen(req, timeout=6)
    except HTTPError as error:
        response = error
    with response:
        return response.status, json.load(response)


class ContratosGrupo(unittest.TestCase):
    def crear_cancha(self):
        nombre = 'Cancha prueba ' + uuid4().hex[:8]
        code, cancha = request(8002, 'POST', '/canchas/', dict(nombre=nombre, tarifa=80))
        self.assertEqual(code, 201, cancha)
        self.assertGreater(cancha['id'], 0)
        self.assertEqual(cancha['nombre'], nombre)
        self.assertEqual(cancha['tarifa'], 80)
        return cancha

    def test_canchas_crear_y_listar(self):
        cancha = self.crear_cancha()
        code, lista = request(8002, 'GET', '/canchas/')
        self.assertEqual(code, 200)
        self.assertIsInstance(lista, list)
        self.assertIn(cancha, lista)

    def test_auth_registro_login_y_clave_incorrecta(self):
        correo = uuid4().hex + '@example.test'
        registro = dict(nombre='Prueba', correo=correo, password='clave-de-prueba')
        code, usuario = request(8004, 'POST', '/auth/registro', registro)
        self.assertEqual(code, 201, usuario)
        self.assertGreater(usuario['usuario_id'], 0)
        self.assertNotIn('password', usuario)
        code, login = request(8004, 'POST', '/auth/login', dict(correo=correo, password=registro['password']))
        self.assertEqual(code, 200, login)
        self.assertEqual(login['usuario_id'], usuario['usuario_id'])
        self.assertNotIn('password', login)
        self.assertEqual(request(8004, 'POST', '/auth/login', dict(correo=correo, password='incorrecta'))[0], 401)

    def test_reservas_integracion_real_con_pagos(self):
        cancha = self.crear_cancha()
        for hora, modo, estado in [('19:00 - 20:00', 'forzar_aprobado', 'CONFIRMADA'),
                                  ('20:00 - 21:00', 'forzar_rechazado', 'CANCELADA')]:
            with self.subTest(estado=estado):
                dto = dict(cancha_id=cancha['id'], cancha_nombre=cancha['nombre'],
                           cliente_nombre='Prueba', fecha=(date.today() + timedelta(days=7)).isoformat(), hora=hora, monto=80)
                code, creada = request(8001, 'POST', '/reservas/', dto)
                self.assertEqual(code, 201, creada)
                reserva = creada['reserva']
                self.assertEqual(reserva['estado'], 'PENDIENTE')
                self.assertEqual(request(8001, 'POST', '/reservas/', dto)[0], 409)
                code, resultado = request(8001, 'POST', f"/reservas/{reserva['id']}/pagar",
                                          dict(metodo_pago='Yape', simulacion_resultado=modo))
                self.assertEqual(code, 200, resultado)
                self.assertEqual(resultado['reserva']['estado'], estado)
                pago = resultado['detalle_pago']
                self.assertEqual(pago['reserva_id'], reserva['id'])
                self.assertEqual(pago['monto'], 80)
                self.assertEqual(pago['estado'], 'APROBADO' if estado == 'CONFIRMADA' else 'RECHAZADO')
                code, guardado = request(8003, 'GET', '/pagos/' + pago['transaccion_id'])
                self.assertEqual(code, 200)
                self.assertEqual(guardado, pago)
                code, actual = request(8001, 'GET', f"/reservas/{reserva['id']}")
                self.assertEqual(code, 200)
                self.assertEqual(actual['estado'], estado)

    def test_notificaciones_aviso_simulado(self):
        reserva = time.time_ns()
        code, aviso = request(8005, 'POST', '/notificaciones/confirmar',
                              dict(reserva_id=reserva, cliente_nombre='Prueba', mensaje='Reserva confirmada'))
        self.assertEqual(code, 200, aviso)
        self.assertEqual(aviso['reserva_id'], reserva)
        self.assertEqual(aviso['estado'], 'ENVIADA')


if __name__ == '__main__':
    unittest.main(verbosity=2)

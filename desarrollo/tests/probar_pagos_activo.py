"""Smoke test del ms-pagos abierto en localhost:8003; deja dos pagos de prueba."""
import json
import time
from urllib.request import Request, urlopen


def request(path, body=None):
    data = json.dumps(body).encode() if body is not None else None
    req = Request('http://127.0.0.1:8003' + path, data=data,
                  headers={'Content-Type': 'application/json'})
    with urlopen(req, timeout=3) as response:
        assert response.status == 200, f'HTTP inesperado: {response.status}'
        return json.load(response)


def main():
    health = request('/pagos/health')
    assert health['status'] == 'UP' and health['service'] == 'ms-pagos'
    reserva = time.time_ns()
    for offset, mode, estado in [(0, 'forzar_aprobado', 'APROBADO'), (1, 'forzar_rechazado', 'RECHAZADO')]:
        pago = request('/pagos/procesar', dict(reserva_id=reserva + offset,
                       cliente_nombre='Demo', monto=80, metodo_pago='Yape',
                       simulacion_resultado=mode))
        assert pago['estado'] == estado, f'Resultado inesperado: {pago}'
        assert request('/pagos/' + pago['transaccion_id']) == pago
        print(f'OK: {estado} y consulta del resultado')
    print('OK: pagos responde. Se agregaron dos registros simulados al historial.')


if __name__ == '__main__':
    main()

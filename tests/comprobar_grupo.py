"""Comprobacion real de arranque del grupo; falla mientras falten servicios.

No sustituye las pruebas funcionales de cada integrante.
"""
import json
from pathlib import Path
import subprocess
import sys
from urllib.request import urlopen

ROOT = Path(__file__).resolve().parents[1]
SERVICIOS = {
    'ms-reservas': (8001, 'reservas'),
    'ms-canchas': (8002, 'canchas'),
    'ms-pagos': (8003, 'pagos'),
    'ms-auth': (8004, 'auth'),
    'ms-notificaciones': (8005, 'notificaciones'),
}


def comprobar():
    pendientes = []
    for nombre, (puerto, ruta) in SERVICIOS.items():
        if not (ROOT / nombre / 'Dockerfile').is_file():
            pendientes.append(f'{nombre}: falta crear Dockerfile e implementar su servicio.')
        try:
            with urlopen(f'http://127.0.0.1:{puerto}/{ruta}/health', timeout=2) as response:
                body = json.load(response)
                if (response.status != 200 or body.get('status') != 'UP'
                        or body.get('service') != nombre or body.get('port') != puerto):
                    pendientes.append(f'{nombre}: healthcheck no cumple el contrato del README.')
                else:
                    print(f'OK HTTP: {nombre} en puerto {puerto}')
        except (OSError, ValueError, AttributeError) as error:
            pendientes.append(f'{nombre}: no responde correctamente /{ruta}/health ({type(error).__name__}).')

    try:
        result = subprocess.run(
            ['docker', 'compose', '--env-file', '/dev/null', 'ps', '--format', 'json'],
            cwd=ROOT, capture_output=True, text=True, timeout=15,
        )
        if result.returncode:
            pendientes.append('Docker: no se pudo consultar Compose. Revisar daemon y permisos; ejecutar docker compose --env-file /dev/null ps.')
        else:
            raw = result.stdout.strip()
            containers = json.loads(raw) if raw.startswith('[') else [json.loads(line) for line in raw.splitlines() if line.strip()]
            activos = {item.get('Service') for item in containers if item.get('State') == 'running'}
            for nombre in SERVICIOS:
                if nombre not in activos:
                    pendientes.append(f'{nombre}: falta su contenedor Compose activo.')
                else:
                    print(f'OK Docker: {nombre}')
    except (OSError, subprocess.TimeoutExpired, ValueError, AttributeError):
        pendientes.append('Docker: falta instalar/configurar Compose o no responde correctamente.')

    if pendientes:
        print('\nGRUPO PENDIENTE (esperado mientras los companeros completan su parte):')
        for pendiente in pendientes:
            print(f'- {pendiente}')
        return 1
    print('\nOK: Dockerfiles, contenedores y healthchecks. Probando contratos de negocio...', flush=True)
    result = subprocess.run(
        [sys.executable, '-m', 'unittest', 'discover', '-s', 'tests', '-p', 'test_grupo.py', '-v'],
        cwd=ROOT,
    )
    return 0 if result.returncode == 0 else 1


if __name__ == '__main__':
    raise SystemExit(comprobar())

# GoDeporte

Base de Taller de Desarrollo. Solo está implementado **ms-pagos**, con pagos simulados y datos en memoria que se pierden al reiniciar. No hay cobros reales ni Kafka.

## Reparto

| Responsable | Servicios | Puertos |
| --- | --- | --- |
| Jean Patrick Nieto Rodríguez | ms-auth, ms-notificaciones | 8004, 8005 |
| Jheferson Abel Portocarrero Tuesta | ms-reservas, ms-canchas | 8001, 8002 |
| Jhean Carlos Tecse Lozano | ms-pagos | 8003 |

Los demás servicios tienen instrucciones pendientes, no implementaciones. Sus responsables crean código, Dockerfile y pruebas de negocio. La propuesta DOCX y la presentación HTML representan también trabajo futuro.

## Ejecutar pagos

```bash
docker compose --env-file /dev/null up --build ms-pagos
```

Abrir http://localhost:8003/docs. Para detener: Ctrl+C y `docker compose --env-file /dev/null stop ms-pagos`.

Alternativa local (no demuestra Docker):

```bash
python3 -m venv venv
venv/bin/python -m pip install -r requirements.txt
./iniciar_demo.sh
```

El script ejecuta solamente pagos en primer plano; Ctrl+C lo detiene.

## Pruebas

Prueba automática de pagos; inicia un proceso propio en un puerto libre y lo cierra al terminar:

```bash
venv/bin/python -m unittest discover -s tests -p 'test_pagos.py' -v
```

Con pagos ya iniciado, también se puede ejecutar `./probar_flujo.sh`.

Para el grupo, seguir `plantilla-servicio/README.md`. Cuando cada compañero cree su código y Dockerfile:

```bash
docker compose --env-file /dev/null up --build -d
venv/bin/python tests/comprobar_grupo.py
```

**La comprobación grupal debe fallar por ahora.** Enumera Dockerfiles pendientes, contenedores inactivos y endpoints de salud que no responden correctamente. Devuelve 1 si falta algo y 0 cuando los cinco servicios cumplen esas comprobaciones. Un proceso local sin contenedor no basta.

Después del arranque ejecuta los contratos funcionales: registro/login, catálogo, reservas con pago aprobado/rechazado y aviso simulado. Ver `CONTRATOS.md`. Un healthcheck solo no basta para pasar. Cada integrante amplía las pruebas de su parte según las funciones que agregue.

Los servicios se llaman directamente por HTTP dentro de Compose. No se incluye gateway en esta base. SQLite y la demo anterior se conservan en la rama local `codex/pagos-sqlite` para después. No agregar Redis, Kafka, JWT ni bases de datos en esta etapa.

# GoDeporte

Sistema de gestión y reserva de espacios deportivos. Proyecto de Taller de Desarrollo, Ingeniería de Sistemas, Universidad Nacional de Ucayali.

## Integrantes

- Jean Patrick Nieto Rodríguez: autenticación y notificaciones.
- Jheferson Abel Portocarrero Tuesta: canchas y reservas.
- Jhean Carlos Tecse Lozano: pagos.

## Ejecución

Requiere Docker y Docker Compose instalados, con el motor de Docker activo. Desde la carpeta del proyecto:

```bash
docker compose up --build -d
docker compose ps
```

Para ejecutar únicamente pagos:

```bash
docker compose up --build -d ms-pagos
```

## Servicios

| Servicio | Función | Documentación interactiva |
| --- | --- | --- |
| ms-reservas | Creación, consulta y estado de reservas | http://localhost:8001/docs |
| ms-canchas | Registro y catálogo de canchas | http://localhost:8002/docs |
| ms-pagos | Simulación y registro de pagos | http://localhost:8003/docs |
| ms-auth | Registro e inicio de sesión | http://localhost:8004/docs |
| ms-notificaciones | Registro de avisos simulados | http://localhost:8005/docs |

Cada servicio usa FastAPI y una base SQLite independiente. Los pagos y avisos son simulados; no hay cobros ni envíos reales.

## Prueba del flujo

1. En Swagger de canchas, crear una cancha con nombre y tarifa.
2. En Swagger de reservas, crear una reserva con el identificador de esa cancha, fecha, horario y monto.
3. Ejecutar `/reservas/{id}/pagar` con `metodo_pago: "Yape"` y `simulacion_resultado: "forzar_aprobado"`. La reserva pasa a CONFIRMADA.
4. Crear otra reserva en un horario diferente y usar `forzar_rechazado`. La reserva pasa a CANCELADA.
5. Consultar los resultados en los endpoints de reservas y pagos.

En Swagger se abre el endpoint, se pulsa **Try it out**, se completan los datos y se pulsa **Execute**.

## Detener

```bash
docker compose stop
```

Los datos permanecen al reiniciar el mismo contenedor; recrearlo puede borrarlos al no utilizar volúmenes persistentes.

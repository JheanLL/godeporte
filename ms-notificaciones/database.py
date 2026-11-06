# Base de datos local SQLite para ms-notificaciones (avisos de reserva)
import os
import sqlite3
from datetime import datetime

DB_FILE = os.getenv(
    "NOTIFICACIONES_DB_PATH",
    os.path.join(os.path.dirname(__file__), "notificaciones.db")
)


def get_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_FILE, timeout=5.0)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    with get_connection() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS notificaciones (
                notificacion_id INTEGER PRIMARY KEY AUTOINCREMENT,
                reserva_id INTEGER NOT NULL,
                cliente_nombre TEXT NOT NULL,
                mensaje TEXT NOT NULL,
                estado TEXT NOT NULL,
                fecha_envio TEXT NOT NULL
            );
        """)
        conn.commit()


def guardar_notificacion(reserva_id: int, cliente_nombre: str, mensaje: str) -> dict:
    fecha_envio = datetime.now().isoformat()
    with get_connection() as conn:
        cursor = conn.execute(
            """
            INSERT INTO notificaciones (
                reserva_id, cliente_nombre, mensaje, estado, fecha_envio
            )
            VALUES (?, ?, ?, 'ENVIADA', ?)
            """,
            (reserva_id, cliente_nombre.strip(), mensaje.strip(), fecha_envio),
        )
        conn.commit()
        notificacion_id = cursor.lastrowid
    return {
        "notificacion_id": notificacion_id,
        "reserva_id": reserva_id,
        "cliente_nombre": cliente_nombre.strip(),
        "mensaje": mensaje.strip(),
        "estado": "ENVIADA",
    }


def listar_notificaciones() -> list[dict]:
    with get_connection() as conn:
        rows = conn.execute("SELECT * FROM notificaciones ORDER BY notificacion_id DESC").fetchall()
    return [dict(r) for r in rows]


init_db()

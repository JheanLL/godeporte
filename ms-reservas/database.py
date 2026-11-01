# Base de datos local SQLite para ms-reservas (disponibilidad y reservas)
import os
import sqlite3

DB_FILE = os.getenv(
    "RESERVAS_DB_PATH",
    os.path.join(os.path.dirname(__file__), "reservas.db")
)


def get_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_FILE, timeout=5.0)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    with get_connection() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS reservas (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                cancha_id INTEGER NOT NULL,
                cancha_nombre TEXT NOT NULL,
                cliente_nombre TEXT NOT NULL,
                fecha TEXT NOT NULL,
                hora TEXT NOT NULL,
                monto REAL NOT NULL,
                estado TEXT NOT NULL
            );
        """)
        conn.commit()


def existe_conflicto_horario(cancha_id: int, fecha: str, hora: str) -> bool:
    with get_connection() as conn:
        row = conn.execute(
            """
            SELECT 1 FROM reservas
            WHERE cancha_id = ? AND fecha = ? AND hora = ?
              AND estado IN ('PENDIENTE', 'CONFIRMADA')
            LIMIT 1
            """,
            (cancha_id, fecha.strip(), hora.strip()),
        ).fetchone()
    return row is not None


def crear_reserva(
    cancha_id: int,
    cancha_nombre: str,
    cliente_nombre: str,
    fecha: str,
    hora: str,
    monto: float,
) -> dict:
    with get_connection() as conn:
        cursor = conn.execute(
            """
            INSERT INTO reservas (
                cancha_id, cancha_nombre, cliente_nombre,
                fecha, hora, monto, estado
            )
            VALUES (?, ?, ?, ?, ?, ?, 'PENDIENTE')
            """,
            (
                cancha_id,
                cancha_nombre.strip(),
                cliente_nombre.strip(),
                fecha.strip(),
                hora.strip(),
                float(monto),
            ),
        )
        conn.commit()
        reserva_id = cursor.lastrowid
    return obtener_reserva(reserva_id)


def obtener_reserva(reserva_id: int) -> dict | None:
    with get_connection() as conn:
        row = conn.execute(
            "SELECT * FROM reservas WHERE id = ?",
            (reserva_id,),
        ).fetchone()
    return dict(row) if row else None


def actualizar_estado_reserva(reserva_id: int, nuevo_estado: str) -> dict | None:
    with get_connection() as conn:
        conn.execute(
            "UPDATE reservas SET estado = ? WHERE id = ?",
            (nuevo_estado, reserva_id),
        )
        conn.commit()
    return obtener_reserva(reserva_id)


init_db()

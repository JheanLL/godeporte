# Base de datos local SQLite para ms-canchas (catalogo de canchas)
import os
import sqlite3

DB_FILE = os.getenv(
    "CANCHAS_DB_PATH",
    os.path.join(os.path.dirname(__file__), "canchas.db")
)


def get_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_FILE, timeout=5.0)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    with get_connection() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS canchas (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                nombre TEXT NOT NULL,
                tarifa REAL NOT NULL
            );
        """)
        conn.commit()


def crear_cancha(nombre: str, tarifa: float) -> dict:
    with get_connection() as conn:
        cursor = conn.execute(
            "INSERT INTO canchas (nombre, tarifa) VALUES (?, ?)",
            (nombre.strip(), float(tarifa)),
        )
        conn.commit()
        cancha_id = cursor.lastrowid
    return {
        "id": cancha_id,
        "nombre": nombre.strip(),
        "tarifa": float(tarifa),
    }


def listar_canchas() -> list[dict]:
    with get_connection() as conn:
        rows = conn.execute("SELECT id, nombre, tarifa FROM canchas ORDER BY id ASC").fetchall()
    return [dict(r) for r in rows]


init_db()

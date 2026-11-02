# Base de datos local SQLite (el modulo sqlite3 ya viene integrado en Python)
import os
import sqlite3

DB_FILE = os.path.join(os.path.dirname(__file__), "datos.db")


def get_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    with get_connection() as conn:
        # Reemplazar por la tabla propia de cada microservicio
        conn.execute("""
            CREATE TABLE IF NOT EXISTS registros (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                descripcion TEXT NOT NULL
            );
        """)
        conn.commit()

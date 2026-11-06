# Base de datos local SQLite para ms-auth (usuarios)
import os
import sqlite3

DB_FILE = os.getenv(
    "AUTH_DB_PATH",
    os.path.join(os.path.dirname(__file__), "auth.db")
)


def get_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_FILE, timeout=5.0)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    with get_connection() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS usuarios (
                usuario_id INTEGER PRIMARY KEY AUTOINCREMENT,
                nombre TEXT NOT NULL,
                correo TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL
            );
        """)
        conn.commit()


def crear_usuario(nombre: str, correo: str, password: str) -> dict:
    with get_connection() as conn:
        cursor = conn.execute(
            "INSERT INTO usuarios (nombre, correo, password) VALUES (?, ?, ?)",
            (nombre.strip(), correo.strip().lower(), password),
        )
        conn.commit()
        usuario_id = cursor.lastrowid
    return {
        "usuario_id": usuario_id,
        "nombre": nombre.strip(),
        "correo": correo.strip().lower(),
    }


def autenticar_usuario(correo: str, password: str) -> dict | None:
    with get_connection() as conn:
        row = conn.execute(
            "SELECT usuario_id, nombre, correo FROM usuarios WHERE correo = ? AND password = ?",
            (correo.strip().lower(), password),
        ).fetchone()
    return dict(row) if row else None


init_db()

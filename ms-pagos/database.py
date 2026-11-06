# Base de datos local SQLite para ms-pagos (modulo sqlite3 integrado en Python)
import os
import sqlite3
from datetime import datetime

DB_FILE = os.getenv(
    "PAGOS_DB_PATH",
    os.path.join(os.path.dirname(__file__), "pagos.db")
)


class PagoYaAprobadoError(Exception):
    """Se lanza cuando la reserva ya cuenta con un pago aprobado."""


def get_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_FILE, timeout=5.0)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    with get_connection() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS pagos (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                transaccion_id TEXT UNIQUE NOT NULL,
                reserva_id INTEGER NOT NULL,
                cliente_nombre TEXT NOT NULL,
                monto REAL NOT NULL,
                metodo_pago TEXT NOT NULL,
                estado TEXT NOT NULL,
                mensaje TEXT NOT NULL,
                fecha_creacion TEXT NOT NULL
            );
        """)
        conn.execute("""
            CREATE UNIQUE INDEX IF NOT EXISTS idx_pagos_reserva_aprobado
            ON pagos (reserva_id)
            WHERE estado = 'APROBADO';
        """)
        conn.commit()


def _row_to_dict(row: sqlite3.Row) -> dict:
    return {
        "transaccion_id": row["transaccion_id"],
        "reserva_id": row["reserva_id"],
        "cliente_nombre": row["cliente_nombre"],
        "monto": row["monto"],
        "metodo_pago": row["metodo_pago"],
        "estado": row["estado"],
        "mensaje": row["mensaje"],
    }


def guardar_pago(
    transaccion_id: str,
    reserva_id: int,
    cliente_nombre: str,
    monto: float,
    metodo_pago: str,
    estado: str,
    mensaje: str,
) -> dict:
    fecha_creacion = datetime.now().isoformat()
    conn = get_connection()
    try:
        conn.execute("BEGIN IMMEDIATE")
        existente = conn.execute(
            "SELECT 1 FROM pagos WHERE reserva_id = ? AND estado = 'APROBADO' LIMIT 1",
            (reserva_id,),
        ).fetchone()
        if existente:
            raise PagoYaAprobadoError("La reserva ya tiene un pago aprobado.")

        conn.execute(
            """
            INSERT INTO pagos (
                transaccion_id, reserva_id, cliente_nombre,
                monto, metodo_pago, estado, mensaje, fecha_creacion
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                transaccion_id,
                reserva_id,
                cliente_nombre,
                monto,
                metodo_pago,
                estado,
                mensaje,
                fecha_creacion,
            ),
        )
        conn.commit()
    except sqlite3.IntegrityError as exc:
        conn.rollback()
        raise PagoYaAprobadoError("La reserva ya tiene un pago aprobado.") from exc
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()

    return {
        "transaccion_id": transaccion_id,
        "reserva_id": reserva_id,
        "cliente_nombre": cliente_nombre,
        "monto": monto,
        "metodo_pago": metodo_pago,
        "estado": estado,
        "mensaje": mensaje,
    }


def obtener_pago_por_id(transaccion_id: str) -> dict | None:
    with get_connection() as conn:
        row = conn.execute(
            "SELECT * FROM pagos WHERE transaccion_id = ?",
            (transaccion_id,),
        ).fetchone()
    return _row_to_dict(row) if row else None


def obtener_pago_por_reserva(reserva_id: int) -> dict | None:
    with get_connection() as conn:
        row = conn.execute(
            "SELECT * FROM pagos WHERE reserva_id = ? ORDER BY id DESC LIMIT 1",
            (reserva_id,),
        ).fetchone()
    return _row_to_dict(row) if row else None


def listar_pagos() -> list[dict]:
    with get_connection() as conn:
        rows = conn.execute("SELECT * FROM pagos ORDER BY id DESC").fetchall()
    return [_row_to_dict(r) for r in rows]

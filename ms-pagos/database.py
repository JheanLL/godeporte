"""
Base de datos aislada para ms-pagos (Database-per-Service).
Utiliza SQLite para garantizar persistencia local independiente sin depender
de bases de datos compartidas, respetando los principios de la arquitectura.
"""
import sqlite3
import os
from datetime import datetime

DB_FILE = os.path.join(os.path.dirname(__file__), "pagos.db")

def get_connection():
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS pagos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        transaccion_id TEXT UNIQUE NOT NULL,
        reserva_id INTEGER NOT NULL,
        cliente_nombre TEXT NOT NULL,
        monto REAL NOT NULL,
        metodo_pago TEXT NOT NULL,
        estado TEXT NOT NULL,
        mensaje TEXT,
        fecha_creacion TEXT NOT NULL
    );
    """)
    conn.commit()
    conn.close()

def guardar_pago(transaccion_id: str, reserva_id: int, cliente_nombre: str, monto: float, metodo_pago: str, estado: str, mensaje: str):
    conn = get_connection()
    cursor = conn.cursor()
    fecha_creacion = datetime.now().isoformat()
    cursor.execute("""
    INSERT INTO pagos (transaccion_id, reserva_id, cliente_nombre, monto, metodo_pago, estado, mensaje, fecha_creacion)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, (transaccion_id, reserva_id, cliente_nombre, monto, metodo_pago, estado, mensaje, fecha_creacion))
    conn.commit()
    conn.close()

def obtener_pago_por_id(transaccion_id: str):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM pagos WHERE transaccion_id = ?", (transaccion_id,))
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None

def obtener_pago_por_reserva(reserva_id: int):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM pagos WHERE reserva_id = ? ORDER BY id DESC LIMIT 1", (reserva_id,))
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None

def listar_pagos():
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM pagos ORDER BY id DESC")
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

CREATE TABLE IF NOT EXISTS reservas (
  id TEXT PRIMARY KEY, usuario TEXT NOT NULL, cancha TEXT NOT NULL, fecha TEXT NOT NULL,
  hora INTEGER NOT NULL, centimos INTEGER NOT NULL, vence INTEGER NOT NULL,
  estado TEXT NOT NULL CHECK (estado IN ('PENDIENTE','CONFIRMADA','CANCELADA','EXPIRADA')),
  pago TEXT UNIQUE, ingreso INTEGER
);
CREATE UNIQUE INDEX IF NOT EXISTS horario_activo ON reservas(cancha, fecha, hora)
  WHERE estado IN ('PENDIENTE','CONFIRMADA');
CREATE INDEX IF NOT EXISTS reservas_por_usuario ON reservas(usuario, fecha);
CREATE INDEX IF NOT EXISTS reservas_pendientes ON reservas(vence) WHERE estado='PENDIENTE';
CREATE TABLE IF NOT EXISTS avisos_pendientes (reserva TEXT PRIMARY KEY, usuario TEXT NOT NULL);
CREATE TRIGGER IF NOT EXISTS aviso_al_confirmar AFTER UPDATE OF estado ON reservas
  WHEN NEW.estado='CONFIRMADA' AND OLD.estado='PENDIENTE'
  BEGIN INSERT INTO avisos_pendientes VALUES (NEW.id, NEW.usuario); END;

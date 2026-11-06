CREATE TABLE IF NOT EXISTS canchas (
  id TEXT PRIMARY KEY, nombre TEXT NOT NULL, ubicacion TEXT NOT NULL,
  caracteristicas TEXT NOT NULL, centimos INTEGER NOT NULL, abre INTEGER NOT NULL, cierra INTEGER NOT NULL
);
INSERT OR IGNORE INTO canchas VALUES
  ('fulbito', 'Cancha de fulbito', 'Pucallpa', 'Grass sintético', 6000, 8, 23),
  ('multiuso', 'Cancha multiuso', 'Pucallpa', 'Losa deportiva', 4000, 8, 22);

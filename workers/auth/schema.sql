CREATE TABLE IF NOT EXISTS usuarios (
  id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, nombre TEXT NOT NULL,
  salt TEXT NOT NULL, hash TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('cliente', 'admin'))
);

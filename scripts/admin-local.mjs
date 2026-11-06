import { randomBytes, randomUUID, pbkdf2Sync } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'

const salt = randomBytes(16).toString('hex')
const hash = pbkdf2Sync('demostracion-local-2026', salt, 100000, 32, 'sha256').toString('hex')
mkdirSync('.local', { recursive: true })
writeFileSync('.local/admin.sql', `INSERT OR IGNORE INTO usuarios VALUES
('${randomUUID()}', 'admin@example.test', 'Administrador de demostración', '${salt}', '${hash}', 'admin');\n`)

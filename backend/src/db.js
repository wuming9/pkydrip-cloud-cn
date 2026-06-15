import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';
import { config } from './config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.resolve(process.cwd(), config.sqlitePath);

fs.mkdirSync(path.dirname(dbPath), { recursive: true });

export const db = new Database(dbPath);
db.pragma('foreign_keys = ON');

export function migrate() {
  const schemaPath = path.resolve(__dirname, '../db/schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf8');
  db.exec(schema);

  db.prepare(
    `UPDATE users SET username = ?, password = ? WHERE username = 'admin'`
  ).run(config.adminUsername, config.adminPassword);
}

export function rowToDevice(row) {
  return {
    id: row.id,
    name: row.name,
    location: row.location,
    online: Boolean(row.online),
    lastSeenAt: row.last_seen_at,
    state: {
      pumpOn: Boolean(row.pump_on),
      valveOn: Boolean(row.valve_on),
      flow: row.flow,
      pressure: row.pressure,
      ec: row.ec,
      ph: row.ph,
      updatedAt: row.updated_at
    }
  };
}

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
  ensureColumns();

  db.prepare(
    `UPDATE users SET username = ?, password = ? WHERE username = 'admin'`
  ).run(config.adminUsername, config.adminPassword);
}

function ensureColumns() {
  const deviceColumns = getColumnNames('devices');
  addColumnIfMissing(deviceColumns, 'devices', 'firmware_version TEXT');
  addColumnIfMissing(deviceColumns, 'devices', "current_mode TEXT NOT NULL DEFAULT '自动模式'");
  addColumnIfMissing(deviceColumns, 'devices', "current_strategy TEXT NOT NULL DEFAULT '番茄开花期策略'");

  const stateColumns = getColumnNames('device_state');
  addColumnIfMissing(stateColumns, 'device_state', "valves_json TEXT NOT NULL DEFAULT '[]'");

  const logColumns = getColumnNames('operation_logs');
  addColumnIfMissing(logColumns, 'operation_logs', "result TEXT NOT NULL DEFAULT '成功'");

  db.prepare(
    `UPDATE devices
     SET firmware_version = COALESCE(firmware_version, 'PKY-FW-1.0.0'),
         current_mode = COALESCE(current_mode, '自动模式'),
         current_strategy = COALESCE(current_strategy, '番茄开花期策略'),
         online = CASE WHEN id IN ('demo-001', 'demo-002') AND last_seen_at IS NULL THEN 1 ELSE online END,
         last_seen_at = CASE WHEN id IN ('demo-001', 'demo-002') AND last_seen_at IS NULL THEN datetime('now') ELSE last_seen_at END`
  ).run();
}

function getColumnNames(table) {
  return new Set(db.prepare(`PRAGMA table_info(${table})`).all().map((column) => column.name));
}

function addColumnIfMissing(columns, table, definition) {
  const name = definition.split(' ')[0];
  if (!columns.has(name)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${definition}`);
  }
}

export function rowToDevice(row) {
  return {
    id: row.id,
    name: row.name,
    location: row.location,
    online: Boolean(row.online),
    firmwareVersion: row.firmware_version,
    currentMode: row.current_mode,
    currentStrategy: row.current_strategy,
    lastSeenAt: row.last_seen_at,
    state: {
      pumpOn: Boolean(row.pump_on),
      valveOn: Boolean(row.valve_on),
      activeValves: parseJsonArray(row.valves_json),
      flow: row.flow,
      pressure: row.pressure,
      ec: row.ec,
      ph: row.ph,
      updatedAt: row.updated_at
    }
  };
}

function parseJsonArray(value) {
  try {
    const parsed = JSON.parse(value || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

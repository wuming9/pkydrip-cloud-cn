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
  addColumnIfMissing(deviceColumns, 'devices', "current_mode TEXT NOT NULL DEFAULT 'MANUAL'");
  addColumnIfMissing(deviceColumns, 'devices', "current_strategy TEXT NOT NULL DEFAULT ''");
  addColumnIfMissing(deviceColumns, 'devices', "work_status TEXT NOT NULL DEFAULT 'IDLE'");
  addColumnIfMissing(deviceColumns, 'devices', 'alarm_code INTEGER NOT NULL DEFAULT 0');
  addColumnIfMissing(deviceColumns, 'devices', 'last_cmd_json TEXT');
  addColumnIfMissing(deviceColumns, 'devices', 'last_ack_json TEXT');

  const stateColumns = getColumnNames('device_state');
  addColumnIfMissing(stateColumns, 'device_state', 'pump1 INTEGER NOT NULL DEFAULT 0');
  addColumnIfMissing(stateColumns, 'device_state', 'pump2 INTEGER NOT NULL DEFAULT 0');
  addColumnIfMissing(stateColumns, 'device_state', "valves_json TEXT NOT NULL DEFAULT '[]'");
  addColumnIfMissing(stateColumns, 'device_state', "valves_state_json TEXT NOT NULL DEFAULT '[]'");

  const logColumns = getColumnNames('operation_logs');
  addColumnIfMissing(logColumns, 'operation_logs', "result TEXT NOT NULL DEFAULT '成功'");

  db.prepare(
    `UPDATE devices
     SET firmware_version = COALESCE(firmware_version, 'PKY-FW-1.0.0'),
         current_mode = COALESCE(current_mode, 'MANUAL'),
         current_strategy = COALESCE(current_strategy, ''),
         work_status = COALESCE(work_status, 'IDLE'),
         alarm_code = COALESCE(alarm_code, 0),
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
    workStatus: row.work_status,
    alarmCode: Number(row.alarm_code || 0),
    lastCommand: parseJsonObject(row.last_cmd_json),
    lastAck: parseJsonObject(row.last_ack_json),
    lastSeenAt: row.last_seen_at,
    state: {
      pumpOn: Boolean(row.pump_on),
      pump1: Boolean(row.pump1),
      pump2: Boolean(row.pump2),
      valveOn: Boolean(row.valve_on),
      activeValves: parseJsonArray(row.valves_json),
      valves: normalizeValveStates(row.valves_state_json, row.valves_json),
      flow: row.flow,
      pressure: row.pressure,
      ec: row.ec,
      ph: row.ph,
      alarmCode: Number(row.alarm_code || 0),
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

function parseJsonObject(value) {
  try {
    const parsed = JSON.parse(value || 'null');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function normalizeValveStates(statesJson, activeJson) {
  const states = parseJsonArray(statesJson);
  if (states.length === 32) {
    return states.map((item) => (Number(item) ? 1 : 0));
  }
  const active = parseJsonArray(activeJson);
  return Array.from({ length: 32 }, (_, index) => (active.includes(index + 1) ? 1 : 0));
}

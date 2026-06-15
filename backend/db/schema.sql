PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS devices (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  location TEXT,
  online INTEGER NOT NULL DEFAULT 0,
  last_seen_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS device_state (
  device_id TEXT PRIMARY KEY,
  pump_on INTEGER NOT NULL DEFAULT 0,
  valve_on INTEGER NOT NULL DEFAULT 0,
  flow REAL NOT NULL DEFAULT 0,
  pressure REAL NOT NULL DEFAULT 0,
  ec REAL NOT NULL DEFAULT 0,
  ph REAL NOT NULL DEFAULT 0,
  raw_payload TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS irrigation_plans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  device_id TEXT NOT NULL,
  name TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  start_time TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL,
  valve_on INTEGER NOT NULL DEFAULT 1,
  pump_on INTEGER NOT NULL DEFAULT 1,
  last_run_date TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS operation_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  device_id TEXT,
  action TEXT NOT NULL,
  detail TEXT,
  source TEXT NOT NULL DEFAULT 'system',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE SET NULL
);

INSERT OR IGNORE INTO users (username, password)
VALUES ('admin', 'admin123');

INSERT OR IGNORE INTO devices (id, name, location)
VALUES
  ('demo-001', 'Greenhouse Pump Station 1', 'Greenhouse A'),
  ('demo-002', 'Irrigation Valve Box 2', 'Greenhouse B');

INSERT OR IGNORE INTO device_state (device_id)
VALUES ('demo-001'), ('demo-002');

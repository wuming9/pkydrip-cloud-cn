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
  firmware_version TEXT,
  current_mode TEXT NOT NULL DEFAULT '自动模式',
  current_strategy TEXT NOT NULL DEFAULT '番茄开花期策略',
  last_seen_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS device_state (
  device_id TEXT PRIMARY KEY,
  pump_on INTEGER NOT NULL DEFAULT 0,
  valve_on INTEGER NOT NULL DEFAULT 0,
  valves_json TEXT NOT NULL DEFAULT '[]',
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

CREATE TABLE IF NOT EXISTS daily_irrigation_stats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  device_id TEXT NOT NULL,
  stat_date TEXT NOT NULL,
  irrigation_count INTEGER NOT NULL DEFAULT 0,
  runtime_minutes INTEGER NOT NULL DEFAULT 0,
  water_liters REAL NOT NULL DEFAULT 0,
  last_irrigation_at TEXT,
  UNIQUE(device_id, stat_date),
  FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS crops (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  variety TEXT,
  planting_date TEXT,
  area TEXT,
  remark TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS growth_stages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  custom INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS irrigation_strategies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  crop_id INTEGER,
  growth_stage_id INTEGER,
  daily_times INTEGER NOT NULL DEFAULT 1,
  start_time TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL,
  soil_moisture_threshold REAL,
  remark TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (crop_id) REFERENCES crops(id) ON DELETE SET NULL,
  FOREIGN KEY (growth_stage_id) REFERENCES growth_stages(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS operation_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  device_id TEXT,
  action TEXT NOT NULL,
  detail TEXT,
  result TEXT NOT NULL DEFAULT '成功',
  source TEXT NOT NULL DEFAULT 'system',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE SET NULL
);

INSERT OR IGNORE INTO users (username, password)
VALUES ('admin', 'admin123');

INSERT OR IGNORE INTO devices
  (id, name, location, online, firmware_version, current_mode, current_strategy, last_seen_at)
VALUES
  ('demo-001', '灌溉控制器001', '番茄温室A区', 1, 'PKY-FW-1.0.0', '自动模式', '番茄开花期策略', datetime('now')),
  ('demo-002', '灌溉控制器002', '育苗温室B区', 1, 'PKY-FW-1.0.0', '自动模式', '育苗期策略', datetime('now'));

INSERT OR IGNORE INTO device_state (device_id)
VALUES ('demo-001'), ('demo-002');

INSERT OR IGNORE INTO crops (id, name, variety, planting_date, area, remark)
VALUES (1, '番茄', '普罗旺斯', '2026-03-18', '12亩', 'A区主栽作物');

INSERT OR IGNORE INTO growth_stages (id, name, sort_order, custom)
VALUES
  (1, 'Seedling', 1, 0),
  (2, '营养生长期', 2, 0),
  (3, '开花期', 3, 0),
  (4, '坐果期', 4, 0),
  (5, '膨果期', 5, 0),
  (6, '采收期', 6, 0);

INSERT OR IGNORE INTO irrigation_strategies
  (id, name, crop_id, growth_stage_id, daily_times, start_time, duration_minutes, soil_moisture_threshold, remark)
VALUES
  (1, '番茄开花期策略', 1, 3, 3, '08:00', 12, 45, '保持稳定水分，避免大水漫灌');

INSERT OR IGNORE INTO daily_irrigation_stats
  (device_id, stat_date, irrigation_count, runtime_minutes, water_liters, last_irrigation_at)
VALUES
  ('demo-001', date('now'), 3, 36, 420.5, '2026-06-15 14:30');

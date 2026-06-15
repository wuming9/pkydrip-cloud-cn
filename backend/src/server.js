import cors from 'cors';
import express from 'express';
import jwt from 'jsonwebtoken';
import morgan from 'morgan';
import { config } from './config.js';
import { db, migrate, rowToDevice } from './db.js';
import { getMqttDebug, publishCommand, startMqtt } from './mqttService.js';

migrate();
startMqtt();
startOnlineWatcher();

const app = express();

app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

function createToken(user) {
  return jwt.sign({ sub: user.id, username: user.username }, config.jwtSecret, {
    expiresIn: '7d'
  });
}

function authRequired(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';

  try {
    req.user = jwt.verify(token, config.jwtSecret);
    next();
  } catch {
    res.status(401).json({ message: '未登录或登录已过期' });
  }
}

app.get('/api/health', (req, res) => {
  res.json({ ok: true, service: 'PKY Cloud CN V0.3' });
});

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const user = db
    .prepare('SELECT * FROM users WHERE username = ? AND password = ?')
    .get(username, password);

  if (!user) {
    res.status(401).json({ message: '用户名或密码错误' });
    return;
  }

  res.json({
    token: createToken(user),
    user: { id: user.id, username: user.username }
  });
});

app.get('/api/devices', authRequired, (req, res) => {
  res.json(listDevices());
});

app.get('/api/devices/:deviceId', authRequired, (req, res) => {
  const device = getDevice(req.params.deviceId);
  if (!device) {
    res.status(404).json({ message: '设备不存在' });
    return;
  }
  res.json(device);
});

app.get('/api/console/:deviceId', authRequired, (req, res) => {
  const device = getDevice(req.params.deviceId);
  if (!device) {
    res.status(404).json({ message: '设备不存在' });
    return;
  }

  res.json({
    device,
    timerTasks: getTimerTasks(req.params.deviceId),
    plans: getDevicePlans(req.params.deviceId),
    logs: getLogs(req.params.deviceId),
    debug: getMqttDebug(req.params.deviceId)
  });
});

app.post('/api/devices/:deviceId/pumps/:pumpNumber', authRequired, (req, res) => {
  const pump = Number(req.params.pumpNumber);
  if (![1, 2].includes(pump)) {
    res.status(400).json({ message: '水泵编号必须是 1 或 2' });
    return;
  }

  const value = Boolean(req.body.value ?? req.body.on) ? 1 : 0;
  const command = { cmd: 'PUMP_SET', pump, value };
  const result = publishCommand(req.params.deviceId, command, `Pump${pump} ${value ? 'ON' : 'OFF'}`);
  res.json({ ok: true, ...result });
});

app.post('/api/devices/:deviceId/pump', authRequired, (req, res) => {
  const pump = Number(req.body.pump || 1);
  const value = Boolean(req.body.value ?? req.body.on) ? 1 : 0;
  const command = { cmd: 'PUMP_SET', pump, value };
  const result = publishCommand(req.params.deviceId, command, `Pump${pump} ${value ? 'ON' : 'OFF'}`);
  res.json({ ok: true, ...result });
});

app.post('/api/devices/:deviceId/valves/:valveNumber', authRequired, (req, res) => {
  const valve = Number(req.params.valveNumber);
  if (valve < 1 || valve > 32) {
    res.status(400).json({ message: '阀门编号必须在 1-32 之间' });
    return;
  }

  const value = Boolean(req.body.value ?? req.body.on) ? 1 : 0;
  const command = { cmd: 'VALVE_SET', valve, value };
  const result = publishCommand(req.params.deviceId, command, `Valve${valve} ${value ? 'ON' : 'OFF'}`);
  res.json({ ok: true, ...result });
});

app.post('/api/devices/:deviceId/emergency-stop', authRequired, (req, res) => {
  const command = { cmd: 'EMERGENCY_STOP' };
  const result = publishCommand(req.params.deviceId, command, 'Emergency Stop');
  res.json({ ok: true, ...result });
});

app.post('/api/devices/:deviceId/mode', authRequired, (req, res) => {
  const mode = String(req.body.mode || '').toUpperCase();
  const modes = ['MANUAL', 'TIMER', 'PLAN', 'AUTO', 'REMOTE'];
  if (!modes.includes(mode)) {
    res.status(400).json({ message: '模式必须是 MANUAL、TIMER、PLAN、AUTO、REMOTE' });
    return;
  }

  const command = { cmd: 'MODE_SET', mode };
  const result = publishCommand(req.params.deviceId, command, `模式切换 ${mode}`);
  db.prepare('UPDATE devices SET current_mode = ? WHERE id = ?').run(mode, req.params.deviceId);
  res.json({ ok: true, ...result });
});

app.get('/api/devices/:deviceId/timer-tasks', authRequired, (req, res) => {
  res.json(getTimerTasks(req.params.deviceId));
});

app.post('/api/devices/:deviceId/timer-tasks', authRequired, (req, res) => {
  const task = normalizeTimerTask(req.body);
  if (!task.name || !task.startTime || !task.durationMinutes) {
    res.status(400).json({ message: '请填写名称、开始时间和运行时长' });
    return;
  }

  const result = db
    .prepare(
      `INSERT INTO timer_tasks
       (device_id, name, start_time, pump, valves_json, duration_minutes, enabled)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      req.params.deviceId,
      task.name,
      task.startTime,
      task.pump,
      JSON.stringify(task.valves),
      task.durationMinutes,
      task.enabled ? 1 : 0
    );

  addLog(req.params.deviceId, 'Timer创建', JSON.stringify(task), '成功', 'web');
  res.status(201).json({ id: result.lastInsertRowid });
});

app.post('/api/timer-tasks/:taskId/send', authRequired, (req, res) => {
  const row = db.prepare('SELECT * FROM timer_tasks WHERE id = ?').get(req.params.taskId);
  if (!row) {
    res.status(404).json({ message: 'Timer Task 不存在' });
    return;
  }

  const task = mapTimerTask(row);
  const command = { cmd: 'TIMER_TASK_SET', task };
  const result = publishCommand(row.device_id, command, 'Timer下发');
  res.json({ ok: true, ...result });
});

app.delete('/api/timer-tasks/:taskId', authRequired, (req, res) => {
  const row = db.prepare('SELECT * FROM timer_tasks WHERE id = ?').get(req.params.taskId);
  if (!row) {
    res.status(404).json({ message: 'Timer Task 不存在' });
    return;
  }
  db.prepare('DELETE FROM timer_tasks WHERE id = ?').run(req.params.taskId);
  addLog(row.device_id, 'Timer删除', JSON.stringify({ taskId: req.params.taskId }), '成功', 'web');
  res.json({ ok: true });
});

app.get('/api/devices/:deviceId/device-plans', authRequired, (req, res) => {
  res.json(getDevicePlans(req.params.deviceId));
});

app.post('/api/devices/:deviceId/device-plans', authRequired, (req, res) => {
  const plan = normalizePlan(req.body);
  if (!plan.name || !plan.groups.length) {
    res.status(400).json({ message: '请填写计划名称和至少一个灌溉组' });
    return;
  }

  const result = db
    .prepare(
      `INSERT INTO device_plans (device_id, name, groups_json, enabled)
       VALUES (?, ?, ?, ?)`
    )
    .run(req.params.deviceId, plan.name, JSON.stringify(plan.groups), plan.enabled ? 1 : 0);

  addLog(req.params.deviceId, 'Plan创建', JSON.stringify(plan), '成功', 'web');
  res.status(201).json({ id: result.lastInsertRowid });
});

app.post('/api/device-plans/:planId/send', authRequired, (req, res) => {
  const row = db.prepare('SELECT * FROM device_plans WHERE id = ?').get(req.params.planId);
  if (!row) {
    res.status(404).json({ message: 'Plan 不存在' });
    return;
  }

  const plan = mapDevicePlan(row);
  const command = { cmd: 'PLAN_SET', plan };
  const result = publishCommand(row.device_id, command, 'Plan下发');
  res.json({ ok: true, ...result });
});

app.delete('/api/device-plans/:planId', authRequired, (req, res) => {
  const row = db.prepare('SELECT * FROM device_plans WHERE id = ?').get(req.params.planId);
  if (!row) {
    res.status(404).json({ message: 'Plan 不存在' });
    return;
  }
  db.prepare('DELETE FROM device_plans WHERE id = ?').run(req.params.planId);
  addLog(row.device_id, 'Plan删除', JSON.stringify({ planId: req.params.planId }), '成功', 'web');
  res.json({ ok: true });
});

app.get('/api/logs', authRequired, (req, res) => {
  res.json(getLogs(req.query.deviceId));
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ message: err.message || '服务异常' });
});

app.listen(config.apiPort, () => {
  console.log(`PKY Cloud CN V0.3 backend listening on ${config.apiPort}`);
});

function listDevices() {
  return db
    .prepare(
      `SELECT d.*, s.pump_on, s.pump1, s.pump2, s.valve_on, s.valves_json,
              s.valves_state_json, s.flow, s.pressure, s.ec, s.ph, s.updated_at
       FROM devices d
       LEFT JOIN device_state s ON s.device_id = d.id
       ORDER BY d.created_at DESC`
    )
    .all()
    .map(rowToDevice);
}

function getDevice(deviceId) {
  const row = db
    .prepare(
      `SELECT d.*, s.pump_on, s.pump1, s.pump2, s.valve_on, s.valves_json,
              s.valves_state_json, s.flow, s.pressure, s.ec, s.ph, s.updated_at
       FROM devices d
       LEFT JOIN device_state s ON s.device_id = d.id
       WHERE d.id = ?`
    )
    .get(deviceId);

  return row ? rowToDevice(row) : null;
}

function getTimerTasks(deviceId) {
  return db
    .prepare(
      `SELECT id, device_id AS deviceId, name, start_time AS startTime, pump,
              valves_json AS valvesJson, duration_minutes AS durationMinutes,
              enabled, created_at AS createdAt, updated_at AS updatedAt
       FROM timer_tasks
       WHERE device_id = ?
       ORDER BY start_time ASC`
    )
    .all(deviceId)
    .map((row) => ({
      ...row,
      valves: parseJsonArray(row.valvesJson),
      enabled: Boolean(row.enabled)
    }));
}

function getDevicePlans(deviceId) {
  return db
    .prepare(
      `SELECT id, device_id AS deviceId, name, groups_json AS groupsJson,
              enabled, created_at AS createdAt, updated_at AS updatedAt
       FROM device_plans
       WHERE device_id = ?
       ORDER BY created_at DESC`
    )
    .all(deviceId)
    .map((row) => ({
      ...row,
      groups: parseJsonArray(row.groupsJson),
      enabled: Boolean(row.enabled)
    }));
}

function getLogs(deviceId) {
  const sql = deviceId
    ? `SELECT id, device_id AS deviceId, action AS event, result, detail, source, created_at AS createdAt
       FROM operation_logs
       WHERE device_id = ?
       ORDER BY created_at DESC
       LIMIT 80`
    : `SELECT id, device_id AS deviceId, action AS event, result, detail, source, created_at AS createdAt
       FROM operation_logs
       ORDER BY created_at DESC
       LIMIT 80`;
  const statement = db.prepare(sql);
  return deviceId ? statement.all(deviceId) : statement.all();
}

function mapTimerTask(row) {
  return {
    name: row.name,
    startTime: row.start_time,
    pump: Number(row.pump),
    valves: parseJsonArray(row.valves_json),
    durationMinutes: Number(row.duration_minutes),
    enabled: Boolean(row.enabled)
  };
}

function mapDevicePlan(row) {
  return {
    name: row.name,
    groups: parseJsonArray(row.groups_json),
    enabled: Boolean(row.enabled)
  };
}

function normalizeTimerTask(input) {
  return {
    name: String(input.name || '').trim(),
    startTime: String(input.startTime || '').trim(),
    pump: [1, 2].includes(Number(input.pump)) ? Number(input.pump) : 1,
    valves: normalizeValveList(input.valves),
    durationMinutes: Number(input.durationMinutes || 0),
    enabled: input.enabled !== false
  };
}

function normalizePlan(input) {
  return {
    name: String(input.name || '').trim(),
    groups: Array.isArray(input.groups)
      ? input.groups.map(normalizePlanGroup).filter((group) => group.groupName && group.valves.length)
      : [],
    enabled: input.enabled !== false
  };
}

function normalizePlanGroup(input) {
  return {
    groupName: String(input.groupName || '').trim(),
    pump: [1, 2].includes(Number(input.pump)) ? Number(input.pump) : 1,
    valves: normalizeValveList(input.valves),
    durationMinutes: Number(input.durationMinutes || 0)
  };
}

function normalizeValveList(value) {
  const list = Array.isArray(value)
    ? value
    : String(value || '')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
  return [...new Set(list.map(Number).filter((item) => item >= 1 && item <= 32))];
}

function parseJsonArray(value) {
  try {
    const parsed = JSON.parse(value || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function addLog(deviceId, action, detail, result, source) {
  db.prepare(
    `INSERT INTO operation_logs (device_id, action, detail, result, source)
     VALUES (?, ?, ?, ?, ?)`
  ).run(deviceId, action, detail, result, source);
}

function startOnlineWatcher() {
  setInterval(() => {
    const offlineBefore = new Date(Date.now() - 60 * 1000).toISOString();
    const offlineDevices = db
      .prepare(
        `SELECT id FROM devices
         WHERE online = 1
           AND (last_seen_at IS NULL OR last_seen_at < ?)`
      )
      .all(offlineBefore);

    db.prepare(
      `UPDATE devices
       SET online = 0
       WHERE last_seen_at IS NULL OR last_seen_at < ?`
    ).run(offlineBefore);

    for (const device of offlineDevices) {
      addLog(device.id, '设备离线', '60秒内未收到 state 或 heartbeat', '离线', 'system');
    }
  }, 10 * 1000);
}

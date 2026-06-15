import cors from 'cors';
import express from 'express';
import jwt from 'jsonwebtoken';
import morgan from 'morgan';
import { config } from './config.js';
import { db, migrate, rowToDevice } from './db.js';
import { publishCommand, startMqtt } from './mqttService.js';

migrate();
startMqtt();
startPlanScheduler();

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
    res.status(401).json({ message: 'Unauthorized' });
  }
}

app.get('/api/health', (req, res) => {
  res.json({ ok: true, service: 'pky-cloud-backend' });
});

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const user = db
    .prepare('SELECT * FROM users WHERE username = ? AND password = ?')
    .get(username, password);

  if (!user) {
    res.status(401).json({ message: 'Invalid username or password' });
    return;
  }

  res.json({
    token: createToken(user),
    user: { id: user.id, username: user.username }
  });
});

app.get('/api/devices', authRequired, (req, res) => {
  const rows = db
    .prepare(
      `SELECT d.*, s.pump_on, s.valve_on, s.flow, s.pressure, s.ec, s.ph, s.updated_at
       FROM devices d
       LEFT JOIN device_state s ON s.device_id = d.id
       ORDER BY d.created_at DESC`
    )
    .all();

  res.json(rows.map(rowToDevice));
});

app.get('/api/devices/:deviceId', authRequired, (req, res) => {
  const row = db
    .prepare(
      `SELECT d.*, s.pump_on, s.valve_on, s.flow, s.pressure, s.ec, s.ph, s.updated_at
       FROM devices d
       LEFT JOIN device_state s ON s.device_id = d.id
       WHERE d.id = ?`
    )
    .get(req.params.deviceId);

  if (!row) {
    res.status(404).json({ message: 'Device not found' });
    return;
  }

  res.json(rowToDevice(row));
});

app.post('/api/devices/:deviceId/pump', authRequired, (req, res) => {
  const on = Boolean(req.body.on);
  publishCommand(req.params.deviceId, { type: 'pump_control', pumpOn: on });
  res.json({ ok: true, command: { pumpOn: on } });
});

app.post('/api/devices/:deviceId/valve', authRequired, (req, res) => {
  const on = Boolean(req.body.on);
  publishCommand(req.params.deviceId, { type: 'valve_control', valveOn: on });
  res.json({ ok: true, command: { valveOn: on } });
});

app.get('/api/devices/:deviceId/plans', authRequired, (req, res) => {
  const plans = db
    .prepare(
      `SELECT id, device_id AS deviceId, name, enabled, start_time AS startTime,
              duration_minutes AS durationMinutes, valve_on AS valveOn,
              pump_on AS pumpOn, created_at AS createdAt, updated_at AS updatedAt
       FROM irrigation_plans
       WHERE device_id = ?
       ORDER BY start_time ASC`
    )
    .all(req.params.deviceId)
    .map((plan) => ({
      ...plan,
      enabled: Boolean(plan.enabled),
      valveOn: Boolean(plan.valveOn),
      pumpOn: Boolean(plan.pumpOn)
    }));

  res.json(plans);
});

app.post('/api/devices/:deviceId/plans', authRequired, (req, res) => {
  const { name, startTime, durationMinutes, enabled = true } = req.body;

  if (!name || !startTime || !Number(durationMinutes)) {
    res.status(400).json({ message: 'name, startTime and durationMinutes are required' });
    return;
  }

  const result = db
    .prepare(
      `INSERT INTO irrigation_plans
       (device_id, name, enabled, start_time, duration_minutes, valve_on, pump_on)
       VALUES (?, ?, ?, ?, ?, 1, 1)`
    )
    .run(req.params.deviceId, name, enabled ? 1 : 0, startTime, Number(durationMinutes));

  db.prepare(
    `INSERT INTO operation_logs (device_id, action, detail, source)
     VALUES (?, 'plan_created', ?, 'web')`
  ).run(req.params.deviceId, JSON.stringify(req.body));

  res.status(201).json({ id: result.lastInsertRowid });
});

app.delete('/api/plans/:planId', authRequired, (req, res) => {
  const plan = db
    .prepare('SELECT * FROM irrigation_plans WHERE id = ?')
    .get(req.params.planId);

  if (!plan) {
    res.status(404).json({ message: 'Plan not found' });
    return;
  }

  db.prepare('DELETE FROM irrigation_plans WHERE id = ?').run(req.params.planId);
  db.prepare(
    `INSERT INTO operation_logs (device_id, action, detail, source)
     VALUES (?, 'plan_deleted', ?, 'web')`
  ).run(plan.device_id, JSON.stringify({ planId: req.params.planId }));

  res.json({ ok: true });
});

app.get('/api/logs', authRequired, (req, res) => {
  const logs = db
    .prepare(
      `SELECT id, device_id AS deviceId, action, detail, source, created_at AS createdAt
       FROM operation_logs
       ORDER BY created_at DESC
       LIMIT 50`
    )
    .all();

  res.json(logs);
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ message: err.message || 'Server error' });
});

app.listen(config.apiPort, () => {
  console.log(`PKY Cloud backend listening on ${config.apiPort}`);
});

function startPlanScheduler() {
  setInterval(runDuePlans, 30 * 1000);
}

function runDuePlans() {
  const now = new Date();
  const currentTime = now.toTimeString().slice(0, 5);
  const currentDate = now.toISOString().slice(0, 10);

  const plans = db
    .prepare(
      `SELECT *
       FROM irrigation_plans
       WHERE enabled = 1
         AND start_time = ?
         AND (last_run_date IS NULL OR last_run_date != ?)`
    )
    .all(currentTime, currentDate);

  for (const plan of plans) {
    try {
      publishCommand(plan.device_id, {
        type: 'timer_irrigation_start',
        planId: plan.id,
        pumpOn: Boolean(plan.pump_on),
        valveOn: Boolean(plan.valve_on),
        durationMinutes: plan.duration_minutes
      });

      db.prepare(
        `UPDATE irrigation_plans
         SET last_run_date = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`
      ).run(currentDate, plan.id);

      setTimeout(() => {
        try {
          publishCommand(plan.device_id, {
            type: 'timer_irrigation_stop',
            planId: plan.id,
            pumpOn: false,
            valveOn: false
          });
        } catch (err) {
          console.error(`Timer stop command failed for plan ${plan.id}:`, err.message);
        }
      }, plan.duration_minutes * 60 * 1000);
    } catch (err) {
      console.error(`Timer start command failed for plan ${plan.id}:`, err.message);
    }
  }
}

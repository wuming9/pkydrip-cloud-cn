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
  res.json({ ok: true, service: 'PKY Cloud CN V0.2' });
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
    todayStats: getTodayStats(req.params.deviceId),
    plans: getPlans(req.params.deviceId),
    logs: getLogs(req.params.deviceId)
  });
});

app.post('/api/devices/:deviceId/pump', authRequired, (req, res) => {
  const on = Boolean(req.body.on);
  publishCommand(req.params.deviceId, {
    type: 'pump_control',
    label: on ? '水泵启动' : '水泵停止',
    pumpOn: on
  });
  res.json({ ok: true, command: { pumpOn: on } });
});

app.post('/api/devices/:deviceId/valves/:valveNumber', authRequired, (req, res) => {
  const valveNumber = Number(req.params.valveNumber);
  if (valveNumber < 1 || valveNumber > 32) {
    res.status(400).json({ message: '阀门编号必须在 1-32 之间' });
    return;
  }

  const on = Boolean(req.body.on);
  publishCommand(req.params.deviceId, {
    type: 'valve_control',
    label: `阀门${valveNumber}${on ? '开启' : '关闭'}`,
    valveNo: valveNumber,
    valveOn: on
  });
  res.json({ ok: true, command: { valveNo: valveNumber, valveOn: on } });
});

app.post('/api/devices/:deviceId/valve', authRequired, (req, res) => {
  const on = Boolean(req.body.on);
  const valveNumber = Number(req.body.valveNo || req.body.valveNumber || 1);
  publishCommand(req.params.deviceId, {
    type: 'valve_control',
    label: `阀门${valveNumber}${on ? '开启' : '关闭'}`,
    valveNo: valveNumber,
    valveOn: on
  });
  res.json({ ok: true, command: { valveNo: valveNumber, valveOn: on } });
});

app.get('/api/devices/:deviceId/plans', authRequired, (req, res) => {
  res.json(getPlans(req.params.deviceId));
});

app.post('/api/devices/:deviceId/plans', authRequired, (req, res) => {
  const { name, startTime, durationMinutes, enabled = true } = req.body;

  if (!name || !startTime || !Number(durationMinutes)) {
    res.status(400).json({ message: '请填写名称、开始时间和运行时长' });
    return;
  }

  const result = db
    .prepare(
      `INSERT INTO irrigation_plans
       (device_id, name, enabled, start_time, duration_minutes, valve_on, pump_on)
       VALUES (?, ?, ?, ?, ?, 1, 1)`
    )
    .run(req.params.deviceId, name, enabled ? 1 : 0, startTime, Number(durationMinutes));

  addLog(req.params.deviceId, '新增灌溉计划', JSON.stringify(req.body), '成功', '平台');
  res.status(201).json({ id: result.lastInsertRowid });
});

app.delete('/api/plans/:planId', authRequired, (req, res) => {
  const plan = db.prepare('SELECT * FROM irrigation_plans WHERE id = ?').get(req.params.planId);
  if (!plan) {
    res.status(404).json({ message: '计划不存在' });
    return;
  }

  db.prepare('DELETE FROM irrigation_plans WHERE id = ?').run(req.params.planId);
  addLog(plan.device_id, '删除灌溉计划', JSON.stringify({ planId: req.params.planId }), '成功', '平台');
  res.json({ ok: true });
});

app.get('/api/logs', authRequired, (req, res) => {
  res.json(getLogs(req.query.deviceId));
});

app.get('/api/crops', authRequired, (req, res) => {
  res.json(db.prepare('SELECT * FROM crops ORDER BY created_at DESC').all());
});

app.post('/api/crops', authRequired, (req, res) => {
  const { name, variety = '', plantingDate = '', area = '', remark = '' } = req.body;
  if (!name) {
    res.status(400).json({ message: '请填写作物名称' });
    return;
  }

  const result = db
    .prepare(
      `INSERT INTO crops (name, variety, planting_date, area, remark)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(name, variety, plantingDate, area, remark);

  res.status(201).json({ id: result.lastInsertRowid });
});

app.delete('/api/crops/:cropId', authRequired, (req, res) => {
  db.prepare('DELETE FROM crops WHERE id = ?').run(req.params.cropId);
  res.json({ ok: true });
});

app.get('/api/growth-stages', authRequired, (req, res) => {
  res.json(db.prepare('SELECT * FROM growth_stages ORDER BY sort_order ASC, id ASC').all());
});

app.post('/api/growth-stages', authRequired, (req, res) => {
  const { name } = req.body;
  if (!name) {
    res.status(400).json({ message: '请填写阶段名称' });
    return;
  }

  const maxSort = db.prepare('SELECT COALESCE(MAX(sort_order), 0) AS value FROM growth_stages').get();
  const result = db
    .prepare('INSERT INTO growth_stages (name, sort_order, custom) VALUES (?, ?, 1)')
    .run(name, Number(maxSort.value) + 1);

  res.status(201).json({ id: result.lastInsertRowid });
});

app.delete('/api/growth-stages/:stageId', authRequired, (req, res) => {
  db.prepare('DELETE FROM growth_stages WHERE id = ? AND custom = 1').run(req.params.stageId);
  res.json({ ok: true });
});

app.get('/api/strategies', authRequired, (req, res) => {
  res.json(getStrategies());
});

app.post('/api/strategies', authRequired, (req, res) => {
  const {
    name,
    cropId = null,
    growthStageId = null,
    dailyTimes = 1,
    startTime,
    durationMinutes,
    soilMoistureThreshold = null,
    remark = ''
  } = req.body;

  if (!name || !startTime || !Number(durationMinutes)) {
    res.status(400).json({ message: '请填写策略名称、开始时间和运行时长' });
    return;
  }

  const result = db
    .prepare(
      `INSERT INTO irrigation_strategies
       (name, crop_id, growth_stage_id, daily_times, start_time, duration_minutes, soil_moisture_threshold, remark)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      name,
      cropId || null,
      growthStageId || null,
      Number(dailyTimes),
      startTime,
      Number(durationMinutes),
      soilMoistureThreshold === '' ? null : soilMoistureThreshold,
      remark
    );

  res.status(201).json({ id: result.lastInsertRowid });
});

app.delete('/api/strategies/:strategyId', authRequired, (req, res) => {
  db.prepare('DELETE FROM irrigation_strategies WHERE id = ?').run(req.params.strategyId);
  res.json({ ok: true });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ message: err.message || '服务异常' });
});

app.listen(config.apiPort, () => {
  console.log(`PKY Cloud CN V0.2 backend listening on ${config.apiPort}`);
});

function listDevices() {
  return db
    .prepare(
      `SELECT d.*, s.pump_on, s.valve_on, s.valves_json, s.flow, s.pressure, s.ec, s.ph, s.updated_at
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
      `SELECT d.*, s.pump_on, s.valve_on, s.valves_json, s.flow, s.pressure, s.ec, s.ph, s.updated_at
       FROM devices d
       LEFT JOIN device_state s ON s.device_id = d.id
       WHERE d.id = ?`
    )
    .get(deviceId);

  return row ? rowToDevice(row) : null;
}

function getPlans(deviceId) {
  return db
    .prepare(
      `SELECT id, device_id AS deviceId, name, enabled, start_time AS startTime,
              duration_minutes AS durationMinutes, valve_on AS valveOn,
              pump_on AS pumpOn, created_at AS createdAt, updated_at AS updatedAt
       FROM irrigation_plans
       WHERE device_id = ?
       ORDER BY start_time ASC`
    )
    .all(deviceId)
    .map((plan) => ({
      ...plan,
      enabled: Boolean(plan.enabled),
      valveOn: Boolean(plan.valveOn),
      pumpOn: Boolean(plan.pumpOn)
    }));
}

function getTodayStats(deviceId) {
  const today = new Date().toISOString().slice(0, 10);
  return (
    db
      .prepare(
        `SELECT irrigation_count AS irrigationCount,
                runtime_minutes AS runtimeMinutes,
                water_liters AS waterLiters,
                last_irrigation_at AS lastIrrigationAt
         FROM daily_irrigation_stats
         WHERE device_id = ? AND stat_date = ?`
      )
      .get(deviceId, today) || {
      irrigationCount: 0,
      runtimeMinutes: 0,
      waterLiters: 0,
      lastIrrigationAt: ''
    }
  );
}

function getLogs(deviceId) {
  const sql = deviceId
    ? `SELECT id, device_id AS deviceId, action AS event, result, detail, source, created_at AS createdAt
       FROM operation_logs
       WHERE device_id = ?
       ORDER BY created_at DESC
       LIMIT 50`
    : `SELECT id, device_id AS deviceId, action AS event, result, detail, source, created_at AS createdAt
       FROM operation_logs
       ORDER BY created_at DESC
       LIMIT 50`;

  const statement = db.prepare(sql);
  return deviceId ? statement.all(deviceId) : statement.all();
}

function getStrategies() {
  return db
    .prepare(
      `SELECT s.id, s.name, s.crop_id AS cropId, c.name AS cropName,
              s.growth_stage_id AS growthStageId, g.name AS growthStageName,
              s.daily_times AS dailyTimes, s.start_time AS startTime,
              s.duration_minutes AS durationMinutes,
              s.soil_moisture_threshold AS soilMoistureThreshold,
              s.remark, s.created_at AS createdAt
       FROM irrigation_strategies s
       LEFT JOIN crops c ON c.id = s.crop_id
       LEFT JOIN growth_stages g ON g.id = s.growth_stage_id
       ORDER BY s.created_at DESC`
    )
    .all();
}

function addLog(deviceId, action, detail, result, source) {
  db.prepare(
    `INSERT INTO operation_logs (device_id, action, detail, result, source)
     VALUES (?, ?, ?, ?, ?)`
  ).run(deviceId, action, detail, result, source);
}

function startOnlineWatcher() {
  setInterval(() => {
    const offlineBefore = new Date(Date.now() - 90 * 1000).toISOString();
    db.prepare(
      `UPDATE devices
       SET online = 0
       WHERE last_seen_at IS NULL OR last_seen_at < ?`
    ).run(offlineBefore);
  }, 30 * 1000);
}

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
        label: '灌溉计划启动',
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
            label: '灌溉计划停止',
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

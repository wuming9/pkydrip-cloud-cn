import mqtt from 'mqtt';
import { config } from './config.js';
import { db } from './db.js';

const STATE_TOPIC = 'pky/device/+/state';
const ACK_TOPIC = 'pky/device/+/ack';
const HEARTBEAT_TOPIC = 'pky/device/+/heartbeat';

let client;

function getDeviceId(topic) {
  const parts = topic.split('/');
  return parts.length >= 4 ? parts[2] : null;
}

function normalizeBoolean(value) {
  return value === true || value === 1 || value === '1' || value === 'on';
}

export function startMqtt() {
  const options = {};
  if (config.mqttUsername) {
    options.username = config.mqttUsername;
    options.password = config.mqttPassword;
  }

  client = mqtt.connect(config.mqttUrl, options);

  client.on('connect', () => {
    console.log(`MQTT connected: ${config.mqttUrl}`);
    client.subscribe([STATE_TOPIC, ACK_TOPIC, HEARTBEAT_TOPIC], (err) => {
      if (err) console.error('MQTT subscribe failed:', err.message);
    });
  });

  client.on('message', (topic, payloadBuffer) => {
    const deviceId = getDeviceId(topic);
    if (!deviceId) return;

    let payload;
    try {
      payload = JSON.parse(payloadBuffer.toString());
    } catch {
      payload = { raw: payloadBuffer.toString() };
    }

    if (topic.endsWith('/state')) {
      if (payload.type === 'heartbeat') {
        markDeviceOnline(deviceId, payload);
        return;
      }
      upsertState(deviceId, payload);
      return;
    }

    if (topic.endsWith('/heartbeat')) {
      markDeviceOnline(deviceId, payload);
      return;
    }

    if (topic.endsWith('/ack')) {
      logOperation(deviceId, '设备确认', JSON.stringify(payload), payload.ok === false ? '失败' : '成功', 'mqtt');
    }
  });

  client.on('error', (err) => {
    console.error('MQTT error:', err.message);
  });
}

export function publishCommand(deviceId, command) {
  if (!client || !client.connected) {
    throw new Error('MQTT client is not connected');
  }

  const topic = `pky/device/${deviceId}/cmd`;
  const message = JSON.stringify({
    ...command,
    ts: new Date().toISOString()
  });

  client.publish(topic, message, { qos: 1 });
  logOperation(deviceId, command.label || command.type || '手动控制', message, '已发送', 'web');
}

function upsertState(deviceId, payload) {
  const now = new Date().toISOString();

  db.prepare(
    `INSERT OR IGNORE INTO devices (id, name, location, online, firmware_version, last_seen_at)
     VALUES (?, ?, ?, 1, ?, ?)`
  ).run(deviceId, `灌溉控制器${deviceId}`, '', payload.firmwareVersion || payload.firmware_version || 'PKY-FW-1.0.0', now);

  const activeValves = normalizeValves(payload);

  db.prepare(
    `INSERT INTO device_state
       (device_id, pump_on, valve_on, valves_json, flow, pressure, ec, ph, raw_payload, updated_at)
     VALUES
       (@device_id, @pump_on, @valve_on, @valves_json, @flow, @pressure, @ec, @ph, @raw_payload, @updated_at)
     ON CONFLICT(device_id) DO UPDATE SET
       pump_on = excluded.pump_on,
       valve_on = excluded.valve_on,
       valves_json = excluded.valves_json,
       flow = excluded.flow,
       pressure = excluded.pressure,
       ec = excluded.ec,
       ph = excluded.ph,
       raw_payload = excluded.raw_payload,
       updated_at = excluded.updated_at`
  ).run({
    device_id: deviceId,
    pump_on: normalizeBoolean(payload.pumpOn ?? payload.pump_on) ? 1 : 0,
    valve_on: activeValves.length > 0 || normalizeBoolean(payload.valveOn ?? payload.valve_on) ? 1 : 0,
    valves_json: JSON.stringify(activeValves),
    flow: Number(payload.flow ?? 0),
    pressure: Number(payload.pressure ?? 0),
    ec: Number(payload.ec ?? 0),
    ph: Number(payload.ph ?? payload.pH ?? 0),
    raw_payload: JSON.stringify(payload),
    updated_at: now
  });

  db.prepare(
    `UPDATE devices
     SET online = 1,
         last_seen_at = ?,
         firmware_version = COALESCE(?, firmware_version),
         current_mode = COALESCE(?, current_mode),
         current_strategy = COALESCE(?, current_strategy)
     WHERE id = ?`
  ).run(
    now,
    payload.firmwareVersion || payload.firmware_version || null,
    payload.mode || payload.currentMode || payload.current_mode || null,
    payload.strategy || payload.currentStrategy || payload.current_strategy || null,
    deviceId
  );
}

function markDeviceOnline(deviceId, payload = {}) {
  const now = new Date().toISOString();
  db.prepare(
    `INSERT OR IGNORE INTO devices (id, name, location, online, firmware_version, last_seen_at)
     VALUES (?, ?, ?, 1, ?, ?)`
  ).run(deviceId, `灌溉控制器${deviceId}`, '', payload.firmwareVersion || payload.firmware_version || 'PKY-FW-1.0.0', now);

  db.prepare(
    `UPDATE devices
     SET online = 1,
         last_seen_at = ?,
         firmware_version = COALESCE(?, firmware_version),
         current_mode = COALESCE(?, current_mode),
         current_strategy = COALESCE(?, current_strategy)
     WHERE id = ?`
  ).run(
    now,
    payload.firmwareVersion || payload.firmware_version || null,
    payload.mode || payload.currentMode || payload.current_mode || null,
    payload.strategy || payload.currentStrategy || payload.current_strategy || null,
    deviceId
  );
}

function normalizeValves(payload) {
  const value = payload.activeValves ?? payload.currentValves ?? payload.valves ?? payload.valves_on;
  if (Array.isArray(value)) {
    return value.map(Number).filter((item) => item >= 1 && item <= 32);
  }
  const singleValve = payload.valveNo ?? payload.valveNumber ?? payload.valve;
  if (singleValve && normalizeBoolean(payload.valveOn ?? payload.valve_on ?? true)) {
    const parsed = Number(singleValve);
    return parsed >= 1 && parsed <= 32 ? [parsed] : [];
  }
  return [];
}

function logOperation(deviceId, action, detail, result, source) {
  db.prepare(
    `INSERT INTO operation_logs (device_id, action, detail, result, source)
     VALUES (?, ?, ?, ?, ?)`
  ).run(deviceId, action, detail, result, source);
}

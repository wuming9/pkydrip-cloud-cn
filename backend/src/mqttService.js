import mqtt from 'mqtt';
import { config } from './config.js';
import { db } from './db.js';

const STATE_TOPIC = 'pky/device/+/state';
const ACK_TOPIC = 'pky/device/+/ack';
const HEARTBEAT_TOPIC = 'pky/device/+/heartbeat';

let client;
let mqttConnected = false;

function getDeviceId(topic) {
  const parts = topic.split('/');
  return parts.length >= 4 ? parts[2] : null;
}

export function startMqtt() {
  const options = {};
  if (config.mqttUsername) {
    options.username = config.mqttUsername;
    options.password = config.mqttPassword;
  }

  client = mqtt.connect(config.mqttUrl, options);

  client.on('connect', () => {
    mqttConnected = true;
    console.log(`MQTT connected: ${config.mqttUrl}`);
    client.subscribe([STATE_TOPIC, ACK_TOPIC, HEARTBEAT_TOPIC], (err) => {
      if (err) console.error('MQTT subscribe failed:', err.message);
    });
  });

  client.on('close', () => {
    mqttConnected = false;
  });

  client.on('message', (topic, payloadBuffer) => {
    const deviceId = getDeviceId(topic);
    if (!deviceId) return;

    const rawPayload = payloadBuffer.toString();
    let payload;
    try {
      payload = JSON.parse(rawPayload);
    } catch {
      payload = { raw: rawPayload };
    }

    if (topic.endsWith('/state')) {
      upsertState(deviceId, payload, rawPayload);
      return;
    }

    if (topic.endsWith('/heartbeat')) {
      markDeviceOnline(deviceId, payload, rawPayload);
      return;
    }

    if (topic.endsWith('/ack')) {
      saveAck(deviceId, payload, rawPayload);
    }
  });

  client.on('error', (err) => {
    mqttConnected = false;
    console.error('MQTT error:', err.message);
  });
}

export function publishCommand(deviceId, command, eventName = '设备指令') {
  if (!client || !client.connected) {
    throw new Error('MQTT client is not connected');
  }

  const topic = `pky/device/${deviceId}/cmd`;
  const message = JSON.stringify(command);

  client.publish(topic, message, { qos: 1 });
  db.prepare('UPDATE devices SET last_cmd_json = ? WHERE id = ?').run(message, deviceId);
  logOperation(deviceId, eventName, message, '已发送', 'web');
  return { topic, payload: command };
}

export function getMqttDebug(deviceId) {
  const row = db
    .prepare(
      `SELECT d.last_cmd_json, d.last_ack_json, s.raw_payload
       FROM devices d
       LEFT JOIN device_state s ON s.device_id = d.id
       WHERE d.id = ?`
    )
    .get(deviceId);

  return {
    connected: mqttConnected,
    subscribedTopics: [
      `pky/device/${deviceId}/state`,
      `pky/device/${deviceId}/heartbeat`,
      `pky/device/${deviceId}/ack`
    ],
    commandTopic: `pky/device/${deviceId}/cmd`,
    lastState: parseJson(row?.raw_payload),
    lastCommand: parseJson(row?.last_cmd_json),
    lastAck: parseJson(row?.last_ack_json)
  };
}

function upsertState(topicDeviceId, payload, rawPayload) {
  const deviceId = payload.deviceId || topicDeviceId;
  const now = new Date().toISOString();
  const valveStates = normalizeValveStates(payload.valves);
  const activeValves = valveStates
    .map((value, index) => (value ? index + 1 : null))
    .filter(Boolean);
  const alarmCode = Number(payload.alarmCode ?? 0);

  db.prepare(
    `INSERT OR IGNORE INTO devices
       (id, name, location, online, firmware_version, current_mode, work_status, alarm_code, last_seen_at)
     VALUES (?, ?, '', 1, 'PKY-FW-1.0.0', 'MANUAL', 'IDLE', 0, ?)`
  ).run(deviceId, `灌溉控制器${deviceId}`, now);

  db.prepare(
    `INSERT INTO device_state
       (device_id, pump_on, pump1, pump2, valve_on, valves_json, valves_state_json,
        flow, pressure, ec, ph, raw_payload, updated_at)
     VALUES
       (@device_id, @pump_on, @pump1, @pump2, @valve_on, @valves_json, @valves_state_json,
        @flow, @pressure, @ec, @ph, @raw_payload, @updated_at)
     ON CONFLICT(device_id) DO UPDATE SET
       pump_on = excluded.pump_on,
       pump1 = excluded.pump1,
       pump2 = excluded.pump2,
       valve_on = excluded.valve_on,
       valves_json = excluded.valves_json,
       valves_state_json = excluded.valves_state_json,
       flow = excluded.flow,
       pressure = excluded.pressure,
       ec = excluded.ec,
       ph = excluded.ph,
       raw_payload = excluded.raw_payload,
       updated_at = excluded.updated_at`
  ).run({
    device_id: deviceId,
    pump_on: Number(payload.pump1 || payload.pump2) ? 1 : 0,
    pump1: Number(payload.pump1 || 0) ? 1 : 0,
    pump2: Number(payload.pump2 || 0) ? 1 : 0,
    valve_on: activeValves.length ? 1 : 0,
    valves_json: JSON.stringify(activeValves),
    valves_state_json: JSON.stringify(valveStates),
    flow: Number(payload.flow ?? 0),
    pressure: Number(payload.pressure ?? 0),
    ec: Number(payload.ec ?? 0),
    ph: Number(payload.ph ?? payload.pH ?? 0),
    raw_payload: rawPayload,
    updated_at: payload.lastUpdate || now
  });

  db.prepare(
    `UPDATE devices
     SET online = ?,
         current_mode = COALESCE(?, current_mode),
         work_status = COALESCE(?, work_status),
         alarm_code = ?,
         last_seen_at = ?
     WHERE id = ?`
  ).run(payload.online === false ? 0 : 1, payload.mode || null, payload.workStatus || null, alarmCode, now, deviceId);

  if (alarmCode > 0) {
    logOperation(deviceId, '设备报警', rawPayload, `报警码 ${alarmCode}`, 'mqtt');
  }
}

function markDeviceOnline(topicDeviceId, payload = {}, rawPayload = '{}') {
  const deviceId = payload.deviceId || topicDeviceId;
  const now = new Date().toISOString();
  db.prepare(
    `INSERT OR IGNORE INTO devices
       (id, name, location, online, firmware_version, current_mode, work_status, alarm_code, last_seen_at)
     VALUES (?, ?, '', 1, 'PKY-FW-1.0.0', 'MANUAL', 'IDLE', 0, ?)`
  ).run(deviceId, `灌溉控制器${deviceId}`, now);

  db.prepare(
    `UPDATE devices
     SET online = 1,
         current_mode = COALESCE(?, current_mode),
         work_status = COALESCE(?, work_status),
         last_seen_at = ?
     WHERE id = ?`
  ).run(payload.mode || null, payload.workStatus || null, now, deviceId);

  db.prepare(
    `UPDATE device_state
     SET raw_payload = ?, updated_at = ?
     WHERE device_id = ?`
  ).run(rawPayload, now, deviceId);
}

function saveAck(topicDeviceId, payload, rawPayload) {
  const deviceId = payload.deviceId || topicDeviceId;
  const result = payload.success === false ? '失败' : '成功';
  db.prepare('UPDATE devices SET last_ack_json = ?, last_seen_at = ?, online = 1 WHERE id = ?').run(
    rawPayload,
    new Date().toISOString(),
    deviceId
  );
  logOperation(deviceId, 'ACK结果', rawPayload, result, 'mqtt');
}

function normalizeValveStates(value) {
  if (!Array.isArray(value)) {
    return Array.from({ length: 32 }, () => 0);
  }
  return Array.from({ length: 32 }, (_, index) => (Number(value[index]) ? 1 : 0));
}

function logOperation(deviceId, action, detail, result, source) {
  db.prepare(
    `INSERT INTO operation_logs (device_id, action, detail, result, source)
     VALUES (?, ?, ?, ?, ?)`
  ).run(deviceId, action, detail, result, source);
}

function parseJson(value) {
  try {
    return value ? JSON.parse(value) : null;
  } catch {
    return value || null;
  }
}

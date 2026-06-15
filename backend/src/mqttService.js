import mqtt from 'mqtt';
import { config } from './config.js';
import { db } from './db.js';

const STATE_TOPIC = 'pky/device/+/state';
const ACK_TOPIC = 'pky/device/+/ack';

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
    client.subscribe([STATE_TOPIC, ACK_TOPIC], (err) => {
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
      upsertState(deviceId, payload);
      return;
    }

    if (topic.endsWith('/ack')) {
      logOperation(deviceId, 'device_ack', JSON.stringify(payload), 'mqtt');
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
  logOperation(deviceId, command.type || 'manual_command', message, 'web');
}

function upsertState(deviceId, payload) {
  const now = new Date().toISOString();

  db.prepare(
    `INSERT OR IGNORE INTO devices (id, name, location, online, last_seen_at)
     VALUES (?, ?, ?, 1, ?)`
  ).run(deviceId, `Device ${deviceId}`, '', now);

  db.prepare(
    `INSERT INTO device_state
       (device_id, pump_on, valve_on, flow, pressure, ec, ph, raw_payload, updated_at)
     VALUES
       (@device_id, @pump_on, @valve_on, @flow, @pressure, @ec, @ph, @raw_payload, @updated_at)
     ON CONFLICT(device_id) DO UPDATE SET
       pump_on = excluded.pump_on,
       valve_on = excluded.valve_on,
       flow = excluded.flow,
       pressure = excluded.pressure,
       ec = excluded.ec,
       ph = excluded.ph,
       raw_payload = excluded.raw_payload,
       updated_at = excluded.updated_at`
  ).run({
    device_id: deviceId,
    pump_on: normalizeBoolean(payload.pumpOn ?? payload.pump_on) ? 1 : 0,
    valve_on: normalizeBoolean(payload.valveOn ?? payload.valve_on) ? 1 : 0,
    flow: Number(payload.flow ?? 0),
    pressure: Number(payload.pressure ?? 0),
    ec: Number(payload.ec ?? 0),
    ph: Number(payload.ph ?? payload.pH ?? 0),
    raw_payload: JSON.stringify(payload),
    updated_at: now
  });

  db.prepare(
    `UPDATE devices SET online = 1, last_seen_at = ? WHERE id = ?`
  ).run(now, deviceId);
}

function logOperation(deviceId, action, detail, source) {
  db.prepare(
    `INSERT INTO operation_logs (device_id, action, detail, source)
     VALUES (?, ?, ?, ?)`
  ).run(deviceId, action, detail, source);
}

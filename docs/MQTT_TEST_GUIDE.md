# MQTT Test Guide

PKY Cloud uses these MQTT topics:

- State upload: `pky/device/{deviceId}/state`
- Command downlink: `pky/device/{deviceId}/cmd`
- Device acknowledgment: `pky/device/{deviceId}/ack`

## 1. Start the stack

```bash
cp .env.example .env
docker compose up --build
```

Open:

- App: http://localhost:8080
- EMQX dashboard: http://localhost:18083
- EMQX dashboard login: `admin` / `public`

App login:

- Username: `admin`
- Password: `admin123`

## 2. Publish a device state

Install MQTT CLI tools on Ubuntu if needed:

```bash
sudo apt update
sudo apt install -y mosquitto-clients
```

Publish demo telemetry:

```bash
mosquitto_pub -h localhost -p 1883 -t 'pky/device/demo-001/state' -m '{
  "pumpOn": true,
  "valveOn": true,
  "flow": 12.5,
  "pressure": 2.1,
  "ec": 1.8,
  "ph": 6.2
}'
```

Refresh the dashboard or wait a few seconds. The device dashboard should show pump, valve, flow, pressure, EC, and pH values.

## 3. Watch commands from the web UI

Subscribe to the command topic:

```bash
mosquitto_sub -h localhost -p 1883 -t 'pky/device/demo-001/cmd'
```

In the app, open `demo-001` and click the pump or valve control. The command should appear in the subscriber terminal.

Example command payload:

```json
{
  "type": "pump_control",
  "pumpOn": true,
  "ts": "2026-06-15T00:00:00.000Z"
}
```

## 4. Send a device acknowledgment

```bash
mosquitto_pub -h localhost -p 1883 -t 'pky/device/demo-001/ack' -m '{
  "type": "pump_control",
  "ok": true,
  "message": "Pump command received"
}'
```

The acknowledgment is saved in recent operation logs.

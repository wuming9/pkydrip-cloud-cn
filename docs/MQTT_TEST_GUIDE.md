# PKY Cloud CN V0.3 MQTT 联调指南

本指南用于真实 4G MQTT 灌溉控制器联调。

## Topic

- 状态上报：`pky/device/{deviceId}/state`
- 心跳上报：`pky/device/{deviceId}/heartbeat`
- 指令下发：`pky/device/{deviceId}/cmd`
- 设备确认：`pky/device/{deviceId}/ack`

60 秒内没有收到 state 或 heartbeat，平台会显示设备离线。

## MQTTX 测试

连接：

```text
Host: localhost
Port: 1883
Protocol: mqtt
```

### 1. 模拟 state

Topic:

```text
pky/device/demo-001/state
```

Payload:

```json
{
  "deviceId": "demo-001",
  "online": true,
  "mode": "MANUAL",
  "workStatus": "RUNNING",
  "pump1": 1,
  "pump2": 0,
  "valves": [1, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  "flow": 12.5,
  "pressure": 2.3,
  "ec": 1.8,
  "ph": 5.9,
  "alarmCode": 0,
  "lastUpdate": "2026-06-15 15:00:00"
}
```

### 2. 订阅 cmd

Topic:

```text
pky/device/demo-001/cmd
```

网页点击水泵、阀门、急停、模式切换、Timer 下发、Plan 下发后，MQTTX 应看到对应 cmd 消息。

### 3. 模拟 ack

Topic:

```text
pky/device/demo-001/ack
```

Payload:

```json
{
  "deviceId": "demo-001",
  "cmd": "VALVE_SET",
  "success": true,
  "message": "Valve 1 opened",
  "timestamp": "2026-06-15 15:00:05"
}
```

平台会显示最后命令、执行结果、错误信息和时间，并记录运行日志。

## mosquitto-clients 示例

```bash
mosquitto_pub -h localhost -p 1883 -t 'pky/device/demo-001/state' -m '{
  "deviceId": "demo-001",
  "online": true,
  "mode": "MANUAL",
  "workStatus": "RUNNING",
  "pump1": 1,
  "pump2": 0,
  "valves": [1,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  "flow": 12.5,
  "pressure": 2.3,
  "ec": 1.8,
  "ph": 5.9,
  "alarmCode": 0,
  "lastUpdate": "2026-06-15 15:00:00"
}'
```

```bash
mosquitto_sub -h localhost -p 1883 -t 'pky/device/demo-001/cmd'
```

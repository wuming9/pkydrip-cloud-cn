# PKY Cloud CN V0.3

真实设备联调版。当前版本只做 4G MQTT 灌溉控制器联调，不做水肥配方、不做 AI、不做复杂作物管理、不增加复杂权限、支付、多租户或代理商系统。

## 技术栈

- 前端：Vue 3 + Vite
- 后端：Node.js + Express
- 数据库：SQLite
- MQTT：mqtt.js
- Broker：EMQX via Docker Compose
- 部署：Docker Compose + Nginx

## 页面结构

设备详情页面包含：

- 顶部：设备名称、在线状态、当前模式、报警状态、最后通信时间
- Dashboard：Pump / Valve / Flow / Pressure / EC / pH
- Manual Control：Pump1、Pump2、Valve1-32、Emergency Stop
- Timer Tasks
- Irrigation Plans
- Operation Log
- Debug State，默认隐藏

页面底部显示：

```text
PKY Cloud CN V0.3
真实设备联调版
```

## 快速启动

```bash
cp .env.example .env
docker compose up --build
```

访问：

```text
http://localhost:8080
```

默认账号：

```text
账号：admin
密码：admin123
```

EMQX 控制台：

```text
http://localhost:18083
账号：admin
密码：public
```

## MQTT Topic

- 状态上报：`pky/device/{deviceId}/state`
- 心跳上报：`pky/device/{deviceId}/heartbeat`
- 指令下发：`pky/device/{deviceId}/cmd`
- 设备确认：`pky/device/{deviceId}/ack`

如果 60 秒内没有收到 state 或 heartbeat，平台显示设备离线，并记录运行日志。

## 支持的 State 字段

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

## 下发命令格式

Pump 控制：

```json
{
  "cmd": "PUMP_SET",
  "pump": 1,
  "value": 1
}
```

Valve 控制：

```json
{
  "cmd": "VALVE_SET",
  "valve": 1,
  "value": 1
}
```

急停：

```json
{
  "cmd": "EMERGENCY_STOP"
}
```

模式切换：

```json
{
  "cmd": "MODE_SET",
  "mode": "MANUAL"
}
```

Timer 下发：

```json
{
  "cmd": "TIMER_TASK_SET",
  "task": {
    "name": "Morning irrigation",
    "startTime": "08:00",
    "pump": 1,
    "valves": [1, 2, 3],
    "durationMinutes": 10,
    "enabled": true
  }
}
```

Plan 下发：

```json
{
  "cmd": "PLAN_SET",
  "plan": {
    "name": "Greenhouse Plan",
    "groups": [
      {
        "groupName": "Group A",
        "pump": 1,
        "valves": [1, 3, 5, 6],
        "durationMinutes": 10
      },
      {
        "groupName": "Group B",
        "pump": 1,
        "valves": [9, 10, 23, 24, 25, 26],
        "durationMinutes": 8
      }
    ],
    "enabled": true
  }
}
```

## MQTTX 测试说明

1. 连接 EMQX：

```text
Host: localhost
Port: 1883
Protocol: mqtt
```

2. 模拟 state：

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

3. 订阅 cmd：

Topic:

```text
pky/device/demo-001/cmd
```

点击网页按钮后，MQTTX 应能看到 cmd 消息。

4. 模拟 ack：

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

平台会显示最后命令、执行结果、错误信息和时间，并写入运行日志。

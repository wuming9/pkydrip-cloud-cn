# PKY Cloud CN V0.2 MQTT 联调指南

## Topic

- 状态上报：`pky/device/{deviceId}/state`
- 指令下发：`pky/device/{deviceId}/cmd`
- 设备确认：`pky/device/{deviceId}/ack`
- 心跳上报：`pky/device/{deviceId}/heartbeat`

心跳也可以通过 state topic 上报，只要 payload 中包含 `"type": "heartbeat"`。

## 1. 启动平台

```bash
cp .env.example .env
docker compose up --build
```

打开：

- 平台：http://localhost:8080
- EMQX：http://localhost:18083

平台默认账号：

- 账号：`admin`
- 密码：`admin123`

## 2. 上报设备状态

安装 MQTT 命令行工具：

```bash
sudo apt update
sudo apt install -y mosquitto-clients
```

上报 `demo-001` 状态：

```bash
mosquitto_pub -h localhost -p 1883 -t 'pky/device/demo-001/state' -m '{
  "pumpOn": true,
  "activeValves": [1, 2, 8],
  "flow": 12.5,
  "pressure": 2.1,
  "ec": 1.8,
  "ph": 6.2,
  "firmwareVersion": "PKY-FW-1.0.0",
  "mode": "自动模式",
  "strategy": "番茄开花期策略"
}'
```

进入“设备控制台”，应能看到水泵、阀门、流量、压力、EC、pH、最后通信时间。

## 3. 上报设备心跳

```bash
mosquitto_pub -h localhost -p 1883 -t 'pky/device/demo-001/heartbeat' -m '{
  "firmwareVersion": "PKY-FW-1.0.0",
  "mode": "自动模式",
  "strategy": "番茄开花期策略"
}'
```

也可以使用 state topic：

```bash
mosquitto_pub -h localhost -p 1883 -t 'pky/device/demo-001/state' -m '{
  "type": "heartbeat",
  "firmwareVersion": "PKY-FW-1.0.0"
}'
```

后端会刷新设备在线状态和最后通信时间。超过约 90 秒没有心跳或状态上报，设备会显示离线。

## 4. 监听平台下发指令

```bash
mosquitto_sub -h localhost -p 1883 -t 'pky/device/demo-001/cmd'
```

在平台“设备控制台”中点击水泵启动、水泵停止或阀门 1-32，终端应收到类似消息：

```json
{
  "type": "valve_control",
  "label": "阀门1开启",
  "valveNo": 1,
  "valveOn": true,
  "ts": "2026-06-15T06:30:00.000Z"
}
```

## 5. 上报设备确认

```bash
mosquitto_pub -h localhost -p 1883 -t 'pky/device/demo-001/ack' -m '{
  "type": "valve_control",
  "ok": true,
  "message": "阀门1已开启"
}'
```

平台会在运行日志中记录设备确认结果。

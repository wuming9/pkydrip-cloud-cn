# PKY Cloud CN V0.2

PKY Cloud CN V0.2 是面向中国版场景的农业灌溉云平台界面。当前版本保留简单登录，不增加复杂权限、支付功能、代理商系统或多语言能力。

## 技术栈

- 前端：Vue 3 + Vite
- 后端：Node.js + Express
- 数据库：SQLite
- MQTT：mqtt.js
- Broker：EMQX via Docker Compose
- 部署：Docker Compose + Nginx
- 目标系统：Ubuntu 20.04

## 页面

- 设备控制台
- 作物管理
- 生长阶段
- 灌溉策略
- 设备管理

## 设备控制台

顶部展示：

- 设备名称
- 设备状态
- 当前模式
- 当前策略
- 最后通信时间

业务卡片：

- 今日灌溉统计
- 设备状态
- 手动控制，预留 1-32 路阀门
- 灌溉计划
- 运行日志

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

## 本地开发

```bash
npm install
npm run dev
```

本地地址：

- 前端：http://localhost:5173
- 后端：http://localhost:3000

如果不使用 Docker，需要单独启动 MQTT Broker，并将 `.env` 中的 `MQTT_URL` 改为本机 Broker 地址。

## MQTT Topic

- 状态上报：`pky/device/{deviceId}/state`
- 指令下发：`pky/device/{deviceId}/cmd`
- 设备确认：`pky/device/{deviceId}/ack`
- 心跳上报：可使用 `pky/device/{deviceId}/heartbeat`，也可在 state 消息中带 `type: "heartbeat"`

## 状态上报示例

```json
{
  "pumpOn": true,
  "activeValves": [1, 2, 8],
  "flow": 12.5,
  "pressure": 2.1,
  "ec": 1.8,
  "ph": 6.2,
  "firmwareVersion": "PKY-FW-1.0.0",
  "mode": "自动模式",
  "strategy": "番茄开花期策略"
}
```

后端收到状态或心跳后会刷新设备在线状态和最后通信时间。超过约 90 秒未通信的设备会被标记为离线。

## Ubuntu 20.04 部署

1. 安装 Docker Engine 和 Docker Compose 插件。
2. 上传或克隆项目到服务器。
3. 创建配置文件：

   ```bash
   cp .env.example .env
   ```

4. 修改 `.env` 中的 `JWT_SECRET`、`ADMIN_USERNAME`、`ADMIN_PASSWORD`。
5. 启动服务：

   ```bash
   docker compose up -d --build
   ```

6. 查看运行状态：

   ```bash
   docker compose ps
   ```

SQLite 数据文件保存在 `backend/data/pky-cloud.db`。

## V0.2 说明

- 先做好中国版农业灌溉平台，不做多语言。
- 先围绕作物、策略、灌溉、日志、设备展开。
- 灌溉计划由后端定时检查，到点后发布 MQTT 启动指令，并在运行时长结束后发布停止指令。
- 当前版本仍是单账号登录，生产环境上线前建议增加密码哈希和 HTTPS。

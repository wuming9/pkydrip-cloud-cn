# PKY Cloud H5 V1

PKY Cloud H5 V1 is a runnable first version for greenhouse irrigation monitoring and manual control.

## Stack

- Frontend: Vue 3 + Vite
- Backend: Node.js + Express
- Database: SQLite
- MQTT client: mqtt.js
- Broker: EMQX via Docker Compose
- Deployment: Docker Compose + Nginx
- Target OS: Ubuntu 20.04

## Features

- Login page
- Device list page
- Single device dashboard
- Pump, valve, flow, pressure, EC, and pH display
- Manual pump control
- Manual valve control
- Simple timer irrigation plan that publishes MQTT start and stop commands
- Recent operation logs
- Placeholder recipe page for future fertigation

## Project Structure

```text
.
├── backend
│   ├── db/schema.sql
│   ├── src/config.js
│   ├── src/db.js
│   ├── src/initDb.js
│   ├── src/mqttService.js
│   └── src/server.js
├── docs/MQTT_TEST_GUIDE.md
├── frontend
│   ├── src/api/client.js
│   ├── src/pages
│   ├── src/router
│   └── src/styles/main.css
├── nginx/pky-cloud.conf
├── docker-compose.yml
└── .env.example
```

## Quick Start With Docker Compose

```bash
cp .env.example .env
docker compose up --build
```

Open the app:

```text
http://localhost:8080
```

Default login:

```text
Username: admin
Password: admin123
```

EMQX dashboard:

```text
http://localhost:18083
Username: admin
Password: public
```

## Local Development

Install dependencies:

```bash
npm install
```

Run frontend and backend:

```bash
npm run dev
```

Local URLs:

- Frontend: http://localhost:5173
- Backend: http://localhost:3000

For local development without Docker, start an MQTT broker on `mqtt://localhost:1883` or change `MQTT_URL` in `.env`.

## Environment Variables

Copy `.env.example` to `.env`.

```text
APP_PORT=8080
API_PORT=3000
JWT_SECRET=change-me-in-production
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123
SQLITE_PATH=/app/data/pky-cloud.db
MQTT_URL=mqtt://emqx:1883
MQTT_USERNAME=
MQTT_PASSWORD=
```

For local non-Docker backend development, use:

```text
SQLITE_PATH=./data/pky-cloud.db
MQTT_URL=mqtt://localhost:1883
```

## API Summary

- `POST /api/login`
- `GET /api/devices`
- `GET /api/devices/:deviceId`
- `POST /api/devices/:deviceId/pump`
- `POST /api/devices/:deviceId/valve`
- `GET /api/devices/:deviceId/plans`
- `POST /api/devices/:deviceId/plans`
- `DELETE /api/plans/:planId`
- `GET /api/logs`

## MQTT Topics

- `pky/device/{deviceId}/state`
- `pky/device/{deviceId}/cmd`
- `pky/device/{deviceId}/ack`

See [MQTT test guide](docs/MQTT_TEST_GUIDE.md) for publish and subscribe examples.

## Ubuntu 20.04 Deployment

1. Install Docker Engine and the Docker Compose plugin.
2. Clone or copy this project to the server.
3. Create the environment file:

   ```bash
   cp .env.example .env
   ```

4. Edit `.env` and change `JWT_SECRET`, `ADMIN_USERNAME`, and `ADMIN_PASSWORD`.
5. Start the stack:

   ```bash
   docker compose up -d --build
   ```

6. Check containers:

   ```bash
   docker compose ps
   ```

SQLite data is stored in `backend/data/pky-cloud.db` on the host.

## Notes For V1

- Passwords are plain text to keep V1 minimal. Hash passwords before production use.
- There is one simple admin account and no dealer or tenant system.
- Timer plans are checked by the backend every 30 seconds. When a plan start time matches, the backend publishes a start command and then a stop command after the configured duration.

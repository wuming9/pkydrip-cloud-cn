import dotenv from 'dotenv';

dotenv.config();

export const config = {
  apiPort: Number(process.env.API_PORT || 3000),
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-me',
  adminUsername: process.env.ADMIN_USERNAME || 'admin',
  adminPassword: process.env.ADMIN_PASSWORD || 'admin123',
  sqlitePath: process.env.SQLITE_PATH || './data/pky-cloud.db',
  mqttUrl: process.env.MQTT_URL || 'mqtt://localhost:1883',
  mqttUsername: process.env.MQTT_USERNAME || '',
  mqttPassword: process.env.MQTT_PASSWORD || ''
};

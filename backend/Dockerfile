FROM node:20-bookworm-slim

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY db ./db
COPY src ./src

ENV API_PORT=3000
EXPOSE 3000

CMD ["node", "src/server.js"]

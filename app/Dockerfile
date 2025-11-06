# syntax=docker/dockerfile:1

FROM node:20-alpine AS base

WORKDIR /app

ENV NODE_ENV=development \
  NEXT_TELEMETRY_DISABLED=1 \
  PORT=3000

COPY package.json package-lock.json ./

RUN npm install

COPY . .

EXPOSE 3000

CMD ["npm", "run", "dev", "--", "--hostname", "0.0.0.0", "--port", "3000"]

# API + Telegram bot + Mini App in one container (node >= 20)
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json tsconfig.json ./
RUN npm ci
COPY src ./src
RUN npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
COPY src/db/schema.sql ./src/db/schema.sql
COPY webapp ./webapp
EXPOSE 3000
CMD ["node", "dist/main.js"]

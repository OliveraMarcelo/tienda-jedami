# --- Build stage ---
FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src

RUN npm run build

# --- Production stage ---
FROM node:22-alpine AS production

WORKDIR /app

ENV NODE_ENV=production

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist

# Copiar migrations al dist para que sean accesibles en runtime
COPY src/database/migrations ./dist/database/migrations

EXPOSE 3000

CMD ["node", "dist/index.js"]

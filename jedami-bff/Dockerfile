# ─── Stage 1: Build ──────────────────────────────────────────────────────────
# Compilamos TypeScript a JavaScript en una imagen con todas las devDependencies.
# Esta imagen NO llega a producción; solo produce el directorio dist/.
FROM node:24-alpine AS builder

WORKDIR /app

# Copiar manifests primero para aprovechar la caché de capas de Docker.
# Si package.json no cambia, npm ci reutiliza la capa cacheada.
COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src

# Compilar TypeScript → dist/
RUN npm run build

# ─── Stage 2: Production ─────────────────────────────────────────────────────
# Imagen final: solo runtime, sin devDependencies, sin fuentes TypeScript.
FROM node:24-alpine AS production

WORKDIR /app

# Variable de entorno de Node para modo producción.
# Desactiva mensajes de debug, activa optimizaciones de Express, etc.
ENV NODE_ENV=production

# Instalar solo dependencias de producción (sin devDependencies).
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copiar el build compilado desde el stage anterior.
COPY --from=builder /app/dist ./dist

# Copiar las migraciones SQL: se ejecutan en bootstrap() desde dist/database/migrations.
COPY src/database/migrations ./dist/database/migrations

# Crear carpetas de uploads con los permisos correctos antes de cambiar de usuario.
# Estas carpetas serán montadas como volumen en docker-compose.
RUN mkdir -p uploads/products uploads/branding uploads/banners uploads/announcements

# ─── Seguridad: no correr como root ──────────────────────────────────────────
# node:alpine ya incluye el usuario "node" (uid 1000).
# Le damos ownership de todo /app antes de hacer el switch.
RUN chown -R node:node /app
USER node

# Puerto que expone el servidor Express (ENV.PORT).
EXPOSE 3000

# Comando de inicio: node ejecuta el JS compilado directamente (sin tsx ni ts-node).
CMD ["node", "dist/index.js"]

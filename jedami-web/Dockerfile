# ─── Stage 1: Build ──────────────────────────────────────────────────────────
# Construye la SPA de Vue con Vite. La URL del backend se inyecta en tiempo de
# build via ARG → ENV → VITE_API_URL. En producción con Nginx reverse proxy
# dejamos VITE_API_URL vacío para que las llamadas sean relativas al mismo origen.
FROM node:24-alpine AS builder

WORKDIR /app

# ARG permite pasar el valor en build time: --build-arg VITE_API_URL=https://...
# Si no se pasa, queda vacío y Nginx proxea /api/ internamente.
ARG VITE_API_URL=""

# Vite solo lee variables VITE_* del entorno durante el build.
ENV VITE_API_URL=$VITE_API_URL

# Copiar manifests primero para aprovechar caché.
COPY package.json package-lock.json ./
RUN npm ci

# Copiar todo el código fuente.
COPY . .

# Compilar: genera dist/ con los assets estáticos de la SPA.
# El script "build" corre type-check + vite build en paralelo (npm-run-all2).
RUN npm run build-only

# ─── Stage 2: Nginx (producción) ─────────────────────────────────────────────
# nginx:alpine pesa ~25 MB. Sirve los archivos estáticos y proxea /api/ al BFF.
FROM nginx:alpine AS production

# Eliminar la configuración por defecto de nginx.
RUN rm /etc/nginx/conf.d/default.conf

# Copiar nuestra configuración personalizada.
COPY nginx.conf /etc/nginx/conf.d/jedami.conf

# Copiar el build de Vue al directorio que sirve nginx.
COPY --from=builder /app/dist /usr/share/nginx/html

# nginx corre como root por diseño (bind al puerto 80), pero los workers
# corren como el usuario "nginx" definido en nginx.conf (worker_processes).
EXPOSE 80

# nginx se mantiene en foreground (daemon off) para que Docker pueda manejarlo.
CMD ["nginx", "-g", "daemon off;"]

# Story 14.11: Dominio y SSL en producción — DNS GoDaddy + certbot

Status: ready-for-dev

## Story

Como operador de Jedami,
quiero que `jedamiapp.com` y `www.jedamiapp.com` apunten al Droplet y sirvan con HTTPS,
para que los usuarios lleguen a la aplicación productiva con un dominio real y conexión segura.

## Acceptance Criteria

1. **AC1 — DNS apunta al Droplet:** Los registros A de `jedamiapp.com` y `www.jedamiapp.com` en GoDaddy apuntan a `167.99.145.245`.
2. **AC2 — HTTP redirige a HTTPS:** Cualquier request a `http://jedamiapp.com` o `http://www.jedamiapp.com` resulta en un `301` a `https://`.
3. **AC3 — SSL válido:** El certificado emitido por Let's Encrypt cubre `jedamiapp.com` y `www.jedamiapp.com`. El browser muestra candado verde.
4. **AC4 — Certificado montado en el contenedor:** `/etc/letsencrypt` del host está disponible en el contenedor `jedami-web` como volumen readonly (ya configurado en `docker-compose.prod.yml`).
5. **AC5 — App accesible vía dominio:** `https://jedamiapp.com/catalogo` carga la SPA y las llamadas a `/api/v1/` resuelven correctamente al BFF interno.
6. **AC6 — Renovación automática:** Un cron job en el servidor renueva el certificado antes de que expire y recarga nginx sin downtime.

## Tasks / Subtasks

- [ ] **Task 1 — Registros DNS en GoDaddy** (AC: #1)
  - [ ] 1.1 Ingresar a GoDaddy → My Products → dominio `jedamiapp.com` → Manage DNS
  - [ ] 1.2 Agregar/editar registro A:
    - **Name:** `@` (representa el apex `jedamiapp.com`)
    - **Value:** `167.99.145.245`
    - **TTL:** 600 (10 min para propagación rápida)
  - [ ] 1.3 Agregar registro A para `www`:
    - **Name:** `www`
    - **Value:** `167.99.145.245`
    - **TTL:** 600
  - [ ] 1.4 Esperar propagación DNS (5-30 min). Verificar con:
    ```bash
    dig jedamiapp.com +short
    dig www.jedamiapp.com +short
    # Deben devolver 167.99.145.245
    ```

- [ ] **Task 2 — Instalar certbot en el Droplet** (AC: #3)
  - [ ] 2.1 Conectarse al servidor:
    ```bash
    ssh root@167.99.145.245
    ```
  - [ ] 2.2 Instalar certbot (Ubuntu):
    ```bash
    apt update && apt install -y certbot
    ```
  - [ ] 2.3 Verificar que el puerto 80 está libre en el host (o detener el contenedor `jedami-web` temporalmente):
    ```bash
    # Opción A — certbot standalone (detener jedami-web primero)
    docker compose -f /opt/jedami/docker-compose.prod.yml --env-file /opt/jedami/.env.prod stop jedami-web
    ```

- [ ] **Task 3 — Emitir certificado SSL** (AC: #3, #4)
  - [ ] 3.1 Emitir el certificado con certbot standalone:
    ```bash
    certbot certonly --standalone \
      -d jedamiapp.com \
      -d www.jedamiapp.com \
      --non-interactive \
      --agree-tos \
      -m <tu-email>
    ```
  - [ ] 3.2 Verificar que los archivos existen:
    ```bash
    ls /etc/letsencrypt/live/jedamiapp.com/
    # fullchain.pem  privkey.pem  chain.pem  cert.pem
    ```
  - [ ] 3.3 Levantar nuevamente `jedami-web`:
    ```bash
    docker compose -f /opt/jedami/docker-compose.prod.yml --env-file /opt/jedami/.env.prod up -d jedami-web
    ```

- [ ] **Task 4 — Verificar HTTPS y proxy** (AC: #2, #5)
  - [ ] 4.1 Verificar redirect HTTP→HTTPS:
    ```bash
    curl -I http://jedamiapp.com
    # Esperar: 301 → https://jedamiapp.com
    ```
  - [ ] 4.2 Verificar HTTPS responde 200:
    ```bash
    curl -I https://jedamiapp.com
    # Esperar: 200 OK
    ```
  - [ ] 4.3 Verificar que el API BFF responde vía el proxy:
    ```bash
    curl https://jedamiapp.com/api/v1/health
    # Esperar: {"status":"ok"} o similar
    ```
  - [ ] 4.4 Abrir en el browser: `https://jedamiapp.com/catalogo` — verificar candado verde y que la app carga.

- [ ] **Task 5 — Configurar renovación automática** (AC: #6)
  - [ ] 5.1 Crear script de renovación en `/opt/jedami/renew-ssl.sh`:
    ```bash
    #!/bin/bash
    # Para certbot standalone necesitamos detener nginx brevemente
    docker compose -f /opt/jedami/docker-compose.prod.yml --env-file /opt/jedami/.env.prod stop jedami-web
    certbot renew --standalone --quiet
    docker compose -f /opt/jedami/docker-compose.prod.yml --env-file /opt/jedami/.env.prod up -d jedami-web
    ```
  - [ ] 5.2 Hacer ejecutable:
    ```bash
    chmod +x /opt/jedami/renew-ssl.sh
    ```
  - [ ] 5.3 Agregar cron job (corre el 1ro de cada mes a las 3 AM):
    ```bash
    crontab -e
    # Agregar:
    0 3 1 * * /opt/jedami/renew-ssl.sh >> /var/log/certbot-renew.log 2>&1
    ```
  - [ ] 5.4 Probar renovación en dry-run:
    ```bash
    certbot renew --dry-run
    ```

## Dev Notes

### Contexto de infraestructura actual

El stack completo está en `/opt/jedami/` en el Droplet `167.99.145.245`:

```
/opt/jedami/
├── docker-compose.prod.yml   ← stack productivo
├── .env.prod                 ← variables (ignorado por git)
└── .env.prod.example         ← template de variables
```

El container `jedami-web` ya está configurado para:
- Escuchar en puertos `80:80` y `443:443` del host
- Montar `/etc/letsencrypt:/etc/letsencrypt:ro` desde el host
- Redirigir HTTP→HTTPS (líneas 2-6 de `nginx.conf`)
- Servir el SPA Vue y proxear `/api/` al BFF interno (`jedami-bff:3000`)

**No hay que tocar el código** — la `nginx.conf` ya está lista para `jedamiapp.com`. Solo se necesita:
1. DNS en GoDaddy
2. Certificado en el servidor

### Nginx ya configurado (jedami-web/nginx.conf)

```nginx
server {
    listen 80;
    server_name jedamiapp.com www.jedamiapp.com;
    return 301 https://$host$request_uri;    ← redirect HTTP→HTTPS
}

server {
    listen 443 ssl;
    server_name jedamiapp.com www.jedamiapp.com;
    ssl_certificate     /etc/letsencrypt/live/jedamiapp.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/jedamiapp.com/privkey.pem;
    ...
    location /api/ { proxy_pass http://jedami-bff:3000; }
    location / { try_files $uri $uri/ /index.html; }
}
```

### Alternativa: certbot webroot (sin downtime)

Si se prefiere no bajar `jedami-web` durante la emisión/renovación:

```bash
# En el nginx.conf, agregar dentro del server 80:
location /.well-known/acme-challenge/ {
    root /var/www/certbot;
}
```

Y emitir con:
```bash
certbot certonly --webroot -w /var/www/certbot \
  -d jedamiapp.com -d www.jedamiapp.com \
  --non-interactive --agree-tos -m <tu-email>
```

Esto requiere modificar `nginx.conf` y montar el volumen de challenge en el contenedor. Para simplicidad se usa standalone (downtime < 30 seg).

### Servidor actual

- **IP:** `167.99.145.245`
- **SO:** Ubuntu (en Droplet DigitalOcean)
- **Usuario deploy:** `root`
- **Path del stack:** `/opt/jedami/`
- **Docker Compose version:** compatible con `docker compose` (V2)

### Pasos manuales — no automatizables por CI/CD

Los registros DNS de GoDaddy son un paso **manual**, no se puede automatizar desde el pipeline. Se hace una sola vez. Certbot también se corre directamente en el servidor.

### References

- Nginx config ya lista: `jedami-web/nginx.conf`
- docker-compose.prod.yml: raíz del repo (volumen `/etc/letsencrypt` ya configurado)
- Docs certbot standalone: https://certbot.eff.org/instructions
- Historia de CI/CD base: `_bmad-output/implementation-artifacts/14-8-cicd-github-actions.md`
- Historia de Docker Hub: `_bmad-output/implementation-artifacts/14-9-cicd-build-imagen-docker-hub.md`

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

### File List

- `jedami-web/nginx.conf` (sin cambios — ya configurado)
- `docker-compose.prod.yml` (sin cambios — volumen letsencrypt ya presente)
- `/opt/jedami/renew-ssl.sh` (nuevo — en el servidor, no en el repo)
- Cron job en el servidor (fuera del repo)

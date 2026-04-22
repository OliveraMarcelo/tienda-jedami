# Story 14.8: CI/CD con GitHub Actions — Deploy automático en push a main

Status: done

## Story

Como desarrollador de Jedami,
quiero que cada `git push origin main` dispare automáticamente el deploy en producción,
para no tener que conectarme manualmente al servidor cada vez que hay un cambio.

## Acceptance Criteria

1. **AC1 — Trigger automático:** Hacer `git push origin main` dispara el pipeline sin ninguna acción manual adicional.
2. **AC2 — Build y deploy en el servidor:** El workflow hace SSH al Droplet, ejecuta `git pull` y reconstruye solo los servicios Docker que cambiaron.
3. **AC3 — Variables secretas seguras:** Las credenciales SSH, IP del servidor y demás secrets viven en GitHub Secrets, nunca en el repositorio.
4. **AC4 — Feedback visible:** El estado del deploy (éxito/fallo) es visible en la pestaña Actions de GitHub.
5. **AC5 — Sin downtime de DB/Redis:** Postgres y Redis no se reinician si no tienen cambios. Solo se rebuildan `jedami-bff` y `jedami-web`.
6. **AC6 — Renovación automática de certificado SSL:** Un cron job en el servidor renueva el certificado Let's Encrypt automáticamente antes de que venza.

## Tasks / Subtasks

- [x] **Task 1 — Configurar secrets en GitHub** (AC: #3)
  - [x] 1.1 Generar par de claves SSH dedicado para el deploy (`ssh-keygen -t ed25519 -C "github-actions-deploy"`)
  - [x] 1.2 Agregar la clave pública al servidor: `~/.ssh/authorized_keys`
  - [x] 1.3 Crear los siguientes GitHub Secrets en el repo:
    - `DEPLOY_SSH_KEY` — clave privada ed25519 (contenido completo del archivo)
    - `DEPLOY_HOST` — `167.99.145.245`
    - `DEPLOY_USER` — `root`

- [x] **Task 2 — Crear el workflow de GitHub Actions** (AC: #1, #2, #4, #5)
  - [x] 2.1 Crear `.github/workflows/deploy.yml`
  - [x] 2.2 Configurar trigger: `on: push: branches: [main]`
  - [x] 2.3 Step de SSH: usar `appleboy/ssh-action` para conectarse al servidor
  - [x] 2.4 Comandos en el servidor:
    ```bash
    cd /opt/jedami
    git pull origin main
    docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build jedami-bff jedami-web
    docker image prune -f
    ```
  - [x] 2.5 Verificar que Postgres y Redis **no** se incluyen en el `up --build` (solo bff y web)

- [x] **Task 3 — Configurar renovación automática del certificado SSL** (AC: #6)
  - [x] 3.1 Crear script `/opt/jedami/renew-ssl.sh` que pare nginx de Docker, renueve con certbot, y lo levante
  - [x] 3.2 Agregar cron en el servidor: `0 3 * * 1 /opt/jedami/renew-ssl.sh >> /var/log/renew-ssl.log 2>&1` (cada lunes a las 3am)

- [x] **Task 4 — Verificar pipeline end-to-end** (AC: #1, #2, #4)
  - [x] 4.1 Hacer un commit de prueba y verificar que Actions ejecuta correctamente
  - [x] 4.2 Confirmar que `https://www.jedamiapp.com` sigue funcionando después del deploy

### Review Follow-ups (AI)
- [x] [AI-Review][HIGH] Unificar Node version: ci.yml 22 → 24 para coincidir con deploy.yml [.github/workflows/ci.yml:23]
- [x] [AI-Review][MEDIUM] Eliminar trigger push:main de ci.yml — duplicaba CI con deploy.yml [.github/workflows/ci.yml:4]
- [x] [AI-Review][MEDIUM] Agregar health-check post-deploy en deploy.yml [.github/workflows/deploy.yml]

## Dev Notes

### Contexto de infraestructura actual

El deploy manual que se venía haciendo es exactamente:
```bash
ssh root@167.99.145.245
cd /opt/jedami
git pull origin main
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
```

El workflow de GitHub Actions replica exactamente esto usando `appleboy/ssh-action`, que ejecuta comandos remotos vía SSH.

### Estructura de archivos a crear/modificar

```
tienda-jedami/
└── .github/
    └── workflows/
        └── deploy.yml          ← CREAR (nuevo)
/opt/jedami/
└── renew-ssl.sh                ← CREAR en el servidor (no va al repo)
```

### Secrets de GitHub requeridos

| Secret | Valor | Cómo obtener |
|--------|-------|--------------|
| `DEPLOY_SSH_KEY` | Clave privada SSH (ed25519) | `ssh-keygen -t ed25519` en local, copiar contenido de `~/.ssh/id_deploy` |
| `DEPLOY_HOST` | `167.99.145.245` | IP del Droplet |
| `DEPLOY_USER` | `root` | Usuario en el servidor |

> **Importante:** La clave pública (`id_deploy.pub`) debe estar en `/root/.ssh/authorized_keys` del servidor. La clave privada va SOLO en GitHub Secrets.

### Workflow deploy.yml — estructura esperada

```yaml
name: Deploy a producción

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Deploy vía SSH
        uses: appleboy/ssh-action@v1.0.3
        with:
          host: ${{ secrets.DEPLOY_HOST }}
          username: ${{ secrets.DEPLOY_USER }}
          key: ${{ secrets.DEPLOY_SSH_KEY }}
          script: |
            cd /opt/jedami
            git pull origin main
            docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build jedami-bff jedami-web
            docker image prune -f
```

### Decisión clave: solo rebuildar bff y web

`docker compose up --build jedami-bff jedami-web` (sin postgres ni redis) garantiza:
- Los datos de Postgres no se tocan
- Redis no pierde su caché
- El deploy es más rápido (~2 min vs ~4 min)
- Postgres y Redis solo se recrean si cambia su configuración en docker-compose.prod.yml

### Renovación SSL automática

Los certificados de Let's Encrypt vencen cada 90 días. El script `renew-ssl.sh` debe:
1. Parar el contenedor nginx (`docker compose stop jedami-web`)
2. Renovar con certbot standalone (`certbot renew`)
3. Levantar nginx de nuevo (`docker compose start jedami-web`)

El cron corre los lunes a las 3am — certbot solo renueva si el cert vence en menos de 30 días.

### Project Structure Notes

- El archivo `.github/workflows/deploy.yml` va en la raíz del monorepo
- El script `renew-ssl.sh` vive solo en el servidor (`/opt/jedami/`), no se commitea al repo
- El `.env.prod` ya está en `.gitignore` — nunca debe ir al repo

### References

- Stack de deploy actual: `docker-compose.prod.yml` en raíz del repo
- Servidor: Ubuntu, `/opt/jedami`, usuario `root`
- Dominio: `https://www.jedamiapp.com` (certificado Let's Encrypt válido hasta 2026-07-19)
- Acción SSH recomendada: `appleboy/ssh-action@v1.0.3` — la más usada en GitHub Actions para deploys SSH
- [Docs appleboy/ssh-action](https://github.com/appleboy/ssh-action)

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

Verificado en producción vía SSH: deploy.yml activo, renew-ssl.sh existe, cron configurado `0 3 * * 1`.
Commit `cad53fe` confirma ejecución exitosa del pipeline end-to-end.

### Senior Developer Review (AI)

**Outcome:** Changes Requested | **Date:** 2026-04-21

**Action Items:**
- [x] [HIGH] Node version inconsistente: ci.yml usaba Node 22, deploy.yml usa Node 24
- [x] [MEDIUM] CI duplicado en push a main: ci.yml y deploy.yml corrían lint+build dos veces
- [x] [MEDIUM] Sin health-check post-deploy: workflow reportaba éxito aunque el BFF no levantara

### Completion Notes List

- Todos los ACs implementados y verificados en producción antes de este registro
- Fixes post-review: Node unificado a 24, CI deduplicado, health-check agregado al deploy
- ci.yml ahora solo corre en pull_request (CI gate para PRs)
- deploy.yml contiene CI gate + deploy + verificación de salud del BFF

### File List

- `.github/workflows/deploy.yml`
- `.github/workflows/ci.yml`
- `/opt/jedami/renew-ssl.sh` (en servidor, no en repo)

# Story 14.9: CI/CD — Build de imágenes Docker en el runner y push a Docker Hub

Status: done

## Story

Como desarrollador de Jedami,
quiero que el runner de GitHub Actions construya las imágenes Docker de `jedami-bff` y `jedami-web` y las pushee a Docker Hub,
para que el servidor de producción solo haga `docker pull` y el deploy baje de 10-15 minutos a menos de 2 minutos.

## Acceptance Criteria

1. **AC1 — Build en el runner:** Las imágenes `jedami-bff` y `jedami-web` se buildean en el runner de GitHub Actions, no en el Droplet.
2. **AC2 — Push a Docker Hub:** Las imágenes se pushean a Docker Hub con el tag `latest` y con el SHA del commit como tag adicional.
3. **AC3 — Deploy sin build:** El servidor hace `docker compose pull` + `docker compose up -d` sin el flag `--build`. Postgres y Redis no se tocan.
4. **AC4 — Credenciales seguras:** Las credenciales de Docker Hub viven en GitHub Secrets, nunca en el repositorio.
5. **AC5 — Health-check preservado:** El step de verificación del BFF (`/api/v1/health`) sigue funcionando después del deploy.
6. **AC6 — Tiempo de deploy:** El paso de deploy en el servidor (pull + up) tarda menos de 2 minutos.
7. **AC7 — docker-compose.prod.yml usa imágenes del registry:** Los servicios `jedami-bff` y `jedami-web` referencian las imágenes de Docker Hub en vez de tener `build:` context.

## Tasks / Subtasks

- [x] **Task 1 — Configurar credenciales Docker Hub en GitHub Secrets** (AC: #4)
  - [x] 1.1 Cuenta Docker Hub existente: `marceloo20`
  - [x] 1.2 Access Token creado por el usuario
  - [x] 1.3 GitHub Secrets configurados: `DOCKERHUB_USERNAME` + `DOCKERHUB_TOKEN`

- [x] **Task 2 — Actualizar docker-compose.prod.yml para usar imágenes del registry** (AC: #3, #7)
  - [x] 2.1 jedami-bff: `image: ${DOCKERHUB_USERNAME}/jedami-bff:latest`
  - [x] 2.2 jedami-web: `image: ${DOCKERHUB_USERNAME}/jedami-web:latest`
  - [x] 2.3 `DOCKERHUB_USERNAME` agregado a `.env.prod.example`
  - [x] 2.4 Servidor recibe `DOCKERHUB_USERNAME` vía `envs:` del SSH action

- [x] **Task 3 — Actualizar deploy.yml con build + push en el runner** (AC: #1, #2, #3, #5)
  - [x] 3.1 Job `build-and-push` con docker/login-action@v3 + docker/build-push-action@v6
  - [x] 3.2 `deploy` depends on `[ci, build-and-push]`
  - [x] 3.3 `docker compose pull` + `docker compose up -d` sin `--build`
  - [x] 3.4 Health-check preservado y movido antes del `docker image prune`

- [x] **Task 4 — Verificar pipeline end-to-end** (AC: #1, #2, #3, #5, #6)
  - [x] 4.1 Pipeline disparado con commit `c6b06df`
  - [x] 4.2 Imágenes en Docker Hub con tags `latest` y SHA
  - [x] 4.3 Sitio verificado post-deploy
  - [x] 4.4 Deploy en servidor < 2 minutos

### Review Follow-ups (AI)
- [x] [AI-Review][HIGH] Task 2.3 faltaba: DOCKERHUB_USERNAME agregado a .env.prod.example
- [x] [AI-Review][MEDIUM] Comentario desactualizado en docker-compose.prod.yml — removido `--build`
- [x] [AI-Review][MEDIUM] docker image prune movido después del health-check
- [x] [AI-Review][LOW] export redundante removido del script SSH

## Dev Notes

### Contexto del problema actual

El deploy actual hace `docker compose up -d --build jedami-bff jedami-web` directamente en el Droplet. Esto significa que el Droplet (1 vCPU / 2 GB RAM) tiene que:
1. Correr `npm ci` para instalar dependencias
2. Correr `vite build` para compilar Vue
3. Compilar el TypeScript del BFF

Todo esto tarda 10-15 minutos. El runner de GitHub Actions tiene 4 vCPUs y 16 GB RAM — el mismo build tarda ~1-2 minutos.

### Estructura de archivos a modificar

```
tienda-jedami/
├── .github/workflows/deploy.yml        ← MODIFICAR (nuevo job build-and-push)
├── docker-compose.prod.yml             ← MODIFICAR (image: en vez de build:)
└── .env.prod.example                   ← MODIFICAR (agregar DOCKERHUB_USERNAME)
```

### Estado actual del deploy.yml

```yaml
jobs:
  ci:          # lint + build — ya existe
  deploy:      # SSH + docker compose up --build — MODIFICAR
    needs: ci
```

### Estado objetivo del deploy.yml

```yaml
jobs:
  ci:                 # lint + build — sin cambios
  build-and-push:     # NUEVO — build imágenes + push a Docker Hub
    needs: ci
  deploy:             # SSH + docker pull + docker compose up — MODIFICAR
    needs: [ci, build-and-push]
```

### Estructura del job build-and-push

```yaml
build-and-push:
  name: Build & Push → Docker Hub
  needs: ci
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4

    - name: Login a Docker Hub
      uses: docker/login-action@v3
      with:
        username: ${{ secrets.DOCKERHUB_USERNAME }}
        password: ${{ secrets.DOCKERHUB_TOKEN }}

    - name: Build y push jedami-bff
      uses: docker/build-push-action@v6
      with:
        context: ./jedami-bff
        push: true
        tags: |
          ${{ secrets.DOCKERHUB_USERNAME }}/jedami-bff:latest
          ${{ secrets.DOCKERHUB_USERNAME }}/jedami-bff:${{ github.sha }}

    - name: Build y push jedami-web
      uses: docker/build-push-action@v6
      with:
        context: ./jedami-web
        push: true
        tags: |
          ${{ secrets.DOCKERHUB_USERNAME }}/jedami-web:latest
          ${{ secrets.DOCKERHUB_USERNAME }}/jedami-web:${{ github.sha }}
        build-args: |
          VITE_API_URL=
```

### Cambios en docker-compose.prod.yml

```yaml
# ANTES:
jedami-bff:
  build:
    context: ./jedami-bff
    dockerfile: Dockerfile

# DESPUÉS:
jedami-bff:
  image: ${DOCKERHUB_USERNAME}/jedami-bff:latest
```

```yaml
# ANTES:
jedami-web:
  build:
    context: ./jedami-web
    dockerfile: Dockerfile
    args:
      VITE_API_URL: ""

# DESPUÉS:
jedami-web:
  image: ${DOCKERHUB_USERNAME}/jedami-web:latest
```

### Script SSH en el servidor (deploy.yml)

```bash
# ANTES:
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build jedami-bff jedami-web

# DESPUÉS:
docker compose -f docker-compose.prod.yml --env-file .env.prod pull jedami-bff jedami-web
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d jedami-bff jedami-web
```

El servidor necesita estar logueado en Docker Hub para poder hacer `pull` de imágenes (aunque sean públicas, el login evita rate limiting). Agregar al script SSH:

```bash
echo "$DOCKER_TOKEN" | docker login -u "$DOCKER_USER" --password-stdin
```

O directamente hacer las imágenes públicas en Docker Hub (más simple, sin necesidad de login en el server).

### Acción recomendada para el servidor

La opción más simple: hacer los repositorios de Docker Hub **públicos**. Así el servidor puede hacer `docker pull` sin autenticarse. Solo el runner necesita credenciales (para el push).

### Variables en .env.prod del servidor

Agregar en `/opt/jedami/.env.prod`:
```
DOCKERHUB_USERNAME=<tu_usuario_docker_hub>
```

### References

- Stack CI/CD actual: `.github/workflows/deploy.yml`
- docker-compose.prod.yml: raíz del repo
- Servidor: Ubuntu, `/opt/jedami/`, usuario `root`, IP `167.99.145.245`
- Acción build+push recomendada: `docker/build-push-action@v6` (la más usada, soporta multi-platform y cache)
- Acción login recomendada: `docker/login-action@v3`
- [Docs docker/build-push-action](https://github.com/docker/build-push-action)
- [Docs docker/login-action](https://github.com/docker/login-action)

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

Pipeline inicial tardaba 20+ min por build en el Droplet (1 vCPU). Con esta implementación el build pasa al runner de GitHub Actions y el deploy en el servidor baja a < 2 min.

### Senior Developer Review (AI)

**Outcome:** Changes Requested | **Date:** 2026-04-22

**Action Items:**
- [x] [HIGH] DOCKERHUB_USERNAME faltaba en .env.prod.example
- [x] [MEDIUM] Comentario `--build` desactualizado en docker-compose.prod.yml
- [x] [MEDIUM] docker image prune ejecutaba antes del health-check
- [x] [LOW] export redundante en script SSH

### Completion Notes List

- Secrets DOCKERHUB_USERNAME y DOCKERHUB_TOKEN configurados en GitHub
- docker-compose.prod.yml: build: context reemplazado por image: para bff y web
- deploy.yml: nuevo job build-and-push (runner) → deploy solo hace pull
- Fixes post-review aplicados en el mismo ciclo

### File List

- `.github/workflows/deploy.yml`
- `docker-compose.prod.yml`
- `.env.prod.example`

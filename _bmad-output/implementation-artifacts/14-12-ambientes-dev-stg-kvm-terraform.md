# Story 14.12: Infraestructura — Ambientes Dev y Staging con KVM + Terraform

Status: review

## Story

Como desarrollador de Jedami,
quiero provisionar dos VMs locales (dev y stg) usando Terraform con el provider libvirt/KVM,
para tener un pipeline completo de tres ambientes (dev → stg → prod) donde puedo validar
cambios antes de llegar a producción en DigitalOcean, sin incurrir en costos extra de cloud.

## Contexto

- **Host machine:** PC del desarrollador con KVM/libvirt instalado
- **dev VM:** `jedami.dev.local` — recibe cada push a `main` automáticamente
- **stg VM:** `jedami.stg.local` — recibe tags `-rc.*` (release candidates)
- **prod (DigitalOcean):** recibe tags `v*.*.*` sin sufijo (ya configurado en deploy.yml)
- Los GitHub Actions runners para dev y stg son **self-hosted** en el host (la misma PC),
  ya que las VMs no son accesibles desde internet
- Terraform gestiona el ciclo de vida de las VMs (crear, destruir, recrear)
- Cada VM tiene su propia base de datos PostgreSQL y Redis (aisladas entre sí)

## Flujo de versiones por ambiente

```
push a main
  → imagen edge (SHA)
  → deploy automático a jedami.dev.local

push tag v1.1.0-rc.1
  → imagen 1.1.0-rc.1
  → deploy automático a jedami.stg.local
  → QA / validación manual

push tag v1.1.0
  → imagen 1.1.0 + latest
  → deploy automático a DigitalOcean (prod)
```

## Acceptance Criteria

1. **AC1 — Terraform config:** Existe `infra/terraform/` con configuración que provee
   dos VMs KVM usando el provider `dmacvicar/libvirt`. Cada VM tiene CPU, RAM y disco
   configurables por variable.

2. **AC2 — Cloud-init:** Cada VM se inicializa con cloud-init al bootear:
   instala Docker, Docker Compose plugin, configura usuario `jedami` con clave SSH,
   y habilita acceso desde el host sin contraseña.

3. **AC3 — Red interna:** Ambas VMs están en la red bridge de libvirt (`virbr0` o
   una red dedicada `jedami-net`) y son alcanzables desde el host por hostname
   (`jedami.dev.local`, `jedami.stg.local`) via `/etc/hosts` o dnsmasq.

4. **AC4 — Self-hosted runner:** El runner de GitHub Actions está instalado en el host
   (no dentro de las VMs) y registrado en el repo con labels `self-hosted`, `jedami-local`.
   Puede alcanzar ambas VMs por hostname.

5. **AC5 — Workflow deploy-dev:** Existe `.github/workflows/deploy-dev.yml` que:
   - Se dispara en push a `main`
   - Buildea y pushea imagen con tags `edge` y SHA a Docker Hub
   - Deploya en `jedami.dev.local` via SSH desde el runner self-hosted

6. **AC6 — Workflow deploy-stg:** Existe `.github/workflows/deploy-stg.yml` que:
   - Se dispara en tags `v*.*.*-rc.*`
   - Buildea y pushea imagen con el tag del RC (ej: `1.1.0-rc.1`) a Docker Hub
   - Deploya en `jedami.stg.local` via SSH desde el runner self-hosted

7. **AC7 — docker-compose por ambiente:** Existen `docker-compose.dev.yml` y
   `docker-compose.stg.yml` con la configuración apropiada para cada ambiente
   (puertos expuestos, variables de entorno, sin TLS/certbot).

8. **AC8 — Variables de entorno por ambiente:** Existe documentación de qué archivo
   `.env` necesita cada VM (`.env.dev`, `.env.stg`). Los archivos reales viven en
   el servidor, nunca en el repo.

9. **AC9 — Health check post-deploy:** Ambos workflows verifican que el BFF responde
   en `/api/v1/health` antes de reportar el deploy como exitoso.

10. **AC10 — Makefile targets:** El Makefile raíz tiene targets para operar las VMs:
    - `make infra-up` — `terraform apply` (crea/actualiza las VMs)
    - `make infra-down` — `terraform destroy` (borra las VMs)
    - `make infra-plan` — `terraform plan` (muestra cambios sin aplicar)

## Tasks / Subtasks

- [ ] **Task 1 — Prerequisitos en el host** (AC: #4)
  - [ ] 1.1 Verificar que KVM/libvirt está instalado: `virsh list --all`
  - [ ] 1.2 Instalar Terraform si no está: `terraform --version`
  - [ ] 1.3 Instalar provider libvirt de Terraform: declararlo en `infra/terraform/main.tf`
  - [ ] 1.4 Registrar self-hosted runner en GitHub: Settings → Actions → Runners → New self-hosted runner
  - [ ] 1.5 Crear servicio systemd para que el runner arranque automáticamente con el host

- [ ] **Task 2 — Estructura de directorios** (AC: #1)
  - [ ] 2.1 Crear `infra/terraform/` con archivos:
    - `main.tf` — provider libvirt + recursos de VMs
    - `variables.tf` — CPU, RAM, disco, IPs por ambiente
    - `outputs.tf` — IPs asignadas a cada VM
    - `cloud-init-dev.yaml` — cloud-init para la VM dev
    - `cloud-init-stg.yaml` — cloud-init para la VM stg
  - [ ] 2.2 Crear `infra/terraform/.gitignore` para excluir `terraform.tfstate*` y `.terraform/`

- [ ] **Task 3 — Configuración Terraform** (AC: #1, #2, #3)
  - [ ] 3.1 Definir provider `dmacvicar/libvirt` con `uri = "qemu:///system"`
  - [ ] 3.2 Definir recurso `libvirt_volume` para imagen base Ubuntu 22.04 cloud
  - [ ] 3.3 Definir `libvirt_domain` para dev VM:
    - 2 vCPUs, 2 GB RAM, 20 GB disco
    - Hostname: `jedami-dev`
    - cloud-init con Docker + usuario jedami + clave SSH del host
  - [ ] 3.4 Definir `libvirt_domain` para stg VM:
    - 2 vCPUs, 2 GB RAM, 20 GB disco
    - Hostname: `jedami-stg`
    - cloud-init con Docker + usuario jedami + clave SSH del host
  - [ ] 3.5 Configurar red: usar `libvirt_network` dedicada o la red default
  - [ ] 3.6 Agregar entradas a `/etc/hosts` del host para `jedami.dev.local` y `jedami.stg.local`

- [ ] **Task 4 — Cloud-init** (AC: #2)
  - [ ] 4.1 Cloud-init instala: `docker.io`, `docker-compose-plugin`, `curl`, `wget`
  - [ ] 4.2 Crea usuario `jedami` con sudo sin contraseña
  - [ ] 4.3 Copia `~/.ssh/id_ed25519.pub` del host como `authorized_keys` del usuario jedami
  - [ ] 4.4 Habilita Docker sin sudo para el usuario jedami
  - [ ] 4.5 Crea directorio `/opt/jedami` con los permisos correctos

- [ ] **Task 5 — docker-compose por ambiente** (AC: #7)
  - [ ] 5.1 Crear `docker-compose.dev.yml`:
    - Imagen `${DOCKERHUB_USERNAME}/jedami-bff:edge`
    - BFF expone puerto 3000 al host (para debugging directo)
    - Sin TLS, sin certbot
    - Variables de entorno desde `.env.dev`
  - [ ] 5.2 Crear `docker-compose.stg.yml`:
    - Imagen `${DOCKERHUB_USERNAME}/jedami-bff:${APP_VERSION}`
    - Similar a prod pero sin dominio público ni Let's Encrypt
    - Variables de entorno desde `.env.stg`

- [ ] **Task 6 — Workflow deploy-dev** (AC: #5, #9)
  - [ ] 6.1 Crear `.github/workflows/deploy-dev.yml`
  - [ ] 6.2 Trigger: `push` a `main`
  - [ ] 6.3 Runner: `self-hosted, jedami-local`
  - [ ] 6.4 Build imagen con tags `edge` + SHA → push a Docker Hub
  - [ ] 6.5 SSH a `jedami.dev.local`: `docker compose -f docker-compose.dev.yml pull && up -d`
  - [ ] 6.6 Health check: `wget -qO- http://jedami.dev.local:3000/api/v1/health`

- [ ] **Task 7 — Workflow deploy-stg** (AC: #6, #9)
  - [ ] 7.1 Crear `.github/workflows/deploy-stg.yml`
  - [ ] 7.2 Trigger: `push` a tags `v*.*.*-rc.*`
  - [ ] 7.3 Runner: `self-hosted, jedami-local`
  - [ ] 7.4 Extraer versión del tag (ej: `1.1.0-rc.1`) → build imagen → push a Docker Hub
  - [ ] 7.5 SSH a `jedami.stg.local`: deploy con la versión RC
  - [ ] 7.6 Health check: `wget -qO- http://jedami.stg.local:3000/api/v1/health`

- [ ] **Task 8 — Makefile targets** (AC: #10)
  - [ ] 8.1 Agregar targets `infra-up`, `infra-down`, `infra-plan` al Makefile raíz
  - [ ] 8.2 Cada target corre `terraform` desde `infra/terraform/`

- [ ] **Task 9 — Documentación** (AC: #8)
  - [ ] 9.1 Crear `infra/README.md` con:
    - Prerequisitos del host (KVM, Terraform, runner)
    - Cómo registrar el runner
    - Variables de entorno necesarias en cada VM
    - Cómo hacer `terraform apply` la primera vez
    - Cómo hacer rollback en stg (cambiar tag del RC)

## Notas técnicas

- **Provider libvirt:** `registry.terraform.io/dmacvicar/libvirt` — requiere `libvirt-dev` en el host
- **Imagen base:** Ubuntu 22.04 cloud image (`.img` QCOW2) descargada una vez y usada como volumen base
- **Estado de Terraform:** `terraform.tfstate` vive localmente en el host, NO en el repo (gitignored)
- **Runner self-hosted:** corre como el usuario del desarrollador en el host, tiene acceso SSH a las VMs
- **Clave SSH:** el runner usa `~/.ssh/id_ed25519` del host para SSH a las VMs (no requiere secretos adicionales en GitHub para los deploys locales)
- **DOCKERHUB_USERNAME y DOCKERHUB_TOKEN:** sí son GitHub Secrets (compartidos con el workflow de prod)
- **Sin dominio público en dev/stg:** HTTP puro, sin certbot, sin Nginx con TLS

## Dependencias

- Story `14-9` (Docker Hub pipeline) — done ✓
- KVM/libvirt disponible en el host del desarrollador
- Terraform instalado en el host
- Self-hosted runner registrado en el repo antes de correr los workflows

## Definition of Done

- `terraform apply` crea las dos VMs y son accesibles por SSH desde el host
- Push a `main` → deploy automático a `jedami.dev.local` sin intervención manual
- Push de tag `v1.1.0-rc.1` → deploy automático a `jedami.stg.local`
- Ambos health checks pasan en sus respectivos ambientes
- `make infra-down` destruye las VMs limpiamente

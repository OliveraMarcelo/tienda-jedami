# Story 14.10: Infraestructura — Migración de Docker Compose a Kubernetes

Status: ready-for-dev

## Story

Como desarrollador de Jedami,
quiero migrar el stack de producción de Docker Compose en un único Droplet a Kubernetes (k3s single-node o DOKS),
para obtener self-healing automático de contenedores, gestión declarativa de recursos, y una base sólida para escalar horizontalmente cuando el negocio lo requiera.

## Acceptance Criteria

1. **AC1 — Manifests Kubernetes:** Existen manifests YAML para todos los servicios del stack (`jedami-bff`, `jedami-web`, `postgres`, `redis`) como Deployments/StatefulSets y Services en `k8s/`.
2. **AC2 — Secrets seguros:** Las variables de entorno sensibles (DB password, JWT secret, Redis password, MP tokens) viven en Kubernetes Secrets, nunca en los manifests versionados.
3. **AC3 — Health checks preservados:** `jedami-bff` tiene `readinessProbe` y `livenessProbe` apuntando a `/api/v1/health`. `jedami-web` tiene `readinessProbe` HTTP.
4. **AC4 — Ingress con TLS:** El tráfico HTTP/HTTPS llega a `jedami-web` vía Ingress Controller (nginx-ingress). Los certificados TLS son gestionados por cert-manager (Let's Encrypt).
5. **AC5 — Persistencia preservada:** Los datos de PostgreSQL y Redis sobreviven a reinicios de pods mediante PersistentVolumeClaims.
6. **AC6 — Imágenes Docker Hub:** Los Deployments referencian `marceloo20/jedami-bff:latest` y `marceloo20/jedami-web:latest` (ya pusheadas por el pipeline de story 14-9).
7. **AC7 — CI/CD actualizado:** El pipeline de GitHub Actions reemplaza el SSH + `docker compose up` por `kubectl apply -f k8s/` usando un KUBECONFIG almacenado en GitHub Secrets.
8. **AC8 — Zero downtime deploy:** El Deployment de `jedami-bff` y `jedami-web` tiene `strategy: RollingUpdate` para deploys sin corte de servicio.

## Tasks / Subtasks

- [ ] **Task 1 — Elegir y preparar la plataforma Kubernetes** (AC: #1)
  - [ ] 1.1 Decidir entre k3s en Droplet existente (opción económica) vs DOKS (opción managed)
  - [ ] 1.2 Si k3s: instalar en el Droplet actual (`curl -sfL https://get.k3s.io | sh -`)
  - [ ] 1.3 Si DOKS: crear cluster desde DigitalOcean panel o CLI (`doctl kubernetes cluster create`)
  - [ ] 1.4 Verificar acceso con `kubectl get nodes`

- [ ] **Task 2 — Crear estructura de manifests** (AC: #1)
  - [ ] 2.1 Crear directorio `k8s/` en la raíz del repo
  - [ ] 2.2 Crear `k8s/namespace.yaml` — namespace `jedami`
  - [ ] 2.3 Crear `k8s/postgres/` — StatefulSet + Service + PVC
  - [ ] 2.4 Crear `k8s/redis/` — StatefulSet + Service + PVC
  - [ ] 2.5 Crear `k8s/jedami-bff/` — Deployment + Service
  - [ ] 2.6 Crear `k8s/jedami-web/` — Deployment + Service

- [ ] **Task 3 — Secrets y ConfigMaps** (AC: #2)
  - [ ] 3.1 Crear `k8s/secrets.yaml.example` (template sin valores reales)
  - [ ] 3.2 Documentar cómo crear el Secret real: `kubectl create secret generic jedami-secrets --from-env-file=.env.prod -n jedami`
  - [ ] 3.3 Agregar `k8s/secrets.yaml` a `.gitignore`

- [ ] **Task 4 — Health checks** (AC: #3)
  - [ ] 4.1 `jedami-bff` Deployment: `readinessProbe` HTTP GET `/api/v1/health` port 3000, `initialDelaySeconds: 30`
  - [ ] 4.2 `jedami-bff` Deployment: `livenessProbe` HTTP GET `/api/v1/health` port 3000, `initialDelaySeconds: 60`
  - [ ] 4.3 `jedami-web` Deployment: `readinessProbe` HTTP GET `/` port 80

- [ ] **Task 5 — Ingress y TLS** (AC: #4)
  - [ ] 5.1 Instalar nginx-ingress controller (`kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/...`)
  - [ ] 5.2 Instalar cert-manager (`kubectl apply -f https://github.com/cert-manager/cert-manager/releases/...`)
  - [ ] 5.3 Crear `k8s/ingress/clusterissuer.yaml` — ClusterIssuer Let's Encrypt
  - [ ] 5.4 Crear `k8s/ingress/ingress.yaml` — reglas HTTP/HTTPS para `jedamiapp.com`
  - [ ] 5.5 Apuntar DNS de `jedamiapp.com` a la IP del Load Balancer o Droplet

- [ ] **Task 6 — CI/CD: kubectl apply** (AC: #7, #8)
  - [ ] 6.1 Agregar `KUBECONFIG` como GitHub Secret (base64 del kubeconfig)
  - [ ] 6.2 Reemplazar el job `deploy` en `.github/workflows/deploy.yml`:
    - SSH action → `kubectl apply -f k8s/`
    - `kubectl rollout status deployment/jedami-bff -n jedami`
    - `kubectl rollout status deployment/jedami-web -n jedami`
  - [ ] 6.3 Agregar `kubectl set image` para forzar pull de `latest` en cada deploy

- [ ] **Task 7 — Verificación end-to-end** (AC: #1-#8)
  - [ ] 7.1 Aplicar todos los manifests: `kubectl apply -f k8s/ -n jedami`
  - [ ] 7.2 Verificar pods corriendo: `kubectl get pods -n jedami`
  - [ ] 7.3 Verificar salud BFF: `kubectl exec -n jedami deploy/jedami-bff -- wget -qO- http://localhost:3000/api/v1/health`
  - [ ] 7.4 Verificar sitio en `https://jedamiapp.com` vía Playwright

## Dev Notes

### Contexto del problema actual

El stack corre en un único Droplet de DigitalOcean (1 vCPU / 1 GB RAM + 2 GB swap agregados en 2026-04-24) con Docker Compose. El BFF sufrió OOM-kill (exit 137) por falta de RAM durante el `docker pull`. Si un contenedor cae, no se reinicia automáticamente salvo `restart: unless-stopped`. Kubernetes provee self-healing real.

### Decisión de plataforma: k3s vs DOKS

**Opción A — k3s en Droplet existente (recomendado para empezar):**
- Costo: $0 adicional (mismo Droplet)
- Limitación: single-node, sin HA
- Ideal para: validar Kubernetes sin costo extra
- Instalación: `curl -sfL https://get.k3s.io | sh -`
- k3s incluye: containerd, CoreDNS, Flannel, Traefik (ingress), metrics-server

**Opción B — DOKS (DigitalOcean Kubernetes managed):**
- Costo: ~$48/mes (2 nodos básicos de $12 + load balancer)
- Ventaja: control plane managed, actualizaciones automáticas, HA
- Ideal para: producción con SLA real

### Estructura de archivos a crear

```
tienda-jedami/
└── k8s/
    ├── namespace.yaml
    ├── secrets.yaml.example        ← template (sin valores)
    ├── postgres/
    │   ├── statefulset.yaml
    │   ├── service.yaml
    │   └── pvc.yaml
    ├── redis/
    │   ├── statefulset.yaml
    │   ├── service.yaml
    │   └── pvc.yaml
    ├── jedami-bff/
    │   ├── deployment.yaml
    │   └── service.yaml
    ├── jedami-web/
    │   ├── deployment.yaml
    │   └── service.yaml
    └── ingress/
        ├── clusterissuer.yaml
        └── ingress.yaml
```

### Ejemplo de Deployment jedami-bff

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: jedami-bff
  namespace: jedami
spec:
  replicas: 1
  strategy:
    type: RollingUpdate
  selector:
    matchLabels:
      app: jedami-bff
  template:
    metadata:
      labels:
        app: jedami-bff
    spec:
      containers:
        - name: jedami-bff
          image: marceloo20/jedami-bff:latest
          imagePullPolicy: Always
          ports:
            - containerPort: 3000
          envFrom:
            - secretRef:
                name: jedami-secrets
          readinessProbe:
            httpGet:
              path: /api/v1/health
              port: 3000
            initialDelaySeconds: 30
            periodSeconds: 15
          livenessProbe:
            httpGet:
              path: /api/v1/health
              port: 3000
            initialDelaySeconds: 60
            periodSeconds: 30
          resources:
            requests:
              memory: "128Mi"
              cpu: "100m"
            limits:
              memory: "512Mi"
              cpu: "500m"
```

### Ejemplo de StatefulSet postgres

```yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: postgres
  namespace: jedami
spec:
  selector:
    matchLabels:
      app: postgres
  serviceName: postgres
  replicas: 1
  template:
    metadata:
      labels:
        app: postgres
    spec:
      containers:
        - name: postgres
          image: postgres:16-alpine
          envFrom:
            - secretRef:
                name: jedami-secrets
          volumeMounts:
            - name: postgres-data
              mountPath: /var/lib/postgresql/data
  volumeClaimTemplates:
    - metadata:
        name: postgres-data
      spec:
        accessModes: ["ReadWriteOnce"]
        resources:
          requests:
            storage: 5Gi
```

### Actualización CI/CD (deploy.yml)

```yaml
# REEMPLAZAR el job deploy actual:
deploy:
  name: Deploy → Kubernetes
  needs: [ci, build-and-push]
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4

    - name: Configurar kubectl
      uses: azure/setup-kubectl@v3

    - name: Configurar kubeconfig
      run: |
        mkdir -p ~/.kube
        echo "${{ secrets.KUBECONFIG }}" | base64 -d > ~/.kube/config

    - name: Forzar pull de imagen nueva
      run: |
        kubectl set image deployment/jedami-bff \
          jedami-bff=${{ secrets.DOCKERHUB_USERNAME }}/jedami-bff:${{ github.sha }} \
          -n jedami
        kubectl set image deployment/jedami-web \
          jedami-web=${{ secrets.DOCKERHUB_USERNAME }}/jedami-web:${{ github.sha }} \
          -n jedami

    - name: Esperar rollout
      run: |
        kubectl rollout status deployment/jedami-bff -n jedami --timeout=120s
        kubectl rollout status deployment/jedami-web -n jedami --timeout=120s
```

### Variables de entorno como Kubernetes Secret

```bash
# Crear secret desde el .env.prod existente
kubectl create secret generic jedami-secrets \
  --from-env-file=/opt/jedami/.env.prod \
  -n jedami
```

Variables requeridas (ver `.env.prod.example`):
- `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`
- `REDIS_PASSWORD`
- `JWT_SECRET`, `JWT_EXPIRES_IN`, `JWT_REFRESH_EXPIRES_IN`
- `MP_PUBLIC_KEY`, `MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET`
- `DOCKERHUB_USERNAME`
- `CORS_ORIGIN`, `FRONTEND_URL`

### Precaución: migración de datos

Los volúmenes actuales de Docker Compose (`postgres_data`, `redis_data`, `uploads_data`) están en el host del Droplet bajo `/var/lib/docker/volumes/`. Al migrar a Kubernetes:
- Hacer `pg_dump` antes de la migración
- Restaurar en el StatefulSet de postgres con `pg_restore`
- El volumen `uploads_data` (imágenes de productos) debe migrarse al PVC de uploads

### References

- Stack actual: `docker-compose.prod.yml` (raíz del repo)
- Pipeline CI/CD: `.github/workflows/deploy.yml`
- Imágenes Docker Hub: `marceloo20/jedami-bff`, `marceloo20/jedami-web`
- Story 14-9: build de imágenes en runner + push a Docker Hub (ya completo)
- Servidor actual: Ubuntu, `/opt/jedami/`, IP `167.99.145.245`
- k3s docs: https://k3s.io
- DOKS docs: https://docs.digitalocean.com/products/kubernetes/
- cert-manager: https://cert-manager.io/docs/
- nginx-ingress: https://kubernetes.github.io/ingress-nginx/

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

### File List

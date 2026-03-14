# Story W1.1: Setup de jedami-web — Design System JEDAMI

Status: review

## Story

Como desarrollador,
quiero configurar jedami-web con shadcn-vue + Tailwind CSS y los design tokens JEDAMI,
para que todos los componentes siguientes se construyan sobre una base visual y de infraestructura consistente.

**Depende de:** BFF Story 1.1 done (Docker + postgres corriendo, API en `http://localhost:3000`)

## Acceptance Criteria

1. **Given** el proyecto jedami-web está inicializado (Vue 3 + Vite + TypeScript)
   **When** se ejecuta `npm run dev`
   **Then** la app levanta y muestra una página de prueba con la paleta de colores JEDAMI, tipografía Nunito y el componente `ModeIndicator` funcional en modo `retail`

2. **Given** el design system está configurado
   **When** se cambia `data-mode="wholesale"` en el elemento `<html>`
   **Then** el acento de color cambia de magenta `#E91E8C` a azul `#1565C0` y el badge del `ModeIndicator` lo refleja

3. **Given** el cliente Axios está configurado
   **When** se hace cualquier request a la API
   **Then** el header `Authorization: Bearer {token}` se agrega automáticamente si existe token en el store

4. **Given** el setup está completo
   **When** se ejecuta `npm run type-check && npm run build`
   **Then** compila sin errores

## Tasks / Subtasks

- [x] Task 1 — Instalar y configurar Tailwind CSS (AC: #1, #2, #4)
  - [x] `npm install -D tailwindcss @tailwindcss/vite`
  - [x] Configurar `vite.config.ts` para usar el plugin de Tailwind v4
  - [x] Crear/actualizar `src/assets/main.css` con `@import "tailwindcss"`
  - [x] Design tokens vía CSS variables + clases Tailwind inline (shadcn-vue 2.x no soporta Tailwind v4, config manual)

- [x] Task 2 — Instalar shadcn-vue (AC: #1, #4)
  - [x] CLI shadcn-vue no soporta Tailwind v4 — componentes creados manualmente
  - [x] Instalado: `radix-vue class-variance-authority clsx tailwind-merge lucide-vue-next`
  - [x] Componentes en `src/components/ui/`: Button, Badge, Card, Input, Dialog, Sheet, Toast

- [x] Task 3 — Fuente Nunito (AC: #1)
  - [x] Agregado en `index.html` Google Fonts Nunito 400/600/700/800
  - [x] Font aplicada vía CSS variable en main.css

- [x] Task 4 — CSS variables de modo retail/wholesale (AC: #2)
  - [x] Variables definidas en `src/assets/main.css`: `--mode-accent`, `--mode-accent-text`, `--mode-bg`

- [x] Task 5 — Crear componente `ModeIndicator` (AC: #1, #2)
  - [x] `src/components/features/catalog/ModeIndicator.vue` creado
  - [x] Props: `mode: 'retail' | 'wholesale'`, colores bg-[#E91E8C] / bg-[#1565C0]
  - [x] aria-label dinámico

- [x] Task 6 — Configurar cliente Axios con interceptor JWT (AC: #3)
  - [x] `src/api/client.ts` con baseURL desde VITE_API_URL
  - [x] Request interceptor: agrega Bearer token
  - [x] Response interceptor: 401 → logout + redirect a /login

- [x] Task 7 — Crear authStore esqueleto (AC: #3)
  - [x] `src/stores/auth.store.ts`: token, user, isAuthenticated, isAdmin, mode
  - [x] localStorage persistence, fetchMe(), login(), register(), logout()

- [x] Task 8 — Crear layout base (AC: #1)
  - [x] `src/layouts/AppLayout.vue` con header, logo, ModeIndicator, nav links
  - [x] Eliminados: HelloWorld, TheWelcome, WelcomeItem, AboutView, counter.ts, icons/
  - [x] Router actualizado con rutas reales + guards requiresAuth/requiresRole

- [x] Task 9 — Crear `.env.example` (AC: #3)
  - [x] `VITE_API_URL=http://localhost:3000`

## Dev Notes

### Estado actual del código — lo que YA existe (NO recrear)

| Archivo | Estado | Acción |
|---|---|---|
| `jedami-web/src/main.ts` | ✅ Vue 3 + Pinia + Router | Mantener, agregar Tailwind CSS import |
| `jedami-web/src/router/index.ts` | ⚠️ Solo home + about | Reemplazar rutas con las del proyecto |
| `jedami-web/src/stores/counter.ts` | ❌ Placeholder | Eliminar, crear auth.store.ts |
| `jedami-web/package.json` | ✅ axios + pinia + vue-router instalados | Solo agregar tailwindcss + shadcn-vue |
| `jedami-web/vite.config.ts` | ✅ Con alias `@` → `src/` | Agregar plugin de Tailwind |

### Design tokens — tailwind.config.ts

```typescript
// jedami-web/tailwind.config.ts
import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{vue,ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Nunito', 'ui-sans-serif', 'system-ui'],
      },
      colors: {
        brand: {
          primary:   '#E91E8C',  // magenta — CTA, botones
          secondary: '#00BCD4',  // turquesa — acentos, hover
          tertiary:  '#4CAF50',  // verde — stock disponible
          warning:   '#FF9800',  // naranja — stock bajo
          error:     '#F44336',  // rojo — sin stock, errores
          info:      '#1565C0',  // azul — modo wholesale, links
        },
        bg: {
          base: '#F0F8FF',       // celeste muy claro — fondo app
          card: '#FFFFFF',       // blanco — cards
        },
      },
      borderRadius: {
        '2xl': '16px',           // cards JEDAMI
      },
    },
  },
} satisfies Config
```

### CSS variables de modo — main.css

```css
/* src/assets/main.css */
@import "tailwindcss";

@layer base {
  :root {
    --mode-accent: #E91E8C;       /* retail por defecto */
    --mode-accent-text: white;
    --mode-bg: #F0F8FF;
  }

  [data-mode="retail"] {
    --mode-accent: #E91E8C;       /* magenta */
    --mode-accent-text: white;
  }

  [data-mode="wholesale"] {
    --mode-accent: #1565C0;       /* azul profesional */
    --mode-accent-text: white;
  }

  html {
    font-family: 'Nunito', sans-serif;
    background-color: var(--mode-bg);
  }
}
```

### Cómo aplicar data-mode en App.vue

```vue
<!-- src/App.vue -->
<template>
  <div :data-mode="authStore.mode">
    <RouterView />
  </div>
</template>
```

El `authStore` expone `mode: 'retail' | 'wholesale'` derivado de los roles del usuario logueado. Por defecto: `'retail'`.

### Estructura de directorios a crear

```
jedami-web/src/
├── api/
│   └── client.ts              (NUEVO)
├── assets/
│   └── main.css               (MODIFICAR: agregar tokens CSS)
├── components/
│   ├── ui/                    (AUTO-GENERADO por shadcn-vue)
│   │   ├── Button.vue
│   │   ├── Badge.vue
│   │   ├── Card.vue
│   │   ├── Sheet.vue
│   │   ├── Dialog.vue
│   │   ├── Toast.vue
│   │   └── Input.vue
│   └── features/
│       └── catalog/
│           └── ModeIndicator.vue  (NUEVO)
├── layouts/
│   └── AppLayout.vue          (NUEVO)
├── stores/
│   ├── auth.store.ts          (NUEVO)
│   └── counter.ts             (ELIMINAR)
├── router/
│   └── index.ts               (MODIFICAR: rutas reales)
└── views/
    └── HomeView.vue           (LIMPIAR: placeholder temporal)
```

### Rutas en router/index.ts

```typescript
const routes = [
  { path: '/',         redirect: '/catalogo' },
  { path: '/login',    component: () => import('@/views/LoginView.vue') },
  { path: '/registro', component: () => import('@/views/RegisterView.vue') },
  { path: '/catalogo', component: () => import('@/views/CatalogView.vue') },
  { path: '/catalogo/:id', component: () => import('@/views/ProductView.vue') },
  { path: '/pedidos',  component: () => import('@/views/OrdersView.vue'), meta: { requiresAuth: true } },
  { path: '/admin',    component: () => import('@/views/admin/AdminView.vue'), meta: { requiresRole: 'admin' } },
]
```
Las views que no existen todavía se crean como placeholders vacíos — se implementan en stories siguientes.

### ModeIndicator.vue — implementación mínima

```vue
<!-- src/components/features/catalog/ModeIndicator.vue -->
<script setup lang="ts">
defineProps<{ mode: 'retail' | 'wholesale' }>()
</script>

<template>
  <span
    :class="[
      'inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-semibold text-white',
      mode === 'retail' ? 'bg-brand-primary' : 'bg-brand-info'
    ]"
    :aria-label="`Modo de compra activo: ${mode === 'retail' ? 'Minorista' : 'Mayorista'}`"
  >
    {{ mode === 'retail' ? '🛍️ Minorista' : '🏭 Mayorista' }}
  </span>
</template>
```

### API base URL — .env

```
# jedami-web/.env (local, no committear)
VITE_API_URL=http://localhost:3000

# jedami-web/.env.example (sí committear)
VITE_API_URL=http://localhost:3000
```

### References

- UX Design Spec — Design System Foundation: [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Design System Foundation]
- UX Design Spec — Color System y Typography: [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Visual Design Foundation]
- UX Design Spec — ModeIndicator component: [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Custom Components]
- Architecture — jedami-web stack (Vue 3 + Vite + Pinia + Axios + shadcn-vue): [Source: _bmad-output/planning-artifacts/architecture.md#Starters Utilizados]
- Architecture — D9 (shadcn-vue): [Source: _bmad-output/planning-artifacts/architecture.md#D9 — Librería de Componentes UI]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- Task 1: Tailwind v4 instalado con @tailwindcss/vite plugin. No se creó tailwind.config.ts porque Tailwind v4 usa CSS-first config. Design tokens en main.css como CSS variables.
- Task 2: shadcn-vue CLI (v2.4.3) no soporta Tailwind v4. Componentes creados manualmente: Button, Badge, Card, Input, Dialog, Sheet, Toast usando class-variance-authority + tailwind-merge.
- Task 3: Google Fonts Nunito en index.html. Font aplicada vía font-family en main.css.
- Task 4: CSS variables para modo retail/wholesale en main.css bajo @layer base.
- Task 5: ModeIndicator.vue con colores hardcoded como clases arbitrarias de Tailwind.
- Task 6: src/api/client.ts con Axios + interceptores JWT. 401 hace logout + redirect usando dynamic import para evitar circular dependency.
- Task 7: auth.store.ts Pinia composition API con persistencia en localStorage.
- Task 8: AppLayout.vue con header sticky. Router con guards de auth/rol. Limpiados todos los placeholders del starter.
- Task 9: .env.example y .env local creados.

### File List

- `jedami-web/vite.config.ts` (MODIFICADO — plugin @tailwindcss/vite)
- `jedami-web/tsconfig.json` (MODIFICADO — paths @/* para shadcn-vue)
- `jedami-web/index.html` (MODIFICADO — Google Fonts Nunito, título JEDAMI)
- `jedami-web/components.json` (NUEVO — shadcn-vue config)
- `jedami-web/.env.example` (NUEVO)
- `jedami-web/src/assets/main.css` (MODIFICADO — Tailwind + CSS variables)
- `jedami-web/src/lib/utils.ts` (NUEVO — cn() helper)
- `jedami-web/src/components/ui/Button.vue` (NUEVO)
- `jedami-web/src/components/ui/Badge.vue` (NUEVO)
- `jedami-web/src/components/ui/Card.vue` (NUEVO)
- `jedami-web/src/components/ui/Input.vue` (NUEVO)
- `jedami-web/src/components/ui/Dialog.vue` (NUEVO)
- `jedami-web/src/components/ui/Sheet.vue` (NUEVO)
- `jedami-web/src/components/ui/Toast.vue` (NUEVO)
- `jedami-web/src/components/features/catalog/ModeIndicator.vue` (NUEVO)
- `jedami-web/src/api/client.ts` (NUEVO — Axios + JWT interceptors)
- `jedami-web/src/stores/auth.store.ts` (NUEVO — Pinia auth store)
- `jedami-web/src/layouts/AppLayout.vue` (NUEVO)
- `jedami-web/src/router/index.ts` (MODIFICADO — rutas reales + guards)
- `jedami-web/src/App.vue` (MODIFICADO — data-mode + authStore)
- `jedami-web/src/views/HomeView.vue` (LIMPIADO)

# Modelo Comercial — Jedami como SaaS

## Resumen

Jedami puede comercializarse como un producto SaaS (Software as a Service) para tiendas de ropa mayoristas y minoristas. El cliente paga una suscripción mensual o anual y recibe la plataforma operativa sin necesidad de gestionar infraestructura.

---

## Planes y precios

| Plan | Mensual | Anual | Ahorro anual |
|------|---------|-------|--------------|
| **Starter** | $80 USD | $800 USD | $160 USD (2 meses gratis) |
| **Pro** | $150 USD | $1.500 USD | $300 USD |
| **Full** | $250 USD | $2.500 USD | $500 USD |

### Qué incluye cada plan

**Starter — $80 USD/mes**
- Catálogo web con variantes (talle/color)
- Precios minorista y mayorista
- Checkout con MercadoPago (online)
- Panel admin (productos, stock, pedidos, pagos)
- Soporte por email con respuesta en 48 hs

**Pro — $150 USD/mes**
- Todo lo del plan Starter
- Integración MP Point (cobro presencial con terminal)
- Descuentos por volumen / curva
- Anuncios y banners personalizables desde el panel
- Soporte prioritario con respuesta en 24 hs

**Full — $250 USD/mes**
- Todo lo del plan Pro
- Dominio propio del cliente (ej: `tienda.suempresa.com`)
- Onboarding personalizado (logo, colores, productos iniciales cargados)
- Backups de base de datos incluidos
- Soporte con respuesta en 8 hs hábiles

---

## Estructura de costos por cliente

| Concepto | Costo mensual |
|----------|---------------|
| Render BFF (Starter plan) | $7 USD |
| Render PostgreSQL (Starter plan) | $7 USD |
| Render Redis (Starter plan) | $10 USD |
| Dominio del cliente (si se incluye) | ~$1 USD |
| **Costo total de infra por cliente** | **~$25 USD** |

### Margen por plan

| Plan | Precio | Costo infra | Margen bruto |
|------|--------|-------------|--------------|
| Starter | $80 USD | $25 USD | $55 USD (69%) |
| Pro | $150 USD | $25 USD | $125 USD (83%) |
| Full | $250 USD | $26 USD | $224 USD (90%) |

### Proyección con múltiples clientes

| Clientes | Plan Starter | Plan Pro | Plan Full |
|----------|-------------|----------|-----------|
| 5 | $275 USD/mes | $625 USD/mes | $1.120 USD/mes |
| 10 | $550 USD/mes | $1.250 USD/mes | $2.240 USD/mes |
| 20 | $1.100 USD/mes | $2.500 USD/mes | $4.480 USD/mes |

*Margen neto estimado (descontando ~1–2 hs de soporte mensual por cliente)*

---

## Infraestructura actual

El sistema corre en los siguientes servicios cloud:

| Servicio | Rol | Plan actual | Plan recomendado prod |
|----------|-----|-------------|----------------------|
| **Render** | BFF (Express + Node) | free (duerme) | Starter $7/mes |
| **Render** | PostgreSQL | free (expira 90 días) | Starter $7/mes |
| **Render** | Redis | free (expira 30 días) | Starter $10/mes |
| **Vercel** | Frontend web (Vue 3) | Hobby (gratuito) | Hobby o Pro $20/mes |
| **GitHub Actions** | CI/CD | free (2.000 min/mes) | free |
| **GHCR** | Registro de imágenes Docker | free | free |

**Costo mínimo de producción por cliente: ~$24–25 USD/mes**

### Advertencia sobre free tiers
- El plan free de Render hace que el BFF se "duerma" tras 15 minutos sin tráfico — inaceptable en producción.
- La base de datos free de Render **expira y se elimina a los 90 días**.
- El Redis free de Render **expira a los 30 días**.

Para cualquier cliente en producción, usar los planes Starter de Render es obligatorio.

---

## Stack tecnológico

| Capa | Tecnología |
|------|-----------|
| Backend API (BFF) | Node.js 24 + Express 5 + TypeScript |
| Base de datos | PostgreSQL 16 (pg pool, SQL puro, sin ORM) |
| Caché | Redis (sesiones, configuración) |
| Frontend web | Vue 3 + Vite + Pinia + TypeScript |
| App móvil | Flutter 3 (iOS/Android) |
| Pagos | MercadoPago (Checkout Pro + Point POS) |
| CI/CD | GitHub Actions + Docker + GHCR |
| Hosting | Render (BFF + DB + Redis) + Vercel (web) |

---

## Comisiones de MercadoPago

No hay costo fijo mensual. Solo se cobra por transacción aprobada.

| Canal de pago | Comisión aprox. |
|---------------|-----------------|
| Checkout Pro (online, tarjeta/billetera) | ~5,99% + IVA |
| MP Point (terminal presencial) | ~2,99% + IVA |
| Transferencia bancaria (CBU/CVU) | $0 (fuera de MP) |

El hardware de la terminal Point es un costo único a cargo del cliente:
- Point Smart 2: ~$50.000–80.000 ARS (precio orientativo, varía según promociones de MP)

---

## Diferencial competitivo

Comparación con alternativas del mercado para tiendas de ropa en Argentina:

| Característica | Jedami | Tienda Nube | WooCommerce |
|----------------|--------|-------------|-------------|
| Precio mayorista nativo | ✓ | Solo planes caros | Plugin pago |
| MP Point integrado | ✓ | No | Plugin pago |
| Descuentos por curva/volumen | ✓ | No | Plugin pago |
| Comisión extra por venta | 0% | 0–2% según plan | 0% |
| Panel admin en español | ✓ | ✓ | Parcial |
| App móvil para clientes | ✓ (Flutter) | No nativa | No |
| Costo mensual | $80–250 USD | $30–120 USD | Hosting ~$10 + plugins |

**Ventaja principal:** funcionalidades de mayoreo (precio diferenciado, descuentos por volumen, cobro presencial con Point) que Tienda Nube no ofrece en planes básicos.

---

## Mercado objetivo

**Perfil de cliente ideal:**
- Tienda de ropa infantil, juvenil o adultos con venta mayorista y minorista
- Facturación mensual entre $1M y $10M ARS
- Actualmente usa WhatsApp + Excel, o sistemas básicos sin mayorista
- Tiene o quiere tener terminal Point para ventas presenciales

**Canales de venta sugeridos:**
- Ferias textiles (La Salada, Flores, Once)
- Grupos de Facebook de mayoristas textiles
- Instagram de moda infantil y juvenil
- Referencias de otros clientes (programa de referidos)

---

## Requisitos previos para vender (roadmap técnico)

El sistema es actualmente **single-tenant** (una tienda por instancia). Para comercializarlo a escala se necesita:

### Imprescindible
- [ ] **Script de provisioning**: crear una nueva instancia de cliente en Render en ~5 minutos con un solo comando (DB nueva, variables de entorno, deploy automático)
- [ ] **Panel de onboarding**: el cliente configura logo, colores, nombre de tienda y WhatsApp sin intervención técnica
- [ ] **Dominio propio por cliente**: configuración de CNAME en Vercel + variable CORS_ORIGIN en el BFF

### Importante para retención
- [ ] **Backups automáticos de DB**: Render Starter no los incluye — implementar con `pg_dump` a S3/R2 vía cron
- [ ] **Monitoreo y alertas**: uptime check básico (Render lo provee; complementar con Better Uptime o similar)
- [ ] **Métricas por cliente**: panel interno para ver actividad, pedidos, problemas por tenant

### Nice to have
- [ ] **Trial de 14 días** sin tarjeta para bajar fricción de ventas
- [ ] **Multi-tenant real**: una sola instancia sirve N clientes (reduce costos a escala, requiere refactor de arquitectura — ver `docs/app-multitenant.md`)

---

## Modelo de contrato sugerido

- **Mensual**: se cobra los primeros 5 días del mes. Sin permanencia mínima. Baja con 30 días de aviso.
- **Anual**: pago por adelantado. 2 meses de descuento incluidos. Sin reembolso parcial.
- **Setup fee** (opcional): $100–200 USD único para cubrir tiempo de onboarding y configuración inicial.
- **Portabilidad**: el cliente puede exportar sus datos (productos, pedidos, clientes) en CSV en cualquier momento.

Voy a buscar información actualizada sobre la API de suscripciones de Mercado Pago para darte la guía más precisa.Perfecto, ya tengo toda la info necesaria. Te armo una guía completa con la arquitectura y el código base.

## App Multitenant con Mercado Pago + Node/Express + PostgreSQL + TypeScript

Aquí va la arquitectura completa y el código clave para tu proyecto.

### 1. Estructura del proyecto

```
src/
├── config/
│   ├── database.ts        # Conexión PostgreSQL
│   └── mercadopago.ts     # Config MP
├── middleware/
│   ├── auth.ts            # JWT + identificación de tenant
│   ├── tenantContext.ts   # Inyecta tenant_id en cada request
│   └── planGuard.ts       # Verifica features según plan
├── routes/
│   ├── auth.routes.ts
│   ├── subscription.routes.ts
│   └── webhook.routes.ts
├── services/
│   ├── subscription.service.ts
│   └── tenant.service.ts
├── models/
│   └── schema.sql
└── app.ts
```

### 2. Schema de base de datos (PostgreSQL)

```sql
-- Planes disponibles en tu app
CREATE TABLE plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(50) NOT NULL,          -- 'free', 'basic', 'pro'
  price DECIMAL(10,2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'ARS',
  frequency INT DEFAULT 1,            -- cada cuántos períodos cobra
  frequency_type VARCHAR(10) DEFAULT 'months',
  max_users INT DEFAULT 1,
  max_storage_mb INT DEFAULT 100,
  features JSONB DEFAULT '{}',        -- {"api_access": true, "reports": false}
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tenants (organizaciones/empresas)
CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,  -- subdominio o identificador
  plan_id UUID REFERENCES plans(id),
  subscription_status VARCHAR(20) DEFAULT 'free',  
    -- free | pending | authorized | paused | cancelled
  mp_subscription_id VARCHAR(100),    -- ID de suscripción en Mercado Pago
  mp_payer_email VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Usuarios pertenecen a un tenant
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  email VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(20) DEFAULT 'member',  -- owner | admin | member
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, email)
);

-- Historial de pagos para auditoría
CREATE TABLE payment_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  mp_payment_id VARCHAR(100),
  mp_subscription_id VARCHAR(100),
  amount DECIMAL(10,2),
  status VARCHAR(30),
  event_type VARCHAR(50),
  raw_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índice para queries por tenant (fundamental en multitenant)
CREATE INDEX idx_users_tenant ON users(tenant_id);
CREATE INDEX idx_payment_history_tenant ON payment_history(tenant_id);
```

### 3. Configuración de Mercado Pago

```typescript
// src/config/mercadopago.ts
import { MercadoPagoConfig, PreApproval } from "mercadopago";

const mpClient = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN!,
});

export const preApproval = new PreApproval(mpClient);
export default mpClient;
```

### 4. Servicio de suscripciones

Mercado Pago maneja suscripciones a través de su API de PreApproval. El enfoque más simple es crear suscripciones sin plan asociado con estado "pending", lo que redirige al usuario a Mercado Pago para que ingrese su método de pago y te devuelve un `init_point` (URL de checkout).

```typescript
// src/services/subscription.service.ts
import { preApproval } from "../config/mercadopago";
import { pool } from "../config/database";

interface CreateSubscriptionParams {
  tenantId: string;
  payerEmail: string;
  planId: string;
}

export async function createSubscription({
  tenantId,
  payerEmail,
  planId,
}: CreateSubscriptionParams) {
  // 1. Obtener datos del plan
  const planResult = await pool.query(
    "SELECT * FROM plans WHERE id = $1 AND active = true",
    [planId]
  );
  const plan = planResult.rows[0];
  if (!plan) throw new Error("Plan no encontrado");

  // 2. Crear suscripción en Mercado Pago (sin plan asociado, pago pendiente)
  const subscription = await preApproval.create({
    body: {
      back_url: `${process.env.APP_URL}/subscription/callback`,
      reason: `Suscripción ${plan.name} - Tu App`,
      external_reference: tenantId,
      payer_email: payerEmail,
      auto_recurring: {
        frequency: plan.frequency,
        frequency_type: plan.frequency_type, // "months"
        transaction_amount: Number(plan.price),
        currency_id: plan.currency,
      },
      status: "pending",
    },
  });

  // 3. Guardar referencia en tu BD
  await pool.query(
    `UPDATE tenants 
     SET mp_subscription_id = $1, 
         mp_payer_email = $2, 
         plan_id = $3,
         subscription_status = 'pending',
         updated_at = NOW()
     WHERE id = $4`,
    [subscription.id, payerEmail, planId, tenantId]
  );

  // 4. Retornar la URL de checkout de Mercado Pago
  return {
    subscriptionId: subscription.id,
    checkoutUrl: subscription.init_point,
  };
}

export async function cancelSubscription(tenantId: string) {
  const tenant = await pool.query(
    "SELECT mp_subscription_id FROM tenants WHERE id = $1",
    [tenantId]
  );

  if (!tenant.rows[0]?.mp_subscription_id) {
    throw new Error("No hay suscripción activa");
  }

  // Cancelar en Mercado Pago
  await preApproval.update({
    id: tenant.rows[0].mp_subscription_id,
    body: { status: "cancelled" },
  });

  // Actualizar tu BD
  await pool.query(
    `UPDATE tenants 
     SET subscription_status = 'cancelled', updated_at = NOW() 
     WHERE id = $1`,
    [tenantId]
  );
}
```

### 5. Webhook para recibir notificaciones de Mercado Pago

Este es el punto más crítico: Mercado Pago te notifica cuando un pago se procesa, falla, o la suscripción cambia de estado.

```typescript
// src/routes/webhook.routes.ts
import { Router, Request, Response } from "express";
import { preApproval } from "../config/mercadopago";
import { pool } from "../config/database";

const router = Router();

router.post("/webhooks/mercadopago", async (req: Request, res: Response) => {
  try {
    const { type, data } = req.body;

    // MP envía distintos tipos de notificación
    if (type === "subscription_preapproval") {
      const subscriptionId = data.id;

      // Consultar estado actual en MP
      const subscription = await preApproval.get({ id: subscriptionId });

      // Buscar tenant por la referencia externa o por mp_subscription_id
      const tenantResult = await pool.query(
        `SELECT id FROM tenants 
         WHERE mp_subscription_id = $1 
            OR id = $2`,
        [subscriptionId, subscription.external_reference]
      );

      const tenant = tenantResult.rows[0];
      if (!tenant) {
        console.error("Tenant no encontrado para suscripción:", subscriptionId);
        return res.sendStatus(200); // Responder 200 para que MP no reintente
      }

      // Mapear estado de MP a tu modelo
      let status: string;
      switch (subscription.status) {
        case "authorized":
          status = "authorized";
          break;
        case "paused":
          status = "paused";
          break;
        case "cancelled":
          status = "cancelled";
          break;
        case "pending":
          status = "pending";
          break;
        default:
          status = subscription.status || "unknown";
      }

      // Actualizar tenant
      await pool.query(
        `UPDATE tenants 
         SET subscription_status = $1, 
             mp_subscription_id = $2,
             updated_at = NOW() 
         WHERE id = $3`,
        [status, subscriptionId, tenant.id]
      );

      // Guardar en historial
      await pool.query(
        `INSERT INTO payment_history 
           (tenant_id, mp_subscription_id, status, event_type, raw_data)
         VALUES ($1, $2, $3, $4, $5)`,
        [tenant.id, subscriptionId, status, type, JSON.stringify(req.body)]
      );
    }

    // Siempre responder 200 para confirmar recepción
    res.sendStatus(200);
  } catch (error) {
    console.error("Error en webhook MP:", error);
    res.sendStatus(200); // Responder 200 igual para evitar reintentos infinitos
  }
});

export default router;
```

### 6. Middleware de tenant y verificación de plan

```typescript
// src/middleware/tenantContext.ts
import { Request, Response, NextFunction } from "express";

// Adjunta el tenant_id a cada request después de autenticar
export function tenantContext(req: Request, res: Response, next: NextFunction) {
  // El tenant_id viene del JWT decodificado en el middleware de auth
  const tenantId = (req as any).user?.tenantId;
  if (!tenantId) {
    return res.status(401).json({ error: "Tenant no identificado" });
  }
  (req as any).tenantId = tenantId;
  next();
}

// src/middleware/planGuard.ts
import { Request, Response, NextFunction } from "express";
import { pool } from "../config/database";

// Verifica que el tenant tenga un plan activo con la feature requerida
export function requirePlan(requiredFeature?: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const tenantId = (req as any).tenantId;

    const result = await pool.query(
      `SELECT t.subscription_status, p.features, p.name as plan_name
       FROM tenants t
       LEFT JOIN plans p ON t.plan_id = p.id
       WHERE t.id = $1`,
      [tenantId]
    );

    const tenant = result.rows[0];

    if (!tenant || tenant.subscription_status !== "authorized") {
      return res.status(403).json({
        error: "Se requiere una suscripción activa",
        currentStatus: tenant?.subscription_status || "none",
      });
    }

    if (requiredFeature && !tenant.features?.[requiredFeature]) {
      return res.status(403).json({
        error: `Tu plan "${tenant.plan_name}" no incluye esta funcionalidad`,
        upgrade: true,
      });
    }

    next();
  };
}
```

### 7. Rutas de suscripción

```typescript
// src/routes/subscription.routes.ts
import { Router } from "express";
import { createSubscription, cancelSubscription } from "../services/subscription.service";
import { tenantContext } from "../middleware/tenantContext";
import { authMiddleware } from "../middleware/auth";

const router = Router();

// Crear suscripción → devuelve URL de Mercado Pago
router.post("/subscribe", authMiddleware, tenantContext, async (req, res) => {
  try {
    const { planId } = req.body;
    const tenantId = (req as any).tenantId;
    const payerEmail = (req as any).user.email;

    const result = await createSubscription({ tenantId, payerEmail, planId });

    // El frontend redirige al usuario a esta URL
    res.json({
      checkoutUrl: result.checkoutUrl,
      subscriptionId: result.subscriptionId,
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Cancelar suscripción
router.post("/cancel", authMiddleware, tenantContext, async (req, res) => {
  try {
    await cancelSubscription((req as any).tenantId);
    res.json({ message: "Suscripción cancelada" });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

export default router;
```

### 8. App principal

```typescript
// src/app.ts
import express from "express";
import subscriptionRoutes from "./routes/subscription.routes";
import webhookRoutes from "./routes/webhook.routes";

const app = express();

// IMPORTANTE: el webhook de MP necesita el body raw para verificación,
// pero en este caso basta con JSON
app.use(express.json());

// Rutas
app.use("/api", subscriptionRoutes);
app.use("/api", webhookRoutes);

// Ejemplo de ruta protegida por plan
import { authMiddleware } from "./middleware/auth";
import { tenantContext } from "./middleware/tenantContext";
import { requirePlan } from "./middleware/planGuard";

app.get(
  "/api/reports",
  authMiddleware,
  tenantContext,
  requirePlan("reports"), // Solo si su plan incluye "reports"
  (req, res) => {
    res.json({ data: "Reporte generado" });
  }
);

app.listen(3000, () => console.log("Server en puerto 3000"));
```

### Flujo completo resumido

El flujo funciona así: tu frontend llama a `POST /api/subscribe` con el plan elegido, tu backend crea la suscripción en Mercado Pago y recibe una URL de checkout, el frontend redirige al usuario a esa URL donde paga en Mercado Pago, luego MP redirige al usuario de vuelta a tu `back_url`. En paralelo, MP envía un webhook a `POST /api/webhooks/mercadopago` con el estado de la suscripción, y tu backend actualiza el `subscription_status` del tenant. A partir de ahí, el middleware `requirePlan` verifica en cada request si el tenant puede acceder a cada feature.

### Variables de entorno necesarias

```env
MP_ACCESS_TOKEN=APP_USR-xxx       # De tu dashboard de MP
APP_URL=https://tuapp.com
DATABASE_URL=postgresql://user:pass@localhost:5432/tuapp
JWT_SECRET=tu_secreto
```

### Puntos importantes a tener en cuenta

Mercado Pago valida la tarjeta con un cobro mínimo que luego devuelve. La primera cuota se acredita aproximadamente en 1 hora después de suscribirse. Si un pago es rechazado, queda en estado "recycling" (reintento automático), y después de 3 cuotas consecutivas rechazadas, MP da de baja automáticamente la suscripción.

Para testear, usá las cuentas de prueba de Mercado Pago (vendedor y comprador) que podés crear desde tu panel de desarrollador en mercadopago.com/developers.

¿Querés que te genere el proyecto completo como archivos descargables, o que profundice en alguna parte específica como la autenticación JWT o el frontend?
# Decisiones Técnicas

## Base de datos
- PostgreSQL
- SQL puro con driver `pg` (Pool)
- Migraciones SQL manuales
- Sin ORM — queries en archivos `.ts` dedicados por módulo

## Backend
- Node.js + TypeScript
- Express 5.x
- Arquitectura en capas (rutas → controladores → servicios → repositorios → queries SQL)

## Motivo
Control total sobre las queries, sin abstracción de ORM. Las queries SQL viven en archivos dedicados dentro de cada módulo (`modules/<nombre>/queries/*.ts`), lo que hace el código predecible y fácil de auditar.

## Mercado Pago
- Integración vía SDK oficial en `modules/payments/adapters/mercadopago/`
- MCP `mercadopago` configurado en Claude Code para asistir el desarrollo
- Credenciales en `.env` (nunca commiteadas): `MP_PUBLIC_KEY`, `MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET`
- Ambiente TEST en desarrollo; producción solo requiere cambiar las keys en `.env`

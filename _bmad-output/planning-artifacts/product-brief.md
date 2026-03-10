---
stepsCompleted: [init, vision, users, scope]
inputDocuments:
  - docs/01-requerimientos/requerimientos.md
date: 2026-03-09
author: Marceloo
---

# Product Brief: Tienda Online Mayorista y Minorista

**Autor:** Marceloo
**Fecha:** 2026-03-09
**Versión:** 1.0
**Estado:** Definición

---

## 1. El Problema

Los negocios que operan con ventas **mayoristas y minoristas** de forma simultánea enfrentan una complejidad operativa significativa: distintas reglas de compra, precios diferenciados, validaciones de stock específicas por modalidad y necesidad de controlar el acceso según el tipo de cliente. Actualmente, no existe un backend unificado que resuelva esta dualidad de manera estructurada, escalable y segura.

---

## 2. Visión del Producto

Construir el **backend de una tienda online** que soporte de forma nativa las modalidades de venta mayorista y minorista, ofreciendo una API REST robusta, segura y extensible que sirva como base para cualquier cliente frontend o consumidor de la API.

> _"Un backend que habla el idioma del comercio: un sistema que entiende que venderle a un cliente minorista es diferente a venderle a un mayorista, y lo gestiona sin fricciones."_

---

## 3. Usuarios Objetivo

| Tipo de usuario | Descripción | Necesidad principal |
|---|---|---|
| **Administrador** | Gestiona el sistema, usuarios y productos | Control total sobre el catálogo, usuarios y roles |
| **Cliente Minorista** | Compra unidades individuales de productos | Visualizar productos, generar pedidos y pagar |
| **Cliente Mayorista** | Compra en volumen con reglas especiales | Comprar por curva o por cantidad total, con validación de stock |

---

## 4. Propuesta de Valor

- **Dualidad nativa**: soporte de compra minorista y mayorista en un único sistema
- **Modalidades mayoristas diferenciadas**: compra por curva (un talle de cada uno) o por cantidad (cantidad libre con distribución posterior)
- **Seguridad robusta**: autenticación, autorización por roles y protección de rutas
- **Integración de pago real**: Mercado Pago como pasarela principal, con diseño extensible para futuros medios
- **Arquitectura preparada para escalar**: separación de capas, modularidad y soporte para tiempo real en el futuro

---

## 5. Funcionalidades Clave

### Autenticación y Autorización
- Registro e inicio de sesión con email/contraseña y token JWT
- Gestión de roles (Admin, Minorista, Mayorista)
- Asignación múltiple de roles por usuario
- Control de acceso basado en roles (RBAC)

### Gestión de Productos
- CRUD de productos (crear, modificar, consultar)
- Soporte para productos con variantes (ej: talles)
- Visualización pública del catálogo disponible

### Sistema de Pedidos y Ventas
- Generación de pedidos de compra
- Modalidad minorista: compra por unidad
- Modalidad mayorista:
  - **Por curva**: una unidad de cada talle disponible del producto
  - **Por cantidad**: cantidad total de unidades, distribución por talle libre o posterior

### Validación de Stock
- Por curva: verificación de stock por talle
- Por cantidad: verificación de stock total del producto

### Medios de Pago
- Integración con **Mercado Pago** para minoristas y mayoristas
- Generación de orden y redirección al checkout
- Procesamiento de webhook de resultado (aprobado/rechazado/pendiente)
- Registro de ID de pago, estado, fecha y monto
- Arquitectura extensible para nuevos medios de pago

---

## 6. Métricas de Éxito

| Métrica | Criterio de éxito |
|---|---|
| API funcional | Todos los endpoints cubren los RF definidos |
| Seguridad | Rutas sensibles protegidas; contraseñas encriptadas |
| Pagos | Flujo Mercado Pago completo end-to-end operativo |
| Cobertura mayorista | Ambas modalidades (curva y cantidad) operativas con validación de stock |
| Calidad de código | Arquitectura en capas; módulos independientes; código documentado |

---

## 7. Alcance

### Dentro del alcance (Fase 1)
- API REST en Node.js + TypeScript
- Base de datos PostgreSQL
- Autenticación JWT
- Gestión de usuarios, roles y productos
- Sistema de pedidos con modalidades mayorista y minorista
- Integración Mercado Pago
- Infraestructura para tiempo real (desacoplada, activación progresiva)

### Fuera del alcance (por ahora)
- Frontend / UI
- Gestión de envíos y logística
- Facturación electrónica
- Notificaciones push / email
- Múltiples pasarelas de pago (solo Mercado Pago en Fase 1)

---

## 8. Restricciones Técnicas

- **Lenguaje:** Node.js con TypeScript
- **Base de datos:** PostgreSQL (relacional)
- **Protocolo:** HTTP/JSON (REST)
- **Arquitectura:** Capas separadas (API → Dominio → Infraestructura)
- **Modularidad:** La lógica mayorista debe estar encapsulada en un módulo independiente

---

## 9. Riesgos Identificados

| Riesgo | Impacto | Mitigación |
|---|---|---|
| Complejidad de la lógica mayorista (curva vs cantidad) | Alto | Módulo dedicado e independiente |
| Integración con Mercado Pago (webhooks, estados) | Medio | Diseño basado en eventos; logging de estados |
| Escalabilidad del stock en tiempo real | Medio | Arquitectura desacoplada para tiempo real |
| Gestión de variantes (talles) en el modelo de datos | Medio | Modelado cuidadoso de entidades producto/variante |

---

## 10. Próximos Pasos

1. Elaborar el **PRD completo** con requerimientos funcionales detallados y criterios de aceptación
2. Diseñar la **arquitectura técnica** (entidades, módulos, diagrama de capas)
3. Crear las **épicas y user stories** para sprint planning
4. Configurar el entorno de desarrollo e integración con Mercado Pago (sandbox)

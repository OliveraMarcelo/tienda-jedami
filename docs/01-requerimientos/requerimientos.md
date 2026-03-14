
---

# 📄 Requerimientos del Sistema

**Proyecto:** Tienda Online Mayorista y Minorista
**Versión:** 1.0
**Estado:** Fase 1 – Definición

---

## 1. Objetivo del sistema

El sistema debe permitir la gestión de una tienda online que opere tanto en modalidad **mayorista** como **minorista**, incluyendo la administración de usuarios, roles, productos y pedidos, a través de una **API backend**.

---

## 2. Alcance

El backend será responsable de:

* Exponer una API REST
* Manejar autenticación y autorización
* Persistir datos en una base relacional (PostgreSQL)
* Soportar diferentes tipos de usuarios y permisos

El frontend **no** forma parte de este documento. Gracias al cielo.

---

## 3. Requerimientos Funcionales

### RF-01 – Registro de usuarios

El sistema debe permitir registrar usuarios utilizando email y contraseña.

---

### RF-02 – Autenticación

El sistema debe permitir a los usuarios iniciar sesión de forma segura y obtener un token de acceso.

---

### RF-03 – Gestión de roles

Los roles podrán representar diferentes tipos de usuarios, como administradores, clientes minoristas y clientes mayoristas.

---

### RF-04 – Asignación de roles a usuarios

El sistema debe permitir asignar uno o varios roles a un usuario.

---

### RF-05 – Autorización basada en roles

El sistema debe restringir el acceso a determinadas funcionalidades según el rol del usuario.

---

### RF-06 – Gestión de productos

El sistema debe permitir:

* Crear productos
* Modificar productos
* Consultar productos

---

### RF-07 – Visualización de productos

El sistema debe permitir a cualquier visitante visualizar productos disponibles con los precios correspondientes al modo activo de la tienda (minorista o mayorista), sin requerir registro ni autenticación.

---

### RF-08 – Creación de pedidos

El sistema debe permitir a los usuarios generar pedidos de compra.

---
### 🔄 RF-09 – Soporte para modalidad mayorista y minorista (ajustado)

El sistema debe soportar diferentes modalidades de venta:

* Venta minorista
* Venta mayorista

El **modo de visualización de precios** lo determina el contexto de la tienda, no el rol del usuario. Cualquier visitante puede ver precios en el modo que esté activo sin necesidad de registrarse.

La **modalidad de compra** (quién puede comprar en modo mayorista) sí está restringida por el rol del usuario autenticado.

El registro es requisito únicamente para generar pedidos.

---

### 🔄 RF-10 – Compra mayorista (ajustado)

El sistema debe permitir que los usuarios mayoristas realicen compras bajo modalidad mayorista utilizando **diferentes formas de compra**.

---

### 🆕 RF-10.1 – Compra mayorista por curva

El sistema debe permitir a los usuarios mayoristas comprar productos mediante curvas.
El sistema deberá contemplar productos con variantes (por ejemplo, talle) para la validación de stock.
Una curva representa una unidad de cada talle disponible de un producto.

---

### 🆕 RF-10.2 – Compra mayorista por cantidad

El sistema debe permitir a los usuarios mayoristas comprar productos indicando una **cantidad total de unidades**, sin necesidad de realizar la compra por curva.

Características:

* El usuario define la cantidad total a comprar
* La distribución por talle puede ser libre o definida posteriormente (según reglas del sistema)
* Aplica exclusivamente a modalidad mayorista

---

### 🆕 RF-10.3 – Selección del tipo de compra mayorista

El sistema debe permitir al usuario mayorista seleccionar el tipo de compra mayorista:

* Compra por curva
* Compra por cantidad

---

### 🔄 RF-11 – Validación de stock (ajustado)

El sistema debe validar el stock disponible según el tipo de compra:

* En compra por curva, validar stock suficiente por talle
* En compra por cantidad, validar stock total disponible del producto

---

### 🔄 RF-12 – Medio de Pago – Mercado Pago

* El sistema debe permitir realizar pagos **tanto para ventas minoristas como mayoristas** mediante **Mercado Pago**.
* Mercado Pago será el **medio de pago principal en la fase inicial del proyecto**.
* El usuario podrá abonar su compra utilizando los métodos habilitados por Mercado Pago (por ejemplo: saldo en cuenta, tarjetas de débito y crédito, transferencias).
* El sistema deberá:

  * Generar una **orden de pago** en Mercado Pago.
  * Redirigir al usuario al **checkout de Mercado Pago**.
  * Recibir y procesar la **notificación del resultado del pago** (aprobado, rechazado, pendiente).
* Una compra solo deberá confirmarse como **pagada** cuando Mercado Pago notifique un estado exitoso.
* El sistema deberá guardar:

  * ID de pago de Mercado Pago
  * Estado del pago
  * Fecha y monto abonado
* En ventas mayoristas:

  * El pago mediante Mercado Pago debe aplicar tanto a compras **por curva** como a compras **por cantidad libre**.
* El diseño debe permitir **agregar nuevos medios de pago en el futuro** sin afectar la lógica principal del sistema.

---

## 4. Requerimientos No Funcionales

### RNF-01 – Seguridad

* Las contraseñas deben almacenarse de forma encriptada.
* La API debe proteger rutas sensibles mediante autenticación.

---

### RNF-02 – Persistencia

* Los datos deben almacenarse en una base de datos relacional.
* El sistema debe ser consistente frente a errores.

---

### RNF-03 – Arquitectura

* El backend debe seguir una arquitectura estructurada y mantenible.
* Separación clara entre capas (API, dominio, infraestructura).

---

### RNF-04 – Escalabilidad

El sistema debe permitir agregar nuevas funcionalidades sin afectar las existentes.

---

### RNF-05 – Mantenibilidad

El código debe ser legible, modular y documentado.

---
###  RNF-06 – Modularidad del sistema 

La lógica de venta mayorista debe estar encapsulada en un módulo independiente que contemple múltiples tipos de compra mayorista, como compra por curva y compra por cantidad.

---

### RNF-07 – Capacidad de procesamiento en tiempo real

El sistema debe estar preparado para soportar funcionalidades en tiempo real.

Esto incluye, pero no se limita a:

- Actualización de stock en tiempo real
- Cambios de estado de pedidos
- Notificaciones de eventos relevantes del sistema
- Sincronización de información entre múltiples usuarios

Esta capacidad debe:

- Ser desacoplada del núcleo del sistema
- No afectar el funcionamiento de la API REST tradicional
- Permitir su activación progresiva por módulos

La elección de tecnologías específicas para tiempo real será definida en etapas posteriores del proyecto.


## 5. Suposiciones y Restricciones

* El backend será desarrollado en Node.js con TypeScript.
* La base de datos será PostgreSQL.
* La comunicación se realizará mediante HTTP/JSON.

---

## 6. Fuera de alcance (por ahora)

* Envíos
* Facturación electrónica
* Notificaciones
* Integraciones con múltiples proveedores de pago (excepto Mercado Pago)



## 7. Glosario

* **Visitante:** Persona no registrada que puede navegar el catálogo y ver precios según el modo activo de la tienda.
* **Usuario:** Persona registrada en el sistema que puede generar pedidos y comprar.
* **Admin:** Usuario con permisos de administración.
* **Rol:** Conjunto de permisos asignados a un usuario.
* **Modo de la tienda:** Contexto activo (minorista o mayorista) que determina qué precios se muestran en el catálogo.

---

### Resultado

Este documento:

* Define **qué** debe hacer el sistema
* No habla de **cómo** se implementa
* Es la base para épicas, historias y casos de uso

---

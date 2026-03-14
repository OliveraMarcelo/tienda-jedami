📚 Documentación DER — Backend Tienda Online Jedami
1. Objetivo del modelo
Este modelo de base de datos está diseñado para soportar:
Venta minorista
Venta mayorista (en fases posteriores)
Manejo de variantes de producto (talle y color)
Control real de stock
Gestión de pedidos
Escalabilidad futura hacia:
reglas de venta mayorista
listas de precios
promociones
pagos online
El modelo prioriza:
Integridad de datos
Escalabilidad
Separación de responsabilidades
🧠 Principios del modelo
1. Un producto no es lo que se vende.
Lo que se vende es una variante.
2. El stock pertenece a la variante, no al producto.
3. Los pedidos registran el precio histórico, no dependen del precio actual del producto.
4. El modelo permite agregar reglas comerciales sin romper las tablas existentes.
🧩 Entidades principales
Las entidades base del sistema son:
Customer
Product
Variant
Stock
Order
OrderItem
🗂 DER Conceptual
CUSTOMERS
---------
id (PK)
10/3/26, 22:23 jedami - Fase 1 desarrollo Jedami
🔗 Relaciones del modelo
1️⃣ Customer → Orders
Relación
name
email
customer_type
PRODUCTS
--------
id (PK)
name
description
VARIANTS
--------
id (PK)
product_id (FK)
size
color
retail_price
STOCK
-----
variant_id (PK, FK)
quantity
ORDERS
------
id (PK)
customer_id (FK)
status
total_amount
created_at
ORDER_ITEMS
-----------
id (PK)
order_id (FK)
variant_id (FK)
quantity
unit_price
10/3/26, 22:23 jedami - Fase 1 desarrollo Jedami
Un cliente puede realizar múltiples pedidos.
Ejemplo
Cliente:
Pedidos:
Esto permite:
historial de compras
segmentación de clientes
análisis de ventas
2️⃣ Product → Variant
Relación
Un producto puede tener múltiples combinaciones de talla y color.
Ejemplo
Producto:
Variantes:
Esto evita duplicar productos.
3️⃣ Variant → Stock
Relación
Customer 1 ---- N Orders
Juan Perez
Pedido 101
Pedido 135
Pedido 200
Product 1 ---- N Variants
Remera Oversize
Remera Oversize - Negro - M
Remera Oversize - Negro - L
Remera Oversize - Blanco - M
Remera Oversize - Blanco - L
10/3/26, 22:23 jedami - Fase 1 desarrollo Jedami
Cada variante tiene su propio stock.
Ejemplo
Variante Stock
Remera Negra M 12
Remera Negra L 5
Cuando alguien compra:
Se descuenta de esa variante específica.
4️⃣ Order → OrderItem
Relación
Un pedido contiene múltiples productos.
Ejemplo
Pedido 105:
Producto Cantidad
Remera Negra M 2
Remera Blanca L 1
Cada línea del pedido se guarda en OrderItems.
5️⃣ OrderItem → Variant
Relación
Una variante puede aparecer en muchos pedidos diferentes.
Ejemplo
Variante:
Variant 1 ---- 1 Stock
Remera Negra M
Order 1 ---- N OrderItems
Variant 1 ---- N OrderItems
10/3/26, 22:23 jedami - Fase 1 desarrollo Jedami
Pedidos donde aparece:
Esto permite análisis como:
productos más vendidos
talles más vendidos
colores más vendidos
📦 Flujo de compra en el sistema
El flujo lógico de compra es:
1️⃣ Cliente crea un pedido
Estado inicial:
2️⃣ Cliente agrega productos
Cada item contiene:
variante
cantidad
precio
3️⃣ Se valida el stock
El sistema verifica:
Remera Negra M
Pedido 101
Pedido 105
Pedido 140
INSERT orders
PENDING
INSERT order_items
stock.quantity >= cantidad
10/3/26, 22:23 jedami - Fase 1 desarrollo Jedami
4️⃣ Se descuenta el stock
Esto ocurre dentro de una transacción.
5️⃣ Se calcula el total del pedido
6️⃣ Pedido confirmado
Estado:
🚀 Escalabilidad futura del modelo
El modelo permite agregar sin romper nada:
📊 Listas de precio
Tabla futura:
Permitiría:
precio minorista
precio mayorista
precio VIP
🏭 Venta mayorista
Se podrán agregar:
Ejemplo:
UPDATE stock
SET quantity = quantity - cantidad
SUM(order_items.quantity * order_items.unit_price)
CONFIRMED
price_lists
product_prices
sales_policies
10/3/26, 22:23 jedami - Fase 1 desarrollo Jedami
💳 Pagos
Tabla futura:
Para integrar:
Mercado Pago
Transferencias
Tarjetas
📈 Ventajas de este modelo
✔ Manejo real de stock
✔ Separación clara entre producto y variante
✔ Historial de precios en pedidos
✔ Escalable para reglas comerciales
✔ Compatible con arquitectura DDD
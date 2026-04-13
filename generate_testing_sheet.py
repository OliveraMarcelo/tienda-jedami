#!/usr/bin/env python3
"""
Planilla de testing Jedami — una pestaña por vista/pantalla.
Ejecutar: python3 generate_testing_sheet.py
Genera:   jedami_testing_v1.xlsx
"""

import zipfile

# ─── Columnas fijas en todas las pestañas ─────────────────────────────────────
HEADERS = [
    "ID", "Nombre del caso", "Precondiciones", "Pasos", "Resultado esperado",
    "Estado", "Prioridad", "Tipo", "Notas"
]
# Estado:   Pendiente | Pasó | Falló | Bloqueado | N/A
# Prioridad: Alta | Media | Baja
# Tipo:     Funcional | Navegación | Validación | Seguridad | UX | Performance

P  = "Pendiente"
PA = "Pasó"
FA = "Falló"
A  = "Alta"
M  = "Media"
B  = "Baja"
FU = "Funcional"
NA = "Navegación"
VA = "Validación"
SE = "Seguridad"
UX = "UX"
PE = "Performance"

# ─── Datos por vista ──────────────────────────────────────────────────────────
# Cada entrada: (ID, nombre, precond, pasos, resultado_esperado, estado, prioridad, tipo, notas)

VIEWS = {}

# ══════════════════════════════════════════════════════════════════════════════
VIEWS["🔐 Login"] = [
    ("L-001","Login exitoso como Admin",
     "Usuario admin registrado existe en el sistema",
     "1. Navegar a /login\n2. Ingresar email y password del admin\n3. Hacer click en 'Ingresar'",
     "Redirige a /admin. Panel de administración visible",PA,A,FU,"E2E Playwright PASS 2026-04-12"),

    ("L-002","Login exitoso como Mayorista (Wholesale)",
     "Usuario con rol wholesale registrado",
     "1. Navegar a /login\n2. Ingresar credenciales del mayorista\n3. Click en 'Ingresar'",
     "Redirige a /catalogo. Catálogo visible con precios mayoristas",PA,A,FU,"E2E Playwright PASS 2026-04-12"),

    ("L-003","Login exitoso como Minorista (Retail)",
     "Usuario con rol retail registrado",
     "1. Navegar a /login\n2. Ingresar credenciales del minorista\n3. Click en 'Ingresar'",
     "Redirige a /catalogo. Catálogo visible",P,A,FU,"Pendiente de usuario minorista de prueba"),

    ("L-004","Email inexistente muestra error",
     "Ninguna precondición especial",
     "1. Ingresar un email que no existe\n2. Password cualquiera\n3. Click en 'Ingresar'",
     "Mensaje de error visible: credenciales inválidas. No redirige",PA,A,VA,"E2E Playwright PASS 2026-04-12"),

    ("L-005","Password incorrecto muestra error",
     "Usuario existente en el sistema",
     "1. Ingresar email válido\n2. Ingresar password incorrecto\n3. Click en 'Ingresar'",
     "Mensaje de error visible. No redirige. El email no se borra",PA,A,VA,"E2E Playwright PASS 2026-04-12"),

    ("L-006","Campos vacíos — botón deshabilitado",
     "Ninguna precondición",
     "1. No completar ningún campo\n2. Verificar estado del botón 'Ingresar'",
     "Botón 'Ingresar' deshabilitado. No permite submit",PA,A,VA,"E2E Playwright PASS 2026-04-12"),

    ("L-007","Blur en email vacío → 'El email es requerido'",
     "Ninguna precondición",
     "1. Hacer click en campo email\n2. Hacer click en campo password (blur)\n3. Verificar mensaje",
     "Mensaje 'El email es requerido' visible en rojo bajo el campo",PA,M,VA,"E2E Playwright PASS 2026-04-12"),

    ("L-008","Blur en password vacío → 'La contraseña es requerida'",
     "Email ya ingresado",
     "1. Hacer click en campo password\n2. Presionar Tab (blur)\n3. Verificar mensaje",
     "Mensaje 'La contraseña es requerida' visible en rojo bajo el campo",PA,M,VA,"E2E Playwright PASS 2026-04-12"),

    ("L-009","Email con formato inválido → 'El email no es válido'",
     "Ninguna precondición",
     "1. Ingresar texto sin @ en campo email\n2. Hacer Tab\n3. Verificar mensaje",
     "Mensaje 'El email no es válido' visible. Botón deshabilitado",PA,M,VA,"E2E Playwright PASS 2026-04-12"),

    ("L-010","Link 'Registrate' navega a /registro",
     "Usuario en /login",
     "1. Hacer click en el link de registro",
     "Navega a /registro. Formulario 'Crear cuenta' visible",PA,M,NA,"E2E Playwright PASS 2026-04-12"),

    ("L-011","Rate limit: demasiados intentos fallidos → 429",
     "Posibilidad de realizar múltiples intentos",
     "1. Realizar 21 intentos de login con credenciales incorrectas consecutivos",
     "Después del intento 20, muestra mensaje de 'demasiadas solicitudes'. Esperar antes de reintentar",P,A,SE,"Puede ajustarse con env AUTH_RATE_LIMIT_MAX"),

    ("L-012","Usuario ya logueado es redirigido desde /login",
     "Sesión activa en el navegador",
     "1. Con sesión activa, navegar manualmente a /login",
     "Redirige automáticamente a /admin o /catalogo según el rol",PA,M,NA,"E2E Playwright PASS 2026-04-12"),

    ("L-013","Visibilidad del campo password (mostrar/ocultar)",
     "Ninguna precondición",
     "1. Ingresar password\n2. Hacer click en el ícono de ojo\n3. Hacer click de nuevo",
     "El texto alterna entre oculto (type=password) y visible (type=text)",PA,B,UX,"E2E Playwright PASS 2026-04-12"),

    ("L-014","Spinner 'Ingresando…' visible durante el request",
     "Servidor con latencia o delay artificial",
     "1. Completar formulario\n2. Click en 'Ingresar'\n3. Observar botón durante la espera",
     "Botón muestra texto 'Ingresando…' y spinner mientras el request está en vuelo",PA,M,UX,"E2E Playwright PASS 2026-04-12"),

    ("L-015","Error de red → mensaje genérico (no crashea)",
     "Endpoint de login inaccesible (simular con route.abort)",
     "1. Completar formulario\n2. Abortar request de red\n3. Verificar comportamiento",
     "Muestra mensaje de error genérico. App sigue funcional. No crashea",PA,A,FU,"E2E Playwright PASS 2026-04-12"),
]

# ══════════════════════════════════════════════════════════════════════════════
VIEWS["📝 Registro"] = [
    ("REG-001","Registro exitoso como Mayorista → redirige a /catalogo",
     "Email no registrado previamente",
     "1. Navegar a /registro\n2. Seleccionar tipo Mayorista\n3. Completar email, password y confirmación\n4. Click en 'Crear cuenta'",
     "Registro exitoso. Redirige a /catalogo. Rol wholesale asignado",PA,A,FU,"E2E Playwright PASS 2026-04-12"),

    ("REG-002","Registro exitoso como Minorista → redirige a /catalogo",
     "Email no registrado previamente",
     "1. Navegar a /registro\n2. Seleccionar tipo Minorista\n3. Completar email, password y confirmación\n4. Click en 'Crear cuenta'",
     "Registro exitoso. Redirige a /catalogo. Rol retail asignado",PA,A,FU,"E2E Playwright PASS 2026-04-12"),

    ("REG-003","Email ya registrado → error de servidor visible",
     "El email admin@jedami.com ya existe en el sistema",
     "1. Completar el formulario con email ya registrado\n2. Click en 'Crear cuenta'",
     "Permanece en /registro. Mensaje de error visible (p.text-red-500)",PA,A,VA,"E2E Playwright PASS 2026-04-12"),

    ("REG-004","Campos vacíos → botón deshabilitado",
     "Ninguna precondición",
     "1. No llenar ningún campo\n2. Verificar estado del botón 'Crear cuenta'",
     "Botón 'Crear cuenta' deshabilitado",PA,A,VA,"E2E Playwright PASS 2026-04-12"),

    ("REG-005","Password menor a 8 caracteres → 'al menos 8 caracteres'",
     "Ninguna precondición",
     "1. Ingresar email válido\n2. Ingresar password de 5 caracteres\n3. Blur del campo password",
     "Mensaje 'La contraseña debe tener al menos 8 caracteres' visible. Botón disabled",PA,M,VA,"E2E Playwright PASS 2026-04-12"),

    ("REG-006","Email con formato inválido → 'El email no es válido'",
     "Ninguna precondición",
     "1. Ingresar 'noesunmail' en el campo email\n2. Blur del campo",
     "Mensaje 'El email no es válido' visible. Botón disabled",PA,M,VA,"E2E Playwright PASS 2026-04-12"),

    ("REG-007","Contraseñas que no coinciden → 'Las contraseñas no coinciden'",
     "Ninguna precondición",
     "1. Ingresar email válido, password y confirmación diferentes\n2. Blur del campo confirmación",
     "Mensaje 'Las contraseñas no coinciden' visible. Botón disabled",PA,M,VA,"E2E Playwright PASS 2026-04-12"),

    ("REG-008","Link 'Ingresá' navega a /login",
     "Usuario en /registro",
     "1. Click en el link 'Ingresá'",
     "Navega a /login",PA,M,NA,"E2E Playwright PASS 2026-04-12"),

    ("REG-009","Selector de tipo de cliente visible y funcional",
     "Ninguna precondición",
     "1. Navegar a /registro\n2. Verificar botones Minorista y Mayorista en el form\n3. Click en Mayorista",
     "Botones Minorista y Mayorista visibles. Click no dispara submit. URL permanece en /registro",PA,A,UX,"E2E Playwright PASS 2026-04-12"),

    ("REG-010","Blur en email vacío → 'El email es requerido'",
     "Ninguna precondición",
     "1. Click en campo email\n2. Click en campo password (blur del email)",
     "Mensaje 'El email es requerido' visible en rojo",PA,M,VA,"E2E Playwright PASS 2026-04-12"),

    ("REG-011","Blur en confirmación vacía → 'Confirmá tu contraseña'",
     "Email y password válidos ingresados",
     "1. Completar email y password\n2. Click en campo confirmación\n3. Presionar Tab",
     "Mensaje 'Confirmá tu contraseña' visible en rojo",PA,M,VA,"E2E Playwright PASS 2026-04-12"),

    ("REG-012","Spinner 'Creando cuenta…' visible durante el request",
     "Formulario válido completo",
     "1. Interceptar POST /api/v1/auth/register con delay 1500ms\n2. Click en 'Crear cuenta'\n3. Verificar texto del botón",
     "Botón muestra 'Creando cuenta…' con spinner mientras dura el request",PA,M,UX,"E2E Playwright PASS 2026-04-12"),
]

# ══════════════════════════════════════════════════════════════════════════════
VIEWS["🛍️ Catálogo"] = [
    ("CAT-001","Catálogo carga con productos y fotos",
     "Al menos un producto activo con imágenes en el sistema",
     "1. Navegar a /catalogo (sin iniciar sesión)\n2. Esperar que carguen los productos",
     "Grilla de productos visible con fotos, nombres y precios",PA,A,FU,"E2E Playwright PASS 2026-04-13"),

    ("CAT-002","Catálogo accesible sin iniciar sesión",
     "Ninguna precondición",
     "1. Navegar a /catalogo sin autenticación (cookies limpias)",
     "Catálogo visible y navegable sin requerir login. No redirige a /login",PA,A,SE,"E2E Playwright PASS 2026-04-13"),

    ("CAT-003","Branding visible en el navbar (nombre de la tienda)",
     "Ninguna precondición",
     "1. Navegar a /catalogo\n2. Verificar navbar",
     "Link 'Jedami' visible en el navbar",PA,M,FU,"E2E Playwright PASS 2026-04-13"),

    ("CAT-004","Filtrar productos por categoría",
     "Al menos 2 categorías con productos diferentes",
     "1. Navegar al catálogo\n2. Seleccionar una categoría del filtro\n3. Verificar resultados",
     "Botón de categoría activo (rosa). Productos filtrados visibles",PA,M,FU,"E2E Playwright PASS 2026-04-13"),

    ("CAT-005","Buscar producto por texto → filtra resultados",
     "Al menos un producto cargado",
     "1. Escribir 're' en el buscador\n2. Esperar respuesta de la API",
     "Resultados actualizados o mensaje de sin resultados visible",PA,M,FU,"E2E Playwright PASS 2026-04-13"),

    ("CAT-006","Búsqueda sin resultados muestra mensaje",
     "Ninguna precondición",
     "1. Buscar 'xyzxyz_sin_resultados_123' en el buscador",
     "Mensaje 'No encontramos productos para...' visible",PA,M,UX,"E2E Playwright PASS 2026-04-13"),

    ("CAT-007","Banner del catálogo visible si hay banners activos",
     "Banners opcionales en el sistema",
     "1. Navegar a /catalogo\n2. Verificar zona de banners",
     "Si hay banners: imagen con src válido visible. Test pasa con o sin banners",PA,M,FU,"E2E Playwright PASS 2026-04-13"),

    ("CAT-008","Sidebar de anuncios visible si hay anuncios activos",
     "Anuncios opcionales en el sistema",
     "1. Navegar al catálogo\n2. Esperar carga del sidebar",
     "Si hay anuncios: sidebar visible. Test pasa con o sin anuncios",PA,M,FU,"E2E Playwright PASS 2026-04-13"),

    ("CAT-009","Click en producto navega a /catalogo/:id",
     "Al menos un producto en catálogo",
     "1. Click en la primera ProductCard del catálogo",
     "URL cambia a /catalogo/:id con ID numérico",PA,A,NA,"E2E Playwright PASS 2026-04-13"),

    ("CAT-010","Catálogo sin productos → 'No hay productos disponibles'",
     "API interceptada para simular catálogo vacío",
     "1. Interceptar GET /api/v1/products con data:[]\n2. Navegar a /catalogo",
     "Mensaje 'No hay productos disponibles.' visible. Sin errores",PA,B,UX,"E2E Playwright PASS 2026-04-13"),

    ("CAT-011","Skeleton loader visible durante la carga",
     "Ninguna precondición",
     "1. Interceptar API con delay 800ms\n2. Navegar a /catalogo\n3. Verificar skeleton",
     "Elemento con clase animate-pulse visible durante la espera de datos",PA,B,UX,"E2E Playwright PASS 2026-04-13"),

    ("CAT-012","Botón 'Todas' muestra todos los productos",
     "Al menos 2 categorías con productos",
     "1. Filtrar por categoría\n2. Click en botón 'Todas'\n3. Verificar estado",
     "Botón 'Todas' activo (rosa). Todos los productos visibles sin filtro",PA,M,FU,"E2E Playwright PASS 2026-04-13"),
]

# ══════════════════════════════════════════════════════════════════════════════
VIEWS["👟 Detalle de Producto"] = [
    ("PROD-001","Página del producto carga correctamente",
     "Producto con imágenes, variantes y precios cargado",
     "1. Navegar a /catalogo/:id de un producto existente",
     "Nombre, descripción, imágenes, variantes y precios visibles sin errores",P,A,FU,""),

    ("PROD-002","Galería de imágenes navegable",
     "Producto con 2+ imágenes cargadas",
     "1. En el detalle del producto\n2. Hacer click en las imágenes miniatura o flechas\n3. Verificar cambio de imagen principal",
     "Imagen principal cambia al hacer click en miniaturas. Sin errores",P,M,UX,""),

    ("PROD-003","Precios mayoristas visibles para usuario wholesale",
     "Usuario con rol wholesale logueado",
     "1. Iniciar sesión como mayorista\n2. Navegar al detalle de un producto\n3. Verificar precios",
     "Precios mayoristas por variante visibles y correctos",P,A,FU,""),

    ("PROD-004","Tabla de descuentos visible (si hay reglas)",
     "Producto con reglas de descuento por cantidad o curva configuradas",
     "1. Navegar al detalle del producto\n2. Verificar sección de descuentos",
     "Tabla con escalones de descuento: 'Comprá X unidades → Y% off'. Visible sin login",P,A,FU,""),

    ("PROD-005","Sin reglas de descuento: tabla no aparece",
     "Producto sin reglas de descuento configuradas",
     "1. Navegar al detalle de un producto sin descuentos",
     "La sección de descuentos no aparece. No hay elementos vacíos ni errores",P,M,UX,""),

    ("PROD-006","Selección de variante (talla + color)",
     "Producto con múltiples variantes",
     "1. En detalle del producto\n2. Seleccionar una talla\n3. Seleccionar un color",
     "Variante seleccionada destacada visualmente. Precio actualizado si corresponde",P,A,FU,""),

    ("PROD-007","Botón de compra inicia el flujo de pedido",
     "Usuario autenticado como mayorista/minorista",
     "1. Seleccionar variante\n2. Click en 'Agregar al pedido' o 'Comprar'",
     "Inicia el flujo de creación de pedido. Navega a /pedidos o muestra confirmación",P,A,FU,""),

    ("PROD-008","Soft gate: usuario sin sesión es invitado a registrarse",
     "Usuario no autenticado",
     "1. Sin iniciar sesión, intentar comprar un producto",
     "Modal o redirect a /registro o /login con mensaje de 'debés registrarte'",P,A,FU,""),

    ("PROD-009","Anuncio sidebar visible en detalle",
     "Al menos un anuncio activo configurado",
     "1. Navegar al detalle de un producto\n2. Verificar sidebar lateral",
     "AnnouncementSidebar visible con anuncios del sistema",P,M,FU,""),

    ("PROD-010","Producto no encontrado muestra 404",
     "Ninguna precondición",
     "1. Navegar a /catalogo/9999 (ID inexistente)",
     "Mensaje de 'Producto no encontrado' visible. Sin errores en consola",P,M,UX,""),

    ("PROD-011","Volver al catálogo desde detalle",
     "Usuario en /catalogo/:id",
     "1. Click en botón volver o breadcrumb al catálogo",
     "Navega de vuelta al catálogo (/catalogo)",P,B,NA,""),
]

# ══════════════════════════════════════════════════════════════════════════════
VIEWS["📦 Mis Pedidos"] = [
    ("ORD-001","Lista de pedidos carga correctamente",
     "Usuario logueado con al menos un pedido",
     "1. Iniciar sesión\n2. Navegar a /pedidos",
     "Lista de pedidos del usuario visible con fecha, estado y monto",P,A,FU,""),

    ("ORD-002","Estados de pedido visibles y con colores",
     "Pedidos en distintos estados (draft, pending, paid, cancelled)",
     "1. Navegar a /pedidos\n2. Verificar badges de estado",
     "Cada estado tiene color distintivo: ej. verde=pagado, rojo=cancelado",P,A,UX,""),

    ("ORD-003","Click en pedido navega al detalle",
     "Al menos un pedido en la lista",
     "1. Click en cualquier pedido de la lista",
     "Navega a /pedidos/:orderId con el detalle del pedido",P,A,NA,""),

    ("ORD-004","Sin pedidos muestra mensaje informativo",
     "Usuario nuevo sin pedidos",
     "1. Iniciar sesión con usuario sin pedidos\n2. Navegar a /pedidos",
     "Mensaje visible: 'No tenés pedidos' o similar. Sin errores",P,M,UX,""),

    ("ORD-005","Solo se muestran los pedidos del usuario logueado",
     "Dos usuarios con pedidos diferentes",
     "1. Loguear como usuario A\n2. Ver pedidos\n3. Loguear como usuario B\n4. Ver pedidos",
     "Cada usuario ve solo sus propios pedidos. No se mezclan",P,A,SE,""),

    ("ORD-006","Descuento aplicado visible en la lista",
     "Pedido con items que tienen descuento (discount_pct > 0)",
     "1. Navegar a /pedidos\n2. Verificar si el descuento aparece en el resumen del pedido",
     "Descuento o precio final reflejado en el total del pedido",P,M,FU,""),

    ("ORD-007","Usuario sin sesión es redirigido al login",
     "Sin sesión activa",
     "1. Navegar a /pedidos sin autenticación",
     "Redirect a /login. No se muestra contenido protegido",P,A,SE,""),

    ("ORD-008","Lista actualiza después de cancelar un pedido",
     "Al menos un pedido en estado cancelable",
     "1. Cancelar pedido desde el detalle\n2. Volver a /pedidos",
     "El pedido muestra estado 'Cancelado' en la lista",P,M,FU,""),
]

# ══════════════════════════════════════════════════════════════════════════════
VIEWS["🧾 Detalle de Pedido"] = [
    ("DET-001","Detalle del pedido carga con items correctos",
     "Pedido existente con items",
     "1. Navegar a /pedidos/:orderId\n2. Verificar contenido",
     "Items del pedido visibles con producto, variante, cantidad y precio",P,A,FU,""),

    ("DET-002","Precio original y precio con descuento visibles",
     "Pedido con items que tienen discount_pct > 0",
     "1. Abrir detalle de pedido con descuento aplicado\n2. Verificar sección de items",
     "Precio original tachado y precio con descuento aplicado visibles por item",P,A,FU,""),

    ("DET-003","Botón 'Pagar' visible para pedidos pendientes",
     "Pedido en estado 'draft' o 'pending'",
     "1. Abrir detalle de pedido pendiente\n2. Verificar botón de pago",
     "Botón 'Pagar' o 'Iniciar pago' visible y habilitado",P,A,FU,""),

    ("DET-004","Checkout directo cuando hay 1 gateway activo",
     "Solo 1 gateway activo para el tipo de cliente",
     "1. Abrir pedido pendiente\n2. Click en 'Pagar'",
     "Inicia el pago directamente sin mostrar selector de gateway",P,A,FU,""),

    ("DET-005","Selector de gateway cuando hay múltiples activos",
     "2+ gateways activos para el tipo de cliente",
     "1. Abrir pedido pendiente\n2. Click en 'Pagar'\n3. Verificar selector",
     "Componente PaymentMethodSelector visible con las opciones disponibles",P,A,FU,""),

    ("DET-006","Elegir Checkout Pro → redirect a Mercado Pago",
     "Gateway checkout_pro activo. Pedido pendiente",
     "1. Seleccionar 'Mercado Pago Checkout' del selector\n2. Confirmar",
     "Redirect a la URL de MP sandbox. Página de pago de MP visible",P,A,FU,"Usar cuenta de prueba de MP"),

    ("DET-007","Elegir Checkout API → brick embebido en la página",
     "Gateway checkout_api activo. Pedido pendiente",
     "1. Seleccionar 'Pagar con tarjeta' del selector\n2. Confirmar",
     "Brick de MP (formulario de tarjeta) renderiza en la misma página",P,A,FU,"Usar cuenta de prueba de MP"),

    ("DET-008","Elegir Transferencia Bancaria → instrucciones",
     "Gateway bank_transfer activo. Pedido pendiente",
     "1. Seleccionar 'Transferencia bancaria' del selector\n2. Confirmar",
     "Instrucciones bancarias visibles: CBU/alias, titular, monto. Link WhatsApp para contacto",P,A,FU,""),

    ("DET-009","Link WhatsApp visible en instrucciones de transferencia",
     "WhatsApp de contacto configurado en branding",
     "1. Iniciar checkout con transferencia bancaria\n2. Verificar sección de contacto",
     "Link de WhatsApp con número configurado visible. Click abre WhatsApp",P,M,FU,""),

    ("DET-010","Cancelar pedido — pedido pasa a 'Cancelado'",
     "Pedido en estado 'draft' o 'pending'",
     "1. En detalle del pedido\n2. Click en 'Cancelar pedido'\n3. Confirmar en dialog de confirmación",
     "Estado del pedido cambia a 'Cancelado'. Botón de pago desaparece",P,A,FU,""),

    ("DET-011","No se puede cancelar un pedido ya pagado",
     "Pedido en estado 'paid'",
     "1. Abrir detalle de pedido pagado\n2. Verificar opciones disponibles",
     "Botón 'Cancelar' no visible o deshabilitado para pedidos pagados",P,A,VA,""),

    ("DET-012","Campo de notas visible y editable",
     "Pedido propio en estado no cancelado",
     "1. Abrir detalle del pedido\n2. Localizar campo de notas\n3. Ingresar texto\n4. Guardar",
     "Nota guardada y visible al recargar el detalle del pedido",P,M,FU,""),

    ("DET-013","Estado 'Pagado' se muestra con badge visual",
     "Pedido en estado 'paid'",
     "1. Abrir detalle de pedido pagado",
     "Badge verde o indicador visual 'Pagado' prominente. Sin botón de pago",P,M,UX,""),

    ("DET-014","Reintento de pago para pedido con pago fallido",
     "Pedido con pago en estado 'failed'",
     "1. Abrir detalle de pedido con pago fallido\n2. Buscar opción de reintento",
     "Botón de reintento visible. Al hacer click inicia nuevo intento de pago",P,M,FU,""),

    ("DET-015","Usuario no puede ver pedido de otro usuario",
     "Dos usuarios registrados, cada uno con pedidos",
     "1. Loguear como usuario A\n2. Obtener orderId de usuario B\n3. Navegar a /pedidos/:ordenDeB",
     "Error 403 o 404. No se muestra el pedido ajeno",P,A,SE,""),

    ("DET-016","Detalle de pedido muestra items con variante (talla y color)",
     "Pedido con items que tienen variante asignada",
     "1. Abrir detalle de pedido\n2. Verificar cada item",
     "Talla y color de cada item visibles en la lista de items",P,M,FU,""),
]

# ══════════════════════════════════════════════════════════════════════════════
VIEWS["✅ Confirmación de Pago"] = [
    ("CONF-001","Redirect de MP llega a la página de confirmación",
     "Pago procesado en sandbox de MP (Checkout Pro)",
     "1. Completar pago en MP sandbox\n2. Verificar URL de retorno",
     "Navega a /pedidos/:id/confirmacion. Página de confirmación visible",P,A,FU,"Usar tarjeta de prueba de MP"),

    ("CONF-002","Página muestra estado 'Pagado' correctamente",
     "Webhook de MP procesado (pedido en estado 'paid')",
     "1. Llegar a la confirmación después de pago exitoso",
     "Mensaje de éxito visible. Estado del pedido: Pagado. Monto visible",P,A,FU,""),

    ("CONF-003","Pago fallido muestra mensaje de error",
     "Pago rechazado en MP sandbox",
     "1. Usar tarjeta de prueba rechazada en MP\n2. Verificar página de retorno",
     "Mensaje de error o pago pendiente visible. Opción de reintentar disponible",P,A,FU,"Usar tarjeta de rechazo de MP sandbox"),

    ("CONF-004","Botón 'Ver pedido' lleva al detalle",
     "En página de confirmación",
     "1. Click en 'Ver pedido' o 'Ver detalle'",
     "Navega a /pedidos/:orderId con el detalle del pedido",P,M,NA,""),

    ("CONF-005","Botón 'Volver al catálogo' funcional",
     "En página de confirmación",
     "1. Click en 'Volver al catálogo' o 'Seguir comprando'",
     "Navega a /catalogo",P,M,NA,""),

    ("CONF-006","Transferencia bancaria: instrucciones en pantalla de espera",
     "Pago iniciado con gateway bank_transfer",
     "1. Iniciar pago con transferencia\n2. Verificar página de confirmación/espera",
     "Instrucciones bancarias claras: CBU, monto, referencia. Pedido en 'pending_transfer'",P,A,FU,""),
]

# ══════════════════════════════════════════════════════════════════════════════
VIEWS["👤 Mi Perfil"] = [
    ("PERF-001","Perfil carga con datos del usuario",
     "Usuario autenticado",
     "1. Navegar a /perfil",
     "Nombre, email y tipo de cliente del usuario visible",P,M,FU,""),

    ("PERF-002","Tipo de cliente visible (Mayorista / Minorista)",
     "Usuario con tipo de cliente asignado",
     "1. Navegar a /perfil\n2. Verificar datos del usuario",
     "Tipo de cliente (Mayorista/Minorista) visible en el perfil",P,M,FU,""),

    ("PERF-003","Botón de logout cierra la sesión",
     "Usuario autenticado",
     "1. Navegar a /perfil\n2. Click en 'Cerrar sesión'",
     "Sesión cerrada. Redirige a /login o /catalogo. Token invalidado",P,A,FU,""),

    ("PERF-004","Perfil no accesible sin sesión",
     "Sin sesión activa",
     "1. Navegar a /perfil sin autenticación",
     "Redirect a /login. No se muestra contenido del perfil",P,A,SE,""),

    ("PERF-005","Link a 'Mis Pedidos' disponible",
     "Usuario logueado en /perfil",
     "1. Click en 'Mis pedidos' o link equivalente",
     "Navega a /pedidos",P,B,NA,""),
]

# ══════════════════════════════════════════════════════════════════════════════
VIEWS["🏠 Admin – Inicio"] = [
    ("ADM-001","Panel admin carga con accesos rápidos",
     "Usuario con rol admin autenticado",
     "1. Loguear como admin\n2. Navegar a /admin",
     "Cards de acceso rápido visibles: Dashboard, Productos, Despacho, Pagos, Usuarios, Config, Banners, Anuncios, Point",P,A,FU,""),

    ("ADM-002","Card 'Cobros Point' visible y navega correctamente",
     "Admin en /admin",
     "1. Verificar presencia de card 'Cobros Point'\n2. Click en la card",
     "Card visible con ícono. Click navega a /admin/point",P,A,NA,"Agregada en Epic 11"),

    ("ADM-003","Todas las cards navegan a su vista correcta",
     "Admin en /admin",
     "1. Click en cada card del panel\n2. Verificar URL destino",
     "Cada card navega a su ruta correspondiente sin errores",P,A,NA,""),

    ("ADM-004","Usuario sin rol admin es redirigido",
     "Usuario con rol wholesale o retail",
     "1. Intentar navegar a /admin con usuario no-admin",
     "Redirect a /catalogo. Panel de admin no accesible",P,A,SE,""),

    ("ADM-005","Navbar o header muestra nombre del admin",
     "Admin autenticado",
     "1. Navegar a /admin\n2. Verificar header o navbar",
     "Nombre del usuario admin visible en la interfaz",P,B,UX,""),
]

# ══════════════════════════════════════════════════════════════════════════════
VIEWS["📊 Admin – Dashboard"] = [
    ("DASH-001","Dashboard carga con métricas de ventas",
     "Al menos algunos pedidos y pagos en el sistema",
     "1. Navegar a /admin/dashboard",
     "Métricas visibles: total de ventas, cantidad de pedidos, pagos recibidos",P,A,FU,""),

    ("DASH-002","Números de ventas totales visibles",
     "Pagos procesados en el sistema",
     "1. Navegar a dashboard\n2. Verificar sección de totales",
     "Monto total en pesos visible y correcto",P,A,FU,""),

    ("DASH-003","Dashboard no accesible sin rol admin",
     "Usuario no admin",
     "1. Intentar acceder a /admin/dashboard con token no-admin",
     "403 o redirect. Datos del dashboard no visibles",P,A,SE,""),

    ("DASH-004","Dashboard carga sin errores con datos vacíos",
     "Sistema sin pedidos (caso inicial)",
     "1. Acceder al dashboard con sistema vacío",
     "Dashboard visible con valores en cero. Sin errores en consola",P,M,UX,""),
]

# ══════════════════════════════════════════════════════════════════════════════
VIEWS["🛒 Admin – Productos"] = [
    ("APROD-001","Lista de productos con imágenes y precios",
     "Al menos un producto en el sistema",
     "1. Navegar a /admin/productos",
     "Lista de productos con foto, nombre, categoría y precio mayorista",P,A,FU,""),

    ("APROD-002","Crear nuevo producto",
     "Admin autenticado. Categorías, tallas y colores cargados",
     "1. Click en 'Nuevo producto'\n2. Completar nombre, descripción, categoría y precio base\n3. Guardar",
     "Producto creado. Aparece en la lista y en el catálogo público",P,A,FU,""),

    ("APROD-003","Editar producto existente",
     "Al menos un producto en el sistema",
     "1. Click en editar de un producto\n2. Cambiar nombre o categoría\n3. Guardar",
     "Cambios guardados. Producto actualizado en lista y catálogo",P,A,FU,""),

    ("APROD-004","Eliminar producto con confirmación",
     "Producto sin pedidos activos",
     "1. Click en eliminar de un producto\n2. Confirmar en dialog\n3. Verificar lista",
     "Producto eliminado de la lista y del catálogo público",P,M,FU,""),

    ("APROD-005","Crear variante (talla + color) en producto",
     "Producto existente. Tallas y colores configurados",
     "1. Abrir producto\n2. Click en 'Agregar variante'\n3. Seleccionar talla y color\n4. Guardar",
     "Variante creada y visible en el producto",P,A,FU,""),

    ("APROD-006","Eliminar variante de producto",
     "Producto con al menos una variante",
     "1. Ir al producto\n2. Click en eliminar variante\n3. Confirmar",
     "Variante eliminada. Si se re-agrega misma combinación: se reactiva (no duplica)",P,M,FU,"Soft-delete — re-insert reactiva"),

    ("APROD-007","Subir imagen de producto",
     "Imagen de prueba disponible (JPG/PNG)",
     "1. Abrir producto\n2. Click en 'Subir imagen'\n3. Seleccionar archivo\n4. Confirmar",
     "Imagen subida visible en galería del producto. URL accesible",P,A,FU,""),

    ("APROD-008","Reordenar imágenes del producto",
     "Producto con 2+ imágenes",
     "1. Abrir galería de imágenes del producto\n2. Cambiar el orden\n3. Guardar",
     "Nuevo orden de imágenes reflejado en detalle del producto público",P,M,FU,""),

    ("APROD-009","Eliminar imagen de producto",
     "Producto con al menos 2 imágenes",
     "1. Click en eliminar imagen\n2. Confirmar",
     "Imagen eliminada de la galería del producto",P,M,FU,""),

    ("APROD-010","Actualizar precios mayoristas por variante",
     "Producto con variantes configuradas",
     "1. Abrir producto\n2. Ir a sección de precios\n3. Actualizar precio de cada variante\n4. Guardar",
     "Precios actualizados. Mayoristas ven los nuevos precios en catálogo",P,A,FU,""),

    ("APROD-011","Panel de descuentos — crear regla por cantidad",
     "Producto existente en la lista",
     "1. Click en botón 'Descuentos' del producto\n2. Agregar regla: mínimo 10 unidades → 5% off\n3. Guardar",
     "Regla de descuento creada. Visible en la tabla de reglas",P,A,FU,"Agregada en Story 2-7"),

    ("APROD-012","Panel de descuentos — crear regla por curva",
     "Producto existente",
     "1. Click en 'Descuentos'\n2. Agregar regla de curva: mínimo 2 curvas → 3% off\n3. Guardar",
     "Regla de curva creada. Visible en la tabla. Se aplica al crear pedido con curvas",P,A,FU,"Agregada en Story 2-7"),

    ("APROD-013","Panel de descuentos — editar regla existente",
     "Al menos una regla de descuento creada",
     "1. Click en editar de una regla\n2. Cambiar el porcentaje\n3. Guardar",
     "Regla actualizada con el nuevo valor",P,M,FU,""),

    ("APROD-014","Panel de descuentos — eliminar regla",
     "Al menos una regla de descuento creada",
     "1. Click en eliminar de una regla\n2. Confirmar",
     "Regla eliminada de la tabla. Ya no se aplica en nuevos pedidos",P,M,FU,""),

    ("APROD-015","Configurar mínimo de compra del producto",
     "Producto existente con panel de descuentos abierto",
     "1. En panel de descuentos, ingresar mínimo de compra (ej: 6 unidades)\n2. Guardar",
     "Mínimo guardado. Al crear pedido con menos del mínimo: error de validación",P,M,FU,""),

    ("APROD-016","Campos requeridos vacíos al crear producto — validación",
     "Admin en formulario de nuevo producto",
     "1. Intentar guardar producto sin nombre\n2. Verificar validación",
     "Error de validación visible. No se crea el producto",P,M,VA,""),
]

# ══════════════════════════════════════════════════════════════════════════════
VIEWS["🚚 Admin – Despacho"] = [
    ("DESP-001","Lista de pedidos pendientes de despacho",
     "Al menos un pedido en estado que requiere despacho",
     "1. Navegar a /admin/despacho",
     "Lista de pedidos pendientes con items, comprador y fecha visible",P,A,FU,""),

    ("DESP-002","Notas del comprador visibles en el pedido",
     "Pedido con nota ingresada por el comprador",
     "1. Abrir la vista de despacho\n2. Buscar pedido con notas",
     "Nota del comprador visible en el panel del pedido (en color o ícono destacado)",P,M,FU,""),

    ("DESP-003","Fulfillment de item de curva — asignar color",
     "Pedido de tipo curva pendiente. Colores configurados",
     "1. Seleccionar item de curva\n2. Asignar color a cada talla\n3. Confirmar fulfillment",
     "Item marcado como fulfillado con color asignado. Estado actualizado",P,A,FU,""),

    ("DESP-004","Despachar pedido completo (unificado)",
     "Pedido con todos los items listos para despacho",
     "1. Verificar que todos los items están fulfillados\n2. Click en 'Despachar pedido'\n3. Confirmar",
     "Pedido pasa a estado 'Despachado'. Stock descontado según tipo de compra",P,A,FU,""),

    ("DESP-005","Decrement stock al despachar item",
     "Pedido con item de tipo cantidad",
     "1. Click en decrementar stock de un item al despacharlo",
     "Stock de la variante decrementado en la base de datos. Visible en catálogo",P,M,FU,""),

    ("DESP-006","Confirmar transferencia bancaria desde despacho",
     "Pedido en estado 'pending_transfer' (comprador eligió transferencia)",
     "1. Localizar pedido con transferencia pendiente\n2. Click en 'Confirmar transferencia'\n3. Confirmar",
     "Pedido pasa a 'Pagado'. Pago registrado como completado",P,A,FU,""),

    ("DESP-007","Lista vacía cuando no hay pedidos pendientes",
     "Todos los pedidos ya despachados",
     "1. Navegar a /admin/despacho con sin pedidos pendientes",
     "Mensaje de 'Sin pedidos pendientes' o lista vacía sin errores",P,M,UX,""),

    ("DESP-008","Información del pedido correcta (productos, tallas, cantidades)",
     "Pedido pendiente con múltiples items",
     "1. Abrir la vista de despacho\n2. Verificar datos de cada item del pedido",
     "Nombre del producto, variante (talla/color), cantidad y tipo de compra correctos",P,A,FU,""),
]

# ══════════════════════════════════════════════════════════════════════════════
VIEWS["💳 Admin – Pagos"] = [
    ("APAG-001","Lista de todos los pagos",
     "Al menos un pago en el sistema",
     "1. Navegar a /admin/pagos",
     "Lista de pagos con monto, estado, gateway, fecha y usuario visible",P,A,FU,""),

    ("APAG-002","Estado del pago visible con colores",
     "Pagos en distintos estados (paid, pending, failed)",
     "1. Navegar a la tabla de pagos\n2. Verificar badges de estado",
     "Estados con colores: verde=pagado, amarillo=pendiente, rojo=fallido",P,M,UX,""),

    ("APAG-003","Gateway de pago visible por fila",
     "Pagos con distintos gateways (checkout_pro, bank_transfer, mp_point, etc.)",
     "1. Navegar a /admin/pagos\n2. Verificar columna de gateway",
     "Gateway legible por fila: 'Checkout Pro', 'Transferencia', 'MP Point', etc.",P,M,FU,""),

    ("APAG-004","Monto y fecha de cada pago visible",
     "Al menos un pago registrado",
     "1. Navegar a /admin/pagos\n2. Verificar columnas de monto y fecha",
     "Monto en pesos y fecha/hora del pago visibles por fila",P,A,FU,""),

    ("APAG-005","Tabla no accesible sin rol admin",
     "Usuario sin rol admin",
     "1. Intentar acceder a /admin/pagos con token no-admin",
     "403 o redirect. Datos no visibles",P,A,SE,""),
]

# ══════════════════════════════════════════════════════════════════════════════
VIEWS["👥 Admin – Usuarios"] = [
    ("AUST-001","Lista de usuarios con nombre, email y roles",
     "Al menos un usuario registrado",
     "1. Navegar a /admin/usuarios",
     "Lista de usuarios con nombre, email, fecha de registro y roles",P,A,FU,""),

    ("AUST-002","Asignar rol Wholesale a usuario",
     "Usuario sin rol wholesale registrado",
     "1. Seleccionar usuario\n2. Click en 'Asignar rol'\n3. Seleccionar Wholesale\n4. Confirmar",
     "Rol wholesale asignado. Visible en la fila del usuario",P,A,FU,""),

    ("AUST-003","Asignar rol Admin a usuario",
     "Usuario sin rol admin",
     "1. Seleccionar usuario\n2. Asignar rol Admin\n3. Confirmar",
     "Rol admin asignado. El usuario puede acceder al panel de admin",P,A,FU,""),

    ("AUST-004","Remover rol de usuario",
     "Usuario con rol asignado",
     "1. Seleccionar usuario\n2. Click en remover el rol\n3. Confirmar",
     "Rol removido. Ya no aparece en la fila del usuario",P,M,FU,""),

    ("AUST-005","No se puede remover el último rol admin",
     "Solo hay un usuario admin",
     "1. Intentar remover el único rol admin del sistema",
     "Error o advertencia: debe quedar al menos un admin. Operación bloqueada",P,M,VA,"Verificar si existe este guard"),

    ("AUST-006","Lista no accesible sin rol admin",
     "Usuario no admin",
     "1. Intentar acceder a /admin/usuarios sin ser admin",
     "403 o redirect. Lista de usuarios no visible",P,A,SE,""),
]

# ══════════════════════════════════════════════════════════════════════════════
VIEWS["⚙️ Admin – Configuración"] = [
    ("CFG-001","Vista carga con todas las pestañas de config",
     "Admin autenticado",
     "1. Navegar a /admin/configuracion\n2. Verificar tabs disponibles",
     "Pestañas visibles: Tipos de compra, Tipos de cliente, Tallas, Colores, Branding, Medios de pago, Point",P,A,FU,""),

    ("CFG-002","Tab Branding — cambiar nombre de la tienda",
     "Admin en /admin/configuracion → tab Branding",
     "1. Ir al tab Branding\n2. Cambiar el nombre de la tienda\n3. Guardar\n4. Verificar en /catalogo",
     "Nuevo nombre visible en la tienda pública (cabecera o logo)",P,A,FU,""),

    ("CFG-003","Tab Branding — subir logo",
     "Admin en tab Branding. Imagen disponible",
     "1. Click en 'Subir logo'\n2. Seleccionar archivo de imagen\n3. Confirmar",
     "Logo nuevo visible en la tienda pública",P,A,FU,""),

    ("CFG-004","Tab Branding — configurar WhatsApp de contacto",
     "Admin en tab Branding",
     "1. Ingresar número de WhatsApp en el campo correspondiente\n2. Guardar\n3. Verificar en checkout con transferencia",
     "Número de WhatsApp visible en el link de contacto durante pago por transferencia",P,M,FU,""),

    ("CFG-005","Tab Medios de pago — activar gateway para Retail",
     "Admin en tab Medios de pago (Epic 17)",
     "1. Seleccionar tipo de cliente: Retail\n2. Activar gateway 'Checkout Pro'\n3. Guardar\n4. Iniciar checkout como usuario retail",
     "Checkout usa Checkout Pro para usuarios retail",P,A,FU,""),

    ("CFG-006","Tab Medios de pago — activar gateway para Mayorista",
     "Admin en tab Medios de pago",
     "1. Seleccionar tipo de cliente: Wholesale\n2. Activar 'Transferencia bancaria'\n3. Guardar\n4. Checkout como mayorista",
     "Checkout usa Transferencia bancaria para mayoristas",P,A,FU,""),

    ("CFG-007","Tab Medios de pago — activar múltiples gateways",
     "Admin en tab Medios de pago",
     "1. Activar 2+ gateways para un tipo de cliente\n2. Guardar\n3. Iniciar checkout como ese tipo",
     "Checkout muestra PaymentMethodSelector con todas las opciones activas",P,A,FU,""),

    ("CFG-008","Tab Medios de pago — desactivar gateway",
     "Gateway activo para un tipo de cliente",
     "1. Toggle gateway a inactivo\n2. Guardar\n3. Iniciar checkout",
     "Gateway desactivado ya no aparece en las opciones de pago",P,M,FU,""),

    ("CFG-009","Tab Point — muestra dispositivo activo",
     "Dispositivo Point sincronizado",
     "1. Navegar a tab Point en configuración",
     "Nombre del dispositivo Point activo visible. Proviene de /config (pointDevice)",P,M,FU,""),

    ("CFG-010","Tab Tipos de compra — CRUD",
     "Admin en tab Tipos de compra",
     "1. Crear nuevo tipo de compra\n2. Editar nombre\n3. Verificar en opciones de checkout",
     "Tipo de compra creado/editado. Disponible en formularios de pedido",P,M,FU,""),

    ("CFG-011","Tab Tipos de cliente — CRUD",
     "Admin en tab Tipos de cliente",
     "1. Crear nuevo tipo de cliente\n2. Editar nombre\n3. Verificar en registro",
     "Tipo de cliente creado/editado y disponible en el formulario de registro",P,M,FU,""),

    ("CFG-012","Tab Tallas — crear talla",
     "Admin en tab Tallas",
     "1. Click en 'Nueva talla'\n2. Ingresar etiqueta (ej: 'XL')\n3. Guardar",
     "Talla creada y disponible en formulario de variantes de productos",P,M,FU,""),

    ("CFG-013","Tab Tallas — soft-delete y reactivación",
     "Talla existente",
     "1. Eliminar talla\n2. Volver a crear talla con la misma etiqueta",
     "Al re-crear: reactiva la talla existente sin duplicar",P,M,FU,""),

    ("CFG-014","Tab Colores — CRUD",
     "Admin en tab Colores",
     "1. Crear color con nombre y código hex\n2. Verificar en variantes de productos",
     "Color disponible en formulario de variantes",P,M,FU,""),

    ("CFG-015","Cambios sin guardar — alerta antes de salir (si aplica)",
     "Admin con cambios no guardados en tab Branding",
     "1. Modificar datos del branding sin guardar\n2. Intentar cambiar de tab o salir",
     "Alerta de confirmación o cambios descartados de forma controlada",P,B,UX,"Verificar si existe este guard"),
]

# ══════════════════════════════════════════════════════════════════════════════
VIEWS["🖼️ Admin – Banners"] = [
    ("BAN-001","Vista carga con banners existentes",
     "Al menos un banner configurado",
     "1. Navegar a /admin/banners",
     "Lista/grilla de banners con imagen preview y estado visible",P,A,FU,""),

    ("BAN-002","Subir nuevo banner",
     "Imagen disponible (JPG/PNG/WebP). Admin en /admin/banners",
     "1. Click en 'Nuevo banner'\n2. Subir imagen\n3. Completar título (si aplica)\n4. Guardar",
     "Banner creado. Preview visible en la lista y en el catálogo público",P,A,FU,""),

    ("BAN-003","Editar banner existente",
     "Banner existente",
     "1. Click en editar de un banner\n2. Cambiar título o estado\n3. Guardar",
     "Cambios guardados y reflejados en lista de banners",P,M,FU,""),

    ("BAN-004","Reordenar banners",
     "Al menos 2 banners configurados",
     "1. Cambiar el orden de los banners\n2. Guardar\n3. Verificar en /catalogo",
     "Banners en nuevo orden en el catálogo público",P,M,FU,""),

    ("BAN-005","Eliminar banner",
     "Al menos un banner existente",
     "1. Click en eliminar\n2. Confirmar\n3. Verificar en /catalogo",
     "Banner eliminado de la lista y del catálogo público",P,M,FU,""),

    ("BAN-006","Banner visible en el catálogo público",
     "Al menos un banner activo",
     "1. Configurar banner como activo\n2. Navegar a /catalogo",
     "Banner visible en la zona correspondiente del catálogo",P,A,FU,""),
]

# ══════════════════════════════════════════════════════════════════════════════
VIEWS["📣 Admin – Anuncios"] = [
    ("ANN-001","Vista carga con anuncios existentes",
     "Al menos un anuncio configurado",
     "1. Navegar a /admin/anuncios",
     "Lista de anuncios con título, contenido y estado visible",P,A,FU,""),

    ("ANN-002","Crear nuevo anuncio",
     "Admin en /admin/anuncios",
     "1. Click en 'Nuevo anuncio'\n2. Completar título y contenido\n3. Guardar",
     "Anuncio creado y visible en la lista. Aparece en /catalogo para los usuarios",P,A,FU,""),

    ("ANN-003","Editar anuncio",
     "Anuncio existente",
     "1. Click en editar de un anuncio\n2. Modificar texto\n3. Guardar",
     "Cambios guardados. Anuncio actualizado en el catálogo público",P,M,FU,""),

    ("ANN-004","Reordenar anuncios",
     "Al menos 2 anuncios configurados",
     "1. Cambiar el orden de los anuncios\n2. Guardar\n3. Verificar en catálogo",
     "Anuncios en nuevo orden en el sidebar del catálogo",P,M,FU,""),

    ("ANN-005","Eliminar anuncio",
     "Al menos un anuncio existente",
     "1. Click en eliminar\n2. Confirmar",
     "Anuncio eliminado de la lista y del catálogo",P,M,FU,""),

    ("ANN-006","Anuncios visibles en tienda pública",
     "Al menos un anuncio activo",
     "1. Crear anuncio activo\n2. Navegar a /catalogo\n3. Verificar AnnouncementSidebar",
     "Anuncio visible en el sidebar del catálogo o zona designada",P,A,FU,""),
]

# ══════════════════════════════════════════════════════════════════════════════
VIEWS["🖲️ Admin – Point (POS)"] = [
    ("POINT-001","Vista carga correctamente",
     "Admin autenticado",
     "1. Navegar a /admin/point",
     "Panel visible con título 'Cobros Point'. Lista de pedidos o mensaje de sin dispositivo",P,A,FU,""),

    ("POINT-002","Sin dispositivo activo — mensaje informativo",
     "No hay dispositivo Point sincronizado",
     "1. Navegar a /admin/point\n2. Verificar mensaje",
     "Mensaje: 'No hay dispositivo Point configurado' o similar con instrucciones",P,A,UX,""),

    ("POINT-003","Dispositivo activo visible en el panel",
     "Dispositivo Point sincronizado en /admin/configuracion",
     "1. Navegar a /admin/point\n2. Verificar nombre del dispositivo",
     "Nombre del dispositivo activo visible en el encabezado del panel",P,A,FU,""),

    ("POINT-004","Lista de pedidos listos para cobro",
     "Pedidos en estado pagable. Dispositivo configurado",
     "1. Navegar a /admin/point\n2. Verificar lista de pedidos disponibles",
     "Pedidos elegibles para cobro presencial visibles con monto y comprador",P,A,FU,""),

    ("POINT-005","Iniciar cobro de pedido en dispositivo Point",
     "Pedido elegible. Dispositivo Point configurado y conectado a MP",
     "1. Seleccionar pedido de la lista\n2. Click en 'Iniciar cobro'\n3. Confirmar",
     "Intent creado. Dispositivo Point muestra el cobro pendiente. Estado: pending_point",P,A,FU,"Requiere dispositivo Point real o sandbox de MP"),

    ("POINT-006","Confirmar pago manualmente (fallback sin webhook)",
     "Intent de pago activo creado",
     "1. Con intent activo, click en 'Confirmar pago manual'\n2. Confirmar en dialog",
     "Pedido pasa a estado 'Pagado'. Stock decrementado. Confirmación visual en UI",P,A,FU,"Usar cuando el webhook no llega automáticamente"),

    ("POINT-007","Cancelar intent de pago activo",
     "Intent de pago activo",
     "1. Click en 'Cancelar cobro' para el pedido con intent activo\n2. Confirmar",
     "Intent cancelado. Pedido vuelve a estado anterior. Disponible para nuevo intent",P,M,FU,""),

    ("POINT-008","Pedido actualiza a 'Pagado' tras confirmación",
     "Intent confirmado (manual o por webhook)",
     "1. Confirmar pago (manual)\n2. Verificar estado en la lista del panel",
     "Pedido desaparece de 'pendientes de cobro' o muestra estado 'Pagado'",P,A,FU,""),

    ("POINT-009","Panel no accesible sin rol admin",
     "Usuario sin rol admin",
     "1. Intentar navegar a /admin/point con usuario no-admin",
     "403 o redirect. Panel de Point no accesible",P,A,SE,""),

    ("POINT-010","Webhook automático de MP Point (integración)",
     "Dispositivo Point real procesó el pago",
     "1. Procesar pago en dispositivo físico\n2. Esperar webhook de MP\n3. Verificar en panel",
     "Webhook recibido → pedido en 'Pagado' automáticamente. Sin intervención manual",P,A,FU,"Requiere dispositivo real o simulación de webhook"),
]

# ══════════════════════════════════════════════════════════════════════════════
VIEWS["📱 App Desktop – Login"] = [
    ("MOB-001","App desktop inicia correctamente en Linux",
     "Flutter app compilada para Linux. BFF accesible",
     "1. Ejecutar la app desktop (flutter run -d linux)\n2. Verificar que abre sin errores",
     "Pantalla de login visible. Sin errores de compilación o runtime",P,A,FU,"Ejecutar con: flutter run -d linux"),

    ("MOB-002","Login exitoso con credenciales de admin",
     "Usuario admin registrado en el sistema",
     "1. Ingresar email y password del admin\n2. Click en 'Iniciar sesión'",
     "Login exitoso. Navega al panel principal de gestión de stock",P,A,FU,""),

    ("MOB-003","Login con credenciales incorrectas muestra error",
     "App en pantalla de login",
     "1. Ingresar email o password incorrecto\n2. Click en 'Iniciar sesión'",
     "Mensaje de error visible en la app: credenciales inválidas",P,A,VA,""),

    ("MOB-004","Campos vacíos — validación en el formulario",
     "App en pantalla de login",
     "1. Dejar email y/o password vacío\n2. Intentar loguear",
     "Validación visible: campos requeridos. No realiza la llamada a la API",P,M,VA,""),

    ("MOB-005","Token persiste entre cierres de app",
     "Usuario logueado previamente",
     "1. Cerrar la app completamente\n2. Volver a abrir\n3. Verificar si pide login",
     "Si el token sigue vigente (24hs), navega directamente al panel. No pide login de nuevo",P,M,FU,"Depende del tiempo de expiración del token"),

    ("MOB-006","Logout funcional desde el panel principal",
     "Usuario logueado en la app desktop",
     "1. Navegar a opciones / menú\n2. Click en 'Cerrar sesión'",
     "Sesión cerrada. App regresa a pantalla de login",P,M,FU,""),
]

# ══════════════════════════════════════════════════════════════════════════════
VIEWS["📦 App Desktop – Stock"] = [
    ("STOCK-001","Lista de productos con variantes y stock actual",
     "Admin logueado en la app desktop. Productos cargados en el sistema",
     "1. Luego del login, navegar a la pantalla de stock\n2. Verificar lista de productos",
     "Productos visibles con nombre, variantes y cantidad de stock actual",P,A,FU,""),

    ("STOCK-002","Seleccionar producto y ver sus variantes",
     "Lista de productos cargada",
     "1. Tap/click en un producto de la lista\n2. Verificar detalle con variantes",
     "Variantes del producto visibles (talla, color, stock actual por variante)",P,A,FU,""),

    ("STOCK-003","Actualizar stock de una variante",
     "Variante seleccionada visible",
     "1. Seleccionar variante\n2. Ingresar nueva cantidad de stock\n3. Confirmar",
     "Stock actualizado. Confirmación visual en la app (ej: toast o texto de éxito)",P,A,FU,""),

    ("STOCK-004","Stock actualizado se refleja en el catálogo web",
     "Stock actualizado en app desktop",
     "1. Actualizar stock de variante en la app desktop\n2. Navegar al catálogo web\n3. Verificar stock",
     "El catálogo web refleja el nuevo stock. Variante sin stock se indica correctamente",P,A,FU,"Integración desktop ↔ web"),

    ("STOCK-005","Cantidad negativa — validación",
     "App en pantalla de actualización de stock",
     "1. Ingresar cantidad negativa (ej: -5)\n2. Intentar guardar",
     "Validación impide guardar. Mensaje de error: la cantidad debe ser ≥ 0",P,M,VA,""),

    ("STOCK-006","Cantidad no numérica — validación",
     "App en pantalla de actualización de stock",
     "1. Ingresar letras en el campo de cantidad\n2. Intentar guardar",
     "Teclado numérico o validación impide ingresar texto no numérico",P,M,VA,""),

    ("STOCK-007","Actualización de stock sin conexión — manejo de error",
     "BFF inaccesible (sin red)",
     "1. Desconectar red\n2. Intentar actualizar stock",
     "Mensaje de error de conectividad visible. App no crashea",P,M,FU,""),

    ("STOCK-008","Lista de productos actualiza al volver a la pantalla",
     "Stock modificado en otra sesión (ej: web)",
     "1. Con la app abierta, modificar stock desde la web admin\n2. Volver a la pantalla de stock en desktop",
     "Al navegar de vuelta (o pull-to-refresh), la lista muestra el stock actualizado",P,M,FU,""),
]


# ─── Generador de XLSX ────────────────────────────────────────────────────────

PRIORITY_COLORS = {"Alta": "FFCDD2", "Media": "FFF9C4", "Baja": "DCEDC8"}
STATUS_COLORS   = {"Pendiente": "FFFFFF","Pasó": "C8E6C9","Falló": "FFCDD2","Bloqueado": "FFE0B2","N/A": "F5F5F5"}
TYPE_COLORS     = {"Funcional": "E3F2FD","Navegación": "E8F5E9","Validación": "FFF3E0",
                   "Seguridad": "FCE4EC","UX": "EDE7F6","Performance": "F3E5F5"}

TAB_COLORS = {
    "🔐 Login":              "FF5252",
    "📝 Registro":           "FF9800",
    "🛍️ Catálogo":           "4CAF50",
    "👟 Detalle de Producto":"26A69A",
    "📦 Mis Pedidos":        "42A5F5",
    "🧾 Detalle de Pedido":  "5C6BC0",
    "✅ Confirmación de Pago":"66BB6A",
    "👤 Mi Perfil":          "78909C",
    "🏠 Admin – Inicio":     "AB47BC",
    "📊 Admin – Dashboard":  "EC407A",
    "🛒 Admin – Productos":  "FFA726",
    "🚚 Admin – Despacho":   "8D6E63",
    "💳 Admin – Pagos":      "26C6DA",
    "👥 Admin – Usuarios":   "7E57C2",
    "⚙️ Admin – Configuración":"455A64",
    "🖼️ Admin – Banners":    "F06292",
    "📣 Admin – Anuncios":   "FFCA28",
    "🖲️ Admin – Point (POS)":"EF5350",
    "📱 App Desktop – Login":"1565C0",
    "📦 App Desktop – Stock":"2E7D32",
}

def xml_escape(s):
    return (str(s).replace("&","&amp;").replace("<","&lt;")
            .replace(">","&gt;").replace('"',"&quot;").replace("'","&apos;"))

def col_letter(n):
    result = ""
    n += 1
    while n:
        n, r = divmod(n - 1, 26)
        result = chr(65 + r) + result
    return result

def build_all_colors():
    colors = set()
    for v in PRIORITY_COLORS.values(): colors.add(v)
    for v in STATUS_COLORS.values():
        if v != "FFFFFF": colors.add(v)
    for v in TYPE_COLORS.values(): colors.add(v)
    return list(colors)

def build_styles(all_colors):
    fills = [
        '<fill><patternFill patternType="none"/></fill>',
        '<fill><patternFill patternType="gray125"/></fill>',
    ]
    # Header fill index = 2
    fills.append('<fill><patternFill patternType="solid"><fgColor rgb="FF1A237E"/><bgColor indexed="64"/></patternFill></fill>')
    header_fill_idx = 2

    fill_idx = {}
    for color in all_colors:
        fill_idx[color] = len(fills)
        fills.append(f'<fill><patternFill patternType="solid"><fgColor rgb="FF{color}"/><bgColor indexed="64"/></patternFill></fill>')

    fills_xml = f'<fills count="{len(fills)}">{"".join(fills)}</fills>'

    fonts = [
        '<font><sz val="10"/><name val="Calibri"/></font>',
        '<font><b/><sz val="10"/><name val="Calibri"/><color rgb="FFFFFFFF"/></font>',
        '<font><b/><sz val="10"/><name val="Calibri"/></font>',
    ]
    fonts_xml = f'<fonts count="{len(fonts)}">{"".join(fonts)}</fonts>'

    borders = [
        '<border><left/><right/><top/><bottom/><diagonal/></border>',
        '<border><left style="thin"><color auto="1"/></left><right style="thin"><color auto="1"/></right><top style="thin"><color auto="1"/></top><bottom style="thin"><color auto="1"/></bottom><diagonal/></border>',
    ]
    borders_xml = f'<borders count="{len(borders)}">{"".join(borders)}</borders>'

    # xf styles
    xfs = [
        '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>',  # 0 default
        # 1: header — bold white on dark blue, centered, wrap
        f'<xf numFmtId="0" fontId="1" fillId="{header_fill_idx}" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>',
        # 2: normal — no fill, border, wrap, top align
        '<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>',
        # 3: normal centered
        '<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="top" wrapText="1"/></xf>',
        # 4: bold ID
        '<xf numFmtId="0" fontId="2" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="top" wrapText="1"/></xf>',
    ]
    color_xf = {}  # color -> (xf_index, xf_index_centered)
    for color, fi in fill_idx.items():
        color_xf[color] = len(xfs)
        xfs.append(f'<xf numFmtId="0" fontId="0" fillId="{fi}" borderId="1" xfId="0" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>')
        color_xf[color + "_c"] = len(xfs)
        xfs.append(f'<xf numFmtId="0" fontId="0" fillId="{fi}" borderId="1" xfId="0" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="top" wrapText="1"/></xf>')

    xfs_xml = f'<cellXfs count="{len(xfs)}">{"".join(xfs)}</cellXfs>'

    styles_xml = f'''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
{fonts_xml}{fills_xml}{borders_xml}
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
{xfs_xml}
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>'''
    return styles_xml, color_xf

def build_shared_strings(all_views):
    seen = {}
    strs = []
    def idx(s):
        s = str(s)
        if s not in seen:
            seen[s] = len(strs)
            strs.append(s)
        return seen[s]
    for h in HEADERS: idx(h)
    for rows in all_views.values():
        for row in rows:
            for cell in row:
                idx(str(cell))
    parts = [
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
        f'<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="{sum(len(r) for rows in all_views.values() for r in rows)}" uniqueCount="{len(strs)}">',
    ]
    for s in strs:
        parts.append(f'<si><t xml:space="preserve">{xml_escape(s)}</t></si>')
    parts.append('</sst>')
    return '\n'.join(parts), seen

def build_sheet(rows, string_idx, color_xf):
    COL_WIDTHS = [9, 36, 32, 32, 38, 13, 10, 14, 20]
    NUM_COLS   = len(HEADERS)
    # Column indices (0-based)
    # 0=ID, 1=Nombre, 2=Precond, 3=Pasos, 4=Resultado, 5=Estado, 6=Prioridad, 7=Tipo, 8=Notas
    CENTERED = {0, 5, 6, 7}

    cols_xml = "<cols>" + "".join(
        f'<col min="{i+1}" max="{i+1}" width="{w}" customWidth="1"/>'
        for i, w in enumerate(COL_WIDTHS[:NUM_COLS])
    ) + "</cols>"

    def scell(col, row_num, si, xf):
        return f'<c r="{col_letter(col)}{row_num}" t="s" s="{xf}"><v>{si}</v></c>'

    rows_xml = []
    # Header
    header_cells = "".join(scell(ci, 1, string_idx[h], 1) for ci, h in enumerate(HEADERS))
    rows_xml.append(f'<row r="1" ht="22" customHeight="1">{header_cells}</row>')

    for ri, row in enumerate(rows):
        excel_row = ri + 2
        tipo_val   = str(row[7])   # Tipo de prueba
        prio_val   = str(row[6])   # Prioridad
        status_val = str(row[5])   # Estado

        # Base fill from Tipo
        tipo_color = TYPE_COLORS.get(tipo_val, "")
        base_xf   = color_xf.get(tipo_color, 2)      if tipo_color else 2
        base_xf_c = color_xf.get(tipo_color + "_c", 3) if tipo_color else 3

        row_cells = ""
        for ci, cell in enumerate(row):
            val = str(cell)
            si  = string_idx[val]

            if ci == 5:  # Estado
                sc = STATUS_COLORS.get(val, "FFFFFF")
                xf = color_xf.get(sc + "_c", 3) if sc != "FFFFFF" else 3
            elif ci == 6:  # Prioridad
                pc = PRIORITY_COLORS.get(val, "")
                xf = color_xf.get(pc + "_c", 3) if pc else 3
            elif ci == 0:  # ID
                xf = 4  # bold centered
            elif ci in CENTERED:
                xf = base_xf_c
            else:
                xf = base_xf
            row_cells += scell(ci, excel_row, si, xf)

        rows_xml.append(f'<row r="{excel_row}">{row_cells}</row>')

    return f'''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<sheetViews><sheetView workbookViewId="0"><selection activeCell="A2"/></sheetView></sheetViews>
{cols_xml}
<sheetData>{"".join(rows_xml)}</sheetData>
</worksheet>'''

def build_xlsx(output_path):
    view_names = list(VIEWS.keys())
    all_colors = build_all_colors()
    styles_xml, color_xf = build_styles(all_colors)
    shared_strings_xml, string_idx = build_shared_strings(VIEWS)

    # Build sheets
    sheets = {}
    for name in view_names:
        sheets[name] = build_sheet(VIEWS[name], string_idx, color_xf)

    # ── XML files ─────────────────────────────────────────────────────────────
    sheet_entries_ct  = ""
    sheet_rels        = ""
    workbook_sheets   = ""
    for i, name in enumerate(view_names):
        sid = i + 1
        sheet_entries_ct += f'<Override PartName="/xl/worksheets/sheet{sid}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>\n'
        sheet_rels       += f'<Relationship Id="rId{sid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet{sid}.xml"/>\n'
        workbook_sheets  += f'<sheet name="{xml_escape(name)}" sheetId="{sid}" r:id="rId{sid}"/>\n'

    styles_rel_id = len(view_names) + 1
    ss_rel_id     = len(view_names) + 2

    sheet_rels += f'<Relationship Id="rId{styles_rel_id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>\n'
    sheet_rels += f'<Relationship Id="rId{ss_rel_id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/>\n'

    content_types = f'''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
{sheet_entries_ct}
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
<Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>
</Types>'''

    rels = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>'''

    workbook = f'''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"
          xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets>{workbook_sheets}</sheets>
</workbook>'''

    workbook_rels = f'''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
{sheet_rels}
</Relationships>'''

    with zipfile.ZipFile(output_path, 'w', zipfile.ZIP_DEFLATED) as zf:
        zf.writestr('[Content_Types].xml',      content_types)
        zf.writestr('_rels/.rels',              rels)
        zf.writestr('xl/workbook.xml',          workbook)
        zf.writestr('xl/_rels/workbook.xml.rels', workbook_rels)
        zf.writestr('xl/styles.xml',            styles_xml)
        zf.writestr('xl/sharedStrings.xml',     shared_strings_xml)
        for i, name in enumerate(view_names):
            zf.writestr(f'xl/worksheets/sheet{i+1}.xml', sheets[name])

    total = sum(len(v) for v in VIEWS.values())
    print(f"✓ Generado: {output_path}")
    print(f"  {len(VIEWS)} pestañas | {total} casos de prueba")
    for name, cases in VIEWS.items():
        print(f"  {name}: {len(cases)} casos")

if __name__ == "__main__":
    build_xlsx("jedami_testing_v1.xlsx")

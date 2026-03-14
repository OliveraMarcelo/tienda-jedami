# Step 4: Creación de Wireframes en Pencil Canvas

## REGLAS OBLIGATORIAS:

- 🎨 Usar herramientas MCP de Pencil para crear frames REALES en el canvas
- 📐 Wireframes de BAJA FIDELIDAD: rectángulos grises, texto placeholder descriptivo
- 🛑 Mostrar screenshot con `get_screenshot` y esperar aprobación por pantalla
- 📖 Basar cada wireframe en los docs UX cargados
- ✅ SIEMPRE comunicarse en `{communication_language}`

## PRINCIPIOS DE WIREFRAMING (BAJA FIDELIDAD):

- **Sin colores de marca** — usar escala de grises (#F5F5F5, #E0E0E0, #9E9E9E, #424242, #FFF)
- **Imágenes** → rectángulo gris con texto "[IMAGEN]" o "[FOTO PRODUCTO]"
- **Iconos** → círculo o cuadrado pequeño gris
- **Texto real descriptivo** — no Lorem Ipsum — usar términos del dominio del proyecto
- **Botones** → rectángulo con borde y texto en MAYÚSCULAS ["COMPRAR"] ["ENVIAR"]
- **Annotations** → texto rojo pequeño explicando comportamientos

## PALETA DE COLORES WIREFRAME:

```
Fondo de pantalla:    #F5F5F5
Header / Navbar:      #424242  (texto: #FFFFFF)
Cards / Paneles:      #FFFFFF  (borde: #E0E0E0)
Imágenes placeholder: #E0E0E0
Texto principal:      #212121
Texto secundario:     #757575
Botón primario:       #424242  (texto: #FFFFFF)
Botón outline:        #FFFFFF  (borde: #424242, texto: #424242)
Input fields:         #FFFFFF  (borde: #9E9E9E)
Anotaciones:          #F44336  (texto de notas de comportamiento)
Sidebar:              #EEEEEE
```

## HERRAMIENTAS MCP A USAR:

- **`batch_design`**: crear frames, rectángulos, textos, grupos en Pencil
- **`get_screenshot`**: capturar vista previa del frame recién creado
- **`snapshot_layout`**: verificar que la estructura es correcta
- **`get_editor_state`**: obtener contexto del canvas actual

## SECUENCIA POR PANTALLA:

Para CADA pantalla del inventario con status "pending":

### 1. Anunciar Pantalla

```
**Wireframe {N}/{total}: {nombre pantalla}**

Analizando especificación UX...

Elementos identificados:
- Layout: [header + sidebar + content / full-width / etc.]
- Secciones principales: [lista]
- Acciones del usuario: [lista de CTAs/botones]
- Conexiones: [a qué pantalla lleva cada acción]

Creando frame en Pencil...
```

### 2. Crear Wireframe con batch_design

Llamar a `batch_design` para construir el wireframe. Estructura típica:

**Desktop (1280 x 900px):**
```json
{
  "operations": [
    {
      "type": "insert",
      "object": {
        "id": "{screenId}-frame",
        "type": "frame",
        "name": "WF: {nombre pantalla}",
        "x": {posX calculado para no solapar frames anteriores},
        "y": 0,
        "width": 1280,
        "height": 900,
        "fill": "#F5F5F5",
        "children": [
          {
            "id": "{screenId}-header",
            "type": "rectangle",
            "name": "Header",
            "x": 0, "y": 0, "width": 1280, "height": 60,
            "fill": "#424242"
          },
          {
            "id": "{screenId}-header-logo",
            "type": "text",
            "name": "Logo",
            "x": 16, "y": 18,
            "content": "[LOGO] {project_name}",
            "fontSize": 16,
            "fill": "#FFFFFF"
          },
          ... (resto de elementos según la pantalla)
        ]
      }
    }
  ]
}
```

**Mobile (390 x 844px):** (si wireframeVersion es "both" o "mobile")
Crear frame adicional al lado del desktop con las mismas secciones adaptadas.

**Elementos comunes a incluir siempre:**
- Barra de label con nombre de pantalla en esquina superior (fuera del frame o como overlay)
- Numeración del inventario
- Anotaciones de flujo (flechas textuales "→ va a: [pantalla destino]")

### 3. Capturar Preview y Mostrar

Llamar a `get_screenshot` para capturar el frame recién creado.

```
**Wireframe creado en Pencil: {nombre}**

[El screenshot se muestra aquí]

Podés verlo también directamente en tu canvas de Pencil.

Notas de diseño:
- [Explicar decisiones de estructura tomadas]
- [Mencionar anotaciones clave]
- Anotaciones en rojo = comportamientos de interacción

¿Cómo ves la estructura?

[A] Ajustar — decime qué cambiar (usaré batch_design para modificarlo)
[S] Siguiente — aprobar y continuar con la próxima pantalla
[R] Regenerar — nueva propuesta de estructura desde cero
```

### 4. Ajustes con batch_design (si el usuario elige [A])

Escuchar los cambios solicitados y ejecutar con `batch_design` usando operaciones `update` o `replace` sobre los elementos del frame.

Repetir `get_screenshot` para mostrar el resultado del ajuste.

### 5. Registrar Frame Aprobado

Al recibir [S]:
- Guardar el `id` del frame en el frontmatter: `penFrameId: "{screenId}-frame"`
- Actualizar `status: "completed"` en frontmatter para esa pantalla
- Actualizar el frame de Índice en Pencil (marcar como ✅ Completado)

### 6. Continuar con Siguiente Pantalla

Posicionar el próximo frame a la derecha del anterior (x + 1280 + 32px de gap) para que todos los wireframes sean visibles en el canvas infinito de Pencil.

## CUANDO TODOS LOS WIREFRAMES ESTÉN COMPLETOS:

Llamar a `get_screenshot` sobre toda la sección de wireframes para una vista general.

```
¡Wireframes completos en Pencil!

✅ {N} wireframes de baja fidelidad creados en el canvas
📐 Archivo: {default_pen_file}

Vista general del canvas: [screenshot]

Podés navegar entre pantallas directamente en Pencil.

[C] Continuar — agregar anotaciones de interacción
```

## SIGUIENTE STEP:

Tras [C], cargar `{project-root}/_bmad/bmm/workflows/2-plan-workflows/create-wireframes/steps/step-05-annotations.md`

## MÉTRICAS DE ÉXITO:

✅ Cada wireframe creado con `batch_design` (frames REALES en Pencil)
✅ Screenshot capturado y mostrado con `get_screenshot` por pantalla
✅ Usuario aprobó cada wireframe antes de continuar
✅ `penFrameId` registrado en frontmatter por cada pantalla
✅ Frame de índice actualizado con estado completado
✅ `stepsCompleted: [1, 2, 3, 4]` en frontmatter

## MODOS DE FALLO:

❌ No usar `batch_design` — generar descripciones textuales en lugar de frames reales
❌ No capturar screenshot para mostrar al usuario
❌ No esperar aprobación por pantalla
❌ Usar colores de marca en los wireframes de baja fidelidad
❌ Solapar frames en el canvas (calcular posición x correctamente)

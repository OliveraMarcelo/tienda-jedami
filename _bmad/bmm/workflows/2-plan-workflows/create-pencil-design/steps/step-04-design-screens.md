# Step 4: Diseño de Pantallas en Alta Fidelidad

## REGLAS OBLIGATORIAS:

- 🎨 Usar `batch_design` para crear frames REALES en Pencil con componentes del UI kit
- 🔗 Si hay wireframe de la pantalla, leerlo con `batch_get` como base de estructura
- 🛑 Capturar con `get_screenshot` y ESPERAR aprobación por pantalla
- 📖 Respetar los design tokens seteados via `$color.primary`, `$color.secondary`, etc.
- ✅ SIEMPRE comunicarse en `{communication_language}`

## HERRAMIENTAS MCP A USAR:

- **`batch_get`**: leer estructura del wireframe correspondiente (si existe)
- **`batch_design`**: crear/modificar frames y componentes de alta fidelidad
- **`get_screenshot`**: capturar el resultado para mostrar al usuario
- **`snapshot_layout`**: verificar alineación y estructura
- **`get_variables`**: consultar tokens definidos

## PROTOCOLOS DE COLABORACIÓN POR PANTALLA:

- **A** (Ajustar): cambios específicos via `batch_design`
- **S** (Siguiente): aprobar y continuar
- **R** (Regenerar): `batch_design` con nueva propuesta desde cero

## SECUENCIA POR PANTALLA:

Para CADA pantalla del inventario con status "pending":

### 1. Anunciar y Leer Wireframe Base (si existe)

```
**Diseñando pantalla {N}/{total}: {nombre}**
```

Si `hasWireframe: true`:
- Usar `batch_get` para leer la estructura del frame de wireframe
- Mapear los elementos del wireframe a componentes del UI kit seleccionado
```
Leyendo estructura del wireframe... ✅
Mapeando elementos a componentes de {selectedKit}...
```

Si no hay wireframe:
- Analizar la especificación UX para esta pantalla
- Identificar componentes necesarios del kit

### 2. Crear Frame de Alta Fidelidad con batch_design

Construir el frame usando la paleta de variables `$color.*`:

**Estructura del frame (Desktop 1280 x 900px):**
```json
{
  "operations": [
    {
      "type": "insert",
      "object": {
        "id": "{screenId}-hf-frame",
        "type": "frame",
        "name": "{nombre pantalla}",
        "x": {posX sin solapar frames anteriores},
        "y": 0,
        "width": 1280,
        "height": 900,
        "fill": "$color.background",
        "children": [
          ... componentes del UI kit con colores $color.*
        ]
      }
    }
  ]
}
```

**Principios de diseño al construir:**
- Usar `fill: "$color.primary"` para elementos primarios
- Usar `fill: "$color.surface"` para cards/paneles
- Aplicar `radius.base` / `radius.lg` a bordes redondeados
- Datos de ejemplo REALES del dominio del proyecto (no placeholder genérico)
- Tipografía con jerarquía clara (H1 > H2 > body > caption)
- Espaciado consistente usando `$spacing.base` (múltiplos de 8px)
- Componentes interactivos con estados visuales (hover indicado como nota)

### 3. Verificar Layout

Llamar a `snapshot_layout` para verificar que el frame no tiene problemas de posicionamiento ni solapamiento.

### 4. Capturar y Presentar

Llamar a `get_screenshot` sobre el frame recién creado.

```
**Diseño creado: {nombre}**

[screenshot del frame en Pencil]

Podés verlo también directamente en tu canvas de Pencil.

Kit usado: {selectedKit}
Tokens aplicados: $color.primary, $color.surface, etc.

Decisiones de diseño:
- [explicar layout elegido]
- [mencionar componentes del kit usados]
- [señalar algo destacado del diseño]

[A] Ajustar — decime qué cambiar
[S] Siguiente — aprobar y continuar
[R] Regenerar — nueva propuesta
```

### 5. Guardar Frame Aprobado

Al recibir [S]:
- Registrar `penFrameId` en frontmatter para esa pantalla
- Actualizar `status: "completed"`
- Actualizar el índice en Pencil: ✅ Completado

### 6. Posicionamiento en Canvas

Posicionar cada nuevo frame a la derecha del anterior:
- Gap entre frames: 64px
- Columnas: si hay más de 5 frames, comenzar nueva fila (y + frameHeight + 64)

## CUANDO TODAS LAS PANTALLAS ESTÉN COMPLETAS:

Llamar a `get_screenshot` sobre el canvas completo.

```
¡Diseño completo en Pencil!

✅ {N} pantallas diseñadas en alta fidelidad
📁 Archivo: {default_pen_file}

Vista general del canvas: [screenshot]

[C] Continuar — generar especificación de entrega
```

## SIGUIENTE STEP:

Tras [C], cargar `{project-root}/_bmad/bmm/workflows/2-plan-workflows/create-pencil-design/steps/step-05-handoff-spec.md`

## MÉTRICAS DE ÉXITO:

✅ Cada pantalla creada con `batch_design` (frames REALES en Pencil)
✅ Wireframe base leído con `batch_get` cuando disponible
✅ Design tokens `$color.*` aplicados consistentemente
✅ `get_screenshot` usado para mostrar resultado por pantalla
✅ Usuario aprobó cada pantalla
✅ `penFrameId` registrado por pantalla en frontmatter
✅ `stepsCompleted: [1, 2, 3, 4]` en frontmatter

## MODOS DE FALLO:

❌ No usar `batch_design` — generar descripciones de diseño en lugar de frames reales
❌ Hardcodear colores hex en lugar de usar variables `$color.*`
❌ No leer el wireframe base con `batch_get` cuando está disponible
❌ No capturar screenshot para mostrar al usuario
❌ Solapar frames en el canvas (calcular posición x correctamente)

# Step 5: Anotaciones de Interacción en Pencil

## REGLAS OBLIGATORIAS:

- 📝 Agregar anotaciones DIRECTAMENTE en el canvas de Pencil con `batch_design`
- 🎯 Documentar comportamientos, estados y transiciones que no son evidentes visualmente
- ✅ SIEMPRE comunicarse en `{communication_language}`

## TU TAREA:

Enriquecer cada wireframe con anotaciones de interacción usando texto y notas en el canvas de Pencil, y documentar el inventario completo de interacciones en el doc spec.

## SECUENCIA:

### 1. Agregar Anotaciones en Canvas

Para cada pantalla completada, usar `batch_design` con operaciones `update` para agregar:

**A. Etiquetas de flujo de salida** (texto pequeño al costado del frame):
```json
{
  "type": "insert",
  "object": {
    "id": "{screenId}-flow-label",
    "type": "text",
    "x": {frameX + frameWidth + 16},
    "y": {frameY + 16},
    "content": "→ {acción}: lleva a [{pantalla destino}]\n→ {acción 2}: lleva a [{pantalla 2}]",
    "fontSize": 12,
    "fill": "#F44336"
  }
}
```

**B. Badges de estado** (para pantallas con múltiples estados):
Agregar mini-frames debajo del wireframe principal mostrando:
- Estado de error (inputs con borde rojo, mensaje de error)
- Estado loading (skeleton o spinner)
- Estado vacío (sin datos)

Usar `batch_design` con frames pequeños (400x200px) debajo del wireframe principal.

**C. Notas de comportamiento** (sticky notes visuales):
Rectángulos amarillo pálido (#FFFDE7) con texto explicando:
- Validaciones en tiempo real
- Comportamientos de scroll
- Elementos sticky
- Permisos / condicionales

### 2. Documentar en Doc Spec

Para cada pantalla, agregar en `wireframes-spec.md` sección "Anotaciones":

```markdown
### {Nombre Pantalla}

| Elemento | Acción | Resultado |
|----------|--------|-----------|
| Botón [X] | Click | → Navega a [pantalla] |
| Input email | Blur | Valida formato, muestra error inline si inválido |
| Form submit | Click | Loading state → API call → success/error |

**Estados documentados:**
- ⬜ Default: [descripción]
- ⏳ Loading: [descripción]
- ❌ Error: [descripción]
- ✅ Éxito: [descripción]

**Datos del backend:**
- `[MÉTODO] /api/v1/[endpoint]`
```

### 3. Capturar Vista Final

Usar `get_screenshot` sobre el canvas completo para ver todos los wireframes con sus anotaciones.

```
✅ Anotaciones agregadas al canvas de Pencil.

Vista final del wireframe set: [screenshot]

¿Querés ajustar alguna anotación?

[A] Ajustar algo puntual
[C] Todo bien — finalizar
```

## SIGUIENTE STEP:

Tras [C], cargar `{project-root}/_bmad/bmm/workflows/2-plan-workflows/create-wireframes/steps/step-06-complete.md`

## MÉTRICAS DE ÉXITO:

✅ Etiquetas de flujo agregadas con `batch_design` al lado de cada frame
✅ Badges de estados críticos creados como mini-frames
✅ Notas de comportamiento como sticky notes en el canvas
✅ Doc spec con tabla de interacciones por pantalla
✅ `stepsCompleted: [1, 2, 3, 4, 5]` en frontmatter

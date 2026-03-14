# Step 3: Inventario de Pantallas para el Diseño Final

## REGLAS OBLIGATORIAS:

- 📋 Extraer pantallas de docs UX y/o wireframes existentes
- 🔗 Si hay wireframes previos en Pencil, usarlos como referencia directa
- ✅ Confirmar lista con usuario antes de proceder
- ✅ SIEMPRE comunicarse en `{communication_language}`

## TU TAREA:

Consolidar la lista de pantallas a diseñar en alta fidelidad. Si hay wireframes, usar `batch_get` para leer la estructura directamente del `.pen` de wireframes.

## SECUENCIA:

### 1. Obtener Pantallas de Wireframes (si existen)

Si se detectó un archivo `*wireframes.pen` o wireframes en el canvas actual:

Usar `batch_get` para listar los frames del documento de wireframes:
```
Leyendo frames del wireframe desde Pencil...
```

Esto da la lista exacta de pantallas ya definidas estructuralmente.

### 2. Complementar con Docs UX

Cruzar con los documentos UX para verificar:
- ¿Hay pantallas en los docs que faltan en los wireframes?
- ¿Hay pantallas en los wireframes que ya no son relevantes?

### 3. Presentar Inventario

```
Pantallas para el diseño final de {project_name}:

{Si hay wireframes:}
📐 Estructuras base disponibles desde wireframes:

**🔐 Autenticación:**
✓ Login (wireframe disponible)
✓ Registro (wireframe disponible)

**🏠 Núcleo:**
✓ Home / Dashboard (wireframe disponible)
...

{Si NO hay wireframes:}
Identificadas desde docs UX:
...

Total: {N} pantallas

¿Agregamos o quitamos alguna?

[C] Confirmar lista y comenzar diseño
```

### 4. Registrar en Frontmatter

```yaml
screens:
  - id: "login"
    name: "Login"
    category: "autenticacion"
    priority: 1
    hasWireframe: true
    wireframePenFrameId: "{id del frame en wireframes.pen}"
    status: "pending"
    penFrameId: ""
```

### 5. Crear Frame de Índice en Pencil Design

Usar `batch_design` para crear un frame "🗂 Índice de Pantallas" en el `.pen` de diseño, con cards por pantalla indicando estado.

## SIGUIENTE STEP:

Tras [C], cargar `{project-root}/_bmad/bmm/workflows/2-plan-workflows/create-pencil-design/steps/step-04-design-screens.md`

## MÉTRICAS DE ÉXITO:

✅ Pantallas obtenidas de wireframes via `batch_get` (si existen)
✅ Lista confirmada por usuario
✅ Frontmatter `screens` con `hasWireframe` y `wireframePenFrameId`
✅ Frame de índice creado en el canvas de diseño
✅ `stepsCompleted: [1, 2, 3]` en frontmatter

# Step 5: Especificación de Entrega (Design Handoff)

## REGLAS OBLIGATORIAS:

- 📋 Generar especificación de entrega para el equipo de desarrollo
- 🔍 Usar `get_variables` y `batch_get` para extraer datos reales del `.pen`
- ✅ SIEMPRE comunicarse en `{communication_language}`

## TU TAREA:

Generar el documento de design handoff que el equipo de desarrollo usará para implementar el diseño. Extraer datos reales del archivo `.pen` via MCP.

## SECUENCIA:

### 1. Extraer Design Tokens del .pen

Llamar a `get_variables` para obtener los tokens actuales tal como quedaron en el archivo:

```
Leyendo design tokens de Pencil via get_variables...
```

### 2. Captura de Vista General Final

Llamar a `get_screenshot` sobre el canvas completo para documentar el estado final del diseño.

### 3. Generar Documento de Handoff

Escribir en `pencil-design-spec.md` la sección de entrega:

```markdown
## Design Handoff — {project_name}

**Archivo Pencil:** `{default_pen_file}`
**UI Kit:** {selectedKit}
**Fecha:** {date}

---

### Design Tokens

```css
/* Importar en el proyecto como variables CSS */
:root {
  --color-primary: {primary};
  --color-secondary: {secondary};
  --color-accent: {accent};
  --color-background: {background};
  --color-surface: {surface};
  --color-text: {text};
  --color-text-secondary: {text-secondary};
  --color-error: {error};
  --color-success: {success};
  --radius-base: {radius-base};
  --radius-lg: {radius-lg};
  --spacing-base: {spacing-base};
}
```

### Pantallas Diseñadas

| Pantalla | Frame en Pencil | Kit Components | Estado |
|----------|----------------|----------------|--------|
| {nombre} | {penFrameId} | [lista de componentes] | ✅ |
...

### Instrucciones para el Equipo Dev

1. **Abrir el archivo Pencil:** `{default_pen_file}`
   - Pencil se puede abrir con la app de escritorio o extensión VS Code

2. **Inspeccionar componentes:** Click en cualquier elemento para ver:
   - Dimensiones exactas
   - Colores como variables ($color.*)
   - Tipografía y espaciado

3. **Extraer código:** Pencil puede generar código desde los diseños
   - Usar Claude Code con el MCP de Pencil activo:
     "Genera el código para la pantalla de [nombre] del diseño"

4. **Design tokens:** Copiar las variables CSS de arriba a tu proyecto
   - Para Vue/React: crear `src/styles/tokens.css`
   - Para Tailwind: extender la config con estos valores
```

### 4. Captura por Pantalla para Documentación

Para cada pantalla completada, usar `get_screenshot` para generar una imagen de referencia.
Listar las rutas o incluir en el doc spec como referencia visual.

### 5. Reporte al Usuario

```
✅ Especificación de entrega generada.

Documento: {planning_artifacts}/pencil-design/pencil-design-spec.md

Incluye:
- Design tokens como variables CSS listas para copiar
- Tabla de pantallas con referencias a frames en Pencil
- Instrucciones para el equipo de desarrollo

[C] Finalizar workflow
```

## SIGUIENTE STEP:

Tras [C], cargar `{project-root}/_bmad/bmm/workflows/2-plan-workflows/create-pencil-design/steps/step-06-complete.md`

## MÉTRICAS DE ÉXITO:

✅ `get_variables` ejecutado para extraer tokens reales del .pen
✅ Screenshot final del canvas capturado
✅ Documento de handoff con tokens CSS, tabla de pantallas e instrucciones
✅ `stepsCompleted: [1, 2, 3, 4, 5]` en frontmatter

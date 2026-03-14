# Step 6: Diseño Final Completado

## TAREA:

Actualizar frontmatter, capturar vista final del canvas y presentar resumen al usuario.

## SECUENCIA:

### 1. Actualizar Frontmatter Final

```yaml
stepsCompleted: [1, 2, 3, 4, 5, 6]
status: "completed"
completedAt: "{date}"
```

### 2. Captura Final

Llamar a `get_screenshot` sobre el canvas completo del archivo `.pen` de diseño.

### 3. Resumen Final

```
🎨 ¡Diseño final completado para {project_name}!

**Canvas de Pencil:** {default_pen_file}
[screenshot del canvas completo]

**Lo que se creó:**
✅ {N} pantallas diseñadas en alta fidelidad con {selectedKit}
✅ Design tokens seteados via set_variables ($color.*, $radius.*, etc.)
✅ Documento de design handoff con variables CSS listas para usar
✅ Referencia directa a frames en Pencil por pantalla

**Archivos:**
- 🖊️ {default_pen_file} ← abrí en Pencil para inspeccionar
- 📋 {planning_artifacts}/pencil-design/pencil-design-spec.md ← handoff doc

**Próximos pasos:**
1. 🖊️ Abrir el .pen en Pencil para revisión final y ajustes manuales
2. 💻 Con Pencil + Claude Code activo, pedirle a Claude:
   "Genera el componente Vue para la pantalla de [nombre]"
   Claude usará el MCP de Pencil para leer el diseño y generar código
3. 🎨 Copiar los design tokens CSS al proyecto en `src/styles/tokens.css`
4. 👥 Compartir el .pen con el equipo para revisión

[DA] Volver al menú del agente UX
```

## MÉTRICAS DE ÉXITO:

✅ Frontmatter con status completado
✅ Screenshot final capturado con `get_screenshot`
✅ Próximos pasos incluyen el flujo Pencil → Claude Code → código

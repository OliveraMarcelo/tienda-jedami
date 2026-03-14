# Step 1: Inicialización — Wireframes en Pencil.dev

## REGLAS OBLIGATORIAS (LEER PRIMERO):

- 🛑 VERIFICAR conexión MCP con Pencil ANTES de cualquier otra acción
- 📖 Leer el step completo antes de actuar
- ✅ SIEMPRE comunicarse en `{communication_language}`
- 🎨 El output son frames en el canvas de Pencil — NO archivos HTML

## TU TAREA:

Verificar que Pencil está corriendo y conectado via MCP, cargar los documentos UX del proyecto, y preparar el archivo `.pen` para recibir los wireframes.

## SECUENCIA:

### 1. Verificar Conexión Pencil MCP

Llamar a la herramienta MCP `get_editor_state` para verificar que Pencil está corriendo.

**Si Pencil NO está disponible:**
```
🚨 Pencil no detectado. Para continuar:

1. Instalar Pencil.dev:
   - App de escritorio: https://pencil.dev
   - Extensión VS Code/Cursor: buscar "Pencil" en el marketplace

2. Abrir Pencil y crear/abrir un archivo .pen:
   - Nuevo archivo: {project_name}-wireframes.pen en la raíz del proyecto

3. Una vez abierto, el MCP server se inicia automáticamente.

4. Ejecutar [CW] de nuevo para continuar.
```
Detener el workflow hasta que el usuario confirme que Pencil está listo.

**Si Pencil está disponible:**
Confirmar al usuario: "✅ Pencil conectado via MCP. Canvas activo."

### 2. Verificar/Crear Archivo .pen

Verificar si existe `{default_pen_file}` en el repositorio.

**Si no existe:**
- Informar al usuario que se creará `{project_name}-wireframes.pen`
- Usar `batch_design` para inicializar el documento con una página llamada "Wireframes — {project_name}"

**Si existe:**
- Usar `batch_get` para listar los frames existentes
- Informar al usuario qué wireframes ya hay y preguntar si continuar o reiniciar

### 3. Descubrir Documentos UX de Contexto

Buscar en estas ubicaciones:
- `{planning_artifacts}/**`
- `{output_folder}/**`
- `{project_knowledge}/**`
- `docs/**`

Documentos a buscar (también buscar como carpeta sharded: `*nombre*/index.md`):
- Especificación UX (`*ux-design-specification*.md`)
- PRD (`*prd*.md`)
- Epics/Stories (`*epics*.md`, `*stories*.md`)
- Product Brief (`*brief*.md`)
- Contexto del proyecto (`**/project-context.md`)

<critical>Confirmar con el usuario los documentos encontrados antes de proceder a cargarlos.</critical>

**Reglas de carga:**
- Cargar todos los archivos confirmados completamente
- Para carpetas sharded, usar index.md como guía
- Registrar en frontmatter `inputDocuments`

### 4. Crear Documento Spec

- Copiar template desde `{installed_path}/wireframes-template.md`
- Guardar en `{planning_artifacts}/wireframes/wireframes-spec.md`
- Inicializar frontmatter

### 5. Reporte al Usuario

```
✅ Todo listo para wireframear {project_name}!

**Pencil MCP:** Conectado — canvas activo
**Archivo .pen:** {default_pen_file}
**Documentos cargados:** {lista}

Los wireframes de baja fidelidad se crearán directamente en tu canvas de Pencil.
Vas a ver los frames aparecer en tiempo real mientras trabajamos.

[C] Continuar — mapear flujos de usuario
```

## SIGUIENTE STEP:

Tras [C], cargar `{project-root}/_bmad/bmm/workflows/2-plan-workflows/create-wireframes/steps/step-02-user-flows.md`

## MÉTRICAS DE ÉXITO:

✅ MCP de Pencil verificado con `get_editor_state`
✅ Archivo .pen creado o verificado
✅ Documentos UX cargados y confirmados por usuario
✅ Doc spec inicializado
✅ `stepsCompleted: [1]` en frontmatter

## MODOS DE FALLO:

❌ Continuar sin verificar MCP de Pencil
❌ No informar al usuario si Pencil no está disponible
❌ No confirmar documentos antes de cargarlos

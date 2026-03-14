# Step 1: Inicialización — Diseño Final en Pencil.dev

## REGLAS OBLIGATORIAS (LEER PRIMERO):

- 🛑 VERIFICAR conexión MCP con Pencil ANTES de cualquier acción
- 📖 Leer el step completo antes de actuar
- ✅ SIEMPRE comunicarse en `{communication_language}`
- 🎨 El output son frames de alta fidelidad en el canvas de Pencil — NO archivos HTML

## TU TAREA:

Verificar que Pencil está corriendo, cargar todos los documentos de contexto (UX specs, wireframes, PRD) y preparar el archivo `.pen` para el diseño final.

## SECUENCIA:

### 1. Verificar Conexión Pencil MCP

Llamar a `get_editor_state` para verificar que Pencil está corriendo.

**Si Pencil NO está disponible:**
```
🚨 Pencil no detectado. Para continuar:

1. Instalar Pencil.dev: https://pencil.dev
   (App de escritorio para Mac/Linux/Windows, o extensión VS Code/Cursor)

2. Abrir Pencil y crear un archivo:
   {project_name}-design.pen en la raíz del proyecto

3. El MCP server se inicia automáticamente al abrir Pencil.

4. Ejecutar [CD] de nuevo para continuar.
```
Detener hasta que el usuario confirme.

**Si Pencil está disponible:**
"✅ Pencil conectado via MCP."

### 2. Verificar/Crear Archivo .pen

Verificar si existe `{default_pen_file}`.

**Si existe:** usar `batch_get` para listar frames existentes.
Informar al usuario y preguntar si continuar desde donde quedó o reiniciar.

**Si no existe:** crear nuevo documento inicializado via `batch_design`.

### 3. Descubrir Documentos de Contexto

Buscar en estas ubicaciones:
- `{planning_artifacts}/**`
- `{output_folder}/**`
- `{project_knowledge}/**`
- `docs/**`

Documentos a descubrir (también como carpeta sharded: `*nombre*/index.md`):
- Especificación UX (`*ux-design-specification*.md`) ← **más importante**
- Wireframes (`*wireframes-spec*.md` o carpeta `wireframes/`)
- Archivo .pen de wireframes (`*wireframes.pen`) ← si existe, usarlo como referencia
- PRD (`*prd*.md`)
- Product Brief (`*brief*.md`)
- Contexto del proyecto (`**/project-context.md`)

<critical>Confirmar con el usuario los documentos encontrados antes de cargarlos. Los wireframes existentes son especialmente valiosos como base de estructura.</critical>

### 4. Crear Documento Spec

- Copiar template desde `{installed_path}/pencil-design-template.md`
- Guardar en `{planning_artifacts}/pencil-design/pencil-design-spec.md`
- Inicializar frontmatter

### 5. Reporte al Usuario

```
✅ Todo listo para el diseño final de {project_name}!

**Pencil MCP:** Conectado
**Archivo .pen:** {default_pen_file}
**Documentos cargados:**
- Especificación UX: {encontrado/no encontrado}
- Wireframes: {encontrado/no encontrado}
- PRD: {encontrado/no encontrado}

{Si hay wireframes:}
💡 Tenés wireframes previos — los usaré como base de estructura
   para el diseño final. Excelente punto de partida.

[C] Continuar — elegir UI kit
```

## SIGUIENTE STEP:

Tras [C], cargar `{project-root}/_bmad/bmm/workflows/2-plan-workflows/create-pencil-design/steps/step-02-kit-selection.md`

## MÉTRICAS DE ÉXITO:

✅ MCP verificado con `get_editor_state`
✅ Archivo .pen creado o verificado
✅ Wireframes previos detectados (si existen)
✅ Documentos UX cargados y confirmados
✅ Doc spec inicializado
✅ `stepsCompleted: [1]` en frontmatter

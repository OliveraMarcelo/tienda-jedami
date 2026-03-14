---
name: create-wireframes
description: 'Crea wireframes de baja fidelidad directamente en Pencil.dev via MCP para todas las pantallas del proyecto. Requiere Pencil corriendo con un archivo .pen abierto. Basado en los documentos UX existentes.'
---

# Workflow: Wireframes en Pencil.dev via MCP

**Meta:** Crear wireframes de baja fidelidad directamente en el canvas de Pencil.dev usando las herramientas MCP (`batch_design`, `get_screenshot`, etc.), basándose en los documentos UX del proyecto. El output es un archivo `.pen` versionado en el repositorio.

---

## PREREQUISITO CRÍTICO

Este workflow requiere:
1. **Pencil.dev instalado** — app de escritorio o extensión VS Code/Cursor
2. **Pencil corriendo** con un archivo `.pen` abierto
3. **MCP de Pencil activo** — el servidor MCP se inicia automáticamente al abrir Pencil
4. Claude Code puede verificar la conexión con `get_editor_state`

---

## ARQUITECTURA DEL WORKFLOW

- Micro-file architecture: cada step es auto-contenido
- Las herramientas MCP de Pencil son el mecanismo de output principal
- Estado del workflow rastreado en frontmatter del doc spec
- Los wireframes se construyen frame por frame en el canvas de Pencil

---

## INICIALIZACIÓN

### Carga de Configuración

Cargar config desde `{project-root}/_bmad/bmm/config.yaml` y resolver:

- `project_name`, `output_folder`, `planning_artifacts`, `user_name`
- `communication_language`, `document_output_language`, `user_skill_level`
- `date` como fecha/hora actual generada por el sistema

### Paths

- `installed_path` = `{project-root}/_bmad/bmm/workflows/2-plan-workflows/create-wireframes`
- `template_path` = `{installed_path}/wireframes-template.md`
- `default_spec_file` = `{planning_artifacts}/wireframes/wireframes-spec.md`
- `default_pen_file` = `{project-root}/{project_name}-wireframes.pen`

## EJECUCIÓN

- ✅ SIEMPRE comunicarse en `{communication_language}` con el estilo del agente UX
- Leer y seguir completamente: `{project-root}/_bmad/bmm/workflows/2-plan-workflows/create-wireframes/steps/step-01-init.md`

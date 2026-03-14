---
name: create-pencil-design
description: 'Genera el diseño visual final directamente en el canvas de Pencil.dev via MCP usando uno de sus UI kits (Shadcn UI, Halo, Lunaris, Nitro), basado en los documentos UX y wireframes existentes. Requiere Pencil corriendo.'
---

# Workflow: Diseño Final en Pencil.dev via MCP

**Meta:** Transformar las especificaciones UX y wireframes del proyecto en un diseño visual final de alta fidelidad, creado directamente en el canvas de Pencil.dev usando sus herramientas MCP (`batch_design`, `set_variables`, `get_screenshot`). El output es un archivo `.pen` versionado en el repositorio.

---

## PREREQUISITO CRÍTICO

Este workflow requiere:
1. **Pencil.dev instalado** — app de escritorio o extensión VS Code/Cursor
2. **Pencil corriendo** con un archivo `.pen` abierto
3. **MCP de Pencil activo** — se inicia automáticamente al abrir Pencil
4. Verificar conexión con `get_editor_state`

---

## ARQUITECTURA DEL WORKFLOW

- Micro-file architecture: cada step es auto-contenido
- Las herramientas MCP de Pencil son el mecanismo de output principal
- Variables/tokens de diseño se setean via `set_variables` MCP
- Los frames se construyen usando componentes del UI kit elegido
- Estado rastreado en frontmatter del doc spec

---

## INICIALIZACIÓN

### Carga de Configuración

Cargar config desde `{project-root}/_bmad/bmm/config.yaml` y resolver:

- `project_name`, `output_folder`, `planning_artifacts`, `user_name`
- `communication_language`, `document_output_language`, `user_skill_level`
- `date` como fecha/hora actual generada por el sistema

### Paths

- `installed_path` = `{project-root}/_bmad/bmm/workflows/2-plan-workflows/create-pencil-design`
- `template_path` = `{installed_path}/pencil-design-template.md`
- `default_spec_file` = `{planning_artifacts}/pencil-design/pencil-design-spec.md`
- `default_pen_file` = `{project-root}/{project_name}-design.pen`

## EJECUCIÓN

- ✅ SIEMPRE comunicarse en `{communication_language}` con el estilo del agente UX
- Leer y seguir completamente: `{project-root}/_bmad/bmm/workflows/2-plan-workflows/create-pencil-design/steps/step-01-init.md`

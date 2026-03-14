# Step 2: Mapeo de Flujos de Usuario

## REGLAS OBLIGATORIAS:

- 🗺️ Extraer flujos de los documentos cargados — no inventar
- ✅ Confirmar flujos con el usuario antes de continuar
- 📊 Cada flujo = secuencia ordenada de pantallas
- ✅ SIEMPRE comunicarse en `{communication_language}`

## TU TAREA:

Identificar y mapear los flujos principales del proyecto. Estos flujos definen qué wireframes crear y en qué orden aparecerán en el canvas de Pencil.

## SECUENCIA:

### 1. Extraer Flujos de los Documentos

Analizar docs cargados buscando:
- User Journeys en la especificación UX
- Happy paths en el PRD o stories
- Flujos mencionados en epics/stories
- Casos de uso documentados

### 2. Documentar Flujos en Texto

Para cada flujo, documentarlo así:

```
Flujo: [Nombre del Flujo]
─────────────────────────────────
[Pantalla inicial]
    ↓ [Acción]
[Pantalla 2]
    ↓ [Acción] (bifurcación si aplica)
[Pantalla 3A] (éxito) | [Pantalla 3B] (error)
    ↓
[Destino final]
─────────────────────────────────
```

### 3. Presentar y Confirmar

```
Identifiqué estos flujos en {project_name}:

**Flujo 1: [Nombre]**
[inicio] → [paso] → [fin]
Pantallas: {lista}

**Flujo 2: [Nombre]**
...

Total pantallas únicas: {N}

¿Falta algún flujo? ¿Querés agregar o quitar?

[A] Agregar flujo manualmente
[C] Confirmar y continuar
```

### 4. Registrar en Frontmatter y Doc Spec

Frontmatter:
```yaml
userFlows:
  - id: "flujo-login"
    name: "Login de usuario"
    screens: ["home", "login", "dashboard"]
  - id: "flujo-compra"
    name: "Proceso de compra"
    screens: ["catalogo", "detalle", "carrito", "checkout", "confirmacion"]
```

En el doc spec, sección "Flujos de Usuario":
```markdown
### Flujo 1: Login de usuario
[Home] → [Login] → [Dashboard]
```

### 5. Crear Sección en Canvas Pencil

Usar `batch_design` para crear una página o sección de "Índice de Flujos" en el canvas:
- Un frame por flujo con título
- Flechas textuales mostrando la secuencia
- Esto sirve como mapa de navegación del wireframe

## SIGUIENTE STEP:

Tras [C], cargar `{project-root}/_bmad/bmm/workflows/2-plan-workflows/create-wireframes/steps/step-03-screen-inventory.md`

## MÉTRICAS DE ÉXITO:

✅ Todos los flujos extraídos de los docs
✅ Confirmados por el usuario
✅ Frontmatter `userFlows` actualizado
✅ Sección de índice creada en Pencil canvas con `batch_design`
✅ `stepsCompleted: [1, 2]` en frontmatter

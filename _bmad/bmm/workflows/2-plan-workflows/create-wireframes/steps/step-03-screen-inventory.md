# Step 3: Inventario de Pantallas

## REGLAS OBLIGATORIAS:

- 📋 Consolidar lista única de pantallas (sin duplicados entre flujos)
- ✅ Confirmar con usuario antes de proceder
- ✅ SIEMPRE comunicarse en `{communication_language}`

## TU TAREA:

Consolidar la lista única de pantallas a wireframear, priorizadas por importancia en los flujos.

## SECUENCIA:

### 1. Consolidar Pantallas Únicas

De los flujos confirmados:
- Eliminar duplicados (misma pantalla en múltiples flujos)
- Clasificar por categoría (auth, core, contenido, formularios, etc.)
- Priorizar por frecuencia de aparición en flujos

### 2. Presentar Inventario

```
Pantallas únicas a wireframear en {project_name}:

**🔐 Autenticación:**
1. Login | 2. Registro | 3. Recuperar contraseña

**🏠 Núcleo:**
4. Home / Dashboard

**[Categoría según proyecto]:**
N. [pantalla] ...

Total: {N} pantallas

¿Agregar o quitar alguna?

Versión de los wireframes:
[D] Solo Desktop (1280px)
[M] Solo Mobile (390px)
[B] Ambos — Desktop + Mobile (recomendado si hay diseño responsive)
```

### 3. Registrar en Frontmatter

```yaml
wireframeVersion: "desktop" | "mobile" | "both"
screens:
  - id: "login"
    name: "Login"
    category: "autenticacion"
    priority: 1
    flows: ["flujo-login"]
    status: "pending"
    penFrameId: ""
```

### 4. Crear Frame de Índice en Pencil

Usar `batch_design` para crear en el canvas un frame "📋 Inventario" con:
- Grilla de cards, uno por pantalla
- Nombre, categoría y prioridad
- Estado inicial: ⏳ Pendiente

Esto será el índice visual navegable del wireframe.

## SIGUIENTE STEP:

Tras confirmación, cargar `{project-root}/_bmad/bmm/workflows/2-plan-workflows/create-wireframes/steps/step-04-wireframes.md`

## MÉTRICAS DE ÉXITO:

✅ Lista única sin duplicados confirmada
✅ Versiones definidas (desktop/mobile/ambas)
✅ Frontmatter `screens` actualizado con penFrameId vacío
✅ Frame de índice creado en Pencil
✅ `stepsCompleted: [1, 2, 3]` en frontmatter

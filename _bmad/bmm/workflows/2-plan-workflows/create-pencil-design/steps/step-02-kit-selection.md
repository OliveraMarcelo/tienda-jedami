# Step 2: Selección de UI Kit de Pencil

## REGLAS OBLIGATORIAS:

- 🎨 Presentar los kits nativos de Pencil con análisis contextualizado al proyecto
- 🛑 NO proceder hasta que el usuario elija y confirme
- ✅ SIEMPRE comunicarse en `{communication_language}`

## TU TAREA:

Ayudar al usuario a elegir el UI kit de Pencil más adecuado para su proyecto, y configurar los design tokens base via `set_variables`.

## SECUENCIA:

### 1. Analizar el Proyecto

Antes de presentar opciones, analizar los documentos cargados para identificar:
- Tipo de proyecto (e-commerce, dashboard, app, landing)
- Plataforma principal (web, mobile, ambas)
- Estilo visual mencionado en UX spec
- Preferencias tecnológicas del stack (React, Vue, etc.)

### 2. Presentar Opciones de UI Kit

```
Basándome en las especificaciones de {project_name}, aquí están los UI kits disponibles en Pencil:

**🥇 RECOMENDADO PARA ESTE PROYECTO: [kit según análisis]**
Razón: [por qué encaja con el proyecto específico]

---

📦 UI KITS NATIVOS DE PENCIL:

1. **Shadcn UI** — Moderno y minimalista
   - Componentes React altamente personalizables
   - Estética limpia, neutral, profesional
   - Ideal para: apps web modernas, dashboards, SaaS
   - Stack: React + Tailwind

2. **Halo** — Design system completo
   - Sistema visual moderno con fuerte identidad
   - Componentes ricos con estados y variantes
   - Ideal para: productos con marca propia, apps de alta calidad

3. **Lunaris** — Elegante y sofisticado
   - Estética refinada, dark-mode friendly
   - Tipografía y espaciado premium
   - Ideal para: productos premium, herramientas creativas

4. **Nitro** — Energético y dinámico
   - Diseño con personalidad fuerte
   - Colores vibrantes, formas más expresivas
   - Ideal para: startups, productos consumer, e-commerce

¿Cuál elegís?
```

### 3. Confirmar Elección y Definir Design Tokens

Una vez elegido el kit, definir los tokens de diseño del proyecto:

**Extraer de los documentos UX si están definidos, si no, proponer:**

```
Perfecto, usaremos {kit}. Vamos a definir los colores del proyecto.

Extraje de tus docs UX:
- Color primario: {extraído o "no definido"}
- Color secundario: {extraído o "no definido"}
- Tipografía: {extraída o "no definida"}

¿Confirmás estos valores o los ajustamos?
(Si no hay definición en docs, propongo basándome en {project_name} y {kit}:)

| Token | Valor sugerido |
|-------|----------------|
| color.primary | #[sugerir] |
| color.secondary | #[sugerir] |
| color.accent | #[sugerir] |
| color.background | #[sugerir] |
| color.surface | #[sugerir] |
| color.text | #[sugerir] |
| color.text-secondary | #[sugerir] |
| color.error | #EF4444 |
| color.success | #22C55E |
| radius.base | 8px |
| radius.lg | 12px |
| spacing.base | 16px |
```

### 4. Setear Variables en Pencil via MCP

Usar `set_variables` para cargar los tokens en el documento `.pen`:

```json
{
  "variables": {
    "color.primary": { "type": "color", "value": "#hex" },
    "color.secondary": { "type": "color", "value": "#hex" },
    "color.accent": { "type": "color", "value": "#hex" },
    "color.background": { "type": "color", "value": "#hex" },
    "color.surface": { "type": "color", "value": "#hex" },
    "color.text": { "type": "color", "value": "#hex" },
    "color.text-secondary": { "type": "color", "value": "#hex" },
    "color.error": { "type": "color", "value": "#EF4444" },
    "color.success": { "type": "color", "value": "#22C55E" }
  }
}
```

### 5. Registrar en Frontmatter y Doc Spec

Frontmatter:
```yaml
selectedKit: "shadcn-ui"
designTokens:
  primary: "#hex"
  secondary: "#hex"
  ...
```

Doc spec sección "Tokens de Diseño":
```markdown
## Tokens de Diseño

**UI Kit:** {selectedKit}

| Token | Valor |
|-------|-------|
| color.primary | #hex |
...
```

### 6. Reporte al Usuario

```
✅ UI Kit configurado: {kit}
✅ Design tokens cargados en Pencil via set_variables
✅ Colores disponibles como variables $color.primary, $color.secondary, etc.

Ahora vamos a inventariar las pantallas a diseñar.

[C] Continuar — inventario de pantallas
```

## SIGUIENTE STEP:

Tras [C], cargar `{project-root}/_bmad/bmm/workflows/2-plan-workflows/create-pencil-design/steps/step-03-screen-inventory.md`

## MÉTRICAS DE ÉXITO:

✅ Kit elegido con recomendación contextualizada
✅ Design tokens definidos y confirmados por usuario
✅ `set_variables` ejecutado exitosamente en Pencil
✅ Frontmatter y doc spec actualizados
✅ `stepsCompleted: [1, 2]` en frontmatter

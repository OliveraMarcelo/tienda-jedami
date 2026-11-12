# IA en Jedami: generador de descripciones de productos

En **Admin → Productos → Editar**, debajo de "Descripción", aparece el botón **✨ Generar con IA**.
Con el nombre, la categoría, los talles y los colores del producto (más los "datos extra" que escribas,
como la tela), el modelo propone título, descripción y puntos destacados. Vos elegís **Usar**,
**Regenerar** o **Descartar**, y siempre podés editar el texto antes de guardar.

Cada propuesta queda guardada en la tabla `ai_generations` junto con lo que hiciste con ella
(aceptada, editada o descartada). Ese historial es el material para mejorar el modelo.

## Cómo funciona

```
Admin (web) ──► API de Jedami ──► AI_BASE_URL/chat/completions ──► modelo
                     │
                     └─► ai_generations (historial para mejorar el modelo)
```

La API habla el formato de OpenAI (`/chat/completions`), que también entienden Ollama, OpenAI,
Gemini (modo compatible) y otros. **El código es el mismo en desarrollo y en producción**:
solo cambian las variables de entorno.

| Variable | Para qué | Ejemplo |
|---|---|---|
| `AI_BASE_URL` | Dónde está el modelo. **Vacía = IA apagada** (el botón no aparece) | `http://localhost:11434/v1` |
| `AI_MODEL` | Nombre del modelo | `jedami-descripciones` |
| `AI_API_KEY` | Solo para APIs pagas | `sk-...` |
| `AI_TIMEOUT_MS` | Espera máxima (un modelo local sin placa de video es lento) | `90000` |
| `AI_RATE_LIMIT_MAX` | Generaciones por IP cada 15 minutos | `60` |

## Desarrollo (tu compu)

1. Ollama tiene que estar corriendo: `systemctl --user status ollama`.
2. Crear el modelo con el estilo de Jedami (desde la raíz del repo):
   ```bash
   ollama create jedami-descripciones -f ai/Modelfile.jedami-descripciones
   ```
3. En `jedami-bff/.env`:
   ```
   AI_BASE_URL=http://localhost:11434/v1
   AI_MODEL=jedami-descripciones
   ```
4. Reiniciar la API (`npm run dev`) y abrir Admin → Productos → Editar.

Medido en la compu de desarrollo (8 núcleos, Intel Iris Xe, solo CPU) con `qwen3:4b`:
**entre 15 y 30 segundos** por descripción, usando unos 3 GB de RAM.

**Ojo con los modelos que "piensan"** (qwen3, deepseek-r1, gpt-oss): pensando antes de responder,
en CPU tardan varios minutos. La API manda `reasoning_effort: "none"` por defecto cuando el modelo es
local (se cambia con `AI_REASONING_EFFORT`), y el Modelfile termina con `/no_think`.

Las reglas de la API van dentro del mensaje del usuario y no como mensaje "system": en Ollama, un
system en el pedido reemplaza el SYSTEM del Modelfile y se perderían el tono y los ejemplos.

## Producción

Hay dos caminos. En los dos solo se cambian variables en `/opt/jedami/.env.prod`.

### A. El modelo de tu compu, por Tailscale (gratis)

Tailscale arma una red privada entre tu compu y el servidor. El puerto de Ollama **nunca** queda
abierto a internet: solo lo ve el servidor de Jedami.

> ⚠️ Nunca abras el puerto 11434 en el router ni pongas Ollama con `OLLAMA_HOST=0.0.0.0` en una red
> pública: cualquiera podría usar tu compu.

1. Creá una cuenta gratis en [tailscale.com](https://tailscale.com).
2. En **tu compu**:
   ```bash
   curl -fsSL https://tailscale.com/install.sh | sh
   sudo tailscale up
   # Comparte Ollama (que sigue escuchando solo en localhost) únicamente dentro de tu red Tailscale
   sudo tailscale serve --bg --tcp 11434 tcp://localhost:11434
   tailscale ip -4        # anotá la IP, empieza con 100.
   ```
3. En **el servidor** (droplet):
   ```bash
   curl -fsSL https://tailscale.com/install.sh | sh
   sudo tailscale up
   curl http://100.x.y.z:11434/api/tags     # tiene que listar tus modelos
   ```
4. Recomendado: en el panel de Tailscale → **Access controls**, permití que el servidor llegue solo
   al puerto 11434 de tu compu (y nada más).
5. En `/opt/jedami/.env.prod`:
   ```
   AI_BASE_URL=http://100.x.y.z:11434/v1
   AI_MODEL=jedami-descripciones
   AI_TIMEOUT_MS=90000
   ```
6. Recrear la API:
   ```bash
   cd /opt/jedami && docker compose -f docker-compose.prod.yml --env-file .env.prod up -d jedami-bff
   ```

Limitaciones: funciona **solo con tu compu prendida**. Si está apagada, el botón responde
"No se pudo conectar con el modelo de IA" y el resto del admin sigue normal. Sirve para funciones del
admin (las usás vos); para algo que usen los clientes conviene la opción B.

Cloudflare Tunnel también sirve para exponer Ollama, pero hay que protegerlo con Cloudflare Access,
que pide encabezados propios (`CF-Access-Client-Id` / `CF-Access-Client-Secret`) que hoy la API no
envía. Por eso la recomendada es Tailscale.

### B. Una API paga (rápida y siempre disponible)

```
AI_BASE_URL=https://api.openai.com/v1      # u otro proveedor compatible
AI_MODEL=<modelo del proveedor>
AI_API_KEY=<tu clave>
AI_ALLOW_EXTERNAL_PROVIDER=true            # obligatorio para un proveedor externo
AI_TIMEOUT_MS=30000
```
El Modelfile no aplica acá (el tono lo da el prompt de la API). Una descripción cuesta una fracción
de centavo de dólar.

## Seguridad: que no se filtren datos

**Regla de oro: a la IA solo le llegan datos públicos del catálogo.** Nunca datos de clientes,
pedidos, pagos, usuarios ni configuración.

Lo que ya hace el código:

| Protección | Qué evita |
|---|---|
| Solo el admin puede usar la IA (`/admin/ai/*`) | Que un cliente o un bot use tu modelo |
| El modelo recibe solo nombre, categoría, talles, colores y notas del producto | Que viajen datos de clientes o pedidos |
| Las notas pasan por un filtro que reemplaza emails, teléfonos, DNI/CUIT, tarjetas, CBU y links por `[dato omitido]` | Que se cuele un dato personal pegado por error |
| Por defecto solo se aceptan modelos locales o en red privada (localhost, LAN, Tailscale `100.x`, `*.ts.net`) | Mandar datos a un servidor externo sin darte cuenta |
| Un proveedor externo exige `AI_ALLOW_EXTERNAL_PROVIDER=true` y `https` | Que alguien cambie la URL y los datos salgan sin cifrar |
| No se loguea el texto enviado ni la respuesta de error del proveedor | Que los datos queden en los logs |
| La respuesta del modelo se muestra como texto, nunca como HTML | Que el modelo "inyecte" código en el admin |
| Límite de generaciones por IP (`AI_RATE_LIMIT_MAX`) | Abuso o costos inesperados con una API paga |

Si el proveedor no está permitido, la API lo avisa en el log al arrancar
(`[AI] Proveedor de IA bloqueado`) y el botón de IA no aparece.

Lo que tenés que cuidar vos:

1. **Ollama en tu compu:** que siga escuchando solo en `127.0.0.1` (es lo que viene por defecto).
   Nunca pongas `OLLAMA_HOST=0.0.0.0` ni abras el puerto 11434 en el router.
2. **Tailscale:** compartí el puerto con `tailscale serve` (solo lo ve tu tailnet) y en las ACL de
   Tailscale permití que **solo el servidor** llegue a tu compu en el puerto 11434.
3. **API paga:** usá una clave solo para Jedami, con límite de gasto mensual, y revisá que el
   proveedor no use tus datos para entrenar (OpenAI, Anthropic y Google no lo hacen por API por defecto).
   Guardala solo en `/opt/jedami/.env.prod`, nunca en el repo ni en el chat.
4. **Exportar el dataset** (`/admin/ai/generations/export`) solo contiene productos, pero tratalo
   como dato interno: no lo subas a repos públicos.
5. **Cuando haya RAG o un chat para clientes:** indexar solo productos visibles y textos públicos
   (preguntas frecuentes, envíos, cambios). El chat nunca tiene que poder consultar pedidos, pagos ni
   datos de otros clientes, y lo que escribe el cliente se trata como texto no confiable: el modelo
   no ejecuta acciones por su cuenta.

## Cómo mejorar el modelo (de menos a más trabajo)

### Nivel 1 — Modelfile (ya hecho)
`ai/Modelfile.jedami-descripciones` define el modelo base, la temperatura, el tono de la marca y
3 ejemplos (few-shot). Cada cambio se aplica con:
```bash
ollama create jedami-descripciones -f ai/Modelfile.jedami-descripciones
```
El modelo base es `qwen3:4b` (muy buen español). `qwen2.5-coder:1.5b` es más rápido pero está pensado
para código e inventa más datos. Para probar otro base, cambiá el `FROM` y volvé a correr `ollama create`.

Los ejemplos del Modelfile usan **productos inventados**: si un ejemplo tiene el nombre de un
producto real, el modelo copia esa respuesta (pasó con "Conjunto kiki" y una capucha que no tiene).
También ayuda **cargar datos extra** (tela, detalles) en el campo de la IA: con más datos reales,
inventa menos.

### Nivel 2 — Ejemplos de tu propia tienda (RAG)
Usar como ejemplos las descripciones que vos aceptaste o editaste de productos parecidos (misma
categoría) en lugar de los 3 fijos del Modelfile. El historial ya se guarda en `ai_generations`;
el siguiente paso es que la API los agregue al prompt.

### Nivel 3 — Fine-tuning (entrenar tu propio modelo)
Cuando tengas **100 o más** descripciones aceptadas o editadas:

1. Descargar el dataset (formato chat, una línea por ejemplo):
   ```bash
   curl -H "Authorization: Bearer <token de admin>" \
     https://jedamiapp.com/api/v1/admin/ai/generations/export -o jedami-descripciones.jsonl
   ```
   Si editaste el texto, el ejemplo usa **tu versión**, así el modelo aprende de tus correcciones.
2. Entrenar gratis en Google Colab con [Unsloth](https://github.com/unslothai/unsloth) (tiene
   notebooks listos para Qwen): cargar `jedami-descripciones.jsonl`, entrenar un LoRA sobre
   `Qwen2.5-1.5B-Instruct` o `Qwen3-4B` y exportar a GGUF (`model.save_pretrained_gguf(..., quantization_method="q4_k_m")`).
3. Bajar el `.gguf` a la carpeta `ai/` (no lo subas a git, pesa varios GB), cambiar en el Modelfile
   `FROM ./jedami-descripciones.gguf` y correr `ollama create`.

## Endpoints (solo admin)

| Método | Ruta | Qué hace |
|---|---|---|
| GET | `/api/v1/admin/ai/status` | `{ enabled, model }` |
| POST | `/api/v1/admin/ai/product-description` | Genera `{ generationId, title, description, highlights }` |
| PATCH | `/api/v1/admin/ai/generations/:id` | Registra `accepted` / `edited` / `discarded` y el texto final |
| GET | `/api/v1/admin/ai/generations/export` | Dataset JSONL para fine-tuning |

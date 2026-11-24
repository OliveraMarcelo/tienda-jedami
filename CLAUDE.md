# Jedami: cómo ubicar código (graphify + mapa de la API)

El repo tiene un grafo del código hecho con graphify (`graphify-out/graph.json`, no se commitea), con las
conexiones front ↔ back agregadas por `scripts/mapa-api.mjs`. Se arma con `make mapa` (segundos, sin gastar tokens).
Si `graphify-out/` no existe o el código cambió mucho, corré `make mapa` antes de consultar.

## Para ubicar código, primero el grafo

Antes de recorrer archivos con grep o leerlos enteros, preguntale al grafo (MCP `graphify` o el CLI):

| Para saber… | Usá |
|---|---|
| Qué es una función y quién la llama / a quién llama | `graphify explain "nombre()"` |
| Qué se rompe si cambio algo (impacto) | `graphify affected "nombre()"` |
| Cómo llega una pantalla hasta la base (o dos piezas se conectan) | `graphify path "A" "B"` |
| Qué endpoint usa una función del front, y al revés | relación `http_calls` en el grafo, o `graphify-out/mapa-api.json` |

Si el grafo no encuentra algo (o la pregunta es de "cómo funciona" en general), recién ahí buscá a mano.
El grafo no entiende preguntas en lenguaje natural: preguntale por nombres de funciones, archivos o rutas.

## En los workflows de BMAD

Sin tocar BMAD (`_bmad/` queda como está):
- **create-story**: agregá a la historia una sección **"Código que toca"** con las funciones y archivos (con línea)
  que salen de `explain` / `affected`, y el recorrido de punta a punta si la historia cruza front y back.
- **dev-story**: antes de editar una función, `affected` sobre ella. Al terminar, `make mapa-check`.
- **code-review**: además de los archivos de la historia, revisá quién llama a lo que cambió (`affected`)
  y corré `make mapa-check`: una llamada rota del front a un endpoint que no existe es un hallazgo HIGH.
- **quick-spec / correct-course / create-architecture**: para mapear el código, el grafo primero.

## Front ↔ back

`make mapa-check` valida que cada llamada de la web (axios) y de la app (Dio) tenga su endpoint en Express:
❌ rota = el endpoint no existe (falla el check), ⚠ sin uso = endpoint que nadie llama.
`graphify-out/mapa-api.html` muestra el recorrido de cada endpoint: pantalla → store → función de la API →
endpoint → controller → servicio → repositorio → tabla.

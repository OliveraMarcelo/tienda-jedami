#!/usr/bin/env node
// Mapa de la API de punta a punta: une cada llamada del front (web y app) con su endpoint del backend
// y sigue la cadena completa: pantalla → store → función de la API → endpoint → controller → servicio →
// repositorio → consulta SQL → tabla.
//
//   node scripts/mapa-api.mjs            valida y escribe graphify-out/mapa-api.{json,html}
//   node scripts/mapa-api.mjs --check    solo valida (sale con error si hay llamadas rotas): sirve para CI
//
// Valida:
//   ❌ rota      una llamada del front a un endpoint que el backend no tiene (método o ruta)
//   ⚠  sin uso   un endpoint que ni la web ni la app llaman (puede ser código muerto)
//   ?  dinámica  una llamada cuya URL no se puede leer del código (armada con variables)
//
// Si existe graphify-out/graph.json (lo arma `graphify update .`), le agrega las conexiones HTTP
// (relación "http_calls") para que Claude pueda seguir la cadena entera con graphify, y usa el grafo para
// completar la cadena hacia arriba (pantallas) y hacia abajo (servicio, repositorio, tablas).
// No usa dependencias: solo lee el código.
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { join, relative, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BFF = join(RAIZ, 'jedami-bff/src');
const WEB = join(RAIZ, 'jedami-web/src');
const APP = join(RAIZ, 'jedami-mobile/lib');
const OUT = join(RAIZ, 'graphify-out');
const PREFIJO = '/api/v1';
const SOLO_CHECK = process.argv.includes('--check');

// Endpoints que no llama el front a propósito: los llaman servicios de afuera o sirven para monitoreo
const USO_EXTERNO = [/\/webhook/i, /^\/api\/v1\/health$/, /\/point\/notifications/i];

const rel = (f) => relative(RAIZ, f);
const leer = (f) => readFileSync(f, 'utf8');
const lineaDe = (texto, i) => texto.slice(0, i).split('\n').length;
function archivos(dir, ext) {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const n of readdirSync(dir)) {
    if (n === 'node_modules' || n.startsWith('.') || n === '__tests__' || n === 'generated') continue;
    const p = join(dir, n);
    if (statSync(p).isDirectory()) out.push(...archivos(p, ext));
    else if (ext.some((e) => n.endsWith(e)) && !/\.(test|spec)\./.test(n)) out.push(p);
  }
  return out;
}
// Desde la posición del "(" devuelve el texto de adentro, respetando paréntesis, strings y template literals
function argumentos(texto, abre) {
  let prof = 0, q = null;
  for (let i = abre; i < texto.length; i++) {
    const c = texto[i];
    if (q) { if (c === '\\') i++; else if (c === q) q = null; continue; }
    if (c === '"' || c === "'" || c === '`') q = c;
    else if (c === '(' || c === '[' || c === '{') prof++;
    else if (c === ')' || c === ']' || c === '}') { prof--; if (prof === 0) return texto.slice(abre + 1, i); }
  }
  return '';
}
// Parte los argumentos por comas de primer nivel
function partir(args) {
  const out = [];
  let prof = 0, q = null, cur = '';
  for (let i = 0; i < args.length; i++) {
    const c = args[i];
    cur += c;
    if (q) { if (c === '\\') { cur += args[++i] ?? ''; } else if (c === q) q = null; continue; }
    if (c === '"' || c === "'" || c === '`') q = c;
    else if ('([{'.includes(c)) prof++;
    else if (')]}'.includes(c)) prof--;
    else if (c === ',' && prof === 0) { out.push(cur.slice(0, -1).trim()); cur = ''; }
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}
const unir = (...p) => ('/' + p.join('/')).replace(/\/+/g, '/').replace(/(.)\/$/, '$1');
// Una ruta con sus parámetros normalizados: /orders/:orderId/items y /orders/${id}/items → /orders/:/items
const forma = (ruta) => ruta.split('?')[0].replace(/\/+$/, '').split('/').map((s) => (s.startsWith(':') || /\$\{?/.test(s) ? ':' : s)).join('/');

// ── Backend: rutas de Express, siguiendo los router.use(...) anidados ──
function rutasBackend() {
  const rutas = [];
  const visitar = (archivo, prefijo, pila = []) => {
    if (pila.includes(archivo) || !existsSync(archivo)) return;
    const t = leer(archivo);
    const importados = {}; // nombre → archivo (routers y handlers)
    for (const m of t.matchAll(/import\s+(?:(\w+)|\{([^}]+)\})\s+from\s+['"](\.[^'"]+)['"]/g)) {
      const f = resolve(dirname(archivo), m[3]).replace(/\.js$/, '.ts');
      if (m[1]) importados[m[1]] = f;
      else for (const n of m[2].split(',')) { const k = n.trim().split(/\s+as\s+/).pop(); if (k) importados[k] = f; }
    }
    for (const m of t.matchAll(/\brouter\.(get|post|put|patch|delete|use)\s*\(/g)) {
      const args = partir(argumentos(t, m.index + m[0].length - 1));
      const ruta = /^['"`]/.test(args[0] || '') ? args[0].slice(1, -1) : null;
      if (m[1] === 'use') {
        const hijo = importados[args[args.length - 1]];
        if (ruta && hijo && /routes/.test(hijo)) visitar(hijo, unir(prefijo, ruta), [...pila, archivo]);
        continue;
      }
      if (ruta === null) continue;
      const ultimo = args[args.length - 1] || '';
      const handler = /^\w+$/.test(ultimo) ? ultimo : null;
      rutas.push({
        metodo: m[1].toUpperCase(), ruta: unir(prefijo, ruta), forma: forma(unir(prefijo, ruta)),
        handler: handler || '(función en la ruta)', handlerArchivo: handler && importados[handler] ? rel(importados[handler]) : rel(archivo),
        archivo: rel(archivo), linea: lineaDe(t, m.index), protegida: /authMiddleware|requireRole/.test(args.join(',')) || /\/admin|\/pos/.test(prefijo),
      });
    }
  };
  visitar(join(BFF, 'routes/index.ts'), PREFIJO);
  return rutas;
}

// ── Front: llamadas a la API desde la web (axios) y la app (Dio) ──
function nombreFuncion(texto, i, dart) {
  const antes = texto.slice(0, i);
  const re = dart
    ? /(?:Future<[^>]*>|void|[\w<>?]+)\s+(\w+)\s*\([^)]*\)\s*(?:async\s*)?\{/g
    : /(?:export\s+)?(?:async\s+)?function\s+(\w+)|(\w+)\s*[:=]\s*(?:async\s*)?(?:\([^)]*\)|\w+)\s*=>|(?:async\s+)(\w+)\s*\(/g;
  let n = null;
  for (const m of antes.matchAll(re)) n = m[1] || m[2] || m[3];
  return n;
}
function llamadasFront() {
  const out = [];
  const fuentes = [
    ...archivos(WEB, ['.ts', '.vue']).map((f) => ({ f, cliente: 'web', re: /\b(?:apiClient|api|client|http)\.(get|post|put|patch|delete)\s*(?:<(?:[^<>]|<[^<>]*>)*>)?\s*\(/g })),
    ...archivos(APP, ['.dart']).map((f) => ({ f, cliente: 'app', re: /\b_?(?:dio|client|api)\.(get|post|put|patch|delete)\s*(?:<[^(]*>)?\s*\(/g })),
  ];
  for (const { f, cliente, re } of fuentes) {
    const t = leer(f);
    for (const m of t.matchAll(re)) {
      const args = partir(argumentos(t, m.index + m[0].length - 1));
      const a0 = args[0] || '';
      const literal = /^['"`]/.test(a0) && a0[0] === a0[a0.length - 1];
      let ruta = literal ? a0.slice(1, -1) : null;
      if (ruta && cliente === 'app') ruta = ruta.replace(/\$(\w+)/g, '${$1}');
      out.push({
        cliente, metodo: m[1].toUpperCase(), ruta: ruta ? unir(PREFIJO, ruta.split('?')[0]) : null, original: a0.slice(0, 80),
        forma: ruta ? forma(unir(PREFIJO, ruta)) : null, archivo: rel(f), linea: lineaDe(t, m.index),
        funcion: nombreFuncion(t, m.index, cliente === 'app'),
      });
    }
  }
  return out;
}

// Una llamada coincide con una ruta si tienen el mismo método y los mismos segmentos. Puntaje por segmento:
// igual = 3, parámetro de la ruta (/:id) = 2, variable del front contra una palabra fija de la ruta = 1 (último recurso).
// Así `/banners/${id}` va a /banners/:id y no a /banners/reorder, y `/products/sizes` va a /products/sizes y no a /products/:id.
function buscarRuta(ll, rutas) {
  const s = ll.forma.split('/');
  let mejor = null, max = -1;
  for (const r of rutas) {
    const t = r.forma.split('/');
    if (r.metodo !== ll.metodo || t.length !== s.length) continue;
    let p = 0;
    for (let i = 0; i < t.length && p >= 0; i++) p = t[i] === s[i] ? p + 3 : t[i] === ':' ? p + 2 : s[i] === ':' ? p + 1 : -1;
    if (p > max) { max = p; mejor = r; }
  }
  return mejor;
}

// ── El grafo de graphify: completar la cadena y agregarle las conexiones HTTP ──
function conGrafo(rutas, llamadas) {
  const archivoGrafo = join(OUT, 'graph.json');
  if (!existsSync(archivoGrafo)) return null;
  const g = JSON.parse(leer(archivoGrafo));
  const porId = new Map(g.nodes.map((n) => [n.id, n]));
  const porNombre = new Map(); // "archivo|nombre()" → id
  for (const n of g.nodes) if (n.source_file) porNombre.set(`${n.source_file}|${n.label}`, n.id);
  const nodo = (archivo, nombre) => porNombre.get(`${archivo}|${nombre}()`) || porNombre.get(`${archivo}|${nombre}`);
  const salen = new Map(), entran = new Map();
  for (const e of g.links) {
    if (e.relation === 'http_calls') continue;
    (salen.get(e.source) || salen.set(e.source, []).get(e.source)).push(e);
    (entran.get(e.target) || entran.set(e.target, []).get(e.target)).push(e);
  }
  const archivoDe = (id) => porId.get(id)?.source_file || '';
  const etiqueta = (id) => ({ id, nombre: porId.get(id)?.label || id, archivo: archivoDe(id), linea: porId.get(id)?.source_location || '' });

  // Hacia abajo: lo que llama el handler dentro del backend (servicio, repositorio), y las tablas que tocan sus consultas
  const tablasDeConsulta = new Map();
  const sqlTablas = (sql) => [...new Set([...sql.matchAll(/\b(?:FROM|JOIN|INTO|UPDATE)\s+([a-z_][a-z0-9_]*)/gi)].map((m) => m[1].toLowerCase()))]
    .filter((t) => !['select', 'lateral', 'unnest', 'jsonb_array_elements', 'generate_series'].includes(t));
  function tablasDe(funcId) {
    // Las constantes SQL que usa esta función (se importan de queries/*.ts), leídas en su propio código
    const n = porId.get(funcId);
    if (!n?.source_file || !existsSync(join(RAIZ, n.source_file))) return [];
    const t = leer(join(RAIZ, n.source_file)).split('\n');
    const desde = parseInt(String(n.source_location || 'L1').slice(1), 10) - 1;
    let hasta = t.findIndex((l, i) => i > desde && /^(export |\}|async function|function )/.test(l));
    if (hasta < 0) hasta = t.length;
    const cuerpo = t.slice(desde, hasta).join('\n');
    const out = new Set();
    // SQL escrito ahí mismo, en un template string
    for (const [, sql] of cuerpo.matchAll(/`([^`]*\b(?:SELECT|INSERT|UPDATE|DELETE)\b[^`]*)`/gi)) sqlTablas(sql).forEach((x) => out.add(x));
    for (const [, c] of cuerpo.matchAll(/\b([A-Z][A-Z0-9_]{2,})\b/g)) {
      if (!tablasDeConsulta.has(c)) {
        const def = [...porNombre.entries()].find(([k]) => k.endsWith(`|${c}`) && k.includes('/queries/'));
        let ts = [];
        if (def) {
          const src = leer(join(RAIZ, def[0].split('|')[0]));
          const m = src.match(new RegExp(`${c}\\s*=\\s*\`([\\s\\S]*?)\``));
          if (m) ts = sqlTablas(m[1]);
        }
        tablasDeConsulta.set(c, ts);
      }
      tablasDeConsulta.get(c).forEach((x) => out.add(x));
    }
    return [...out];
  }
  function abajo(inicio) {
    const pasos = [], tablas = new Set(), vistos = new Set([inicio]);
    let frente = [inicio];
    for (let prof = 0; prof < 4 && frente.length; prof++) {
      const sig = [];
      for (const id of frente) {
        tablasDe(id).forEach((x) => tablas.add(x));
        for (const e of salen.get(id) || []) {
          if (!['calls', 'indirect_call'].includes(e.relation) || vistos.has(e.target)) continue;
          const f = archivoDe(e.target);
          if (!/jedami-bff\/src\/(modules|lib|services)\//.test(f)) continue; // sin errores, tipos ni config
          vistos.add(e.target); sig.push(e.target);
          pasos.push({ ...etiqueta(e.target), desde: id, capa: /repository/.test(f) ? 'repositorio' : /service/.test(f) ? 'servicio' : 'otro' });
        }
      }
      frente = sig;
    }
    return { pasos, tablas: [...tablas].sort() };
  }

  // Hacia arriba: quién usa la función de la API (store o componente) y qué pantallas la usan
  function arriba(ll) {
    const fid = ll.funcion && nodo(ll.archivo, ll.funcion);
    if (!fid) return [];
    const usos = [];
    for (const e of entran.get(fid) || []) {
      if (!['calls', 'indirect_call', 'imports'].includes(e.relation)) continue;
      const f = archivoDe(e.source);
      if (f === ll.archivo) continue;
      if (f.endsWith('.vue') || f.endsWith('.dart')) { usos.push({ tipo: 'pantalla', archivo: f }); continue; }
      // un store: la acción que envuelve la llamada, y las pantallas que usan esa acción
      const src = existsSync(join(RAIZ, f)) ? leer(join(RAIZ, f)) : '';
      const i = src.search(new RegExp(`\\b${ll.funcion}\\s*\\(`));
      const accion = i >= 0 ? nombreFuncion(src, i, false) : null;
      const pantallas = new Set();
      for (const e2 of entran.get(e.source) || []) {
        const fv = archivoDe(e2.source);
        if (!fv.endsWith('.vue') || pantallas.has(fv)) continue;
        if (accion && existsSync(join(RAIZ, fv)) && !new RegExp(`\\b${accion}\\b`).test(leer(join(RAIZ, fv)))) continue;
        pantallas.add(fv);
      }
      usos.push({ tipo: 'store', archivo: f, accion, pantallas: [...pantallas].sort() });
    }
    // el grafo trae la misma relación dos veces (import y llamada)
    return usos.filter((u, i) => usos.findIndex((x) => x.archivo === u.archivo && x.accion === u.accion) === i);
  }

  // Las conexiones HTTP que le faltan al grafo (front → handler), marcadas como inferidas
  g.links = g.links.filter((e) => e.relation !== 'http_calls');
  let agregadas = 0;
  for (const ll of llamadas) {
    if (!ll.endpoint) continue;
    const r = rutas[ll.endpoint];
    const desde = ll.funcion && nodo(ll.archivo, ll.funcion);
    const hasta = nodo(r.handlerArchivo, r.handler);
    ll.arriba = arriba(ll);
    if (!desde || !hasta) continue;
    g.links.push({ source: desde, target: hasta, relation: 'http_calls', confidence: 'INFERRED', confidence_score: 0.95,
      context: `${r.metodo} ${r.ruta}`, source_file: ll.archivo, source_location: `L${ll.linea}`, weight: 1.0, _origin: 'mapa-api' });
    agregadas++;
  }
  for (const r of rutas) {
    const h = nodo(r.handlerArchivo, r.handler);
    r.abajo = h ? abajo(h) : { pasos: [], tablas: [] };
    r.handlerNodo = !!h;
  }
  if (!SOLO_CHECK) writeFileSync(archivoGrafo, JSON.stringify(g));
  return { agregadas };
}

// ── Armar todo ──
const rutas = rutasBackend();
const llamadas = llamadasFront();
for (const ll of llamadas) {
  if (!ll.forma) { ll.estado = 'dinamica'; continue; }
  const r = buscarRuta(ll, rutas);
  if (r) { ll.endpoint = rutas.indexOf(r); ll.estado = 'ok'; (r.usos ||= []).push(llamadas.indexOf(ll)); }
  else ll.estado = 'rota';
}
for (const r of rutas) r.estado = r.usos?.length ? 'ok' : USO_EXTERNO.some((re) => re.test(r.ruta)) ? 'externo' : 'sin-uso';
// ¿El grafo de graphify está al día? Archivos de código modificados después de armarlo.
const FUENTES = ['jedami-bff/src', 'jedami-web/src', 'jedami-mobile/lib'];
function masNuevosQueElGrafo() {
  const g = join(OUT, 'graph.json');
  if (!existsSync(g)) return null;
  const t = statSync(g).mtimeMs, nuevos = [];
  const andar = (d) => { for (const n of readdirSync(d)) { const f = join(d, n), st = statSync(f); if (st.isDirectory()) { if (n !== 'node_modules') andar(f); } else if (/\.(ts|vue|dart|sql)$/.test(n) && st.mtimeMs > t) nuevos.push(rel(f)); } };
  for (const d of FUENTES) if (existsSync(join(RAIZ, d))) andar(join(RAIZ, d));
  return nuevos;
}
const git = (c) => { try { return execSync(`git ${c}`, { cwd: RAIZ, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch { return ''; } };
const viejos = masNuevosQueElGrafo();
const grafo = conGrafo(rutas, llamadas);

const rotas = llamadas.filter((l) => l.estado === 'rota');
const dinamicas = llamadas.filter((l) => l.estado === 'dinamica');
const sinUso = rutas.filter((r) => r.estado === 'sin-uso');
const resumen = {
  endpoints: rutas.length, conectados: rutas.filter((r) => r.estado === 'ok').length, externos: rutas.filter((r) => r.estado === 'externo').length,
  sinUso: sinUso.length, llamadas: llamadas.length, web: llamadas.filter((l) => l.cliente === 'web').length, app: llamadas.filter((l) => l.cliente === 'app').length,
  rotas: rotas.length, dinamicas: dinamicas.length, conexionesGrafo: grafo?.agregadas ?? null, fecha: new Date().toISOString(),
  commit: git('rev-parse --short HEAD'), rama: git('branch --show-current'),
  sinCommitear: git(`status --porcelain -- ${FUENTES.join(' ')}`).split('\n').filter(Boolean).length,
};

const v = (s) => (process.stdout.isTTY ? s : s.replace(/\x1b\[\d+m/g, ''));
console.log(v(`\n\x1b[1mMapa de la API de Jedami\x1b[0m  ${resumen.endpoints} endpoints · ${resumen.llamadas} llamadas (web ${resumen.web}, app ${resumen.app})`));
console.log(v(`  \x1b[32m✅ ${resumen.conectados} endpoints conectados al front\x1b[0m${resumen.externos ? `  · ${resumen.externos} de uso externo (webhooks, health)` : ''}`));
for (const l of rotas) console.log(v(`  \x1b[31m❌ rota\x1b[0m     ${l.metodo} ${l.ruta}  ← ${l.archivo}:${l.linea}${l.funcion ? ` (${l.funcion})` : ''}  no existe en el backend`));
for (const l of dinamicas) console.log(`  ?  dinámica ${l.metodo} ${l.original}  ← ${l.archivo}:${l.linea}  (la URL se arma con variables)`);
for (const r of sinUso) console.log(v(`  \x1b[33m⚠  sin uso\x1b[0m  ${r.metodo} ${r.ruta}  → ${r.handler} (${r.archivo}:${r.linea})`));
if (grafo) console.log(`  🔗 ${grafo.agregadas} conexiones HTTP agregadas al grafo de graphify (relación http_calls)`);
if (viejos?.length) console.log(v(`  \x1b[33m⏳ el grafo está desactualizado\x1b[0m: ${viejos.length} archivo(s) cambiaron después de armarlo (${viejos.slice(0, 3).join(', ')}${viejos.length > 3 ? '…' : ''}). Corré \`make mapa\`.`));
else if (grafo) console.log('  🕒 el grafo está al día con el código');
else console.log('  (sin graphify-out/graph.json: corré `graphify update .` para ver la cadena completa)');

if (!SOLO_CHECK) {
  mkdirSync(OUT, { recursive: true });
  const datos = { resumen, rutas, llamadas };
  writeFileSync(join(OUT, 'mapa-api.json'), JSON.stringify(datos, null, 1));
  const plantilla = leer(join(dirname(fileURLToPath(import.meta.url)), 'mapa-api.html'));
  writeFileSync(join(OUT, 'mapa-api.html'), plantilla.replace('/*DATOS*/null', JSON.stringify(datos).replace(/</g, '\\u003c')));
  console.log(`  📄 ${rel(join(OUT, 'mapa-api.html'))}`);
}
process.exit(rotas.length ? 1 : 0);

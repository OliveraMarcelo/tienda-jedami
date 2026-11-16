// Reparto del despacho: el admin carga cuántas unidades de cada talle × color manda.
// - Líneas con talle (curva, o la parte pareja de "por cantidad"): ese talle tiene que llevar justo esas unidades.
// - Líneas sin talle (lo que sobra de "por cantidad", ej. 102 en 5 talles → 2): van al talle y color que elija el admin.
// - Líneas minoristas: el cliente ya eligió la variante, no llevan reparto.
import type { Allocation, PendingProduct } from '@/api/admin.fulfillment.api'

/** Unidades por variante (variantId → cantidad) */
export type Cells = Record<number, number>

type Line = PendingProduct['lines'][number]
type Variant = PendingProduct['variants'][number]

const openLines = (p: PendingProduct) => p.lines.filter(l => l.variantId === null)
const sizedLines = (p: PendingProduct) => openLines(p).filter(l => l.sizeId !== null)
const freeLines = (p: PendingProduct) => openLines(p).filter(l => l.sizeId === null)

export const needsAllocation = (p: PendingProduct) => openLines(p).length > 0

/** Unidades fijas por talle (talleId → cantidad) */
export function sizeTargets(p: PendingProduct): Map<number, number> {
  const m = new Map<number, number>()
  for (const l of sizedLines(p)) m.set(l.sizeId!, (m.get(l.sizeId!) ?? 0) + l.quantity)
  return m
}

/** Unidades a elección del admin (talle y color libres) */
export const freeUnits = (p: PendingProduct) => freeLines(p).reduce((s, l) => s + l.quantity, 0)

export const totalTarget = (p: PendingProduct) => openLines(p).reduce((s, l) => s + l.quantity, 0)

const qty = (cells: Cells, variantId: number) => Math.max(0, Math.floor(cells[variantId] ?? 0))

export function rowAssigned(p: PendingProduct, cells: Cells, sizeId: number) {
  return p.variants.filter(v => v.sizeId === sizeId).reduce((s, v) => s + qty(cells, v.id), 0)
}

export const totalAssigned = (p: PendingProduct, cells: Cells) =>
  p.variants.reduce((s, v) => s + qty(cells, v.id), 0)

/** Talles que se muestran: sin unidades libres, solo los pedidos; con libres, todos */
export function gridSizes(p: PendingProduct) {
  const targets = sizeTargets(p)
  return freeUnits(p) > 0 ? p.sizes : p.sizes.filter(s => targets.has(s.id))
}

/** Qué falta para poder despachar este producto (vacío = listo) */
export function problems(p: PendingProduct, cells: Cells): string[] {
  if (!needsAllocation(p)) return []
  const out: string[] = []
  const label = (sizeId: number) => p.sizes.find(s => s.id === sizeId)?.label
  for (const v of p.variants) {
    if (qty(cells, v.id) > v.stock) {
      out.push(`Talle ${label(v.sizeId)} ${p.colors.find(c => c.id === v.colorId)?.name}: hay ${v.stock} en stock`)
    }
  }
  const free = freeUnits(p)
  for (const [sizeId, target] of sizeTargets(p)) {
    const got = rowAssigned(p, cells, sizeId)
    if (got < target) out.push(`Talle ${label(sizeId)}: ${target - got === 1 ? 'falta 1' : `faltan ${target - got}`}`)
    else if (got > target && free === 0) out.push(`Talle ${label(sizeId)}: ${got - target === 1 ? 'sobra 1' : `sobran ${got - target}`}`)
  }
  const got = totalAssigned(p, cells)
  const target = totalTarget(p)
  if (got !== target && (free > 0 || out.length === 0)) {
    const n = Math.abs(target - got)
    const units = n === 1 ? '1 unidad' : `${n} unidades`
    out.push(got < target ? `${n === 1 ? 'Falta' : 'Faltan'} ${units}${free > 0 ? ' (a elección)' : ''}` : `${n === 1 ? 'Sobra' : 'Sobran'} ${units}`)
  }
  return out
}

/** Sugerencia: llena cada talle con los colores de más stock y reparte las libres de a una entre talles */
export function autoFill(p: PendingProduct): Cells {
  const cells: Cells = {}
  const left = new Map(p.variants.map(v => [v.id, v.stock]))
  const take = (v: Variant, n: number) => {
    cells[v.id] = (cells[v.id] ?? 0) + n
    left.set(v.id, left.get(v.id)! - n)
  }
  const byStock = (vs: Variant[]) => [...vs].sort((a, b) => (left.get(b.id) ?? 0) - (left.get(a.id) ?? 0))

  for (const [sizeId, target] of sizeTargets(p)) {
    let pending = target
    for (const v of byStock(p.variants.filter(x => x.sizeId === sizeId))) {
      if (pending <= 0) break
      const n = Math.min(left.get(v.id) ?? 0, pending)
      if (n > 0) { take(v, n); pending -= n }
    }
  }

  let pending = freeUnits(p)
  while (pending > 0) {
    let moved = false
    for (const s of p.sizes) {
      if (pending === 0) break
      const best = byStock(p.variants.filter(v => v.sizeId === s.id && (left.get(v.id) ?? 0) > 0))[0]
      if (!best) continue
      take(best, 1)
      pending--
      moved = true
    }
    if (!moved) break // no queda stock
  }
  return cells
}

/** Convierte la grilla en el reparto por línea del pedido que espera el BFF */
export function toAllocations(p: PendingProduct, cells: Cells): Allocation[] {
  const out: Allocation[] = []
  const add = (itemId: number, variantId: number, n: number) => {
    const prev = out.find(a => a.itemId === itemId && a.variantId === variantId)
    if (prev) prev.quantity += n
    else out.push({ itemId, variantId, quantity: n })
  }
  // Llena las líneas en orden con las unidades de cada variante; devuelve lo que no entró
  const fill = (lines: Line[], units: { variantId: number; n: number }[]) => {
    const queue = lines.map(l => ({ id: l.id, left: l.quantity }))
    const rest: { variantId: number; n: number }[] = []
    for (const u of units) {
      let n = u.n
      while (n > 0 && queue.length > 0) {
        const line = queue[0]!
        const t = Math.min(n, line.left)
        add(line.id, u.variantId, t)
        line.left -= t
        n -= t
        if (line.left === 0) queue.shift()
      }
      if (n > 0) rest.push({ variantId: u.variantId, n })
    }
    return rest
  }

  // Primero cada talle cubre sus líneas fijas; lo que sobra va a las líneas libres
  const leftovers: { variantId: number; n: number }[] = []
  for (const s of p.sizes) {
    const units = p.variants.filter(v => v.sizeId === s.id).map(v => ({ variantId: v.id, n: qty(cells, v.id) })).filter(u => u.n > 0)
    leftovers.push(...fill(sizedLines(p).filter(l => l.sizeId === s.id), units))
  }
  fill(freeLines(p), leftovers)
  return out
}

// Reparto del despacho: el admin carga cuántas unidades de cada talle × color manda. Es opcional:
// lo que reparte descuenta stock de esa variante; lo que no, no descuenta (lo ajusta él en Productos).
// - Líneas con talle (curva, o la parte pareja de "por cantidad"): ese talle lleva hasta esas unidades.
// - Líneas sin talle (lo que sobra de "por cantidad", ej. 102 en 5 talles → 2): las elige el mayorista; van al talle y color que cargue el admin.
// - Líneas minoristas: el cliente ya eligió la variante, no llevan reparto.
import type { Allocation, PendingProduct } from '@/api/admin.fulfillment.api'

/** Unidades por variante (variantId → cantidad) */
export type Cells = Record<number, number>

type Line = PendingProduct['lines'][number]

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

/** Lo que impide despachar: más unidades que el stock o que el pedido (vacío = se puede despachar) */
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
    if (got > target && free === 0) out.push(`Talle ${label(sizeId)}: ${got - target === 1 ? 'sobra 1' : `sobran ${got - target}`}`)
  }
  const got = totalAssigned(p, cells)
  const target = totalTarget(p)
  if (got > target) {
    const n = got - target
    out.push(`${n === 1 ? 'Sobra' : 'Sobran'} ${n === 1 ? '1 unidad' : `${n} unidades`}`)
  }
  return out
}

/** Cómo quedó el reparto: sin cargar, parcial o completo */
export function allocationState(p: PendingProduct, cells: Cells): 'none' | 'partial' | 'full' {
  const got = totalAssigned(p, cells)
  if (got === 0) return 'none'
  return got >= totalTarget(p) ? 'full' : 'partial'
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

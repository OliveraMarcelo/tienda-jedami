// Rango de fechas de los filtros del panel. Las fechas van como 'YYYY-MM-DD' (día local).

export interface DateRange {
  from: string | null
  to: string | null
}

/** Filas por página en todas las tablas del panel */
export const PAGE_SIZE = 10

export const EMPTY_RANGE: DateRange = { from: null, to: null }

export function toYmd(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

export function fromYmd(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y!, m! - 1, d!)
}

/** Para la API: desde las 00:00 del primer día hasta el último instante del último día (hora local) */
export function rangeToIso(r: DateRange): { dateFrom?: string; dateTo?: string } {
  const out: { dateFrom?: string; dateTo?: string } = {}
  if (r.from) out.dateFrom = fromYmd(r.from).toISOString()
  if (r.to) {
    const end = fromYmd(r.to)
    end.setHours(23, 59, 59, 999)
    out.dateTo = end.toISOString()
  }
  return out
}

/** Para filtrar en el navegador: ¿la fecha (ISO) cae dentro del rango? */
export function inRange(iso: string | null | undefined, r: DateRange): boolean {
  if (!r.from && !r.to) return true
  if (!iso) return false
  const day = toYmd(new Date(iso))
  return (!r.from || day >= r.from) && (!r.to || day <= r.to)
}

const fmt = (s: string, withYear: boolean) =>
  fromYmd(s).toLocaleDateString('es-AR', withYear ? { day: 'numeric', month: 'short', year: 'numeric' } : { day: 'numeric', month: 'short' })

export function rangeLabel(r: DateRange): string {
  if (!r.from && !r.to) return 'Todas las fechas'
  if (r.from && r.to && r.from === r.to) return fmt(r.from, true)
  if (r.from && r.to) {
    const sameYear = r.from.slice(0, 4) === r.to.slice(0, 4)
    return `${fmt(r.from, !sameYear)} – ${fmt(r.to, true)}`
  }
  return r.from ? `Desde ${fmt(r.from, true)}` : `Hasta ${fmt(r.to!, true)}`
}

export interface RangePreset { label: string; range: () => DateRange }

export const RANGE_PRESETS: RangePreset[] = [
  { label: 'Hoy', range: () => { const t = toYmd(new Date()); return { from: t, to: t } } },
  { label: 'Últimos 7 días', range: () => lastDays(7) },
  { label: 'Últimos 30 días', range: () => lastDays(30) },
  {
    label: 'Este mes',
    range: () => { const n = new Date(); return { from: toYmd(new Date(n.getFullYear(), n.getMonth(), 1)), to: toYmd(n) } },
  },
  {
    label: 'Mes anterior',
    range: () => {
      const n = new Date()
      return { from: toYmd(new Date(n.getFullYear(), n.getMonth() - 1, 1)), to: toYmd(new Date(n.getFullYear(), n.getMonth(), 0)) }
    },
  },
]

function lastDays(n: number): DateRange {
  const to = new Date()
  const from = new Date()
  from.setDate(from.getDate() - (n - 1))
  return { from: toYmd(from), to: toYmd(to) }
}

/** Espera `ms` desde la última llamada antes de ejecutar (para buscadores) */
export function debounce<A extends unknown[]>(fn: (...args: A) => void, ms = 300) {
  let t: ReturnType<typeof setTimeout> | undefined
  return (...args: A) => {
    clearTimeout(t)
    t = setTimeout(() => fn(...args), ms)
  }
}

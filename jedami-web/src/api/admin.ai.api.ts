import apiClient from './client'

export interface AiStatus {
  enabled: boolean
  model: string | null
}

export interface ProductDescriptionRequest {
  name: string
  categoryName?: string | null
  sizes?: string[]
  colors?: string[]
  notes?: string | null
  productId?: number | null
}

export interface ProductDescriptionResult {
  generationId: number
  model: string
  durationMs: number
  title: string | null
  description: string
  highlights: string[]
}

export type GenerationStatus = 'accepted' | 'edited' | 'discarded'

let statusCache: Promise<AiStatus> | null = null

/** Estado de la IA (se consulta una vez por sesión de la página) */
export function fetchAiStatus(): Promise<AiStatus> {
  statusCache ??= apiClient
    .get<{ data: AiStatus }>('/admin/ai/status')
    .then((res) => res.data.data)
    .catch(() => {
      statusCache = null
      return { enabled: false, model: null }
    })
  return statusCache
}

export async function generateProductDescription(body: ProductDescriptionRequest): Promise<ProductDescriptionResult> {
  // El modelo local puede tardar: timeout más largo que el resto de la API
  const res = await apiClient.post<{ data: ProductDescriptionResult }>('/admin/ai/product-description', body, { timeout: 120_000 })
  return res.data.data
}

export async function updateGeneration(
  id: number,
  body: { status: GenerationStatus; finalText?: string | null; productId?: number | null },
): Promise<void> {
  await apiClient.patch(`/admin/ai/generations/${id}`, body)
}

/** Texto para el campo descripción: descripción + puntos con viñetas (igual que el BFF) */
export function composeDescriptionText(r: Pick<ProductDescriptionResult, 'description' | 'highlights'>): string {
  if (!r.highlights.length) return r.description
  return `${r.description}\n\n${r.highlights.map((h) => `• ${h}`).join('\n')}`
}

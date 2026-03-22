import apiClient from './client'

// Respuesta del endpoint público — solo campos que devuelve /config/announcements
export interface PublicAnnouncement {
  id: number
  title: string
  body: string | null
  imageUrl: string | null
  linkUrl: string | null
  linkLabel: string | null
  sortOrder: number
}

// Respuesta completa del admin — incluye estado, audiencia y vigencia
export interface Announcement extends PublicAnnouncement {
  targetAudience: 'all' | 'authenticated' | 'wholesale' | 'retail'
  active: boolean
  validFrom: string | null
  validUntil: string | null
}

export async function fetchAnnouncements(audience: 'all' | 'wholesale' | 'retail'): Promise<PublicAnnouncement[]> {
  const res = await apiClient.get<{ data: PublicAnnouncement[] }>(`/config/announcements?audience=${audience}`)
  return res.data.data
}

export async function fetchAllAnnouncements(): Promise<Announcement[]> {
  const res = await apiClient.get<{ data: Announcement[] }>('/admin/announcements')
  return res.data.data
}

export async function createAnnouncement(dto: {
  title: string
  body?: string
  file?: File
  linkUrl?: string
  linkLabel?: string
  targetAudience: 'all' | 'authenticated' | 'wholesale' | 'retail'
  validFrom?: string
  validUntil?: string
}): Promise<Announcement> {
  const form = new FormData()
  form.append('title', dto.title)
  if (dto.body) form.append('body', dto.body)
  if (dto.file) form.append('image', dto.file)
  if (dto.linkUrl) form.append('linkUrl', dto.linkUrl)
  if (dto.linkLabel) form.append('linkLabel', dto.linkLabel)
  form.append('targetAudience', dto.targetAudience)
  if (dto.validFrom) form.append('validFrom', dto.validFrom)
  if (dto.validUntil) form.append('validUntil', dto.validUntil)
  const res = await apiClient.post<{ data: Announcement }>('/admin/announcements', form)
  return res.data.data
}

export async function updateAnnouncement(
  id: number,
  dto: Partial<{
    title: string
    body: string | null
    linkUrl: string | null
    linkLabel: string | null
    targetAudience: 'all' | 'authenticated' | 'wholesale' | 'retail'
    active: boolean
    validFrom: string | null
    validUntil: string | null
  }>,
): Promise<Announcement> {
  const res = await apiClient.patch<{ data: Announcement }>(`/admin/announcements/${id}`, dto)
  return res.data.data
}

export async function reorderAnnouncements(items: { id: number; sortOrder: number }[]): Promise<void> {
  await apiClient.patch('/admin/announcements/reorder', items)
}

export async function deleteAnnouncement(id: number): Promise<void> {
  await apiClient.delete(`/admin/announcements/${id}`)
}

import apiClient from './client'

export interface Banner {
  id: number
  imageUrl: string
  linkUrl: string | null
  sortOrder: number
  active?: boolean
}

export async function fetchBanners(): Promise<Banner[]> {
  const res = await apiClient.get<{ data: Banner[] }>('/config/banners')
  return res.data.data
}

export async function fetchAllBanners(): Promise<Banner[]> {
  const res = await apiClient.get<{ data: Banner[] }>('/admin/banners')
  return res.data.data
}

export async function uploadBanner(file: File, linkUrl?: string): Promise<Banner> {
  const form = new FormData()
  form.append('image', file)
  if (linkUrl) form.append('linkUrl', linkUrl)
  const res = await apiClient.post<{ data: Banner }>('/admin/banners', form)
  return res.data.data
}

export async function updateBanner(id: number, dto: { active?: boolean; linkUrl?: string | null }): Promise<Banner> {
  const res = await apiClient.patch<{ data: Banner }>(`/admin/banners/${id}`, dto)
  return res.data.data
}

export async function reorderBanners(items: { id: number; sortOrder: number }[]): Promise<void> {
  await apiClient.patch('/admin/banners/reorder', items)
}

export async function deleteBanner(id: number): Promise<void> {
  await apiClient.delete(`/admin/banners/${id}`)
}

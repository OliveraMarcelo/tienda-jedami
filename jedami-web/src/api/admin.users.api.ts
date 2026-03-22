import apiClient from './client'

export interface UserWithRoles {
  id: number
  email: string
  createdAt: string
  roles: string[]
}

export interface AdminUser {
  id: number
  email: string
  createdAt: string
  roles: string[]
  customerId: number | null
  customerType: string | null
}

export interface AdminUsersResponse {
  users: AdminUser[]
  pagination: { page: number; limit: number; total: number; pages: number }
}

export interface FetchAdminUsersParams {
  page?: number
  limit?: number
  role?: string
  search?: string
}

// Endpoint básico — usado para selects de roles en otras vistas
export async function fetchUsers(): Promise<UserWithRoles[]> {
  const res = await apiClient.get<{ data: UserWithRoles[] }>('/users')
  return res.data.data
}

// Endpoint admin enriquecido con paginación, customerType y filtros
export async function fetchAdminUsers(
  params: FetchAdminUsersParams = {},
): Promise<AdminUsersResponse> {
  const res = await apiClient.get<{ data: AdminUsersResponse }>('/admin/users', {
    params: {
      page:   params.page,
      limit:  params.limit,
      role:   params.role   || undefined,
      search: params.search || undefined,
    },
  })
  return res.data.data
}

export async function assignRole(userId: number, roleId: number): Promise<void> {
  await apiClient.post(`/users/${userId}/roles`, { roleId })
}

export async function removeRoleFromUser(userId: number, roleId: number): Promise<AdminUser> {
  const res = await apiClient.delete<{ data: AdminUser }>(`/users/${userId}/roles/${roleId}`)
  return res.data.data
}

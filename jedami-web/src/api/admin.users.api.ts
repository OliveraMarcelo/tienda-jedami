import apiClient from './client'

export interface UserWithRoles {
  id: number
  email: string
  createdAt: string
  roles: string[]
}

export async function fetchUsers(): Promise<UserWithRoles[]> {
  const res = await apiClient.get<{ data: UserWithRoles[] }>('/users')
  return res.data.data
}

export async function assignRole(userId: number, roleId: number): Promise<void> {
  await apiClient.post(`/users/${userId}/roles`, { roleId })
}

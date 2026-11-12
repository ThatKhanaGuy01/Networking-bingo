export const apiBasePath = '/api'

import type { BingoTask, SharedCardResponse } from '../../shared/types'

export interface AdminTask extends BingoTask {}

export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message)
    this.name = 'ApiError'
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(apiBasePath + path, {
    ...init,
    credentials: 'same-origin',
    headers: { ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...init.headers },
  })
  const data = await response.json().catch(() => null) as { error?: string } | null
  if (!response.ok) throw new ApiError(data?.error ?? 'Request failed.', response.status)
  return data as T
}

function jsonBody(value: unknown): string {
  return JSON.stringify(value)
}

export async function getPublicTasks(): Promise<readonly BingoTask[]> {
  const result = await request<{ tasks: BingoTask[] }>('/tasks')
  return result.tasks
}

export async function getAdminSession(): Promise<boolean> {
  const result = await request<{ authenticated: boolean }>('/admin/session')
  return result.authenticated
}

export async function adminLogin(password: string): Promise<void> {
  await request('/admin/login', { method: 'POST', body: jsonBody({ password }) })
}

export async function adminLogout(): Promise<void> {
  await request('/admin/logout', { method: 'POST' })
}

export async function getAdminTasks(search = ''): Promise<readonly AdminTask[]> {
  const query = search ? '?search=' + encodeURIComponent(search) : ''
  const result = await request<{ tasks: AdminTask[] }>('/admin/tasks' + query)
  return result.tasks
}

export async function createAdminTask(text: string): Promise<AdminTask> {
  const result = await request<{ task: AdminTask }>('/admin/tasks', { method: 'POST', body: jsonBody({ text }) })
  return result.task
}

export async function updateAdminTask(id: string, text: string): Promise<AdminTask> {
  const result = await request<{ task: AdminTask }>('/admin/tasks/' + encodeURIComponent(id), { method: 'PATCH', body: jsonBody({ text }) })
  return result.task
}

export async function deleteAdminTask(id: string): Promise<void> {
  await request('/admin/tasks/' + encodeURIComponent(id), { method: 'DELETE' })
}

export async function createSharedCard(input: {
  gridSize: number
  freeCenter: boolean
  cells: Array<{ taskId: string } | null>
}): Promise<{ id: string }> {
  return request('/cards', { method: 'POST', body: jsonBody(input) })
}

export async function getSharedCard(id: string): Promise<SharedCardResponse> {
  return request('/cards/' + encodeURIComponent(id))
}

export function sharedCardUrl(id: string): string {
  return window.location.origin + '/c/' + encodeURIComponent(id)
}

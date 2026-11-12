import { exports, env } from 'cloudflare:workers'
import { beforeEach, describe, expect, it } from 'vitest'
import type { Env } from '../../src/worker/env'
import { TEST_ADMIN_PASSWORD } from './test-secrets'

const worker = (exports as unknown as { default: { fetch(request: Request): Promise<Response> } }).default
const origin = 'https://bingo.test'
let ipSequence = 1

function nextIp(): string {
  ipSequence += 1
  return '198.51.100.' + (ipSequence % 250 + 1)
}

function request(path: string, options: { method?: string; body?: unknown; cookie?: string; origin?: string; ip?: string } = {}): Request {
  const headers = new Headers({ 'CF-Connecting-IP': options.ip ?? nextIp() })
  if (options.origin !== '') headers.set('Origin', options.origin ?? origin)
  if (options.body !== undefined) headers.set('Content-Type', 'application/json')
  if (options.cookie) headers.set('Cookie', options.cookie)
  return new Request(origin + path, {
    method: options.method ?? 'GET',
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  })
}

async function fetchApi(path: string, options: Parameters<typeof request>[1] = {}): Promise<Response> {
  return worker.fetch(request(path, options))
}

async function login(ip = nextIp()): Promise<{ cookie: string; response: Response }> {
  const response = await fetchApi('/api/admin/login', { method: 'POST', body: { password: TEST_ADMIN_PASSWORD }, ip })
  const setCookie = response.headers.get('set-cookie')
  if (!setCookie) throw new Error('Expected login to set an admin session cookie')
  return { cookie: setCookie.split(';', 1)[0]!, response }
}

async function addTask(cookie: string, text: string, ip = nextIp()): Promise<{ id: string; text: string }> {
  const response = await fetchApi('/api/admin/tasks', { method: 'POST', cookie, body: { text }, ip })
  const result = await response.json() as { task: { id: string; text: string } }
  if (!response.ok) throw new Error('Could not seed a task: ' + response.status)
  return result.task
}

describe('Worker admin and card APIs with local D1', () => {
  beforeEach(async () => {
    await (env as unknown as Env).bingotasks.prepare('DELETE FROM admin_rate_limits').run()
  })

  it('authenticates, issues a secure HttpOnly cookie, exposes session state and logs out', async () => {
    const bad = await fetchApi('/api/admin/login', { method: 'POST', body: { password: 'wrong password' } })
    expect(bad.status).toBe(401)

    const { cookie, response } = await login()
    expect(response.status).toBe(200)
    expect(response.headers.get('set-cookie')).toContain('HttpOnly')
    expect(response.headers.get('set-cookie')).toContain('SameSite=Strict')
    expect(response.headers.get('set-cookie')).toContain('Secure')

    const session = await fetchApi('/api/admin/session', { cookie })
    expect(await session.json()).toEqual({ authenticated: true })
    const logout = await fetchApi('/api/admin/logout', { method: 'POST', cookie })
    expect(logout.status).toBe(200)
    const afterLogout = await fetchApi('/api/admin/session', { cookie })
    expect(await afterLogout.json()).toEqual({ authenticated: false })
  })

  it('rate limits repeated login attempts from one address', async () => {
    const ip = '198.51.100.10'
    for (let attempt = 0; attempt < 5; attempt += 1) {
      expect((await fetchApi('/api/admin/login', { method: 'POST', body: { password: 'wrong password' }, ip })).status).toBe(401)
    }
    const limited = await fetchApi('/api/admin/login', { method: 'POST', body: { password: 'wrong password' }, ip })
    expect(limited.status).toBe(429)
    expect(limited.headers.get('retry-after')).toBeTruthy()
  })

  it('rejects cross-origin writes and protects all admin task endpoints', async () => {
    const csrf = await fetchApi('/api/admin/login', { method: 'POST', origin: 'https://attacker.test', body: { password: TEST_ADMIN_PASSWORD } })
    expect(csrf.status).toBe(403)

    const noCookieGet = await fetchApi('/api/admin/tasks')
    const noCookiePost = await fetchApi('/api/admin/tasks', { method: 'POST', body: { text: 'Blocked task' } })
    const noCookiePatch = await fetchApi('/api/admin/tasks/task-id', { method: 'PATCH', body: { text: 'Blocked task' } })
    const noCookieDelete = await fetchApi('/api/admin/tasks/task-id', { method: 'DELETE' })
    expect([noCookieGet.status, noCookiePost.status, noCookiePatch.status, noCookieDelete.status]).toEqual([401, 401, 401, 401])
  })

  it('creates, searches, edits and deletes tasks with validation and case-insensitive duplicate checks', async () => {
    const { cookie } = await login()
    const createdResponse = await fetchApi('/api/admin/tasks', { method: 'POST', cookie, body: { text: '  Test task  ' } })
    expect(createdResponse.status).toBe(201)
    const created = (await createdResponse.json() as { task: { id: string; text: string } }).task
    expect(created.text).toBe('Test task')

    const duplicate = await fetchApi('/api/admin/tasks', { method: 'POST', cookie, body: { text: 'TEST TASK' } })
    expect(duplicate.status).toBe(409)
    expect((await fetchApi('/api/admin/tasks', { method: 'POST', cookie, body: { text: '   ' } })).status).toBe(400)
    expect((await fetchApi('/api/admin/tasks', { method: 'POST', cookie, body: { text: 'x'.repeat(201) } })).status).toBe(400)

    const search = await fetchApi('/api/admin/tasks?search=test%20tas', { cookie })
    expect((await search.json() as { tasks: Array<{ id: string }> }).tasks.map((task) => task.id)).toContain(created.id)

    const edited = await fetchApi('/api/admin/tasks/' + created.id, { method: 'PATCH', cookie, body: { text: 'Edited task' } })
    expect(edited.status).toBe(200)
    expect((await edited.json() as { task: { text: string } }).task.text).toBe('Edited task')

    const deleted = await fetchApi('/api/admin/tasks/' + created.id, { method: 'DELETE', cookie })
    expect(deleted.status).toBe(200)
    expect((await fetchApi('/api/admin/tasks/' + created.id, { method: 'PATCH', cookie, body: { text: 'Missing' } })).status).toBe(404)
  })

  it('returns public tasks in immutable ID order', async () => {
    const { cookie } = await login()
    await addTask(cookie, 'Public task A')
    await addTask(cookie, 'Public task B')
    const response = await fetchApi('/api/tasks')
    expect(response.status).toBe(200)
    const ids = (await response.json() as { tasks: Array<{ id: string }> }).tasks.map((task) => task.id)
    expect(ids).toEqual([...ids].sort())
  })

  it('creates immutable card snapshots and returns an unmarked public card', async () => {
    const { cookie } = await login()
    const selected: Array<{ id: string; text: string }> = []
    for (let index = 0; index < 8; index += 1) selected.push(await addTask(cookie, 'Snapshot task ' + crypto.randomUUID()))
    const input = {
      gridSize: 3,
      freeCenter: true,
      cells: Array.from({ length: 9 }, (_, index) => index === 4 ? null : { taskId: selected[index < 4 ? index : index - 1]!.id }),
    }
    const created = await fetchApi('/api/cards', { method: 'POST', body: input })
    expect(created.status).toBe(201)
    const { id } = await created.json() as { id: string }
    expect(id).toMatch(/^[A-Za-z0-9_-]{43}$/u)

    const publicCard = await fetchApi('/api/cards/' + id)
    expect(publicCard.status).toBe(200)
    const snapshot = await publicCard.json() as { cells: Array<{ task: { id: string; text: string } | null; isFree: boolean }>; completedCells: boolean[] }
    expect(snapshot.cells).toHaveLength(9)
    expect(snapshot.completedCells).toEqual([false, false, false, false, true, false, false, false, false])
    expect(snapshot.cells[0]?.task?.text).toBe(selected[0]?.text)

    await fetchApi('/api/admin/tasks/' + selected[0]!.id, { method: 'PATCH', cookie, body: { text: 'Changed after sharing' } })
    const readAgain = await fetchApi('/api/cards/' + id)
    const immutable = await readAgain.json() as typeof snapshot
    expect(immutable.cells[0]?.task?.text).toBe(selected[0]?.text)

    await expect((env as unknown as Env).bingotasks.prepare('UPDATE shared_cards SET title = ? WHERE id = ?').bind('changed', id).run()).rejects.toThrow()
    await expect((env as unknown as Env).bingotasks.prepare('DELETE FROM shared_cards WHERE id = ?').bind(id).run()).rejects.toThrow()
  })

  it('rejects invalid grid, duplicate cells and missing task references', async () => {
    const valid = { gridSize: 3, freeCenter: false, cells: Array.from({ length: 9 }, (_, index) => ({ taskId: 'missing-' + index })) }
    expect((await fetchApi('/api/cards', { method: 'POST', body: { ...valid, gridSize: 2 } })).status).toBe(400)
    const duplicate = valid.cells.slice()
    duplicate[1] = duplicate[0]!
    expect((await fetchApi('/api/cards', { method: 'POST', body: { ...valid, cells: duplicate } })).status).toBe(400)
    expect((await fetchApi('/api/cards', { method: 'POST', body: valid })).status).toBe(400)
  })
})

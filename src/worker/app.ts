import { Hono, type Context } from 'hono'
import { z } from 'zod'
import { asc, eq, inArray, sql } from 'drizzle-orm'
import type { BingoTask, CardSnapshot, GridSize, SharedCardResponse } from '../../shared/types'
import { createDb } from './db/client'
import { sharedCards, tasks } from './db/schema'
import type { Env } from './env'
import { consumeRateLimit, createAdminSession, getAdminSession, revokeAdminSession, verifyAdminPassword } from './security'

const app = new Hono<{ Bindings: Env }>()
type AppContext = Context<{ Bindings: Env }>

const taskInput = z.object({ text: z.string().max(200).trim().min(1).max(200) }).strict()
const loginInput = z.object({ password: z.string().min(1).max(1024) }).strict()
const cardCellInput = z.object({ taskId: z.string().min(1).max(100) }).strict().nullable()
const cardInput = z.object({
  title: z.string().trim().min(1).max(100).optional(),
  gridSize: z.number().int().min(3).max(7),
  freeCenter: z.boolean(),
  cells: z.array(cardCellInput).max(49),
}).strict()

function taskKey(text: string): string {
  return text.normalize('NFKC').toLowerCase()
}

function errorResponse(error: string, status: 400 | 401 | 403 | 404 | 409 | 429 | 503) {
  return Response.json({ error }, { status })
}

async function parseJson<T>(c: AppContext, schema: z.ZodType<T>): Promise<T | Response> {
  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return errorResponse('Request body must be valid JSON.', 400)
  }
  const parsed = schema.safeParse(body)
  if (!parsed.success) return errorResponse('Request data is invalid.', 400)
  return parsed.data
}

async function requireAdmin(c: AppContext): Promise<Response | null> {
  return await getAdminSession(c) ? null : errorResponse('Admin login required.', 401)
}

function isResponse(value: unknown): value is Response {
  return value instanceof Response
}

async function rateLimit(
  c: AppContext,
  scope: string,
  maxAttempts: number,
  windowSeconds: number,
): Promise<Response | null> {
  try {
    return await consumeRateLimit(c, scope, maxAttempts, windowSeconds)
  } catch {
    return errorResponse('Request protection is temporarily unavailable.', 503)
  }
}

function makeShareId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/u, '')
}

function snapshotResponse(snapshot: CardSnapshot): SharedCardResponse {
  return { ...snapshot, completedCells: snapshot.cells.map((cell) => cell.isFree) }
}

app.get('/health', (c) => c.json({ status: 'ok' }))
app.get('/api/health', (c) => c.json({ status: 'ok' }))

// Every browser write must originate from this app's own origin. SameSite=Strict
// cookies add a second CSRF barrier for authenticated requests.
app.use('/api/*', async (c, next) => {
  if (['POST', 'PATCH', 'PUT', 'DELETE'].includes(c.req.method)) {
    const origin = c.req.header('Origin')
    if (!origin || origin !== new URL(c.req.url).origin) return errorResponse('Request origin is not allowed.', 403)
  }
  await next()
})

app.get('/api/tasks', async (c) => {
  try {
    const db = createDb(c.env.bingotasks)
    const rows = await db.select({ id: tasks.id, text: tasks.text }).from(tasks).orderBy(asc(tasks.id))
    return c.json({ tasks: rows })
  } catch {
    return errorResponse('Tasks are temporarily unavailable.', 503)
  }
})

app.post('/api/admin/login', async (c) => {
  const limited = await rateLimit(c, 'login', 5, 15 * 60)
  if (limited) return limited
  if (!c.env.ADMIN_PASSWORD_HASH || !c.env.SESSION_SECRET || c.env.SESSION_SECRET.length < 32) {
    return errorResponse('Admin authentication is not configured.', 503)
  }
  const input = await parseJson(c, loginInput)
  if (isResponse(input)) return input
  let matches = false
  try {
    matches = await verifyAdminPassword(input.password, c.env.ADMIN_PASSWORD_HASH)
  } catch {
    return errorResponse('Admin authentication is temporarily unavailable.', 503)
  }
  if (!matches) return errorResponse('Password is incorrect.', 401)
  try {
    await createAdminSession(c)
    return c.json({ authenticated: true })
  } catch {
    return errorResponse('Admin authentication is temporarily unavailable.', 503)
  }
})

app.post('/api/admin/logout', async (c) => {
  const limited = await rateLimit(c, 'admin-write', 60, 60)
  if (limited) return limited
  try {
    await revokeAdminSession(c)
    return c.json({ authenticated: false })
  } catch {
    return errorResponse('Could not end the admin session.', 503)
  }
})

app.get('/api/admin/session', async (c) => {
  try {
    return c.json({ authenticated: await getAdminSession(c) })
  } catch {
    return errorResponse('Could not check the admin session.', 503)
  }
})

app.get('/api/admin/tasks', async (c) => {
  const denied = await requireAdmin(c)
  if (denied) return denied
  const search = (c.req.query('search') ?? '').trim().slice(0, 200)
  try {
    const db = createDb(c.env.bingotasks)
    const query = taskKey(search)
    const rows = await db.select({ id: tasks.id, text: tasks.text })
      .from(tasks)
      .where(query ? sql`instr(${tasks.textKey}, ${query}) > 0` : undefined)
      .orderBy(asc(tasks.id))
    return c.json({ tasks: rows })
  } catch {
    return errorResponse('Tasks are temporarily unavailable.', 503)
  }
})

app.post('/api/admin/tasks', async (c) => {
  const denied = await requireAdmin(c)
  if (denied) return denied
  const limited = await rateLimit(c, 'admin-write', 60, 60)
  if (limited) return limited
  const input = await parseJson(c, taskInput)
  if (isResponse(input)) return input
  const key = taskKey(input.text)
  const db = createDb(c.env.bingotasks)
  try {
    const duplicate = await db.select({ id: tasks.id }).from(tasks).where(eq(tasks.textKey, key)).limit(1)
    if (duplicate.length) return errorResponse('A task with the same text already exists.', 409)
    const [created] = await db.insert(tasks).values({ id: crypto.randomUUID(), text: input.text, textKey: key })
      .returning({ id: tasks.id, text: tasks.text })
    return c.json({ task: created }, 201)
  } catch {
    return errorResponse('Could not save the task. Check that it is not a duplicate.', 409)
  }
})

app.patch('/api/admin/tasks/:id', async (c) => {
  const denied = await requireAdmin(c)
  if (denied) return denied
  const limited = await rateLimit(c, 'admin-write', 60, 60)
  if (limited) return limited
  const input = await parseJson(c, taskInput)
  if (isResponse(input)) return input
  const id = c.req.param('id')
  const key = taskKey(input.text)
  const db = createDb(c.env.bingotasks)
  try {
    const existing = await db.select({ id: tasks.id }).from(tasks).where(eq(tasks.id, id)).limit(1)
    if (!existing.length) return errorResponse('Task not found.', 404)
    const duplicate = await db.select({ id: tasks.id }).from(tasks).where(eq(tasks.textKey, key)).limit(1)
    if (duplicate.length && duplicate[0]?.id !== id) return errorResponse('A task with the same text already exists.', 409)
    const [updated] = await db.update(tasks).set({ text: input.text, textKey: key }).where(eq(tasks.id, id))
      .returning({ id: tasks.id, text: tasks.text })
    return c.json({ task: updated })
  } catch {
    return errorResponse('Could not update the task. Check that it is not a duplicate.', 409)
  }
})

app.delete('/api/admin/tasks/:id', async (c) => {
  const denied = await requireAdmin(c)
  if (denied) return denied
  const limited = await rateLimit(c, 'admin-write', 60, 60)
  if (limited) return limited
  try {
    const db = createDb(c.env.bingotasks)
    const result = await db.delete(tasks).where(eq(tasks.id, c.req.param('id')))
    if (!result.meta.changes) return errorResponse('Task not found.', 404)
    return c.json({ deleted: true })
  } catch {
    return errorResponse('Could not delete the task.', 503)
  }
})

app.post('/api/cards', async (c) => {
  const limited = await rateLimit(c, 'create-card', 20, 60 * 60)
  if (limited) return limited
  const input = await parseJson(c, cardInput)
  if (isResponse(input)) return input

  const { gridSize, freeCenter, cells: inputCells } = input
  const cellCount = gridSize * gridSize
  if (freeCenter && gridSize % 2 === 0) return errorResponse('A free centre is only available on odd-sized grids.', 400)
  if (inputCells.length !== cellCount) return errorResponse('The card must have one entry for every square.', 400)
  const center = Math.floor(cellCount / 2)
  const ids: string[] = []
  for (let index = 0; index < inputCells.length; index += 1) {
    const cell = inputCells[index]!
    const shouldBeFree = freeCenter && index === center
    if (shouldBeFree) {
      if (cell !== null) return errorResponse('The free centre square cannot contain a task.', 400)
      continue
    }
    if (!cell) return errorResponse('Every non-free square must contain a task.', 400)
    ids.push(cell.taskId)
  }
  if (new Set(ids).size !== ids.length) return errorResponse('A task cannot appear more than once on a card.', 400)

  try {
    const db = createDb(c.env.bingotasks)
    const rows = await db.select({ id: tasks.id, text: tasks.text }).from(tasks).where(inArray(tasks.id, ids))
    if (rows.length !== ids.length) return errorResponse('One or more tasks are no longer available.', 400)
    const byId = new Map<string, BingoTask>(rows.map((task) => [task.id, task]))
    const cells = inputCells.map((cell, index) => {
      const isFree = freeCenter && index === center
      return {
        index,
        row: Math.floor(index / gridSize),
        column: index % gridSize,
        task: cell ? byId.get(cell.taskId)! : null,
        isFree,
      }
    })
    const snapshot: CardSnapshot = {
      id: makeShareId(),
      title: input.title ?? 'Custom Bingo Card',
      gridSize: gridSize as GridSize,
      freeCenter,
      cells,
    }
    await db.insert(sharedCards).values({
      id: snapshot.id,
      title: snapshot.title,
      gridSize,
      freeCenter,
      snapshotJson: JSON.stringify(cells),
    })
    return c.json({ id: snapshot.id }, 201)
  } catch {
    return errorResponse('Could not create the shared card.', 503)
  }
})

app.get('/api/cards/:id', async (c) => {
  const id = c.req.param('id')
  if (!/^[A-Za-z0-9_-]{43}$/u.test(id)) return errorResponse('Shared card not found.', 404)
  try {
    const db = createDb(c.env.bingotasks)
    const [row] = await db.select().from(sharedCards).where(eq(sharedCards.id, id)).limit(1)
    if (!row) return errorResponse('Shared card not found.', 404)
    const cells = JSON.parse(row.snapshotJson) as CardSnapshot['cells']
    if (!Array.isArray(cells) || cells.length !== row.gridSize * row.gridSize) return errorResponse('Shared card is unavailable.', 503)
    const snapshot: CardSnapshot = {
      id: row.id,
      title: row.title,
      gridSize: row.gridSize as CardSnapshot['gridSize'],
      freeCenter: row.freeCenter,
      cells,
    }
    const response: SharedCardResponse = snapshotResponse(snapshot)
    return c.json(response)
  } catch {
    return errorResponse('Shared card is temporarily unavailable.', 503)
  }
})

app.notFound((c) => {
  if (c.req.path === '/api' || c.req.path.startsWith('/api/')) return c.json({ error: 'API route not found.' }, 404)
  return c.text('Not found', 404)
})

app.onError((_error, c) => c.json({ error: 'The request could not be completed.' }, 500))

export default app

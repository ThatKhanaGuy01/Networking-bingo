import { Hono } from 'hono'
import type { Env } from './env'

const app = new Hono<{ Bindings: Env }>()

app.get('/health', (c) => c.json({ status: 'ok' }))
app.get('/api/health', (c) => c.json({ status: 'ok' }))

app.notFound((c) => {
  if (c.req.path === '/api' || c.req.path.startsWith('/api/')) return c.json({ error: 'API route not found' }, 404)
  return c.text('Not found', 404)
})

export default app

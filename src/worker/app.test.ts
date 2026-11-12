import { describe, expect, it } from 'vitest'
import app from './app'

describe('Worker routes', () => {
  it('serves health without a database query', async () => {
    const response = await app.request('/health')
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ status: 'ok' })
  })

  it('keeps missing API paths as JSON 404s', async () => {
    const response = await app.request('/api/missing')
    expect(response.status).toBe(404)
    expect(response.headers.get('content-type')).toContain('application/json')
  })
})

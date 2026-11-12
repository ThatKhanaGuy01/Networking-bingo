import { applyD1Migrations } from 'cloudflare:test'
import { env } from 'cloudflare:workers'
import type { D1Migration } from 'cloudflare:test'
import { beforeAll } from 'vitest'
import type { Env } from '../../src/worker/env'

interface TestEnv extends Env {
  TEST_MIGRATIONS: D1Migration[]
}

beforeAll(async () => {
  const testEnv = env as unknown as TestEnv
  await applyD1Migrations(testEnv.bingotasks, testEnv.TEST_MIGRATIONS)
})

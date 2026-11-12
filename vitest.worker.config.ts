import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-plugin'
import { defineConfig } from 'vitest/config'

// Test-only hash for TEST_ADMIN_PASSWORD. Never use this credential outside tests.
const testPasswordHash = 'pbkdf2-sha256$600000$bmV0d29yay1iaW5nby0wMQ$g2l83bwBIWk-vBTbhrNeqlh75mjqkixcrg07egKrJHE'
const testSessionSecret = 'test-only-session-secret-with-more-than-32-characters'

export default defineConfig({
  plugins: [cloudflareTest(async () => ({
    wrangler: { configPath: './wrangler.jsonc' },
    miniflare: {
      bindings: {
        ADMIN_PASSWORD_HASH: testPasswordHash,
        SESSION_SECRET: testSessionSecret,
        TEST_MIGRATIONS: await readD1Migrations(new URL('./drizzle/migrations', import.meta.url).pathname),
      },
    },
  }))],
  test: {
    include: ['tests/worker/**/*.integration.test.ts'],
    setupFiles: ['./tests/worker/setup.ts'],
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
})

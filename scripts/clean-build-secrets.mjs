import { rmSync } from 'node:fs'

// The Cloudflare Vite plugin copies local dev vars beside its Worker output.
rmSync('dist/networking_bingo/.dev.vars', { force: true })

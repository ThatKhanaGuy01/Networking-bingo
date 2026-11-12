/**
 * Stable seed hashing: FNV-1a 32-bit over UTF-8 bytes.
 * Seeds are case-sensitive and are not trimmed or Unicode-normalized.
 * Keep this and Mulberry32 stable; the known-answer test pins their output.
 */
export function hashSeed(seed: string): number {
  let hash = 0x811c9dc5
  for (const byte of new TextEncoder().encode(seed)) {
    hash = Math.imul(hash ^ byte, 0x01000193) >>> 0
  }
  return hash
}

/** Mulberry32: a small, deterministic 32-bit PRNG suitable for card shuffling. */
export function createSeededRandom(seed: string): () => number {
  let state = hashSeed(seed)
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let value = state
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 0x1_0000_0000
  }
}

/** Create a reproducible 128-bit seed with the Web Crypto API. */
export function createRandomSeed(): string {
  const cryptoApi = globalThis.crypto
  if (!cryptoApi?.getRandomValues) {
    throw new Error('crypto.getRandomValues is required when no seed is supplied')
  }

  const bytes = cryptoApi.getRandomValues(new Uint8Array(16))
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

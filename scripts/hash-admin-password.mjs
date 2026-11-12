#!/usr/bin/env node
import { pbkdf2Sync, randomBytes } from 'node:crypto'
import { StringDecoder } from 'node:string_decoder'

const ITERATIONS = 600_000
const KEY_LENGTH = 32
const SALT_LENGTH = 16

function readHidden(prompt) {
  return new Promise((resolve, reject) => {
    const { stdin, stderr } = process
    if (!stdin.isTTY || typeof stdin.setRawMode !== 'function') {
      reject(new Error('Run this command in an interactive terminal.'))
      return
    }

    const decoder = new StringDecoder('utf8')
    let value = ''
    stderr.write(prompt)
    stdin.setRawMode(true)
    stdin.resume()

    function finish(error) {
      stdin.off('data', onData)
      stdin.off('end', onEnd)
      stdin.setRawMode(false)
      stdin.pause()
      stderr.write('\n')
      if (error) reject(error)
      else resolve(value)
    }

    function onEnd() {
      finish(new Error('Input ended before the password was entered.'))
    }

    function onData(buffer) {
      for (const character of decoder.write(buffer)) {
        if (character === '\u0003') {
          finish(new Error('Cancelled.'))
          return
        }
        if (character === '\r' || character === '\n') {
          finish()
          return
        }
        if (character === '\u007f' || character === '\b') {
          value = Array.from(value).slice(0, -1).join('')
        } else if (character >= ' ') {
          value += character
        }
      }
    }

    stdin.on('data', onData)
    stdin.on('end', onEnd)
  })
}

try {
  const password = await readHidden('Admin password (input is hidden): ')
  const confirmation = await readHidden('Confirm admin password: ')
  if (password !== confirmation) throw new Error('Passwords did not match.')
  if (Buffer.byteLength(password, 'utf8') < 16) {
    throw new Error('Use an admin password of at least 16 bytes.')
  }

  const salt = randomBytes(SALT_LENGTH)
  const derived = pbkdf2Sync(password, salt, ITERATIONS, KEY_LENGTH, 'sha256')
  const encoded = [
    'pbkdf2-sha256',
    String(ITERATIONS),
    salt.toString('base64url'),
    derived.toString('base64url'),
  ].join('$')

  // Both output modes contain only the hash, never the password.
  const valueOnly = process.argv.includes('--value-only')
  process.stdout.write((valueOnly ? encoded : 'ADMIN_PASSWORD_HASH=' + encoded) + '\n')
} catch (error) {
  process.stderr.write((error instanceof Error ? error.message : 'Could not create password hash.') + '\n')
  process.exitCode = 1
}

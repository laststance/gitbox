#!/usr/bin/env node
/**
 * Inject migrated Production credentials only into commands that need them.
 * Package scripts call this before production builds and server startup; CI keeps its existing secrets.
 * @example node scripts/with-production-secrets.mjs next build
 */
import { spawn } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { constants } from 'node:os'
import { parseEnv } from 'node:util'

const keys = [
  'GITHUB_CLIENT_ID',
  'GITHUB_CLIENT_SECRET',
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SENTRY_AUTH_TOKEN',
  'NEXT_PUBLIC_SITE_URL',
]
const referenceFile = new URL('../.env.production.1password', import.meta.url)
const [command, ...args] = process.argv.slice(2)
const env = { ...process.env }
const externallyConfigured =
  env.CI === 'true' ||
  env.CI === '1' ||
  env.VERCEL === '1' ||
  env.APP_ENV === 'test'

if (!command) {
  process.stderr.write(
    'Pass a command and its arguments to the secrets launcher.\n',
  )
  process.exit(1)
}

// Preserve explicit values, including empty tokens used to disable uploads.
if (!externallyConfigured && keys.some((key) => env[key] === undefined)) {
  let references
  try {
    references = parseEnv(readFileSync(referenceFile, 'utf8'))
  } catch {
    process.stderr.write(
      'Configure .env.production.1password with op:// references, or supply the required environment variables.\n',
    )
    process.exit(1)
  }
  for (const key of keys) {
    if (env[key] !== undefined) continue
    if (!references[key]?.startsWith('op://')) {
      process.stderr.write(`Missing 1Password reference for ${key}.\n`)
      process.exit(1)
    }
    env[key] = references[key]
  }
}

const useOp =
  !externallyConfigured && keys.some((key) => env[key]?.startsWith('op://'))
const child = spawn(
  useOp ? 'op' : command,
  useOp ? ['run', '--', command, ...args] : args,
  {
    env,
    stdio: 'inherit',
  },
)
// Forward terminal shutdown to the owned child so dev servers do not linger.
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => child.kill(signal))
}
child.on('error', () => {
  process.stderr.write(
    useOp
      ? 'Unable to run op. Install 1Password CLI and enable its desktop integration.\n'
      : 'Unable to start the requested command.\n',
  )
  process.exitCode = 1
})
child.on('exit', (code, signal) => {
  process.exitCode = code ?? (signal ? 128 + constants.signals[signal] : 1)
})

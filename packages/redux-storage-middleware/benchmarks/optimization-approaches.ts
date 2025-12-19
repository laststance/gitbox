/**
 * 10 Optimization Approaches for localStorage Performance
 *
 * This benchmark tests various strategies to maximize localStorage
 * read/write performance for Redux state persistence.
 *
 * Approaches tested:
 * 1. Native JSON (baseline)
 * 2. superjson (type preservation)
 * 3. LZ-string compression
 * 4. Selective slice persistence
 * 5. Debounced writes
 * 6. Throttled writes
 * 7. Differential updates
 * 8. Chunked storage
 * 9. Binary encoding (MessagePack-style)
 * 10. Lazy hydration
 */

import { generateState } from './benchmark'

// ============================================================================
// Types
// ============================================================================

interface OptimizationResult {
  approach: string
  writeMs: number
  readMs: number
  sizeBytes: number
  compressionRatio?: number
  notes: string
}

// ============================================================================
// Mock Storage (simulates localStorage behavior)
// ============================================================================

class MockStorage {
  private data = new Map<string, string>()

  setItem(key: string, value: string): void {
    this.data.set(key, value)
  }

  getItem(key: string): string | null {
    return this.data.get(key) ?? null
  }

  removeItem(key: string): void {
    this.data.delete(key)
  }

  clear(): void {
    this.data.clear()
  }

  get size(): number {
    let total = 0
    for (const [, value] of this.data) {
      total += value.length * 2 // UTF-16 encoding
    }
    return total
  }
}

// ============================================================================
// Optimization Approach Implementations
// ============================================================================

/**
 * Approach 1: Native JSON (Baseline)
 * Simple JSON.stringify/parse - the default approach
 */
function approach1_NativeJson(
  state: Record<string, unknown>,
  storage: MockStorage,
): OptimizationResult {
  const key = 'native-json'

  // Write
  const writeStart = performance.now()
  const serialized = JSON.stringify(state)
  storage.setItem(key, serialized)
  const writeMs = performance.now() - writeStart

  // Read
  const readStart = performance.now()
  const data = storage.getItem(key)
  if (data) JSON.parse(data)
  const readMs = performance.now() - readStart

  return {
    approach: '1. Native JSON (baseline)',
    writeMs: Number(writeMs.toFixed(3)),
    readMs: Number(readMs.toFixed(3)),
    sizeBytes: serialized.length * 2,
    notes: 'Standard JSON - fast but no type preservation',
  }
}

/**
 * Approach 2: superjson-style (Type Preservation)
 * Preserves Date, Map, Set, BigInt, etc.
 */
function approach2_TypePreservation(
  state: Record<string, unknown>,
  storage: MockStorage,
): OptimizationResult {
  const key = 'type-preservation'

  // Simple type preservation wrapper
  const wrapWithTypes = (obj: unknown): unknown => {
    if (obj instanceof Date) {
      return { __type: 'Date', value: obj.toISOString() }
    }
    if (obj instanceof Map) {
      return { __type: 'Map', value: Array.from(obj.entries()) }
    }
    if (obj instanceof Set) {
      return { __type: 'Set', value: Array.from(obj) }
    }
    if (Array.isArray(obj)) {
      return obj.map(wrapWithTypes)
    }
    if (obj !== null && typeof obj === 'object') {
      const wrapped: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(obj)) {
        wrapped[k] = wrapWithTypes(v)
      }
      return wrapped
    }
    return obj
  }

  const unwrapTypes = (obj: unknown): unknown => {
    if (obj !== null && typeof obj === 'object' && !Array.isArray(obj)) {
      const typed = obj as Record<string, unknown>
      if (typed.__type === 'Date') return new Date(typed.value as string)
      if (typed.__type === 'Map')
        return new Map(typed.value as [unknown, unknown][])
      if (typed.__type === 'Set') return new Set(typed.value as unknown[])
      const unwrapped: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(typed)) {
        unwrapped[k] = unwrapTypes(v)
      }
      return unwrapped
    }
    if (Array.isArray(obj)) {
      return obj.map(unwrapTypes)
    }
    return obj
  }

  // Write
  const writeStart = performance.now()
  const wrapped = wrapWithTypes(state)
  const serialized = JSON.stringify(wrapped)
  storage.setItem(key, serialized)
  const writeMs = performance.now() - writeStart

  // Read
  const readStart = performance.now()
  const data = storage.getItem(key)
  if (data) {
    const parsed = JSON.parse(data)
    unwrapTypes(parsed)
  }
  const readMs = performance.now() - readStart

  return {
    approach: '2. Type Preservation (superjson-style)',
    writeMs: Number(writeMs.toFixed(3)),
    readMs: Number(readMs.toFixed(3)),
    sizeBytes: serialized.length * 2,
    notes: 'Preserves Date, Map, Set - slight overhead',
  }
}

/**
 * Approach 3: LZ-string Compression
 * Compresses JSON string before storing
 */
function approach3_Compression(
  state: Record<string, unknown>,
  storage: MockStorage,
): OptimizationResult {
  const key = 'compressed'

  // Simple RLE compression for benchmark (real impl would use lz-string)
  const compress = (str: string): string => {
    // Base64-like encoding for simulation
    return btoa(encodeURIComponent(str))
  }

  const decompress = (str: string): string => {
    return decodeURIComponent(atob(str))
  }

  const jsonStr = JSON.stringify(state)

  // Write
  const writeStart = performance.now()
  const compressed = compress(jsonStr)
  storage.setItem(key, compressed)
  const writeMs = performance.now() - writeStart

  // Read
  const readStart = performance.now()
  const data = storage.getItem(key)
  if (data) {
    const decompressed = decompress(data)
    JSON.parse(decompressed)
  }
  const readMs = performance.now() - readStart

  const compressionRatio = compressed.length / jsonStr.length

  return {
    approach: '3. Compression (Base64/LZ-style)',
    writeMs: Number(writeMs.toFixed(3)),
    readMs: Number(readMs.toFixed(3)),
    sizeBytes: compressed.length * 2,
    compressionRatio: Number(compressionRatio.toFixed(2)),
    notes: `${((1 - compressionRatio) * 100).toFixed(0)}% smaller - CPU tradeoff`,
  }
}

/**
 * Approach 4: Selective Slice Persistence
 * Only persist specified slices, not entire state
 */
function approach4_SelectiveSlices(
  state: Record<string, unknown>,
  storage: MockStorage,
): OptimizationResult {
  const key = 'selective'
  const slicesToPersist = ['emails'] // Only persist emails, not settings/user

  // Write
  const writeStart = performance.now()
  const partial: Record<string, unknown> = {}
  for (const slice of slicesToPersist) {
    partial[slice] = state[slice]
  }
  const serialized = JSON.stringify(partial)
  storage.setItem(key, serialized)
  const writeMs = performance.now() - writeStart

  // Read
  const readStart = performance.now()
  const data = storage.getItem(key)
  if (data) JSON.parse(data)
  const readMs = performance.now() - readStart

  const fullSize = JSON.stringify(state).length * 2

  return {
    approach: '4. Selective Slices',
    writeMs: Number(writeMs.toFixed(3)),
    readMs: Number(readMs.toFixed(3)),
    sizeBytes: serialized.length * 2,
    compressionRatio: Number(((serialized.length * 2) / fullSize).toFixed(2)),
    notes: 'Only persist critical slices',
  }
}

/**
 * Approach 5: Debounced Writes
 * Batch multiple writes into one
 */
function approach5_Debounced(
  state: Record<string, unknown>,
  storage: MockStorage,
): OptimizationResult {
  const key = 'debounced'
  let pendingWrite: string | null = null
  let writeCount = 0

  // Simulate debounce effect
  const debouncedWrite = (data: string): void => {
    pendingWrite = data // Only keep latest
    writeCount++
  }

  const flush = (): void => {
    if (pendingWrite) {
      storage.setItem(key, pendingWrite)
      pendingWrite = null
    }
  }

  // Simulate 10 rapid state changes
  const writeStart = performance.now()
  for (let i = 0; i < 10; i++) {
    const modified = { ...state, counter: i }
    debouncedWrite(JSON.stringify(modified))
  }
  flush() // Only one actual write
  const writeMs = performance.now() - writeStart

  // Read
  const readStart = performance.now()
  const data = storage.getItem(key)
  if (data) JSON.parse(data)
  const readMs = performance.now() - readStart

  return {
    approach: '5. Debounced Writes',
    writeMs: Number(writeMs.toFixed(3)),
    readMs: Number(readMs.toFixed(3)),
    sizeBytes: storage.getItem(key)?.length ?? 0 * 2,
    notes: `10 changes → 1 write (${writeCount} batched)`,
  }
}

/**
 * Approach 6: Throttled Writes
 * Max one write per time window
 */
function approach6_Throttled(
  state: Record<string, unknown>,
  storage: MockStorage,
): OptimizationResult {
  const key = 'throttled'

  // Simulate throttle - write first, skip rest
  let lastWrite = 0
  let actualWrites = 0
  const throttleMs = 100

  const throttledWrite = (data: string): void => {
    const now = performance.now()
    if (now - lastWrite >= throttleMs || lastWrite === 0) {
      storage.setItem(key, data)
      lastWrite = now
      actualWrites++
    }
  }

  // Simulate 5 rapid changes (all within throttle window)
  const writeStart = performance.now()
  for (let i = 0; i < 5; i++) {
    const modified = { ...state, counter: i }
    throttledWrite(JSON.stringify(modified))
  }
  const writeMs = performance.now() - writeStart

  // Read
  const readStart = performance.now()
  const data = storage.getItem(key)
  if (data) JSON.parse(data)
  const readMs = performance.now() - readStart

  return {
    approach: '6. Throttled Writes',
    writeMs: Number(writeMs.toFixed(3)),
    readMs: Number(readMs.toFixed(3)),
    sizeBytes: storage.getItem(key)?.length ?? 0 * 2,
    notes: `5 changes → ${actualWrites} write(s)`,
  }
}

/**
 * Approach 7: Differential Updates
 * Only store what changed
 */
function approach7_Differential(
  state: Record<string, unknown>,
  storage: MockStorage,
): OptimizationResult {
  const key = 'differential'

  // Store initial state
  const prevState = state
  storage.setItem(key, JSON.stringify(state))

  // Create modified state
  const modifiedState = {
    ...state,
    settings: { ...(state.settings as Record<string, unknown>), theme: 'dark' },
  }

  // Calculate diff (simplified)
  const getDiff = (
    prev: Record<string, unknown>,
    next: Record<string, unknown>,
  ): Record<string, unknown> => {
    const diff: Record<string, unknown> = {}
    for (const key of Object.keys(next)) {
      if (JSON.stringify(prev[key]) !== JSON.stringify(next[key])) {
        diff[key] = next[key]
      }
    }
    return diff
  }

  // Write diff only
  const writeStart = performance.now()
  const diff = getDiff(prevState, modifiedState)
  const diffStr = JSON.stringify(diff)
  storage.setItem(`${key}-diff`, diffStr)
  const writeMs = performance.now() - writeStart

  // Read and merge
  const readStart = performance.now()
  const baseData = storage.getItem(key)
  const diffData = storage.getItem(`${key}-diff`)
  if (baseData && diffData) {
    const base = JSON.parse(baseData)
    const changes = JSON.parse(diffData)
    Object.assign(base, changes)
  }
  const readMs = performance.now() - readStart

  const fullSize = JSON.stringify(modifiedState).length

  return {
    approach: '7. Differential Updates',
    writeMs: Number(writeMs.toFixed(3)),
    readMs: Number(readMs.toFixed(3)),
    sizeBytes: diffStr.length * 2,
    compressionRatio: Number((diffStr.length / fullSize).toFixed(2)),
    notes: 'Only stores changed portions',
  }
}

/**
 * Approach 8: Chunked Storage
 * Split large state across multiple keys
 */
function approach8_Chunked(
  state: Record<string, unknown>,
  storage: MockStorage,
): OptimizationResult {
  const keyPrefix = 'chunked'
  const chunkSize = 50000 // 50KB per chunk

  // Write in chunks
  const writeStart = performance.now()
  const serialized = JSON.stringify(state)
  const chunks: string[] = []
  for (let i = 0; i < serialized.length; i += chunkSize) {
    chunks.push(serialized.slice(i, i + chunkSize))
  }
  storage.setItem(
    `${keyPrefix}-meta`,
    JSON.stringify({ chunkCount: chunks.length }),
  )
  chunks.forEach((chunk, i) => {
    storage.setItem(`${keyPrefix}-${i}`, chunk)
  })
  const writeMs = performance.now() - writeStart

  // Read and reassemble
  const readStart = performance.now()
  const meta = storage.getItem(`${keyPrefix}-meta`)
  if (meta) {
    const { chunkCount } = JSON.parse(meta)
    let assembled = ''
    for (let i = 0; i < chunkCount; i++) {
      assembled += storage.getItem(`${keyPrefix}-${i}`) ?? ''
    }
    JSON.parse(assembled)
  }
  const readMs = performance.now() - readStart

  return {
    approach: '8. Chunked Storage',
    writeMs: Number(writeMs.toFixed(3)),
    readMs: Number(readMs.toFixed(3)),
    sizeBytes: serialized.length * 2,
    notes: `Split into ${chunks.length} chunk(s)`,
  }
}

/**
 * Approach 9: Minimal Serialization
 * Strip unnecessary whitespace and use short keys
 */
function approach9_Minimal(
  state: Record<string, unknown>,
  storage: MockStorage,
): OptimizationResult {
  const key = 'minimal'

  // Key mapping for compression
  const keyMap: Record<string, string> = {
    emails: 'e',
    settings: 's',
    user: 'u',
    selectedId: 'si',
    searchQuery: 'sq',
    currentLabel: 'cl',
    isLoading: 'il',
    lastSyncTime: 'ls',
    subject: 'sb',
    body: 'bd',
    preview: 'pv',
    timestamp: 'ts',
    starred: 'st',
    labels: 'lb',
    hasAttachment: 'ha',
  }

  const minify = (obj: unknown): unknown => {
    if (Array.isArray(obj)) {
      return obj.map(minify)
    }
    if (obj !== null && typeof obj === 'object') {
      const minified: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(obj)) {
        const newKey = keyMap[k] ?? k
        minified[newKey] = minify(v)
      }
      return minified
    }
    return obj
  }

  // Write
  const writeStart = performance.now()
  const minified = minify(state)
  const serialized = JSON.stringify(minified)
  storage.setItem(key, serialized)
  const writeMs = performance.now() - writeStart

  // Read (would need reverse mapping in real impl)
  const readStart = performance.now()
  const data = storage.getItem(key)
  if (data) JSON.parse(data)
  const readMs = performance.now() - readStart

  const fullSize = JSON.stringify(state).length

  return {
    approach: '9. Minimal Serialization',
    writeMs: Number(writeMs.toFixed(3)),
    readMs: Number(readMs.toFixed(3)),
    sizeBytes: serialized.length * 2,
    compressionRatio: Number((serialized.length / fullSize).toFixed(2)),
    notes: `${((1 - serialized.length / fullSize) * 100).toFixed(0)}% smaller with short keys`,
  }
}

/**
 * Approach 10: Lazy Hydration
 * Store metadata separately, load full data on demand
 */
function approach10_LazyHydration(
  state: Record<string, unknown>,
  storage: MockStorage,
): OptimizationResult {
  const key = 'lazy'

  // Write metadata first, full data second
  const writeStart = performance.now()
  const emails = (state.emails as Record<string, unknown>).emails as unknown[]
  const metadata = {
    emailCount: emails.length,
    lastSync: (state.emails as Record<string, unknown>).lastSyncTime,
    hasData: true,
  }
  storage.setItem(`${key}-meta`, JSON.stringify(metadata))
  storage.setItem(`${key}-full`, JSON.stringify(state))
  const writeMs = performance.now() - writeStart

  // Read metadata only (fast)
  const readStart = performance.now()
  const metaData = storage.getItem(`${key}-meta`)
  if (metaData) JSON.parse(metaData)
  // Full data loaded lazily when needed
  const readMs = performance.now() - readStart

  // Full read time for comparison
  const fullReadStart = performance.now()
  const fullData = storage.getItem(`${key}-full`)
  if (fullData) JSON.parse(fullData)
  const fullReadMs = performance.now() - fullReadStart

  return {
    approach: '10. Lazy Hydration',
    writeMs: Number(writeMs.toFixed(3)),
    readMs: Number(readMs.toFixed(3)),
    sizeBytes: (storage.getItem(`${key}-meta`)?.length ?? 0) * 2,
    notes: `Meta: ${readMs.toFixed(2)}ms, Full: ${fullReadMs.toFixed(2)}ms`,
  }
}

// ============================================================================
// Main Runner
// ============================================================================

/**
 * Run all optimization approach benchmarks
 *
 * @param emailCount - Number of emails to test with
 * @returns Array of optimization results
 */
export function runOptimizationBenchmarks(
  emailCount: number = 1000,
): OptimizationResult[] {
  console.log(
    '\n╔══════════════════════════════════════════════════════════════╗',
  )
  console.log(
    '║     10 localStorage Optimization Approaches Benchmark        ║',
  )
  console.log(
    '╚══════════════════════════════════════════════════════════════╝',
  )
  console.log(`\nTesting with ${emailCount} emails...\n`)

  const state = generateState(emailCount)
  const storage = new MockStorage()

  const results: OptimizationResult[] = [
    approach1_NativeJson(state, storage),
    approach2_TypePreservation(state, storage),
    approach3_Compression(state, storage),
    approach4_SelectiveSlices(state, storage),
    approach5_Debounced(state, storage),
    approach6_Throttled(state, storage),
    approach7_Differential(state, storage),
    approach8_Chunked(state, storage),
    approach9_Minimal(state, storage),
    approach10_LazyHydration(state, storage),
  ]

  // Output results table
  console.log('─'.repeat(80))
  console.log(
    '| Approach'.padEnd(38) +
      '| Write(ms)'.padEnd(12) +
      '| Read(ms)'.padEnd(11) +
      '| Size(KB)'.padEnd(10) +
      '|',
  )
  console.log('─'.repeat(80))

  for (const result of results) {
    const approach = result.approach.substring(0, 35).padEnd(36)
    const write = result.writeMs.toFixed(3).padEnd(10)
    const read = result.readMs.toFixed(3).padEnd(9)
    const size = ((result.sizeBytes || 0) / 1024).toFixed(1).padEnd(8)

    console.log(`| ${approach} | ${write} | ${read} | ${size} |`)
  }

  console.log('─'.repeat(80))

  // Summary
  console.log('\n📋 Notes:')
  for (const result of results) {
    console.log(`  ${result.approach.split('.')[0]}. ${result.notes}`)
  }

  return results
}

// Export for use in tests
export { OptimizationResult }

// Run benchmarks when executed directly
runOptimizationBenchmarks(1000)

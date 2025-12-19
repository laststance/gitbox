/**
 * Redux Storage Middleware - OSS-Style Benchmark Suite
 *
 * Performance benchmarking following patterns from:
 * - immer (immutable state)
 * - superjson (serialization)
 * - lz-string (compression)
 *
 * Measures:
 * 1. JSON serialize/deserialize performance
 * 2. localStorage read/write throughput
 * 3. State extraction (slice selection)
 * 4. Various optimization approaches
 */

interface BenchmarkResult {
  name: string
  ops: number
  avgMs: number
  minMs: number
  maxMs: number
  memoryMB?: number
}

interface BenchmarkSuite {
  name: string
  results: BenchmarkResult[]
}

/**
 * High-resolution timer for accurate benchmarking
 */
function now(): number {
  if (typeof performance !== 'undefined') {
    return performance.now()
  }
  return Date.now()
}

/**
 * Run a benchmark function multiple times and collect metrics
 *
 * @param name - Benchmark name
 * @param fn - Function to benchmark
 * @param iterations - Number of iterations
 * @returns Benchmark result with timing statistics
 */
function benchmark(
  name: string,
  fn: () => void,
  iterations: number = 1000,
): BenchmarkResult {
  const times: number[] = []

  // Warmup
  for (let i = 0; i < 10; i++) {
    fn()
  }

  // Actual benchmark
  for (let i = 0; i < iterations; i++) {
    const start = now()
    fn()
    const end = now()
    times.push(end - start)
  }

  const avgMs = times.reduce((a, b) => a + b, 0) / times.length
  const minMs = Math.min(...times)
  const maxMs = Math.max(...times)

  return {
    name,
    ops: Math.round(1000 / avgMs),
    avgMs: Number(avgMs.toFixed(4)),
    minMs: Number(minMs.toFixed(4)),
    maxMs: Number(maxMs.toFixed(4)),
  }
}

/**
 * Generate mock email data for benchmarking
 *
 * @param count - Number of emails to generate
 * @returns Array of mock email objects
 */
function generateEmails(count: number): Record<string, unknown>[] {
  const emails = []
  for (let i = 0; i < count; i++) {
    emails.push({
      id: `email-${i.toString().padStart(6, '0')}`,
      from: `user${i % 100}@example.com`,
      to: 'me@gmail.com',
      subject: `Test Subject #${i} - Important Discussion Topic`,
      body: `This is the body of email ${i}. It contains some text that represents typical email content. Lorem ipsum dolor sit amet, consectetur adipiscing elit.`,
      preview: `This is the body of email ${i}. It contains some text...`,
      timestamp: new Date(Date.now() - i * 3600000).toISOString(),
      read: Math.random() > 0.3,
      starred: Math.random() > 0.8,
      labels: ['inbox', i % 2 === 0 ? 'work' : 'personal'],
      hasAttachment: Math.random() > 0.7,
    })
  }
  return emails
}

/**
 * Generate mock Redux state for benchmarking
 *
 * @param emailCount - Number of emails to include
 * @returns Mock Redux state object
 */
function generateState(emailCount: number): Record<string, unknown> {
  return {
    emails: {
      emails: generateEmails(emailCount),
      selectedId: null,
      searchQuery: '',
      currentLabel: 'inbox',
      isLoading: false,
      lastSyncTime: new Date().toISOString(),
    },
    settings: {
      theme: 'light',
      language: 'en',
      notifications: true,
    },
    user: {
      id: 'user-123',
      name: 'Test User',
      email: 'test@example.com',
    },
  }
}

// ============================================================================
// Benchmark Suites
// ============================================================================

/**
 * JSON Serialization Benchmarks
 * Tests JSON.stringify and JSON.parse performance at various data sizes
 */
export function benchmarkJsonSerialization(): BenchmarkSuite {
  const results: BenchmarkResult[] = []

  const sizes = [100, 500, 1000, 5000]

  for (const size of sizes) {
    const state = generateState(size)

    // Stringify benchmark
    results.push(
      benchmark(`JSON.stringify (${size} emails)`, () => {
        JSON.stringify(state)
      }),
    )

    // Parse benchmark
    const serialized = JSON.stringify(state)
    results.push(
      benchmark(`JSON.parse (${size} emails)`, () => {
        JSON.parse(serialized)
      }),
    )
  }

  return { name: 'JSON Serialization', results }
}

/**
 * State Extraction Benchmarks
 * Tests performance of extracting specific slices from state
 */
export function benchmarkStateExtraction(): BenchmarkSuite {
  const results: BenchmarkResult[] = []

  const state = generateState(1000)
  const slices = ['emails', 'settings']

  // Full state copy
  results.push(
    benchmark('Full state deep clone', () => {
      JSON.parse(JSON.stringify(state))
    }),
  )

  // Slice extraction
  results.push(
    benchmark('Slice extraction (2 slices)', () => {
      const extracted: Record<string, unknown> = {}
      for (const slice of slices) {
        extracted[slice] = (state as Record<string, unknown>)[slice]
      }
    }),
  )

  // Shallow copy
  results.push(
    benchmark('Shallow copy with spread', () => {
      const copy = { ...state }
      return copy
    }),
  )

  return { name: 'State Extraction', results }
}

/**
 * localStorage Simulation Benchmarks
 * Tests read/write performance with in-memory Map (simulating localStorage)
 */
export function benchmarkStorageOperations(): BenchmarkSuite {
  const results: BenchmarkResult[] = []

  // Simulate localStorage with Map
  const storage = new Map<string, string>()

  const sizes = [100, 500, 1000, 5000]

  for (const size of sizes) {
    const state = generateState(size)
    const serialized = JSON.stringify(state)
    const key = `test-state-${size}`

    // Write benchmark
    results.push(
      benchmark(`Storage write (${size} emails)`, () => {
        storage.set(key, serialized)
      }),
    )

    // Read benchmark
    storage.set(key, serialized)
    results.push(
      benchmark(`Storage read (${size} emails)`, () => {
        storage.get(key)
      }),
    )

    // Full round-trip (serialize + write + read + parse)
    results.push(
      benchmark(`Full round-trip (${size} emails)`, () => {
        const s = JSON.stringify(state)
        storage.set(key, s)
        const data = storage.get(key)
        if (data) JSON.parse(data)
      }),
    )
  }

  return { name: 'Storage Operations', results }
}

/**
 * Debounce Overhead Benchmarks
 * Tests debounce function performance
 */
export function benchmarkDebounce(): BenchmarkSuite {
  const results: BenchmarkResult[] = []

  let _callCount = 0
  const fn = () => {
    _callCount++
  }

  // Simple debounce implementation for benchmarking
  function debounce<T extends (...args: unknown[]) => void>(
    func: T,
    wait: number,
  ): T {
    let timeout: ReturnType<typeof setTimeout> | null = null
    return ((...args: unknown[]) => {
      if (timeout) clearTimeout(timeout)
      timeout = setTimeout(() => func(...args), wait)
    }) as T
  }

  const debouncedFn = debounce(fn, 100)

  // Debounced call overhead
  results.push(
    benchmark(
      'Debounce call overhead',
      () => {
        debouncedFn()
      },
      10000,
    ),
  )

  // Direct call comparison
  results.push(
    benchmark(
      'Direct function call',
      () => {
        fn()
      },
      10000,
    ),
  )

  return { name: 'Debounce Performance', results }
}

/**
 * Memory Usage Estimation
 * Calculates approximate memory usage for different state sizes
 */
export function benchmarkMemoryUsage(): BenchmarkSuite {
  const results: BenchmarkResult[] = []

  const sizes = [100, 500, 1000, 5000, 10000]

  for (const size of sizes) {
    const state = generateState(size)
    const serialized = JSON.stringify(state)
    const sizeKB = new Blob([serialized]).size / 1024
    const sizeMB = sizeKB / 1024

    results.push({
      name: `${size} emails`,
      ops: size,
      avgMs: sizeKB,
      minMs: sizeMB,
      maxMs: serialized.length,
      memoryMB: sizeMB,
    })
  }

  return { name: 'Memory Usage (KB)', results }
}

// ============================================================================
// Benchmark Runner
// ============================================================================

/**
 * Run all benchmarks and output results
 */
export function runAllBenchmarks(): void {
  console.log(
    '╔══════════════════════════════════════════════════════════════╗',
  )
  console.log(
    '║     Redux Storage Middleware - Performance Benchmark Suite    ║',
  )
  console.log(
    '╚══════════════════════════════════════════════════════════════╝',
  )
  console.log('')

  const suites: BenchmarkSuite[] = [
    benchmarkJsonSerialization(),
    benchmarkStateExtraction(),
    benchmarkStorageOperations(),
    benchmarkDebounce(),
    benchmarkMemoryUsage(),
  ]

  for (const suite of suites) {
    console.log(`\n📊 ${suite.name}`)
    console.log('─'.repeat(60))
    console.log(
      '| Name'.padEnd(35) +
        '| Ops/s'.padEnd(10) +
        '| Avg (ms)'.padEnd(12) +
        '| Min/Max |',
    )
    console.log('─'.repeat(60))

    for (const result of suite.results) {
      const name = result.name.substring(0, 32).padEnd(33)
      const ops = result.ops.toString().padEnd(8)
      const avg = result.avgMs.toFixed(3).padEnd(10)
      const range = `${result.minMs.toFixed(2)}/${result.maxMs.toFixed(2)}`

      console.log(`| ${name} | ${ops} | ${avg} | ${range}`)
    }
  }

  console.log('\n' + '═'.repeat(60))
  console.log('Benchmark complete!')
}

// Run if executed directly
if (typeof require !== 'undefined' && require.main === module) {
  runAllBenchmarks()
}

export { generateState, generateEmails, benchmark }

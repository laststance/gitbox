/**
 * Holds browser requests until the mock worker can answer them.
 *
 * {@link MSWProvider} used to withhold the page so nothing was sent before
 * the worker started. The server then sent "Initializing MSW..." and React
 * hydrated that placeholder, so a browser test could not see a hydration
 * error. The page is rendered on both sides now. This gate is installed
 * synchronously from `src/instrumentation-client.ts` before hydration, and
 * it lets the requests through when `worker.start()` settles.
 *
 * A Next.js chunk (`/_next/`) and the worker script are not held: the
 * dynamic import of the worker waits on a chunk, and holding that chunk
 * would wait on the worker.
 *
 * @param workerReady - Resolves when the worker is answering, or when
 *   starting it failed and requests may leave. The caller settles it either
 *   way; a promise that stays pending holds the requests.
 *
 * @example
 * ```ts
 * let openGate: () => void = () => {}
 * const ready = new Promise<void>((resolve) => {
 *   openGate = resolve
 * })
 * holdBrowserRequestsUntil(ready)
 * void worker.start({ onUnhandledFrame: 'bypass' }).finally(openGate)
 * ```
 */
export function holdBrowserRequestsUntil(workerReady: Promise<void>): void {
  if (typeof window === 'undefined') return

  const originalFetch = window.fetch.bind(window)
  const originalOpen = XMLHttpRequest.prototype.open
  const originalSend = XMLHttpRequest.prototype.send
  const heldRequests = new WeakMap<XMLHttpRequest, boolean>()
  const queuedSends: Array<() => void> = []
  let released = false

  // A request that loads the worker itself has to leave, or the worker
  // never starts and every other request waits.
  const shouldHold = (url: string): boolean =>
    !url.includes('/_next/') && !url.includes('mockServiceWorker')

  const release = (): void => {
    if (released) return
    released = true
    const waiting = queuedSends.splice(0, queuedSends.length)
    for (const sendNow of waiting) sendNow()
  }

  // Settle either way: a failed start still lets the page run, as the
  // provider did when the worker could not be installed.
  void workerReady.then(release, release)

  window.fetch = async (
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> => {
    const url = requestUrl(input)
    if (released || !shouldHold(url)) return originalFetch(input, init)
    // A failed start still sends the request. The gate opens on that failure
    // too, and the page would otherwise hang on the rejection.
    await workerReady.then(
      () => undefined,
      () => undefined,
    )
    return originalFetch(input, init)
  }

  XMLHttpRequest.prototype.open = function open(
    this: XMLHttpRequest,
    method: string,
    url: string | URL,
    async?: boolean,
    username?: string | null,
    password?: string | null,
  ): void {
    // A synchronous request cannot be queued: send() has to finish it.
    const canWait = async !== false
    heldRequests.set(this, canWait && shouldHold(String(url)))
    originalOpen.call(this, method, url, async ?? true, username, password)
  }

  XMLHttpRequest.prototype.send = function send(
    this: XMLHttpRequest,
    body?: Document | XMLHttpRequestBodyInit | null,
  ): void {
    if (released || heldRequests.get(this) !== true) {
      originalSend.call(this, body)
      return
    }
    queuedSends.push(() => {
      originalSend.call(this, body)
    })
  }
}

/** The URL a fetch call is about to send, as a string the gate can read. */
function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input
  if (input instanceof URL) return input.href
  return input.url
}

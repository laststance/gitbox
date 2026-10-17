/**
 * Unit tests: browser requests wait until the mock worker can answer them.
 *
 * The page is in the server HTML, so a fetch or an XMLHttpRequest that a
 * component sends while the worker is still starting has to wait. A Next.js
 * chunk must not wait, or the worker's own script never arrives.
 */

import { afterEach, describe, expect, test } from 'vitest'

import { holdBrowserRequestsUntil } from '@/lib/utils/hold-browser-requests-until-msw'

const nativeFetch = window.fetch.bind(window)
const nativeOpen = XMLHttpRequest.prototype.open
const nativeSend = XMLHttpRequest.prototype.send

afterEach(() => {
  window.fetch = nativeFetch
  XMLHttpRequest.prototype.open = nativeOpen
  XMLHttpRequest.prototype.send = nativeSend
})

describe('requests wait for the mock worker', () => {
  test('a page request waits until the worker can answer it', async () => {
    // Arrange
    const calls: string[] = []
    window.fetch = async (input) => {
      calls.push(String(input))
      return new Response(null, { status: 200 })
    }
    let openGate: () => void = () => {}
    const workerReady = new Promise<void>((resolve) => {
      openGate = resolve
    })
    holdBrowserRequestsUntil(workerReady)

    // Act
    const pending = window.fetch('/api/boards')
    await new Promise((resolve) => setTimeout(resolve, 0))

    // Assert
    expect(calls).toEqual([])
    openGate()
    await pending
    expect(calls).toEqual(['/api/boards'])
  })

  test('a Next.js chunk loads while the worker is still starting', async () => {
    // Arrange
    const calls: string[] = []
    window.fetch = async (input) => {
      calls.push(String(input))
      return new Response(null, { status: 200 })
    }
    let openGate: () => void = () => {}
    const workerReady = new Promise<void>((resolve) => {
      openGate = resolve
    })
    holdBrowserRequestsUntil(workerReady)

    // Act
    await window.fetch('/_next/static/chunks/app.js')

    // Assert
    expect(calls).toEqual(['/_next/static/chunks/app.js'])
    openGate()
  })

  test('an XMLHttpRequest waits until the worker can answer it', async () => {
    // Arrange
    const sent: string[] = []
    XMLHttpRequest.prototype.send = function send(): void {
      sent.push('sent')
    }
    let openGate: () => void = () => {}
    const workerReady = new Promise<void>((resolve) => {
      openGate = resolve
    })
    holdBrowserRequestsUntil(workerReady)
    const request = new XMLHttpRequest()
    request.open('GET', '/api/boards')

    // Act
    request.send()

    // Assert
    expect(sent).toEqual([])
    openGate()
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(sent).toEqual(['sent'])
  })

  test('a synchronous XMLHttpRequest is sent while the worker is still starting', () => {
    // Arrange
    const sent: string[] = []
    XMLHttpRequest.prototype.send = function send(): void {
      sent.push('sent')
    }
    let openGate: () => void = () => {}
    const workerReady = new Promise<void>((resolve) => {
      openGate = resolve
    })
    holdBrowserRequestsUntil(workerReady)
    const request = new XMLHttpRequest()
    request.open('GET', '/api/boards', false)

    // Act
    request.send()

    // Assert
    expect(sent).toEqual(['sent'])
    openGate()
  })
})

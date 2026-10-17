/**
 * Unit tests: browser requests wait until the mock worker can answer them.
 *
 * The page is in the server HTML, so a GitHub call that a component sends
 * while the worker is still starting has to wait. A same-origin call must
 * not wait, or the page is on screen before a press can reach a button.
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
  test('a GitHub request waits until the worker can answer it', async () => {
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
    const pending = window.fetch('https://api.github.com/user')
    await new Promise((resolve) => setTimeout(resolve, 0))

    // Assert
    expect(calls).toEqual([])
    openGate()
    await pending
    expect(calls).toEqual(['https://api.github.com/user'])
  })

  test('a same-origin request leaves while the worker is still starting', async () => {
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
    await window.fetch('/api/boards')

    // Assert
    expect(calls).toEqual(['/api/boards'])
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
    request.open('GET', 'https://api.github.com/user')

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
    request.open('GET', 'https://api.github.com/user', false)

    // Act
    request.send()

    // Assert
    expect(sent).toEqual(['sent'])
    openGate()
  })
})

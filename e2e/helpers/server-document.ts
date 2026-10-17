import { expect, type Page } from '@playwright/test'

/**
 * Reads the document the server sent, before the browser runs it.
 *
 * The hydration specs call this so a run whose HTML is only the mock-worker
 * placeholder fails here, instead of hydrating that placeholder and passing.
 *
 * @param page - The Playwright page whose cookies the request reuses.
 * @param path - Path of the page, resolved against the test base URL.
 * @param marker - Text the server renders on that page.
 */
export async function expectServerDocumentHolds(
  page: Page,
  path: string,
  marker: string,
): Promise<void> {
  const response = await page.request.get(path)
  expect(response.ok()).toBe(true)
  const html = await response.text()
  expect(html).not.toContain('Initializing MSW...')
  expect(html).toContain(marker)
}

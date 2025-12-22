/**
 * MSW (Mock Service Worker) request handlers for Storybook
 *
 * @description Defines mock API handlers for use in Storybook stories.
 * Add handlers here to mock network requests during component development.
 *
 * @example
 * import { http, HttpResponse } from 'msw'
 *
 * export const handlers = [
 *   http.get('/api/user', () => {
 *     return HttpResponse.json({ id: '1', name: 'John Doe' })
 *   }),
 * ]
 *
 * @see https://mswjs.io/docs/concepts/request-handler
 */
import type { HttpHandler } from 'msw'

/**
 * Array of MSW request handlers
 * @returns Empty array - add handlers as needed for story mocking
 */
export const handlers: HttpHandler[] = []

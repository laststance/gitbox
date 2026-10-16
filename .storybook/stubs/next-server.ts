/**
 * Preview stand-in for `next/server`.
 *
 * Storybook bundles a `'use server'` module into the browser. The real
 * `next/server` reads `__dirname` while that bundle loads, so
 * {@link getUserRepoPlacements} never imports and the board stories fail
 * before a test runs. `.storybook/main.ts` sends the specifier here.
 * The task is not run: a story that opens the picker calls the action, and
 * the backfill is a GitHub request the preview cannot make. The Next.js
 * server still calls the real `after`.
 */

type AfterTask<T = unknown> = Promise<T> | (() => T | Promise<T>)

/**
 * Accepts the callback {@link getUserRepoPlacements} schedules, and does
 * nothing with it.
 *
 * Called when the preview evaluates that server action. Running the task
 * would ask GitHub to confirm repository ids from the browser.
 *
 * @param task - Work the server would run after the response. Ignored here.
 */
export function after<T>(task: AfterTask<T>): void {
  void task
}

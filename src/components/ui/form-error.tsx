'use client'

import { memo } from 'react'

/**
 * Destructive inline error under a form field.
 *
 * One class and `role="alert"` for every refused write. Unconfirmed /
 * unknown-outcome copy stays `text-warning` and must not use this.
 *
 * Called by rename, create-link, board settings, column edit, URL items,
 * and Move to Another Board.
 *
 * @param message - The sentence to show. Empty or missing renders nothing.
 * @param id - Optional id for `aria-describedby` on the field that failed.
 * @param testId - Optional `data-testid`.
 *
 * @example
 * ```ts
 * <FormError message={error} />
 * ```
 */
export const FormError = memo(function FormError({
  message,
  id,
  testId,
}: {
  message?: string | null
  /** For `aria-describedby` on the field that failed. */
  id?: string
  testId?: string
}) {
  if (!message) {
    return null
  }

  return (
    <p
      id={id}
      role="alert"
      className="text-destructive text-sm"
      data-testid={testId}
    >
      {message}
    </p>
  )
})

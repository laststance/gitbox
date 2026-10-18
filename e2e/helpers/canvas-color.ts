/**
 * Compare a painted CSS color to a token without parsing oklch / oklab.
 *
 * Chromium may report an element's `color` as `oklab(...)` and
 * `var(--link)` on a probe as `lab(...)`. Assigning `canvas.fillStyle`
 * can keep Color 4 notation instead of hex. Filling a 1×1 pixel and
 * reading `getImageData` is the color the canvas actually painted.
 *
 * The favorite-star test and the theme-link tests of
 * shipped-todo-coverage.spec.ts and login.spec.ts call this. A new
 * painted-vs-token check should too.
 */

import type { Locator } from '@playwright/test'

/** One pixel from `getImageData`, channels 0–255. */
export type CanvasRgba = readonly [number, number, number, number]

/**
 * Painted `color` of an element and a CSS color written on a probe, both
 * as the RGBA of a 1×1 canvas pixel.
 *
 * @param locator - Element whose computed `color` is read.
 * @param cssColor - Token or literal written on the probe, e.g. `var(--link)`.
 * @returns The two pixels. Compare with {@link sameRgba}.
 */
export async function rgbaOfPaintedAndCssColor(
  locator: Locator,
  cssColor: string,
): Promise<{ painted: CanvasRgba; token: CanvasRgba }> {
  return locator.evaluate((element, tokenColor) => {
    const canvas = document.createElement('canvas')
    canvas.width = 1
    canvas.height = 1
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (ctx === null) {
      throw new Error('2d canvas is missing')
    }
    const toRgba = (color: string): CanvasRgba => {
      ctx.clearRect(0, 0, 1, 1)
      ctx.fillStyle = color
      ctx.fillRect(0, 0, 1, 1)
      const pixel = ctx.getImageData(0, 0, 1, 1).data
      return [pixel[0] ?? 0, pixel[1] ?? 0, pixel[2] ?? 0, pixel[3] ?? 0]
    }
    const probe = document.createElement('span')
    probe.style.color = tokenColor
    document.body.appendChild(probe)
    const painted = toRgba(getComputedStyle(element).color)
    const token = toRgba(getComputedStyle(probe).color)
    probe.remove()
    return { painted, token }
  }, cssColor)
}

/**
 * Whether two canvas pixels are the same channel for channel.
 *
 * @param left - First pixel.
 * @param right - Second pixel.
 * @returns True when every channel matches.
 */
export function sameRgba(left: CanvasRgba, right: CanvasRgba): boolean {
  return (
    left[0] === right[0] &&
    left[1] === right[1] &&
    left[2] === right[2] &&
    left[3] === right[3]
  )
}

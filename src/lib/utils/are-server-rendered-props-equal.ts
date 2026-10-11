import { shallowEqual } from 'react-redux'

/**
 * Props comparison for `memo()` on a Client Component that a Server Component
 * renders directly. Exists because such a component is built anew, losing its
 * state and its children's, every time the server sends its element again
 * (`router.refresh()`, a Server Action that changes the page) when it is
 * wrapped in `memo()` without a comparison function.
 *
 * React keeps a fiber when the new element's type matches the fiber's type.
 * The element type that arrives from the server is a lazy reference, which
 * React resolves to the `memo` object. For `memo(fn)` without a comparison
 * function the fiber's type is the inner function, so the two never match.
 * With a comparison function the fiber's type is the `memo` object and they do.
 * The comparison itself is the default one: props equal by `Object.is`.
 *
 * Called by `memo()` in every Client Component that a Server Component
 * (a layout or a page) renders;
 * `src/tests/unit/server-rendered-client-components.test.ts` lists them and
 * fails for one that leaves it out.
 *
 * @see https://github.com/vercel/next.js/issues/44901
 * @param previousProps - Props of the last render.
 * @param nextProps - Props of the render that is about to happen.
 * @returns
 * - `true` when both have the same keys with `Object.is`-equal values: the render is skipped
 * - `false` otherwise: the component renders again, with its state kept
 * @example
 * export const ReduxProvider = memo(function ReduxProvider({ children }) {
 *   return <Provider store={store}>{children}</Provider>
 * }, areServerRenderedPropsEqual)
 */
export const areServerRenderedPropsEqual: (
  previousProps: object,
  nextProps: object,
) => boolean = shallowEqual

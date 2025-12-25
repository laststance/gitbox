---
trigger: model_decision
description: TypeScript Coding Rules
globs: **/*.ts, **/*.tsx
---

# TypeScript Coding Rules

These rules are automatically loaded when editing `.ts` and `.tsx` files.

## Type Safety Principles

- **Type-only fixes:** When fixing TypeScript errors, **do not alter runtime behavior**.

- **Fix scope:** Focus on fixing **TypeScript type errors** and improving typings; avoid refactors that change logic unless explicitly requested.

- **Reuse types:** Prefer importing / picking existing types over defining new ones.

```ts
// Prefer reusing existing shapes:
type User = ExistingModule.User
// or
type UserName = ExistingModule.User['name']
```

- Prefer **Indexed Access Types** to reuse original API types, e.g.:

```ts
export type ShowAppSettingResponse =
  operations['showAppSetting']['responses'][200]['content']['application/json']
```

- When adding or updating types, keep them **close to the source of truth** (API client, schema, or domain module) and avoid scattered duplicate definitions.

## Expressing Intent with Types

- Use types to express the **concrete shape** of return values.
  - Example: literal types like `'制限なし'` (meaning "no restriction") or template literal types like `` `${string}, ${string}` ``.

- Name types so that it is clear **what they represent**.
  - Example: `RestrictedIpDisplayText` (display text for restricted IPs).

## JSDoc Comment Guidelines

For functions, write JSDoc as follows:

- Use **`@param`** to explain each parameter.

- Use **`@returns`** to describe the possible return patterns, preferably as a bullet list.

- Always include **`@example`** with concrete input → output examples.

## Example

```ts
/**
 * Generates a display string.
 * @param items - The target list.
 * @returns
 * - When there are elements: a comma-separated string
 * - When empty or undefined: "なし"
 * @example
 * formatList(['A', 'B']) // => "A, B"
 * formatList([])         // => "なし"
 */
const formatList = (items: string[] | undefined): `${string}` | 'なし' => {
  if (items && items.length > 0) {
    return items.join(', ')
  }
  return 'なし'
}
```

## Key Goal (Mental Model)

In one sentence:

> The **inputs and outputs of each function** should be completely understandable just by reading the code.

To achieve this:

1. Make dependencies explicit via **arguments** (avoid relying on closures).

2. Use **types** to describe the exact form of return values.

3. Use **`@example`** to show concrete, realistic usage.

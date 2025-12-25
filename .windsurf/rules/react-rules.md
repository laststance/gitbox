---
trigger: model_decision
description: React Coding Rules
globs: **/*.tsx
---

# React Coding Rules

These rules are automatically loaded when editing `.tsx` or `.jsx` files.

## UI Component Reuse

- **Reuse existing UI components** from `/src/components/ui` (path depends on project). These are the primitives we can build with.
  - Create new components by orchestrating UI components if you can't find any existing that solves the problem
  - Ask the human how they want to proceed when there are missing components and designs

## Helper Function Design Principles

- Logic inside **React components** should be extracted into **pure functions outside the component** whenever possible.
- Functions should receive data **via arguments, not via closures**, to make dependencies explicit.
- Functions that are **only used within a single file** should **not** be exported.
- Place helper functions **below the component definition** (after `export default`).

---

# React 19+ New Features (MUST USE)

Actively use these modern patterns instead of legacy approaches.

## `<Activity>` Component (React 19.2+)

**Purpose**: Hide/show UI while preserving component state and DOM. Use instead of conditional rendering when state preservation is needed.

```tsx
// ❌ OLD: Loses state on toggle
{
  isVisible && <Sidebar />
}

// ✅ NEW: Preserves state, forms, scroll position
import { Activity } from 'react'

;<Activity mode={isVisible ? 'visible' : 'hidden'}>
  <Sidebar />
</Activity>
```

**Key behaviors**:

- `mode="hidden"`: Applies `display: none`, destroys Effects, defers updates
- `mode="visible"`: Restores state, re-creates Effects
- DOM remains in page (fast restoration)

**Use cases**:

```tsx
// Tab switching with state preservation
<Activity mode={activeTab === 'contact' ? 'visible' : 'hidden'}>
  <Contact />  {/* textarea values persist */}
</Activity>

// Pre-rendering hidden content (with Suspense)
<Activity mode="hidden">
  <SlowComponent />  {/* Pre-renders at lower priority */}
</Activity>

// Selective hydration (faster interactivity)
<Activity>  {/* Always visible, but hydrates independently */}
  <Comments />
</Activity>
```

**Caveats**:

- Media elements (`<video>`, `<audio>`) continue playing - add cleanup:

```tsx
useLayoutEffect(() => {
  const videoRef = ref.current
  return () => videoRef.pause() // Cleanup when hidden
}, [])
```

- Text-only children don't render when hidden (wrap in elements)

---

## `useEffectEvent` Hook (React 19.2+)

**Purpose**: Extract non-reactive logic from Effects. Avoids re-running Effects when non-critical deps change.

```tsx
import { useEffect, useEffectEvent } from 'react'

function ChatRoom({ roomId, theme }) {
  // ✅ Always reads latest theme without causing Effect to re-run
  const onConnected = useEffectEvent(() => {
    showNotification('Connected!', theme)
  })

  useEffect(() => {
    const conn = createConnection(roomId)
    conn.on('connected', onConnected)
    conn.connect()
    return () => conn.disconnect()
  }, [roomId]) // Only roomId triggers reconnect, not theme
}
```

**Rules**:

- Only call inside `useEffect`/`useLayoutEffect`/`useInsertionEffect`
- Never pass to other components/hooks
- Never add to dependency arrays

## `useOptimistic` Hook (React 19+)

**Purpose**: Show optimistic UI immediately while async action completes.

```tsx
import { useOptimistic } from 'react'

function LikeButton({ likes, onLike }: Props) {
  const [optimisticLikes, setOptimisticLikes] = useOptimistic(likes)

  const handleLike = async () => {
    setOptimisticLikes(optimisticLikes + 1) // Instant UI update
    await onLike() // Auto-reverts on error
  }

  return <button onClick={handleLike}>❤️ {optimisticLikes}</button>
}

// With reducer for complex updates
const [optimisticItems, addItem] = useOptimistic(
  items,
  (state, newItem: Item) => [...state, { ...newItem, pending: true }],
)
```

**Caveats**: Only works during async transitions. Auto-reverts to original state on error.

---

## `use` API (React 19+)

**Purpose**: Read promises/context in render. Works after early returns (unlike hooks).

```tsx
import { use, Suspense } from 'react'

// Reading promises
function Comments({
  commentsPromise,
}: {
  commentsPromise: Promise<Comment[]>
}) {
  const comments = use(commentsPromise)
  return comments.map((c) => <p key={c.id}>{c.text}</p>)
}

// Reading context conditionally (after early return!)
function Heading({ children }: { children?: React.ReactNode }) {
  if (!children) return null
  const theme = use(ThemeContext) // ✅ Works after early return
  return <h1 style={{ color: theme.color }}>{children}</h1>
}

// Usage with Suspense
;<Suspense fallback={<Loading />}>
  <Comments commentsPromise={fetchComments()} />
</Suspense>
```

---

## Form Actions (React 19+)

**Purpose**: Pass async functions directly to `<form action>`. Auto-handles pending state and form reset.

```tsx
// Form with Server Action
<form action={async (formData) => {
  'use server';
  await saveData(formData);
}}>
  <input name="email" type="email" />
  <SubmitButton />
</form>

// Button-level actions
<button formAction={deleteAction}>Delete</button>
```

**`useFormStatus`**: Read form state without prop drilling

```tsx
import { useFormStatus } from 'react-dom'

// ⚠️ MUST be called from a CHILD component of <form>, not the same component
function SubmitButton() {
  const { pending, data, method, action } = useFormStatus()
  return <button disabled={pending}>{pending ? 'Saving...' : 'Save'}</button>
}
```

---

## Modern React 19 Patterns

### `ref` as Prop (No forwardRef needed)

```tsx
// ❌ OLD
const Input = forwardRef((props, ref) => <input ref={ref} {...props} />)

// ✅ NEW
function Input({ ref, ...props }: { ref?: React.Ref<HTMLInputElement> }) {
  return <input ref={ref} {...props} />
}
```

### Ref Cleanup Functions

```tsx
<input
  ref={(node) => {
    // Setup
    return () => {
      // Cleanup on unmount
    }
  }}
/>
```

### Context as Provider (No `.Provider`)

```tsx
// ❌ OLD
<ThemeContext.Provider value="dark">{children}</ThemeContext.Provider>

// ✅ NEW
<ThemeContext value="dark">{children}</ThemeContext>
```

### Document Metadata (Auto-hoisted to `<head>`)

```tsx
function BlogPost({ post }: { post: Post }) {
  return (
    <article>
      <title>{post.title}</title>
      <meta name="description" content={post.excerpt} />
      <meta name="author" content={post.author} />
      <h1>{post.title}</h1>
      <p>{post.content}</p>
    </article>
  )
}
```

### Resource Preloading

```tsx
import {
  prefetchDNS,
  preconnect,
  preload,
  preloadModule,
  preinit,
  preinitModule,
} from 'react-dom'

function App() {
  // Scripts & Styles
  preinit('https://cdn.example.com/script.js', { as: 'script' })
  preload('https://cdn.example.com/font.woff2', { as: 'font' })

  // ESM Modules
  preloadModule('https://cdn.example.com/module.js')
  preinitModule('https://cdn.example.com/module.js')

  // DNS & Connection
  prefetchDNS('https://api.example.com')
  preconnect('https://cdn.example.com')

  return <Main />
}
```

---

## Example: Complete Modern Component

```tsx
import { Activity, useActionState, useOptimistic, use, Suspense } from 'react'

type Props = {
  commentsPromise: Promise<Comment[]>
  isExpanded: boolean
}

export default function CommentsSection({
  commentsPromise,
  isExpanded,
}: Props) {
  return (
    <Activity mode={isExpanded ? 'visible' : 'hidden'}>
      <Suspense fallback={<CommentsSkeleton />}>
        <CommentsList commentsPromise={commentsPromise} />
      </Suspense>
    </Activity>
  )
}

function CommentsList({
  commentsPromise,
}: {
  commentsPromise: Promise<Comment[]>
}) {
  const comments = use(commentsPromise)
  const [optimisticComments, addOptimistic] = useOptimistic(
    comments,
    (state, newComment: Comment) => [...state, newComment],
  )

  const [error, submitAction, isPending] = useActionState(
    async (prev: string | null, formData: FormData) => {
      const text = formData.get('text') as string
      addOptimistic({ id: Date.now(), text, pending: true })
      const result = await postComment(text)
      return result.error ?? null
    },
    null,
  )

  return (
    <>
      {optimisticComments.map((c) => (
        <Comment key={c.id} comment={c} />
      ))}
      <form action={submitAction}>
        <input name="text" placeholder="Add comment..." />
        <button disabled={isPending}>Post</button>
      </form>
      {error && <p className="error">{error}</p>}
    </>
  )
}
```

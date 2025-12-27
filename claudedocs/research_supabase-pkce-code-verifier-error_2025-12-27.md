# Supabase PKCE "Code Verifier Not Found" Error Research

**Date**: 2025-12-27
**Confidence Level**: High (90%)
**Sources**: Official Supabase Documentation, GitHub Issues, Stack Overflow, Community Discussions

---

## Executive Summary

The "PKCE code verifier not found in storage" error occurs when Supabase Auth cannot locate the code verifier that was stored when the authentication flow was initiated. This is a security feature of the PKCE (Proof Key for Code Exchange) flow, which requires both the auth code (from URL) and the code verifier (from storage) to complete the token exchange.

---

## 1. Root Causes

### 1.1 Different Browser/Device

The most common cause - the auth flow was started on one browser/device, but the callback is being processed on another.

**Example Scenario**:

- User clicks magic link in email client that uses a different browser
- User copies URL from one browser to another
- Email client pre-fetches the link (Outlook, Gmail preview)

### 1.2 Storage Was Cleared

- Browser storage (cookies/localStorage) was cleared between flow initiation and callback
- User cleared cookies manually
- Privacy extensions or browser settings cleared storage
- Session expired or was terminated

### 1.3 Incorrect Cookie Configuration (Most Common for SSR)

- Missing or incorrect `getAll`/`setAll` implementation in `@supabase/ssr`
- Using deprecated `get`/`set`/`remove` methods instead of `getAll`/`setAll`
- Cookies not being set on both request and response in middleware
- Cookie domain mismatch (e.g., `localhost` vs `127.0.0.1`)

### 1.4 Next.js Specific Issues

- Server Components cannot write cookies - must use middleware
- Route prefetching sends requests before cookies are processed
- Cookies not read before `exchangeCodeForSession` is called
- Missing middleware configuration

### 1.5 Storage Key Mismatch

- Inconsistent `storageKey` between client initialization
- Different storage key used for storing vs retrieving verifier
- Key format: `sb-{project-ref}-auth-token-code-verifier`

### 1.6 Race Conditions

- `signOut()` clearing storage before code exchange completes
- Multiple auth flows initiated simultaneously
- Hot reload in development clearing storage

---

## 2. Official Solutions (From Supabase Docs)

### 2.1 Use @supabase/ssr Package

The official package handles PKCE flow and cookie storage automatically.

```bash
npm install @supabase/supabase-js @supabase/ssr
```

### 2.2 Implement getAll/setAll (CRITICAL)

**Server Client (utils/supabase/server.ts)**:

```typescript
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            )
          } catch {
            // Called from Server Component - mutations not allowed
          }
        },
      },
    },
  )
}
```

### 2.3 Middleware Configuration (ESSENTIAL)

**middleware.ts**:

```typescript
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          // Set on request (for downstream server code)
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          )
          // Create new response with updated request
          supabaseResponse = NextResponse.next({ request })
          // Set on response (for browser)
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  // Refresh session - IMPORTANT: Don't skip this
  await supabase.auth.getUser()

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
```

### 2.4 Auth Callback Route Handler

**app/auth/callback/route.ts**:

```typescript
import { createClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  // Handle error
  return NextResponse.redirect(`${origin}/auth/error`)
}
```

---

## 3. Community Workarounds

### 3.1 Force Cookie Read Before Exchange

Reading cookies explicitly before `exchangeCodeForSession` ensures Next.js loads them:

```typescript
// In callback route
export async function GET(request: Request) {
  const cookieStore = await cookies()

  // Force read all cookies first
  cookieStore.getAll()

  const supabase = await createClient()
  // Now exchange will find the code verifier
  const { error } = await supabase.auth.exchangeCodeForSession(code)
}
```

### 3.2 Handle localhost vs 127.0.0.1 Mismatch

Ensure consistent URL usage in development:

```typescript
// In Supabase dashboard, set redirect URL to:
// http://localhost:3000/auth/callback
// NOT http://127.0.0.1:3000/auth/callback

// In .env.local, use the same:
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

### 3.3 Clear .next Directory

Development issue - stale cache:

```bash
rm -rf .next && npm run dev
```

### 3.4 Error Handling with Graceful Fallback

```typescript
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (code) {
    try {
      const supabase = await createClient()
      const { error } = await supabase.auth.exchangeCodeForSession(code)

      if (error) {
        console.error('Code exchange error:', error.message)
        // Redirect to login with error message
        return NextResponse.redirect(
          `${origin}/login?error=${encodeURIComponent(error.message)}`,
        )
      }

      return NextResponse.redirect(`${origin}/dashboard`)
    } catch (e) {
      console.error('Unexpected error:', e)
      return NextResponse.redirect(`${origin}/login?error=unexpected`)
    }
  }

  return NextResponse.redirect(`${origin}/login`)
}
```

### 3.5 Explicit PKCE Flow Configuration

```typescript
const supabase = createClient(url, key, {
  auth: {
    flowType: 'pkce',
    detectSessionInUrl: true,
    persistSession: true,
  },
})
```

---

## 4. Next.js App Router Specific Considerations

### 4.1 Server Components Cannot Write Cookies

- Mutations (including cookie writes) are not allowed in Server Components
- Must use middleware or Route Handlers for cookie writes
- The `try/catch` in `setAll` handles this gracefully

### 4.2 Route Prefetching Issues

- Next.js `<Link>` and `Router.push()` can prefetch routes
- Prefetched requests may not have cookies set yet
- Solution: Redirect to a non-prefetched page first after auth

### 4.3 Middleware Must Return Response

- Always return `supabaseResponse`, not `NextResponse.next()`
- If creating new response, copy cookies:

```typescript
const myNewResponse = NextResponse.redirect(url)
myNewResponse.cookies.setAll(supabaseResponse.cookies.getAll())
return myNewResponse
```

### 4.4 Browser Client Configuration

**utils/supabase/client.ts**:

```typescript
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}
```

---

## 5. Cookie Configuration Requirements

### 5.1 Required Cookie Settings

```typescript
{
  path: '/',
  sameSite: 'lax',  // or 'strict' for more security
  secure: process.env.NODE_ENV === 'production',  // true in prod
  httpOnly: false,  // Browser needs access for token refresh
  maxAge: 60 * 60 * 24 * 365,  // 1 year (Supabase default)
}
```

### 5.2 Cookie Naming Convention

Supabase uses this format for cookies:

- `sb-{project-ref}-auth-token` - Main session cookie
- `sb-{project-ref}-auth-token-code-verifier` - PKCE verifier
- `sb-{project-ref}-auth-token.0`, `.1`, etc. - Chunked cookies for large sessions

### 5.3 Domain Considerations

- For subdomains, set domain to `.example.com`
- In development, avoid domain setting (defaults to current host)
- `localhost` and `127.0.0.1` are different domains!

---

## 6. Debugging Checklist

```markdown
[ ] Using @supabase/ssr (not deprecated @supabase/auth-helpers)?
[ ] Using getAll/setAll (not get/set/remove)?
[ ] Middleware configured and returning supabaseResponse?
[ ] Middleware matcher includes auth routes?
[ ] Callback route using server client (not browser client)?
[ ] Redirect URLs configured in Supabase dashboard?
[ ] Using consistent URL (localhost vs 127.0.0.1)?
[ ] Cleared .next directory after config changes?
[ ] Cookie being set before signInWithOAuth/signUp call?
[ ] Same browser used for entire flow?
```

---

## 7. Version Compatibility

| Package               | Recommended Version | Notes             |
| --------------------- | ------------------- | ----------------- |
| @supabase/ssr         | ^0.4.0+             | Use getAll/setAll |
| @supabase/supabase-js | ^2.39.0+            | PKCE improvements |
| next                  | 14.x, 15.x          | App Router        |

---

## Sources

1. [Supabase SSR Advanced Guide](https://supabase.com/docs/guides/auth/server-side/advanced-guide)
2. [Supabase PKCE Flow Documentation](https://supabase.com/docs/guides/auth/sessions/pkce-flow)
3. [Supabase SSR Client Setup](https://supabase.com/docs/guides/auth/server-side/creating-a-client)
4. [GitHub Issue #21183 - Auth code and code verifier error](https://github.com/orgs/supabase/discussions/21183)
5. [GitHub Issue #20922 - Next.js PKCE Woes](https://github.com/orgs/supabase/discussions/20922)
6. [GitHub Issue #55 - signInWithOAuth inconsistency](https://github.com/supabase/ssr/issues/55)
7. [GitHub Issue #2099 - Docker Compose code_verifier issue](https://github.com/supabase/auth/issues/2099)
8. [Stack Overflow - Next.js 14 Supabase Auth](https://stackoverflow.com/questions/78588285)
9. [Supabase SSR v0.4.0 Release Notes](https://github.com/orgs/supabase/discussions/27037)
10. [Supabase Troubleshooting Guide](https://supabase.com/docs/guides/troubleshooting/how-do-you-troubleshoot-nextjs---supabase-auth-issues-riMCZV)

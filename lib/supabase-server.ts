import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { NextRequest, NextResponse } from 'next/server'

const SUPABASE_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Use in Server Components and API Route handlers.
// Reads the session from the request's cookie store — respects RLS.
export async function createSupabaseServer() {
  const cookieStore = await cookies()
  return createServerClient(SUPABASE_URL, SUPABASE_ANON, {
    cookies: {
      getAll: ()               => cookieStore.getAll(),
      setAll: (cookiesToSet)   => {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        } catch {
          // Server Components can't set cookies — safe to ignore here.
          // Middleware handles token refresh for actual cookie writes.
        }
      },
    },
  })
}

// Use only in middleware.ts — needs both request and response to refresh tokens.
export function createSupabaseMiddleware(request: NextRequest, response: NextResponse) {
  return createServerClient(SUPABASE_URL, SUPABASE_ANON, {
    cookies: {
      getAll: ()             => request.cookies.getAll(),
      setAll: (cookiesToSet) => {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        )
      },
    },
  })
}

// Convenience helper for API routes — returns the authenticated user or null.
export async function getAuthUser() {
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

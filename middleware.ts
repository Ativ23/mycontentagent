import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseMiddleware } from '@/lib/supabase-server'

const PROTECTED_PREFIXES = ['/dashboard', '/generator', '/library', '/settings']

export async function middleware(request: NextRequest) {
  const response = NextResponse.next({ request })
  const supabase  = createSupabaseMiddleware(request, response)

  // Always call getUser — this refreshes the session token if it has expired
  // and writes the new token back to the response cookies.
  const { data: { user } } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  // Unauthenticated → redirect to /auth
  if (!user && PROTECTED_PREFIXES.some(p => pathname.startsWith(p))) {
    const url = request.nextUrl.clone()
    url.pathname = '/auth'
    return NextResponse.redirect(url)
  }

  // Already authenticated → /auth is pointless, send to generator
  if (user && pathname === '/auth') {
    const url = request.nextUrl.clone()
    url.pathname = '/generator'
    return NextResponse.redirect(url)
  }

  return response
}

export const config = {
  // Run on protected routes and the auth page — skip static assets and API routes
  matcher: [
    '/dashboard/:path*',
    '/generator/:path*',
    '/library/:path*',
    '/settings/:path*',
    '/auth',
  ],
}

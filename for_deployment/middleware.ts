
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { jwtVerify } from 'jose'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Static files and Next.js internals - allow immediately
  if (pathname.startsWith('/_next/') || 
      pathname.startsWith('/favicon.ico') ||
      pathname.includes('.') ||
      pathname.startsWith('/api/')) {
    return NextResponse.next()
  }

  // Public routes that don't need authentication - allow immediately
  const publicRoutes = [
    '/',
    '/auth/signin',
    '/auth/signup', 
    '/simple-login',
    '/test-login',
    '/redirect-after-login',
    '/login-now',
    '/emergency-login',
    '/demo-system',
    '/auth-test',
    '/patient/appointments/book',
    '/queue-monitor'
  ]

  // Check if the current path is public - if so, allow access
  const isPublicRoute = publicRoutes.some(route => pathname === route || pathname.startsWith(route))

  if (isPublicRoute) {
    return NextResponse.next()
  }

  // For protected routes, check authentication
  const protectedPaths = ['/admin', '/dentist', '/staff', '/patient']
  const isProtectedRoute = protectedPaths.some(path => pathname.startsWith(path))

  if (!isProtectedRoute) {
    // If it's not a specifically protected route, allow access
    return NextResponse.next()
  }

  // Check for custom JWT token in cookies
  const customToken = request.cookies.get('swiftcare-session')?.value
  
  if (customToken) {
    try {
      const secret = new TextEncoder().encode(process.env.NEXTAUTH_SECRET || 'fallback-secret')
      await jwtVerify(customToken, secret)
      return NextResponse.next()
    } catch (error) {
      // Token verification failed - check if it's expired or invalid
      console.log('JWT verification failed:', error)
      // Don't immediately redirect - check for other auth methods first
    }
  }

  // Check for NextAuth token (fallback)
  const nextAuthToken = request.cookies.get('next-auth.session-token')?.value || 
                       request.cookies.get('__Secure-next-auth.session-token')?.value

  if (nextAuthToken) {
    return NextResponse.next()
  }

  // Check for swiftcare-user cookie as last resort (indicates recent login)
  const userCookie = request.cookies.get('swiftcare-user')?.value
  if (userCookie) {
    try {
      const userData = JSON.parse(decodeURIComponent(userCookie))
      if (userData && userData.id && userData.email) {
        // User cookie exists, allow access (session will be refreshed by the app)
        return NextResponse.next()
      }
    } catch (e) {
      // Invalid user cookie
    }
  }

  // No valid authentication found for protected route, redirect to login
  // Do NOT clear cookies here - the signin page or signOut handles that.
  // Clearing cookies during redirect can cause a loop with client-side session checks.
  const signinUrl = new URL('/auth/signin', request.url)
  signinUrl.searchParams.set('callbackUrl', pathname)
  return NextResponse.redirect(signinUrl)
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}

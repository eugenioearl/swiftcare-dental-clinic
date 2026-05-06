
import { NextRequest, NextResponse } from 'next/server'
import { SignJWT } from 'jose'
import { getServerAuth } from '@/lib/auth'

const JWT_SECRET = new TextEncoder().encode(process.env.NEXTAUTH_SECRET || 'fallback-secret')
const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60 // 30 days

/**
 * Build a fresh signed JWT that represents the current authenticated user.
 * This is used to sliding-window the swiftcare-session cookie so an active
 * user never gets auto-logged-out while they are using the app.
 */
async function signSlidingSessionToken(user: any): Promise<string> {
  return await new SignJWT({
    userId: user.id,
    email: user.email,
    username: (user as any).username,
    role: user.role,
    name: user.name,
    isActive: user.isActive,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(JWT_SECRET)
}

/**
 * Refresh sliding-window cookies to keep authenticated sessions alive.
 *
 * IMPORTANT: Both cookies must be refreshed on every authenticated session check.
 *   - swiftcare-session (httpOnly JWT) — re-sign and extend expiry by 30d.
 *     Without this, after 30 days the JWT is permanently dead even if the user
 *     has been active the whole time, which caused silent auto-logouts.
 *   - swiftcare-user (client-readable) — extend expiry by 30d. Without this,
 *     Safari/Firefox ITP drops the non-httpOnly cookie after ~7 days of silent
 *     inactivity, which also caused the auto-logout symptom.
 */
async function refreshCookies(response: NextResponse, request: NextRequest, userPayload: any) {
  const isProduction = process.env.NODE_ENV === 'production'
  const isSecure = isProduction && !!process.env.NEXTAUTH_URL?.startsWith('https://')
  const sameSite = 'lax' as const

  // 1) Re-sign and reset swiftcare-session JWT (sliding refresh)
  try {
    if (userPayload?.id && userPayload?.email) {
      const freshToken = await signSlidingSessionToken(userPayload)
      response.cookies.set('swiftcare-session', freshToken, {
        httpOnly: true,
        secure: isSecure,
        sameSite,
        maxAge: SESSION_MAX_AGE_SECONDS,
        path: '/',
      })
    }
  } catch (err) {
    // Non-fatal — we still return authenticated, just without a refreshed JWT.
    console.warn('refreshCookies: failed to re-sign swiftcare-session:', (err as Error)?.message)
  }

  // 2) Refresh swiftcare-user (client-readable) so the client-side session stays alive.
  try {
    const existing = request.cookies.get('swiftcare-user')?.value
    if (existing) {
      response.cookies.set('swiftcare-user', existing, {
        httpOnly: false,
        secure: isSecure,
        sameSite,
        maxAge: SESSION_MAX_AGE_SECONDS,
        path: '/',
      })
    } else if (userPayload) {
      response.cookies.set(
        'swiftcare-user',
        JSON.stringify({
          id: userPayload.id,
          email: userPayload.email,
          name: userPayload.name,
          role: userPayload.role,
        }),
        {
          httpOnly: false,
          secure: isSecure,
          sameSite,
          maxAge: SESSION_MAX_AGE_SECONDS,
          path: '/',
        },
      )
    }
  } catch (e) {
    // non-fatal
  }
  return response
}

export async function GET(request: NextRequest) {
  try {
    // Get session using our server auth function
    const session = await getServerAuth()

    if (session && session.user) {
      const user = {
        id: session.user.id,
        email: session.user.email,
        name: session.user.name,
        role: session.user.role,
        isActive: session.user.isActive,
        phone: (session.user as any).phone || '',
      }
      const res = NextResponse.json({
        authenticated: true,
        user,
      })
      return await refreshCookies(res, request, user)
    } else {
      // Fallback: honor the client-readable user cookie if the JWT/NextAuth check failed.
      // This is what keeps a user logged in when the httpOnly JWT has expired but the
      // client-side cookie is still present (or vice versa). We also refresh BOTH
      // cookies below so the session recovers a valid JWT from here on.
      const userCookieValue = request.cookies.get('swiftcare-user')?.value
      if (userCookieValue) {
        try {
          const userData = JSON.parse(decodeURIComponent(userCookieValue))
          if (userData && userData.id && userData.email) {
            const user = {
              id: userData.id,
              email: userData.email,
              name: userData.name,
              role: userData.role,
              isActive: true,
              phone: '',
            }
            const res = NextResponse.json({
              authenticated: true,
              user,
            })
            return await refreshCookies(res, request, user)
          }
        } catch (e) {
          console.log('Failed to parse user cookie:', e)
        }
      }
    }

    return NextResponse.json({
      authenticated: false,
      user: null,
    })
  } catch (error) {
    console.error('💥 /api/custom-session error:', error)
    return NextResponse.json(
      {
        authenticated: false,
        user: null,
        error: 'Session check failed',
      },
      { status: 500 },
    )
  }
}

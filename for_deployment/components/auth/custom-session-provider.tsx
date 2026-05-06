
'use client'

import React, { createContext, useContext, useState, useEffect, useRef, useCallback, ReactNode } from 'react'

// Types to match NextAuth and existing components
interface User {
  id: string
  email: string
  name: string
  firstName?: string
  lastName?: string
  role: string
  isActive: boolean
  phone?: string
}

interface Session {
  user: User
  expires?: string
}

interface SessionContextType {
  data: Session | null
  status: 'loading' | 'authenticated' | 'unauthenticated'
}

const SessionContext = createContext<SessionContextType>({
  data: null,
  status: 'loading'
})

interface CustomSessionProviderProps {
  children: ReactNode
}

function buildSessionFromUser(userData: any): Session {
  const nameStr = userData.name || ''
  const hasComma = nameStr.includes(',')
  const firstName = hasComma ? nameStr.split(',').slice(1).join(',').trim() : nameStr.split(' ')[0] || ''
  const lastName = hasComma ? nameStr.split(',')[0].trim() : nameStr.split(' ').slice(1).join(' ') || ''
  return {
    user: {
      id: userData.id,
      email: userData.email,
      name: userData.name,
      firstName: firstName,
      lastName: lastName,
      role: userData.role,
      isActive: userData.isActive ?? true,
      phone: userData.phone || ''
    }
  }
}

export function CustomSessionProvider({ children }: CustomSessionProviderProps) {
  const [session, setSession] = useState<Session | null>(null)
  const [status, setStatus] = useState<'loading' | 'authenticated' | 'unauthenticated'>('loading')
  
  // Use refs for values that should NOT trigger re-renders
  const lastCheckRef = useRef<number>(0)
  // Tracks the last time we actually hit /api/custom-session (as opposed to just reading the user cookie).
  // Used to guarantee a periodic round-trip that refreshes both cookies (sliding window).
  const lastApiRefreshRef = useRef<number>(0)
  const sessionRef = useRef<Session | null>(null)
  const statusRef = useRef<'loading' | 'authenticated' | 'unauthenticated'>('loading')
  const isCheckingRef = useRef(false)

  // Keep refs in sync with state
  useEffect(() => { sessionRef.current = session }, [session])
  useEffect(() => { statusRef.current = status }, [status])

  // Only update state if data actually changed (prevents unnecessary re-renders)
  const updateSession = useCallback((newSession: Session | null, newStatus: 'loading' | 'authenticated' | 'unauthenticated') => {
    if (newStatus !== statusRef.current) {
      setStatus(newStatus)
    }
    if (newSession?.user?.id !== sessionRef.current?.user?.id || 
        newSession?.user?.role !== sessionRef.current?.user?.role) {
      setSession(newSession)
    }
  }, [])

  const checkSession = useCallback(async () => {
    // Prevent concurrent checks
    if (isCheckingRef.current) return
    isCheckingRef.current = true

    try {
      // First check for client-readable cookie (fastest check) — always refresh session from cookie when present
      let userCookieData: any = null
      if (typeof document !== 'undefined') {
        const userCookie = document.cookie
          .split('; ')
          .find(row => row.startsWith('swiftcare-user='))
          ?.split('=')[1]
        
        if (userCookie) {
          try {
            const userData = JSON.parse(decodeURIComponent(userCookie))
            if (userData && userData.id && userData.email) {
              userCookieData = userData
              const sessionData = buildSessionFromUser(userData)
              updateSession(sessionData, 'authenticated')
              lastCheckRef.current = Date.now()
            }
          } catch {
            // Invalid cookie, continue to API check
          }
        }
      }

      // If we already have an authenticated session and the user cookie is present, and we
      // have recently round-tripped to the API, skip the API call for now.
      //
      // IMPORTANT: Even when we have a user cookie we still need to periodically hit
      // /api/custom-session so the server can refresh BOTH cookies (sliding window).
      // Without that periodic call:
      //   - Safari/Firefox ITP drops the client-readable cookie after ~7 days of idle
      //   - The httpOnly JWT silently expires 30 days after original login
      // Both would cause an auto-logout even for active users.
      const SIX_HOURS = 6 * 60 * 60 * 1000
      if (
        userCookieData &&
        sessionRef.current &&
        statusRef.current === 'authenticated' &&
        (Date.now() - lastApiRefreshRef.current) < SIX_HOURS
      ) {
        return
      }

      // If we have an existing session and we just checked the API, keep it
      if (
        sessionRef.current &&
        statusRef.current === 'authenticated' &&
        (Date.now() - lastCheckRef.current) < 5 * 60 * 1000 &&
        (Date.now() - lastApiRefreshRef.current) < SIX_HOURS
      ) {
        return
      }
      
      // Try to get session from HTTP-only cookie via API
      const response = await fetch('/api/custom-session', {
        credentials: 'include',
        headers: { 'Cache-Control': 'no-cache' }
      })
      
      // Handle network errors gracefully — NEVER log out on network issues
      if (!response.ok) {
        console.warn('Session check API error:', response.status)
        return // Keep existing state (including loading) on errors
      }
      
      const data = await response.json()
      
      if (data.authenticated && data.user) {
        const sessionData = buildSessionFromUser(data.user)
        updateSession(sessionData, 'authenticated')
        lastCheckRef.current = Date.now()
        // The server just issued fresh swiftcare-session + swiftcare-user cookies.
        // Record this so the 6-hour sliding-refresh gate resets.
        lastApiRefreshRef.current = Date.now()
        return
      }
      
      // API returned not-authenticated
      // Be VERY conservative — only mark as unauthenticated if:
      //   1. This is the initial load (status still 'loading'), AND
      //   2. There's no user cookie at all (if user cookie exists it means we have a session client-side but API failed to verify — keep the cookie session)
      if (statusRef.current === 'loading' && !userCookieData) {
        updateSession(null, 'unauthenticated')
      }
      // Otherwise: keep current state. We don't log users out based on a single API result.
    } catch (error) {
      console.error('Session check error:', error)
      // NEVER log out on client-side errors — keep current state
    } finally {
      isCheckingRef.current = false
    }
  }, [updateSession]) // stable dependency

  // Initialization effect - runs once
  useEffect(() => {
    checkSession()
    const interval = setInterval(checkSession, 10 * 60 * 1000)
    return () => clearInterval(interval)
  }, [checkSession])

  // Event listeners - runs once (no state dependencies)
  useEffect(() => {
    const handleStorageChange = () => checkSession()
    const handleSessionRefresh = () => checkSession()
    
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && statusRef.current === 'authenticated') {
        if (Date.now() - lastCheckRef.current > 2 * 60 * 1000) {
          checkSession()
        }
      }
    }

    window.addEventListener('storage', handleStorageChange)
    window.addEventListener('refreshSession', handleSessionRefresh)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      window.removeEventListener('storage', handleStorageChange)
      window.removeEventListener('refreshSession', handleSessionRefresh)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [checkSession])

  const contextValue: SessionContextType = {
    data: session,
    status
  }

  return (
    <SessionContext.Provider value={contextValue}>
      {children}
    </SessionContext.Provider>
  )
}

// Custom hook to use session (matches NextAuth API)
export function useSession(): { data: Session | null; status: string } {
  const context = useContext(SessionContext)
  
  if (context === undefined) {
    throw new Error('useSession must be used within a CustomSessionProvider')
  }
  
  return {
    data: context.data,
    status: context.status
  }
}

// Get session function (similar to NextAuth)
export async function getSession() {
  try {
    const response = await fetch('/api/custom-session', {
      credentials: 'include'
    })
    
    const data = await response.json()
    
    if (data.authenticated && data.user) {
      // Extract firstName and lastName from name (format: "LastName, FirstName" or "FirstName LastName")
      const nameStr2 = data.user.name || ''
      const hasComma2 = nameStr2.includes(',')
      const firstName = hasComma2 ? nameStr2.split(',').slice(1).join(',').trim() : nameStr2.split(' ')[0] || ''
      const lastName = hasComma2 ? nameStr2.split(',')[0].trim() : nameStr2.split(' ').slice(1).join(' ') || ''
      
      return {
        user: {
          id: data.user.id,
          email: data.user.email,
          name: data.user.name,
          firstName: firstName,
          lastName: lastName,
          role: data.user.role,
          isActive: data.user.isActive,
          phone: data.user.phone || ''
        }
      }
    }
    
    return null
  } catch (error) {
    console.error('getSession error:', error)
    return null
  }
}

// Utility function to refresh session manually
export function refreshSession() {
  const event = new CustomEvent('refreshSession')
  window.dispatchEvent(event)
}

// Sign in function (redirect to login)
export async function signIn(provider?: string, options?: { redirect?: boolean; callbackUrl?: string }) {
  console.log('🚪 CustomSessionProvider: Redirecting to sign in page...')
  
  const redirectUrl = options?.callbackUrl || '/auth/signin'
  
  if (options?.redirect !== false) {
    window.location.href = redirectUrl
  }
  
  return { ok: true, error: null, status: 200, url: redirectUrl }
}

// Sign out function
export async function signOut(options?: { redirect?: boolean; callbackUrl?: string }) {
  try {
    console.log('🚪 CustomSessionProvider: Signing out...')
    
    // Clear all cookies
    document.cookie = 'swiftcare-session=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;'
    document.cookie = 'swiftcare-debug=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;'
    document.cookie = 'swiftcare-user=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;'
    
    // Refresh session to update context
    refreshSession()
    
    // Redirect based on options
    const redirectUrl = options?.callbackUrl || '/'
    
    if (options?.redirect !== false) {
      window.location.href = redirectUrl
    }
  } catch (error) {
    console.error('💥 Sign out error:', error)
    // Fallback: just redirect to homepage
    if (options?.redirect !== false) {
      window.location.href = '/'
    }
  }
}


'use client'

import { useState, useEffect } from 'react'
import { useSession } from '@/components/auth/custom-session-provider'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { AlertCircle, RefreshCw, LogOut } from 'lucide-react'
import { signOut } from '@/components/auth/custom-session-provider'

interface DashboardWrapperProps {
  children: React.ReactNode
  title: string
  description?: string
}

export function DashboardWrapper({ children, title, description }: DashboardWrapperProps) {
  const { data: session, status } = useSession()
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    console.log('🎯 DashboardWrapper: Session status:', status, 'User:', session?.user?.email)
    
    if (status === 'loading') {
      setIsLoading(true)
      return
    }

    if (status === 'unauthenticated' || !session?.user) {
      setError('Not authenticated. Please log in.')
      setIsLoading(false)
      return
    }

    if (!session.user.isActive) {
      setError('Your account is not active. Please contact support.')
      setIsLoading(false)
      return
    }

    // Success case
    setError(null)
    setIsLoading(false)
  }, [session, status])

  const handleRetry = () => {
    window.location.reload()
  }

  const handleLogout = () => {
    signOut()
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <CardTitle>Loading Dashboard</CardTitle>
            <p className="text-muted-foreground">Authenticating and loading your dashboard...</p>
          </CardHeader>
        </Card>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <AlertCircle className="h-8 w-8 text-destructive mx-auto mb-4" />
            <CardTitle className="text-destructive">Dashboard Error</CardTitle>
            <p className="text-muted-foreground">{error}</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2 justify-center">
              <Button onClick={handleRetry} variant="outline" size="sm">
                <RefreshCw className="h-4 w-4 mr-2" />
                Retry
              </Button>
              <Button onClick={handleLogout} variant="default" size="sm">
                <LogOut className="h-4 w-4 mr-2" />
                Log Out
              </Button>
            </div>
            <div className="text-center">
              <a href="/simple-login" className="text-sm text-primary hover:underline">
                Return to Login
              </a>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Success state - render children
  return (
    <div className="min-h-screen bg-background">
      <div className="p-6">
        <div className="max-w-7xl mx-auto">
          <div className="mb-8">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-foreground">{title}</h1>
                {description && (
                  <p className="text-muted-foreground mt-2">{description}</p>
                )}
              </div>
              <div className="flex items-center gap-4">
                <div className="text-sm text-muted-foreground">
                  Welcome, {session?.user?.name}
                </div>
                <Button onClick={handleLogout} variant="outline" size="sm">
                  <LogOut className="h-4 w-4 mr-2" />
                  Sign Out
                </Button>
              </div>
            </div>
          </div>
          {children}
        </div>
      </div>
    </div>
  )
}


'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { CheckCircle, ArrowRight } from 'lucide-react'

export default function RedirectAfterLogin() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [countdown, setCountdown] = useState(3)
  const [userInfo, setUserInfo] = useState<any>(null)
  
  const redirectTo = searchParams.get('to') || '/admin/dashboard'
  const userName = searchParams.get('name') || 'User'
  const userRole = searchParams.get('role') || 'user'

  useEffect(() => {
    setUserInfo({ name: userName, role: userRole })
    
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer)
          // Force redirect
          window.location.href = redirectTo
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [redirectTo, userName, userRole])

  const handleManualRedirect = () => {
    window.location.href = redirectTo
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-blue-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <CheckCircle className="w-16 h-16 text-green-500" />
          </div>
          <CardTitle className="text-2xl text-green-700">Login Successful!</CardTitle>
          <CardDescription>
            Welcome back, {userInfo?.name}!
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="text-center">
            <p className="text-sm text-muted-foreground mb-2">
              Role: <span className="font-semibold capitalize">{userInfo?.role}</span>
            </p>
            <p className="text-sm text-muted-foreground">
              Redirecting to your dashboard in <span className="font-bold text-green-600">{countdown}</span> seconds...
            </p>
          </div>
          
          <div className="bg-green-50 p-3 rounded-lg">
            <p className="text-sm text-green-800">
              🎯 Destination: <code className="bg-green-100 px-1 rounded text-xs">{redirectTo}</code>
            </p>
          </div>

          <Button 
            onClick={handleManualRedirect}
            className="w-full bg-green-600 hover:bg-green-700"
          >
            Go to Dashboard Now <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
          
          <div className="text-center">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => window.location.href = '/'}
            >
              Go to Homepage Instead
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

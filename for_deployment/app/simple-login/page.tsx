'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Eye, EyeOff, Mail, Lock, Building2, Home } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

export default function SimpleLogin() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const router = useRouter()
  const { toast } = useToast()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    setError('')
    setIsLoading(true)
    
    try {
      const response = await fetch('/api/custom-login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
        credentials: 'include'
      })
      
      const data = await response.json()
      
      if (response.ok && data.success) {
        toast({
          title: "Login Successful!",
          description: `Welcome back! Redirecting to your dashboard...`,
        })
        
        // Wait a moment then redirect
        setTimeout(() => {
          window.location.href = data.redirectTo || '/admin/dashboard'
        }, 1000)
        
      } else {
        setError(data.error || 'Login failed. Please check your credentials.')
      }
    } catch (error) {
      console.error('Login error:', error)
      setError('Network error. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="swiftcare-gradient flex items-center justify-center p-4">
      {/* Home Button */}
      <div className="fixed top-6 left-6 z-10">
        <Link href="/">
          <Button variant="outline" size="sm" className="mobile-card mobile-button bg-white/80 backdrop-blur-md shadow-lg hover:shadow-xl border-0">
            <Home className="w-4 h-4 mr-2" />
            Home
          </Button>
        </Link>
      </div>

      <Card className="mobile-card w-full max-w-md">
        <CardHeader className="space-y-1 text-center pb-6">
          <div className="flex justify-center mb-6">
            <div className="mobile-card p-4 bg-white/90">
              <Building2 className="w-12 h-12" style={{color: 'hsl(var(--primary))'}} />
            </div>
          </div>
          <CardTitle className="text-3xl font-bold gradient-text">SwiftCare Login</CardTitle>
          <CardDescription className="text-gray-600">
            Access your dental clinic management system
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-3">
              <Label htmlFor="email" className="text-sm font-medium text-gray-700">Email Address</Label>
              <div className="relative">
                <Mail className="absolute left-4 top-4 h-5 w-5 text-gray-400" />
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mobile-input pl-12 pr-4 py-4 h-12 text-base"
                  required
                  disabled={isLoading}
                />
              </div>
            </div>

            <div className="space-y-3">
              <Label htmlFor="password" className="text-sm font-medium text-gray-700">Password</Label>
              <div className="relative">
                <Lock className="absolute left-4 top-4 h-5 w-5 text-gray-400" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mobile-input pl-12 pr-12 py-4 h-12 text-base"
                  required
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-4 text-gray-400 hover:text-gray-600 transition-colors"
                  disabled={isLoading}
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              className="mobile-button w-full h-12 text-base font-semibold mt-6"
              style={{
                background: 'hsl(var(--primary))',
                color: 'white',
                boxShadow: '0 4px 15px rgba(0, 0, 0, 0.1)'
              }}
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div>
                  Signing In...
                </>
              ) : (
                'Sign In to SwiftCare'
              )}
            </Button>
          </form>

          <div className="mt-8 text-center">
            <p className="text-sm text-gray-500 mb-3">
              Having trouble accessing your account?
            </p>
            <Link href="/emergency-login" 
                  className="mobile-button inline-block px-6 py-2 bg-white/60 backdrop-blur-sm rounded-xl text-sm font-medium transition-all hover:bg-white/80"
                  style={{color: 'hsl(var(--primary))'}}>
              Try Emergency Login
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
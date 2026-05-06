'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Eye, EyeOff, User, Lock, ArrowLeft, Shield } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

export default function SignIn() {
  const [identifier, setIdentifier] = useState('')
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
      if (!identifier || !password) {
        setError('Please enter your username/email and password')
        setIsLoading(false)
        return
      }

      const response = await fetch('/api/custom-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: identifier.trim(), password }),
        credentials: 'include'
      })

      const data = await response.json()

      if (response.ok && data.success) {
        toast({ title: 'Welcome!', description: `Signed in as ${data.user.name}` })
        setTimeout(() => { window.location.href = data.redirectTo }, 800)
      } else {
        setError(data.error || 'Invalid credentials')
      }
    } catch (err) {
      setError('An error occurred. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Left Panel - Branding */}
      <div className="hidden lg:flex relative bg-gradient-to-br from-[#2D9DA8] to-[#1a7a84] flex-col justify-between p-12 text-white">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-10 w-72 h-72 bg-white rounded-full blur-3xl" />
          <div className="absolute bottom-20 right-10 w-96 h-96 bg-white rounded-full blur-3xl" />
        </div>
        <div className="relative z-10">
          <Link href="/" className="inline-flex items-center gap-2 text-white/80 hover:text-white text-sm font-medium transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Back to Website
          </Link>
          <div className="mt-10 mb-8 w-fit">
            <div className="relative w-60 h-20 flex items-center justify-center">
              <Image src="/clinic/logo.png" alt="SwiftCare Dental Clinic" width={240} height={80} className="max-w-full max-h-full object-contain brightness-0 invert" priority />
            </div>
          </div>
          <h1 className="text-4xl font-bold leading-tight mb-4">
            Staff &amp; Admin<br />Portal
          </h1>
          <p className="text-white/80 text-lg max-w-sm">
            Manage appointments, patient records, and clinic operations from one place.
          </p>
        </div>
        <div className="relative z-10">
          <div className="relative aspect-[16/9] rounded-2xl overflow-hidden shadow-2xl max-w-md">
            <Image src="/clinic/reception-desk.jpg" alt="SwiftCare Reception" fill className="object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
          </div>
          <div className="flex items-center gap-6 mt-6 text-white/60 text-sm">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4" />
              <span>Secure Access</span>
            </div>
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4" />
              <span>Encrypted</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel - Login Form */}
      <div className="flex items-center justify-center p-6 sm:p-12 bg-gray-50">
        <div className="w-full max-w-sm">
          {/* Mobile Back Link */}
          <div className="lg:hidden mb-8">
            <Link href="/" className="inline-flex items-center gap-2 text-gray-500 hover:text-[#2D9DA8] text-sm font-medium transition-colors">
              <ArrowLeft className="w-4 h-4" />
              Back to Website
            </Link>
          </div>

          {/* Mobile Logo */}
          <div className="lg:hidden flex justify-center mb-8">
            <div className="relative w-56 h-20 flex items-center justify-center">
              <Image src="/clinic/logo.png" alt="SwiftCare Dental Clinic" width={224} height={80} className="max-w-full max-h-full object-contain" priority />
            </div>
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Sign In</h2>
            <p className="text-gray-500">Enter your credentials to access the portal</p>
          </div>

          {error && (
            <Alert variant="destructive" className="mb-6">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="identifier" className="text-sm font-medium text-gray-700">Username or Email</Label>
              <div className="relative">
                <User className="absolute left-3.5 top-3 h-4 w-4 text-gray-400" />
                <Input
                  id="identifier"
                  type="text"
                  placeholder="e.g. dr.smith or staff@clinic.com"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  className="pl-10 h-11 bg-white border-gray-200 focus:border-[#2D9DA8] focus:ring-[#2D9DA8]/20"
                  required
                  disabled={isLoading}
                  autoComplete="username"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium text-gray-700">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-3 h-4 w-4 text-gray-400" />
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 pr-10 h-11 bg-white border-gray-200 focus:border-[#2D9DA8] focus:ring-[#2D9DA8]/20"
                  required
                  disabled={isLoading}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-3 text-gray-400 hover:text-gray-600 transition-colors"
                  disabled={isLoading}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full h-11 bg-[#2D9DA8] hover:bg-[#258A94] text-white font-semibold transition-all hover:shadow-lg hover:shadow-[#2D9DA8]/20"
              disabled={isLoading}
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Signing in...
                </span>
              ) : 'Sign In'}
            </Button>
          </form>

          <div className="mt-8 pt-6 border-t border-gray-200">
            <p className="text-center text-xs text-gray-400">
              This portal is for authorized SwiftCare staff only.
              <br />Contact your administrator if you need access.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

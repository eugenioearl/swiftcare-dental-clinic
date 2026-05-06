
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const TestUsers = [
  { email: 'escletoglenn24@gmail.com', password: 'P@nc@k3$', role: 'super_admin' },
  { email: 'maria.santos@swiftcaredental.com', password: 'Swift2025!', role: 'super_admin' },
  { email: 'carlos.reyes@swiftcaredental.com', password: 'Swift2025!', role: 'admin' },
  { email: 'dr.miguel.rodriguez@swiftcaredental.com', password: 'Swift2025!', role: 'dentist' },
  { email: 'jenny.mendoza@swiftcaredental.com', password: 'Swift2025!', role: 'staff' },
  { email: 'alice.johnson@email.com', password: 'Patient2025!', role: 'patient' }
]

export default function TestAuthPage() {
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const router = useRouter()

  const handleLogin = async (user: any) => {
    setLoading(true)
    setMessage('')

    try {
      const response = await fetch('/api/custom-login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: user.email,
          password: user.password
        }),
        credentials: 'include'
      })

      const data = await response.json()

      if (data.success) {
        setMessage(`✅ Login successful for ${user.role}!`)
        // Redirect to dashboard
        setTimeout(() => {
          router.push(data.redirectTo || `/${user.role}/dashboard`)
        }, 1000)
      } else {
        setMessage(`❌ Login failed: ${data.error}`)
      }
    } catch (error) {
      setMessage(`💥 Error: ${error}`)
    } finally {
      setLoading(false)
    }
  }

  const checkSession = async () => {
    try {
      const response = await fetch('/api/custom-session', {
        credentials: 'include'
      })
      const data = await response.json()
      setMessage(`Session check: ${JSON.stringify(data, null, 2)}`)
    } catch (error) {
      setMessage(`Session check error: ${error}`)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-2xl mx-auto bg-white rounded-lg shadow p-8">
        <h1 className="text-2xl font-bold mb-6">SwiftCare Auth Test</h1>
        
        {message && (
          <div className="bg-gray-100 p-4 rounded mb-6">
            <pre className="whitespace-pre-wrap text-sm">{message}</pre>
          </div>
        )}

        <div className="space-y-4 mb-6">
          <h2 className="text-lg font-semibold">Test User Logins</h2>
          {TestUsers.map((user) => (
            <div key={user.role} className="flex items-center justify-between p-4 border rounded">
              <div>
                <div className="font-medium">{user.role.toUpperCase()}</div>
                <div className="text-sm text-gray-600">{user.email}</div>
                <div className="text-xs text-gray-500">Password: {user.password}</div>
              </div>
              <button
                onClick={() => handleLogin(user)}
                disabled={loading}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
              >
                {loading ? 'Logging in...' : `Login as ${user.role}`}
              </button>
            </div>
          ))}
        </div>

        <button
          onClick={checkSession}
          className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 mr-4"
        >
          Check Session
        </button>
        
        <button
          onClick={() => router.push('/')}
          className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
        >
          Go to Home
        </button>
      </div>
    </div>
  )
}

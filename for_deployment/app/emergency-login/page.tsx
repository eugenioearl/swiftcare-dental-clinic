
'use client'

import React, { useState } from 'react'

export default function EmergencyLogin() {
  const [email, setEmail] = useState('john@doe.com')
  const [password, setPassword] = useState('password123')
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState('Ready to login with Super Admin credentials')

  const handleLogin = async () => {
    setIsLoading(true)
    setMessage('Attempting login...')
    
    try {
      console.log('🔥 Emergency login attempt!')
      
      const response = await fetch('/api/custom-login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password })
      })

      console.log('Response status:', response.status)
      const data = await response.json()
      console.log('Response data:', data)

      if (data.success) {
        setMessage(`✅ SUCCESS! Redirecting to ${data.user.role} dashboard...`)
        
        // Wait a moment for the cookie to be set, then redirect
        setTimeout(() => {
          console.log('🔄 Performing redirect to:', data.redirectTo)
          
          // Force page refresh to ensure middleware sees the cookie
          window.location.href = data.redirectTo
        }, 1500)
      } else {
        setMessage(`❌ FAILED: ${data.error}`)
      }
    } catch (error) {
      setMessage(`💥 ERROR: ${error}`)
      console.error('Login error:', error)
    }
    
    setIsLoading(false)
  }

  const quickSelect = (newEmail: string, role: string) => {
    setEmail(newEmail)
    setPassword('password123')
    setMessage(`Selected ${role} account: ${newEmail}`)
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      position: 'relative'
    }}>
      {/* Home Button */}
      <div style={{
        position: 'fixed',
        top: '16px',
        left: '16px',
        zIndex: 10
      }}>
        <button
          onClick={() => window.location.href = '/'}
          style={{
            background: 'rgba(255, 255, 255, 0.95)',
            border: '2px solid #e5e7eb',
            borderRadius: '8px',
            padding: '8px 16px',
            fontSize: '14px',
            fontWeight: '500',
            color: '#374151',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
            transition: 'all 0.2s'
          }}
          onMouseOver={(e) => {
            const target = e.target as HTMLButtonElement
            target.style.background = 'white'
            target.style.borderColor = '#3b82f6'
          }}
          onMouseOut={(e) => {
            const target = e.target as HTMLButtonElement
            target.style.background = 'rgba(255, 255, 255, 0.95)'
            target.style.borderColor = '#e5e7eb'
          }}
        >
          🏠 Home
        </button>
      </div>

      <div style={{
        background: 'white',
        borderRadius: '20px',
        padding: '40px',
        maxWidth: '600px',
        width: '100%',
        boxShadow: '0 20px 40px rgba(0,0,0,0.1)'
      }}>
        
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '30px' }}>
          <h1 style={{ 
            fontSize: '2.5rem', 
            fontWeight: 'bold', 
            color: '#1f2937',
            marginBottom: '10px'
          }}>
            🦷 SwiftCare Emergency Login
          </h1>
          <p style={{ color: '#6b7280', fontSize: '1.1rem' }}>
            This login is GUARANTEED to work!
          </p>
        </div>

        {/* Status */}
        <div style={{
          background: '#f0f9ff',
          border: '2px solid #0ea5e9',
          borderRadius: '10px',
          padding: '15px',
          marginBottom: '30px'
        }}>
          <p style={{ color: '#0369a1', fontWeight: '500', margin: 0 }}>
            📊 Status: {message}
          </p>
        </div>

        {/* Form */}
        <div style={{ marginBottom: '30px' }}>
          <div style={{ marginBottom: '20px' }}>
            <label style={{ 
              display: 'block', 
              marginBottom: '8px', 
              fontWeight: '500',
              color: '#374151'
            }}>
              📧 Email:
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{
                width: '100%',
                padding: '15px',
                fontSize: '16px',
                border: '2px solid #d1d5db',
                borderRadius: '8px',
                outline: 'none'
              }}
              onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
              onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
            />
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ 
              display: 'block', 
              marginBottom: '8px', 
              fontWeight: '500',
              color: '#374151'
            }}>
              🔑 Password:
            </label>
            <input
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{
                width: '100%',
                padding: '15px',
                fontSize: '16px',
                border: '2px solid #d1d5db',
                borderRadius: '8px',
                outline: 'none'
              }}
              onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
              onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
            />
          </div>
        </div>

        {/* Login Button */}
        <button
          onClick={handleLogin}
          disabled={isLoading}
          style={{
            width: '100%',
            padding: '20px',
            fontSize: '20px',
            fontWeight: 'bold',
            color: 'white',
            background: isLoading ? '#9ca3af' : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            border: 'none',
            borderRadius: '12px',
            cursor: isLoading ? 'not-allowed' : 'pointer',
            marginBottom: '30px',
            boxShadow: '0 4px 15px rgba(16, 185, 129, 0.4)'
          }}
          onMouseOver={(e) => {
            if (!isLoading) {
              const target = e.target as HTMLButtonElement
              target.style.transform = 'translateY(-2px)'
              target.style.boxShadow = '0 6px 20px rgba(16, 185, 129, 0.6)'
            }
          }}
          onMouseOut={(e) => {
            const target = e.target as HTMLButtonElement
            target.style.transform = 'translateY(0)'
            target.style.boxShadow = '0 4px 15px rgba(16, 185, 129, 0.4)'
          }}
        >
          {isLoading ? '⏳ LOGGING IN...' : '🚀 LOGIN NOW!'}
        </button>

        {/* Quick Select */}
        <div>
          <p style={{ 
            textAlign: 'center', 
            marginBottom: '15px',
            color: '#6b7280',
            fontWeight: '500'
          }}>
            Quick Select Account Type:
          </p>
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: '1fr 1fr', 
            gap: '10px',
            marginBottom: '20px'
          }}>
            <button
              onClick={() => quickSelect('john@doe.com', 'Super Admin')}
              disabled={isLoading}
              style={{
                padding: '12px',
                background: '#fef3c7',
                border: '2px solid #f59e0b',
                borderRadius: '8px',
                fontWeight: '500',
                color: '#92400e',
                cursor: 'pointer'
              }}
            >
              👑 Super Admin
            </button>
            <button
              onClick={() => quickSelect('dr.smith@swiftcare.com', 'Dentist')}
              disabled={isLoading}
              style={{
                padding: '12px',
                background: '#dbeafe',
                border: '2px solid #3b82f6',
                borderRadius: '8px',
                fontWeight: '500',
                color: '#1d4ed8',
                cursor: 'pointer'
              }}
            >
              🦷 Dentist
            </button>
            <button
              onClick={() => quickSelect('receptionist@swiftcare.com', 'Staff')}
              disabled={isLoading}
              style={{
                padding: '12px',
                background: '#f3e8ff',
                border: '2px solid #8b5cf6',
                borderRadius: '8px',
                fontWeight: '500',
                color: '#6d28d9',
                cursor: 'pointer'
              }}
            >
              👥 Staff
            </button>
            <button
              onClick={() => quickSelect('patient1@example.com', 'Patient')}
              disabled={isLoading}
              style={{
                padding: '12px',
                background: '#ecfdf5',
                border: '2px solid #10b981',
                borderRadius: '8px',
                fontWeight: '500',
                color: '#047857',
                cursor: 'pointer'
              }}
            >
              🩺 Patient
            </button>
          </div>
        </div>

        {/* Instructions */}
        <div style={{
          background: '#f9fafb',
          border: '1px solid #e5e7eb',
          borderRadius: '10px',
          padding: '20px',
          marginBottom: '20px'
        }}>
          <h4 style={{ color: '#374151', marginBottom: '10px', fontSize: '1.1rem' }}>
            📝 How to Use:
          </h4>
          <ol style={{ color: '#6b7280', paddingLeft: '20px', lineHeight: '1.6' }}>
            <li>Super Admin account is pre-filled</li>
            <li>Or click any account type button above</li>
            <li>Click the big "🚀 LOGIN NOW!" button</li>
            <li>You'll be redirected to your dashboard</li>
          </ol>
        </div>

        {/* Back Button */}
        <div style={{ textAlign: 'center' }}>
          <button
            onClick={() => window.location.href = '/'}
            style={{
              padding: '10px 20px',
              background: 'transparent',
              border: '2px solid #6b7280',
              borderRadius: '8px',
              color: '#6b7280',
              cursor: 'pointer',
              fontWeight: '500'
            }}
          >
            ← Back to Homepage
          </button>
        </div>
      </div>
    </div>
  )
}

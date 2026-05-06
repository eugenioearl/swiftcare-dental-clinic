

'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Copy, User, Users, Stethoscope, Shield } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { copyToClipboard as safeCopyToClipboard } from '@/lib/utils'

interface TestAccount {
  role: string
  email: string
  password: string
  name: string
  description: string
}

export default function TestAccountsPage() {
  const { toast } = useToast()
  const [accounts, setAccounts] = useState<TestAccount[]>([])
  
  useEffect(() => {
    // Fetch test accounts from the seeded data
    setAccounts([
      {
        role: 'super_admin',
        email: 'escletoglenn24@gmail.com',
        password: 'P@nc@k3$',
        name: 'Super Admin',
        description: 'Full system access'
      },
      {
        role: 'dentist',
        email: 'miguel.rodriguez@swiftcare.com',
        password: 'password123',
        name: 'Dr. Miguel Rodriguez',
        description: 'Dentist with patient and treatment access'
      },
      {
        role: 'staff',
        email: 'jenny.mendoza@swiftcare.com',
        password: 'password123',
        name: 'Jenny Mendoza',
        description: 'Staff member with reception duties'
      },
      {
        role: 'patient',
        email: 'alice.johnson@email.com',
        password: 'password123',
        name: 'Alice Marie Johnson',
        description: 'Patient with appointments and records'
      }
    ])
  }, [])

  const handleCopy = async (text: string) => {
    const ok = await safeCopyToClipboard(text)
    if (ok) toast({ title: "Copied!", description: "Text copied to clipboard." })
  }

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'super_admin':
      case 'admin':
        return <Shield className="w-5 h-5" />
      case 'dentist':
        return <Stethoscope className="w-5 h-5" />
      case 'staff':
        return <Users className="w-5 h-5" />
      case 'patient':
        return <User className="w-5 h-5" />
      default:
        return <User className="w-5 h-5" />
    }
  }

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'super_admin':
        return 'bg-purple-100 text-purple-800'
      case 'admin':
        return 'bg-red-100 text-red-800'
      case 'dentist':
        return 'bg-blue-100 text-blue-800'
      case 'staff':
        return 'bg-green-100 text-green-800'
      case 'patient':
        return 'bg-gray-100 text-gray-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Test Accounts</h1>
          <p className="text-gray-600 mt-2">
            Use these accounts to test different user roles in the system
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {accounts.map((account, index) => (
            <Card key={index} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-center space-x-3">
                  <div className={`p-2 rounded-full ${getRoleColor(account.role).replace('text-', 'bg-').replace('bg-', 'bg-opacity-20 text-')}`}>
                    {getRoleIcon(account.role)}
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold">{account.name}</h3>
                    <Badge className={getRoleColor(account.role)}>
                      {account.role.replace('_', ' ').toUpperCase()}
                    </Badge>
                  </div>
                </CardTitle>
                <p className="text-sm text-gray-600">{account.description}</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="text-sm font-medium text-gray-700">Email</p>
                      <p className="text-sm text-gray-900 font-mono">{account.email}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleCopy(account.email)}
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                  
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="text-sm font-medium text-gray-700">Password</p>
                      <p className="text-sm text-gray-900 font-mono">{account.password}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleCopy(account.password)}
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                
                <div className="flex space-x-2 pt-4">
                  <Button 
                    className="flex-1"
                    onClick={() => {
                      handleCopy(account.email)
                      setTimeout(() => handleCopy(account.password), 100)
                    }}
                  >
                    Copy Both
                  </Button>
                  <Button 
                    variant="outline"
                    onClick={() => window.open('/simple-login', '_blank')}
                  >
                    Login
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mt-8 text-center">
          <Card>
            <CardHeader>
              <CardTitle>Quick Access Links</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-4 justify-center">
              <Button variant="outline" onClick={() => window.open('/simple-login', '_blank')}>
                Login Page
              </Button>
              <Button variant="outline" onClick={() => window.open('/admin/dashboard', '_blank')}>
                Admin Dashboard
              </Button>
              <Button variant="outline" onClick={() => window.open('/dentist/dashboard', '_blank')}>
                Dentist Dashboard
              </Button>
              <Button variant="outline" onClick={() => window.open('/staff/dashboard', '_blank')}>
                Staff Dashboard
              </Button>
              <Button variant="outline" onClick={() => window.open('/patient/dashboard', '_blank')}>
                Patient Dashboard
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

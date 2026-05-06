

'use client'

import { useSession } from '@/components/auth/custom-session-provider'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import AIDiagnostics from '@/components/ai/ai-diagnostics'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Brain, Users, TrendingUp, Shield } from 'lucide-react'

export default function AdminAIDiagnosticsPage() {
  const { data: session, status } = useSession() || {}
  const router = useRouter()
  const [stats, setStats] = useState({
    totalRequests: 0,
    activeUsers: 0,
    avgConfidence: 0,
    loading: true
  })

  useEffect(() => {
    if (status === 'loading') return

    if (!session?.user) {
      router.push('/login-now')
      return
    }

    if (!['admin', 'super_admin', 'manager', 'dentist'].includes(session.user.role)) {
      router.push('/login-now')
      return
    }

    // Simulate loading stats
    setTimeout(() => {
      setStats({
        totalRequests: 1247,
        activeUsers: 89,
        avgConfidence: 82,
        loading: false
      })
    }, 1000)
  }, [session, status, router])

  if (status === 'loading' || stats.loading) {
    return (
      <DashboardLayout title="AI Diagnostics Management">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </DashboardLayout>
    )
  }

  if (!session?.user || !['admin', 'super_admin', 'manager', 'dentist'].includes(session.user.role)) {
    return null
  }

  return (
    <DashboardLayout title="AI Diagnostics Management">
      <div className="space-y-6">
        {/* Admin Overview */}
        <div className="bg-purple-50 border border-purple-200 p-4 rounded-lg">
          <h3 className="font-medium text-purple-900 mb-2">AI Diagnostics Oversight</h3>
          <p className="text-sm text-purple-700">
            Monitor and manage the AI-powered diagnostics system. All users have free access to AI diagnostics.
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total AI Requests</CardTitle>
              <Brain className="h-4 w-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalRequests.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">All-time diagnostics</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Users</CardTitle>
              <Users className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.activeUsers}</div>
              <p className="text-xs text-muted-foreground">Using AI diagnostics</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg. Confidence</CardTitle>
              <TrendingUp className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.avgConfidence}%</div>
              <p className="text-xs text-muted-foreground">AI accuracy score</p>
            </CardContent>
          </Card>
        </div>

        {/* System Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-green-500" />
              System Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <Badge variant="secondary" className="bg-green-100 text-green-800">
                  AI Service: Online
                </Badge>
              </div>
              <div className="text-center">
                <Badge variant="secondary" className="bg-green-100 text-green-800">
                  Response Time: 2.1s
                </Badge>
              </div>
              <div className="text-center">
                <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                  Free Access: Enabled
                </Badge>
              </div>
              <div className="text-center">
                <Badge variant="secondary" className="bg-purple-100 text-purple-800">
                  Version: 2.1.0
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* AI Diagnostics Interface */}
        <AIDiagnostics 
          userRole={session.user.role}
          userId={session.user.id}
        />
      </div>
    </DashboardLayout>
  )
}


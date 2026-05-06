
'use client'

import { useState, useEffect } from 'react'
import { useSession } from '@/components/auth/custom-session-provider'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { 
  Users, 
  Calendar, 

  TrendingUp, 
  Activity, 
  UserCheck,
  Building2,
  BarChart3,
  Clock,
  AlertTriangle,
  RefreshCw
} from 'lucide-react'
import { PesoIcon, PesoSign } from '@/components/ui/peso-icon'
import Link from 'next/link'

interface AdminDashboardStats {
  totalPatients: number
  todayAppointments: number
  pendingBills: number
  monthlyRevenue: number
  patientGrowth: number
  appointmentGrowth: number
  activeStaff: number
}

export function AdminDashboardContent() {
  const { data: session } = useSession()
  const [stats, setStats] = useState<AdminDashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchDashboardData = async () => {
    try {
      setLoading(true)
      setError(null)
      
      console.log('🔍 AdminDashboard: Fetching stats...')
      const response = await fetch('/api/dashboard/stats', {
        credentials: 'include'
      })
      
      if (!response.ok) {
        throw new Error(`Failed to fetch stats: ${response.status}`)
      }
      
      const data = await response.json()
      console.log('📊 AdminDashboard: Stats received:', data)
      
      if (data.success && data.data) {
        setStats(data.data)
      } else {
        throw new Error('Invalid response format')
      }
    } catch (error) {
      console.error('💥 AdminDashboard: Error fetching stats:', error)
      setError(error instanceof Error ? error.message : 'Failed to load dashboard data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDashboardData()
  }, [])

  const handleRetry = () => {
    fetchDashboardData()
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div className="h-4 bg-muted rounded w-24"></div>
                <div className="h-4 w-4 bg-muted rounded"></div>
              </CardHeader>
              <CardContent>
                <div className="h-8 bg-muted rounded w-16 mb-2"></div>
                <div className="h-3 bg-muted rounded w-20"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Error Loading Dashboard
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">{error}</p>
            <Button onClick={handleRetry} variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!stats) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>No Data Available</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">No dashboard data could be loaded.</p>
            <Button onClick={handleRetry} variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              Reload
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const statCards = [
    {
      title: "Total Patients",
      value: stats.totalPatients.toLocaleString(),
      change: `+${stats.patientGrowth.toFixed(1)}%`,
      changeColor: stats.patientGrowth >= 0 ? "text-green-600" : "text-red-600",
      icon: Users,
      href: "/admin/patients"
    },
    {
      title: "Today's Appointments",
      value: stats.todayAppointments.toLocaleString(),
      change: `+${stats.appointmentGrowth.toFixed(1)}%`,
      changeColor: stats.appointmentGrowth >= 0 ? "text-green-600" : "text-red-600",
      icon: Calendar,
      href: "/admin/scheduling"
    },
    {
      title: "Monthly Revenue",
      value: `₱${stats.monthlyRevenue.toLocaleString()}`,
      change: "This month",
      changeColor: "text-muted-foreground",
      icon: PesoSign,
      href: "/admin/billing"
    },
    {
      title: "Active Staff",
      value: stats.activeStaff.toLocaleString(),
      change: "Currently online",
      changeColor: "text-muted-foreground",
      icon: UserCheck,
      href: "/admin/staff"
    }
  ]

  const quickActions = [
    {
      title: "Patient Management",
      description: "View and manage patient records",
      icon: Users,
      href: "/admin/patients",
      color: "bg-blue-500"
    },
    {
      title: "Appointments",
      description: "Schedule and manage appointments",
      icon: Calendar,
      href: "/admin/scheduling",
      color: "bg-green-500"
    },
    {
      title: "Analytics",
      description: "View practice analytics and reports",
      icon: BarChart3,
      href: "/admin/analytics",
      color: "bg-purple-500"
    },
    {
      title: "Staff Management",
      description: "Manage staff and permissions",
      icon: Building2,
      href: "/admin/staff",
      color: "bg-orange-500"
    }
  ]

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat, index) => (
          <Link key={index} href={stat.href}>
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
                <stat.icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
                <p className={`text-xs ${stat.changeColor}`}>{stat.change}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {quickActions.map((action, index) => (
          <Link key={index} href={action.href}>
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardHeader>
                <div className="flex items-center space-x-2">
                  <div className={`p-2 rounded-lg ${action.color}`}>
                    <action.icon className="h-4 w-4 text-white" />
                  </div>
                  <CardTitle className="text-base">{action.title}</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{action.description}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Recent Activity & Alerts */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <div>
                  <p className="text-sm font-medium">New patient registered</p>
                  <p className="text-xs text-muted-foreground">2 minutes ago</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                <div>
                  <p className="text-sm font-medium">Appointment scheduled</p>
                  <p className="text-xs text-muted-foreground">5 minutes ago</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                <div>
                  <p className="text-sm font-medium">Payment received</p>
                  <p className="text-xs text-muted-foreground">10 minutes ago</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Today's Schedule
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="text-center py-8 text-muted-foreground">
                <Calendar className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">
                  {stats.todayAppointments > 0 
                    ? `${stats.todayAppointments} appointments scheduled today` 
                    : 'No appointments scheduled for today'
                  }
                </p>
                <Link href="/admin/scheduling" className="text-primary hover:underline text-sm mt-2 inline-block">
                  View all appointments →
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="text-center text-sm text-muted-foreground">
        <p>Dashboard last updated: {new Date().toLocaleString()}</p>
        <Button onClick={handleRetry} variant="ghost" size="sm" className="mt-2">
          <RefreshCw className="h-3 w-3 mr-1" />
          Refresh Data
        </Button>
      </div>
    </div>
  )
}


'use client'

import { formatDisplayName } from '@/lib/utils'
import { useState, useEffect } from 'react'
import { useSession } from '@/components/auth/custom-session-provider'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { StatsCard } from '@/components/ui/stats-card'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  Users, 
  Calendar, 
  TrendingUp,
  BarChart3,
  Activity,
  AlertTriangle,
  CheckCircle,
  Clock,
  Package,
  Stethoscope,
  FileText,
  Banknote
} from 'lucide-react'
import { PesoIcon } from '@/components/ui/peso-icon'
import Link from 'next/link'

interface ManagerDashboardStats {
  totalPatients: number
  todayAppointments: number
  monthlyRevenue: number
  activeStaff: number
  completionRate: number
  averageWaitTime: number
}

export default function ManagerDashboard() {
  const { data: session } = useSession() || {}
  const [stats, setStats] = useState<ManagerDashboardStats | null>(null)
  const [recentAppointments, setRecentAppointments] = useState<any[]>([])
  const [staffPerformance, setStaffPerformance] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const [statsRes, appointmentsRes] = await Promise.all([
          fetch('/api/dashboard/stats', { credentials: 'include' }),
          fetch('/api/appointments?limit=10&recent=true')
        ])

        if (statsRes.ok) {
          const statsData = await statsRes.json()
          setStats(statsData.data)
        }

        if (appointmentsRes.ok) {
          const appointmentsData = await appointmentsRes.json()
          setRecentAppointments(appointmentsData.data?.appointments || [])
        }
      } catch (error) {
        console.error('Error fetching dashboard data:', error)
      } finally {
        setLoading(false)
      }
    }

    if (session?.user?.role === 'manager') {
      fetchDashboardData()
    }
  }, [session])

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800'
      case 'in_progress': return 'bg-blue-100 text-blue-800'
      case 'cancelled': return 'bg-red-100 text-red-800'
      case 'confirmed': return 'bg-yellow-100 text-yellow-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  if (loading) {
    return (
      <DashboardLayout title="Manager Dashboard">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout title="Manager Dashboard">
      <div className="space-y-6">
        {/* Welcome Section */}
        <div className="bg-gradient-to-r from-purple-600 to-indigo-600 rounded-lg p-6 text-white">
          <h1 className="text-2xl font-bold mb-2">
            Welcome back, {session?.user?.firstName}!
          </h1>
          <p className="text-purple-100">
            Monitor clinic performance, staff efficiency, and patient satisfaction.
          </p>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-6">
            <StatsCard
              title="Total Patients"
              value={stats.totalPatients}
              icon={Users}
              description="Registered patients"
            />
            <StatsCard
              title="Today's Appointments"
              value={stats.todayAppointments}
              icon={Calendar}
              description="Scheduled today"
            />
            <StatsCard
              title="Monthly Revenue"
              value={`₱${Number(stats.monthlyRevenue || 0).toFixed(0)}K`}
              icon={Banknote}
              description="This month"
            />
            <StatsCard
              title="Active Staff"
              value={stats.activeStaff}
              icon={Activity}
              description="On duty"
            />
            <StatsCard
              title="Completion Rate"
              value={`${stats.completionRate || 95}%`}
              icon={TrendingUp}
              description="This week"
            />
            <StatsCard
              title="Avg Wait Time"
              value={`${stats.averageWaitTime || 12}min`}
              icon={Clock}
              description="Today"
            />
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Activity */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center">
                <Activity className="w-5 h-5 mr-2" />
                Recent Appointments
              </CardTitle>
              <Link href="/manager/appointments">
                <Button variant="outline" size="sm">View All</Button>
              </Link>
            </CardHeader>
            <CardContent>
              {recentAppointments?.length > 0 ? (
                <div className="space-y-4">
                  {recentAppointments.slice(0, 6).map((appointment: any) => (
                    <div key={appointment.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-3 bg-gray-50 rounded-lg">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm sm:text-base break-anywhere">
                          {formatDisplayName(appointment.patient?.user?.firstName, appointment.patient?.user?.lastName)}
                        </p>
                        <p className="text-xs sm:text-sm text-gray-600 break-anywhere">
                          {appointment.appointmentType} with Dr. {appointment.dentist?.user?.lastName}
                        </p>
                        <p className="text-[10px] sm:text-xs text-gray-500">
                          {new Date(appointment.scheduledDatetime).toLocaleDateString()} at{' '}
                          {new Date(appointment.scheduledDatetime).toLocaleTimeString([], { 
                            hour: '2-digit', 
                            minute: '2-digit' 
                          })}
                        </p>
                      </div>
                      <Badge className={`${getStatusColor(appointment.status)} flex-shrink-0 self-start sm:self-center`}>
                        {appointment.status.replace('_', ' ').charAt(0).toUpperCase() + appointment.status.slice(1)}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">No recent appointments</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Performance Metrics */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <BarChart3 className="w-5 h-5 mr-2" />
                Performance Metrics
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">Patient Satisfaction</span>
                    <span className="text-sm text-gray-600">94%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div className="bg-green-600 h-2 rounded-full" style={{ width: '94%' }}></div>
                  </div>
                </div>
                
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">Appointment Efficiency</span>
                    <span className="text-sm text-gray-600">87%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div className="bg-blue-600 h-2 rounded-full" style={{ width: '87%' }}></div>
                  </div>
                </div>
                
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">Revenue Target</span>
                    <span className="text-sm text-gray-600">76%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div className="bg-purple-600 h-2 rounded-full" style={{ width: '76%' }}></div>
                  </div>
                </div>
                
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">Staff Utilization</span>
                    <span className="text-sm text-gray-600">92%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div className="bg-yellow-600 h-2 rounded-full" style={{ width: '92%' }}></div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Management Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Management Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Link href="/manager/staff">
                <Button className="w-full h-20 flex flex-col items-center justify-center">
                  <Users className="w-6 h-6 mb-2" />
                  Staff Management
                </Button>
              </Link>
              <Link href="/manager/reports">
                <Button variant="outline" className="w-full h-20 flex flex-col items-center justify-center">
                  <BarChart3 className="w-6 h-6 mb-2" />
                  Analytics & Reports
                </Button>
              </Link>
              <Link href="/manager/services">
                <Button variant="outline" className="w-full h-20 flex flex-col items-center justify-center hover:bg-cyan-50">
                  <Stethoscope className="w-6 h-6 mb-2 text-cyan-600" />
                  Services Management
                </Button>
              </Link>
              <Link href="/manager/inventory">
                <Button variant="outline" className="w-full h-20 flex flex-col items-center justify-center hover:bg-orange-50">
                  <Package className="w-6 h-6 mb-2 text-orange-600" />
                  Inventory Management
                </Button>
              </Link>
              <Link href="/manager/forms">
                <Button variant="outline" className="w-full h-20 flex flex-col items-center justify-center hover:bg-indigo-50">
                  <FileText className="w-6 h-6 mb-2 text-indigo-600" />
                  Form Management
                </Button>
              </Link>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
              <Link href="/manager/billing">
                <Button variant="outline" className="w-full h-20 flex flex-col items-center justify-center">
                  <PesoIcon className="w-6 h-6 mb-2" />
                  Financial Overview
                </Button>
              </Link>
              <Link href="/manager/patients">
                <Button variant="outline" className="w-full h-20 flex flex-col items-center justify-center">
                  <Activity className="w-6 h-6 mb-2" />
                  Patient Management
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Alerts and Notifications */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <AlertTriangle className="w-5 h-5 mr-2" />
              System Alerts & Notifications
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center space-x-3 p-3 bg-yellow-50 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-yellow-600" />
                <div>
                  <p className="font-medium text-yellow-900">Staff Schedule Alert</p>
                  <p className="text-sm text-yellow-700">Dr. Johnson has requested time off next Friday</p>
                </div>
                <Button variant="outline" size="sm">
                  Review
                </Button>
              </div>
              
              <div className="flex items-center space-x-3 p-3 bg-blue-50 rounded-lg">
                <CheckCircle className="w-5 h-5 text-blue-600" />
                <div>
                  <p className="font-medium text-blue-900">Monthly Report Ready</p>
                  <p className="text-sm text-blue-700">October performance report is available for review</p>
                </div>
                <Button variant="outline" size="sm">
                  View Report
                </Button>
              </div>
              
              <div className="flex items-center space-x-3 p-3 bg-green-50 rounded-lg">
                <TrendingUp className="w-5 h-5 text-green-600" />
                <div>
                  <p className="font-medium text-green-900">Performance Achievement</p>
                  <p className="text-sm text-green-700">Patient satisfaction reached 95% this month!</p>
                </div>
                <Button variant="outline" size="sm">
                  Share
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}

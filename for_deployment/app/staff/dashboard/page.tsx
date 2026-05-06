'use client'

import { formatDisplayName } from '@/lib/utils'
import { AnnouncementBanner } from '@/components/announcements/announcement-banner'
import { useState, useEffect } from 'react'
import { useSession } from '@/components/auth/custom-session-provider'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Calendar, Clock, Users, CheckCircle, AlertCircle, ChevronRight, UserPlus } from 'lucide-react'
import Link from 'next/link'

export default function StaffDashboard() {
  const { data: session } = useSession() || {}
  const [stats, setStats] = useState<any>(null)
  const [appointments, setAppointments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsRes, appointmentsRes] = await Promise.all([
          fetch('/api/dashboard/stats', { credentials: 'include' }),
          fetch('/api/appointments?date=today', { credentials: 'include' })
        ])

        if (statsRes.ok) {
          const data = await statsRes.json()
          setStats(data.data)
        }

        if (appointmentsRes.ok) {
          const data = await appointmentsRes.json()
          const appointmentsList = data.data?.appointments || []
          setAppointments(appointmentsList.slice(0, 5))
        }
      } catch (error) {
        console.error('Error fetching data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'checked_in': return 'bg-green-100 text-green-700'
      case 'in_progress': return 'bg-blue-100 text-blue-700'
      case 'waiting': return 'bg-amber-100 text-amber-700'
      case 'confirmed': return 'bg-emerald-100 text-emerald-700'
      case 'scheduled': return 'bg-sky-100 text-sky-700'
      case 'pending_assignment': return 'bg-orange-100 text-orange-700'
      default: return 'bg-gray-100 text-gray-700'
    }
  }

  const waitingCount = appointments.filter(a => a.status === 'checked_in' || a.status === 'waiting').length
  const inProgressCount = appointments.filter(a => a.status === 'in_progress').length
  const pendingAssignment = appointments.filter(a => a.status === 'pending_assignment').length

  return (
    <DashboardLayout title="Dashboard">
      <div className="max-w-4xl mx-auto space-y-6 p-4">
        <AnnouncementBanner placement="staff_dashboard" />
        {/* Greeting */}
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-gray-900">
            Hello, {session?.user?.firstName || 'Staff'}!
          </h1>
          <p className="text-gray-500">Today&apos;s clinic overview</p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card className="bg-white border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{appointments.length}</p>
                  <p className="text-xs text-gray-500">Today</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-white border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{waitingCount}</p>
                  <p className="text-xs text-gray-500">Waiting</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-white border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{inProgressCount}</p>
                  <p className="text-xs text-gray-500">In Progress</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-white border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-orange-50 flex items-center justify-center">
                  <AlertCircle className="w-5 h-5 text-orange-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{pendingAssignment}</p>
                  <p className="text-xs text-gray-500">Unassigned</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-3">
          <Link href="/staff/patients">
            <Card className="bg-gradient-to-r from-[#2D9DA8] to-[#4A90E2] border-0 shadow-md hover:shadow-lg transition-shadow cursor-pointer">
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3 text-white">
                  <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                    <Users className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-semibold">Patients</p>
                    <p className="text-sm opacity-90">Manage patients</p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-white" />
              </CardContent>
            </Card>
          </Link>
          
          <Link href="/admin/scheduling">
            <Card className="bg-gradient-to-r from-[#22B573] to-[#2D9DA8] border-0 shadow-md hover:shadow-lg transition-shadow cursor-pointer">
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3 text-white">
                  <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                    <Calendar className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-semibold">Appointments</p>
                    <p className="text-sm opacity-90">View schedule</p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-white" />
              </CardContent>
            </Card>
          </Link>
        </div>

        {/* Today's Appointments */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Today&apos;s Schedule</h2>
            <Link href="/admin/scheduling" className="text-sm text-[#2D9DA8] hover:underline">
              View all
            </Link>
          </div>
          
          {loading ? (
            <Card className="bg-white border-0 shadow-sm">
              <CardContent className="p-8 text-center text-gray-500">
                Loading...
              </CardContent>
            </Card>
          ) : appointments.length === 0 ? (
            <Card className="bg-white border-0 shadow-sm">
              <CardContent className="p-8 text-center">
                <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">No appointments today</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {appointments.map((apt) => (
                <Card key={apt.id} className="bg-white border-0 shadow-sm hover:shadow-md transition-shadow">
                  <CardContent className="p-3 sm:p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                          <span className="text-sm font-medium text-gray-600">
                            {apt.patient?.user?.firstName?.[0]}{apt.patient?.user?.lastName?.[0]}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-gray-900 text-sm sm:text-base break-anywhere">
                            {formatDisplayName(apt.patient?.user?.firstName, apt.patient?.user?.lastName)}
                          </p>
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs sm:text-sm text-gray-500">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5 flex-shrink-0" />
                              <span>{formatTime(apt.scheduledDatetime)}</span>
                            </span>
                            <span className="hidden sm:inline">•</span>
                            <span className="break-anywhere">{apt.appointmentType?.replace('_', ' ') || 'General'}</span>
                          </div>
                        </div>
                      </div>
                      <Badge className={`${getStatusColor(apt.status)} border-0 text-[10px] sm:text-xs flex-shrink-0 whitespace-nowrap`}>
                        {apt.status === 'pending_assignment' ? 'Unassigned' : 
                         apt.status === 'checked_in' ? 'Checked In' :
                         apt.status === 'in_progress' ? 'In Progress' :
                         apt.status.charAt(0).toUpperCase() + apt.status.slice(1)}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Quick Links */}
        <div className="grid grid-cols-3 gap-3">
          <Link href="/admin/scheduling?tab=queue">
            <Card className="bg-white border-0 shadow-sm hover:shadow-md transition-shadow cursor-pointer h-full">
              <CardContent className="p-4 flex flex-col items-center text-center">
                <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center mb-2">
                  <Clock className="w-5 h-5 text-gray-600" />
                </div>
                <p className="text-sm font-medium text-gray-700">Queue</p>
              </CardContent>
            </Card>
          </Link>
          
          <Link href="/staff/appointments/book">
            <Card className="bg-white border-0 shadow-sm hover:shadow-md transition-shadow cursor-pointer h-full">
              <CardContent className="p-4 flex flex-col items-center text-center">
                <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center mb-2">
                  <UserPlus className="w-5 h-5 text-gray-600" />
                </div>
                <p className="text-sm font-medium text-gray-700">New Booking</p>
              </CardContent>
            </Card>
          </Link>
          
          <Link href="/staff/profile">
            <Card className="bg-white border-0 shadow-sm hover:shadow-md transition-shadow cursor-pointer h-full">
              <CardContent className="p-4 flex flex-col items-center text-center">
                <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center mb-2">
                  <Users className="w-5 h-5 text-gray-600" />
                </div>
                <p className="text-sm font-medium text-gray-700">Profile</p>
              </CardContent>
            </Card>
          </Link>
        </div>
      </div>
    </DashboardLayout>
  )
}

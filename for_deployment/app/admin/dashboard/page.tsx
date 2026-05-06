'use client'

import { useState, useEffect } from 'react'
import { useSession } from '@/components/auth/custom-session-provider'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Calendar, Clock, Users, TrendingUp, ChevronRight, Settings, FileText } from 'lucide-react'
import Link from 'next/link'
import { AnnouncementBanner } from '@/components/announcements/announcement-banner'

export default function AdminDashboard() {
  const { data: session } = useSession() || {}
  const [stats, setStats] = useState<any>(null)
  const [queueStats, setQueueStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsRes, queueRes] = await Promise.all([
          fetch('/api/dashboard/stats', { credentials: 'include' }),
          fetch('/api/queue/monitor', { credentials: 'include' })
        ])

        if (statsRes.ok) {
          const data = await statsRes.json()
          setStats(data.data)
        }

        if (queueRes.ok) {
          const data = await queueRes.json()
          setQueueStats(data.data?.stats)
        }
      } catch (error) {
        console.error('Error fetching data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  return (
    <DashboardLayout title="Dashboard">
      <div className="max-w-5xl mx-auto space-y-6 p-4">
        <AnnouncementBanner placement="dashboard" />
        {/* Greeting */}
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-gray-900">
            Hello, {session?.user?.firstName || 'Admin'}!
          </h1>
          <p className="text-gray-500">Clinic overview and management</p>
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
                  <p className="text-2xl font-bold text-gray-900">{queueStats?.totalToday || 0}</p>
                  <p className="text-xs text-gray-500">Today&apos;s Appts</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-white border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{queueStats?.completed || 0}</p>
                  <p className="text-xs text-gray-500">Completed</p>
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
                  <p className="text-2xl font-bold text-gray-900">{queueStats?.waiting || 0}</p>
                  <p className="text-xs text-gray-500">Waiting</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-white border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-purple-50 flex items-center justify-center">
                  <Users className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{stats?.totalPatients || 0}</p>
                  <p className="text-xs text-gray-500">Total Patients</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Efficiency Card */}
        {queueStats && (
          <Card className="bg-gradient-to-r from-[#2D9DA8] to-[#4A90E2] border-0 shadow-md">
            <CardContent className="p-4">
              <div className="flex items-center justify-between text-white">
                <div>
                  <p className="text-sm opacity-90">Today&apos;s Efficiency</p>
                  <p className="text-3xl font-bold">{queueStats?.efficiency || 0}%</p>
                </div>
                <div className="text-right">
                  <p className="text-sm opacity-90">Avg Wait Time</p>
                  <p className="text-3xl font-bold">{queueStats?.avgWaitTime || 0} min</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Quick Actions */}
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-gray-900">Management</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <Link href="/admin/scheduling">
              <Card className="bg-white border-0 shadow-sm hover:shadow-md transition-shadow cursor-pointer h-full">
                <CardContent className="p-4 flex flex-col items-center text-center">
                  <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center mb-2">
                    <Calendar className="w-6 h-6 text-blue-600" />
                  </div>
                  <p className="font-medium text-gray-700">Appointments</p>
                  <p className="text-xs text-gray-500">Manage schedule</p>
                </CardContent>
              </Card>
            </Link>
            
            <Link href="/admin/staff">
              <Card className="bg-white border-0 shadow-sm hover:shadow-md transition-shadow cursor-pointer h-full">
                <CardContent className="p-4 flex flex-col items-center text-center">
                  <div className="w-12 h-12 rounded-full bg-green-50 flex items-center justify-center mb-2">
                    <Users className="w-6 h-6 text-green-600" />
                  </div>
                  <p className="font-medium text-gray-700">Staff</p>
                  <p className="text-xs text-gray-500">Team management</p>
                </CardContent>
              </Card>
            </Link>
            
            <Link href="/admin/analytics">
              <Card className="bg-white border-0 shadow-sm hover:shadow-md transition-shadow cursor-pointer h-full">
                <CardContent className="p-4 flex flex-col items-center text-center">
                  <div className="w-12 h-12 rounded-full bg-purple-50 flex items-center justify-center mb-2">
                    <TrendingUp className="w-6 h-6 text-purple-600" />
                  </div>
                  <p className="font-medium text-gray-700">Analytics</p>
                  <p className="text-xs text-gray-500">Reports & insights</p>
                </CardContent>
              </Card>
            </Link>
          </div>
        </div>

        {/* More Options */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <Link href="/admin/forms">
            <Card className="bg-white border-0 shadow-sm hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                  <FileText className="w-5 h-5 text-gray-600" />
                </div>
                <div>
                  <p className="font-medium text-gray-700">Forms</p>
                  <p className="text-xs text-gray-500">Auto-Attach Rules</p>
                </div>
              </CardContent>
            </Card>
          </Link>
          
          <Link href="/admin/settings">
            <Card className="bg-white border-0 shadow-sm hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                  <Settings className="w-5 h-5 text-gray-600" />
                </div>
                <div>
                  <p className="font-medium text-gray-700">Settings</p>
                  <p className="text-xs text-gray-500">Configuration</p>
                </div>
              </CardContent>
            </Card>
          </Link>
          
          <Link href="/queue-monitor">
            <Card className="bg-white border-0 shadow-sm hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-gray-600" />
                </div>
                <div>
                  <p className="font-medium text-gray-700">Queue</p>
                  <p className="text-xs text-gray-500">Live monitor</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>
      </div>
    </DashboardLayout>
  )
}

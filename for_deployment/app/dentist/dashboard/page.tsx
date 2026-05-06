
'use client'

import { useState, useEffect } from 'react'
import { useSession } from '@/components/auth/custom-session-provider'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Calendar, Clock, Users, Stethoscope, ChevronRight, HeartPulse } from 'lucide-react'
import Link from 'next/link'

export default function DentistDashboard() {
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
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-gray-900">
            Hello, Dr. {session?.user?.firstName || 'Doctor'}!
          </h1>
          <p className="text-muted-foreground">Here&apos;s your clinical overview for today</p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Today's Patients", value: queueStats?.totalInQueue || stats?.todayAppointments || 0, icon: Users, color: 'text-blue-600 bg-blue-50' },
            { label: 'In Queue', value: queueStats?.waiting || 0, icon: Clock, color: 'text-amber-600 bg-amber-50' },
            { label: 'Being Treated', value: queueStats?.inProgress || 0, icon: Stethoscope, color: 'text-green-600 bg-green-50' },
            { label: 'Total Patients', value: stats?.totalPatients || 0, icon: HeartPulse, color: 'text-purple-600 bg-purple-50' },
          ].map((stat, i) => (
            <Card key={i} className="border-0 shadow-sm">
              <CardContent className="p-4">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 ${stat.color}`}>
                  <stat.icon className="w-5 h-5" />
                </div>
                <p className="text-2xl font-bold">{loading ? '—' : stat.value}</p>
                <p className="text-xs text-muted-foreground mt-1">{stat.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Quick Links */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
          {[
            { name: 'My Patients', description: 'View patient records', href: '/admin/patients', icon: Users, color: 'bg-blue-50 hover:bg-blue-100' },
            { name: 'Dental Chart', description: 'Update dental charts', href: '/admin/chart', icon: HeartPulse, color: 'bg-green-50 hover:bg-green-100' },
            { name: 'Treatment Plans', description: 'Manage treatments', href: '/admin/treatment', icon: Stethoscope, color: 'bg-purple-50 hover:bg-purple-100' },
          ].map((link, i) => (
            <Link key={i} href={link.href}>
              <Card className={`border-0 shadow-sm transition-colors cursor-pointer ${link.color}`}>
                <CardContent className="p-5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <link.icon className="w-5 h-5 text-gray-600" />
                    <div>
                      <p className="font-medium text-sm">{link.name}</p>
                      <p className="text-xs text-muted-foreground">{link.description}</p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        {/* Info */}
        <Card className="border-0 shadow-sm bg-blue-50/50">
          <CardContent className="p-4 flex items-center gap-3">
            <Stethoscope className="w-5 h-5 text-blue-600" />
            <div>
              <p className="text-sm font-medium text-blue-900">Clinical View</p>
              <p className="text-xs text-blue-700">You have access to patient records, dental charts, and treatment plans. For administrative tasks, contact an admin.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}

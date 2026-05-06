'use client'

import { useSession } from '@/components/auth/custom-session-provider'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { EnhancedCalendar } from '@/components/calendar/enhanced-calendar'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import Link from 'next/link'
import { 
  Calendar, 
  Activity, 
  Zap, 
  ArrowRight,
  Users,
  Clock,
  Target
} from 'lucide-react'

export default function StaffCalendarPage() {
  const { data: session } = useSession() || {}

  if (!session?.user || !['receptionist', 'staff', 'admin', 'manager', 'super_admin', 'dentist'].includes(session.user.role)) {
    return (
      <DashboardLayout title="Staff Calendar">
        <div className="text-center py-8">
          <p className="text-gray-600">Access denied. Staff access required.</p>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout title="Staff Calendar">
      <div className="space-y-6 min-w-0 overflow-hidden">
        {/* Header with Navigation */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Staff Calendar</h1>
            <p className="text-gray-600">Manage appointments with drag & drop scheduling</p>
          </div>
          <div className="flex items-center space-x-3">
            <Link href="/calendar/advanced">
              <Button variant="outline" className="flex items-center space-x-2">
                <Activity className="w-4 h-4" />
                <span>Advanced Calendar</span>
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </div>
        </div>

        {/* Status Definitions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Appointment Status Guide</CardTitle>
              <CardDescription>Understanding the difference between appointment statuses</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-start space-x-3">
                  <div className="w-3 h-3 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                  <div>
                    <h4 className="font-medium text-blue-900">Pending</h4>
                    <p className="text-sm text-gray-600">
                      Newly scheduled appointments awaiting confirmation from the patient or clinic
                    </p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-3 h-3 bg-yellow-500 rounded-full mt-2 flex-shrink-0"></div>
                  <div>
                    <h4 className="font-medium text-yellow-800">Waiting</h4>
                    <p className="text-sm text-gray-600">
                      Patient has checked in and is waiting to be seen by the dentist
                    </p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-3 h-3 bg-green-500 rounded-full mt-2 flex-shrink-0"></div>
                  <div>
                    <h4 className="font-medium text-green-800">Confirmed</h4>
                    <p className="text-sm text-gray-600">
                      Appointment is confirmed and scheduled
                    </p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-3 h-3 bg-purple-500 rounded-full mt-2 flex-shrink-0"></div>
                  <div>
                    <h4 className="font-medium text-purple-800">In Progress</h4>
                    <p className="text-sm text-gray-600">
                      Patient is currently being treated by the dentist
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
              <CardDescription>Frequently used calendar operations</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <Button className="w-full justify-start">
                  <Calendar className="w-4 h-4 mr-2" />
                  Book New Appointment
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  <Clock className="w-4 h-4 mr-2" />
                  View Today's Schedule
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  <Users className="w-4 h-4 mr-2" />
                  Manage Patient Queue
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Feature Callout */}
        <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2 text-blue-900">
              <Zap className="w-5 h-5" />
              <span>Try the Advanced Calendar System</span>
            </CardTitle>
            <CardDescription>
              Experience MS Teams-style scheduling with enhanced features including resource management, 
              conflict detection, timeline views, and advanced analytics.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div className="flex items-center space-x-6">
                <div className="flex items-center space-x-2 text-sm text-blue-700">
                  <Users className="w-4 h-4" />
                  <span>Resource Management</span>
                </div>
                <div className="flex items-center space-x-2 text-sm text-blue-700">
                  <Clock className="w-4 h-4" />
                  <span>Conflict Detection</span>
                </div>
                <div className="flex items-center space-x-2 text-sm text-blue-700">
                  <Target className="w-4 h-4" />
                  <span>Timeline Views</span>
                </div>
              </div>
              <Link href="/calendar/advanced">
                <Button size="sm" className="bg-blue-600 hover:bg-blue-700">
                  <Activity className="w-4 h-4 mr-2" />
                  Explore Advanced Features
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Enhanced Calendar */}
        <EnhancedCalendar userRole="staff" />
      </div>
    </DashboardLayout>
  )
}
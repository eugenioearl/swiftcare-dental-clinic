
'use client'

import { useSession } from '@/components/auth/custom-session-provider'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { AdvancedCalendarSystem } from '@/components/calendar/advanced-calendar-system'
import { EnhancedCalendar } from '@/components/calendar/enhanced-calendar'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { 
  Calendar, 
  Activity, 
  Users, 
  Clock, 
  Target, 
  Zap,
  Settings,
  BarChart3,
  TrendingUp
} from 'lucide-react'

export default function AdvancedCalendarPage() {
  const { data: session, status } = useSession() || {}
  const router = useRouter()
  const [currentDentistId, setCurrentDentistId] = useState<string | undefined>()
  const [conflicts, setConflicts] = useState<any[]>([])
  const [resources, setResources] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (status === 'loading') return
    
    if (!session?.user) {
      router.push('/auth/signin')
      return
    }

    if (!['admin', 'dentist', 'staff'].includes(session.user.role)) {
      router.push('/dashboard')
      return
    }
  }, [session, status, router])

  // Get current dentist ID for dentist users
  useEffect(() => {
    const fetchDentistId = async () => {
      if (session?.user?.role === 'dentist') {
        try {
          const response = await fetch('/api/dentists')
          if (response.ok) {
            const data = await response.json()
            const currentDentist = data.data?.dentists?.find((d: any) => 
              d.user.email === session.user.email
            )
            setCurrentDentistId(currentDentist?.id)
          }
        } catch (error) {
          console.error('Error fetching dentist info:', error)
        }
      }
    }

    fetchDentistId()
  }, [session])

  // Fetch conflicts and resources
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        
        // Fetch conflicts
        const conflictsResponse = await fetch('/api/calendar/conflicts')
        if (conflictsResponse.ok) {
          const conflictsData = await conflictsResponse.json()
          setConflicts(conflictsData.data?.conflicts || [])
        }

        // Fetch resources
        const resourcesResponse = await fetch('/api/calendar/resources')
        if (resourcesResponse.ok) {
          const resourcesData = await resourcesResponse.json()
          setResources(resourcesData.data?.resources || [])
        }
      } catch (error) {
        console.error('Error fetching calendar data:', error)
      } finally {
        setLoading(false)
      }
    }

    if (session?.user) {
      fetchData()
    }
  }, [session])

  if (status === 'loading' || loading) {
    return (
      <DashboardLayout title="Advanced Calendar">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </DashboardLayout>
    )
  }

  if (!session?.user || !['admin', 'dentist', 'staff'].includes(session.user.role)) {
    return (
      <DashboardLayout title="Advanced Calendar">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <h3 className="text-lg font-medium text-gray-900">Access Denied</h3>
            <p className="text-gray-600">You don't have permission to access the advanced calendar.</p>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  const userRole = session.user.role === 'receptionist' ? 'staff' : session.user.role as 'staff' | 'dentist' | 'admin' | 'manager'

  return (
    <DashboardLayout title="Advanced Calendar">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Advanced Calendar System</h1>
            <p className="text-gray-600 mt-1">MS Teams-style scheduling with drag & drop, conflict detection, and resource management</p>
          </div>
          <div className="flex items-center space-x-3">
            {conflicts.length > 0 && (
              <Badge variant="destructive" className="flex items-center space-x-1">
                <Zap className="w-3 h-3" />
                <span>{conflicts.length} Conflicts</span>
              </Badge>
            )}
            <Badge variant="secondary" className="flex items-center space-x-1">
              <Users className="w-3 h-3" />
              <span>{resources.filter(r => r.type === 'dentist').length} Dentists</span>
            </Badge>
            <Badge variant="outline" className="flex items-center space-x-1">
              <Target className="w-3 h-3" />
              <span>{resources.filter(r => r.type === 'room').length} Rooms</span>
            </Badge>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-3">
                <Calendar className="w-8 h-8 text-blue-500" />
                <div>
                  <p className="text-sm text-gray-600">Active Resources</p>
                  <p className="text-2xl font-bold">{resources.filter(r => r.isAvailable).length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-3">
                <Activity className="w-8 h-8 text-green-500" />
                <div>
                  <p className="text-sm text-gray-600">Schedule Conflicts</p>
                  <p className="text-2xl font-bold text-red-600">{conflicts.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-3">
                <Clock className="w-8 h-8 text-orange-500" />
                <div>
                  <p className="text-sm text-gray-600">Available Dentists</p>
                  <p className="text-2xl font-bold">{resources.filter(r => r.type === 'dentist' && r.isAvailable).length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-3">
                <BarChart3 className="w-8 h-8 text-purple-500" />
                <div>
                  <p className="text-sm text-gray-600">Room Utilization</p>
                  <p className="text-2xl font-bold">
                    {Math.round((resources.filter(r => r.type === 'room' && r.isAvailable).length / Math.max(1, resources.filter(r => r.type === 'room').length)) * 100)}%
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Helpful Info Banner */}
        {resources.filter(r => r.type === 'dentist').length === 0 && (
          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="p-6">
              <div className="flex items-start space-x-4">
                <Calendar className="w-8 h-8 text-blue-600 flex-shrink-0 mt-1" />
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-blue-900 mb-2">Welcome to Advanced Calendar</h3>
                  <p className="text-blue-800 mb-3">
                    The advanced calendar system provides MS Teams-style scheduling with drag & drop, conflict detection, and resource management.
                  </p>
                  <p className="text-blue-700 text-sm">
                    <strong>Note:</strong> To see appointments and resources, make sure your clinic has dentists registered and appointments scheduled.
                    Navigate to the Staff or Admin section to add dentists and create appointments.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Calendar Interface */}
        <Tabs defaultValue="advanced" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="advanced" className="flex items-center space-x-2">
              <TrendingUp className="w-4 h-4" />
              <span>Advanced Calendar</span>
            </TabsTrigger>
            <TabsTrigger value="standard" className="flex items-center space-x-2">
              <Calendar className="w-4 h-4" />
              <span>Standard View</span>
            </TabsTrigger>
            <TabsTrigger value="analytics" className="flex items-center space-x-2">
              <BarChart3 className="w-4 h-4" />
              <span>Analytics</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="advanced" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Activity className="w-5 h-5" />
                  <span>MS Teams-Style Calendar</span>
                </CardTitle>
                <CardDescription>
                  Advanced scheduling with drag & drop, conflict detection, resource management, and real-time updates.
                  Features multiple view modes, timeline visualization, and intelligent conflict resolution.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <AdvancedCalendarSystem
                  userRole={userRole}
                  currentUserId={currentDentistId}
                  allowedActions={['create', 'edit', 'delete', 'assign', 'reschedule']}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="standard" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Calendar className="w-5 h-5" />
                  <span>Standard Calendar View</span>
                </CardTitle>
                <CardDescription>
                  Traditional calendar interface with drag & drop functionality and appointment management.
                  Optimized for quick scheduling and day-to-day operations.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <EnhancedCalendar
                  userRole={userRole}
                  currentUserId={currentDentistId}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="analytics" className="space-y-6">
            {/* Conflicts Analysis */}
            {conflicts.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2 text-red-600">
                    <Zap className="w-5 h-5" />
                    <span>Schedule Conflicts ({conflicts.length})</span>
                  </CardTitle>
                  <CardDescription>
                    These appointments have scheduling conflicts that require immediate attention.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {conflicts.slice(0, 5).map((conflict, index) => (
                      <div key={index} className="border rounded-lg p-4 bg-red-50 border-red-200">
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-medium text-red-900">{conflict.patientName}</h4>
                            <p className="text-sm text-red-700">
                              Appointment #{conflict.appointmentNumber}
                            </p>
                            <p className="text-xs text-red-600">
                              {new Date(conflict.scheduledDatetime).toLocaleString()}
                            </p>
                            {conflict.dentistName && (
                              <p className="text-xs text-red-600">with {conflict.dentistName}</p>
                            )}
                          </div>
                          <Badge variant="destructive">
                            {conflict.conflicts.length} issue{conflict.conflicts.length > 1 ? 's' : ''}
                          </Badge>
                        </div>
                        <div className="mt-3 space-y-1">
                          {conflict.conflicts.map((issue: any, issueIndex: number) => (
                            <p key={issueIndex} className="text-sm text-red-700 bg-red-100 rounded px-2 py-1">
                              {issue.details}
                            </p>
                          ))}
                        </div>
                      </div>
                    ))}
                    {conflicts.length > 5 && (
                      <p className="text-sm text-gray-600 text-center">
                        And {conflicts.length - 5} more conflicts...
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Resource Utilization */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <BarChart3 className="w-5 h-5" />
                  <span>Resource Utilization</span>
                </CardTitle>
                <CardDescription>
                  Current status and availability of clinic resources.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {/* Dentists */}
                  <div>
                    <h4 className="font-medium text-gray-900 mb-3 flex items-center">
                      <Users className="w-4 h-4 mr-2" />
                      Dentists ({resources.filter(r => r.type === 'dentist').length})
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {resources.filter(r => r.type === 'dentist').map((dentist) => (
                        <div key={dentist.id} className="border rounded-lg p-3 bg-white">
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <p className="font-medium text-sm">{dentist.name}</p>
                              <p className="text-xs text-gray-600">{dentist.description}</p>
                            </div>
                            <Badge variant={dentist.isAvailable ? 'default' : 'secondary'}>
                              {dentist.isAvailable ? 'Available' : 'Busy'}
                            </Badge>
                          </div>
                          {dentist.utilizationPercent !== undefined && (
                            <div className="mt-2">
                              <div className="flex justify-between text-xs text-gray-600 mb-1">
                                <span>Utilization</span>
                                <span>{dentist.utilizationPercent}%</span>
                              </div>
                              <div className="w-full bg-gray-200 rounded-full h-2">
                                <div 
                                  className={`h-2 rounded-full ${
                                    dentist.utilizationPercent > 80 ? 'bg-red-500' : 
                                    dentist.utilizationPercent > 60 ? 'bg-yellow-500' : 'bg-green-500'
                                  }`}
                                  style={{ width: `${dentist.utilizationPercent}%` }}
                                ></div>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Rooms */}
                  <div>
                    <h4 className="font-medium text-gray-900 mb-3 flex items-center">
                      <Target className="w-4 h-4 mr-2" />
                      Rooms ({resources.filter(r => r.type === 'room').length})
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {resources.filter(r => r.type === 'room').map((room) => (
                        <div key={room.id} className="border rounded-lg p-3 bg-white">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="font-medium text-sm">{room.name}</p>
                              <p className="text-xs text-gray-600">{room.description}</p>
                              {room.capacity && (
                                <p className="text-xs text-gray-500">Capacity: {room.capacity}</p>
                              )}
                            </div>
                            <Badge variant={room.isAvailable ? 'default' : 'secondary'}>
                              {room.isAvailable ? 'Available' : 'Occupied'}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Equipment */}
                  <div>
                    <h4 className="font-medium text-gray-900 mb-3 flex items-center">
                      <Settings className="w-4 h-4 mr-2" />
                      Equipment ({resources.filter(r => r.type === 'equipment').length})
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {resources.filter(r => r.type === 'equipment').map((equipment) => (
                        <div key={equipment.id} className="border rounded-lg p-3 bg-white">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="font-medium text-sm">{equipment.name}</p>
                              <p className="text-xs text-gray-600">{equipment.description}</p>
                              {equipment.location && (
                                <p className="text-xs text-gray-500">Location: {equipment.location}</p>
                              )}
                            </div>
                            <Badge variant={equipment.isAvailable ? 'default' : 'secondary'}>
                              {equipment.isAvailable ? 'Available' : 'In Use'}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  )
}


'use client'

import { formatDisplayName } from '@/lib/utils'
import { useState, useEffect } from 'react'
import { useSession } from '@/components/auth/custom-session-provider'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Users, Search, UserPlus, Calendar, TrendingUp, Clock } from 'lucide-react'

export default function ManagerStaffPage() {
  const { data: session } = useSession() || {}
  const [staff, setStaff] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    const fetchStaff = async () => {
      try {
        // Mock staff data
        setStaff([
          {
            id: '1',
            user: { firstName: 'Dr. Emily', lastName: 'Smith', email: 'dr.smith@swiftcare.com' },
            employeeId: 'DOC-001',
            department: 'Clinical',
            position: 'General Dentist',
            isActive: true,
            schedule: 'Full-time',
            performance: 95
          },
          {
            id: '2',
            user: { firstName: 'Jennifer', lastName: 'Davis', email: 'jennifer@swiftcare.com' },
            employeeId: 'REC-001',
            department: 'Front Office',
            position: 'Receptionist',
            isActive: true,
            schedule: 'Full-time',
            performance: 88
          },
          {
            id: '3',
            user: { firstName: 'Lisa', lastName: 'Brown', email: 'lisa@swiftcare.com' },
            employeeId: 'REC-002',
            department: 'Front Office',
            position: 'Senior Receptionist',
            isActive: true,
            schedule: 'Part-time',
            performance: 92
          }
        ])
      } catch (error) {
        console.error('Error fetching staff:', error)
      } finally {
        setLoading(false)
      }
    }

    if (session?.user?.role === 'manager') {
      fetchStaff()
    }
  }, [session])

  const filteredStaff = staff.filter(member =>
    formatDisplayName(member.user?.firstName, member.user?.lastName)
      .toLowerCase()
      .includes(searchTerm.toLowerCase()) ||
    member.employeeId.toLowerCase().includes(searchTerm.toLowerCase())
  )

  if (loading) {
    return (
      <DashboardLayout title="Staff Management">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout title="Staff Management">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Staff Management</h1>
            <p className="text-gray-600">Manage staff schedules, performance, and assignments</p>
          </div>
          <Button>
            <UserPlus className="w-4 h-4 mr-2" />
            Add Staff Member
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Active Staff</p>
                  <p className="text-2xl font-bold text-gray-900">{staff.filter(s => s.isActive).length}</p>
                </div>
                <Users className="w-8 h-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">On Schedule Today</p>
                  <p className="text-2xl font-bold text-gray-900">6</p>
                </div>
                <Clock className="w-8 h-8 text-green-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Avg Performance</p>
                  <p className="text-2xl font-bold text-gray-900">92%</p>
                </div>
                <TrendingUp className="w-8 h-8 text-purple-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Departments</p>
                  <p className="text-2xl font-bold text-gray-900">3</p>
                </div>
                <Users className="w-8 h-8 text-orange-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="performance">Performance</TabsTrigger>
            <TabsTrigger value="schedule">Schedule</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <Card>
              <CardHeader>
                <CardTitle className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
                  <span>Staff Directory</span>
                  <div className="relative w-full sm:w-auto">
                    <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                    <Input
                      placeholder="Search staff..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10 w-full sm:w-64"
                    />
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {filteredStaff.length > 0 ? (
                  <div className="space-y-4">
                    {filteredStaff.map((member: any) => (
                      <div key={member.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 sm:p-4 bg-gray-50 rounded-lg">
                        <div className="flex items-start gap-3 sm:items-center sm:gap-4 min-w-0 flex-1">
                          <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                            <Users className="w-5 h-5 text-primary" />
                          </div>
                          <div className="min-w-0">
                            <h3 className="font-medium text-sm sm:text-base break-anywhere">
                              {formatDisplayName(member.user?.firstName, member.user?.lastName)}
                            </h3>
                            <p className="text-xs sm:text-sm text-gray-600 break-anywhere">
                              {member.position} • {member.department}
                            </p>
                            <p className="text-[10px] sm:text-xs text-gray-500 break-anywhere">
                              ID: {member.employeeId} • {member.schedule}
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 sm:flex-shrink-0">
                          <Badge className="bg-green-100 text-green-800 text-[10px] sm:text-xs">
                            {member.performance}% Performance
                          </Badge>
                          <Badge variant={member.isActive ? 'default' : 'secondary'} className="text-[10px] sm:text-xs">
                            {member.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                          <Button variant="outline" size="sm">
                            <Calendar className="w-4 h-4 mr-1" />
                            Schedule
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600">No staff members found</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="performance">
            <Card>
              <CardHeader>
                <CardTitle>Performance Metrics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {staff.map((member: any) => (
                    <div key={member.id} className="p-4 bg-gray-50 rounded-lg">
                      <div className="flex justify-between items-center mb-2">
                        <h3 className="font-medium">
                          {formatDisplayName(member.user?.firstName, member.user?.lastName)}
                        </h3>
                        <span className="text-sm font-medium">{member.performance}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full"
                          style={{ width: `${member.performance}%` }}
                        />
                      </div>
                      <p className="text-sm text-gray-600 mt-1">{member.position}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="schedule">
            <Card>
              <CardHeader>
                <CardTitle>Weekly Schedule</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">Schedule management interface coming soon</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  )
}

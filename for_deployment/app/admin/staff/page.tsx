
'use client'

import { useSession } from '@/components/auth/custom-session-provider'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import ComprehensiveStaffManagement from '@/components/admin/comprehensive-staff-management'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

export default function AdminStaffPage() {
  const { data: session, status } = useSession() || {}
  const router = useRouter()

  useEffect(() => {
    if (status === 'loading') return
    
    if (!session?.user) {
      router.push('/auth/signin')
      return
    }

    if (!['admin', 'super_admin', 'manager', 'dentist'].includes(session.user.role)) {
      router.push('/dashboard')
      return
    }
  }, [session, status, router])

  if (status === 'loading') {
    return (
      <DashboardLayout title="Staff Management">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </DashboardLayout>
    )
  }

  if (!session?.user || !['admin', 'super_admin', 'manager', 'dentist'].includes(session.user.role)) {
    return (
      <DashboardLayout title="Staff Management">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <h3 className="text-lg font-medium text-gray-900">Access Denied</h3>
            <p className="text-gray-600">You don't have permission to access this page.</p>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout title="Staff Management">
      <ComprehensiveStaffManagement />
    </DashboardLayout>
  )
}

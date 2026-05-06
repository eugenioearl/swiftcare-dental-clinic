
'use client'

import { useSession } from '@/components/auth/custom-session-provider'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import ServicesManagement from '@/components/admin/services-management'

export default function ManagerServicesPage() {
  const { data: session, status } = useSession() || {}
  const router = useRouter()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (status === 'loading') return

    if (!session?.user) {
      router.push('/auth/signin')
      return
    }

    // Check if user has permissions to manage treatments/services
    if (!['admin', 'super_admin', 'manager', 'dentist'].includes(session.user.role)) {
      router.push('/manager/dashboard')
      return
    }

    setLoading(false)
  }, [session, status, router])

  if (status === 'loading' || loading) {
    return (
      <DashboardLayout title="Services & Procedures Management">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout title="Services & Procedures Management">
      <ServicesManagement />
    </DashboardLayout>
  )
}


'use client'

import { useSession } from '@/components/auth/custom-session-provider'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import FormManagementV2 from '@/components/admin/form-management-v2'

export default function AdminFormsPage() {
  const { data: session, status } = useSession() || {}
  const router = useRouter()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (status === 'loading') return

    if (!session?.user) {
      router.push('/auth/signin')
      return
    }

    // Only admin and super_admin can manage form templates
    if (!['admin', 'super_admin'].includes(session.user.role)) {
      router.push('/admin/dashboard')
      return
    }

    setLoading(false)
  }, [session, status, router])

  if (status === 'loading' || loading) {
    return (
      <DashboardLayout title="Forms & Auto-Attach Rules">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout title="Forms & Auto-Attach Rules">
      <FormManagementV2 />
    </DashboardLayout>
  )
}

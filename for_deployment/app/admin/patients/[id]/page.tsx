'use client'

import { useSession } from '@/components/auth/custom-session-provider'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { useRouter, useParams } from 'next/navigation'
import { useEffect } from 'react'
import PatientDetailView from '@/components/admin/patient-detail-view'

export default function AdminPatientDetailPage() {
  const { data: session, status } = useSession() || {}
  const router = useRouter()
  const params = useParams()
  const patientId = params.id as string

  useEffect(() => {
    if (status === 'loading') return
    if (!session?.user) {
      router.push('/auth/signin')
      return
    }
    if (!['admin', 'super_admin', 'manager', 'dentist'].includes(session.user.role)) {
      router.push('/dashboard')
    }
  }, [session, status, router])

  if (status === 'loading' || !session?.user) {
    return (
      <DashboardLayout title="Patient Record">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout title="Patient Record">
      <PatientDetailView patientId={patientId} />
    </DashboardLayout>
  )
}

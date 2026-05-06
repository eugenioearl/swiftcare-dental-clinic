'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from '@/components/auth/custom-session-provider'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { PatientCheckInPanel } from '@/components/scheduling/patient-checkin-panel'
import { Card, CardContent } from '@/components/ui/card'
import { ClipboardList, QrCode, UserCheck } from 'lucide-react'

const ALLOWED = ['admin', 'super_admin', 'manager', 'staff', 'receptionist', 'dentist']

export default function StaffCheckInPage() {
  const { data: session, status } = useSession() || {}
  const router = useRouter()

  useEffect(() => {
    if (status === 'loading') return
    if (!session?.user) {
      router.replace('/auth/signin')
      return
    }
    if (!ALLOWED.includes(session.user.role)) {
      router.replace('/dashboard')
    }
  }, [session, status, router])

  if (status === 'loading' || !session?.user) {
    return (
      <DashboardLayout title="Check-In">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout title="Check-In">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-lg bg-gradient-to-br from-[#2D9DA8] to-[#4A90E2] flex items-center justify-center shadow-sm">
              <UserCheck className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 leading-tight">Patient Check-In</h1>
              <p className="text-sm text-gray-500">Prepare consent forms, share a signing link or QR, then check the patient in.</p>
            </div>
          </div>
        </div>

        {/* Helper strip */}
        <Card className="overflow-hidden border-0 shadow-sm bg-gradient-to-r from-[#2D9DA8]/5 to-[#4A90E2]/5">
          <CardContent className="py-3">
            <div className="flex items-center gap-4 flex-wrap text-xs font-medium text-gray-600">
              <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-blue-100 text-blue-700">
                <ClipboardList className="w-3.5 h-3.5" /> 1. Prepare Required Forms
              </span>
              <span className="text-gray-400">→</span>
              <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-amber-100 text-amber-700">
                <QrCode className="w-3.5 h-3.5" /> 2. Share QR or Link with Patient
              </span>
              <span className="text-gray-400">→</span>
              <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-emerald-100 text-emerald-700">
                <UserCheck className="w-3.5 h-3.5" /> 3. Check-In once signed
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Panel */}
        <PatientCheckInPanel />
      </div>
    </DashboardLayout>
  )
}

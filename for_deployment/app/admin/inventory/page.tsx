
'use client'

import { useSession } from '@/components/auth/custom-session-provider'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import InventoryManagement from '@/components/admin/inventory-management'

export default function AdminInventoryPage() {
  const { data: session, status } = useSession() || {}
  const router = useRouter()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (status === 'loading') return

    if (!session?.user) {
      router.push('/auth/signin')
      return
    }

    // Check if user has permissions to manage inventory
    if (!['admin', 'super_admin', 'manager', 'staff'].includes(session.user.role)) {
      router.push('/admin/dashboard')
      return
    }

    setLoading(false)
  }, [session, status, router])

  if (status === 'loading' || loading) {
    return (
      <DashboardLayout title="Inventory Management">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout title="Inventory Management">
      <InventoryManagement />
    </DashboardLayout>
  )
}

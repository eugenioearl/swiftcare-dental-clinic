
'use client'

import { useSession } from '@/components/auth/custom-session-provider'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import InventoryAutoDeduction from '@/components/inventory/inventory-auto-deduction'

export default function AdminInventoryAutoPage() {
  const { data: session } = useSession() || {}

  return (
    <DashboardLayout title="Inventory Auto-deduction System">
      <InventoryAutoDeduction />
    </DashboardLayout>
  )
}

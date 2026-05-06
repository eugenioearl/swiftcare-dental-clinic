'use client'

import { useState, useEffect } from 'react'
import { Badge } from '@/components/ui/badge'
import {
  AlertTriangle, Shield, DollarSign, FileText, Clock, CheckCircle,
  Package, Calendar, ArrowRight, Loader2
} from 'lucide-react'

interface OperationalAlertsProps {
  patientId: string
  refreshKey?: number
  onAction?: (type: string) => void
}

interface Alert {
  type: 'warning' | 'info' | 'success' | 'action'
  icon: string
  message: string
  detail?: string
  actionLabel?: string
  actionType?: string
}

export default function OperationalAlerts({ patientId, refreshKey, onAction }: OperationalAlertsProps) {
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchAlerts = async () => {
      try {
        const [statsRes, workflowRes, consentsRes] = await Promise.all([
          fetch(`/api/patients/${patientId}/stats`),
          fetch(`/api/patients/${patientId}/workflow-status`),
          fetch(`/api/patients/${patientId}/consents`)
        ])

        const stats = await statsRes.json()
        const workflow = await workflowRes.json()
        const consentsData = await consentsRes.json()
        const consents = consentsData.consents || []

        const newAlerts: Alert[] = []

        // Workflow guidance
        if (workflow.currentStep && workflow.currentStep !== 'no_appointment' && workflow.currentStep !== 'all_done') {
          newAlerts.push({
            type: 'action',
            icon: 'workflow',
            message: `Next step: ${workflow.nextAction}`,
            actionLabel: workflow.nextAction,
            actionType: workflow.currentStep
          })
        }

        // Unsigned consents
        const unsigned = consents.filter((c: any) => ['draft', 'sent', 'viewed'].includes(c.status))
        if (unsigned.length > 0) {
          newAlerts.push({
            type: 'warning',
            icon: 'consent',
            message: `${unsigned.length} consent${unsigned.length > 1 ? 's' : ''} awaiting signature`,
            detail: unsigned.map((c: any) => c.title).join(', '),
            actionLabel: 'View Consents',
            actionType: 'scroll_consent'
          })
        }

        // Outstanding balance
        if (stats.totalBalance > 0) {
          newAlerts.push({
            type: 'warning',
            icon: 'payment',
            message: `₱${stats.totalBalance.toLocaleString()} outstanding balance`,
            detail: `Across ${stats.activePackageCount} active package${stats.activePackageCount > 1 ? 's' : ''}`,
            actionLabel: 'Record Payment',
            actionType: 'scroll_payment'
          })
        }

        // Coverage info
        if (stats.totalCoverage > 0) {
          newAlerts.push({
            type: 'info',
            icon: 'coverage',
            message: `₱${stats.totalCoverage.toLocaleString()} covered under active packages`,
          })
        }

        // No active packages
        if (stats.activePackageCount === 0 && stats.totalVisits > 0) {
          newAlerts.push({
            type: 'info',
            icon: 'package',
            message: 'No active treatment package',
            detail: 'Create a package to track treatments & payments',
            actionLabel: 'Create Package',
            actionType: 'scroll_package'
          })
        }

        // All clear!
        if (stats.totalBalance === 0 && unsigned.length === 0 && stats.activePackageCount > 0) {
          newAlerts.push({
            type: 'success',
            icon: 'check',
            message: 'All payments current, consents signed',
          })
        }

        setAlerts(newAlerts)
      } catch {
        console.error('Failed to fetch alerts')
      } finally {
        setLoading(false)
      }
    }
    fetchAlerts()
  }, [patientId, refreshKey])

  if (loading) return null
  if (alerts.length === 0) return null

  const iconMap: Record<string, any> = {
    workflow: ArrowRight,
    consent: Shield,
    payment: DollarSign,
    coverage: Package,
    package: Package,
    check: CheckCircle
  }

  const typeColors: Record<string, string> = {
    warning: 'bg-orange-50 border-orange-200 text-orange-800',
    info: 'bg-blue-50 border-blue-200 text-blue-800',
    success: 'bg-green-50 border-green-200 text-green-800',
    action: 'bg-[#2D9DA8]/5 border-[#2D9DA8]/20 text-[#2D9DA8]',
  }

  return (
    <div className="space-y-1.5">
      {alerts.slice(0, 4).map((alert, idx) => {
        const Icon = iconMap[alert.icon] || AlertTriangle
        return (
          <div
            key={idx}
            className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-xs ${typeColors[alert.type] || typeColors.info} ${
              alert.actionType ? 'cursor-pointer hover:opacity-80' : ''
            }`}
            onClick={() => alert.actionType && onAction?.(alert.actionType)}
          >
            <Icon className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="font-medium">{alert.message}</p>
              {alert.detail && <p className="opacity-70 truncate">{alert.detail}</p>}
            </div>
            {alert.actionLabel && (
              <span className="text-[10px] font-semibold whitespace-nowrap opacity-70">
                {alert.actionLabel} →
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}

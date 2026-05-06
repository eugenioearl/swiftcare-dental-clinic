'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  TrendingUp, DollarSign, Calendar, Package, Shield, AlertCircle, Clock, Activity
} from 'lucide-react'
import { format, parseISO } from 'date-fns'

interface PatientStatsProps {
  patientId: string
  refreshKey?: number
}

interface Stats {
  totalVisits: number
  totalSpent: number
  totalCoverage: number
  totalBalance: number
  totalTreatmentValue: number
  activePackageCount: number
  packageCount: number
  unsignedConsents: number
  lastVisit: { scheduledDatetime: string; appointmentType: string | null } | null
  nextAppointment: { scheduledDatetime: string; appointmentType: string | null } | null
}

export default function PatientStatsCard({ patientId, refreshKey }: PatientStatsProps) {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/patients/${patientId}/stats`)
      .then(r => r.json())
      .then(d => setStats(d))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [patientId, refreshKey])

  if (loading || !stats) return null

  return (
    <Card>
      <CardContent className="pt-4 pb-3">
        <div className="flex items-center gap-2 mb-3">
          <Activity className="w-4 h-4 text-[#2D9DA8]" />
          <h3 className="font-semibold text-sm">Patient Snapshot</h3>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="bg-[#2D9DA8]/5 rounded-lg p-2">
            <p className="text-[10px] text-gray-500 uppercase font-medium">Total Spent</p>
            <p className="text-base font-bold text-[#2D9DA8]">₱{stats.totalSpent.toLocaleString()}</p>
          </div>
          <div className="bg-orange-50 rounded-lg p-2">
            <p className="text-[10px] text-gray-500 uppercase font-medium">Balance Due</p>
            <p className={`text-base font-bold ${stats.totalBalance > 0 ? 'text-orange-600' : 'text-green-600'}`}>
              ₱{stats.totalBalance.toLocaleString()}
            </p>
          </div>
          <div className="bg-[#22B573]/5 rounded-lg p-2">
            <p className="text-[10px] text-gray-500 uppercase font-medium">Coverage</p>
            <p className="text-base font-bold text-[#22B573]">₱{stats.totalCoverage.toLocaleString()}</p>
          </div>
          <div className="bg-purple-50 rounded-lg p-2">
            <p className="text-[10px] text-gray-500 uppercase font-medium">Visits</p>
            <p className="text-base font-bold text-purple-600">{stats.totalVisits}</p>
          </div>
        </div>

        {/* Alerts */}
        <div className="mt-2 space-y-1">
          {stats.totalBalance > 0 && (
            <div className="flex items-center gap-1.5 text-xs text-orange-600 bg-orange-50 rounded px-2 py-1">
              <DollarSign className="w-3 h-3" />
              <span>₱{stats.totalBalance.toLocaleString()} outstanding balance</span>
            </div>
          )}
          {stats.unsignedConsents > 0 && (
            <div className="flex items-center gap-1.5 text-xs text-purple-600 bg-purple-50 rounded px-2 py-1">
              <Shield className="w-3 h-3" />
              <span>{stats.unsignedConsents} consent{stats.unsignedConsents > 1 ? 's' : ''} pending signature</span>
            </div>
          )}
          {stats.nextAppointment && (
            <div className="flex items-center gap-1.5 text-xs text-[#2D9DA8] bg-[#2D9DA8]/5 rounded px-2 py-1">
              <Calendar className="w-3 h-3" />
              <span>Next: {format(parseISO(stats.nextAppointment.scheduledDatetime), 'MMM d, h:mm a')}</span>
            </div>
          )}
          {stats.lastVisit && (
            <div className="flex items-center gap-1.5 text-xs text-gray-500 bg-gray-50 rounded px-2 py-1">
              <Clock className="w-3 h-3" />
              <span>Last visit: {format(parseISO(stats.lastVisit.scheduledDatetime), 'MMM d, yyyy')}</span>
            </div>
          )}
        </div>

        {/* Package Summary */}
        <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
          <span>{stats.activePackageCount} active / {stats.packageCount} total packages</span>
          <span>Treatment value: ₱{stats.totalTreatmentValue.toLocaleString()}</span>
        </div>
      </CardContent>
    </Card>
  )
}

'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import {
  UserCheck, Stethoscope, DollarSign, CheckCircle,
  Calendar, ArrowRight, Loader2, Clock, AlertCircle, Shield
} from 'lucide-react'

interface WorkflowStatus {
  currentStep: string
  nextAction: string
  activeAppointment: any
  todaysAppointments: any[]
  activePackages: any[]
  totalBalanceDue: number
  hasUnsignedConsents?: boolean
}

interface GuidedWorkflowProps {
  patientId: string
  onStepAction?: (step: string, appointmentId?: string) => void
  onRefresh?: () => void
}

const stepConfig: Record<string, { icon: any; color: string; bgColor: string; stepNum: number }> = {
  no_appointment: { icon: Calendar, color: 'text-gray-400', bgColor: 'bg-gray-100', stepNum: 0 },
  ready_to_checkin: { icon: UserCheck, color: 'text-blue-600', bgColor: 'bg-blue-50', stepNum: 1 },
  checked_in: { icon: Stethoscope, color: 'text-[#2D9DA8]', bgColor: 'bg-[#2D9DA8]/10', stepNum: 2 },
  pending_consent: { icon: Shield, color: 'text-purple-600', bgColor: 'bg-purple-50', stepNum: 3 },
  in_treatment: { icon: DollarSign, color: 'text-[#22B573]', bgColor: 'bg-[#22B573]/10', stepNum: 4 },
  pending_payment: { icon: DollarSign, color: 'text-orange-500', bgColor: 'bg-orange-50', stepNum: 4 },
  all_done: { icon: CheckCircle, color: 'text-green-500', bgColor: 'bg-green-50', stepNum: 5 },
}

const steps = [
  { key: 'ready_to_checkin', label: 'Check-in', icon: UserCheck },
  { key: 'checked_in', label: 'Consult', icon: Stethoscope },
  { key: 'pending_consent', label: 'Agree & Sign', icon: Shield },
  { key: 'in_treatment', label: 'Pay', icon: DollarSign },
  { key: 'all_done', label: 'Done', icon: CheckCircle },
]

export default function GuidedWorkflow({ patientId, onStepAction, onRefresh }: GuidedWorkflowProps) {
  const { toast } = useToast()
  const [status, setStatus] = useState<WorkflowStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState(false)

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(`/api/patients/${patientId}/workflow-status`)
      if (!res.ok) throw new Error('Failed')
      const data = await res.json()
      setStatus(data)
    } catch {
      console.error('Failed to load workflow status')
    } finally {
      setLoading(false)
    }
  }, [patientId])

  useEffect(() => { fetchStatus() }, [fetchStatus])

  const handleAction = async () => {
    if (!status) return
    setActing(true)

    const aptId = status.activeAppointment?.id

    try {
      switch (status.currentStep) {
        case 'ready_to_checkin':
          if (aptId) {
            const res = await fetch(`/api/appointments/${aptId}/status`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ status: 'checked_in' })
            })
            if (res.ok) {
              toast({ title: 'Patient checked in', description: 'Ready for consultation' })
            }
          }
          break
        case 'checked_in':
          if (aptId) {
            const res = await fetch(`/api/appointments/${aptId}/status`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ status: 'in_progress' })
            })
            if (res.ok) {
              toast({ title: 'Treatment started', description: 'Appointment in progress' })
            }
          }
          break
        case 'pending_consent':
          // Trigger consent section via parent
          onStepAction?.('pending_consent', aptId)
          setActing(false)
          return
        case 'in_treatment':
        case 'pending_payment':
          // Trigger payment dialog via parent
          onStepAction?.(status.currentStep, aptId)
          setActing(false)
          return
        default:
          break
      }

      await fetchStatus()
      onRefresh?.()
    } catch {
      toast({ title: 'Error', description: 'Action failed', variant: 'destructive' })
    } finally {
      setActing(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-3">
        <Loader2 className="w-4 h-4 animate-spin text-[#2D9DA8]" />
      </div>
    )
  }

  if (!status) return null

  const config = stepConfig[status.currentStep] || stepConfig.no_appointment
  const StepIcon = config.icon
  const currentStepNum = config.stepNum

  return (
    <div className="space-y-3">
      {/* Step Indicator */}
      <div className="flex items-center gap-1">
        {steps.map((step, idx) => {
          const isActive = currentStepNum === idx + 1
          const isDone = currentStepNum > idx + 1
          const Icon = step.icon
          return (
            <div key={step.key} className="flex items-center flex-1">
              <div className={`
                flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold transition-all
                ${isDone ? 'bg-[#22B573] text-white' : isActive ? 'bg-[#2D9DA8] text-white ring-2 ring-[#2D9DA8]/30' : 'bg-gray-200 text-gray-400'}
              `}>
                {isDone ? <CheckCircle className="w-3.5 h-3.5" /> : <Icon className="w-3.5 h-3.5" />}
              </div>
              {idx < steps.length - 1 && (
                <div className={`flex-1 h-0.5 mx-1 ${isDone ? 'bg-[#22B573]' : 'bg-gray-200'}`} />
              )}
            </div>
          )
        })}
      </div>

      {/* Step Labels */}
      <div className="flex items-center gap-1">
        {steps.map((step, idx) => (
          <div key={step.key} className="flex-1 text-center">
            <span className={`text-[10px] font-medium ${
              currentStepNum === idx + 1 ? 'text-[#2D9DA8]' : currentStepNum > idx + 1 ? 'text-[#22B573]' : 'text-gray-400'
            }`}>{step.label}</span>
          </div>
        ))}
      </div>

      {/* Action Button */}
      {status.currentStep !== 'all_done' && status.currentStep !== 'no_appointment' && (
        <Button
          onClick={handleAction}
          disabled={acting}
          className={`w-full ${
            status.currentStep === 'pending_payment' || status.currentStep === 'in_treatment'
              ? 'bg-[#22B573] hover:bg-[#1da066]'
              : 'bg-[#2D9DA8] hover:bg-[#258a93]'
          }`}
          size="sm"
        >
          {acting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <StepIcon className="w-4 h-4 mr-2" />}
          {status.nextAction}
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      )}

      {status.currentStep === 'all_done' && (
        <div className="flex items-center gap-2 p-2 rounded-lg bg-green-50 border border-green-200">
          <CheckCircle className="w-4 h-4 text-green-600" />
          <span className="text-sm text-green-700 font-medium">All steps complete for today</span>
        </div>
      )}

      {status.currentStep === 'no_appointment' && (
        <div className="flex items-center gap-2 p-2 rounded-lg bg-gray-50 border border-gray-200">
          <Calendar className="w-4 h-4 text-gray-400" />
          <span className="text-sm text-gray-500">No appointment scheduled for today</span>
        </div>
      )}

      {/* Today's Appointment Info */}
      {status.activeAppointment && (
        <div className="text-xs text-gray-500 flex items-center gap-1">
          <Clock className="w-3 h-3" />
          Today at {new Date(status.activeAppointment.scheduledDatetime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          {status.activeAppointment.appointmentType && (
            <span> • {status.activeAppointment.appointmentType}</span>
          )}
        </div>
      )}
    </div>
  )
}

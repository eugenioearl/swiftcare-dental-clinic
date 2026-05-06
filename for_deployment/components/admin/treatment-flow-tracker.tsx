'use client'

import { useCallback, useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import {
  Activity, AlertTriangle, ArrowRight, CheckCircle, ChevronRight, ClipboardCheck,
  Clock, FileSignature, HeartPulse, Info, Loader2, Pill, ShieldAlert,
  Stethoscope, UserCheck, Wallet, XCircle,
} from 'lucide-react'
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Textarea } from '@/components/ui/textarea'

interface FlowTask { key: string; label: string; done: boolean; blocking?: boolean }
interface FlowAlert { level: 'danger' | 'warn' | 'info'; message: string }
interface FlowData {
  patientId: string
  stage: 'pre_treatment' | 'in_treatment' | 'post_treatment' | 'completed'
  stageOrder: FlowData['stage'][]
  activeAppointmentId: string | null
  activeAppointmentStatus: string | null
  activeAppointmentType: string | null
  scheduledDatetime: string | null
  dentistName: string | null
  isMinor: boolean
  patientAge: number | null
  modifiers: string[]
  alerts: FlowAlert[]
  tasks: {
    pre_treatment: FlowTask[]
    in_treatment: FlowTask[]
    post_treatment: FlowTask[]
  }
  guardrails: {
    canStartTreatment: boolean
    canCompleteTreatment: boolean
    unsignedConsents: number
    signedConsents: number
    proceduresRecordedToday: number
    totalBalanceDue: number
  }
  summary: {
    hasActiveAppointment: boolean
    activePackages: number
    unsignedConsents: number
    signedConsents: number
    totalBalanceDue: number
  }
}

type OpenSection = 'consent' | 'payment' | 'chart' | 'package' | 'procedure' | 'plan' | 'patient-info' | 'clinical' | 'appointments' | 'forms'

interface Props {
  patientId: string
  refreshKey?: number
  onChanged?: () => void
  onOpenSection?: (section: OpenSection) => void
  onTaskClick?: (taskKey: string) => void
}

const STAGE_META: Record<FlowData['stage'], { label: string; color: string; bg: string; icon: any }> = {
  pre_treatment:  { label: 'Pre-Treatment',  color: 'text-blue-700',    bg: 'bg-blue-50 border-blue-200',    icon: ClipboardCheck },
  in_treatment:   { label: 'During Procedure', color: 'text-amber-700',  bg: 'bg-amber-50 border-amber-200',  icon: Stethoscope },
  post_treatment: { label: 'Post-Treatment', color: 'text-purple-700',  bg: 'bg-purple-50 border-purple-200', icon: Wallet },
  completed:      { label: 'Completed',      color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200', icon: CheckCircle },
}

// Map each task key to the section it should open when clicked.
// Returning null means "no navigation — it's just a marker".
function taskSectionFor(key: string): OpenSection | null {
  switch (key) {
    case 'checked_in':            return 'appointments'
    case 'demographics_reviewed': return 'patient-info'
    case 'chart_reviewed':        return 'clinical'
    case 'chart_updated':         return 'clinical'
    case 'clinical_notes_added':  return 'clinical'
    case 'plan_ready':            return 'plan'
    case 'consents_ready':        return 'consent'
    case 'procedure_confirmed':   return 'appointments'
    case 'treatment_started':     return 'clinical'
    case 'procedure_recorded':    return 'procedure'
    case 'treatment_completed':   return 'clinical'
    case 'payment_recorded':      return 'payment'
    case 'package_updated':       return 'package'
    case 'followup_scheduled':    return 'appointments'
    case 'post_op_instructions':  return 'forms'
    default:                      return null
  }
}

export default function TreatmentFlowTracker({ patientId, refreshKey, onChanged, onOpenSection, onTaskClick }: Props) {
  const { toast } = useToast()
  const [flow, setFlow] = useState<FlowData | null>(null)
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [cancelling, setCancelling] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/patients/${patientId}/treatment-flow`)
      if (!res.ok) throw new Error('failed')
      const data = await res.json()
      setFlow(data)
    } catch {
      setFlow(null)
    } finally {
      setLoading(false)
    }
  }, [patientId])

  useEffect(() => { load() }, [load, refreshKey])

  const advance = async (force = false) => {
    if (!flow) return
    setActing(true)
    try {
      const res = await fetch(`/api/patients/${patientId}/treatment-flow`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'advance', force }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast({ title: 'Cannot advance', description: data?.error || 'Transition blocked', variant: 'destructive' })
        return
      }
      setFlow(data)
      onChanged?.()
      const warnings: string[] = Array.isArray(data?.warnings) ? data.warnings : []
      if (warnings.length > 0) {
        toast({
          title: 'Stage advanced with warnings',
          description: warnings.join(' • '),
        })
      } else {
        toast({ title: 'Stage updated', description: `Now in ${STAGE_META[data.stage as FlowData['stage']].label}` })
      }
    } finally {
      setActing(false)
    }
  }

  const handleCancelAppointment = async () => {
    if (!flow?.activeAppointmentId) return
    setCancelling(true)
    try {
      const res = await fetch(`/api/appointments/${flow.activeAppointmentId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'cancelled', cancellationReason: cancelReason || 'Cancelled during treatment by dentist' }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.error || 'Failed to cancel')
      }
      toast({ title: 'Appointment cancelled', description: 'The appointment has been cancelled successfully.' })
      setCancelOpen(false)
      setCancelReason('')
      await load()
      onChanged?.()
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    } finally {
      setCancelling(false)
    }
  }

  const handleTaskClick = (t: FlowTask) => {
    onTaskClick?.(t.key)
    const section = taskSectionFor(t.key)
    if (section) onOpenSection?.(section)
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="py-6 flex items-center justify-center">
          <Loader2 className="w-4 h-4 animate-spin text-[#2D9DA8]" />
        </CardContent>
      </Card>
    )
  }

  if (!flow) {
    return (
      <Card><CardContent className="py-6 text-center text-sm text-gray-400">Unable to load treatment flow</CardContent></Card>
    )
  }

  const stageIdx = flow.stageOrder.indexOf(flow.stage)
  const meta = STAGE_META[flow.stage]
  const StageIcon = meta.icon
  const pendingBlockers: FlowTask[] = (flow.tasks[flow.stage as keyof typeof flow.tasks] || [])
    .filter(t => t.blocking && !t.done)

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="w-4 h-4 text-[#2D9DA8]" />
            Treatment Flow
          </CardTitle>
          <Badge variant="outline" className={`${meta.color} border-current`}>
            <StageIcon className="w-3 h-3 mr-1" /> {meta.label}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Stage progress bar */}
        <div className="flex items-center gap-1">
          {flow.stageOrder.map((s, i) => {
            const m = STAGE_META[s]
            const active = i === stageIdx
            const done = i < stageIdx
            const Icon = m.icon
            return (
              <div key={s} className="flex items-center flex-1">
                <div className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold transition-all
                  ${done ? 'bg-[#22B573] text-white' :
                    active ? 'bg-[#2D9DA8] text-white ring-2 ring-[#2D9DA8]/30' :
                    'bg-gray-200 text-gray-400'}`}>
                  {done ? <CheckCircle className="w-3.5 h-3.5" /> : <Icon className="w-3.5 h-3.5" />}
                </div>
                {i < flow.stageOrder.length - 1 && (
                  <div className={`flex-1 h-0.5 mx-1 ${done ? 'bg-[#22B573]' : 'bg-gray-200'}`} />
                )}
              </div>
            )
          })}
        </div>
        <div className="flex items-center gap-1">
          {flow.stageOrder.map((s, i) => (
            <div key={s} className="flex-1 text-center">
              <span className={`text-[10px] font-medium ${
                i === stageIdx ? 'text-[#2D9DA8]' :
                i < stageIdx ? 'text-[#22B573]' : 'text-gray-400'
              }`}>{STAGE_META[s].label}</span>
            </div>
          ))}
        </div>

        {/* Modifiers */}
        {flow.modifiers.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {flow.modifiers.map(m => (
              <Badge key={m} variant="secondary" className="text-[10px]">{m.replace('_', ' ')}</Badge>
            ))}
          </div>
        )}

        {/* Medical alerts */}
        {flow.alerts.length > 0 && (
          <div className="space-y-1">
            {flow.alerts.map((a, i) => (
              <div key={i} className={`flex items-start gap-2 p-2 rounded text-xs border
                ${a.level === 'danger' ? 'bg-red-50 border-red-200 text-red-700' :
                  a.level === 'warn' ? 'bg-amber-50 border-amber-200 text-amber-700' :
                  'bg-blue-50 border-blue-200 text-blue-700'}`}>
                {a.level === 'danger' ? <ShieldAlert className="w-3.5 h-3.5 shrink-0" /> :
                  a.level === 'warn' ? <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> :
                  <Info className="w-3.5 h-3.5 shrink-0" />}
                <span className="leading-tight">{a.message}</span>
              </div>
            ))}
          </div>
        )}

        {/* Stage-specific clickable checklist */}
        {flow.stage !== 'completed' && (
          <div className={`rounded-lg border ${meta.bg} p-2`}>
            <div className={`flex items-center justify-between text-xs font-semibold ${meta.color} mb-1.5`}>
              <span className="flex items-center gap-2">
                <StageIcon className="w-3.5 h-3.5" /> {meta.label} checklist
              </span>
              <span className="text-[10px] font-normal text-gray-500">Tap items to jump • optional</span>
            </div>
            <div className="space-y-1">
              {(flow.tasks[flow.stage as keyof typeof flow.tasks] || []).map(t => {
                const hasSection = !!taskSectionFor(t.key)
                return (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => handleTaskClick(t)}
                    disabled={!hasSection}
                    className={`w-full flex items-center gap-2 text-xs rounded-md px-2 py-1.5 transition-colors text-left
                      ${hasSection ? 'hover:bg-white/70 cursor-pointer' : 'cursor-default'}
                      ${t.done ? '' : t.blocking ? 'ring-1 ring-red-200' : ''}`}
                  >
                    {t.done ? (
                      <CheckCircle className="w-3.5 h-3.5 text-[#22B573] shrink-0" />
                    ) : t.blocking ? (
                      <ShieldAlert className="w-3.5 h-3.5 text-red-500 shrink-0" />
                    ) : (
                      <Clock className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                    )}
                    <span className={`flex-1 ${t.done ? 'text-gray-500 line-through' : t.blocking ? 'text-red-600 font-medium' : 'text-gray-700'}`}>
                      {t.label}
                    </span>
                    {hasSection && !t.done && (
                      <ChevronRight className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Contextual quick actions */}
        <div className="flex flex-wrap gap-1.5">
          {flow.stage === 'pre_treatment' && flow.guardrails.unsignedConsents > 0 && (
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => onOpenSection?.('consent')}>
              <FileSignature className="w-3 h-3 mr-1" /> {flow.guardrails.unsignedConsents} consent pending
            </Button>
          )}
          {flow.stage === 'in_treatment' && (
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => onOpenSection?.('chart')}>
              <HeartPulse className="w-3 h-3 mr-1" /> Update chart
            </Button>
          )}
          {flow.stage === 'in_treatment' && (
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => onOpenSection?.('procedure')}>
              <Pill className="w-3 h-3 mr-1" /> Record procedure
            </Button>
          )}
          {flow.stage === 'post_treatment' && flow.guardrails.totalBalanceDue > 0 && (
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => onOpenSection?.('payment')}>
              <Wallet className="w-3 h-3 mr-1" /> Settle ₱{flow.guardrails.totalBalanceDue.toLocaleString()}
            </Button>
          )}
        </div>

        {/* Pending-blocker summary (non-blocking — informational only) */}
        {pendingBlockers.length > 0 && (
          <div className="flex items-start gap-2 p-2 rounded-md bg-amber-50 border border-amber-200 text-[11px] text-amber-700">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span className="leading-tight">
              {pendingBlockers.length} recommended item{pendingBlockers.length > 1 ? 's' : ''} pending
              — you can still advance, but please review: {pendingBlockers.map(t => t.label).join(', ')}
            </span>
          </div>
        )}

        {/* Advance + Cancel buttons */}
        {flow.stage !== 'completed' && (
          <div className="flex gap-2">
            <Button
              onClick={() => advance(pendingBlockers.length > 0)}
              disabled={acting}
              className="flex-1 bg-[#2D9DA8] hover:bg-[#258a93]"
              size="sm"
            >
              {acting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ArrowRight className="w-4 h-4 mr-2" />}
              {flow.stage === 'pre_treatment' && 'Start Treatment'}
              {flow.stage === 'in_treatment' && 'Move to Post-Treatment'}
              {flow.stage === 'post_treatment' && 'Complete Visit'}
            </Button>
            {flow.activeAppointmentId && (flow.stage === 'in_treatment' || flow.stage === 'pre_treatment') && (
              <Button
                variant="outline"
                size="sm"
                className="border-red-300 text-red-700 hover:bg-red-50"
                onClick={() => setCancelOpen(true)}
              >
                <XCircle className="w-4 h-4 mr-1" /> Cancel
              </Button>
            )}
          </div>
        )}

        {flow.stage === 'completed' && (
          <div className="flex items-center gap-2 p-2 rounded-lg bg-emerald-50 border border-emerald-200">
            <CheckCircle className="w-4 h-4 text-emerald-600" />
            <span className="text-sm text-emerald-700 font-medium">Visit completed</span>
          </div>
        )}

        {/* Appointment meta */}
        {flow.scheduledDatetime && (
          <div className="text-[11px] text-gray-500 flex items-center gap-1 pt-1 border-t">
            <Clock className="w-3 h-3" />
            {new Date(flow.scheduledDatetime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            {flow.dentistName && <span> • Dr. {flow.dentistName}</span>}
            {flow.activeAppointmentType && <span> • {flow.activeAppointmentType.replace('_', ' ')}</span>}
          </div>
        )}
      </CardContent>

      {/* Cancel Appointment Dialog */}
      <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-700">
              <XCircle className="w-5 h-5" /> Cancel Appointment
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will cancel the current appointment. The patient will be notified via email. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2">
            <Textarea
              placeholder="Reason for cancellation (e.g., patient not ready for surgery, treatment not needed)..."
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              rows={3}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelling}>Keep Appointment</AlertDialogCancel>
            <Button
              onClick={handleCancelAppointment}
              disabled={cancelling}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {cancelling && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Cancel Appointment
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}

'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useToast } from '@/hooks/use-toast'
import { useConfirm } from '@/components/providers/confirm-provider'
import { ClipboardList, Plus, Trash2, Edit, DollarSign, Stethoscope, Save, X, ChevronDown, ChevronUp, Loader2, Calendar, CheckCircle2, PlayCircle, ShieldCheck, FileSignature, Sparkles, Smile } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { ToothPicker } from '@/components/admin/tooth-picker'

// ==================================
// Types
// ==================================
interface PhaseProcedure {
  id?: string
  treatmentId?: string
  name: string
  price: number
  toothNumbers: string[]
  notes?: string
  status: 'planned' | 'scheduled' | 'in_progress' | 'completed' | 'cancelled'
}

// Wave 3a: Nested monthly adjustment visit for orthodontic plans
interface OrthoVisit {
  id?: string
  visitNumber: number
  scheduledDate?: string | null
  completedDate?: string | null
  status: 'scheduled' | 'completed' | 'rescheduled' | 'missed' | 'cancelled'
  wireUpper?: string | null
  wireLower?: string | null
  bracketChanges?: string | null
  elastics?: string | null
  intervalWeeks?: number | null
  clinicalObservations?: string | null
  notes?: string | null
  adjustedBy?: string | null
}

interface Phase {
  id?: string
  phaseNumber: number
  title: string
  description?: string
  status: 'draft' | 'planned' | 'scheduled' | 'in_progress' | 'completed' | 'on_hold' | 'cancelled'
  priority: 'low' | 'medium' | 'high' | 'urgent'
  procedures: PhaseProcedure[]
  formTemplateKeys: string[]
  estimatedVisits: number
  notes?: string
  visits?: OrthoVisit[] // Wave 3a: ortho-only nested adjustment visits
}

interface TreatmentPlan {
  id: string
  title: string
  description: string | null
  diagnosis: string | null
  prognosis: string | null
  status: string
  priority: string | null
  phases: Phase[]
  estimatedStartDate: string | null
  estimatedEndDate: string | null
  estimatedCost: number | null
  actualCost: number | null
  dentistName: string | null
  completionPercentage: number
  patientApproval?: boolean | null
  consentSigned?: boolean | null
  approvalDate?: string | null
  consentDate?: string | null
  createdAt: string
  updatedAt: string
  risks: string | null
  benefits: string | null
  // Wave 3a: orthodontic plan metadata (surfaced from communicationLog JSON)
  planType?: 'general' | 'ortho' | null
  totalDurationMonths?: number | null
  currentStageOfTreatment?: string | null
}

interface TreatmentPlansManagerProps {
  patientId: string
  patientName?: string
}

const STATUS_BADGES: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  active: 'bg-blue-100 text-blue-700',
  approved: 'bg-green-100 text-green-700',
  completed: 'bg-emerald-100 text-emerald-700',
  cancelled: 'bg-red-100 text-red-700',
  on_hold: 'bg-amber-100 text-amber-700',
}

const PRIORITY_BADGES: Record<string, string> = {
  low: 'bg-gray-100 text-gray-700',
  medium: 'bg-blue-100 text-blue-700',
  high: 'bg-orange-100 text-orange-700',
  urgent: 'bg-red-100 text-red-700',
}

function formatCurrency(v: number | null | undefined) {
  if (v === null || v === undefined) return '—'
  return `₱${Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

const VISIT_STATUS_BADGES: Record<string, string> = {
  scheduled: 'bg-blue-100 text-blue-700 border-blue-200',
  completed: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  rescheduled: 'bg-amber-100 text-amber-700 border-amber-200',
  missed: 'bg-rose-100 text-rose-700 border-rose-200',
  cancelled: 'bg-gray-100 text-gray-600 border-gray-200',
}

function emptyPhase(phaseNumber: number): Phase {
  return {
    phaseNumber,
    title: '',
    description: '',
    status: 'draft',
    priority: 'medium',
    procedures: [],
    formTemplateKeys: [],
    estimatedVisits: 1,
    notes: '',
    visits: [],
  }
}

function emptyVisit(visitNumber: number): OrthoVisit {
  return {
    visitNumber,
    scheduledDate: null,
    completedDate: null,
    status: 'scheduled',
    wireUpper: '',
    wireLower: '',
    bracketChanges: '',
    elastics: '',
    intervalWeeks: 4,
    clinicalObservations: '',
    notes: '',
    adjustedBy: '',
  }
}

export default function TreatmentPlansManager({ patientId, patientName }: TreatmentPlansManagerProps) {
  const { toast } = useToast()
  const { confirm } = useConfirm()
  const [plans, setPlans] = useState<TreatmentPlan[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null)
  const [actioningId, setActioningId] = useState<string | null>(null)
  // Services — used to seed the plan from an official clinic service
  const [services, setServices] = useState<Array<{
    id: string
    name: string
    displayName?: string | null
    estimatedPrice?: number | null
    priceDisplay?: string | null
    isActive: boolean
    isOfficial?: boolean
  }>>([])
  const [seedingFromSvc, setSeedingFromSvc] = useState(false)

  // Form state for create/edit
  const [form, setForm] = useState({
    title: '',
    description: '',
    diagnosis: '',
    prognosis: '',
    priority: 'medium',
    risks: '',
    benefits: '',
    phases: [emptyPhase(1)] as Phase[],
    // Wave 3a: ortho plan type + metadata
    planType: 'general' as 'general' | 'ortho',
    totalDurationMonths: '' as string | number,
    currentStageOfTreatment: '',
  })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/patients/${patientId}/treatment-plans`)
      if (!res.ok) throw new Error('Failed to load plans')
      const json = await res.json()
      setPlans(json.treatmentPlans || [])
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Failed to load treatment plans', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [patientId, toast])

  useEffect(() => {
    load()
  }, [load])

  // Fetch active services for "Seed from Service" selector
  useEffect(() => {
    fetch('/api/admin/services')
      .then(r => r.ok ? r.json() : { services: [] })
      .then(j => setServices((j.services || []).filter((s: any) => s.isActive)))
      .catch(() => setServices([]))
  }, [])

  const seedFromService = async (serviceId: string) => {
    if (!serviceId) return
    setSeedingFromSvc(true)
    try {
      const res = await fetch(`/api/admin/services`)
      const j = await res.json()
      const svc = (j.services || []).find((s: any) => s.id === serviceId)
      if (!svc) throw new Error('Service not found')
      // Build a phase from service's defaultPlanPhases or linkedTreatmentIds
      let phases: Phase[] = []
      if (Array.isArray(svc.defaultPlanPhases) && svc.defaultPlanPhases.length > 0) {
        phases = svc.defaultPlanPhases.map((ph: any, i: number) => ({
          phaseNumber: ph.phaseNumber || i + 1,
          title: ph.title || `Phase ${i + 1}`,
          description: ph.description || '',
          status: 'draft' as const,
          priority: (ph.priority || 'medium') as Phase['priority'],
          procedures: Array.isArray(ph.procedures) ? ph.procedures.map((pr: any) => ({
            treatmentId: pr.treatmentId || undefined,
            name: pr.name || 'Procedure',
            price: Number(pr.price || 0),
            toothNumbers: Array.isArray(pr.toothNumbers) ? pr.toothNumbers : [],
            notes: pr.notes || '',
            status: 'planned' as const,
          })) : [],
          formTemplateKeys: Array.isArray(ph.formTemplateKeys) ? ph.formTemplateKeys : [],
          estimatedVisits: Number(ph.estimatedVisits || 1),
          notes: ph.notes || '',
        }))
      } else if (Array.isArray(svc.linkedTreatmentIds) && svc.linkedTreatmentIds.length > 0) {
        // Fetch treatments to build procedures
        const tRes = await fetch('/api/treatments')
        const tJson = await tRes.json()
        const allTreatments = tJson.treatments || []
        const linked = allTreatments.filter((t: any) => svc.linkedTreatmentIds.includes(t.id))
        phases = [{
          phaseNumber: 1,
          title: svc.displayName || svc.name,
          description: svc.description || '',
          status: 'draft',
          priority: 'medium',
          procedures: linked.map((t: any) => ({
            treatmentId: t.id,
            name: t.name,
            price: Number(t.baseCost ?? t.standardPrice ?? 0),
            toothNumbers: [],
            notes: '',
            status: 'planned' as const,
          })),
          formTemplateKeys: Array.isArray(svc.linkedFormTemplateKeys) ? svc.linkedFormTemplateKeys : [],
          estimatedVisits: 1,
          notes: '',
        }]
      } else {
        phases = [emptyPhase(1)]
      }
      setForm(f => ({
        ...f,
        title: svc.defaultPlanTitle || svc.displayName || svc.name,
        description: svc.description || f.description,
        phases,
      }))
      toast({ title: 'Seeded from service', description: `Plan pre-filled from "${svc.displayName || svc.name}".` })
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Failed to seed', variant: 'destructive' })
    } finally {
      setSeedingFromSvc(false)
    }
  }

  const resetForm = () => {
    setForm({
      title: '',
      description: '',
      diagnosis: '',
      prognosis: '',
      priority: 'medium',
      risks: '',
      benefits: '',
      phases: [emptyPhase(1)],
      planType: 'general',
      totalDurationMonths: '',
      currentStageOfTreatment: '',
    })
  }

  const openCreate = () => {
    resetForm()
    setEditingPlanId(null)
    setCreateOpen(true)
  }

  const openEdit = (plan: TreatmentPlan) => {
    const phases: Phase[] = Array.isArray(plan.phases) ? (plan.phases as any) : []
    setForm({
      title: plan.title || '',
      description: plan.description || '',
      diagnosis: plan.diagnosis || '',
      prognosis: plan.prognosis || '',
      priority: plan.priority || 'medium',
      risks: plan.risks || '',
      benefits: plan.benefits || '',
      phases: phases.length
        ? phases.map((p, i) => ({ ...emptyPhase(i + 1), ...p, visits: Array.isArray((p as any).visits) ? (p as any).visits : [] }))
        : [emptyPhase(1)],
      planType: (plan.planType === 'ortho' ? 'ortho' : 'general'),
      totalDurationMonths: plan.totalDurationMonths ?? '',
      currentStageOfTreatment: plan.currentStageOfTreatment || '',
    })
    setEditingPlanId(plan.id)
    setCreateOpen(true)
  }

  const quickAction = async (planId: string, patch: Record<string, any>, successMsg: string) => {
    setActioningId(planId)
    try {
      const res = await fetch(`/api/patients/${patientId}/treatment-plans/${planId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error || 'Update failed')
      }
      toast({ title: successMsg })
      await load()
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' })
    } finally {
      setActioningId(null)
    }
  }

  const addPhase = () => {
    setForm(f => ({
      ...f,
      phases: [...f.phases, emptyPhase(f.phases.length + 1)],
    }))
  }

  const removePhase = (idx: number) => {
    setForm(f => ({
      ...f,
      phases: f.phases.filter((_, i) => i !== idx).map((p, i) => ({ ...p, phaseNumber: i + 1 })),
    }))
  }

  const updatePhase = (idx: number, patch: Partial<Phase>) => {
    setForm(f => ({
      ...f,
      phases: f.phases.map((p, i) => (i === idx ? { ...p, ...patch } : p)),
    }))
  }

  const addProcedure = (phaseIdx: number) => {
    setForm(f => ({
      ...f,
      phases: f.phases.map((p, i) =>
        i === phaseIdx
          ? {
              ...p,
              procedures: [
                ...p.procedures,
                { name: '', price: 0, toothNumbers: [], notes: '', status: 'planned' as const },
              ],
            }
          : p,
      ),
    }))
  }

  const removeProcedure = (phaseIdx: number, procIdx: number) => {
    setForm(f => ({
      ...f,
      phases: f.phases.map((p, i) =>
        i === phaseIdx ? { ...p, procedures: p.procedures.filter((_, pi) => pi !== procIdx) } : p,
      ),
    }))
  }

  const updateProcedure = (phaseIdx: number, procIdx: number, patch: Partial<PhaseProcedure>) => {
    setForm(f => ({
      ...f,
      phases: f.phases.map((p, i) =>
        i === phaseIdx
          ? {
              ...p,
              procedures: p.procedures.map((pr, pi) => (pi === procIdx ? { ...pr, ...patch } : pr)),
            }
          : p,
      ),
    }))
  }

  // Wave 3a: Ortho visit helpers
  const addVisit = (phaseIdx: number) => {
    setForm(f => ({
      ...f,
      phases: f.phases.map((p, i) =>
        i === phaseIdx
          ? { ...p, visits: [...(p.visits || []), emptyVisit((p.visits?.length || 0) + 1)] }
          : p,
      ),
    }))
  }

  const removeVisit = (phaseIdx: number, visitIdx: number) => {
    setForm(f => ({
      ...f,
      phases: f.phases.map((p, i) =>
        i === phaseIdx
          ? {
              ...p,
              visits: (p.visits || [])
                .filter((_, vi) => vi !== visitIdx)
                .map((v, vi) => ({ ...v, visitNumber: vi + 1 })),
            }
          : p,
      ),
    }))
  }

  const updateVisit = (phaseIdx: number, visitIdx: number, patch: Partial<OrthoVisit>) => {
    setForm(f => ({
      ...f,
      phases: f.phases.map((p, i) =>
        i === phaseIdx
          ? {
              ...p,
              visits: (p.visits || []).map((v, vi) => (vi === visitIdx ? { ...v, ...patch } : v)),
            }
          : p,
      ),
    }))
  }

  const totalEstimate = form.phases.reduce(
    (sum, ph) => sum + ph.procedures.reduce((a, p) => a + (Number(p.price) || 0), 0),
    0,
  )

  const handleSave = async () => {
    if (!form.title.trim()) {
      toast({ title: 'Title required', description: 'Please enter a title for the treatment plan.', variant: 'destructive' })
      return
    }
    if (form.phases.length === 0) {
      toast({ title: 'At least one phase required', variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      const payload: any = {
        title: form.title,
        description: form.description || undefined,
        diagnosis: form.diagnosis || undefined,
        prognosis: form.prognosis || undefined,
        priority: form.priority,
        risks: form.risks || undefined,
        benefits: form.benefits || undefined,
        phases: form.phases,
        planType: form.planType,
      }
      if (form.planType === 'ortho') {
        if (form.totalDurationMonths !== '' && form.totalDurationMonths !== null) {
          const n = Number(form.totalDurationMonths)
          if (!Number.isNaN(n) && n >= 0) payload.totalDurationMonths = n
        }
        if (form.currentStageOfTreatment) payload.currentStageOfTreatment = form.currentStageOfTreatment
      }

      // Estimated cost auto-computed on server; also pass explicit total for PUT path
      payload.estimatedCost = form.phases.reduce(
        (s, ph) => s + ph.procedures.reduce((a, p) => a + (Number(p.price) || 0), 0),
        0,
      )

      const isEdit = !!editingPlanId
      const url = isEdit
        ? `/api/patients/${patientId}/treatment-plans/${editingPlanId}`
        : `/api/patients/${patientId}/treatment-plans`

      const res = await fetch(url, {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error || (isEdit ? 'Failed to update plan' : 'Failed to create plan'))
      }
      toast({
        title: isEdit ? 'Treatment plan updated' : 'Treatment plan created',
        description: isEdit ? 'Changes saved successfully.' : 'Draft saved successfully.',
      })
      setCreateOpen(false)
      setEditingPlanId(null)
      resetForm()
      await load()
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (planId: string) => {
    const ok = await confirm({
      title: 'Cancel treatment plan?',
      description: 'This is a soft-cancel and will be audit-logged. The plan can be reviewed in audit history.',
      confirmLabel: 'Cancel Plan',
      cancelLabel: 'Keep Plan',
      variant: 'warning',
    })
    if (!ok) return
    setDeletingId(planId)
    try {
      const res = await fetch(`/api/patients/${patientId}/treatment-plans/${planId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to cancel plan')
      toast({ title: 'Plan cancelled', description: 'Treatment plan has been cancelled.' })
      await load()
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' })
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-teal-600" />
              Treatment Plans ({plans.length})
            </CardTitle>
            <Button size="sm" onClick={openCreate}>
              <Plus className="w-4 h-4 mr-1" /> New Plan
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8 text-gray-500">
              <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading treatment plans…
            </div>
          ) : plans.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-6">
              No treatment plans yet. Click &quot;New Plan&quot; to create a phased clinical roadmap.
            </p>
          ) : (
            <div className="space-y-3">
              {plans.map(plan => {
                const expanded = expandedId === plan.id
                const phases: Phase[] = Array.isArray(plan.phases) ? (plan.phases as any) : []
                return (
                  <div key={plan.id} className="border rounded-lg hover:bg-gray-50/50 transition-colors">
                    <button
                      type="button"
                      onClick={() => setExpandedId(expanded ? null : plan.id)}
                      className="w-full text-left p-3 flex items-start justify-between gap-3"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-gray-900 truncate">{plan.title}</span>
                          <Badge className={`text-xs ${STATUS_BADGES[plan.status] || STATUS_BADGES.draft}`}>
                            {plan.status}
                          </Badge>
                          {plan.priority && (
                            <Badge className={`text-xs ${PRIORITY_BADGES[plan.priority] || ''}`}>
                              {plan.priority}
                            </Badge>
                          )}
                          {plan.planType === 'ortho' && (
                            <Badge className="text-xs bg-purple-100 text-purple-800 border-purple-300">
                              <Smile className="w-3 h-3 mr-1" /> Orthodontic
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 flex-wrap">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" /> {format(parseISO(plan.createdAt), 'MMM d, yyyy')}
                          </span>
                          <span className="flex items-center gap-1">
                            <ClipboardList className="w-3 h-3" /> {phases.length} phase(s)
                          </span>
                          <span className="flex items-center gap-1 text-teal-700 font-medium">
                            <DollarSign className="w-3 h-3" /> {formatCurrency(plan.estimatedCost)}
                          </span>
                          {plan.planType === 'ortho' && plan.totalDurationMonths ? (
                            <span className="flex items-center gap-1 text-purple-700">
                              <Calendar className="w-3 h-3" /> {plan.totalDurationMonths} mo
                            </span>
                          ) : null}
                          {plan.planType === 'ortho' && plan.currentStageOfTreatment ? (
                            <span className="flex items-center gap-1 text-purple-700 italic">
                              <Sparkles className="w-3 h-3" /> {plan.currentStageOfTreatment}
                            </span>
                          ) : null}
                          {plan.dentistName && <span>Dr. {plan.dentistName}</span>}
                        </div>
                      </div>
                      {expanded ? <ChevronUp className="w-4 h-4 text-gray-400 mt-1" /> : <ChevronDown className="w-4 h-4 text-gray-400 mt-1" />}
                    </button>

                    {expanded && (
                      <div className="px-3 pb-3 space-y-3">
                        {plan.description && (
                          <div className="text-sm text-gray-700 bg-gray-50 p-2 rounded">
                            {plan.description}
                          </div>
                        )}
                        {(plan.diagnosis || plan.prognosis) && (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            {plan.diagnosis && (
                              <div className="text-xs">
                                <span className="font-medium text-gray-700">Diagnosis:</span>{' '}
                                <span className="text-gray-600">{plan.diagnosis}</span>
                              </div>
                            )}
                            {plan.prognosis && (
                              <div className="text-xs">
                                <span className="font-medium text-gray-700">Prognosis:</span>{' '}
                                <span className="text-gray-600">{plan.prognosis}</span>
                              </div>
                            )}
                          </div>
                        )}

                        <div className="space-y-2">
                          <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Phases</p>
                          {phases.length === 0 ? (
                            <p className="text-xs text-gray-500">No phases defined.</p>
                          ) : (
                            phases.map((ph, i) => {
                              const phaseCost = ph.procedures.reduce((a, p) => a + (Number(p.price) || 0), 0)
                              return (
                                <div key={ph.id || i} className="border rounded p-2 bg-white">
                                  <div className="flex items-center justify-between flex-wrap gap-2">
                                    <span className="text-sm font-medium">
                                      Phase {ph.phaseNumber}: {ph.title || 'Untitled'}
                                    </span>
                                    <div className="flex items-center gap-2">
                                      <Badge className={`text-[10px] ${STATUS_BADGES[ph.status] || ''}`}>{ph.status}</Badge>
                                      {ph.priority && (
                                        <Badge className={`text-[10px] ${PRIORITY_BADGES[ph.priority] || ''}`}>{ph.priority}</Badge>
                                      )}
                                      <span className="text-xs text-teal-700 font-medium">{formatCurrency(phaseCost)}</span>
                                    </div>
                                  </div>
                                  {ph.description && <p className="text-xs text-gray-600 mt-1">{ph.description}</p>}
                                  {ph.procedures.length > 0 && (
                                    <div className="mt-2 space-y-1">
                                      {ph.procedures.map((pr, pi) => (
                                        <div key={pr.id || pi} className="flex items-center justify-between text-xs py-0.5 px-1 bg-gray-50 rounded">
                                          <span className="flex items-center gap-1.5">
                                            <Stethoscope className="w-3 h-3 text-purple-500" />
                                            <span>{pr.name || 'Unnamed'}</span>
                                            {pr.toothNumbers.length > 0 && (
                                              <span className="text-gray-500">(teeth: {pr.toothNumbers.join(', ')})</span>
                                            )}
                                          </span>
                                          <span className="font-medium">{formatCurrency(pr.price)}</span>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                  {ph.notes && (
                                    <p className="text-xs text-gray-500 italic mt-1">Note: {ph.notes}</p>
                                  )}
                                  {plan.planType === 'ortho' && Array.isArray(ph.visits) && ph.visits.length > 0 && (
                                    <div className="mt-3 border-t pt-2">
                                      <p className="text-[11px] font-semibold text-purple-800 uppercase tracking-wide flex items-center gap-1 mb-1">
                                        <Sparkles className="w-3 h-3" /> Monthly adjustment visits ({ph.visits.length})
                                      </p>
                                      <div className="space-y-1">
                                        {ph.visits.map((v, vi) => (
                                          <div
                                            key={v.id || vi}
                                            className="flex items-start justify-between gap-2 text-xs bg-purple-50/50 border border-purple-100 rounded px-2 py-1.5"
                                          >
                                            <div className="flex-1 min-w-0">
                                              <div className="flex items-center gap-2 flex-wrap">
                                                <span className="font-medium text-purple-900">Visit #{v.visitNumber}</span>
                                                <Badge className={`text-[10px] ${VISIT_STATUS_BADGES[v.status] || VISIT_STATUS_BADGES.scheduled}`}>
                                                  {v.status}
                                                </Badge>
                                                {v.scheduledDate && (
                                                  <span className="text-gray-500">
                                                    <Calendar className="w-3 h-3 inline mr-0.5" />
                                                    {format(parseISO(v.scheduledDate), 'MMM d, yyyy')}
                                                  </span>
                                                )}
                                                {v.completedDate && v.status === 'completed' && (
                                                  <span className="text-emerald-700">
                                                    ✓ {format(parseISO(v.completedDate), 'MMM d')}
                                                  </span>
                                                )}
                                              </div>
                                              <div className="flex items-center gap-3 text-gray-600 mt-0.5 flex-wrap">
                                                {(v.wireUpper || v.wireLower) && (
                                                  <span>
                                                    Wire: {v.wireUpper || '—'} / {v.wireLower || '—'}
                                                  </span>
                                                )}
                                                {v.elastics && <span>Elastics: {v.elastics}</span>}
                                                {v.bracketChanges && <span>Brackets: {v.bracketChanges}</span>}
                                                {v.intervalWeeks ? <span>Next: {v.intervalWeeks}w</span> : null}
                                                {v.adjustedBy && <span className="italic">by {v.adjustedBy}</span>}
                                              </div>
                                              {v.clinicalObservations && (
                                                <p className="text-gray-600 mt-0.5">Obs: {v.clinicalObservations}</p>
                                              )}
                                              {v.notes && (
                                                <p className="text-gray-500 italic mt-0.5">Note: {v.notes}</p>
                                              )}
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )
                            })
                          )}
                        </div>

                        {(plan.risks || plan.benefits) && (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                            {plan.risks && (
                              <div className="bg-red-50 border border-red-200 rounded p-2">
                                <p className="font-semibold text-red-800 mb-0.5">Risks</p>
                                <p className="text-red-700">{plan.risks}</p>
                              </div>
                            )}
                            {plan.benefits && (
                              <div className="bg-green-50 border border-green-200 rounded p-2">
                                <p className="font-semibold text-green-800 mb-0.5">Benefits</p>
                                <p className="text-green-700">{plan.benefits}</p>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Approval + signoff status */}
                        <div className="flex flex-wrap items-center gap-2 text-xs pt-1">
                          <Badge className={`${plan.patientApproval ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'}`}>
                            <ShieldCheck className="w-3 h-3 mr-1" />
                            {plan.patientApproval
                              ? `Patient approved${plan.approvalDate ? ' ' + format(parseISO(plan.approvalDate), 'MMM d') : ''}`
                              : 'Awaiting patient approval'}
                          </Badge>
                          <Badge className={`${plan.consentSigned ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'}`}>
                            <FileSignature className="w-3 h-3 mr-1" />
                            {plan.consentSigned
                              ? `Consent signed${plan.consentDate ? ' ' + format(parseISO(plan.consentDate), 'MMM d') : ''}`
                              : 'Consent pending'}
                          </Badge>
                          {typeof plan.completionPercentage === 'number' && (
                            <Badge variant="outline" className="text-xs">
                              {plan.completionPercentage}% complete
                            </Badge>
                          )}
                        </div>

                        {/* Action buttons: edit + approval workflow */}
                        <div className="flex flex-wrap justify-end gap-2 pt-2">
                          {plan.status !== 'cancelled' && plan.status !== 'completed' && (
                            <Button size="sm" variant="outline" onClick={() => openEdit(plan)}>
                              <Edit className="w-3 h-3 mr-1" /> Edit
                            </Button>
                          )}
                          {!plan.patientApproval && plan.status !== 'cancelled' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => quickAction(plan.id, { patientApproval: true }, 'Patient approval recorded')}
                              disabled={actioningId === plan.id}
                              className="text-green-700 hover:bg-green-50 border-green-300"
                            >
                              {actioningId === plan.id ? (
                                <Loader2 className="w-3 h-3 animate-spin mr-1" />
                              ) : (
                                <ShieldCheck className="w-3 h-3 mr-1" />
                              )}
                              Mark Approved
                            </Button>
                          )}
                          {!plan.consentSigned && plan.status !== 'cancelled' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => quickAction(plan.id, { consentSigned: true }, 'Consent marked as signed')}
                              disabled={actioningId === plan.id}
                              className="text-blue-700 hover:bg-blue-50 border-blue-300"
                            >
                              {actioningId === plan.id ? (
                                <Loader2 className="w-3 h-3 animate-spin mr-1" />
                              ) : (
                                <FileSignature className="w-3 h-3 mr-1" />
                              )}
                              Mark Consent
                            </Button>
                          )}
                          {plan.status === 'draft' && plan.patientApproval && plan.consentSigned && (
                            <Button
                              size="sm"
                              onClick={() => quickAction(plan.id, { status: 'approved' }, 'Plan activated')}
                              disabled={actioningId === plan.id}
                              className="bg-[#2D9DA8] hover:bg-[#247d85]"
                            >
                              {actioningId === plan.id ? (
                                <Loader2 className="w-3 h-3 animate-spin mr-1" />
                              ) : (
                                <PlayCircle className="w-3 h-3 mr-1" />
                              )}
                              Activate Plan
                            </Button>
                          )}
                          {plan.status === 'approved' && (
                            <Button
                              size="sm"
                              onClick={() => quickAction(plan.id, { status: 'in_progress' }, 'Plan in progress')}
                              disabled={actioningId === plan.id}
                              className="bg-blue-600 hover:bg-blue-700"
                            >
                              {actioningId === plan.id ? (
                                <Loader2 className="w-3 h-3 animate-spin mr-1" />
                              ) : (
                                <PlayCircle className="w-3 h-3 mr-1" />
                              )}
                              Start Treatment
                            </Button>
                          )}
                          {(plan.status === 'in_progress' || plan.status === 'approved') && (
                            <Button
                              size="sm"
                              onClick={() =>
                                quickAction(plan.id, { status: 'completed', completionPercentage: 100 }, 'Plan marked completed')
                              }
                              disabled={actioningId === plan.id}
                              className="bg-green-600 hover:bg-green-700"
                            >
                              {actioningId === plan.id ? (
                                <Loader2 className="w-3 h-3 animate-spin mr-1" />
                              ) : (
                                <CheckCircle2 className="w-3 h-3 mr-1" />
                              )}
                              Mark Complete
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDelete(plan.id)}
                            disabled={deletingId === plan.id || plan.status === 'cancelled'}
                            className="text-red-600 hover:bg-red-50"
                          >
                            {deletingId === plan.id ? (
                              <Loader2 className="w-3 h-3 animate-spin mr-1" />
                            ) : (
                              <Trash2 className="w-3 h-3 mr-1" />
                            )}
                            Cancel Plan
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>New Treatment Plan{patientName ? ` — ${patientName}` : ''}</DialogTitle>
            <DialogDescription>
              Draft a phased clinical roadmap with procedures and cost estimates.
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="flex-1 -mx-1 px-1">
            <div className="space-y-4 py-2">
              {/* Seed from Service — only for new plans */}
              {!editingPlanId && services.length > 0 && (
                <div className="bg-sky-50 border border-sky-200 rounded-lg p-3 space-y-2">
                  <Label className="text-xs font-semibold text-sky-900 flex items-center gap-1">
                    <Stethoscope className="w-3.5 h-3.5" /> Seed from Clinic Service (optional)
                  </Label>
                  <div className="flex items-center gap-2">
                    <Select onValueChange={seedFromService} disabled={seedingFromSvc}>
                      <SelectTrigger className="bg-white">
                        <SelectValue placeholder={seedingFromSvc ? 'Seeding…' : 'Choose a service to pre-fill phases & procedures…'} />
                      </SelectTrigger>
                      <SelectContent>
                        {services.map(s => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.displayName || s.name}{s.priceDisplay ? ` — ${s.priceDisplay}` : (s.estimatedPrice ? ` — ₱${Number(s.estimatedPrice).toLocaleString()}` : '')}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <p className="text-[11px] text-sky-800/80">
                    Pre-fills title, description, and phases using the service's defaults or linked procedures. You can still edit anything afterwards.
                  </p>
                </div>
              )}
              {/* Basic info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Plan Title *</Label>
                  <Input
                    value={form.title}
                    onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                    placeholder="e.g., Full Mouth Rehabilitation"
                  />
                </div>
                <div>
                  <Label className="text-xs">Priority</Label>
                  <Select value={form.priority} onValueChange={v => setForm(f => ({ ...f, priority: v }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label className="text-xs">Description</Label>
                <Textarea
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  rows={2}
                  placeholder="Overall objective of this plan…"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Diagnosis</Label>
                  <Textarea
                    value={form.diagnosis}
                    onChange={e => setForm(f => ({ ...f, diagnosis: e.target.value }))}
                    rows={2}
                    placeholder="Clinical findings…"
                  />
                </div>
                <div>
                  <Label className="text-xs">Prognosis</Label>
                  <Textarea
                    value={form.prognosis}
                    onChange={e => setForm(f => ({ ...f, prognosis: e.target.value }))}
                    rows={2}
                    placeholder="Expected outcome…"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Risks</Label>
                  <Textarea
                    value={form.risks}
                    onChange={e => setForm(f => ({ ...f, risks: e.target.value }))}
                    rows={2}
                    placeholder="Known risks to discuss with patient…"
                  />
                </div>
                <div>
                  <Label className="text-xs">Benefits</Label>
                  <Textarea
                    value={form.benefits}
                    onChange={e => setForm(f => ({ ...f, benefits: e.target.value }))}
                    rows={2}
                    placeholder="Benefits of this treatment…"
                  />
                </div>
              </div>

              <Separator />

              {/* Plan Type toggle (Wave 3a: ortho nested plans) */}
              <div className="border rounded-lg p-3 bg-gradient-to-br from-gray-50 to-white">
                <Label className="text-xs font-semibold text-gray-700 mb-2 block">Plan Type</Label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setForm(f => ({ ...f, planType: 'general' }))}
                    className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded border text-sm transition-all ${
                      form.planType === 'general'
                        ? 'bg-teal-600 text-white border-teal-600 shadow-sm'
                        : 'bg-white text-gray-600 border-gray-200 hover:bg-teal-50 hover:border-teal-200'
                    }`}
                  >
                    <ClipboardList className="w-4 h-4" /> General / Restorative
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm(f => ({ ...f, planType: 'ortho' }))}
                    className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded border text-sm transition-all ${
                      form.planType === 'ortho'
                        ? 'bg-purple-600 text-white border-purple-600 shadow-sm'
                        : 'bg-white text-gray-600 border-gray-200 hover:bg-purple-50 hover:border-purple-200'
                    }`}
                  >
                    <Smile className="w-4 h-4" /> Orthodontic
                  </button>
                </div>
                {form.planType === 'ortho' && (
                  <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2 border-t pt-3">
                    <div>
                      <Label className="text-xs">Total Treatment Duration (months)</Label>
                      <Input
                        type="number"
                        min={0}
                        step={1}
                        value={form.totalDurationMonths}
                        onChange={e => setForm(f => ({ ...f, totalDurationMonths: e.target.value }))}
                        placeholder="e.g., 18"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Current Stage of Treatment</Label>
                      <Input
                        value={form.currentStageOfTreatment}
                        onChange={e => setForm(f => ({ ...f, currentStageOfTreatment: e.target.value }))}
                        placeholder="e.g., Leveling & aligning"
                      />
                    </div>
                    <p className="text-[11px] text-purple-800/80 md:col-span-2">
                      <Sparkles className="w-3 h-3 inline mr-0.5" />
                      Phases represent treatment stages; each phase can have monthly adjustment visits with wire, elastics, and bracket details.
                    </p>
                  </div>
                )}
              </div>

              {/* Phases */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-sm">
                    {form.planType === 'ortho' ? 'Treatment Stages' : 'Phases'}
                  </p>
                  <p className="text-xs text-gray-500">
                    Total estimate:{' '}
                    <span className="font-semibold text-teal-700">{formatCurrency(totalEstimate)}</span>
                  </p>
                </div>
                <Button type="button" size="sm" variant="outline" onClick={addPhase}>
                  <Plus className="w-4 h-4 mr-1" /> Add {form.planType === 'ortho' ? 'Stage' : 'Phase'}
                </Button>
              </div>

              {form.phases.map((ph, i) => (
                <div key={i} className="border rounded-lg p-3 space-y-3 bg-gray-50/50">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">Phase {ph.phaseNumber}</p>
                    {form.phases.length > 1 && (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => removePhase(i)}
                        className="text-red-600 h-7"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">Title</Label>
                      <Input
                        value={ph.title}
                        onChange={e => updatePhase(i, { title: e.target.value })}
                        placeholder="e.g., Initial Cleaning & Prophylaxis"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Priority</Label>
                      <Select value={ph.priority} onValueChange={v => updatePhase(i, { priority: v as any })}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">Low</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                          <SelectItem value="urgent">Urgent</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">Description</Label>
                    <Textarea
                      value={ph.description || ''}
                      onChange={e => updatePhase(i, { description: e.target.value })}
                      rows={1}
                      placeholder="What happens in this phase…"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">Estimated Visits</Label>
                      <Input
                        type="number"
                        min={1}
                        value={ph.estimatedVisits}
                        onChange={e => updatePhase(i, { estimatedVisits: parseInt(e.target.value) || 1 })}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Status</Label>
                      <Select value={ph.status} onValueChange={v => updatePhase(i, { status: v as any })}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="draft">Draft</SelectItem>
                          <SelectItem value="planned">Planned</SelectItem>
                          <SelectItem value="scheduled">Scheduled</SelectItem>
                          <SelectItem value="in_progress">In Progress</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                          <SelectItem value="on_hold">On Hold</SelectItem>
                          <SelectItem value="cancelled">Cancelled</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Procedures */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs font-semibold text-gray-700">Procedures</p>
                      <Button type="button" size="sm" variant="ghost" onClick={() => addProcedure(i)} className="h-6">
                        <Plus className="w-3 h-3 mr-1" /> Add
                      </Button>
                    </div>
                    {ph.procedures.length === 0 ? (
                      <p className="text-xs text-gray-400 italic">No procedures added yet.</p>
                    ) : (
                      <div className="space-y-2">
                        {ph.procedures.map((pr, pi) => (
                          <div key={pi} className="flex items-start gap-2 bg-white p-2 rounded border">
                            <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-2">
                              <Input
                                placeholder="Procedure name"
                                value={pr.name}
                                onChange={e => updateProcedure(i, pi, { name: e.target.value })}
                              />
                              <Input
                                type="number"
                                placeholder="Price (₱)"
                                value={pr.price || ''}
                                onChange={e =>
                                  updateProcedure(i, pi, { price: parseFloat(e.target.value) || 0 })
                                }
                              />
                              <ToothPicker
                                selected={pr.toothNumbers}
                                onChange={teeth => updateProcedure(i, pi, { toothNumbers: teeth })}
                                compact
                              />
                            </div>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() => removeProcedure(i, pi)}
                              className="text-red-600 h-8"
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Ortho Monthly Adjustment Visits (Wave 3a) */}
                  {form.planType === 'ortho' && (
                    <div className="border rounded-md p-2 bg-purple-50/40 border-purple-100">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-semibold text-purple-800 flex items-center gap-1">
                          <Sparkles className="w-3 h-3" /> Monthly Adjustment Visits ({(ph.visits || []).length})
                        </p>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => addVisit(i)}
                          className="h-6 text-purple-700 hover:bg-purple-100"
                        >
                          <Plus className="w-3 h-3 mr-1" /> Add Visit
                        </Button>
                      </div>
                      {(!ph.visits || ph.visits.length === 0) ? (
                        <p className="text-xs text-gray-400 italic">No adjustment visits yet. Click "Add Visit" to schedule one.</p>
                      ) : (
                        <div className="space-y-2">
                          {ph.visits.map((v, vi) => (
                            <div key={vi} className="bg-white p-2 rounded border border-purple-100 space-y-2">
                              <div className="flex items-center justify-between">
                                <p className="text-xs font-medium text-purple-900">Visit #{v.visitNumber}</p>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => removeVisit(i, vi)}
                                  className="text-red-600 h-6"
                                >
                                  <X className="w-3 h-3" />
                                </Button>
                              </div>
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                                <div>
                                  <Label className="text-[11px]">Scheduled Date</Label>
                                  <Input
                                    type="date"
                                    value={v.scheduledDate ? v.scheduledDate.slice(0, 10) : ''}
                                    onChange={e => updateVisit(i, vi, { scheduledDate: e.target.value })}
                                  />
                                </div>
                                <div>
                                  <Label className="text-[11px]">Completed Date</Label>
                                  <Input
                                    type="date"
                                    value={v.completedDate ? v.completedDate.slice(0, 10) : ''}
                                    onChange={e => updateVisit(i, vi, { completedDate: e.target.value })}
                                  />
                                </div>
                                <div>
                                  <Label className="text-[11px]">Status</Label>
                                  <Select
                                    value={v.status}
                                    onValueChange={val => updateVisit(i, vi, { status: val as any })}
                                  >
                                    <SelectTrigger className="h-9">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="scheduled">Scheduled</SelectItem>
                                      <SelectItem value="completed">Completed</SelectItem>
                                      <SelectItem value="missed">Missed</SelectItem>
                                      <SelectItem value="rescheduled">Rescheduled</SelectItem>
                                      <SelectItem value="cancelled">Cancelled</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                                <div>
                                  <Label className="text-[11px]">Wire (Upper)</Label>
                                  <Input
                                    value={v.wireUpper || ''}
                                    onChange={e => updateVisit(i, vi, { wireUpper: e.target.value })}
                                    placeholder="e.g., 0.016 NiTi"
                                  />
                                </div>
                                <div>
                                  <Label className="text-[11px]">Wire (Lower)</Label>
                                  <Input
                                    value={v.wireLower || ''}
                                    onChange={e => updateVisit(i, vi, { wireLower: e.target.value })}
                                    placeholder="e.g., 0.016 NiTi"
                                  />
                                </div>
                                <div>
                                  <Label className="text-[11px]">Elastics</Label>
                                  <Input
                                    value={v.elastics || ''}
                                    onChange={e => updateVisit(i, vi, { elastics: e.target.value })}
                                    placeholder="e.g., Class II 3/16"
                                  />
                                </div>
                              </div>
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                                <div>
                                  <Label className="text-[11px]">Bracket Changes</Label>
                                  <Input
                                    value={v.bracketChanges || ''}
                                    onChange={e => updateVisit(i, vi, { bracketChanges: e.target.value })}
                                    placeholder="e.g., Rebonded #12"
                                  />
                                </div>
                                <div>
                                  <Label className="text-[11px]">Interval to Next (weeks)</Label>
                                  <Input
                                    type="number"
                                    min={0}
                                    value={v.intervalWeeks ?? ''}
                                    onChange={e =>
                                      updateVisit(i, vi, {
                                        intervalWeeks:
                                          e.target.value === '' ? undefined : parseInt(e.target.value) || 0,
                                      })
                                    }
                                    placeholder="e.g., 4"
                                  />
                                </div>
                                <div>
                                  <Label className="text-[11px]">Adjusted By</Label>
                                  <Input
                                    value={v.adjustedBy || ''}
                                    onChange={e => updateVisit(i, vi, { adjustedBy: e.target.value })}
                                    placeholder="e.g., Dr. Cruz"
                                  />
                                </div>
                              </div>
                              <div>
                                <Label className="text-[11px]">Clinical Observations</Label>
                                <Textarea
                                  value={v.clinicalObservations || ''}
                                  onChange={e => updateVisit(i, vi, { clinicalObservations: e.target.value })}
                                  rows={1}
                                  placeholder="OH status, tracking progress…"
                                />
                              </div>
                              <div>
                                <Label className="text-[11px]">Notes</Label>
                                <Textarea
                                  value={v.notes || ''}
                                  onChange={e => updateVisit(i, vi, { notes: e.target.value })}
                                  rows={1}
                                  placeholder="Optional notes…"
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  <div>
                    <Label className="text-xs">{form.planType === 'ortho' ? 'Stage Notes' : 'Phase Notes'}</Label>
                    <Textarea
                      value={ph.notes || ''}
                      onChange={e => updatePhase(i, { notes: e.target.value })}
                      rows={1}
                      placeholder="Optional notes…"
                    />
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />}
              Save Draft
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

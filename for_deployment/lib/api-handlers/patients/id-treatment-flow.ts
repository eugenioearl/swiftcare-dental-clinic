import { NextRequest, NextResponse } from 'next/server'
import { getServerAuth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { z } from 'zod'
import { getClinicTodayRange } from '@/lib/clinic-hours'

/**
 * Treatment Flow Engine
 *
 * Tracks a visit through three explicit clinical stages:
 *   pre_treatment  -> patient prep, forms, alerts, chart review
 *   in_treatment   -> procedure execution, chart updates, notes
 *   post_treatment -> payment, visit record, follow-up, next visit
 *   completed      -> visit finished, locked
 *
 * Persists the stage per Appointment in a lightweight Json column already
 * available (visitFlow) on the Appointment model.
 */

type FlowStage = 'pre_treatment' | 'in_treatment' | 'post_treatment' | 'completed'

const STAGE_ORDER: FlowStage[] = ['pre_treatment', 'in_treatment', 'post_treatment', 'completed']

function deriveStageFromStatus(apptStatus: string, opts?: { proceduresRecordedToday?: number; manualStage?: FlowStage | null }): FlowStage {
  // Manual stage marker wins over auto-derivation when present
  if (opts?.manualStage) return opts.manualStage
  const procs = opts?.proceduresRecordedToday ?? 0
  switch (apptStatus) {
    case 'scheduled':
    case 'confirmed':
    case 'pending':
    case 'pending_assignment':
    case 'checked_in':
      return 'pre_treatment'
    case 'in_progress':
    case 'waiting':
      // Auto-advance: once at least one procedure has been recorded, visit is effectively post_treatment
      return procs > 0 ? 'post_treatment' : 'in_treatment'
    case 'completed':
      return 'completed'
    default:
      return 'pre_treatment'
  }
}

// Parse a stored flow-stage marker from appointment.internalNotes (format: [[FLOW:<stage>]])
function extractManualStage(internalNotes?: string | null): FlowStage | null {
  if (!internalNotes) return null
  const m = /\[\[FLOW:([a-z_]+)\]\]/.exec(internalNotes)
  if (!m) return null
  const s = m[1] as FlowStage
  if (['pre_treatment', 'in_treatment', 'post_treatment', 'completed'].includes(s)) return s
  return null
}

function setManualStageMarker(internalNotes: string | null | undefined, stage: FlowStage): string {
  const base = (internalNotes || '').replace(/\[\[FLOW:[a-z_]+\]\]/g, '').trim()
  return (base ? base + '\n' : '') + `[[FLOW:${stage}]]`
}

function age(dob: Date | null | undefined): number | null {
  if (!dob) return null
  const d = new Date(dob)
  const now = new Date()
  let a = now.getFullYear() - d.getFullYear()
  const m = now.getMonth() - d.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) a--
  return a
}

async function buildFlow(patientId: string) {
  // Load patient (demographics + medical alerts)
  const patient = await prisma.patient.findUnique({
    where: { id: patientId },
    include: {
      user: { select: { firstName: true, lastName: true } },
    },
  })
  if (!patient) return null

  // Today's active appointment (if any)
  const { startOfDay, endOfDay } = getClinicTodayRange()

  const todaysAppts = await prisma.appointment.findMany({
    where: { patientId, scheduledDatetime: { gte: startOfDay, lte: endOfDay } },
    orderBy: { scheduledDatetime: 'asc' },
    include: {
      dentist: { include: { user: { select: { firstName: true, lastName: true } } } },
      appointmentTreatments: { include: { treatment: true } },
    },
  })

  const activeAppt = todaysAppts.find(a => a.status !== 'cancelled' && a.status !== 'no_show') || todaysAppts[0] || null

  // Pull manual stage marker (if any) from internalNotes
  const manualStage = extractManualStage(activeAppt?.internalNotes as any)

  // Packages + consents + procedures for guardrails
  const activePackages = await prisma.treatmentPackage.findMany({
    where: { patientId, status: { in: ['active', 'in_progress', 'draft'] } },
    include: { items: { include: { treatment: true } } },
  })

  // Active/approved treatment plan (guardrail — no in_treatment without a plan)
  const activePlan = await prisma.treatmentPlan.findFirst({
    where: { patientId, status: { in: ['approved', 'in_progress'] } },
    orderBy: { createdAt: 'desc' },
    select: { id: true, title: true, status: true, patientApproval: true, consentSigned: true },
  })
  const anyApprovedPlan = activePlan ?? await prisma.treatmentPlan.findFirst({
    where: { patientId, status: 'draft', patientApproval: true, consentSigned: true },
    orderBy: { createdAt: 'desc' },
    select: { id: true, title: true, status: true, patientApproval: true, consentSigned: true },
  })

  const unsignedConsents = await prisma.consentForm.count({
    where: { patientId, status: { in: ['draft', 'sent', 'viewed'] } },
  })

  const signedConsents = await prisma.consentForm.count({
    where: { patientId, status: 'signed' },
  })

  const totalBalanceDue = activePackages.reduce((s, p) => s + Number(p.balanceDue || 0), 0)

  // Count procedures recorded today
  const proceduresRecordedToday = activeAppt
    ? await prisma.procedureRecord.count({
      where: {
        patientId,
        procedureDate: { gte: startOfDay, lte: endOfDay },
      },
    })
    : 0

  // Count clinical notes added today (any type) for this patient
  const clinicalNotesAddedToday = await prisma.clinicalNote.count({
    where: {
      patientId,
      createdAt: { gte: startOfDay, lte: endOfDay },
    },
  })

  // Post-op specific notes recorded today
  const postOpNotesToday = await prisma.clinicalNote.count({
    where: {
      patientId,
      createdAt: { gte: startOfDay, lte: endOfDay },
      noteType: { in: ['post_op', 'post_operative', 'post-op', 'postop', 'instructions'] },
    },
  })

  // Any follow-up appointment scheduled after today
  const tomorrowStart = new Date(endOfDay.getTime() + 1)
  const followUpAppt = await prisma.appointment.findFirst({
    where: {
      patientId,
      scheduledDatetime: { gte: tomorrowStart },
      status: { notIn: ['cancelled', 'rejected', 'no_show'] },
    },
    orderBy: { scheduledDatetime: 'asc' },
    select: { id: true, scheduledDatetime: true },
  })

  // Resolve the effective stage using manual marker + heuristics
  const stage: FlowStage = activeAppt
    ? deriveStageFromStatus(activeAppt.status as string, { proceduresRecordedToday, manualStage })
    : 'pre_treatment'

  // Compute patient age + minor flag
  const dob = patient.dateOfBirth
  const patientAge = age(dob as any)
  const isMinor = typeof patientAge === 'number' ? patientAge < 18 : false

  // Medical alerts
  const alerts: { level: 'danger' | 'warn' | 'info'; message: string }[] = []
  if (patient.allergies) alerts.push({ level: 'danger', message: `Allergies: ${patient.allergies}` })
  if (patient.currentMedications) alerts.push({ level: 'warn', message: `Current medications: ${patient.currentMedications}` })
  if (patient.pregnancyStatus && patient.pregnancyStatus !== 'not_applicable' && patient.pregnancyStatus !== 'not_pregnant') {
    alerts.push({ level: 'warn', message: `Pregnancy status: ${patient.pregnancyStatus}` })
  }
  if (isMinor) alerts.push({ level: 'info', message: `Patient is a minor (age ${patientAge}). Guardian consent required.` })

  // Stage-specific checklist
  const preTasks: { key: string; label: string; done: boolean; blocking?: boolean }[] = [
    { key: 'checked_in', label: 'Patient checked in', done: !!activeAppt && ['checked_in', 'in_progress', 'waiting', 'completed'].includes(activeAppt.status as string) },
    { key: 'demographics_reviewed', label: 'Demographics & medical history reviewed', done: !!patient.medicalHistory },
    { key: 'chart_reviewed', label: 'Dental chart reviewed', done: !!patient.currentChartType },
    { key: 'plan_ready', label: 'Treatment plan approved & activated', done: !!activePlan || !!anyApprovedPlan, blocking: true },
    { key: 'consents_ready', label: isMinor ? 'Guardian consent signed (minor)' : 'Consent forms signed', done: unsignedConsents === 0, blocking: true },
    { key: 'procedure_confirmed', label: 'Today’s procedure confirmed', done: !!activeAppt && (activeAppt.appointmentTreatments?.length || 0) > 0 },
  ]

  const inTasks = [
    { key: 'treatment_started', label: 'Treatment started', done: !!activeAppt && activeAppt.status === 'in_progress' },
    { key: 'chart_updated', label: 'Chart updated during procedure', done: !!patient.chartTypeSetAt },
    { key: 'procedure_recorded', label: 'Procedure(s) recorded', done: proceduresRecordedToday > 0, blocking: true },
    { key: 'clinical_notes_added', label: 'Clinical notes captured', done: clinicalNotesAddedToday > 0 },
  ]

  const postTasks = [
    { key: 'treatment_completed', label: 'Treatment marked complete', done: !!activeAppt && activeAppt.status === 'completed' },
    { key: 'payment_recorded', label: 'Payment recorded / balance settled', done: totalBalanceDue <= 0 },
    { key: 'package_updated', label: 'Package usage updated', done: activePackages.some(p => (p.items || []).some(i => i.status === 'completed')) },
    { key: 'followup_scheduled', label: 'Follow-up / next visit scheduled', done: !!followUpAppt },
    { key: 'post_op_instructions', label: 'Post-op instructions shared', done: postOpNotesToday > 0 || clinicalNotesAddedToday > 0 },
  ]

  // Guardrails
  const hasActivePlan = !!activePlan
  const canStartTreatment = unsignedConsents === 0 && (!!activePlan || !!anyApprovedPlan)
  const canCompleteTreatment = proceduresRecordedToday > 0

  // Dynamic modifiers
  const modifiers: string[] = []
  if (isMinor) modifiers.push('minor')
  const types = (activeAppt?.appointmentTreatments || []).map(t => t.treatment?.category).filter(Boolean) as string[]
  if (types.includes('surgical')) modifiers.push('surgical')
  if (types.includes('cleaning')) modifiers.push('simple_cleaning')
  if (activeAppt?.appointmentType === 'walk_in') modifiers.push('walk_in')

  return {
    patientId,
    stage,
    stageOrder: STAGE_ORDER,
    activeAppointmentId: activeAppt?.id || null,
    activeAppointmentStatus: activeAppt?.status || null,
    activeAppointmentType: activeAppt?.appointmentType || null,
    scheduledDatetime: activeAppt?.scheduledDatetime || null,
    dentistName: activeAppt?.dentist?.user
      ? `${activeAppt.dentist.user.lastName}, ${activeAppt.dentist.user.firstName}`
      : null,
    isMinor,
    patientAge,
    modifiers,
    alerts,
    tasks: {
      pre_treatment: preTasks,
      in_treatment: inTasks,
      post_treatment: postTasks,
    },
    guardrails: {
      canStartTreatment,
      canCompleteTreatment,
      unsignedConsents,
      signedConsents,
      proceduresRecordedToday,
      totalBalanceDue,
      hasActivePlan,
      activePlan: activePlan || anyApprovedPlan || null,
    },
    summary: {
      hasActiveAppointment: !!activeAppt,
      activePackages: activePackages.length,
      unsignedConsents,
      signedConsents,
      totalBalanceDue,
    },
  }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerAuth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const data = await buildFlow(params.id)
    if (!data) return NextResponse.json({ error: 'Patient not found' }, { status: 404 })
    return NextResponse.json(data)
  } catch (err) {
    console.error('[treatment-flow] GET error', err)
    return NextResponse.json({ error: 'Failed to load treatment flow' }, { status: 500 })
  }
}

/**
 * POST /api/patients/[id]/treatment-flow
 * Body: { action: 'advance' | 'set_stage' | 'record_task', stage?: FlowStage, taskKey?: string, note?: string }
 *
 * Side-effects:
 *   - When transitioning to `in_treatment`, sets the active appointment.status = 'in_progress'
 *   - When transitioning to `completed`, sets appointment.status = 'completed'
 *   - Writes an AuditLog entry with category=CLINICAL
 */
const postSchema = z.object({
  action: z.enum(['advance', 'set_stage', 'record_task']),
  stage: z.enum(['pre_treatment', 'in_treatment', 'post_treatment', 'completed']).optional(),
  taskKey: z.string().optional(),
  note: z.string().optional(),
  force: z.boolean().optional(),
})

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerAuth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json()
    const parsed = postSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid payload', details: parsed.error.errors }, { status: 400 })
    }
    const { action, stage, taskKey, note } = parsed.data

    const current = await buildFlow(params.id)
    if (!current) return NextResponse.json({ error: 'Patient not found' }, { status: 404 })

    // Determine target stage
    let target: FlowStage | undefined
    if (action === 'advance') {
      const idx = STAGE_ORDER.indexOf(current.stage)
      target = STAGE_ORDER[Math.min(idx + 1, STAGE_ORDER.length - 1)]
    } else if (action === 'set_stage' && stage) {
      target = stage
    }

    // Soft guardrails - collected as warnings instead of blocking 409s.
    // The clinician remains in control and can advance when they decide it is appropriate.
    const warnings: string[] = []
    if (target === 'in_treatment') {
      if (current.guardrails.unsignedConsents > 0) {
        warnings.push(`${current.guardrails.unsignedConsents} consent form(s) still unsigned.`)
      }
      if (!current.guardrails.hasActivePlan && !current.guardrails.activePlan) {
        warnings.push('No approved treatment plan is active yet.')
      }
    }
    if (target === 'post_treatment' && !current.guardrails.canCompleteTreatment) {
      warnings.push('No procedure has been recorded for this visit yet.')
    }

    // Apply transition via appointment.status if possible; also persist the target stage
    // via a marker in internalNotes so the UI reflects the stage correctly on refresh.
    if (target && current.activeAppointmentId) {
      let newStatus: string | null = null
      if (target === 'in_treatment') newStatus = 'in_progress'
      else if (target === 'post_treatment') newStatus = 'in_progress' // still in progress until completed
      else if (target === 'completed') newStatus = 'completed'

      // Load current internalNotes to preserve existing content
      const existingAppt = await prisma.appointment.findUnique({
        where: { id: current.activeAppointmentId },
        select: { internalNotes: true },
      })
      const nextInternalNotes = setManualStageMarker(existingAppt?.internalNotes || '', target)

      const data: any = { updatedAt: new Date(), internalNotes: nextInternalNotes }
      if (newStatus) data.status = newStatus
      if (target === 'in_treatment') data.startedAt = new Date()
      if (target === 'completed') data.completedAt = new Date()
      await prisma.appointment.update({
        where: { id: current.activeAppointmentId },
        data,
      })
    }

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: (session.user as any).id,
        action: 'update',
        entityType: 'TreatmentFlow',
        entityId: params.id,
        category: 'CLINICAL',
        description: action === 'record_task'
          ? `Recorded flow task ${taskKey || 'unknown'}${note ? `: ${note}` : ''}`
          : `Treatment flow ${action}${target ? ` \u2192 ${target}` : ''}${note ? `: ${note}` : ''}`,
        oldValues: { stage: current.stage } as any,
        newValues: { action, target, taskKey, note } as any,
      },
    }).catch((err: any) => console.warn('[treatment-flow] audit log failed', err))

    const next = await buildFlow(params.id)
    return NextResponse.json({ ...next, warnings })
  } catch (err) {
    console.error('[treatment-flow] POST error', err)
    return NextResponse.json({ error: 'Failed to update treatment flow' }, { status: 500 })
  }
}

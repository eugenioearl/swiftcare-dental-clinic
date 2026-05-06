import { NextRequest, NextResponse } from 'next/server'
import { getServerAuth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { z } from 'zod'
import { sendTreatmentPlanCreatedEmail } from '@/lib/email-notifications'
import { createNotification, getDentistUserId } from '@/lib/notifications'

/**
 * Patient-scoped Treatment Plans (clinical roadmap, NOT the same as TreatmentPackage).
 * - phases: ordered array of phase objects
 *     { id, phaseNumber, title, description, status, priority, procedures: [{treatmentId, name, price, toothNumbers, notes}], formTemplateKeys: [], estimatedVisits, notes }
 *
 * Endpoints:
 *   GET  /api/patients/:id/treatment-plans  -> list
 *   POST /api/patients/:id/treatment-plans  -> create
 */

// Nested monthly adjustment visit for orthodontic plans
const orthoVisitSchema = z.object({
  id: z.string().optional(),
  visitNumber: z.number().int().min(1),
  scheduledDate: z.string().optional().nullable(),
  completedDate: z.string().optional().nullable(),
  status: z.enum(['scheduled', 'completed', 'rescheduled', 'missed', 'cancelled']).default('scheduled'),
  wireUpper: z.string().optional().nullable(),
  wireLower: z.string().optional().nullable(),
  bracketChanges: z.string().optional().nullable(),
  elastics: z.string().optional().nullable(),
  intervalWeeks: z.number().int().nonnegative().optional().nullable(),
  clinicalObservations: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  adjustedBy: z.string().optional().nullable(),
})

const phaseSchema = z.object({
  id: z.string().optional(),
  phaseNumber: z.number().int().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  status: z.enum(['draft', 'planned', 'scheduled', 'in_progress', 'completed', 'on_hold', 'cancelled']).default('draft'),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  procedures: z.array(z.object({
    id: z.string().optional(),
    treatmentId: z.string().uuid().optional(),
    name: z.string(),
    price: z.number().nonnegative().default(0),
    toothNumbers: z.array(z.string()).default([]),
    notes: z.string().optional(),
    status: z.enum(['planned', 'scheduled', 'in_progress', 'completed', 'cancelled']).default('planned'),
  })).default([]),
  formTemplateKeys: z.array(z.string()).default([]),
  estimatedVisits: z.number().int().nonnegative().default(1),
  notes: z.string().optional(),
  // Ortho-only: nested monthly adjustment visits
  visits: z.array(orthoVisitSchema).optional().default([]),
})

const createSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  diagnosis: z.string().optional(),
  prognosis: z.string().optional(),
  priority: z.string().default('medium'),
  phases: z.array(phaseSchema).optional(),
  estimatedStartDate: z.string().datetime().optional(),
  estimatedEndDate: z.string().datetime().optional(),
  estimatedCost: z.number().nonnegative().optional(),
  dentistId: z.string().uuid().optional(),
  risks: z.string().optional(),
  benefits: z.string().optional(),
  alternativeTreatments: z.any().optional(),
  // NEW — seed the plan from an official clinic service
  serviceId: z.string().uuid().optional(),
  appointmentId: z.string().uuid().optional(),
  // Wave 3: orthodontic plan support
  planType: z.enum(['general', 'ortho']).optional(),
  totalDurationMonths: z.number().int().nonnegative().optional(),
  currentStageOfTreatment: z.string().optional(),
})

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerAuth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const plans = await prisma.treatmentPlan.findMany({
      where: { patientId: params.id },
      include: {
        dentist: { include: { user: { select: { firstName: true, lastName: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({
      treatmentPlans: plans.map(p => {
        const comm = (p.communicationLog as any) || {}
        return {
          ...p,
          dentistName: p.dentist?.user ? `${p.dentist.user.lastName}, ${p.dentist.user.firstName}` : null,
          estimatedCost: p.estimatedCost ? Number(p.estimatedCost) : null,
          actualCost: p.actualCost ? Number(p.actualCost) : null,
          // Surface ortho metadata for convenient frontend access
          planType: comm.planType || 'general',
          totalDurationMonths: comm.totalDurationMonths ?? null,
          currentStageOfTreatment: comm.currentStageOfTreatment ?? null,
        }
      }),
    })
  } catch (err) {
    console.error('[treatment-plans] GET error', err)
    return NextResponse.json({ error: 'Failed to load treatment plans' }, { status: 500 })
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerAuth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json()
    const parsed = createSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid payload', details: parsed.error.errors }, { status: 400 })
    }
    const d = parsed.data

    // ---- Service-based seeding ----
    // If a serviceId is supplied (and no explicit phases/title), hydrate the plan
    // from the ClinicService's defaultPlanPhases / defaultPlanTitle / linkedTreatmentIds.
    let seededTitle = d.title
    let seededPhases = Array.isArray(d.phases) ? d.phases : []
    let seededDescription = d.description
    let linkedServiceId: string | null = null

    if (d.serviceId) {
      const svc: any = await prisma.clinicService.findUnique({ where: { id: d.serviceId } })
      if (!svc || !svc.isActive) {
        return NextResponse.json({ error: 'Service not found or inactive' }, { status: 400 })
      }
      linkedServiceId = svc.id
      if (!seededTitle) seededTitle = svc.defaultPlanTitle || svc.displayName || svc.name
      if (!seededDescription) seededDescription = svc.description || undefined
      // Seed phases from defaultPlanPhases if caller didn't supply any.
      if (seededPhases.length === 0) {
        if (Array.isArray(svc.defaultPlanPhases) && svc.defaultPlanPhases.length > 0) {
          seededPhases = svc.defaultPlanPhases.map((ph: any, i: number) => ({
            id: ph.id || `phase-${i + 1}`,
            phaseNumber: ph.phaseNumber || i + 1,
            title: ph.title || `Phase ${i + 1}`,
            description: ph.description || '',
            status: 'draft',
            priority: ph.priority || 'medium',
            procedures: Array.isArray(ph.procedures)
              ? ph.procedures.map((pr: any, j: number) => ({
                  id: pr.id || `p-${i + 1}-${j + 1}`,
                  treatmentId: pr.treatmentId || undefined,
                  name: pr.name || 'Procedure',
                  price: Number(pr.price || 0),
                  toothNumbers: Array.isArray(pr.toothNumbers) ? pr.toothNumbers : [],
                  notes: pr.notes || '',
                  status: 'planned',
                }))
              : [],
            formTemplateKeys: Array.isArray(ph.formTemplateKeys) ? ph.formTemplateKeys : [],
            estimatedVisits: Number(ph.estimatedVisits || 1),
            notes: ph.notes || '',
          }))
        } else if (Array.isArray(svc.linkedTreatmentIds) && svc.linkedTreatmentIds.length > 0) {
          // Fallback: build a single phase with the linked procedures
          const treatments = await prisma.treatment.findMany({
            where: { id: { in: svc.linkedTreatmentIds } },
            select: { id: true, name: true, baseCost: true, category: true },
          })
          seededPhases = [{
            id: 'phase-1',
            phaseNumber: 1,
            title: svc.displayName || svc.name,
            description: svc.description || '',
            status: 'draft',
            priority: 'medium',
            procedures: treatments.map((t, j) => ({
              id: `p-1-${j + 1}`,
              treatmentId: t.id,
              name: t.name,
              price: Number(t.baseCost || 0),
              toothNumbers: [],
              notes: '',
              status: 'planned',
            })),
            formTemplateKeys: Array.isArray(svc.linkedFormTemplateKeys)
              ? svc.linkedFormTemplateKeys
              : [],
            estimatedVisits: 1,
            notes: '',
          }]
        }
      }
    }

    if (!seededTitle || seededTitle.length === 0) {
      return NextResponse.json({ error: 'title is required' }, { status: 400 })
    }

    // Auto-compute estimatedCost from phases if not provided
    const totalFromPhases = seededPhases.reduce(
      (s: number, ph: any) =>
        s + (Array.isArray(ph.procedures) ? ph.procedures.reduce((a: number, p: any) => a + (Number(p.price) || 0), 0) : 0),
      0
    )
    const estimatedCost = typeof d.estimatedCost === 'number' ? d.estimatedCost : totalFromPhases

    // Auto-assign dentistId from session (when the creator is a dentist) if caller didn't specify
    let resolvedDentistId = d.dentistId
    if (!resolvedDentistId) {
      try {
        const sessUser: any = session.user
        if (sessUser?.role === 'dentist' && sessUser?.id) {
          const dentistRow = await prisma.dentist.findUnique({ where: { userId: sessUser.id }, select: { id: true } })
          if (dentistRow?.id) resolvedDentistId = dentistRow.id
        }
      } catch {}
    }

    const created = await prisma.treatmentPlan.create({
      data: {
        patientId: params.id,
        dentistId: resolvedDentistId,
        title: seededTitle!,
        description: seededDescription,
        diagnosis: d.diagnosis,
        prognosis: d.prognosis,
        priority: d.priority,
        phases: seededPhases as any,
        estimatedStartDate: d.estimatedStartDate ? new Date(d.estimatedStartDate) : null,
        estimatedEndDate: d.estimatedEndDate ? new Date(d.estimatedEndDate) : null,
        estimatedCost,
        risks: d.risks,
        benefits: d.benefits,
        alternativeTreatments: d.alternativeTreatments,
        status: 'draft',
        // stash metadata in communicationLog JSON for traceability without schema change
        communicationLog: {
          ...(linkedServiceId ? { seededFromServiceId: linkedServiceId, seededFromAppointmentId: d.appointmentId || null } : {}),
          ...(d.planType ? { planType: d.planType } : {}),
          ...(typeof d.totalDurationMonths === 'number' ? { totalDurationMonths: d.totalDurationMonths } : {}),
          ...(d.currentStageOfTreatment ? { currentStageOfTreatment: d.currentStageOfTreatment } : {}),
        } as any,
      },
    })

    await prisma.auditLog.create({
      data: {
        userId: (session.user as any).id,
        action: 'create',
        entityType: 'TreatmentPlan',
        entityId: created.id,
        category: 'CLINICAL',
        description: `Created treatment plan: ${seededTitle}${linkedServiceId ? ' (seeded from service)' : ''}`,
        newValues: { title: seededTitle, phases: seededPhases.length, estimatedCost, seededFromServiceId: linkedServiceId } as any,
      },
    }).catch(() => null)

    // Notify the patient by email (best-effort, non-blocking)
    let patientUserId: string | null = null
    let patientName = 'Patient'
    try {
      const patient = await prisma.patient.findUnique({
        where: { id: params.id },
        include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } },
      })
      if (patient?.user) {
        patientUserId = patient.user.id
        patientName = `${patient.user.lastName}, ${patient.user.firstName}`
      } else if ((patient as any)?.fullName) {
        patientName = (patient as any).fullName
      }
      let dentistName: string | null = null
      if (resolvedDentistId) {
        const dentist = await prisma.dentist.findUnique({
          where: { id: resolvedDentistId },
          include: { user: { select: { firstName: true, lastName: true } } },
        })
        if (dentist?.user) dentistName = `${dentist.user.lastName}, ${dentist.user.firstName}`
      }
      if (patient?.user?.email) {
        // Fire-and-forget; do not await in request path to avoid slowing the UI
        void sendTreatmentPlanCreatedEmail({
          planId: created.id,
          planTitle: seededTitle!,
          patientName: `${patient.user.lastName}, ${patient.user.firstName}`,
          patientEmail: patient.user.email,
          dentistName,
          totalPhases: seededPhases.length,
          estimatedCost: estimatedCost || null,
          description: seededDescription || null,
        })
      }
    } catch (err) {
      console.warn('[treatment-plans POST] failed to send patient email notification', err)
    }

    // ---------- Phase 2 in-app notifications ----------
    try {
      const patientPlanRedirect = `/admin/patients/${params.id}?tab=treatment-plans`
      // Notify patient (if they have a user account)
      if (patientUserId) {
        await createNotification({
          userId: patientUserId,
          title: 'New Treatment Plan Created',
          message: `A treatment plan "${seededTitle}" with ${seededPhases.length} phase(s) has been created for you.`,
          type: 'treatment_plan',
          priority: 'normal',
          module: 'clinical',
          relatedRecordId: created.id,
          redirectUrl: '/dashboard/treatment-plans',
        }).catch((err) => console.error('[treatment-plans POST] notify patient failed:', err))
      }
      // Notify assigned dentist (if present and has user account)
      if (resolvedDentistId) {
        const dUserId = await getDentistUserId(resolvedDentistId)
        if (dUserId) {
          await createNotification({
            userId: dUserId,
            title: 'Treatment Plan Assigned',
            message: `A new treatment plan "${seededTitle}" for ${patientName} is ready for your review.`,
            type: 'treatment_plan',
            priority: 'normal',
            module: 'clinical',
            relatedRecordId: created.id,
            redirectUrl: patientPlanRedirect,
          }).catch((err) => console.error('[treatment-plans POST] notify dentist failed:', err))
        }
      }
    } catch (notifyErr) {
      console.error('[treatment-plans POST] in-app notification failed (non-fatal):', notifyErr)
    }

    return NextResponse.json(created)
  } catch (err) {
    console.error('[treatment-plans] POST error', err)
    return NextResponse.json({ error: 'Failed to create treatment plan' }, { status: 500 })
  }
}

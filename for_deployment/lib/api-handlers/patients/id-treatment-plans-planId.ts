import { NextRequest, NextResponse } from 'next/server'
import { getServerAuth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { z } from 'zod'
import { sendTreatmentPlanApprovedEmail } from '@/lib/email-notifications'
import { createNotification, notifyRoles, ADMIN_STAFF_ROLES, getDentistUserId } from '@/lib/notifications'

// PUT /api/patients/[id]/treatment-plans/[planId]
// DELETE /api/patients/[id]/treatment-plans/[planId]

const updateSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  diagnosis: z.string().optional(),
  prognosis: z.string().optional(),
  priority: z.string().optional(),
  phases: z.array(z.any()).optional(),
  status: z.enum(['draft', 'active', 'in_progress', 'completed', 'cancelled', 'on_hold']).optional(),
  estimatedCost: z.number().optional(),
  approvedCost: z.number().optional(),
  actualCost: z.number().optional(),
  patientApproval: z.boolean().optional(),
  consentSigned: z.boolean().optional(),
  currentPhase: z.string().optional(),
  completionPercentage: z.number().min(0).max(100).optional(),
  risks: z.string().optional(),
  benefits: z.string().optional(),
  clinicalNotes: z.string().optional(),
  patientNotes: z.string().optional(),
  // Wave 3: orthodontic plan support
  planType: z.enum(['general', 'ortho']).optional(),
  totalDurationMonths: z.number().int().nonnegative().optional(),
  currentStageOfTreatment: z.string().optional(),
})

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string; planId: string } },
) {
  const session = await getServerAuth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const plan = await prisma.treatmentPlan.findFirst({
    where: { id: params.planId, patientId: params.id },
    include: {
      dentist: { include: { user: { select: { firstName: true, lastName: true } } } },
    },
  })
  if (!plan) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const comm = (plan.communicationLog as any) || {}
  return NextResponse.json({
    ...plan,
    dentistName: plan.dentist?.user ? `${plan.dentist.user.lastName}, ${plan.dentist.user.firstName}` : null,
    estimatedCost: plan.estimatedCost ? Number(plan.estimatedCost) : null,
    approvedCost: plan.approvedCost ? Number(plan.approvedCost) : null,
    actualCost: plan.actualCost ? Number(plan.actualCost) : null,
    planType: comm.planType || 'general',
    totalDurationMonths: comm.totalDurationMonths ?? null,
    currentStageOfTreatment: comm.currentStageOfTreatment ?? null,
  })
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string; planId: string } },
) {
  const session = await getServerAuth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const body = await req.json()
    const parsed = updateSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: 'Invalid payload', details: parsed.error.errors }, { status: 400 })

    const existing = await prisma.treatmentPlan.findFirst({ where: { id: params.planId, patientId: params.id } })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const data: any = { ...parsed.data }
    if (data.status === 'completed' && !existing.actualEndDate) data.actualEndDate = new Date()
    if (data.status === 'in_progress' && !existing.actualStartDate) data.actualStartDate = new Date()
    if (data.patientApproval === true && !existing.approvalDate) data.approvalDate = new Date()
    if (data.consentSigned === true && !existing.consentDate) data.consentDate = new Date()

    // Wave 3: merge planType/ortho metadata into communicationLog JSON
    const orthoMetaKeys = ['planType', 'totalDurationMonths', 'currentStageOfTreatment'] as const
    const orthoMeta: Record<string, any> = {}
    for (const k of orthoMetaKeys) {
      if (data[k] !== undefined) {
        orthoMeta[k] = data[k]
        delete data[k]
      }
    }
    if (Object.keys(orthoMeta).length > 0) {
      const existingComm = (existing.communicationLog as any) || {}
      data.communicationLog = { ...existingComm, ...orthoMeta }
    }

    const updated = await prisma.treatmentPlan.update({
      where: { id: params.planId },
      data,
    })

    await prisma.auditLog.create({
      data: {
        userId: (session.user as any).id,
        action: 'update',
        entityType: 'TreatmentPlan',
        entityId: params.planId,
        category: 'CLINICAL',
        description: `Updated treatment plan: ${existing.title}`,
        oldValues: { status: existing.status, completionPercentage: existing.completionPercentage } as any,
        newValues: parsed.data as any,
      },
    }).catch(() => null)

    // Notify dentist/admin when patient approval or consent is freshly flipped to true
    const justApproved = data.patientApproval === true && !existing.patientApproval
    const justConsented = data.consentSigned === true && !existing.consentSigned
    if (justApproved || justConsented) {
      try {
        const patient = await prisma.patient.findUnique({
          where: { id: params.id },
          include: { user: { select: { firstName: true, lastName: true } } },
        })
        let dentistEmail: string | null = null
        if (existing.dentistId) {
          const dentist = await prisma.dentist.findUnique({
            where: { id: existing.dentistId },
            include: { user: { select: { email: true } } },
          })
          dentistEmail = dentist?.user?.email || null
        }
        // Also find any admin to notify as fallback
        let adminEmail: string | null = null
        if (!dentistEmail) {
          const admin = await prisma.user.findFirst({
            where: { role: { in: ['admin', 'super_admin'] } },
            select: { email: true },
            orderBy: { createdAt: 'asc' },
          })
          adminEmail = admin?.email || null
        }
        if (patient?.user && (dentistEmail || adminEmail)) {
          void sendTreatmentPlanApprovedEmail({
            planId: existing.id,
            planTitle: existing.title,
            patientName: `${patient.user.lastName}, ${patient.user.firstName}`,
            dentistEmail,
            adminEmail,
            approval: justApproved && justConsented ? 'both' : justConsented ? 'consent' : 'approval',
          })
        }

        // ---------- Phase 2 in-app notifications ----------
        const patientFullName = patient?.user
          ? `${patient.user.lastName}, ${patient.user.firstName}`
          : 'Patient'
        const planRedirect = `/admin/patients/${params.id}?tab=treatment-plans`
        const approvalLabel = justApproved && justConsented
          ? 'approved and signed consent for'
          : justConsented
            ? 'signed consent for'
            : 'approved'

        // Notify assigned dentist (if any)
        if (existing.dentistId) {
          const dUserId = await getDentistUserId(existing.dentistId)
          if (dUserId) {
            await createNotification({
              userId: dUserId,
              title: 'Treatment Plan Approved by Patient',
              message: `${patientFullName} ${approvalLabel} the treatment plan "${existing.title}".`,
              type: 'treatment_plan_approved',
              priority: 'normal',
              module: 'clinical',
              relatedRecordId: existing.id,
              redirectUrl: planRedirect,
            }).catch((err) => console.error('[treatment-plans PUT] notify dentist failed:', err))
          }
        }

        // Broadcast to admin + staff so the front desk is aware
        await notifyRoles(ADMIN_STAFF_ROLES, {
          title: 'Treatment Plan Approved',
          message: `${patientFullName} ${approvalLabel} the treatment plan "${existing.title}".`,
          type: 'treatment_plan_approved',
          priority: 'normal',
          module: 'clinical',
          relatedRecordId: existing.id,
          redirectUrl: planRedirect,
          dedupeKey: `treatment_plan:${existing.id}:approved`,
        }).catch((err) => console.error('[treatment-plans PUT] notify staff/admin failed:', err))
      } catch (err) {
        console.warn('[treatment-plans PUT] failed to send approval email/notification', err)
      }
    }

    // Notify staff/admin when plan status transitions to completed
    if (data.status === 'completed' && existing.status !== 'completed') {
      try {
        const patient = await prisma.patient.findUnique({
          where: { id: params.id },
          include: { user: { select: { firstName: true, lastName: true } } },
        })
        const patientFullName = patient?.user
          ? `${patient.user.lastName}, ${patient.user.firstName}`
          : 'Patient'
        await notifyRoles(ADMIN_STAFF_ROLES, {
          title: 'Treatment Plan Completed',
          message: `Treatment plan "${existing.title}" for ${patientFullName} has been marked as completed.`,
          type: 'treatment_plan',
          priority: 'normal',
          module: 'clinical',
          relatedRecordId: existing.id,
          redirectUrl: `/admin/patients/${params.id}?tab=treatment-plans`,
          dedupeKey: `treatment_plan:${existing.id}:completed`,
        }).catch((err) => console.error('[treatment-plans PUT] notify completed failed:', err))
      } catch (err) {
        console.warn('[treatment-plans PUT] failed to notify staff of completion', err)
      }
    }

    return NextResponse.json(updated)
  } catch (err) {
    console.error('[treatment-plans] PUT error', err)
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string; planId: string } },
) {
  const session = await getServerAuth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const existing = await prisma.treatmentPlan.findFirst({ where: { id: params.planId, patientId: params.id } })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // Soft-cancel instead of hard delete to preserve history
    const updated = await prisma.treatmentPlan.update({
      where: { id: params.planId },
      data: { status: 'cancelled' },
    })

    await prisma.auditLog.create({
      data: {
        userId: (session.user as any).id,
        action: 'delete',
        entityType: 'TreatmentPlan',
        entityId: params.planId,
        category: 'CLINICAL',
        description: `Cancelled treatment plan: ${existing.title}`,
      },
    }).catch(() => null)

    return NextResponse.json(updated)
  } catch (err) {
    console.error('[treatment-plans] DELETE error', err)
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 })
  }
}

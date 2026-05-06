import { NextRequest, NextResponse } from 'next/server'
import { getServerAuth } from '@/lib/auth'
import { prisma } from '@/lib/db'

// GET /api/patients/[id]/timeline - aggregated timeline with audit events + consent/form events
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerAuth()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const patientId = params.id
    const url = new URL(request.url)
    const page = parseInt(url.searchParams.get('page') || '1')
    const limit = parseInt(url.searchParams.get('limit') || '50')
    const rawType = url.searchParams.get('type')
    const typeFilter = rawType === 'all' ? null : rawType
    const search = url.searchParams.get('search') || ''

    const patient = await prisma.patient.findUnique({ where: { id: patientId }, select: { id: true } })
    if (!patient) return NextResponse.json({ error: 'Patient not found' }, { status: 404 })

    const timeline: any[] = []

    // Helper to resolve user name from ID
    const userNameCache: Record<string, string> = {}
    async function resolveUserName(userId: string | null | undefined): Promise<string | null> {
      if (!userId) return null
      if (userNameCache[userId]) return userNameCache[userId]
      try {
        const u = await prisma.user.findUnique({ where: { id: userId }, select: { firstName: true, lastName: true, email: true } })
        const name = u ? `${u.lastName || ''}, ${u.firstName || ''}`.replace(/^, |, $/g, '') || u.email || 'Unknown' : null
        if (name) userNameCache[userId] = name
        return name
      } catch { return null }
    }

    // === VISITS ===
    if (!typeFilter || typeFilter === 'visit') {
      const visits = await prisma.visitRecord.findMany({
        where: {
          patientId,
          ...(search ? {
            OR: [
              { chiefComplaint: { contains: search, mode: 'insensitive' } },
              { diagnosis: { contains: search, mode: 'insensitive' } },
              { treatmentDone: { contains: search, mode: 'insensitive' } },
              { attendingDentist: { contains: search, mode: 'insensitive' } },
            ],
          } : {}),
        },
        orderBy: { visitDate: 'desc' },
      })
      for (const v of visits as any[]) {
        const createdByName = await resolveUserName(v.createdBy)
        timeline.push({
          id: v.id, type: 'visit', date: v.visitDate,
          title: v.appointmentType || 'Visit',
          subtitle: v.chiefComplaint || v.diagnosis || '',
          dentist: v.attendingDentist, updatedBy: createdByName,
          status: v.status, data: v,
        })
      }
    }

    // === PROCEDURES ===
    if (!typeFilter || typeFilter === 'procedure') {
      const procs = await prisma.procedureRecord.findMany({
        where: {
          patientId,
          ...(search ? {
            OR: [
              { procedureType: { contains: search, mode: 'insensitive' } },
              { dentistName: { contains: search, mode: 'insensitive' } },
            ],
          } : {}),
        },
        orderBy: { procedureDate: 'desc' },
      })
      procs.forEach((p: any) => timeline.push({
        id: p.id, type: 'procedure', date: p.procedureDate,
        title: p.procedureType,
        subtitle: p.teethInvolved?.length ? `Teeth: ${p.teethInvolved.join(', ')}` : '',
        dentist: p.dentistName, status: p.status, data: p,
      }))
    }

    // === NOTES ===
    if (!typeFilter || typeFilter === 'note') {
      const notes = await prisma.clinicalNote.findMany({
        where: {
          patientId,
          ...(search ? { content: { contains: search, mode: 'insensitive' } } : {}),
        },
        orderBy: { createdAt: 'desc' },
      })
      notes.forEach((n: any) => timeline.push({
        id: n.id, type: 'note', date: n.createdAt,
        title: `${n.noteType} Note`,
        subtitle: n.content?.substring(0, 120) || '',
        dentist: n.authorName, updatedBy: n.authorName,
        status: n.isInternal ? 'internal' : 'standard', data: n,
      }))
    }

    // === CHARTS ===
    if (!typeFilter || typeFilter === 'chart') {
      const charts = await prisma.dentalChartVersion.findMany({
        where: { patientId },
        orderBy: { createdAt: 'desc' },
      })
      charts.forEach((c: any) => timeline.push({
        id: c.id, type: 'chart', date: c.createdAt,
        title: `Dental Chart v${c.version}`,
        subtitle: c.notes || '', dentist: c.updatedByName,
        updatedBy: c.updatedByName, status: 'completed', data: c,
      }))
    }

    // === TREATMENT PLANS ===
    if (!typeFilter || typeFilter === 'plan') {
      const plans = await prisma.treatmentPlan.findMany({
        where: {
          patientId,
          ...(search ? {
            OR: [
              { title: { contains: search, mode: 'insensitive' } },
              { description: { contains: search, mode: 'insensitive' } },
            ],
          } : {}),
        },
        orderBy: { createdAt: 'desc' },
        include: { dentist: { include: { user: { select: { firstName: true, lastName: true } } } } },
      })
      plans.forEach((p: any) => {
        const dn = p.dentist?.user ? `Dr. ${p.dentist.user.lastName}, ${p.dentist.user.firstName}` : null
        timeline.push({ id: `${p.id}-created`, type: 'plan', date: p.createdAt, title: `Treatment Plan: ${p.title}`, subtitle: p.description || '', dentist: dn, status: p.status, data: p })
        if (p.approvalDate) timeline.push({ id: `${p.id}-approved`, type: 'plan', date: p.approvalDate, title: `Plan Approved: ${p.title}`, subtitle: 'Patient approved', dentist: dn, status: 'approved', data: p })
        if (p.consentDate) timeline.push({ id: `${p.id}-consent`, type: 'plan', date: p.consentDate, title: `Plan Consent Signed: ${p.title}`, subtitle: 'Consent signed', dentist: dn, status: 'consent_signed', data: p })
        if (p.actualStartDate) timeline.push({ id: `${p.id}-activated`, type: 'plan', date: p.actualStartDate, title: `Plan Activated: ${p.title}`, subtitle: 'Treatment started', dentist: dn, status: 'active', data: p })
        if (p.actualEndDate) timeline.push({ id: `${p.id}-completed`, type: 'plan', date: p.actualEndDate, title: `Plan Completed: ${p.title}`, subtitle: `${p.completionPercentage || 100}%`, dentist: dn, status: 'completed', data: p })
      })
    }

    // === UPLOADS / DOCUMENTS ===
    if (!typeFilter || typeFilter === 'upload') {
      const uploads = await prisma.smartUpload.findMany({
        where: { patientId },
        orderBy: { createdAt: 'desc' },
      })
      for (const u of uploads as any[]) {
        const uploaderName = await resolveUserName(u.uploadedBy)
        timeline.push({
          id: u.id, type: 'upload', date: u.createdAt,
          title: u.originalName,
          subtitle: u.classification || (u.extractionStatus === 'completed' ? 'Extracted' : u.extractionStatus),
          dentist: null, updatedBy: uploaderName,
          status: u.extractionStatus,
          data: { ...u, uploadedByName: uploaderName },
        })
      }
    }

    // === CONSENT FORMS / FORMS ===
    if (!typeFilter || typeFilter === 'form') {
      const forms = await prisma.consentForm.findMany({
        where: {
          patientId,
          ...(search ? { title: { contains: search, mode: 'insensitive' } } : {}),
        },
        orderBy: { createdAt: 'desc' },
        include: {
          preparedBy: { select: { firstName: true, lastName: true } },
        },
      })
      for (const f of forms as any[]) {
        const preparer = f.preparedBy ? `${f.preparedBy.lastName || ''}, ${f.preparedBy.firstName || ''}`.replace(/^, |, $/g, '') : null
        // Form created event
        timeline.push({
          id: `${f.id}-created`, type: 'form', date: f.createdAt,
          title: f.title,
          subtitle: `${f.status} — ${f.assignmentSource || 'manual'}`,
          dentist: null, updatedBy: preparer,
          status: f.status,
          data: { id: f.id, title: f.title, status: f.status, consentNumber: f.consentNumber, templateKey: f.templateKey, assignmentSource: f.assignmentSource, hasSignature: !!f.patientSignature, hasGuardianSignature: !!f.guardianSignature, guardianName: f.guardianName },
        })
        // Signed event
        if (f.patientSignedAt) {
          timeline.push({
            id: `${f.id}-signed`, type: 'form', date: f.patientSignedAt,
            title: `Signed: ${f.title}`,
            subtitle: f.guardianName ? `Guardian: ${f.guardianName} (${f.guardianRelation || ''})` : 'Patient signed',
            dentist: null, updatedBy: null,
            status: 'signed',
            data: { id: f.id, title: f.title, status: 'signed', consentNumber: f.consentNumber, hasSignature: true, hasGuardianSignature: !!f.guardianSignature },
          })
        }
      }
    }

    // === AUDIT LOG EVENTS (profile updates, medical history changes) ===
    if (!typeFilter || typeFilter === 'audit') {
      const auditLogs = await prisma.auditLog.findMany({
        where: {
          entityType: 'Patient',
          entityId: patientId,
          action: { in: ['update', 'create'] },
          ...(search ? { description: { contains: search, mode: 'insensitive' } } : {}),
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
        include: {
          user: { select: { firstName: true, lastName: true } },
        },
      })
      auditLogs.forEach((a: any) => {
        const userName = a.user ? `${a.user.lastName || ''}, ${a.user.firstName || ''}`.replace(/^, |, $/g, '') : 'System'
        timeline.push({
          id: `audit-${a.id}`, type: 'audit', date: a.createdAt,
          title: a.description || `Patient ${a.action}`,
          subtitle: a.category || '',
          dentist: null, updatedBy: userName,
          status: a.action,
          data: { category: a.category, description: a.description, oldValues: a.oldValues, newValues: a.newValues },
        })
      })
    }

    // Sort all by date desc
    timeline.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

    const total = timeline.length
    const paginated = timeline.slice((page - 1) * limit, page * limit)

    return NextResponse.json({
      success: true,
      data: paginated,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    })
  } catch (error) {
    console.error('Timeline error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

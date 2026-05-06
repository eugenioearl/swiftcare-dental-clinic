import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getServerAuth } from '@/lib/auth'

// GET /api/patients/[id]/forms-history?from=YYYY-MM-DD&to=YYYY-MM-DD
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerAuth()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!['admin', 'super_admin', 'staff', 'receptionist', 'manager', 'dentist'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const from = searchParams.get('from')
    const to = searchParams.get('to')

    const where: any = { patientId: params.id }
    if (from || to) {
      where.OR = [
        { patientSignedAt: { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(`${to}T23:59:59`) } : {}) } },
        { createdAt: { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(`${to}T23:59:59`) } : {}) } },
      ]
    }

    const forms = await prisma.consentForm.findMany({
      where,
      orderBy: [{ patientSignedAt: 'desc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        title: true,
        description: true,
        consentNumber: true,
        status: true,
        patientSignedAt: true,
        formFields: true,
        formResponses: true,
        patientSignature: true,
        guardianName: true,
        guardianRelation: true,
        guardianSignature: true,
        guardianSignedAt: true,
        templateKey: true,
        templateVersion: true,
        requirementStage: true,
        assignmentSource: true,
        createdAt: true,
      },
    })

    return NextResponse.json({ forms, total: forms.length })
  } catch (error: any) {
    console.error('Error fetching forms history:', error)
    return NextResponse.json({ error: error.message || 'Failed' }, { status: 500 })
  }
}

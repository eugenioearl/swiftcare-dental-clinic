import { NextRequest, NextResponse } from 'next/server'
import { prisma, createConsentFormSafe } from '@/lib/db'
import { getServerAuth } from '@/lib/auth'
import crypto from 'crypto'

// POST /api/patients/[id]/send-form  body: { templateKey }
// Creates a standalone ConsentForm (no appointmentId) tied to the patient
// for data completion or ad-hoc forms. Returns signing link.
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerAuth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (!['admin', 'super_admin', 'staff', 'receptionist', 'manager', 'dentist'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { templateKey } = body
    if (!templateKey) {
      return NextResponse.json({ error: 'templateKey required' }, { status: 400 })
    }

    const patient = await prisma.patient.findUnique({
      where: { id: params.id },
      select: { id: true, fullName: true, isActive: true },
    })
    if (!patient) return NextResponse.json({ error: 'Patient not found' }, { status: 404 })
    if (!patient.isActive) return NextResponse.json({ error: 'Patient is inactive' }, { status: 400 })

    const template = await prisma.formTemplate.findUnique({ where: { key: templateKey } })
    if (!template) return NextResponse.json({ error: 'Template not found' }, { status: 404 })
    if (!template.isActive) return NextResponse.json({ error: 'Template is inactive' }, { status: 400 })

    const token = crypto.randomBytes(12).toString('hex')

    const form = await createConsentFormSafe({
      patientId: patient.id,
      title: template.title,
      description: template.description,
      status: 'sent',
      formFields: template.fields as any,
      formContent: `Form sent to ${patient.fullName || 'patient'}`,
      preparedById: session.user.id,
      signingToken: token,
      tokenExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      sentAt: new Date(),
      templateKey: (template as any).familyKey || template.key,
      templateVersion: (template as any).version || 1,
      assignmentSource: 'manual',
      requirementStage: body.requirementStage || (template.category === 'data_completion' ? 'check_in' : null),
    })

    const baseUrl = (process.env.NEXTAUTH_URL || request.headers.get('origin') || '').replace(/\/+$/, '')
    const signingUrl = `${baseUrl}/forms/sign/${token}`

    return NextResponse.json({ success: true, form: { id: form.id, title: form.title }, signingUrl, token })
  } catch (error: any) {
    console.error('Error creating patient form:', error)
    return NextResponse.json({ error: error.message || 'Failed to send form' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

// GET - Public endpoint to view consent form (no auth needed, uses token)
export async function GET(request: NextRequest, { params }: { params: { token: string } }) {
  try {
    const consent = await prisma.consentForm.findUnique({
      where: { signingToken: params.token },
      include: {
        patient: { select: { fullName: true, patientNumber: true } },
        package: { select: { title: true, packageNumber: true } },
        preparedBy: { select: { firstName: true, lastName: true } }
      }
    })

    if (!consent) {
      return NextResponse.json({ error: 'Invalid or expired consent link' }, { status: 404 })
    }

    // Check expiry
    if (consent.tokenExpiresAt && new Date() > consent.tokenExpiresAt) {
      return NextResponse.json({ error: 'This consent link has expired' }, { status: 410 })
    }

    if (consent.status === 'signed') {
      return NextResponse.json({ error: 'This consent has already been signed', consent: { status: 'signed', patientSignedAt: consent.patientSignedAt } }, { status: 400 })
    }

    // Mark as viewed
    if (!consent.viewedAt) {
      await prisma.consentForm.update({
        where: { id: consent.id },
        data: { viewedAt: new Date(), status: consent.status === 'sent' ? 'viewed' : consent.status }
      })
    }

    // When a templateKey exists, fetch the original template fields so we use
    // the correct field types (the stored formFields may have been modified).
    let authorativeFields = consent.formFields as any[] | null
    if (consent.templateKey) {
      const template = await prisma.formTemplate.findFirst({
        where: { key: consent.templateKey },
        orderBy: { version: 'desc' },
        select: { fields: true }
      })
      if (template?.fields && Array.isArray(template.fields) && (template.fields as any[]).length > 0) {
        authorativeFields = template.fields as any[]
      }
    }

    return NextResponse.json({
      consent: {
        id: consent.id,
        consentNumber: consent.consentNumber,
        title: consent.title,
        formContent: consent.formContent,
        formFields: authorativeFields,
        formResponses: consent.formResponses,
        treatmentSummary: consent.treatmentSummary,
        financialSummary: consent.financialSummary,
        patientName: consent.patient.fullName,
        packageTitle: consent.package?.title,
        preparedBy: consent.preparedBy ? `${consent.preparedBy.lastName}, ${consent.preparedBy.firstName}` : null,
        status: consent.status,
        round: consent.round,
        hasPatientSignature: !!consent.patientSignature,
        hasWitnessSignature: !!consent.witnessSignature
      }
    })
  } catch (error) {
    console.error('Error fetching consent by token:', error)
    return NextResponse.json({ error: 'Failed to fetch consent' }, { status: 500 })
  }
}

// POST - Sign consent form (public, uses token)
export async function POST(request: NextRequest, { params }: { params: { token: string } }) {
  try {
    const consent = await prisma.consentForm.findUnique({
      where: { signingToken: params.token }
    })

    if (!consent) {
      return NextResponse.json({ error: 'Invalid consent link' }, { status: 404 })
    }

    if (consent.tokenExpiresAt && new Date() > consent.tokenExpiresAt) {
      return NextResponse.json({ error: 'Consent link expired' }, { status: 410 })
    }

    if (consent.patientSignature) {
      return NextResponse.json({ error: 'Already signed' }, { status: 400 })
    }

    const body = await request.json()
    const { signature, responses } = body

    if (!signature) {
      return NextResponse.json({ error: 'Signature is required' }, { status: 400 })
    }

    const data: any = {
      patientSignature: signature,
      patientSignedAt: new Date()
    }

    // Save form field responses if provided
    if (responses && typeof responses === 'object') {
      data.formResponses = responses
    }

    // If witness already signed, mark as fully signed
    if (consent.witnessSignature) {
      data.status = 'signed'
    }

    await prisma.consentForm.update({
      where: { id: consent.id },
      data
    })

    return NextResponse.json({ success: true, message: 'Consent signed successfully' })
  } catch (error) {
    console.error('Error signing consent:', error)
    return NextResponse.json({ error: 'Failed to sign consent' }, { status: 500 })
  }
}

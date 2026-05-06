import { NextRequest, NextResponse } from 'next/server'
import { getServerAuth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { sendFormSigningLinkEmail } from '@/lib/email-notifications'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string; consentId: string } }
) {
  try {
    const session = await getServerAuth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let body: any = {}
    try {
      body = await request.json()
    } catch {
      body = {}
    }
    const overrideEmail: string | undefined =
      typeof body?.email === 'string' && body.email.trim() ? body.email.trim() : undefined
    const senderNote: string | undefined =
      typeof body?.note === 'string' && body.note.trim() ? body.note.trim() : undefined

    const consent = await prisma.consentForm.findUnique({
      where: { id: params.consentId },
      include: {
        patient: {
          select: {
            id: true,
            fullName: true,
            emailDirect: true,
            user: { select: { email: true, firstName: true, lastName: true } },
          },
        },
        appointment: {
          select: {
            scheduledDatetime: true,
            appointmentType: true,
          },
        },
      },
    })

    if (!consent || consent.patientId !== params.id) {
      return NextResponse.json({ error: 'Consent form not found' }, { status: 404 })
    }

    if (!consent.signingToken) {
      return NextResponse.json({ error: 'This form has no signing link' }, { status: 400 })
    }

    const patientEmail =
      overrideEmail ||
      consent.patient?.emailDirect ||
      consent.patient?.user?.email ||
      ''

    if (!patientEmail) {
      return NextResponse.json(
        { error: 'No email address on file for this patient. Please update their contact info first or enter an email address.' },
        { status: 400 }
      )
    }

    const patientName =
      consent.patient?.fullName ||
      [consent.patient?.user?.firstName, consent.patient?.user?.lastName]
        .filter(Boolean)
        .join(' ')
        .trim() ||
      'Valued Patient'

    // Choose URL: per-appointment forms use /forms/sign/{token}, standalone consents use /consent/{token}
    const baseUrl = process.env.NEXTAUTH_URL || 'https://swiftcaredental.site'
    const path = consent.appointmentId ? `/forms/sign/${consent.signingToken}` : `/consent/${consent.signingToken}`
    const signingUrl = `${baseUrl}${path}`

    // Compute hours remaining until token expires
    let expiresInHours: number | null = null
    if (consent.tokenExpiresAt) {
      const now = Date.now()
      const exp = new Date(consent.tokenExpiresAt).getTime()
      if (exp > now) expiresInHours = Math.max(1, Math.round((exp - now) / (1000 * 60 * 60)))
    }

    const result = await sendFormSigningLinkEmail({
      patientEmail,
      patientName,
      signingUrl,
      formType: consent.title || 'Patient Forms',
      appointmentDate: consent.appointment?.scheduledDatetime || null,
      appointmentType: consent.appointment?.appointmentType || null,
      senderNote: senderNote || null,
      expiresInHours,
    })

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to send email' },
        { status: 500 }
      )
    }

    // Update consent status to 'sent' if still draft
    if (consent.status === 'draft' || !consent.sentAt) {
      await prisma.consentForm.update({
        where: { id: consent.id },
        data: { status: consent.status === 'draft' ? 'sent' : consent.status, sentAt: new Date() },
      })
    }

    return NextResponse.json({
      success: true,
      message: `Email sent to ${patientEmail}`,
      recipient: patientEmail,
    })
  } catch (error) {
    console.error('Error sending form signing link email:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to send email' },
      { status: 500 }
    )
  }
}

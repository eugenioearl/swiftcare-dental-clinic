import { NextRequest, NextResponse } from 'next/server'
import { getServerAuth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { sendFormSigningLinkEmail } from '@/lib/email-notifications'

/**
 * POST /api/checkin-forms/send-email
 * Body: { appointmentId: string, email?: string, note?: string }
 *
 * Emails the patient a link to sign all required consent forms for the
 * given appointment. Uses the first unsigned form's signing token (single
 * unified signing page handles all forms for the appointment).
 */
export async function POST(request: NextRequest) {
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

    const appointmentId: string | undefined =
      typeof body?.appointmentId === 'string' ? body.appointmentId : undefined
    if (!appointmentId) {
      return NextResponse.json({ error: 'appointmentId is required' }, { status: 400 })
    }

    const overrideEmail: string | undefined =
      typeof body?.email === 'string' && body.email.trim() ? body.email.trim() : undefined
    const senderNote: string | undefined =
      typeof body?.note === 'string' && body.note.trim() ? body.note.trim() : undefined

    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      select: {
        id: true,
        scheduledDatetime: true,
        appointmentType: true,
        patient: {
          select: {
            fullName: true,
            emailDirect: true,
            user: { select: { email: true, firstName: true, lastName: true } },
          },
        },
      },
    })

    if (!appointment) {
      return NextResponse.json({ error: 'Appointment not found' }, { status: 404 })
    }

    const forms = await prisma.consentForm.findMany({
      where: { appointmentId },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        title: true,
        signingToken: true,
        patientSignature: true,
        tokenExpiresAt: true,
        status: true,
        sentAt: true,
      },
    })

    if (forms.length === 0) {
      return NextResponse.json(
        { error: 'No forms prepared yet. Prepare required forms first.' },
        { status: 400 }
      )
    }

    const firstUnsignedForm = forms.find((f) => !f.patientSignature)
    const targetForm = firstUnsignedForm || forms[0]

    if (!targetForm.signingToken) {
      return NextResponse.json({ error: 'No signing token available' }, { status: 400 })
    }

    const patientEmail =
      overrideEmail ||
      appointment.patient?.emailDirect ||
      appointment.patient?.user?.email ||
      ''

    if (!patientEmail) {
      return NextResponse.json(
        {
          error:
            'No email address on file for this patient. Please update their contact info first or provide an email address.',
        },
        { status: 400 }
      )
    }

    const patientName =
      appointment.patient?.fullName ||
      [appointment.patient?.user?.lastName, appointment.patient?.user?.firstName]
        .filter(Boolean)
        .join(' ')
        .trim() ||
      'Valued Patient'

    const baseUrl = (process.env.NEXTAUTH_URL || request.headers.get('origin') || 'https://swiftcaredental.site').replace(/\/+$/, '')
    const signingUrl = `${baseUrl}/forms/sign/${targetForm.signingToken}`

    // Compute hours remaining until token expires
    let expiresInHours: number | null = null
    if (targetForm.tokenExpiresAt) {
      const now = Date.now()
      const exp = new Date(targetForm.tokenExpiresAt).getTime()
      if (exp > now) expiresInHours = Math.max(1, Math.round((exp - now) / (1000 * 60 * 60)))
    }

    const unsignedCount = forms.filter((f) => !f.patientSignature).length
    const totalCount = forms.length
    const friendlyFormType =
      unsignedCount === totalCount
        ? `${totalCount} Consent Form${totalCount !== 1 ? 's' : ''}`
        : `${unsignedCount} Remaining Form${unsignedCount !== 1 ? 's' : ''} (of ${totalCount})`

    const result = await sendFormSigningLinkEmail({
      patientEmail,
      patientName,
      signingUrl,
      formType: friendlyFormType,
      appointmentDate: appointment.scheduledDatetime,
      appointmentType: appointment.appointmentType,
      senderNote: senderNote || null,
      expiresInHours,
    })

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to send email' },
        { status: 500 }
      )
    }

    // Mark all unsigned forms as sent
    const unsignedIds = forms.filter((f) => !f.patientSignature).map((f) => f.id)
    if (unsignedIds.length > 0) {
      await prisma.consentForm.updateMany({
        where: { id: { in: unsignedIds }, status: 'draft' },
        data: { status: 'sent', sentAt: new Date() },
      })
      await prisma.consentForm.updateMany({
        where: { id: { in: unsignedIds }, sentAt: null },
        data: { sentAt: new Date() },
      })
    }

    return NextResponse.json({
      success: true,
      message: `Signing link sent to ${patientEmail}`,
      recipient: patientEmail,
    })
  } catch (error) {
    console.error('Error sending appointment signing link email:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to send email' },
      { status: 500 }
    )
  }
}

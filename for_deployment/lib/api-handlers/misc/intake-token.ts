import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

// GET - Fetch intake form by token (PUBLIC - no auth)
export async function GET(request: NextRequest, { params }: { params: { token: string } }) {
  try {
    const submission = await prisma.intakeSubmission.findUnique({
      where: { token: params.token },
      include: {
        patient: { select: { fullName: true, mobileNumber: true, emailDirect: true } }
      }
    })

    if (!submission) {
      return NextResponse.json({ error: 'Invalid or expired link' }, { status: 404 })
    }
    if (new Date() > submission.tokenExpiresAt) {
      return NextResponse.json({ error: 'This intake link has expired' }, { status: 410 })
    }
    if (submission.status === 'submitted' || submission.status === 'reviewed') {
      return NextResponse.json({ error: 'This form has already been submitted', submitted: true }, { status: 409 })
    }

    return NextResponse.json({
      submission: {
        id: submission.id,
        appointmentType: submission.appointmentType,
        status: submission.status,
        prefill: submission.patient ? {
          fullName: submission.patient.fullName,
          mobileNumber: submission.patient.mobileNumber,
          emailAddress: submission.patient.emailDirect
        } : null
      }
    })
  } catch (error) {
    console.error('Error fetching intake:', error)
    return NextResponse.json({ error: 'Failed to load form' }, { status: 500 })
  }
}

// POST - Submit intake form (PUBLIC - no auth)
export async function POST(request: NextRequest, { params }: { params: { token: string } }) {
  try {
    const submission = await prisma.intakeSubmission.findUnique({ where: { token: params.token } })
    if (!submission) return NextResponse.json({ error: 'Invalid link' }, { status: 404 })
    if (new Date() > submission.tokenExpiresAt) return NextResponse.json({ error: 'Link expired' }, { status: 410 })
    if (submission.status === 'submitted') return NextResponse.json({ error: 'Already submitted' }, { status: 409 })

    const body = await request.json()

    // Patient matching
    let matchedPatientId: string | null = null
    let matchConfidence = 'none'
    const cleanMobile = (body.mobileNumber || '').replace(/[^0-9+]/g, '')
    const cleanEmail = (body.emailAddress || '').trim().toLowerCase()

    if (cleanMobile && cleanMobile.length >= 10) {
      const match = await prisma.patient.findFirst({ where: { mobileNumber: cleanMobile } })
      if (match) { matchedPatientId = match.id; matchConfidence = 'high' }
    }
    if (!matchedPatientId && cleanEmail) {
      const match = await prisma.patient.findFirst({ where: { emailDirect: cleanEmail } })
      if (match) { matchedPatientId = match.id; matchConfidence = 'high' }
    }
    if (!matchedPatientId && body.fullName) {
      const match = await prisma.patient.findFirst({
        where: { fullName: { contains: body.fullName.trim(), mode: 'insensitive' } }
      })
      if (match) { matchedPatientId = match.id; matchConfidence = 'low' }
    }

    const updated = await prisma.intakeSubmission.update({
      where: { id: submission.id },
      data: {
        fullName: body.fullName?.trim() || null,
        mobileNumber: cleanMobile || null,
        emailAddress: cleanEmail || null,
        dateOfBirth: body.dateOfBirth ? new Date(body.dateOfBirth) : null,
        gender: body.gender || null,
        address: body.address?.trim() || null,
        medicalHistory: body.medicalHistory?.trim() || null,
        allergies: body.allergies?.trim() || null,
        currentMedications: body.currentMedications?.trim() || null,
        bloodPressure: body.bloodPressure?.trim() || null,
        pregnancyStatus: body.pregnancyStatus || null,
        chiefComplaint: body.chiefComplaint?.trim() || null,
        dentalAnxieties: body.dentalAnxieties?.trim() || null,
        lastDentalVisit: body.lastDentalVisit?.trim() || null,
        previousDentist: body.previousDentist?.trim() || null,
        emergencyName: body.emergencyName?.trim() || null,
        emergencyPhone: body.emergencyPhone?.trim() || null,
        emergencyRelation: body.emergencyRelation?.trim() || null,
        matchedPatientId: matchedPatientId,
        matchConfidence: matchConfidence,
        status: 'submitted',
        submittedAt: new Date()
      }
    })

    return NextResponse.json({ success: true, matched: !!matchedPatientId, confidence: matchConfidence })
  } catch (error) {
    console.error('Error submitting intake:', error)
    return NextResponse.json({ error: 'Failed to submit' }, { status: 500 })
  }
}

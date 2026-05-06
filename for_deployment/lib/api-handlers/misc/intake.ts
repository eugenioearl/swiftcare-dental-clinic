import { NextRequest, NextResponse } from 'next/server'
import { getServerAuth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import crypto from 'crypto'

// GET - List intake submissions (admin/staff)
export async function GET(request: NextRequest) {
  try {
    const session = await getServerAuth()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const patientId = searchParams.get('patientId')

    const where: any = {}
    if (status) where.status = status
    if (patientId) where.patientId = patientId

    const submissions = await prisma.intakeSubmission.findMany({
      where,
      include: {
        patient: { select: { id: true, fullName: true, patientNumber: true } },
        appointment: { select: { id: true, appointmentNumber: true, appointmentType: true } },
        reviewedBy: { select: { id: true, firstName: true, lastName: true } }
      },
      orderBy: { createdAt: 'desc' },
      take: 50
    })

    return NextResponse.json({ submissions })
  } catch (error) {
    console.error('Error fetching intake submissions:', error)
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 })
  }
}

// POST - Generate intake link for a patient/appointment
export async function POST(request: NextRequest) {
  try {
    const session = await getServerAuth()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const { patientId, appointmentId, appointmentType } = body

    const token = crypto.randomBytes(32).toString('hex')

    const submission = await prisma.intakeSubmission.create({
      data: {
        token,
        tokenExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        patientId: patientId || null,
        appointmentId: appointmentId || null,
        appointmentType: appointmentType || null,
        status: 'pending'
      }
    })

    return NextResponse.json({ submission, token }, { status: 201 })
  } catch (error) {
    console.error('Error creating intake:', error)
    return NextResponse.json({ error: 'Failed to create' }, { status: 500 })
  }
}

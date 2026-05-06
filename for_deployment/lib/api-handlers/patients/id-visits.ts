import { NextRequest, NextResponse } from 'next/server'
import { getServerAuth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { z } from 'zod'

const visitSchema = z.object({
  visitDate: z.string(),
  appointmentType: z.string().optional(),
  attendingDentist: z.string().optional(),
  dentistId: z.string().optional(),
  appointmentId: z.string().optional(),
  status: z.string().optional(),
  chiefComplaint: z.string().optional(),
  findings: z.string().optional(),
  diagnosis: z.string().optional(),
  treatmentDone: z.string().optional(),
  prescriptions: z.string().optional(),
  followUpInstructions: z.string().optional(),
  followUpDate: z.string().optional().nullable(),
  beforePhotos: z.array(z.string()).optional(),
  afterPhotos: z.array(z.string()).optional(),
  attachments: z.array(z.string()).optional(),
})

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerAuth()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const visits = await prisma.visitRecord.findMany({
      where: { patientId: params.id },
      include: { clinicalNotes: true },
      orderBy: { visitDate: 'desc' },
    })

    return NextResponse.json({ success: true, data: visits })
  } catch (error) {
    console.error('Get visits error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerAuth()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const data = visitSchema.parse(body)

    const visit = await prisma.visitRecord.create({
      data: {
        patientId: params.id,
        visitDate: new Date(data.visitDate),
        appointmentType: data.appointmentType,
        attendingDentist: data.attendingDentist,
        dentistId: data.dentistId,
        appointmentId: data.appointmentId,
        status: data.status || 'completed',
        chiefComplaint: data.chiefComplaint,
        findings: data.findings,
        diagnosis: data.diagnosis,
        treatmentDone: data.treatmentDone,
        prescriptions: data.prescriptions,
        followUpInstructions: data.followUpInstructions,
        followUpDate: data.followUpDate ? new Date(data.followUpDate) : null,
        beforePhotos: data.beforePhotos || [],
        afterPhotos: data.afterPhotos || [],
        attachments: data.attachments || [],
        createdBy: session.user.id,
      },
    })

    return NextResponse.json({ success: true, data: visit }, { status: 201 })
  } catch (error: any) {
    if (error?.name === 'ZodError') {
      return NextResponse.json({ error: 'Validation error', details: error.errors }, { status: 400 })
    }
    console.error('Create visit error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

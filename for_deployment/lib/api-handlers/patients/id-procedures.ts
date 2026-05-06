import { NextRequest, NextResponse } from 'next/server'
import { getServerAuth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { z } from 'zod'

const procedureSchema = z.object({
  procedureType: z.string().min(1),
  procedureDate: z.string(),
  dentistName: z.string().optional(),
  dentistId: z.string().optional(),
  visitRecordId: z.string().optional(),
  teethInvolved: z.array(z.string()).optional(),
  notesBefore: z.string().optional(),
  notesAfter: z.string().optional(),
  complications: z.string().optional(),
  attachments: z.array(z.string()).optional(),
  followUpRecs: z.string().optional(),
  status: z.string().optional(),
})

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerAuth()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const procedures = await prisma.procedureRecord.findMany({
      where: { patientId: params.id },
      orderBy: { procedureDate: 'desc' },
    })

    return NextResponse.json({ success: true, data: procedures })
  } catch (error) {
    console.error('Get procedures error:', error)
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
    const data = procedureSchema.parse(body)

    const proc = await prisma.procedureRecord.create({
      data: {
        patientId: params.id,
        procedureType: data.procedureType,
        procedureDate: new Date(data.procedureDate),
        dentistName: data.dentistName,
        dentistId: data.dentistId,
        visitRecordId: data.visitRecordId,
        teethInvolved: data.teethInvolved || [],
        notesBefore: data.notesBefore,
        notesAfter: data.notesAfter,
        complications: data.complications,
        attachments: data.attachments || [],
        followUpRecs: data.followUpRecs,
        status: data.status || 'completed',
        createdBy: session.user.id,
      },
    })

    return NextResponse.json({ success: true, data: proc }, { status: 201 })
  } catch (error: any) {
    if (error?.name === 'ZodError') {
      return NextResponse.json({ error: 'Validation error', details: error.errors }, { status: 400 })
    }
    console.error('Create procedure error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

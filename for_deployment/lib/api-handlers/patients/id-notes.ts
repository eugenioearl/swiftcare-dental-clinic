import { NextRequest, NextResponse } from 'next/server'
import { getServerAuth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { z } from 'zod'

const noteSchema = z.object({
  noteType: z.string().min(1),
  content: z.string().min(1),
  visitRecordId: z.string().optional(),
  isInternal: z.boolean().optional(),
  previousVersion: z.string().optional(),
})

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerAuth()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const url = new URL(request.url)
    const noteType = url.searchParams.get('noteType')
    const visitId = url.searchParams.get('visitId')

    const notes = await prisma.clinicalNote.findMany({
      where: {
        patientId: params.id,
        ...(noteType ? { noteType } : {}),
        ...(visitId ? { visitRecordId: visitId } : {}),
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ success: true, data: notes })
  } catch (error) {
    console.error('Get notes error:', error)
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
    const data = noteSchema.parse(body)

    // If editing (previousVersion), create a new version
    const note = await prisma.clinicalNote.create({
      data: {
        patientId: params.id,
        noteType: data.noteType,
        content: data.content,
        authorName: session.user.name || session.user.email || 'Staff',
        authorId: session.user.id,
        visitRecordId: data.visitRecordId,
        isInternal: data.isInternal || false,
        previousVersion: data.previousVersion,
      },
    })

    return NextResponse.json({ success: true, data: note }, { status: 201 })
  } catch (error: any) {
    if (error?.name === 'ZodError') {
      return NextResponse.json({ error: 'Validation error', details: error.errors }, { status: 400 })
    }
    console.error('Create note error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

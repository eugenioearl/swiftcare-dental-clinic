import { NextRequest, NextResponse } from 'next/server'
import { getServerAuth } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string; visitId: string } }
) {
  try {
    const session = await getServerAuth()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const visit = await prisma.visitRecord.findFirst({
      where: { id: params.visitId, patientId: params.id },
      include: { clinicalNotes: { orderBy: { createdAt: 'desc' } } },
    })
    if (!visit) return NextResponse.json({ error: 'Visit not found' }, { status: 404 })

    return NextResponse.json({ success: true, data: visit })
  } catch (error) {
    console.error('Get visit error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string; visitId: string } }
) {
  try {
    const session = await getServerAuth()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const { visitDate, followUpDate, ...rest } = body

    const updateData: any = { ...rest }
    if (visitDate) updateData.visitDate = new Date(visitDate)
    if (followUpDate !== undefined) updateData.followUpDate = followUpDate ? new Date(followUpDate) : null

    const visit = await prisma.visitRecord.update({
      where: { id: params.visitId },
      data: updateData,
    })

    return NextResponse.json({ success: true, data: visit })
  } catch (error) {
    console.error('Update visit error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; visitId: string } }
) {
  try {
    const session = await getServerAuth()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Only ADMIN can delete visit records
    if (session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Only administrators can delete visit records' }, { status: 403 })
    }

    await prisma.visitRecord.delete({ where: { id: params.visitId } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete visit error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { getServerAuth } from '@/lib/auth'
import { prisma } from '@/lib/db'

// GET /api/admin/migration - list all uploads across all patients
export async function GET(request: NextRequest) {
  try {
    const session = await getServerAuth()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const uploads = await prisma.smartUpload.findMany({
      include: {
        patient: {
          select: { id: true, fullName: true, patientNumber: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json({ success: true, data: uploads })
  } catch (error) {
    console.error('Fetch migration uploads error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

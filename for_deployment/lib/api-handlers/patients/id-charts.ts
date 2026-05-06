import { NextRequest, NextResponse } from 'next/server'
import { getServerAuth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { z } from 'zod'

const chartSchema = z.object({
  chartData: z.record(z.any()),
  notes: z.string().optional(),
  attachments: z.array(z.string()).optional(),
  chartType: z.enum(['primary', 'mixed', 'permanent']).optional(),
})

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerAuth()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const charts = await prisma.dentalChartVersion.findMany({
      where: { patientId: params.id },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ success: true, data: charts })
  } catch (error) {
    console.error('Get charts error:', error)
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
    const data = chartSchema.parse(body)

    // Get latest version number
    const latest = await prisma.dentalChartVersion.findFirst({
      where: { patientId: params.id },
      orderBy: { version: 'desc' },
      select: { version: true },
    })

    const chart = await prisma.dentalChartVersion.create({
      data: {
        patientId: params.id,
        chartData: data.chartData,
        notes: data.notes,
        version: (latest?.version || 0) + 1,
        chartType: data.chartType,
        updatedByName: session.user.name || session.user.email || 'Staff',
        updatedById: session.user.id,
        attachments: data.attachments || [],
      },
    })

    // If chartType was provided, also update the patient profile so the
    // preferred chart type is remembered across visits.
    if (data.chartType) {
      try {
        await prisma.patient.update({
          where: { id: params.id },
          data: {
            currentChartType: data.chartType,
            chartTypeSetById: session.user.id,
            chartTypeSetAt: new Date(),
          },
        })
      } catch (e) {
        console.error('Failed to update patient chart type profile:', e)
      }
    }

    return NextResponse.json({ success: true, data: chart }, { status: 201 })
  } catch (error: any) {
    if (error?.name === 'ZodError') {
      return NextResponse.json({ error: 'Validation error', details: error.errors }, { status: 400 })
    }
    console.error('Create chart error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

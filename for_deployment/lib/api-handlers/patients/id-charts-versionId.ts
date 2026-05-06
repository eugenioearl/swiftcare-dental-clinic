import { NextRequest, NextResponse } from 'next/server'
import { getServerAuth } from '@/lib/auth'
import { prisma } from '@/lib/db'

// GET a specific chart version (for preview)
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string; versionId: string } },
) {
  try {
    const session = await getServerAuth()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const version = await prisma.dentalChartVersion.findUnique({
      where: { id: params.versionId },
    })

    if (!version || version.patientId !== params.id) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true, data: version })
  } catch (error) {
    console.error('Get chart version error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST - restore this version as the new latest (append a copy at top)
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string; versionId: string } },
) {
  try {
    const session = await getServerAuth()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const target = await prisma.dentalChartVersion.findUnique({
      where: { id: params.versionId },
    })
    if (!target || target.patientId !== params.id) {
      return NextResponse.json({ error: 'Version not found' }, { status: 404 })
    }

    const latest = await prisma.dentalChartVersion.findFirst({
      where: { patientId: params.id },
      orderBy: { version: 'desc' },
      select: { version: true },
    })

    const reason = (await request.json().catch(() => ({}))).reason as string | undefined

    const restored = await prisma.dentalChartVersion.create({
      data: {
        patientId: params.id,
        version: (latest?.version || 0) + 1,
        chartData: target.chartData as any,
        chartType: target.chartType,
        notes: `Restored from v${target.version}${reason ? ` — ${reason}` : ''}`,
        updatedByName: session.user.name || session.user.email || 'Staff',
        updatedById: session.user.id,
        attachments: target.attachments || [],
      },
    })

    // Update patient's current chart type to match restored version if set
    if (target.chartType) {
      try {
        await prisma.patient.update({
          where: { id: params.id },
          data: {
            currentChartType: target.chartType,
            chartTypeSetById: session.user.id,
            chartTypeSetAt: new Date(),
          },
        })
      } catch (e) {
        console.error('Failed to update patient chart type after restore:', e)
      }
    }

    // Audit log entry (best effort)
    try {
      await prisma.auditLog.create({
        data: {
          userId: session.user.id,
          entityType: 'DentalChartVersion',
          entityId: restored.id,
          action: 'create',
          category: 'CLINICAL',
          description: `Restored dental chart from v${target.version} to v${restored.version}`,
          newValues: { patientId: params.id, fromVersion: target.version, toVersion: restored.version, reason: reason || null } as any,
        },
      })
    } catch (e) {
      // Non-fatal
    }

    return NextResponse.json({ success: true, data: restored }, { status: 201 })
  } catch (error) {
    console.error('Restore chart version error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

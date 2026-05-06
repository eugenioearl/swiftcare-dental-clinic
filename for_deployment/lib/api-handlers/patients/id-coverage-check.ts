import { NextRequest, NextResponse } from 'next/server'
import { getServerAuth } from '@/lib/auth'
import { prisma } from '@/lib/db'

// POST /api/patients/[id]/coverage-check
// Check if a procedure is covered by an active package
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerAuth()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const { treatmentId, procedureName } = body

    if (!treatmentId && !procedureName) {
      return NextResponse.json({ error: 'Treatment ID or procedure name required' }, { status: 400 })
    }

    // Find active packages for this patient
    const activePackages = await prisma.treatmentPackage.findMany({
      where: {
        patientId: params.id,
        status: { in: ['active', 'in_progress'] }
      },
      include: {
        items: {
          where: { status: { in: ['pending', 'scheduled'] } },
          include: { treatment: true }
        }
      }
    })

    const coverageResults: any[] = []

    for (const pkg of activePackages) {
      for (const item of pkg.items) {
        const matchesTreatment = treatmentId && item.treatmentId === treatmentId
        const matchesName = procedureName && item.procedureName.toLowerCase().includes(procedureName.toLowerCase())

        if (matchesTreatment || matchesName) {
          coverageResults.push({
            packageId: pkg.id,
            packageTitle: pkg.title,
            packageNumber: pkg.packageNumber,
            itemId: item.id,
            procedureName: item.procedureName,
            coverageType: item.coverageType,
            coveredAmount: Number(item.coveredAmount),
            patientCost: Number(item.patientCost),
            itemStatus: item.status
          })
        }
      }
    }

    const isCovered = coverageResults.length > 0
    const bestCoverage = coverageResults.sort((a, b) => b.coveredAmount - a.coveredAmount)[0] || null

    return NextResponse.json({
      isCovered,
      coverageType: bestCoverage?.coverageType || 'not_covered',
      bestCoverage,
      allMatches: coverageResults
    })
  } catch (error) {
    console.error('Error checking coverage:', error)
    return NextResponse.json({ error: 'Failed to check coverage' }, { status: 500 })
  }
}

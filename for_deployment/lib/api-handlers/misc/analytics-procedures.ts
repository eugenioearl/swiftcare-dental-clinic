import { NextRequest, NextResponse } from "next/server"
import { getServerAuth } from "@/lib/auth"
import { prisma } from "@/lib/db"

export async function GET(request: NextRequest) {
  try {
    const session = await getServerAuth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const timeRange = searchParams.get('timeRange') || 'month'

    // Get treatments with their appointment usage
    const treatments = await prisma.treatment.findMany({
      where: { isActive: true },
      select: { id: true, name: true, category: true, baseCost: true, estimatedDurationMinutes: true }
    })

    // Get appointment treatment counts grouped by treatmentId
    const appointmentTreatments = await prisma.appointmentTreatment.groupBy({
      by: ['treatmentId'],
      _count: { _all: true },
      _sum: { totalCost: true }
    })

    const treatmentMap = new Map(
      appointmentTreatments.map(at => [
        at.treatmentId,
        { count: at._count._all, revenue: Number(at._sum.totalCost || 0) }
      ])
    )

    // Build procedure performance from treatments + actual usage
    const procedurePerformance = treatments.map(treatment => {
      const usage = treatmentMap.get(treatment.id)
      return {
        name: treatment.name,
        count: usage?.count || 0,
        revenue: usage?.revenue || 0,
        averagePrice: Number(treatment.baseCost || 0),
        profitMargin: 0,
        duration: treatment.estimatedDurationMinutes || 30,
        popularity: 0
      }
    })

    // Sort by revenue descending
    procedurePerformance.sort((a, b) => b.revenue - a.revenue)

    const totalProcedures = procedurePerformance.reduce((sum, p) => sum + p.count, 0)
    const totalRevenue = procedurePerformance.reduce((sum, p) => sum + p.revenue, 0)

    return NextResponse.json({
      success: true,
      data: {
        timeRange,
        procedurePerformance: procedurePerformance.slice(0, 20),
        procedureTrends: {},
        monthlyTrends: [],
        efficiencyMetrics: {
          averageProcedureTime: 0,
          utilizationRate: 0,
          completionRate: 0,
          patientSatisfaction: 0,
          revisionRate: 0
        },
        summary: {
          totalProcedures,
          totalRevenue,
          averageRevenue: totalProcedures > 0 ? Math.round(totalRevenue / totalProcedures) : 0,
          topProcedure: procedurePerformance[0]?.name || 'N/A'
        },
        lastUpdated: new Date().toISOString()
      }
    })
  } catch (error) {
    console.error("Error fetching procedure analytics:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from "next/server"
import { getServerAuth } from "@/lib/auth"
import { prisma } from "@/lib/db"

function getDateRange(timeRange: string) {
  const now = new Date()
  let startDate: Date
  let previousStart: Date
  let previousEnd: Date

  switch (timeRange) {
    case 'today':
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      previousStart = new Date(startDate.getTime() - 24 * 60 * 60 * 1000)
      previousEnd = new Date(startDate)
      break
    case 'week':
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      previousStart = new Date(startDate.getTime() - 7 * 24 * 60 * 60 * 1000)
      previousEnd = new Date(startDate)
      break
    case 'quarter':
      startDate = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1)
      previousStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3 - 3, 1)
      previousEnd = new Date(startDate)
      break
    case 'year':
      startDate = new Date(now.getFullYear(), 0, 1)
      previousStart = new Date(now.getFullYear() - 1, 0, 1)
      previousEnd = new Date(startDate)
      break
    default: // month
      startDate = new Date(now.getFullYear(), now.getMonth(), 1)
      previousStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      previousEnd = new Date(startDate)
      break
  }
  return { startDate, previousStart, previousEnd, now }
}

function calcChange(current: number, previous: number) {
  if (previous === 0) return { change: current > 0 ? 100 : 0, trend: current > 0 ? 'up' as const : 'neutral' as const }
  const change = ((current - previous) / previous) * 100
  return { change: Math.round(change * 10) / 10, trend: change > 0 ? 'up' as const : change < 0 ? 'down' as const : 'neutral' as const }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerAuth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const timeRange = searchParams.get('timeRange') || 'month'
    const { startDate, previousStart, previousEnd, now } = getDateRange(timeRange)

    // Total Revenue (current period)
    const currentPayments = await prisma.patientPayment.aggregate({
      where: { createdAt: { gte: startDate, lte: now }, status: 'completed' },
      _sum: { amount: true }
    })
    const prevPayments = await prisma.patientPayment.aggregate({
      where: { createdAt: { gte: previousStart, lt: previousEnd }, status: 'completed' },
      _sum: { amount: true }
    })
    const currentRevenue = Number(currentPayments._sum.amount || 0)
    const prevRevenue = Number(prevPayments._sum.amount || 0)

    // Also check Billing-based payments
    const currentBillingPayments = await prisma.payment.aggregate({
      where: { createdAt: { gte: startDate, lte: now }, status: 'completed' },
      _sum: { amount: true }
    })
    const prevBillingPayments = await prisma.payment.aggregate({
      where: { createdAt: { gte: previousStart, lt: previousEnd }, status: 'completed' },
      _sum: { amount: true }
    })
    const totalCurrentRevenue = currentRevenue + Number(currentBillingPayments._sum.amount || 0)
    const totalPrevRevenue = prevRevenue + Number(prevBillingPayments._sum.amount || 0)

    // New Patients (only active — excludes deleted/deactivated)
    const currentNewPatients = await prisma.patient.count({
      where: { createdAt: { gte: startDate, lte: now }, isActive: true }
    })
    const prevNewPatients = await prisma.patient.count({
      where: { createdAt: { gte: previousStart, lt: previousEnd }, isActive: true }
    })

    // Total Appointments (exclude cancelled — they shouldn't count as real appointments)
    const cancelledStatus = 'cancelled' as const
    const currentAppointments = await prisma.appointment.count({
      where: { scheduledDatetime: { gte: startDate, lte: now }, status: { not: cancelledStatus } }
    })
    const prevAppointments = await prisma.appointment.count({
      where: { scheduledDatetime: { gte: previousStart, lt: previousEnd }, status: { not: cancelledStatus } }
    })

    // Average Revenue per Patient (active patients only)
    const totalPatients = await prisma.patient.count({ where: { isActive: true } })
    const avgRevenue = currentNewPatients > 0 ? Math.round(totalCurrentRevenue / currentNewPatients) : (totalPatients > 0 ? Math.round(totalCurrentRevenue / totalPatients) : 0)
    const prevAvgRevenue = prevNewPatients > 0 ? Math.round(totalPrevRevenue / prevNewPatients) : 0

    // Patient Retention (active patients with > 1 non-cancelled appointment)
    const totalActivePatients = await prisma.patient.count({ where: { isActive: true } })
    const returningPatients = await prisma.appointment.groupBy({
      by: ['patientId'],
      where: { status: { not: cancelledStatus }, patient: { isActive: true } },
      having: { patientId: { _count: { gt: 1 } } }
    })
    const retentionRate = totalActivePatients > 0
      ? Math.round((returningPatients.length / totalActivePatients) * 100 * 10) / 10
      : 0

    // No-show rate (of non-cancelled appointments)
    const noShows = await prisma.appointment.count({
      where: { scheduledDatetime: { gte: startDate, lte: now }, status: 'no_show' }
    })
    const noShowRate = currentAppointments > 0
      ? Math.round((noShows / currentAppointments) * 100 * 10) / 10
      : 0

    const revenueMetrics = calcChange(totalCurrentRevenue, totalPrevRevenue)
    const patientMetrics = calcChange(currentNewPatients, prevNewPatients)
    const appointmentMetrics = calcChange(currentAppointments, prevAppointments)
    const avgRevenueMetrics = calcChange(avgRevenue, prevAvgRevenue)

    return NextResponse.json({
      success: true,
      data: {
        timeRange,
        kpis: {
          totalRevenue: { current: totalCurrentRevenue, previous: totalPrevRevenue, ...revenueMetrics },
          newPatients: { current: currentNewPatients, previous: prevNewPatients, ...patientMetrics },
          totalAppointments: { current: currentAppointments, previous: prevAppointments, ...appointmentMetrics },
          averageRevenue: { current: avgRevenue, previous: prevAvgRevenue, ...avgRevenueMetrics },
          patientRetention: { current: retentionRate, previous: 0, change: 0, trend: 'neutral' },
          appointmentNoShows: { current: noShowRate, previous: 0, change: 0, trend: 'neutral' }
        },
        lastUpdated: new Date().toISOString()
      }
    })
  } catch (error) {
    console.error("Error fetching KPIs:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

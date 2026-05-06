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

    // Get the last 12 months of revenue data
    const now = new Date()
    const revenueData = []

    for (let i = 11; i >= 0; i--) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59, 999)
      const monthLabel = monthStart.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })

      const payments = await prisma.patientPayment.aggregate({
        where: { createdAt: { gte: monthStart, lte: monthEnd }, status: 'completed' },
        _sum: { amount: true }
      })
      const billingPayments = await prisma.payment.aggregate({
        where: { createdAt: { gte: monthStart, lte: monthEnd }, status: 'completed' },
        _sum: { amount: true }
      })

      const appointments = await prisma.appointment.count({
        where: { scheduledDatetime: { gte: monthStart, lte: monthEnd }, status: { notIn: ['cancelled'] } }
      })
      const patients = await prisma.patient.count({
        where: { createdAt: { gte: monthStart, lte: monthEnd }, isActive: true }
      })

      const revenue = Number(payments._sum.amount || 0) + Number(billingPayments._sum.amount || 0)

      revenueData.push({
        period: monthLabel,
        revenue,
        appointments,
        patients,
        expenses: 0,
        profit: revenue
      })
    }

    // Payment method distribution from PatientPayment
    const paymentMethods = await prisma.patientPayment.groupBy({
      by: ['paymentMethod'],
      where: { status: 'completed' },
      _sum: { amount: true },
      _count: true
    })

    const totalPaymentAmount = paymentMethods.reduce((sum, p) => sum + Number(p._sum.amount || 0), 0)
    const paymentDistribution: Record<string, { amount: number; percentage: number }> = {}
    for (const pm of paymentMethods) {
      paymentDistribution[pm.paymentMethod] = {
        amount: Number(pm._sum.amount || 0),
        percentage: totalPaymentAmount > 0 ? Math.round((Number(pm._sum.amount || 0) / totalPaymentAmount) * 100) : 0
      }
    }

    // Outstanding balances from Billing
    const outstandingBillings = await prisma.billing.aggregate({
      where: { status: { in: ['sent', 'overdue', 'partial_payment'] } },
      _sum: { balanceDue: true }
    })

    const totalRevenue = revenueData.reduce((sum, d) => sum + d.revenue, 0)

    return NextResponse.json({
      success: true,
      data: {
        timeRange,
        revenueData,
        paymentDistribution,
        outstandingBalances: {
          total: Number(outstandingBillings._sum.balanceDue || 0),
          overdue30: 0,
          overdue60: 0,
          overdue90: 0,
          current: Number(outstandingBillings._sum.balanceDue || 0)
        },
        summary: {
          totalRevenue,
          totalExpenses: 0,
          netProfit: totalRevenue,
          profitMargin: totalRevenue > 0 ? 100 : 0
        },
        lastUpdated: new Date().toISOString()
      }
    })
  } catch (error) {
    console.error("Error fetching revenue analytics:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { getServerAuth } from '@/lib/auth'
import { prisma } from '@/lib/db'

// GET /api/patients/[id]/stats — Patient workspace analytics
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerAuth()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const patientId = params.id

    // Total visits (completed appointments)
    const totalVisits = await prisma.appointment.count({
      where: { patientId, status: 'completed' }
    })

    // Active packages
    const activePackages = await prisma.treatmentPackage.findMany({
      where: { patientId, status: { in: ['active', 'in_progress'] } },
      select: { id: true, title: true, patientPayable: true, paidAmount: true, balanceDue: true, coveredAmount: true, totalAmount: true, status: true }
    })

    // All packages for totals
    const allPackages = await prisma.treatmentPackage.findMany({
      where: { patientId },
      select: { paidAmount: true, coveredAmount: true, balanceDue: true, totalAmount: true, patientPayable: true }
    })

    const totalSpent = allPackages.reduce((s, p) => s + Number(p.paidAmount), 0)
    const totalCoverage = allPackages.reduce((s, p) => s + Number(p.coveredAmount), 0)
    const totalBalance = allPackages.reduce((s, p) => s + Number(p.balanceDue), 0)
    const totalTreatmentValue = allPackages.reduce((s, p) => s + Number(p.totalAmount), 0)

    // Last visit
    const lastVisit = await prisma.appointment.findFirst({
      where: { patientId, status: 'completed' },
      orderBy: { scheduledDatetime: 'desc' },
      select: { scheduledDatetime: true, appointmentType: true }
    })

    // Unsigned consents
    const unsignedConsents = await prisma.consentForm.count({
      where: { patientId, status: { in: ['draft', 'sent', 'viewed'] } }
    })

    // Next appointment
    const nextAppointment = await prisma.appointment.findFirst({
      where: { patientId, status: { in: ['scheduled', 'confirmed'] }, scheduledDatetime: { gte: new Date() } },
      orderBy: { scheduledDatetime: 'asc' },
      select: { scheduledDatetime: true, appointmentType: true }
    })

    // Treatment plan analytics
    const allPlans = await prisma.treatmentPlan.findMany({
      where: { patientId },
      select: {
        id: true, status: true, completionPercentage: true,
        estimatedCost: true, actualCost: true, actualStartDate: true, actualEndDate: true,
        approvalDate: true, consentDate: true, createdAt: true,
      },
    })
    const planTotal = allPlans.length
    const planActive = allPlans.filter(p => ['approved', 'in_progress'].includes(p.status)).length
    const planDraft = allPlans.filter(p => p.status === 'draft').length
    const planCompleted = allPlans.filter(p => p.status === 'completed').length
    const planCancelled = allPlans.filter(p => p.status === 'cancelled').length
    const plansAwaitingApproval = allPlans.filter(p =>
      p.status === 'draft' && (!p.approvalDate || !p.consentDate)
    ).length
    const avgCompletion = planTotal > 0
      ? Math.round(allPlans.reduce((s, p) => s + (p.completionPercentage || 0), 0) / planTotal)
      : 0
    const planEstimatedTotal = allPlans.reduce((s, p) => s + Number(p.estimatedCost || 0), 0)
    const planActualTotal = allPlans.reduce((s, p) => s + Number(p.actualCost || 0), 0)
    // Avg duration days (only for completed plans with both dates)
    const completedWithDates = allPlans.filter(p => p.actualStartDate && p.actualEndDate)
    const avgPlanDurationDays = completedWithDates.length > 0
      ? Math.round(
        completedWithDates.reduce((s, p) => {
          const diff = new Date(p.actualEndDate!).getTime() - new Date(p.actualStartDate!).getTime()
          return s + diff / (1000 * 60 * 60 * 24)
        }, 0) / completedWithDates.length
      )
      : 0

    return NextResponse.json({
      totalVisits,
      totalSpent,
      totalCoverage,
      totalBalance,
      totalTreatmentValue,
      activePackages,
      lastVisit,
      nextAppointment,
      unsignedConsents,
      packageCount: allPackages.length,
      activePackageCount: activePackages.length,
      treatmentPlans: {
        total: planTotal,
        active: planActive,
        draft: planDraft,
        completed: planCompleted,
        cancelled: planCancelled,
        awaitingApproval: plansAwaitingApproval,
        averageCompletion: avgCompletion,
        estimatedTotal: planEstimatedTotal,
        actualTotal: planActualTotal,
        averageDurationDays: avgPlanDurationDays,
      },
    })
  } catch (error) {
    console.error('Error fetching patient stats:', error)
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 })
  }
}

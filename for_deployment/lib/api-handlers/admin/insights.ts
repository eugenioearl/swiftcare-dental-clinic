import { formatDentistName } from '@/lib/utils'
import { NextRequest, NextResponse } from 'next/server'
import { getServerAuth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getClinicTodayRange } from '@/lib/clinic-hours'

// GET /api/admin/insights
export async function GET(request: NextRequest) {
  try {
    const session = await getServerAuth()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Package Stats
    const allPackages = await prisma.treatmentPackage.findMany({
      include: {
        patient: { select: { id: true, fullName: true, patientNumber: true } },
        items: { select: { procedureName: true, quantity: true, unitCost: true, adjustedCost: true } },
      }
    })

    const pkgByStatus: Record<string, number> = {}
    let totalRevenue = 0
    let totalBalance = 0
    let totalCoverage = 0

    allPackages.forEach(p => {
      pkgByStatus[p.status] = (pkgByStatus[p.status] || 0) + 1
      totalRevenue += Number(p.paidAmount)
      totalBalance += Number(p.balanceDue)
      totalCoverage += Number(p.coveredAmount)
    })

    // Payment Stats (PatientPayment model)
    const allPayments = await prisma.patientPayment.findMany({
      include: {
        patient: { select: { id: true, fullName: true } },
      },
      orderBy: { createdAt: 'desc' }
    })

    const paymentByMethod: Record<string, { count: number; total: number }> = {}
    let totalPayments = 0
    allPayments.forEach(p => {
      const method = p.paymentMethod || 'unknown'
      if (!paymentByMethod[method]) paymentByMethod[method] = { count: 0, total: 0 }
      paymentByMethod[method].count++
      paymentByMethod[method].total += Number(p.amount)
      totalPayments += Number(p.amount)
    })

    // Recent payments (last 10)
    const recentPayments = allPayments.slice(0, 10).map(p => ({
      id: p.id,
      amount: Number(p.amount),
      method: p.paymentMethod,
      date: p.processedAt || p.createdAt,
      status: p.status
    }))

    // Revenue Trends — monthly for last 12 months
    const revenueTrends: { month: string; revenue: number; payments: number }[] = []
    const now = new Date()
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59)
      const monthLabel = d.toLocaleString('en-US', { month: 'short', year: '2-digit' })
      const monthPayments = allPayments.filter(p => {
        const pDate = new Date(p.processedAt || p.createdAt)
        return pDate >= d && pDate <= monthEnd
      })
      revenueTrends.push({
        month: monthLabel,
        revenue: monthPayments.reduce((sum, p) => sum + Number(p.amount), 0),
        payments: monthPayments.length
      })
    }

    // Revenue per procedure (from package items)
    const procRevenue: Record<string, { count: number; total: number }> = {}
    allPackages.forEach(pkg => {
      pkg.items?.forEach(item => {
        const name = item.procedureName || 'Unknown'
        if (!procRevenue[name]) procRevenue[name] = { count: 0, total: 0 }
        procRevenue[name].count += item.quantity || 1
        procRevenue[name].total += Number(item.adjustedCost || item.unitCost || 0) * (item.quantity || 1)
      })
    })
    const procedureBreakdown = Object.entries(procRevenue)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 15)

    // Revenue per dentist (from appointments with completed procedures)
    const dentists = await prisma.dentist.findMany({
      select: { id: true, user: { select: { firstName: true, lastName: true } } }
    })
    const dentistProcedures = await prisma.procedureRecord.findMany({
      select: { dentistName: true, status: true }
    })
    const dentistBreakdown = dentists.map(d => {
      const name = formatDentistName(d.user?.firstName, d.user?.lastName)
      const count = dentistProcedures.filter(p => p.dentistName === name).length
      return { name, procedures: count }
    }).filter(d => d.procedures > 0).sort((a, b) => b.procedures - a.procedures)

    // Consent Stats
    const allConsents = await prisma.consentForm.findMany({
      select: {
        id: true, status: true, createdAt: true,
        patient: { select: { id: true, fullName: true } }
      }
    })

    const consentByStatus: Record<string, number> = {}
    allConsents.forEach(c => {
      consentByStatus[c.status] = (consentByStatus[c.status] || 0) + 1
    })

    // Action needed items
    const actionItems: { type: string; title: string; detail: string; priority: string }[] = []

    const unpaidPackages = allPackages.filter(p => Number(p.balanceDue) > 0 && ['active', 'in_progress', 'completed'].includes(p.status))
    unpaidPackages.slice(0, 5).forEach(p => {
      actionItems.push({
        type: 'payment',
        title: `Unpaid balance: ₱${Number(p.balanceDue).toLocaleString()}`,
        detail: `${p.patient.fullName || p.patient.patientNumber}`,
        priority: Number(p.balanceDue) > 10000 ? 'high' : 'medium'
      })
    })

    const pendingConsents = allConsents.filter(c => ['draft', 'sent', 'viewed'].includes(c.status))
    pendingConsents.slice(0, 5).forEach(c => {
      actionItems.push({
        type: 'consent',
        title: `Pending consent: ${c.status}`,
        detail: `${c.patient.fullName || 'Patient'}`,
        priority: c.status === 'viewed' ? 'high' : 'low'
      })
    })

    // Patient count
    const patientCount = await prisma.patient.count({ where: { isActive: true } })

    // Today's appointments (Manila timezone)
    const { startOfDay, endOfDay } = getClinicTodayRange()
    const todaysAppointmentCount = await prisma.appointment.count({
      where: { scheduledDatetime: { gte: startOfDay, lte: endOfDay } }
    })

    // Patient insights — top spenders
    const patientSpend: Record<string, { name: string; total: number; visits: number }> = {}
    allPayments.forEach(p => {
      const pid = p.patient?.id || p.patientId
      const pname = p.patient?.fullName
      if (!pid) return
      if (!patientSpend[pid]) patientSpend[pid] = { name: pname || 'Unknown', total: 0, visits: 0 }
      patientSpend[pid].total += Number(p.amount)
    })
    // Count visits per patient
    const visitCounts = await prisma.appointment.groupBy({
      by: ['patientId'],
      _count: { id: true },
      where: { status: { in: ['completed', 'checked_in', 'in_progress'] } }
    })
    visitCounts.forEach(vc => {
      if (patientSpend[vc.patientId]) {
        patientSpend[vc.patientId].visits = vc._count.id
      }
    })
    const patientInsights = Object.entries(patientSpend)
      .map(([id, data]) => ({ id, ...data }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10)

    // Migration stats
    const migrationStats = await prisma.smartUpload.groupBy({
      by: ['migrationStatus'],
      _count: { id: true }
    })
    const classificationStats = await prisma.smartUpload.groupBy({
      by: ['classification'],
      _count: { id: true }
    })
    const totalUploads = await prisma.smartUpload.count()

    return NextResponse.json({
      packages: {
        total: allPackages.length,
        byStatus: pkgByStatus,
        totalRevenue,
        totalBalance,
        totalCoverage
      },
      payments: {
        total: allPayments.length,
        totalAmount: totalPayments,
        byMethod: paymentByMethod,
        recent: recentPayments
      },
      revenueTrends,
      procedureBreakdown,
      dentistBreakdown,
      consents: {
        total: allConsents.length,
        byStatus: consentByStatus
      },
      overview: {
        activePatients: patientCount,
        todaysAppointments: todaysAppointmentCount
      },
      actionItems,
      patientInsights,
      migration: {
        total: totalUploads,
        byStatus: Object.fromEntries(migrationStats.map(m => [m.migrationStatus, m._count.id])),
        byClassification: Object.fromEntries(classificationStats.map(c => [c.classification || 'unclassified', c._count.id]))
      }
    })
  } catch (error) {
    console.error('Error fetching insights:', error)
    return NextResponse.json({ error: 'Failed to fetch insights' }, { status: 500 })
  }
}

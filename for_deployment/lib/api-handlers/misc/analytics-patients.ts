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

    // Weekly patient flow - appointments by day of week
    const now = new Date()
    const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

    const weeklyAppointments = await prisma.appointment.findMany({
      where: { scheduledDatetime: { gte: weekStart, lte: now }, status: { notIn: ['cancelled'] }, patient: { isActive: true } },
      select: { scheduledDatetime: true, status: true, appointmentType: true, patientId: true }
    })

    // Get patients created before this week (returning) vs this week (new)
    const patientsCreatedThisWeek = await prisma.patient.findMany({
      where: { createdAt: { gte: weekStart }, isActive: true },
      select: { id: true }
    })
    const newPatientIds = new Set(patientsCreatedThisWeek.map(p => p.id))

    const weeklyPatientFlow = dayNames.map(day => {
      const dayAppointments = weeklyAppointments.filter(a => {
        const d = new Date(a.scheduledDatetime)
        return dayNames[d.getDay()] === day
      })
      const newCount = dayAppointments.filter(a => newPatientIds.has(a.patientId)).length
      const returning = dayAppointments.length - newCount
      const noShows = dayAppointments.filter(a => a.status === 'no_show').length
      return { day, new: newCount, returning, total: dayAppointments.length, noShows }
    })

    // Demographics - from active patient records only
    const allPatients = await prisma.patient.findMany({
      where: { isActive: true },
      select: { id: true, dateOfBirth: true, gender: true, createdAt: true }
    })

    const ageGroups = [
      { range: '0-17', count: 0, percentage: 0 },
      { range: '18-30', count: 0, percentage: 0 },
      { range: '31-50', count: 0, percentage: 0 },
      { range: '51-70', count: 0, percentage: 0 },
      { range: '70+', count: 0, percentage: 0 }
    ]

    let maleCount = 0, femaleCount = 0
    for (const patient of allPatients) {
      if (patient.dateOfBirth) {
        const age = Math.floor((now.getTime() - new Date(patient.dateOfBirth).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
        if (age <= 17) ageGroups[0].count++
        else if (age <= 30) ageGroups[1].count++
        else if (age <= 50) ageGroups[2].count++
        else if (age <= 70) ageGroups[3].count++
        else ageGroups[4].count++
      }
      if (patient.gender === 'male') maleCount++
      else if (patient.gender === 'female') femaleCount++
    }

    const total = allPatients.length
    for (const ag of ageGroups) {
      ag.percentage = total > 0 ? Math.round((ag.count / total) * 100) : 0
    }

    // Retention metrics - only active patients with non-cancelled appointments
    const patientsWithMultipleAppts = await prisma.appointment.groupBy({
      by: ['patientId'],
      where: { status: { notIn: ['cancelled'] }, patient: { isActive: true } },
      having: { patientId: { _count: { gt: 1 } } }
    })
    const retentionRate = total > 0 ? Math.round((patientsWithMultipleAppts.length / total) * 100 * 10) / 10 : 0

    // New patients this month
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const newPatientsThisMonth = await prisma.patient.count({
      where: { createdAt: { gte: monthStart }, isActive: true }
    })

    // Average daily patients - exclude cancelled appointments
    const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    const last30DaysAppointments = await prisma.appointment.count({
      where: { scheduledDatetime: { gte: last30Days, lte: now }, status: { notIn: ['cancelled'] }, patient: { isActive: true } }
    })
    const avgDailyPatients = Math.round(last30DaysAppointments / 30)

    return NextResponse.json({
      success: true,
      data: {
        timeRange,
        weeklyPatientFlow,
        demographics: {
          ageGroups,
          gender: {
            female: { count: femaleCount, percentage: total > 0 ? Math.round((femaleCount / total) * 100) : 0 },
            male: { count: maleCount, percentage: total > 0 ? Math.round((maleCount / total) * 100) : 0 }
          },
          insuranceTypes: []
        },
        retentionMetrics: {
          overallRetentionRate: retentionRate,
          averageVisitsPerYear: 0,
          newPatientGrowth: 0,
          patientLifetimeValue: 0,
          referralRate: 0,
          satisfactionScore: 0
        },
        acquisitionSources: [],
        summary: {
          totalActivePatients: total,
          newPatientsThisMonth,
          averageDailyPatients: avgDailyPatients,
          peakDay: 'N/A'
        },
        lastUpdated: new Date().toISOString()
      }
    })
  } catch (error) {
    console.error("Error fetching patient analytics:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

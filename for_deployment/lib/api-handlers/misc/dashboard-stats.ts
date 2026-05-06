
import { NextRequest, NextResponse } from "next/server"
import { getServerAuth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { getClinicTodayRange } from "@/lib/clinic-hours"

// GET /api/dashboard/stats - Get dashboard statistics
export async function GET(request: NextRequest) {
  try {
    const session = await getServerAuth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { startOfDay, endOfDay } = getClinicTodayRange()
    const today = new Date()
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
    const startOfLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1)
    const endOfLastMonth = new Date(today.getFullYear(), today.getMonth(), 0)

    let stats: any = {}

    if (session.user.role === 'patient') {
      // Patient-specific stats
      const patient = await prisma.patient.findUnique({
        where: { userId: session.user.id }
      })

      if (patient) {
        const [upcomingAppointments, totalAppointments, pendingBills] = await Promise.all([
          prisma.appointment.count({
            where: {
              patientId: patient.id,
              scheduledDatetime: { gte: new Date() },
              status: { 
                notIn: ['completed', 'cancelled', 'no_show'] 
              }
            }
          }),
          prisma.appointment.count({
            where: { patientId: patient.id }
          }),
          prisma.billing.findMany({
            where: {
              patientId: patient.id,
              balanceDue: { gt: 0 }
            }
          })
        ])

        const totalBalance = pendingBills.reduce((sum, bill) => sum + parseFloat(bill.balanceDue.toString()), 0)

        stats = {
          upcomingAppointments,
          totalAppointments,
          pendingBills: pendingBills.length,
          totalBalance
        }
      }

    } else if (session.user.role === 'dentist' && false) {
      // Dentist-specific stats (disabled - dentists now use admin dashboard)
      const dentist = await prisma.dentist.findUnique({
        where: { userId: session.user.id }
      })

      if (dentist) {
        const [todayAppointments, completedToday, waitingPatients, totalPatients] = await Promise.all([
          prisma.appointment.count({
            where: {
              dentistId: dentist.id,
              scheduledDatetime: { gte: startOfDay, lte: endOfDay },
              status: { notIn: ['cancelled', 'no_show'] }
            }
          }),
          prisma.appointment.count({
            where: {
              dentistId: dentist.id,
              status: 'completed',
              completedAt: { gte: startOfDay, lte: endOfDay }
            }
          }),
          prisma.appointment.count({
            where: {
              dentistId: dentist.id,
              scheduledDatetime: { gte: startOfDay, lte: endOfDay },
              status: { in: ['checked_in', 'waiting', 'confirmed'] }
            }
          }),
          prisma.patient.count({
            where: {
              appointments: {
                some: {
                  dentistId: dentist.id
                }
              }
            }
          })
        ])

        stats = {
          todayAppointments,
          waitingPatients,
          completedToday,
          totalPatients
        }
      }

    } else if (session.user.role === 'receptionist' || session.user.role === 'staff') {
      // Staff/Receptionist-specific stats
      const [todayAppointments, waitingPatients, checkedInPatients, totalPatients] = await Promise.all([
        prisma.appointment.count({
          where: {
            scheduledDatetime: { gte: startOfDay, lte: endOfDay },
            status: { notIn: ['cancelled', 'no_show'] },
            patient: { isActive: true }
          }
        }),
        prisma.appointment.count({
          where: {
            scheduledDatetime: { gte: startOfDay, lte: endOfDay },
            status: { in: ['waiting', 'confirmed'] },
            patient: { isActive: true }
          }
        }),
        prisma.appointment.count({
          where: {
            scheduledDatetime: { gte: startOfDay, lte: endOfDay },
            status: 'checked_in',
            patient: { isActive: true }
          }
        }),
        prisma.patient.count({
          where: { isActive: true }
        })
      ])

      stats = {
        todayAppointments,
        waitingPatients,
        checkedInPatients,
        totalPatients
      }

    } else {
      // Admin/Manager/Receptionist stats
      const [
        totalPatients,
        todayAppointments,
        pendingBills,
        monthlyRevenue,
        lastMonthPatients,
        lastMonthAppointments,
        activeStaff
      ] = await Promise.all([
        prisma.patient.count({ where: { isActive: true } }),
        prisma.appointment.count({
          where: {
            scheduledDatetime: { gte: startOfDay, lte: endOfDay },
            status: { notIn: ['cancelled'] },
            patient: { isActive: true }
          }
        }),
        prisma.billing.count({
          where: { balanceDue: { gt: 0 } }
        }),
        prisma.billing.aggregate({
          where: { createdAt: { gte: startOfMonth } },
          _sum: { totalAmount: true }
        }),
        prisma.patient.count({
          where: {
            createdAt: { gte: startOfLastMonth, lte: endOfLastMonth }
          }
        }),
        prisma.appointment.count({
          where: {
            scheduledDatetime: { gte: startOfLastMonth, lte: endOfLastMonth },
            status: { notIn: ['cancelled'] },
            patient: { isActive: true }
          }
        }),
        prisma.user.count({
          where: {
            role: { in: ['dentist', 'receptionist', 'manager'] },
            isActive: true
          }
        })
      ])

      const thisMonthPatients = await prisma.patient.count({
        where: { createdAt: { gte: startOfMonth } }
      })

      const thisMonthAppointments = await prisma.appointment.count({
        where: {
          scheduledDatetime: { gte: startOfMonth },
          status: { notIn: ['cancelled'] },
          patient: { isActive: true }
        }
      })

      stats = {
        totalPatients,
        todayAppointments,
        pendingBills,
        monthlyRevenue: parseFloat(monthlyRevenue._sum.totalAmount?.toString() || '0'),
        patientGrowth: lastMonthPatients > 0 ? ((thisMonthPatients - lastMonthPatients) / lastMonthPatients * 100) : 100,
        appointmentGrowth: lastMonthAppointments > 0 ? ((thisMonthAppointments - lastMonthAppointments) / lastMonthAppointments * 100) : 100,
        activeStaff
      }
    }

    return NextResponse.json({
      success: true,
      data: stats
    })

  } catch (error) {
    console.error("Error fetching dashboard stats:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

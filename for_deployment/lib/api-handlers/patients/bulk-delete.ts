
import { NextRequest, NextResponse } from "next/server"
import { getServerAuth, canManagePatients } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { z } from "zod"

const bulkDeleteSchema = z.object({
  patientIds: z.array(z.string().uuid())
})

// POST /api/patients/bulk-delete
export async function POST(request: NextRequest) {
  try {
    const session = await getServerAuth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!canManagePatients(session.user?.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const { patientIds } = bulkDeleteSchema.parse(body)

    if (patientIds.length === 0) {
      return NextResponse.json({ error: "No patient IDs provided" }, { status: 400 })
    }

    // Soft-delete: deactivate patients and their linked users
    const result = await prisma.$transaction(async (tx) => {
      // Get the patients for audit purposes
      const patientsToDeactivate = await tx.patient.findMany({
        where: { id: { in: patientIds } },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true
            }
          }
        }
      })

      // Deactivate patients
      const deactivatedPatients = await tx.patient.updateMany({
        where: { id: { in: patientIds } },
        data: { isActive: false }
      })

      // Deactivate linked user accounts (filter out patients without users)
      const userIds = patientsToDeactivate
        .map(p => p.userId)
        .filter((uid): uid is string => uid != null)

      if (userIds.length > 0) {
        await tx.user.updateMany({
          where: { id: { in: userIds } },
          data: { isActive: false }
        })
      }

      // Cancel all non-terminal appointments for these patients so they don't
      // block future re-registration or show up in scheduling views.
      await tx.appointment.updateMany({
        where: {
          patientId: { in: patientIds },
          status: { in: ['pending', 'pending_assignment', 'scheduled', 'confirmed', 'checked_in', 'waiting', 'in_progress'] }
        },
        data: {
          status: 'cancelled',
          cancellationReason: 'Patient record removed',
          cancelledAt: new Date()
        }
      })

      // Create audit logs for each deactivation
      const auditLogs = patientsToDeactivate.map(patient => ({
        userId: session.user?.id,
        entityType: 'patient',
        entityId: patient.id,
        action: 'delete' as const,
        oldValues: {
          patientNumber: patient.patientNumber,
          fullName: patient.fullName,
          email: patient.user?.email || patient.emailDirect,
          isActive: true
        },
        newValues: {
          isActive: false
        }
      }))

      await tx.auditLog.createMany({
        data: auditLogs
      })

      return {
        deactivatedCount: deactivatedPatients.count,
        patients: patientsToDeactivate
      }
    })

    return NextResponse.json({
      success: true,
      message: `Successfully deactivated ${result.deactivatedCount} patients`,
      data: {
        deletedCount: result.deactivatedCount
      }
    })

  } catch (error) {
    console.error("Error in bulk delete:", error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        error: "Validation error",
        details: error.errors
      }, { status: 400 })
    }

    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

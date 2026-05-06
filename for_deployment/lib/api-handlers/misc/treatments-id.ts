

import { NextRequest, NextResponse } from "next/server"
import { getServerAuth, canManageTreatments } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { z } from "zod"

const updateTreatmentSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  category: z.string().min(1).max(100).optional(),
  procedureType: z.enum(['general', 'ortho']).optional(),
  baseCost: z.number().min(0).optional(),
  estimatedDurationMinutes: z.number().min(15).max(480).optional(),
  requiresAnesthesia: z.boolean().optional(),
  requiresFollowup: z.boolean().optional(),
  isSurgical: z.boolean().optional(),
  isActive: z.boolean().optional()
}).refine(data => Object.keys(data).length > 0, {
  message: "At least one field must be provided for update"
})

// GET /api/treatments/[id] - Get specific treatment
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerAuth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = params

    const treatment = await prisma.treatment.findUnique({
      where: { id },
      include: {
        appointmentTreatments: {
          include: {
            appointment: {
              select: {
                id: true,
                appointmentNumber: true,
                scheduledDatetime: true,
                status: true,
                patient: {
                  select: {
                    id: true,
                    patientNumber: true,
                    user: {
                      select: {
                        firstName: true,
                        lastName: true
                      }
                    }
                  }
                }
              }
            }
          },
          take: 10,
          orderBy: { createdAt: 'desc' }
        }
      }
    })

    if (!treatment) {
      return NextResponse.json({ error: "Treatment not found" }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      data: treatment
    })

  } catch (error) {
    console.error("Error fetching treatment:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// PUT /api/treatments/[id] - Update specific treatment
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerAuth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!canManageTreatments(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { id } = params
    const body = await request.json()
    const validatedData = updateTreatmentSchema.parse(body)

    // Check if treatment exists
    const existingTreatment = await prisma.treatment.findUnique({
      where: { id }
    })

    if (!existingTreatment) {
      return NextResponse.json({ error: "Treatment not found" }, { status: 404 })
    }

    const updatedTreatment = await prisma.treatment.update({
      where: { id },
      data: validatedData
    })

    // Log treatment update
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        entityType: 'treatment',
        entityId: id,
        action: 'update',
        oldValues: {
          name: existingTreatment.name,
          category: existingTreatment.category,
          baseCost: existingTreatment.baseCost.toString(),
          isActive: existingTreatment.isActive
        },
        newValues: {
          ...validatedData,
          baseCost: validatedData.baseCost?.toString()
        }
      }
    })

    return NextResponse.json({
      success: true,
      data: updatedTreatment
    })

  } catch (error) {
    console.error("Error updating treatment:", error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        error: "Validation error",
        details: error.errors
      }, { status: 400 })
    }

    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// DELETE /api/treatments/[id] - Delete (deactivate) specific treatment
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerAuth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!canManageTreatments(session.user.role) || session.user.role !== 'admin') {
      return NextResponse.json({ error: "Forbidden - Admin access required" }, { status: 403 })
    }

    const { id } = params
    
    // Check for hard delete flag
    const searchParams = request.nextUrl.searchParams
    const hardDelete = searchParams.get('hardDelete') === 'true'

    // Check if treatment exists
    const existingTreatment = await prisma.treatment.findUnique({
      where: { id },
      include: {
        appointmentTreatments: {
          where: {
            appointment: {
              status: { in: ['scheduled', 'confirmed', 'checked_in', 'in_progress'] }
            }
          }
        }
      }
    })

    if (!existingTreatment) {
      return NextResponse.json({ error: "Treatment not found" }, { status: 404 })
    }

    // Check for active appointments using this treatment
    if (existingTreatment.appointmentTreatments.length > 0 && hardDelete) {
      return NextResponse.json({
        error: "Cannot hard delete treatment with active appointments. Please deactivate instead or complete all associated appointments first."
      }, { status: 409 })
    }

    let result
    if (hardDelete) {
      // Hard delete - completely remove the treatment (only if no active appointments)
      result = await prisma.treatment.delete({
        where: { id }
      })
    } else {
      // Soft delete - deactivate the treatment
      result = await prisma.treatment.update({
        where: { id },
        data: { isActive: false }
      })
    }

    // Log treatment deletion/deactivation
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        entityType: 'treatment',
        entityId: id,
        action: hardDelete ? 'delete' : 'update',
        oldValues: {
          treatmentCode: existingTreatment.treatmentCode,
          name: existingTreatment.name,
          isActive: existingTreatment.isActive
        },
        newValues: hardDelete ? {} : { isActive: false }
      }
    })

    return NextResponse.json({
      success: true,
      message: hardDelete ? "Treatment permanently deleted" : "Treatment deactivated successfully"
    })

  } catch (error) {
    console.error("Error deleting treatment:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}


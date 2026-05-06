

import { NextRequest, NextResponse } from "next/server"
import { getServerAuth, canAccessBilling, canManageBilling } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { z } from "zod"

const updateBillingSchema = z.object({
  subtotal: z.number().min(0).optional(),
  taxRate: z.number().min(0).max(1).optional(),
  taxAmount: z.number().min(0).optional(),
  discountAmount: z.number().min(0).optional(),
  discountReason: z.string().optional(),
  totalAmount: z.number().min(0).optional(),
  dueDate: z.string().transform((str) => new Date(str)).optional(),
  notes: z.string().optional(),
  paymentTerms: z.number().int().min(1).max(365).optional(),
  status: z.enum(['draft', 'sent', 'partial_payment', 'paid', 'overdue', 'cancelled', 'refunded']).optional()
}).refine(data => Object.keys(data).length > 0, {
  message: "At least one field must be provided for update"
})

// GET /api/billing/[id] - Get specific billing record
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

    // Build where clause based on user role
    let whereClause: any = { id }
    
    if (session.user?.role === 'patient') {
      // Patients can only see their own billing
      const patient = await prisma.patient.findUnique({
        where: { userId: session.user?.id }
      })
      if (!patient) {
        return NextResponse.json({ error: "Patient record not found" }, { status: 404 })
      }
      whereClause.patientId = patient.id
    }

    const billing = await prisma.billing.findFirst({
      where: whereClause,
      include: {
        patient: {
          include: { user: true }
        },
        appointment: {
          include: {
            dentist: { include: { user: true } },
            appointmentTreatments: {
              include: { treatment: true }
            }
          }
        },
        payments: {
          orderBy: { createdAt: 'desc' }
        }
      }
    })

    if (!billing) {
      return NextResponse.json({ error: "Billing record not found" }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      data: billing
    })

  } catch (error) {
    console.error("Error fetching billing record:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// PUT /api/billing/[id] - Update specific billing record
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerAuth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!canManageBilling(session.user?.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { id } = params
    const body = await request.json()
    const validatedData = updateBillingSchema.parse(body)

    // Check if billing record exists
    const existingBilling = await prisma.billing.findUnique({
      where: { id }
    })

    if (!existingBilling) {
      return NextResponse.json({ error: "Billing record not found" }, { status: 404 })
    }

    // Check if billing record can be updated
    if (existingBilling.status === 'paid' || existingBilling.status === 'refunded') {
      return NextResponse.json({
        error: "Cannot update paid or refunded billing records"
      }, { status: 409 })
    }

    // Validate calculations if amounts are being updated
    if (validatedData.subtotal || validatedData.taxAmount || validatedData.totalAmount) {
      const subtotal = validatedData.subtotal ?? existingBilling.subtotal
      const taxRate = validatedData.taxRate ?? existingBilling.taxRate
      const taxAmount = validatedData.taxAmount ?? existingBilling.taxAmount
      const discountAmount = validatedData.discountAmount ?? existingBilling.discountAmount
      const totalAmount = validatedData.totalAmount ?? existingBilling.totalAmount

      const calculatedTaxAmount = Number(subtotal) * Number(taxRate)
      const calculatedTotal = Number(subtotal) + calculatedTaxAmount - Number(discountAmount)

      if (Math.abs(calculatedTaxAmount - Number(taxAmount)) > 0.01) {
        return NextResponse.json({
          error: "Tax amount calculation mismatch"
        }, { status: 400 })
      }

      if (Math.abs(calculatedTotal - Number(totalAmount)) > 0.01) {
        return NextResponse.json({
          error: "Total amount calculation mismatch"
        }, { status: 400 })
      }
    }

    const updatedBilling = await prisma.billing.update({
      where: { id },
      data: validatedData,
      include: {
        patient: {
          include: { user: true }
        },
        appointment: {
          include: {
            dentist: { include: { user: true } }
          }
        },
        payments: true
      }
    })

    // Log billing update
    await prisma.auditLog.create({
      data: {
        userId: session.user?.id,
        entityType: 'billing',
        entityId: id,
        action: 'update',
        oldValues: {
          totalAmount: existingBilling.totalAmount.toString(),
          status: existingBilling.status,
          dueDate: existingBilling.dueDate?.toISOString() || null
        },
        newValues: {
          ...validatedData,
          totalAmount: validatedData.totalAmount?.toString(),
          dueDate: validatedData.dueDate?.toISOString()
        }
      }
    })

    // Create notification for status changes
    if (validatedData.status && validatedData.status !== existingBilling.status) {
      const statusMessages = {
        sent: 'Your invoice has been sent',
        overdue: 'Your payment is overdue',
        paid: 'Thank you for your payment',
        cancelled: 'Your invoice has been cancelled'
      }

      if (statusMessages[validatedData.status as keyof typeof statusMessages]) {
        await prisma.notification.create({
          data: {
            userId: updatedBilling.patient.user?.id,
            title: `Invoice ${validatedData.status}`,
            message: statusMessages[validatedData.status as keyof typeof statusMessages],
            type: validatedData.status === 'paid' ? 'payment_received' : 'payment_due',
            status: 'pending',
            priority: validatedData.status === 'overdue' ? 'high' : 'normal'
          }
        })
      }
    }

    return NextResponse.json({
      success: true,
      data: updatedBilling
    })

  } catch (error) {
    console.error("Error updating billing record:", error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        error: "Validation error",
        details: error.errors
      }, { status: 400 })
    }

    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// DELETE /api/billing/[id] - Cancel/Delete specific billing record
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerAuth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!canManageBilling(session.user?.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { id } = params
    
    // Check for hard delete flag
    const searchParams = request.nextUrl.searchParams
    const hardDelete = searchParams.get('hardDelete') === 'true'

    // Check if billing record exists
    const existingBilling = await prisma.billing.findUnique({
      where: { id },
      include: {
        payments: true,
        patient: { include: { user: true } }
      }
    })

    if (!existingBilling) {
      return NextResponse.json({ error: "Billing record not found" }, { status: 404 })
    }

    // Check if billing record can be deleted
    if (existingBilling.payments.length > 0 && hardDelete) {
      return NextResponse.json({
        error: "Cannot hard delete billing record with payments. Please cancel instead."
      }, { status: 409 })
    }

    if (existingBilling.status === 'paid' || existingBilling.status === 'partial_payment') {
      return NextResponse.json({
        error: "Cannot delete paid or partially paid billing records"
      }, { status: 409 })
    }

    let result
    if (hardDelete && session.user?.role === 'admin') {
      // Hard delete - completely remove the billing record
      result = await prisma.$transaction(async (tx) => {
        // Delete related payments first
        await tx.payment.deleteMany({
          where: { billingId: id }
        })

        // Delete the billing record
        await tx.billing.delete({
          where: { id }
        })

        return { message: "Billing record permanently deleted" }
      })
    } else {
      // Soft delete - cancel the billing record
      result = await prisma.billing.update({
        where: { id },
        data: {
          status: 'cancelled'
        },
        include: {
          patient: { include: { user: true } }
        }
      })
    }

    // Log billing cancellation/deletion
    await prisma.auditLog.create({
      data: {
        userId: session.user?.id,
        entityType: 'billing',
        entityId: id,
        action: hardDelete ? 'delete' : 'update',
        oldValues: {
          invoiceNumber: existingBilling.invoiceNumber,
          status: existingBilling.status,
          totalAmount: existingBilling.totalAmount.toString()
        },
        newValues: hardDelete ? {} : {
          status: 'cancelled'
        }
      }
    })

    // Create notification for patient
    if (!hardDelete) {
      await prisma.notification.create({
        data: {
          userId: existingBilling.patient.user?.id,
          title: "Invoice Cancelled",
          message: `Invoice ${existingBilling.invoiceNumber} has been cancelled.`,
          type: 'system_alert',
          status: 'pending',
          priority: 'normal'
        }
      })
    }

    return NextResponse.json({
      success: true,
      message: hardDelete ? "Billing record permanently deleted" : "Billing record cancelled successfully"
    })

  } catch (error) {
    console.error("Error deleting billing record:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}


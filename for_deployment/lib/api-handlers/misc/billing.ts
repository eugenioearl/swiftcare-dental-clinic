
import { NextRequest, NextResponse } from "next/server"
import { getServerAuth, canAccessBilling, canManageBilling } from "@/lib/auth"
import { prisma, nextSequenceNumber } from "@/lib/db"
import { z } from "zod"
import { notifyRoles, createNotification, ADMIN_STAFF_ROLES } from "@/lib/notifications"

const createBillingSchema = z.object({
  patientId: z.string().uuid(),
  appointmentId: z.string().uuid().optional(),
  subtotal: z.number().min(0),
  taxRate: z.number().min(0).max(1).default(0.0875),
  taxAmount: z.number().min(0),
  discountAmount: z.number().min(0).default(0),
  discountReason: z.string().optional(),
  totalAmount: z.number().min(0),
  dueDate: z.string().transform((str) => new Date(str)),
  notes: z.string().optional(),
  paymentTerms: z.number().int().min(1).max(365).default(30)
})

// GET /api/billing - List billing records
export async function GET(request: NextRequest) {
  try {
    const session = await getServerAuth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const page = parseInt(searchParams.get('page') || '1')
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100)
    const patientId = searchParams.get('patientId')
    const status = searchParams.get('status')
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')

    let whereClause: any = {}

    // Role-based filtering
    if (session.user.role === 'patient') {
      // Patients can only see their own billing
      const patient = await prisma.patient.findUnique({
        where: { userId: session.user.id }
      })
      if (!patient) {
        return NextResponse.json({ error: "Patient record not found" }, { status: 404 })
      }
      whereClause.patientId = patient.id
    }
    // Admin, manager, and receptionist can see all billing

    // Apply filters
    if (patientId) whereClause.patientId = patientId
    if (status) whereClause.status = status

    // Date filtering
    if (dateFrom || dateTo) {
      whereClause.createdAt = {}
      if (dateFrom) whereClause.createdAt.gte = new Date(dateFrom)
      if (dateTo) whereClause.createdAt.lte = new Date(dateTo)
    }

    const total = await prisma.billing.count({ where: whereClause })
    const billingRecords = await prisma.billing.findMany({
      where: whereClause,
      include: {
        patient: {
          include: { user: true }
        },
        appointment: {
          include: {
            dentist: { include: { user: true } }
          }
        },
        payments: {
          orderBy: { createdAt: 'desc' }
        }
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit
    })

    return NextResponse.json({
      success: true,
      data: {
        billingRecords,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      }
    })

  } catch (error) {
    console.error("Error fetching billing records:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// POST /api/billing - Create new billing record
export async function POST(request: NextRequest) {
  try {
    const session = await getServerAuth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!canManageBilling(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const validatedData = createBillingSchema.parse(body)

    // Generate invoice number
    const currentYear = new Date().getFullYear()
    const invoiceNumber = await nextSequenceNumber('billings', 'invoice_number', `INV-${currentYear}-`, 4)

    // Validate calculations
    const calculatedTaxAmount = validatedData.subtotal * validatedData.taxRate
    const calculatedTotal = validatedData.subtotal + calculatedTaxAmount - validatedData.discountAmount

    if (Math.abs(calculatedTaxAmount - validatedData.taxAmount) > 0.01) {
      return NextResponse.json({
        error: "Tax amount calculation mismatch"
      }, { status: 400 })
    }

    if (Math.abs(calculatedTotal - validatedData.totalAmount) > 0.01) {
      return NextResponse.json({
        error: "Total amount calculation mismatch"
      }, { status: 400 })
    }

    // Create billing record
    const billing = await prisma.billing.create({
      data: {
        invoiceNumber,
        patientId: validatedData.patientId,
        appointmentId: validatedData.appointmentId,
        subtotal: validatedData.subtotal,
        taxRate: validatedData.taxRate,
        taxAmount: validatedData.taxAmount,
        discountAmount: validatedData.discountAmount,
        totalAmount: validatedData.totalAmount,
        dueDate: validatedData.dueDate,
        notes: validatedData.notes,
        paymentTerms: validatedData.paymentTerms,
        status: 'draft'
      },
      include: {
        patient: {
          include: { user: true }
        },
        appointment: {
          include: {
            dentist: { include: { user: true } }
          }
        }
      }
    })

    // Log billing creation
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        entityType: 'billing',
        entityId: billing.id,
        action: 'create',
        newValues: {
          invoiceNumber: billing.invoiceNumber,
          patientId: billing.patientId,
          totalAmount: billing.totalAmount.toString(),
          status: billing.status
        }
      }
    })

    // ---------- Phase 2 in-app notifications ----------
    try {
      const patientName = billing.patient?.user
        ? `${billing.patient.user.lastName}, ${billing.patient.user.firstName}`
        : (billing.patient as any)?.fullName || 'Patient'
      const totalFmt = Number(billing.totalAmount).toFixed(2)
      const invoiceRedirect = `/admin/billing?id=${billing.id}`

      // Notify admin + staff so the front desk is aware of new invoices
      await notifyRoles(ADMIN_STAFF_ROLES, {
        title: 'New Invoice Created',
        message: `Invoice ${billing.invoiceNumber} for ${patientName} (₱${totalFmt}) was created.`,
        type: 'invoice_created',
        priority: 'normal',
        module: 'billing',
        relatedRecordId: billing.id,
        redirectUrl: invoiceRedirect,
        dedupeKey: `invoice:${billing.id}:created`,
      }).catch((err) => console.error('[billing POST] notify staff/admin failed:', err))

      // Notify the patient (if they have a user account) of the new invoice
      if (billing.patient?.userId) {
        await createNotification({
          userId: billing.patient.userId,
          title: 'New Invoice Available',
          message: `Invoice ${billing.invoiceNumber} for ₱${totalFmt} is now available. Due on ${billing.dueDate.toLocaleDateString()}.`,
          type: 'payment_due',
          priority: 'normal',
          module: 'billing',
          relatedRecordId: billing.id,
          redirectUrl: '/dashboard/billing',
        }).catch((err) => console.error('[billing POST] notify patient failed:', err))
      }
    } catch (notifyErr) {
      console.error('[billing POST] notification broadcast failed (non-fatal):', notifyErr)
    }

    return NextResponse.json({
      success: true,
      data: billing
    }, { status: 201 })

  } catch (error) {
    console.error("Error creating billing record:", error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        error: "Validation error",
        details: error.errors
      }, { status: 400 })
    }

    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

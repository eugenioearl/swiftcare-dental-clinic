
import { NextRequest, NextResponse } from "next/server"
import { getServerAuth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { z } from "zod"
import { notifyRoles, createNotification, ADMIN_STAFF_ROLES } from "@/lib/notifications"

const paymentProcessSchema = z.object({
  billingId: z.string().uuid(),
  patientId: z.string().uuid(),
  amount: z.number().min(0.01),
  paymentMethod: z.enum(['credit_card', 'debit_card', 'insurance', 'cash', 'check', 'bank_transfer']),
  paymentData: z.object({
    cardNumber: z.string().optional(),
    expiryMonth: z.string().optional(),
    expiryYear: z.string().optional(),
    cvv: z.string().optional(),
    holderName: z.string().optional(),
    billingAddress: z.object({
      street: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      zipCode: z.string().optional(),
      country: z.string().optional()
    }).optional(),
    provider: z.string().optional(), // For insurance
    policyNumber: z.string().optional(),
    groupNumber: z.string().optional(),
    subscriberId: z.string().optional()
  }).optional()
})

// POST /api/billing/payments/process - Process payment
export async function POST(request: NextRequest) {
  try {
    const session = await getServerAuth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const validatedData = paymentProcessSchema.parse(body)

    // Verify billing record exists and is accessible
    let whereClause: any = { id: validatedData.billingId }
    if (session.user.role === 'patient') {
      const patient = await prisma.patient.findUnique({
        where: { userId: session.user.id }
      })
      if (!patient || patient.id !== validatedData.patientId) {
        return NextResponse.json({ error: "Access denied" }, { status: 403 })
      }
      whereClause.patientId = patient.id
    }

    const billing = await prisma.billing.findFirst({
      where: whereClause,
      include: { payments: true }
    })

    if (!billing) {
      return NextResponse.json({ error: "Billing record not found" }, { status: 404 })
    }

    // Calculate remaining balance
    const totalPaid = billing.payments.reduce((sum, payment) => sum + Number(payment.amount), 0)
    const remainingBalance = Number(billing.totalAmount) - totalPaid

    if (validatedData.amount > remainingBalance + 0.01) { // Allow small rounding differences
      return NextResponse.json({
        error: "Payment amount exceeds remaining balance"
      }, { status: 400 })
    }

    // Simulate payment processing based on method
    let processingResult = await simulatePaymentProcessing(validatedData)

    if (!processingResult.success) {
      return NextResponse.json({
        error: processingResult.error,
        code: processingResult.code
      }, { status: 400 })
    }

    // Generate unique payment reference
    const paymentRef = `PAY-${Date.now()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`

    // Create payment record
    const payment = await prisma.payment.create({
      data: {
        billingId: validatedData.billingId,
        paymentReference: paymentRef,
        amount: validatedData.amount,
        paymentMethod: validatedData.paymentMethod,
        status: processingResult.status || 'pending',
        transactionId: processingResult.transactionId,
        processor: validatedData.paymentMethod === 'credit_card' || validatedData.paymentMethod === 'debit_card' ? 'Stripe' : 'Manual',
        processedAt: processingResult.processedAt,
        notes: processingResult.notes
      }
    })

    // Update billing status based on payment
    const newTotalPaid = totalPaid + validatedData.amount
    const newBalance = Number(billing.totalAmount) - newTotalPaid
    
    let newBillingStatus = billing.status
    if (newBalance <= 0.01) { // Fully paid
      newBillingStatus = 'paid'
    } else if (newTotalPaid > 0) { // Partially paid
      newBillingStatus = 'partial_payment'
    }

    await prisma.billing.update({
      where: { id: validatedData.billingId },
      data: {
        status: newBillingStatus,
        balanceDue: Math.max(0, newBalance)
      }
    })

    // Create notification for successful payment (processor's own confirmation)
    await prisma.notification.create({
      data: {
        userId: session.user.id,
        title: "Payment Processed Successfully",
        message: `Payment of ₱${validatedData.amount.toFixed(2)} has been processed for invoice ${billing.invoiceNumber}`,
        type: 'payment_received',
        module: 'billing',
        relatedRecordId: billing.id,
        redirectUrl: `/admin/billing?id=${billing.id}`,
        status: 'sent',
        priority: 'normal',
        sentAt: new Date(),
      }
    }).catch((err) => console.error('[billing-payments] self-notification failed:', err))

    // ---------- Phase 2: broadcast payment-received to staff/admin + patient ----------
    try {
      const paidAmount = validatedData.amount.toFixed(2)
      const invoiceRedirect = `/admin/billing?id=${billing.id}`
      const isFullyPaid = newBalance <= 0.01
      const statusLabel = processingResult.status === 'completed' ? 'received' : 'recorded'

      // Fetch patient info for name
      const patientRecord = await prisma.patient.findUnique({
        where: { id: validatedData.patientId },
        include: { user: { select: { id: true, firstName: true, lastName: true } } },
      })
      const patientName = patientRecord?.user
        ? `${patientRecord.user.lastName}, ${patientRecord.user.firstName}`
        : (patientRecord as any)?.fullName || 'Patient'

      // Broadcast to staff/admin
      await notifyRoles(ADMIN_STAFF_ROLES, {
        title: isFullyPaid ? 'Invoice Fully Paid' : 'Payment Received',
        message: `Payment of ₱${paidAmount} ${statusLabel} for invoice ${billing.invoiceNumber} (${patientName}).${isFullyPaid ? ' Invoice is now fully paid.' : ''}`,
        type: 'payment_received',
        priority: 'normal',
        module: 'billing',
        relatedRecordId: billing.id,
        redirectUrl: invoiceRedirect,
        dedupeKey: `payment:${payment.id}:received`,
      }).catch((err) => console.error('[billing-payments] notify staff/admin failed:', err))

      // Notify patient (if they have a user account and aren't the one processing)
      if (patientRecord?.userId && patientRecord.userId !== session.user.id) {
        await createNotification({
          userId: patientRecord.userId,
          title: isFullyPaid ? 'Invoice Paid in Full' : 'Payment Received',
          message: isFullyPaid
            ? `Your payment of ₱${paidAmount} for invoice ${billing.invoiceNumber} was received. Your balance is now settled.`
            : `Your payment of ₱${paidAmount} for invoice ${billing.invoiceNumber} was received. Remaining balance: ₱${Math.max(0, newBalance).toFixed(2)}.`,
          type: 'payment_received',
          priority: 'normal',
          module: 'billing',
          relatedRecordId: billing.id,
          redirectUrl: '/dashboard/billing',
        }).catch((err) => console.error('[billing-payments] notify patient failed:', err))
      }
    } catch (notifyErr) {
      console.error('[billing-payments] notification broadcast failed (non-fatal):', notifyErr)
    }

    // Log payment processing
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        entityType: 'payment',
        entityId: payment.id,
        action: 'create',
        newValues: {
          billingId: validatedData.billingId,
          amount: validatedData.amount.toString(),
          paymentMethod: validatedData.paymentMethod,
          status: processingResult.status
        }
      }
    })

    return NextResponse.json({
      success: true,
      data: {
        paymentId: payment.id,
        transactionId: processingResult.transactionId,
        status: processingResult.status,
        amount: validatedData.amount,
        remainingBalance: Math.max(0, newBalance)
      }
    })

  } catch (error) {
    console.error("Error processing payment:", error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        error: "Validation error",
        details: error.errors
      }, { status: 400 })
    }

    return NextResponse.json({ error: "Payment processing failed" }, { status: 500 })
  }
}

// Simulate payment processing for different methods
async function simulatePaymentProcessing(paymentData: any): Promise<{
  success: boolean
  status?: 'completed' | 'pending' | 'failed'
  error?: string
  code?: string
  transactionId?: string
  processedAt?: Date
  notes?: string
}> {
  const { paymentMethod, amount } = paymentData

  // Simulate processing delay
  await new Promise(resolve => setTimeout(resolve, Math.random() * 2000 + 1000))

  switch (paymentMethod) {
    case 'credit_card':
    case 'debit_card':
      // Simulate card processing
      const cardProcessing = Math.random()
      if (cardProcessing < 0.05) { // 5% failure rate
        return {
          success: false,
          error: "Card declined",
          code: "CARD_DECLINED"
        }
      }
      if (cardProcessing < 0.02) { // 2% fraud detection
        return {
          success: false,
          error: "Transaction flagged for fraud review",
          code: "FRAUD_REVIEW"
        }
      }
      return {
        success: true,
        status: 'completed',
        transactionId: `CC_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        processedAt: new Date(),
        notes: 'Card payment processed successfully'
      }

    case 'insurance':
      // Insurance claims typically take longer to process
      return {
        success: true,
        status: 'pending',
        transactionId: `INS_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        processedAt: new Date(),
        notes: 'Insurance claim submitted for processing'
      }

    case 'cash':
      return {
        success: true,
        status: 'completed',
        transactionId: `CASH_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        processedAt: new Date(),
        notes: 'Cash payment received'
      }

    case 'check':
      return {
        success: true,
        status: 'pending',
        transactionId: `CHECK_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        processedAt: new Date(),
        notes: 'Check payment received - pending clearance'
      }

    default:
      return {
        success: false,
        error: "Unsupported payment method",
        code: "INVALID_METHOD"
      }
  }
}

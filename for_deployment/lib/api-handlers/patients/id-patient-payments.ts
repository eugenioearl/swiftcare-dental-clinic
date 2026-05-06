import { NextRequest, NextResponse } from 'next/server'
import { getServerAuth } from '@/lib/auth'
import { prisma, nextSequenceNumber } from '@/lib/db'

// GET /api/patients/[id]/patient-payments
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerAuth()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const payments = await prisma.patientPayment.findMany({
      where: { patientId: params.id },
      include: {
        package: { select: { id: true, packageNumber: true, title: true } },
        appointment: { select: { id: true, appointmentNumber: true } },
        receivedBy: { select: { id: true, firstName: true, lastName: true } }
      },
      orderBy: { createdAt: 'desc' }
    })

    // Summary
    const totalPaid = payments.filter(p => p.status === 'completed').reduce((s, p) => s + Number(p.amount), 0)
    const totalPending = payments.filter(p => p.status === 'pending').reduce((s, p) => s + Number(p.amount), 0)

    return NextResponse.json({ payments, summary: { totalPaid, totalPending } })
  } catch (error) {
    console.error('Error fetching payments:', error)
    return NextResponse.json({ error: 'Failed to fetch payments' }, { status: 500 })
  }
}

// POST /api/patients/[id]/patient-payments
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerAuth()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const { packageId, appointmentId, amount, paymentType, paymentMethod, description, notes } = body

    if (!amount || amount <= 0) return NextResponse.json({ error: 'Valid amount is required' }, { status: 400 })
    if (!paymentType) return NextResponse.json({ error: 'Payment type is required' }, { status: 400 })
    if (!paymentMethod) return NextResponse.json({ error: 'Payment method is required' }, { status: 400 })

    // Generate payment number (retry on collision)
    let payment: any = null
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const paymentNumber = await nextSequenceNumber('patient_payments', 'payment_number', 'PAY-', 5)
        payment = await prisma.patientPayment.create({
          data: {
            patientId: params.id,
            packageId: packageId || null,
            appointmentId: appointmentId || null,
            paymentNumber,
            amount: Number(amount),
            paymentType,
            paymentMethod,
            status: 'completed',
            description: description || null,
            notes: notes || null,
            receivedById: session.user.id,
            processedAt: new Date()
          },
          include: {
            package: { select: { id: true, packageNumber: true, title: true } },
            receivedBy: { select: { id: true, firstName: true, lastName: true } }
          }
        })
        break
      } catch (err: any) {
        if (err.code === 'P2002' && attempt < 2) continue
        throw err
      }
    }

    // If linked to a package, update its paid amount
    if (packageId) {
      const allPayments = await prisma.patientPayment.findMany({
        where: { packageId, status: 'completed' }
      })
      const totalPaid = allPayments.reduce((s, p) => s + Number(p.amount), 0)

      const pkg = await prisma.treatmentPackage.findUnique({ where: { id: packageId } })
      if (pkg) {
        await prisma.treatmentPackage.update({
          where: { id: packageId },
          data: {
            paidAmount: totalPaid,
            balanceDue: Math.max(0, Number(pkg.patientPayable) - totalPaid)
          }
        })
      }
    }

    return NextResponse.json({ payment }, { status: 201 })
  } catch (error) {
    console.error('Error recording payment:', error)
    return NextResponse.json({ error: 'Failed to record payment' }, { status: 500 })
  }
}

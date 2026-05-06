import { NextRequest, NextResponse } from 'next/server'
import { getServerAuth } from '@/lib/auth'
import { prisma, nextSequenceNumber } from '@/lib/db'
import { sendAdminNewAppointmentEmail } from '@/lib/email-notifications'

// GET /api/patients/[id]/chart-entries?chartType=general|ortho
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerAuth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const url = new URL(request.url)
    const chartType = url.searchParams.get('chartType') || 'general'

    const entries = await prisma.chartEntry.findMany({
      where: { patientId: params.id, chartType },
      orderBy: [{ visitDate: 'desc' }, { entryNumber: 'desc' }],
    })

    return NextResponse.json({ success: true, data: entries })
  } catch (error) {
    console.error('Error fetching chart entries:', error)
    return NextResponse.json({ error: 'Failed to fetch chart entries' }, { status: 500 })
  }
}

// POST /api/patients/[id]/chart-entries
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerAuth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const {
      chartType = 'general',
      visitDate,
      toothNumber, surface, diagnosis, procedureName, treatmentId,
      wire,
      notes,
      amountCharged = 0, amountPaid = 0,
      dentistId, dentistName,
      nextVisitDate, nextVisitNotes, autoCreateAppointment,
      deductFromPackage = false, packageId = null,
      packageDeductionAmount = 0,
      parentEntryId = null,
    } = body

    if (!visitDate) {
      return NextResponse.json({ error: 'Visit date is required' }, { status: 400 })
    }

    // If parentEntryId is provided, verify it exists and belongs to the same patient
    let parentEntry: any = null
    if (parentEntryId) {
      parentEntry = await prisma.chartEntry.findFirst({
        where: { id: parentEntryId, patientId: params.id },
      })
      if (!parentEntry) {
        return NextResponse.json({ error: 'Parent chart entry not found' }, { status: 404 })
      }
    }

    // Get next entry number
    const lastEntry = await prisma.chartEntry.findFirst({
      where: { patientId: params.id, chartType },
      orderBy: { entryNumber: 'desc' },
      select: { entryNumber: true },
    })
    const entryNumber = (lastEntry?.entryNumber || 0) + 1

    // Compute running balance for ortho
    let runningBalance = 0
    if (chartType === 'ortho') {
      const prevEntries = await prisma.chartEntry.findMany({
        where: { patientId: params.id, chartType: 'ortho' },
        select: { amountCharged: true, amountPaid: true },
      })
      const totalCharged = prevEntries.reduce((s, e) => s + Number(e.amountCharged), 0)
      const totalPaid = prevEntries.reduce((s, e) => s + Number(e.amountPaid), 0)
      runningBalance = (totalCharged + Number(amountCharged)) - (totalPaid + Number(amountPaid))
    }

    // 1. Create chart entry
    const entry = await prisma.chartEntry.create({
      data: {
        patientId: params.id,
        chartType,
        entryNumber,
        visitDate: new Date(visitDate),
        toothNumber: toothNumber || null,
        surface: surface || null,
        diagnosis: diagnosis || null,
        procedureName: procedureName || null,
        treatmentId: treatmentId || null,
        wire: wire || null,
        notes: notes || null,
        amountCharged: Number(amountCharged),
        amountPaid: Number(amountPaid),
        runningBalance,
        dentistId: dentistId || null,
        dentistName: dentistName || null,
        nextVisitDate: nextVisitDate ? new Date(nextVisitDate) : null,
        nextVisitNotes: nextVisitNotes || null,
        packageId: deductFromPackage && packageId ? packageId : null,
        deductedFromPackage: !!deductFromPackage && !!packageId,
        packageDeductionAmount: deductFromPackage && packageId ? Number(packageDeductionAmount) || 0 : 0,
        parentEntryId: parentEntryId || null,
        createdBy: session.user.id,
        status: 'signed',
      },
    })

    // 2. Sync: Create VisitRecord (for child add-ons, reuse parent's visitRecord)
    let visitRecordId: string | null = null
    if (parentEntry?.visitRecordId) {
      // Reuse parent's visit record — add-ons are same-visit
      visitRecordId = parentEntry.visitRecordId
    } else {
      try {
        const vr = await prisma.visitRecord.create({
          data: {
            patientId: params.id,
            visitDate: new Date(visitDate),
            appointmentType: chartType === 'ortho' ? 'Ortho Adjustment' : (procedureName || 'General Visit'),
            attendingDentist: dentistName || null,
            dentistId: dentistId || null,
            status: 'completed',
            chiefComplaint: diagnosis || null,
            diagnosis: diagnosis || null,
            treatmentDone: procedureName || null,
            followUpInstructions: nextVisitNotes || null,
            followUpDate: nextVisitDate ? new Date(nextVisitDate) : null,
            createdBy: session.user.id,
          },
        })
        visitRecordId = vr.id
      } catch (e) { console.error('Sync visit record error:', e) }
    }

    // 3. Sync: Create ProcedureRecord if there's a procedure
    let procedureRecordId: string | null = null
    if (procedureName) {
      try {
        const pr = await prisma.procedureRecord.create({
          data: {
            patientId: params.id,
            visitRecordId,
            procedureType: procedureName,
            procedureDate: new Date(visitDate),
            dentistName: dentistName || null,
            dentistId: dentistId || null,
            teethInvolved: toothNumber ? [toothNumber] : [],
            notesBefore: notes || null,
            followUpRecs: nextVisitNotes || null,
            status: 'completed',
            createdBy: session.user.id,
          },
        })
        procedureRecordId = pr.id
      } catch (e) { console.error('Sync procedure record error:', e) }
    }

    // 4. Sync: Create PatientPayment if amountPaid > 0
    let paymentId: string | null = null
    if (Number(amountPaid) > 0) {
      try {
        const paymentNumber = await nextSequenceNumber('patient_payments', 'payment_number', 'PAY-', 5)
        const isPackageDeduction = deductFromPackage && packageId
        const payment = await prisma.patientPayment.create({
          data: {
            patientId: params.id,
            packageId: isPackageDeduction ? packageId : null,
            paymentNumber,
            amount: Number(amountPaid),
            paymentType: isPackageDeduction ? 'package_installment' : 'visit_payment',
            paymentMethod: 'cash',
            status: 'completed',
            description: isPackageDeduction
              ? `Package deduction: ${procedureName || chartType} (Entry #${entryNumber})`
              : `Chart payment: ${procedureName || chartType} (Entry #${entryNumber})`,
            receivedById: session.user.id,
            processedAt: new Date(),
          },
        })
        paymentId = payment.id

        // Update package balances if deducting from package — use separate packageDeductionAmount
        if (isPackageDeduction) {
          const deductAmt = Math.max(0, Number(packageDeductionAmount) || 0)
          if (deductAmt > 0) {
            try {
              await prisma.treatmentPackage.update({
                where: { id: packageId },
                data: {
                  paidAmount: { increment: deductAmt },
                  balanceDue: { decrement: deductAmt },
                },
              })
            } catch (e) { console.error('Package balance update error:', e) }
          }
        }
      } catch (e) { console.error('Sync payment error:', e) }
    }

    // 5. Auto-create appointment if requested (skip for child add-ons)
    let autoAppointmentId: string | null = null
    if (autoCreateAppointment && nextVisitDate && !parentEntryId) {
      try {
        const appointmentNumber = await nextSequenceNumber('appointments', 'appointment_number', 'APT-', 5)
        const appt = await prisma.appointment.create({
          data: {
            appointmentNumber,
            patientId: params.id,
            dentistId: dentistId || null,
            scheduledDatetime: new Date(nextVisitDate),
            durationMinutes: 30,
            status: dentistId ? 'pending' : 'pending_assignment',
            appointmentType: chartType === 'ortho' ? 'follow_up' : 'follow_up',
            reasonForVisit: nextVisitNotes || `Follow-up: ${procedureName || chartType}`,
            notes: `Auto-created from ${chartType} chart entry #${entryNumber}`,
            source: 'chart_entry',
            createdBy: session.user.id,
          },
        })
        autoAppointmentId = appt.id

        // ─── Admin mailbox alert — chart-entry auto appointments, fail-safe ───
        try {
          const patientRec = await prisma.patient.findUnique({
            where: { id: params.id },
            include: { user: true },
          })
          const dentistRec = dentistId
            ? await prisma.dentist.findUnique({ where: { id: dentistId }, include: { user: true } })
            : null
          const userRole = session.user?.role || ''
          const source: 'walk_in' | 'patient_booking' | 'staff_booking' | 'admin_booking' | 'emergency' =
            ['admin', 'super_admin', 'manager'].includes(userRole) ? 'admin_booking' : 'staff_booking'
          const patientName =
            patientRec?.fullName ||
            (patientRec?.user
              ? `${patientRec.user.lastName || ''}, ${patientRec.user.firstName || ''}`.trim()
              : 'Patient')
          const dentistName = dentistRec?.user
            ? `${dentistRec.user.lastName || ''}, ${dentistRec.user.firstName || ''}`.trim()
            : undefined
          sendAdminNewAppointmentEmail({
            appointmentId: appt.id,
            appointmentNumber: appt.appointmentNumber,
            appointmentType: appt.appointmentType,
            scheduledDatetime: new Date(appt.scheduledDatetime),
            patientName,
            patientEmail: patientRec?.user?.email || (patientRec as any)?.emailDirect || undefined,
            patientPhone: (patientRec as any)?.mobileNumber || patientRec?.user?.phone || undefined,
            dentistName,
            notes: appt.notes || appt.reasonForVisit || undefined,
            status: appt.status,
            source,
          }).catch((err) => console.error('[chart-entry] Admin mailbox alert failed:', err))
        } catch (alertErr) {
          console.error('[chart-entry] Admin mailbox alert wrapper failed:', alertErr)
        }
      } catch (e) { console.error('Auto-appointment error:', e) }
    }

    // 6. Update chart entry with linked IDs
    await prisma.chartEntry.update({
      where: { id: entry.id },
      data: { visitRecordId, procedureRecordId, paymentId, autoAppointmentId },
    })

    return NextResponse.json({
      success: true,
      data: { ...entry, visitRecordId, procedureRecordId, paymentId, autoAppointmentId },
    }, { status: 201 })
  } catch (error) {
    console.error('Error creating chart entry:', error)
    return NextResponse.json({ error: 'Failed to create chart entry' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { getServerAuth } from '@/lib/auth'
import { prisma } from '@/lib/db'

// PATCH /api/patients/[id]/chart-entries/[entryId]
export async function PATCH(request: NextRequest, { params }: { params: { id: string; entryId: string } }) {
  try {
    const session = await getServerAuth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const entry = await prisma.chartEntry.findFirst({
      where: { id: params.entryId, patientId: params.id },
    })
    if (!entry) return NextResponse.json({ error: 'Entry not found' }, { status: 404 })

    const body = await request.json()
    const editorName = body.editedBy || (session as any)?.user?.name || 'Unknown'

    // Special case: Signature-only update (captured later by patient).
    // Accepts { patientSignature, signedByName? } and does NOT mark as amended,
    // does NOT add to edit history — just records the signature + timestamp.
    if (
      body.patientSignature !== undefined &&
      Object.keys(body).filter((k) => k !== 'patientSignature' && k !== 'signedByName' && k !== 'editedBy').length === 0
    ) {
      const sigUpdated = await prisma.chartEntry.update({
        where: { id: params.entryId },
        data: {
          patientSignature: body.patientSignature || null,
          signedByName: body.signedByName || null,
          signedAt: body.patientSignature ? new Date() : null,
        },
      })
      return NextResponse.json({ success: true, data: sigUpdated })
    }

    // Build before snapshot (only changed fields)
    const editableFields = [
      'toothNumber', 'surface', 'diagnosis', 'procedureName', 'wire',
      'notes', 'amountCharged', 'amountPaid', 'dentistName',
    ]
    const before: Record<string, any> = {}
    const after: Record<string, any> = {}
    const updateData: Record<string, any> = {}

    for (const field of editableFields) {
      if (body[field] !== undefined) {
        const oldVal = (entry as any)[field]
        const newVal = body[field]
        // Convert Decimal to number for comparison
        const oldStr = oldVal !== null && oldVal !== undefined ? String(oldVal) : ''
        const newStr = newVal !== null && newVal !== undefined ? String(newVal) : ''
        if (oldStr !== newStr) {
          before[field] = oldVal !== null && oldVal !== undefined ? (typeof oldVal === 'object' && 'toNumber' in oldVal ? Number(oldVal) : oldVal) : null
          after[field] = newVal
          if (field === 'amountCharged' || field === 'amountPaid') {
            updateData[field] = Number(newVal) || 0
          } else {
            updateData[field] = newVal || null
          }
        }
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ success: true, data: entry, message: 'No changes detected' })
    }

    // Append to edit history
    const existingHistory = Array.isArray(entry.editHistory) ? (entry.editHistory as any[]) : []
    const historyEntry = {
      editedBy: editorName,
      editedAt: new Date().toISOString(),
      before,
      after,
    }
    const newHistory = [...existingHistory, historyEntry]

    const updated = await prisma.chartEntry.update({
      where: { id: params.entryId },
      data: {
        ...updateData,
        lastEditedBy: editorName,
        editHistory: newHistory,
        status: 'amended',
      },
    })

    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    console.error('Error updating chart entry:', error)
    return NextResponse.json({ error: 'Failed to update chart entry' }, { status: 500 })
  }
}

// DELETE /api/patients/[id]/chart-entries/[entryId]
// Reverses all side effects created during POST:
//   1. Deletes linked PatientPayment (if any)
//   2. Restores package balances (paidAmount/balanceDue) if it was a package deduction
//   3. Cancels auto-created follow-up appointment (if still pending)
//   4. Removes the VisitRecord ONLY if no other chart entries reference it
//   5. Removes the ProcedureRecord ONLY if no other chart entries reference it
export async function DELETE(request: NextRequest, { params }: { params: { id: string; entryId: string } }) {
  try {
    const session = await getServerAuth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const entry = await prisma.chartEntry.findFirst({
      where: { id: params.entryId, patientId: params.id },
    })
    if (!entry) return NextResponse.json({ error: 'Entry not found' }, { status: 404 })

    // Capture IDs + amounts BEFORE delete (needed to reverse side effects)
    const linkedPaymentId = entry.paymentId
    const linkedVisitRecordId = entry.visitRecordId
    const linkedProcedureRecordId = entry.procedureRecordId
    const linkedAutoAppointmentId = entry.autoAppointmentId
    const wasPackageDeduction = !!entry.deductedFromPackage && !!entry.packageId
    const paidAmt = Number(entry.amountPaid || 0)
    const packageId = entry.packageId
    // Use packageDeductionAmount if set; fall back to paidAmt for legacy records
    const packageDeductAmt = Number((entry as any).packageDeductionAmount || 0) || paidAmt

    // Prevent deletion if this parent still has child add-ons (prevents orphaning/corrupted totals)
    const childCount = await prisma.chartEntry.count({ where: { parentEntryId: entry.id } })
    if (childCount > 0) {
      return NextResponse.json({
        error: `Cannot delete: this entry has ${childCount} add-on sub-procedure${childCount > 1 ? 's' : ''}. Delete the add-ons first.`,
      }, { status: 400 })
    }

    // Step 1: Delete the chart entry first (removes the chart-side reference)
    await prisma.chartEntry.delete({ where: { id: params.entryId } })

    // Step 2: Reverse package balance if it was a package deduction
    if (wasPackageDeduction && packageId && packageDeductAmt > 0) {
      try {
        await prisma.treatmentPackage.update({
          where: { id: packageId },
          data: {
            paidAmount: { decrement: packageDeductAmt },
            balanceDue: { increment: packageDeductAmt },
          },
        })
      } catch (e) { console.error('Reverse package balance error:', e) }
    }

    // Step 3: Delete linked PatientPayment
    if (linkedPaymentId) {
      try {
        await prisma.patientPayment.delete({ where: { id: linkedPaymentId } })
      } catch (e) { console.error('Delete linked payment error:', e) }
    }

    // Step 4: Cancel auto-created appointment if still pending
    if (linkedAutoAppointmentId) {
      try {
        const appt = await prisma.appointment.findUnique({ where: { id: linkedAutoAppointmentId } })
        if (appt && ['pending', 'pending_assignment', 'confirmed'].includes(appt.status)) {
          await prisma.appointment.update({
            where: { id: linkedAutoAppointmentId },
            data: { status: 'cancelled', cancellationReason: 'Chart entry deleted' },
          })
        }
      } catch (e) { console.error('Cancel auto-appointment error:', e) }
    }

    // Step 5: Remove ProcedureRecord if nothing else references it
    if (linkedProcedureRecordId) {
      try {
        const refCount = await prisma.chartEntry.count({ where: { procedureRecordId: linkedProcedureRecordId } })
        if (refCount === 0) {
          await prisma.procedureRecord.delete({ where: { id: linkedProcedureRecordId } }).catch(() => {})
        }
      } catch (e) { console.error('Cleanup procedure record error:', e) }
    }

    // Step 6: Remove VisitRecord if nothing else references it (and no child entries share it)
    if (linkedVisitRecordId) {
      try {
        const refCount = await prisma.chartEntry.count({ where: { visitRecordId: linkedVisitRecordId } })
        if (refCount === 0) {
          // Also ensure no ProcedureRecord still references this visit
          const procRefCount = await prisma.procedureRecord.count({ where: { visitRecordId: linkedVisitRecordId } })
          if (procRefCount === 0) {
            await prisma.visitRecord.delete({ where: { id: linkedVisitRecordId } }).catch(() => {})
          }
        }
      } catch (e) { console.error('Cleanup visit record error:', e) }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting chart entry:', error)
    return NextResponse.json({ error: 'Failed to delete chart entry' }, { status: 500 })
  }
}

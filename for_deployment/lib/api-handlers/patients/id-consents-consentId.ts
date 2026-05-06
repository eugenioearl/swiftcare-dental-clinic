import { NextRequest, NextResponse } from 'next/server'
import { getServerAuth, isAdminRole } from '@/lib/auth'
import { prisma } from '@/lib/db'

// GET single consent
export async function GET(request: NextRequest, { params }: { params: { id: string; consentId: string } }) {
  try {
    const session = await getServerAuth()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const consent = await prisma.consentForm.findUnique({
      where: { id: params.consentId },
      include: {
        package: { select: { id: true, packageNumber: true, title: true } },
        preparedBy: { select: { id: true, firstName: true, lastName: true } },
        witness: { select: { id: true, firstName: true, lastName: true } },
        patient: { select: { id: true, fullName: true, patientNumber: true } }
      }
    })

    if (!consent || consent.patientId !== params.id) {
      return NextResponse.json({ error: 'Consent not found' }, { status: 404 })
    }

    return NextResponse.json({ consent })
  } catch (error) {
    console.error('Error fetching consent:', error)
    return NextResponse.json({ error: 'Failed to fetch consent' }, { status: 500 })
  }
}

// PATCH - Update consent (status, witness signature, etc.)
export async function PATCH(request: NextRequest, { params }: { params: { id: string; consentId: string } }) {
  try {
    const session = await getServerAuth()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const existing = await prisma.consentForm.findUnique({ where: { id: params.consentId } })
    if (!existing || existing.patientId !== params.id) {
      return NextResponse.json({ error: 'Consent not found' }, { status: 404 })
    }

    const data: any = {}

    // Status changes
    if (body.status) {
      data.status = body.status
      if (body.status === 'sent') data.sentAt = new Date()
    }

    // Witness signature (staff signs as witness)
    if (body.witnessSignature) {
      data.witnessSignature = body.witnessSignature
      data.witnessSignedAt = new Date()
      data.witnessId = session.user.id

      // If patient already signed, mark as fully signed
      if (existing.patientSignature) {
        data.status = 'signed'
      }
    }

    // Form content update
    if (body.formContent !== undefined) data.formContent = body.formContent
    if (body.title !== undefined) data.title = body.title
    if (body.notes !== undefined) data.notes = body.notes

    const consent = await prisma.consentForm.update({
      where: { id: params.consentId },
      data,
      include: {
        package: { select: { id: true, packageNumber: true, title: true } },
        preparedBy: { select: { id: true, firstName: true, lastName: true } },
        witness: { select: { id: true, firstName: true, lastName: true } }
      }
    })

    return NextResponse.json({ consent })
  } catch (error) {
    console.error('Error updating consent:', error)
    return NextResponse.json({ error: 'Failed to update consent' }, { status: 500 })
  }
}

// DELETE - Admin/super_admin override to delete a patient consent form
export async function DELETE(request: NextRequest, { params }: { params: { id: string; consentId: string } }) {
  try {
    const session = await getServerAuth()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const role = session.user.role || ''
    if (!isAdminRole(role)) {
      return NextResponse.json({ error: 'Only administrators can delete consent forms' }, { status: 403 })
    }

    const existing = await prisma.consentForm.findUnique({ where: { id: params.consentId } })
    if (!existing || existing.patientId !== params.id) {
      return NextResponse.json({ error: 'Consent not found' }, { status: 404 })
    }

    await prisma.consentForm.delete({ where: { id: params.consentId } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting consent:', error)
    return NextResponse.json({ error: 'Failed to delete consent' }, { status: 500 })
  }
}

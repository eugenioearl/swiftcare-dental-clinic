import { NextRequest, NextResponse } from 'next/server'
import { getServerAuth, isAdminRole } from '@/lib/auth'
import { prisma } from '@/lib/db'

// GET single package
export async function GET(request: NextRequest, { params }: { params: { id: string; packageId: string } }) {
  try {
    const session = await getServerAuth()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const pkg = await prisma.treatmentPackage.findUnique({
      where: { id: params.packageId },
      include: {
        items: { include: { treatment: true, appointment: true }, orderBy: { sortOrder: 'asc' } },
        payments: { orderBy: { createdAt: 'desc' } },
        createdBy: { select: { id: true, firstName: true, lastName: true } }
      }
    })

    if (!pkg || pkg.patientId !== params.id) {
      return NextResponse.json({ error: 'Package not found' }, { status: 404 })
    }

    return NextResponse.json({ package: pkg })
  } catch (error) {
    console.error('Error fetching package:', error)
    return NextResponse.json({ error: 'Failed to fetch package' }, { status: 500 })
  }
}

// PATCH update package
export async function PATCH(request: NextRequest, { params }: { params: { id: string; packageId: string } }) {
  try {
    const session = await getServerAuth()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const { title, description, notes, status, startDate, expectedEndDate } = body

    const existing = await prisma.treatmentPackage.findUnique({ where: { id: params.packageId } })
    if (!existing || existing.patientId !== params.id) {
      return NextResponse.json({ error: 'Package not found' }, { status: 404 })
    }

    const updateData: any = {}
    if (title !== undefined) updateData.title = title
    if (description !== undefined) updateData.description = description
    if (notes !== undefined) updateData.notes = notes
    if (startDate !== undefined) updateData.startDate = startDate ? new Date(startDate) : null
    if (expectedEndDate !== undefined) updateData.expectedEndDate = expectedEndDate ? new Date(expectedEndDate) : null

    if (status) {
      updateData.status = status
      if (status === 'completed') {
        updateData.completedDate = new Date()
      } else if (existing.status === 'completed') {
        // Reopening a completed package - clear the completed date
        updateData.completedDate = null
      }
    }

    const pkg = await prisma.treatmentPackage.update({
      where: { id: params.packageId },
      data: updateData,
      include: {
        items: { include: { treatment: true }, orderBy: { sortOrder: 'asc' } },
        payments: { orderBy: { createdAt: 'desc' } },
        createdBy: { select: { id: true, firstName: true, lastName: true } }
      }
    })

    return NextResponse.json({ package: pkg })
  } catch (error) {
    console.error('Error updating package:', error)
    return NextResponse.json({ error: 'Failed to update package' }, { status: 500 })
  }
}

// DELETE package - admins/super_admins can delete any status, others only drafts
export async function DELETE(request: NextRequest, { params }: { params: { id: string; packageId: string } }) {
  try {
    const session = await getServerAuth()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const existing = await prisma.treatmentPackage.findUnique({ where: { id: params.packageId } })
    if (!existing || existing.patientId !== params.id) {
      return NextResponse.json({ error: 'Package not found' }, { status: 404 })
    }

    const role = session.user.role || ''
    const isAdmin = isAdminRole(role)

    // Non-admins can only delete drafts. Admins/super_admins can override and delete any status.
    if (!isAdmin && existing.status !== 'draft') {
      return NextResponse.json({ error: 'Only draft packages can be deleted' }, { status: 400 })
    }

    await prisma.treatmentPackage.delete({ where: { id: params.packageId } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting package:', error)
    return NextResponse.json({ error: 'Failed to delete package' }, { status: 500 })
  }
}

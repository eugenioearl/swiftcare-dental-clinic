import { NextRequest, NextResponse } from 'next/server'
import { getServerAuth } from '@/lib/auth'
import { prisma } from '@/lib/db'

// POST - Add item to package
export async function POST(request: NextRequest, { params }: { params: { id: string; packageId: string } }) {
  try {
    const session = await getServerAuth()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const pkg = await prisma.treatmentPackage.findUnique({ where: { id: params.packageId } })
    if (!pkg || pkg.patientId !== params.id) {
      return NextResponse.json({ error: 'Package not found' }, { status: 404 })
    }

    const body = await request.json()
    const { treatmentId, procedureName, toothNumber, surface, quantity, unitCost, adjustedCost, coverageType, coveredAmount, notes } = body

    if (!procedureName) return NextResponse.json({ error: 'Procedure name is required' }, { status: 400 })

    const itemCount = await prisma.packageItem.count({ where: { packageId: params.packageId } })
    const qty = quantity || 1
    const cost = Number(adjustedCost || unitCost || 0) * qty
    const covered = Number(coveredAmount || 0)

    const item = await prisma.packageItem.create({
      data: {
        packageId: params.packageId,
        treatmentId: treatmentId || null,
        procedureName,
        toothNumber: toothNumber || null,
        surface: surface || null,
        quantity: qty,
        unitCost: Number(unitCost || 0),
        adjustedCost: cost,
        coverageType: coverageType || 'not_covered',
        coveredAmount: covered,
        patientCost: Math.max(0, cost - covered),
        sortOrder: itemCount,
        notes: notes || null
      },
      include: { treatment: true }
    })

    // Recalculate package totals
    await recalcPackageTotals(params.packageId)

    return NextResponse.json({ item }, { status: 201 })
  } catch (error) {
    console.error('Error adding item:', error)
    return NextResponse.json({ error: 'Failed to add item' }, { status: 500 })
  }
}

// PATCH - Update item
export async function PATCH(request: NextRequest, { params }: { params: { id: string; packageId: string } }) {
  try {
    const session = await getServerAuth()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const { itemId, ...updateFields } = body

    if (!itemId) return NextResponse.json({ error: 'Item ID is required' }, { status: 400 })

    const existing = await prisma.packageItem.findUnique({ where: { id: itemId } })
    if (!existing || existing.packageId !== params.packageId) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    }

    const data: any = {}
    if (updateFields.procedureName !== undefined) data.procedureName = updateFields.procedureName
    if (updateFields.toothNumber !== undefined) data.toothNumber = updateFields.toothNumber
    if (updateFields.surface !== undefined) data.surface = updateFields.surface
    if (updateFields.quantity !== undefined) data.quantity = updateFields.quantity
    if (updateFields.unitCost !== undefined) data.unitCost = Number(updateFields.unitCost)
    if (updateFields.notes !== undefined) data.notes = updateFields.notes
    if (updateFields.status !== undefined) {
      data.status = updateFields.status
      if (updateFields.status === 'completed') {
        data.completedDate = new Date()
      } else if (existing.status === 'completed') {
        // Reverting an item from completed - clear completed date
        data.completedDate = null
      }
    }
    if (updateFields.coverageType !== undefined) data.coverageType = updateFields.coverageType
    if (updateFields.coveredAmount !== undefined) data.coveredAmount = Number(updateFields.coveredAmount)

    // Recalc adjusted cost and patient cost
    const qty = data.quantity ?? existing.quantity
    const uc = data.unitCost ?? Number(existing.unitCost)
    data.adjustedCost = uc * qty
    const covered = data.coveredAmount ?? Number(existing.coveredAmount)
    data.patientCost = Math.max(0, data.adjustedCost - covered)

    const item = await prisma.packageItem.update({
      where: { id: itemId },
      data,
      include: { treatment: true }
    })

    await recalcPackageTotals(params.packageId)
    return NextResponse.json({ item })
  } catch (error) {
    console.error('Error updating item:', error)
    return NextResponse.json({ error: 'Failed to update item' }, { status: 500 })
  }
}

// DELETE - Remove item
export async function DELETE(request: NextRequest, { params }: { params: { id: string; packageId: string } }) {
  try {
    const session = await getServerAuth()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { itemId } = await request.json()
    if (!itemId) return NextResponse.json({ error: 'Item ID is required' }, { status: 400 })

    const existing = await prisma.packageItem.findUnique({ where: { id: itemId } })
    if (!existing || existing.packageId !== params.packageId) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    }

    await prisma.packageItem.delete({ where: { id: itemId } })
    await recalcPackageTotals(params.packageId)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error removing item:', error)
    return NextResponse.json({ error: 'Failed to remove item' }, { status: 500 })
  }
}

async function recalcPackageTotals(packageId: string) {
  const items = await prisma.packageItem.findMany({ where: { packageId } })
  const totalAmount = items.reduce((sum, i) => sum + Number(i.adjustedCost), 0)
  const coveredAmount = items.reduce((sum, i) => sum + Number(i.coveredAmount), 0)
  const patientPayable = Math.max(0, totalAmount - coveredAmount)

  const pkg = await prisma.treatmentPackage.findUnique({ where: { id: packageId } })
  const paidAmount = Number(pkg?.paidAmount || 0)

  await prisma.treatmentPackage.update({
    where: { id: packageId },
    data: {
      totalAmount,
      coveredAmount,
      patientPayable,
      balanceDue: Math.max(0, patientPayable - paidAmount)
    }
  })
}

import { NextRequest, NextResponse } from 'next/server'
import { getServerAuth } from '@/lib/auth'
import { prisma, nextSequenceNumber } from '@/lib/db'

// POST - Create a revised version of a signed package
export async function POST(request: NextRequest, { params }: { params: { id: string; packageId: string } }) {
  try {
    const session = await getServerAuth()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const original = await prisma.treatmentPackage.findUnique({
      where: { id: params.packageId },
      include: { items: { orderBy: { sortOrder: 'asc' } } }
    })

    if (!original || original.patientId !== params.id) {
      return NextResponse.json({ error: 'Package not found' }, { status: 404 })
    }

    if (!original.isSigned) {
      return NextResponse.json({ error: 'Only signed packages need revision. Edit the package directly.' }, { status: 400 })
    }

    // Cancel the original
    await prisma.treatmentPackage.update({
      where: { id: original.id },
      data: { status: 'cancelled', notes: (original.notes || '') + '\n[Superseded by revision]' }
    })

    // Create new package as revision
    const newPkgNumber = await nextSequenceNumber('treatment_packages', 'package_number', 'PKG-', 5)

    const revised = await prisma.treatmentPackage.create({
      data: {
        patientId: params.id,
        packageNumber: newPkgNumber,
        title: `${original.title} (Rev ${original.revisionNumber + 1})`,
        description: original.description,
        status: 'draft',
        totalAmount: original.totalAmount,
        coveredAmount: original.coveredAmount,
        patientPayable: original.patientPayable,
        paidAmount: 0,
        balanceDue: original.patientPayable,
        createdById: session.user.id,
        notes: `Revised from ${original.packageNumber}`,
        coverageActivation: original.coverageActivation as string,
        revisedFromId: original.id,
        revisionNumber: original.revisionNumber + 1,
        items: {
          create: original.items.map(item => ({
            treatmentId: item.treatmentId,
            procedureName: item.procedureName,
            toothNumber: item.toothNumber,
            surface: item.surface,
            quantity: item.quantity,
            unitCost: item.unitCost,
            adjustedCost: item.adjustedCost,
            coverageType: item.coverageType,
            coveredAmount: item.coveredAmount,
            patientCost: item.patientCost,
            status: 'pending',
            sortOrder: item.sortOrder,
            notes: item.notes
          }))
        }
      },
      include: {
        items: { include: { treatment: true }, orderBy: { sortOrder: 'asc' } }
      }
    })

    return NextResponse.json({ revised, originalCancelled: true }, { status: 201 })
  } catch (error) {
    console.error('Error creating revision:', error)
    return NextResponse.json({ error: 'Failed to create revision' }, { status: 500 })
  }
}

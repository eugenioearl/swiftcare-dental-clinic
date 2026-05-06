import { NextRequest, NextResponse } from 'next/server'
import { getServerAuth } from '@/lib/auth'
import { prisma, nextSequenceNumber } from '@/lib/db'

// GET /api/patients/[id]/packages - List patient packages
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerAuth()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = params
    const searchParams = request.nextUrl.searchParams
    const status = searchParams.get('status')

    const where: any = { patientId: id }
    if (status) where.status = status

    const packages = await prisma.treatmentPackage.findMany({
      where,
      include: {
        items: {
          include: { treatment: true },
          orderBy: { sortOrder: 'asc' }
        },
        payments: { orderBy: { createdAt: 'desc' } },
        createdBy: { select: { id: true, firstName: true, lastName: true } }
      },
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json({ packages })
  } catch (error) {
    console.error('Error fetching packages:', error)
    return NextResponse.json({ error: 'Failed to fetch packages' }, { status: 500 })
  }
}

// POST /api/patients/[id]/packages - Create a new package
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerAuth()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = params
    const body = await request.json()
    let { title, description, notes, items, startDate, expectedEndDate, coverageActivation, serviceId, packageTemplateId } = body

    // Track which package template (if any) this package was seeded from
    let sourcePackageTemplateId: string | null = null

    // ---- Direct package template seeding ----
    if (packageTemplateId && (!Array.isArray(items) || items.length === 0)) {
      const tmpl: any = await prisma.packageTemplate.findFirst({
        where: { id: packageTemplateId, isActive: true },
        include: { procedures: { include: { treatment: true }, orderBy: { sortOrder: 'asc' } } },
      })
      if (tmpl) {
        sourcePackageTemplateId = tmpl.id
        if (!title) title = tmpl.name
        if (!description) description = tmpl.description || null
        items = tmpl.procedures.map((p: any) => ({
          treatmentId: p.treatmentId || null,
          procedureName: p.treatment?.name || 'Procedure',
          quantity: 1,
          unitCost: Number(p.overridePrice ?? p.treatment?.baseCost ?? 0),
          coverageType: 'not_covered',
          coveredAmount: 0,
        }))
      }
    }

    // ---- Service-based seeding ----
    // If a serviceId is provided and no items, hydrate the package from the
    // service's linkedTreatmentIds or linkedPackageTemplateIds.
    if (serviceId && (!Array.isArray(items) || items.length === 0)) {
      const svc: any = await prisma.clinicService.findUnique({ where: { id: serviceId } })
      if (!svc || !svc.isActive) {
        return NextResponse.json({ error: 'Service not found or inactive' }, { status: 400 })
      }
      if (!title) title = svc.displayName || svc.name
      if (!description) description = svc.description || null

      // Prefer package template if linked
      if (Array.isArray(svc.linkedPackageTemplateIds) && svc.linkedPackageTemplateIds.length > 0) {
        const tmpl: any = await prisma.packageTemplate.findFirst({
          where: { id: { in: svc.linkedPackageTemplateIds }, isActive: true },
          include: { procedures: { include: { treatment: true }, orderBy: { sortOrder: 'asc' } } },
        })
        if (tmpl) {
          sourcePackageTemplateId = tmpl.id
          items = tmpl.procedures.map((p: any) => ({
            treatmentId: p.treatmentId || null,
            procedureName: p.treatment?.name || 'Procedure',
            quantity: 1,
            unitCost: Number(p.overridePrice ?? p.treatment?.baseCost ?? 0),
            coverageType: 'not_covered',
            coveredAmount: 0,
          }))
        }
      }
      // Fallback: seed from linkedTreatmentIds
      if ((!items || items.length === 0) && Array.isArray(svc.linkedTreatmentIds) && svc.linkedTreatmentIds.length > 0) {
        const treatments = await prisma.treatment.findMany({
          where: { id: { in: svc.linkedTreatmentIds } },
          select: { id: true, name: true, baseCost: true },
        })
        items = treatments.map((t) => ({
          treatmentId: t.id,
          procedureName: t.name,
          quantity: 1,
          unitCost: Number(t.baseCost || 0),
          coverageType: 'not_covered',
          coveredAmount: 0,
        }))
      }
    }

    if (!title) return NextResponse.json({ error: 'Title is required' }, { status: 400 })

    // Generate package number via SQL MAX (robust against deletions)
    const packageNumber = await nextSequenceNumber('treatment_packages', 'package_number', 'PKG-', 5)

    // Calculate totals
    let totalAmount = 0
    let coveredAmount = 0
    const processedItems = (items || []).map((item: any, idx: number) => {
      const adjustedCost = Number(item.adjustedCost || item.unitCost || 0) * (item.quantity || 1)
      const covered = Number(item.coveredAmount || 0)
      totalAmount += adjustedCost
      coveredAmount += covered
      return {
        treatmentId: item.treatmentId || null,
        procedureName: item.procedureName,
        toothNumber: item.toothNumber || null,
        surface: item.surface || null,
        quantity: item.quantity || 1,
        unitCost: Number(item.unitCost || 0),
        adjustedCost: adjustedCost,
        coverageType: item.coverageType || 'not_covered',
        coveredAmount: covered,
        patientCost: Math.max(0, adjustedCost - covered),
        sortOrder: idx,
        notes: item.notes || null
      }
    })

    const patientPayable = Math.max(0, totalAmount - coveredAmount)

    // Retry up to 3 times in case of race condition on package_number
    let pkg: any = null
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const pkgNum = attempt === 0 ? packageNumber : await nextSequenceNumber('treatment_packages', 'package_number', 'PKG-', 5)
        pkg = await prisma.treatmentPackage.create({
          data: {
            patientId: id,
            packageNumber: pkgNum,
            title,
            description: description || null,
            notes: notes || null,
            coverageActivation: coverageActivation || 'on_signature',
            totalAmount,
            coveredAmount,
            patientPayable,
            balanceDue: patientPayable,
            paidAmount: 0,
            createdById: session.user.id,
            startDate: startDate ? new Date(startDate) : null,
            expectedEndDate: expectedEndDate ? new Date(expectedEndDate) : null,
            sourcePackageTemplateId,
            items: { create: processedItems }
          },
          include: {
            items: { include: { treatment: true }, orderBy: { sortOrder: 'asc' } },
            payments: true,
            createdBy: { select: { id: true, firstName: true, lastName: true } }
          }
        })
        break
      } catch (createErr: any) {
        if (createErr?.code === 'P2002' && attempt < 2) continue
        throw createErr
      }
    }

    return NextResponse.json({ package: pkg }, { status: 201 })
  } catch (error) {
    console.error('Error creating package:', error)
    return NextResponse.json({ error: 'Failed to create package' }, { status: 500 })
  }
}

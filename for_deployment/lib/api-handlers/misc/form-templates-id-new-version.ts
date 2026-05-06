import { NextRequest, NextResponse } from "next/server"
import { getServerAuth } from "@/lib/auth"
import { prisma } from "@/lib/db"

function canManage(role: string) {
  return ['admin', 'super_admin'].includes(role)
}

// POST /api/form-templates/[id]/new-version
// Creates a new draft version of this template, copying all fields & settings.
// The new draft does NOT auto-promote; admin must promote it (change status to 'active').
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerAuth()
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (!canManage(session.user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const source = await prisma.formTemplate.findUnique({ where: { id: params.id } })
    if (!source) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const familyKey = source.familyKey || source.key

    // Find the max version in this family so we can increment
    const maxVer = await prisma.formTemplate.findFirst({
      where: { familyKey },
      orderBy: { version: 'desc' },
      select: { version: true },
    })
    const newVersion = (maxVer?.version || 0) + 1
    const newKey = `${familyKey}-v${newVersion}`

    const draft = await prisma.formTemplate.create({
      data: {
        key: newKey,
        familyKey,
        title: source.title,
        description: source.description,
        category: source.category,
        fields: source.fields as any,
        requiredForAppointmentTypes: source.requiredForAppointmentTypes as any,
        requiredForTreatmentIds: source.requiredForTreatmentIds as any,
        requiredForTreatmentCategories: source.requiredForTreatmentCategories as any,
        requiredForServiceIds: source.requiredForServiceIds as any,
        requiredForPackageTemplateIds: (source as any).requiredForPackageTemplateIds ?? null,
        requirementStages: (source.requirementStages as any) || [],
        requiredAlways: source.requiredAlways,
        // New version starts as draft - isActive=false until promoted
        status: 'draft',
        isActive: false,
        displayOrder: source.displayOrder,
        isSystem: false, // derived drafts are never system templates
        version: newVersion,
        effectiveDate: null,
        supersedesId: source.id,
        minorOnly: source.minorOnly,
        adultOnly: source.adultOnly,
        requiresGuardian: source.requiresGuardian,
      }
    })

    await prisma.auditLog.create({
      data: {
        userId: (session.user as any).id,
        action: 'create',
        entityType: 'FormTemplate',
        entityId: draft.id,
        category: 'ADMINISTRATIVE',
        description: `Created draft v${newVersion} of form template "${source.title}" (family: ${familyKey})`,
        newValues: { familyKey, version: newVersion, supersedesId: source.id } as any,
      },
    }).catch(() => null)

    return NextResponse.json({ template: draft }, { status: 201 })
  } catch (error: any) {
    console.error('[form-templates new-version POST]', error)
    return NextResponse.json({ error: error.message || "Failed to create new version" }, { status: 500 })
  }
}

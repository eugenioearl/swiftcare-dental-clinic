import { NextRequest, NextResponse } from "next/server"
import { getServerAuth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { z } from "zod"

const formFieldSchema = z.object({
  id: z.string(),
  type: z.enum(['text', 'textarea', 'select', 'checkbox', 'radio', 'date', 'signature', 'number', 'email', 'tel', 'medical_checklist']),
  label: z.string(),
  required: z.boolean().default(false),
  options: z.array(z.string()).optional(),
  placeholder: z.string().optional(),
  helpText: z.string().optional(),
  patientField: z.string().optional(),
  checklistItems: z.array(z.string()).optional(),
})

const requirementStageEnum = z.enum(['check_in', 'before_procedure', 'before_payment', 'discharge'])

const updateTemplateSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  category: z.string().min(1).optional(),
  fields: z.array(formFieldSchema).optional(),
  requiredForAppointmentTypes: z.array(z.string()).nullable().optional(),
  requiredForTreatmentIds: z.array(z.string()).nullable().optional(),
  requiredForTreatmentCategories: z.array(z.string()).nullable().optional(),
  requiredForServiceIds: z.array(z.string()).nullable().optional(),
  requiredForPackageTemplateIds: z.array(z.string()).nullable().optional(),
  requirementStages: z.array(requirementStageEnum).optional(),
  requiredAlways: z.boolean().optional(),
  isActive: z.boolean().optional(),
  displayOrder: z.number().optional(),
  minorOnly: z.boolean().optional(),
  adultOnly: z.boolean().optional(),
  requiresGuardian: z.boolean().optional(),
  effectiveDate: z.string().optional(),
  status: z.enum(['draft', 'active', 'inactive', 'archived']).optional(),
})

function canManage(role: string) {
  return ['admin', 'super_admin'].includes(role)
}

// GET /api/form-templates/[id]
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerAuth()
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const template = await prisma.formTemplate.findUnique({
      where: { id: params.id },
      include: {
        supersedes: {
          select: { id: true, version: true, key: true, title: true, status: true, createdAt: true }
        },
      }
    })
    if (!template) return NextResponse.json({ error: "Not found" }, { status: 404 })

    // Also include all versions in the same family
    const familyVersions = await prisma.formTemplate.findMany({
      where: { familyKey: template.familyKey || template.key },
      orderBy: { version: 'desc' },
      select: {
        id: true, key: true, title: true, version: true, status: true,
        effectiveDate: true, createdAt: true, updatedAt: true, isSystem: true,
      }
    })

    return NextResponse.json({ template, familyVersions })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed" }, { status: 500 })
  }
}

// PUT /api/form-templates/[id]
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerAuth()
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (!canManage(session.user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const existing = await prisma.formTemplate.findUnique({ where: { id: params.id } })
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const body = await request.json()
    const parsed = updateTemplateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid data", details: parsed.error.flatten() }, { status: 400 })
    }
    const data = parsed.data

    // If setting status to 'active', archive any other version currently active in the same family
    const promotingToActive = data.status === 'active' && existing.status !== 'active'
    const familyKey = existing.familyKey || existing.key

    const updated = await prisma.$transaction(async (tx) => {
      if (promotingToActive) {
        await tx.formTemplate.updateMany({
          where: {
            familyKey,
            NOT: { id: params.id },
            status: 'active',
          },
          data: { status: 'archived', isActive: false }
        })
      }

      return await tx.formTemplate.update({
        where: { id: params.id },
        data: {
          ...(data.title !== undefined && { title: data.title }),
          ...(data.description !== undefined && { description: data.description || null }),
          ...(data.category !== undefined && { category: data.category }),
          ...(data.fields !== undefined && { fields: data.fields as any }),
          ...(data.requiredForAppointmentTypes !== undefined && { requiredForAppointmentTypes: data.requiredForAppointmentTypes as any }),
          ...(data.requiredForTreatmentIds !== undefined && { requiredForTreatmentIds: data.requiredForTreatmentIds as any }),
          ...(data.requiredForTreatmentCategories !== undefined && { requiredForTreatmentCategories: data.requiredForTreatmentCategories as any }),
          ...(data.requiredForServiceIds !== undefined && { requiredForServiceIds: data.requiredForServiceIds as any }),
          ...(data.requiredForPackageTemplateIds !== undefined && { requiredForPackageTemplateIds: data.requiredForPackageTemplateIds as any }),
          ...(data.requirementStages !== undefined && { requirementStages: data.requirementStages as any }),
          ...(data.requiredAlways !== undefined && { requiredAlways: data.requiredAlways }),
          ...(data.isActive !== undefined && { isActive: data.isActive }),
          ...(data.displayOrder !== undefined && { displayOrder: data.displayOrder }),
          ...(data.minorOnly !== undefined && { minorOnly: data.minorOnly }),
          ...(data.adultOnly !== undefined && { adultOnly: data.adultOnly }),
          ...(data.requiresGuardian !== undefined && { requiresGuardian: data.requiresGuardian }),
          ...(data.effectiveDate !== undefined && { effectiveDate: new Date(data.effectiveDate) }),
          ...(data.status !== undefined && {
            status: data.status,
            // Keep isActive in sync with status for backwards compatibility
            isActive: data.status === 'active',
          }),
          ...(promotingToActive && !data.effectiveDate && { effectiveDate: new Date() }),
        }
      })
    })

    await prisma.auditLog.create({
      data: {
        userId: (session.user as any).id,
        action: 'update',
        entityType: 'FormTemplate',
        entityId: params.id,
        category: 'ADMINISTRATIVE',
        description: promotingToActive
          ? `Promoted form template "${existing.title}" v${existing.version} to active`
          : `Updated form template "${existing.title}"`,
        oldValues: { status: existing.status, isActive: existing.isActive } as any,
        newValues: data as any,
      },
    }).catch(() => null)

    return NextResponse.json({ template: updated })
  } catch (error: any) {
    console.error('[form-templates PUT]', error)
    return NextResponse.json({ error: error.message || "Failed to update" }, { status: 500 })
  }
}

// DELETE /api/form-templates/[id] - admin only, blocks system templates
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerAuth()
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (!canManage(session.user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const existing = await prisma.formTemplate.findUnique({ where: { id: params.id } })
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 })

    // For system templates, always archive (never hard delete) to preserve audit/integrity
    if (existing.isSystem) {
      await prisma.formTemplate.update({
        where: { id: params.id },
        data: { status: 'archived', isActive: false }
      })
      await prisma.auditLog.create({
        data: {
          userId: (session.user as any).id,
          action: 'update',
          entityType: 'FormTemplate',
          entityId: params.id,
          category: 'ADMINISTRATIVE',
          description: `Archived system form template "${existing.title}" v${existing.version}`,
        },
      }).catch(() => null)
      return NextResponse.json({ success: true, archived: true, isSystem: true })
    }

    // Instead of hard delete for versioned templates, archive it to preserve history
    // Only hard delete if it's the only version in the family
    const familyKey = existing.familyKey || existing.key
    const familyCount = await prisma.formTemplate.count({ where: { familyKey } })

    if (familyCount > 1) {
      await prisma.formTemplate.update({
        where: { id: params.id },
        data: { status: 'archived', isActive: false }
      })
      await prisma.auditLog.create({
        data: {
          userId: (session.user as any).id,
          action: 'update',
          entityType: 'FormTemplate',
          entityId: params.id,
          category: 'ADMINISTRATIVE',
          description: `Archived form template "${existing.title}" v${existing.version}`,
        },
      }).catch(() => null)
      return NextResponse.json({ success: true, archived: true })
    }

    await prisma.formTemplate.delete({ where: { id: params.id } })
    await prisma.auditLog.create({
      data: {
        userId: (session.user as any).id,
        action: 'delete',
        entityType: 'FormTemplate',
        entityId: params.id,
        category: 'ADMINISTRATIVE',
        description: `Deleted form template "${existing.title}" (no other versions)`,
      },
    }).catch(() => null)
    return NextResponse.json({ success: true, archived: false })
  } catch (error: any) {
    console.error('[form-templates DELETE]', error)
    return NextResponse.json({ error: error.message || "Failed to delete" }, { status: 500 })
  }
}

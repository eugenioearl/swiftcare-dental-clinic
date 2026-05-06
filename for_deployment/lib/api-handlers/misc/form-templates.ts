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
  patientField: z.string().optional(),  // maps to Patient model field for sync
  checklistItems: z.array(z.string()).optional(),  // for medical_checklist field type
})

const requirementStageEnum = z.enum(['check_in', 'before_procedure', 'before_payment', 'discharge'])

const createTemplateSchema = z.object({
  key: z.string().optional(),
  familyKey: z.string().optional(),
  title: z.string().min(1),
  description: z.string().optional(),
  category: z.string().min(1),
  fields: z.array(formFieldSchema),
  requiredForAppointmentTypes: z.array(z.string()).nullable().optional(),
  requiredForTreatmentIds: z.array(z.string()).nullable().optional(),
  requiredForTreatmentCategories: z.array(z.string()).nullable().optional(),
  requiredForServiceIds: z.array(z.string()).nullable().optional(),
  requiredForPackageTemplateIds: z.array(z.string()).nullable().optional(),
  requirementStages: z.array(requirementStageEnum).optional(),
  requiredAlways: z.boolean().default(false),
  isActive: z.boolean().default(true),
  displayOrder: z.number().default(0),
  minorOnly: z.boolean().optional(),
  adultOnly: z.boolean().optional(),
  requiresGuardian: z.boolean().optional(),
  effectiveDate: z.string().optional(),
  status: z.enum(['draft', 'active', 'inactive', 'archived']).optional(),
})

function canManage(role: string) {
  return ['admin', 'super_admin'].includes(role)
}

function canRead(role: string) {
  return ['admin', 'super_admin', 'manager', 'staff', 'receptionist', 'dentist'].includes(role)
}

// GET /api/form-templates - List all templates
export async function GET(request: NextRequest) {
  try {
    const session = await getServerAuth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    if (!canRead(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')
    const activeOnly = searchParams.get('activeOnly') === 'true'
    const appointmentType = searchParams.get('appointmentType')
    const familyKey = searchParams.get('familyKey')
    const status = searchParams.get('status')
    const groupBy = searchParams.get('groupBy') // 'family' => return families with versions

    const where: any = {}
    if (category) where.category = category
    if (activeOnly) where.isActive = true
    if (familyKey) where.familyKey = familyKey
    if (status) where.status = status

    const templates = await prisma.formTemplate.findMany({
      where,
      orderBy: [{ displayOrder: 'asc' }, { familyKey: 'asc' }, { version: 'desc' }, { title: 'asc' }]
    })

    let filtered = templates
    if (appointmentType) {
      filtered = templates.filter((t) => {
        if (t.requiredAlways) return true
        const apts = (t.requiredForAppointmentTypes as string[] | null) || []
        return Array.isArray(apts) && apts.includes(appointmentType)
      })
    }

    // Group-by-family option: returns one entry per family with all versions sorted desc
    if (groupBy === 'family') {
      const familyMap = new Map<string, any>()
      for (const t of filtered) {
        const fk = t.familyKey || t.key
        if (!familyMap.has(fk)) {
          familyMap.set(fk, {
            familyKey: fk,
            title: t.title,
            category: t.category,
            description: t.description,
            isSystem: t.isSystem,
            requiredAlways: t.requiredAlways,
            activeVersion: null as any,
            draftVersion: null as any,
            versions: [] as any[],
          })
        }
        const fam = familyMap.get(fk)
        fam.versions.push(t)
        if (t.status === 'active' && !fam.activeVersion) fam.activeVersion = t
        if (t.status === 'draft' && !fam.draftVersion) fam.draftVersion = t
      }
      return NextResponse.json({ families: Array.from(familyMap.values()) })
    }

    return NextResponse.json({ templates: filtered })
  } catch (error: any) {
    console.error('[form-templates GET]', error)
    return NextResponse.json({ error: error.message || "Failed to load templates" }, { status: 500 })
  }
}

// POST /api/form-templates - Create a new template (admin only)
export async function POST(request: NextRequest) {
  try {
    const session = await getServerAuth()
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (!canManage(session.user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const body = await request.json()
    const parsed = createTemplateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid data", details: parsed.error.flatten() }, { status: 400 })
    }
    const data = parsed.data
    const key = (data.key || `${data.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now().toString(36)}`).slice(0, 100)
    const familyKey = data.familyKey || key

    const template = await prisma.formTemplate.create({
      data: {
        key,
        familyKey,
        title: data.title,
        description: data.description,
        category: data.category,
        fields: data.fields as any,
        requiredForAppointmentTypes: (data.requiredForAppointmentTypes ?? null) as any,
        requiredForTreatmentIds: (data.requiredForTreatmentIds ?? null) as any,
        requiredForTreatmentCategories: (data.requiredForTreatmentCategories ?? null) as any,
        requiredForServiceIds: (data.requiredForServiceIds ?? null) as any,
        requiredForPackageTemplateIds: (data.requiredForPackageTemplateIds ?? null) as any,
        requirementStages: (data.requirementStages ?? []) as any,
        requiredAlways: data.requiredAlways,
        isActive: data.isActive,
        displayOrder: data.displayOrder,
        isSystem: false,
        version: 1,
        status: data.status || 'active',
        effectiveDate: data.effectiveDate ? new Date(data.effectiveDate) : new Date(),
        minorOnly: data.minorOnly ?? false,
        adultOnly: data.adultOnly ?? false,
        requiresGuardian: data.requiresGuardian ?? false,
      }
    })

    await prisma.auditLog.create({
      data: {
        userId: (session.user as any).id,
        action: 'create',
        entityType: 'FormTemplate',
        entityId: template.id,
        category: 'ADMINISTRATIVE',
        description: `Created form template "${data.title}"`,
        newValues: { key, familyKey, category: data.category, status: template.status } as any,
      },
    }).catch(() => null)

    return NextResponse.json({ template }, { status: 201 })
  } catch (error: any) {
    console.error('[form-templates POST]', error)
    return NextResponse.json({ error: error.message || "Failed to create template" }, { status: 500 })
  }
}

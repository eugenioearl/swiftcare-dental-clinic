import { NextRequest, NextResponse } from "next/server"
import { getServerAuth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { z } from "zod"

const emptyOrUndef = z.preprocess((v) => (v === "" ? undefined : v), z.string().optional())
const numberOrUndef = z.preprocess((v) => {
  if (v === "" || v === null || v === undefined) return undefined
  if (typeof v === 'string') {
    const n = Number(v)
    return Number.isFinite(n) ? n : undefined
  }
  return v
}, z.number().optional())

const idArraySchema = z.preprocess(
  (v) => (v === null || v === undefined ? undefined : Array.isArray(v) ? v.filter((x) => typeof x === 'string' && x.trim() !== '') : undefined),
  z.array(z.string()).optional()
)

const phasesSchema = z.preprocess((v) => {
  if (!v) return undefined
  if (Array.isArray(v)) return v.length > 0 ? v : undefined
  return undefined
}, z.array(z.any()).optional())

const serviceSchema = z.object({
  name: z.string().min(1).max(200),
  displayName: emptyOrUndef,
  description: emptyOrUndef,
  category: emptyOrUndef,
  tagalog: emptyOrUndef,
  duration: z.preprocess(
    (v) => (v === '' || v === null || v === undefined ? undefined : typeof v === 'string' ? Number(v) : v),
    z.number().min(5).max(480).default(30)
  ),
  isActive: z.boolean().default(true),
  websiteVisible: z.boolean().default(true),
  isOfficial: z.boolean().optional(),
  sortOrder: z.number().default(0),
  estimatedPrice: numberOrUndef,
  priceMin: numberOrUndef,
  priceMax: numberOrUndef,
  priceDisplay: emptyOrUndef,
  showPrice: z.boolean().optional(),
  imageUrl: emptyOrUndef,
  linkedTreatmentIds: idArraySchema,
  linkedPackageTemplateIds: idArraySchema,
  linkedFormTemplateKeys: z.preprocess(
    (v) => (v === null || v === undefined ? undefined : Array.isArray(v) ? v : undefined),
    z.array(z.string()).optional()
  ),
  defaultAppointmentType: emptyOrUndef,
  defaultPlanTitle: emptyOrUndef,
  defaultPlanPhases: phasesSchema
})

// GET /api/admin/services - List all services with linked counts
export async function GET() {
  try {
    const session = await getServerAuth()
    if (!session?.user || !['admin', 'super_admin', 'manager', 'staff'].includes(session.user.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const services = await prisma.clinicService.findMany({
      orderBy: [{ isActive: 'desc' }, { sortOrder: 'asc' }]
    })

    return NextResponse.json({ success: true, data: { services } })
  } catch (error) {
    console.error("Error fetching services:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// POST /api/admin/services - Create new service
export async function POST(request: NextRequest) {
  try {
    const session = await getServerAuth()
    if (!session?.user || !['admin', 'super_admin', 'manager', 'dentist'].includes(session.user.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const data = serviceSchema.parse(body)

    const service = await prisma.clinicService.create({ data: data as any })

    return NextResponse.json({ success: true, data: { service } }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error", details: error.errors }, { status: 400 })
    }
    console.error("Error creating service:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// PATCH /api/admin/services - Update a service (id in body)
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerAuth()
    if (!session?.user || !['admin', 'super_admin', 'manager', 'dentist'].includes(session.user.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { id, ...updateData } = body
    if (!id) return NextResponse.json({ error: "Service ID required" }, { status: 400 })

    const data = serviceSchema.partial().parse(updateData)
    const service = await prisma.clinicService.update({ where: { id }, data: data as any })

    return NextResponse.json({ success: true, data: { service } })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error", details: error.errors }, { status: 400 })
    }
    console.error("Error updating service:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// DELETE /api/admin/services - Soft-deactivate a service (preserves history)
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerAuth()
    if (!session?.user || !['admin', 'super_admin', 'manager', 'dentist'].includes(session.user.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { id } = body
    if (!id) return NextResponse.json({ error: "Service ID required" }, { status: 400 })

    // If the service has appointment history, always soft-deactivate.
    const usage = await prisma.appointment.count({ where: { serviceId: id } })
    if (usage > 0) {
      await prisma.clinicService.update({
        where: { id },
        data: { isActive: false, websiteVisible: false }
      })
      return NextResponse.json({
        success: true,
        message: `Service deactivated (${usage} historical appointments preserved).`
      })
    }

    // Also deactivate when isOfficial is true (never hard-delete official list).
    const svc = await prisma.clinicService.findUnique({ where: { id } })
    if (svc?.isOfficial) {
      await prisma.clinicService.update({
        where: { id },
        data: { isActive: false, websiteVisible: false }
      })
      return NextResponse.json({
        success: true,
        message: 'Service deactivated (official services cannot be hard-deleted).'
      })
    }

    await prisma.clinicService.delete({ where: { id } })
    return NextResponse.json({ success: true, message: 'Service deleted' })
  } catch (error) {
    console.error("Error deleting service:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

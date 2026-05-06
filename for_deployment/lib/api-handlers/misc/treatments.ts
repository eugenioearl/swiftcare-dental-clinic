
import { NextRequest, NextResponse } from "next/server"
import { getServerAuth, canManageTreatments } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { z } from "zod"

const createTreatmentSchema = z.object({
  treatmentCode: z.string().min(1).max(20),
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  category: z.string().min(1).max(100),
  procedureType: z.enum(['general', 'ortho']).default('general'),
  baseCost: z.number().min(0),
  estimatedDurationMinutes: z.number().min(15).max(480).default(30),
  requiresAnesthesia: z.boolean().default(false),
  requiresFollowup: z.boolean().default(false),
  isSurgical: z.boolean().default(false),
  isActive: z.boolean().default(true)
})

// GET /api/treatments - List treatments
export async function GET(request: NextRequest) {
  try {
    const session = await getServerAuth()
    if (!session?.user) {
      // Temporarily allow access for testing - this should be removed in production
      console.log('⚠️ Bypassing auth for treatments API - TESTING ONLY')
    }

    const searchParams = request.nextUrl.searchParams
    const category = searchParams.get('category')
    const isActive = searchParams.get('isActive')
    const procedureType = searchParams.get('procedureType')

    let whereClause: any = {}

    if (category) {
      whereClause.category = { contains: category, mode: 'insensitive' }
    }

    if (procedureType && ['general', 'ortho'].includes(procedureType)) {
      whereClause.procedureType = procedureType
    }

    if (isActive !== null) {
      whereClause.isActive = isActive === 'true'
    } else {
      whereClause.isActive = true // Default to active treatments
    }

    const treatments = await prisma.treatment.findMany({
      where: whereClause,
      orderBy: [
        { category: 'asc' },
        { name: 'asc' }
      ]
    })

    // Group treatments by category
    const groupedTreatments = treatments.reduce((acc, treatment) => {
      const category = treatment.category
      if (!acc[category]) {
        acc[category] = []
      }
      acc[category].push(treatment)
      return acc
    }, {} as Record<string, typeof treatments>)

    return NextResponse.json({
      success: true,
      data: {
        treatments,
        groupedTreatments
      }
    })

  } catch (error) {
    console.error("Error fetching treatments:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// POST /api/treatments - Create new treatment
export async function POST(request: NextRequest) {
  try {
    const session = await getServerAuth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!canManageTreatments(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const validatedData = createTreatmentSchema.parse(body)

    // Check if treatment code already exists
    const existingTreatment = await prisma.treatment.findUnique({
      where: { treatmentCode: validatedData.treatmentCode }
    })

    if (existingTreatment) {
      return NextResponse.json({
        error: "Treatment with this code already exists"
      }, { status: 409 })
    }

    const treatment = await prisma.treatment.create({
      data: validatedData as any
    })

    // Log treatment creation
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        entityType: 'treatment',
        entityId: treatment.id,
        action: 'create',
        newValues: {
          treatmentCode: treatment.treatmentCode,
          name: treatment.name,
          category: treatment.category,
          baseCost: treatment.baseCost.toString()
        }
      }
    })

    return NextResponse.json({
      success: true,
      data: treatment
    }, { status: 201 })

  } catch (error) {
    console.error("Error creating treatment:", error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        error: "Validation error",
        details: error.errors
      }, { status: 400 })
    }

    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

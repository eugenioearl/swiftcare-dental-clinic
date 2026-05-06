import { NextRequest, NextResponse } from "next/server"
import { getServerAuth } from "@/lib/auth"
import { prisma } from "@/lib/db"


// GET /api/treatment-plans - List all treatment plans
export async function GET(request: NextRequest) {
  try {
    const session = await getServerAuth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const status = searchParams.get('status')
    const patientId = searchParams.get('patientId')

    const where: any = {}
    if (status && status !== 'all') where.status = status
    if (patientId) where.patientId = patientId

    const plans = await prisma.treatmentPlan.findMany({
      where,
      include: {
        patient: {
          select: { id: true, fullName: true, patientNumber: true }
        },
        dentist: {
          select: { id: true, user: { select: { firstName: true, lastName: true } } }
        }
      },
      orderBy: { updatedAt: 'desc' }
    })

    return NextResponse.json({ success: true, plans })
  } catch (error) {
    console.error("Error fetching treatment plans:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// POST /api/treatment-plans - Create a treatment plan
export async function POST(request: NextRequest) {
  try {
    const session = await getServerAuth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { patientId, dentistId, title, description, priority, phases, estimatedCost, diagnosis, clinicalNotes } = body

    if (!patientId || !title) {
      return NextResponse.json({ error: "Patient and title are required" }, { status: 400 })
    }

    const plan = await prisma.treatmentPlan.create({
      data: {
        patientId,
        ...(dentistId ? { dentistId } : {}),
        title,
        description: description || '',
        priority: priority || 'medium',
        phases: phases || [],
        estimatedCost: estimatedCost || 0,
        diagnosis: diagnosis || '',
        clinicalNotes: clinicalNotes || '',
        status: 'draft'
      },
      include: {
        patient: {
          select: { id: true, fullName: true, patientNumber: true }
        },
        dentist: {
          select: { id: true, user: { select: { firstName: true, lastName: true } } }
        }
      }
    })

    return NextResponse.json({ success: true, plan }, { status: 201 })
  } catch (error) {
    console.error("Error creating treatment plan:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// PUT /api/treatment-plans - Update a treatment plan
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerAuth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { id, ...updateData } = body

    if (!id) {
      return NextResponse.json({ error: "Plan ID is required" }, { status: 400 })
    }

    // Only allow certain fields to be updated
    const allowedFields: Record<string, any> = {}
    const editable = ['title', 'description', 'status', 'priority', 'phases', 'estimatedCost',
      'approvedCost', 'actualCost', 'diagnosis', 'prognosis', 'clinicalNotes', 'patientNotes',
      'risks', 'benefits', 'completionPercentage', 'currentPhase', 'patientApproval',
      'estimatedStartDate', 'estimatedEndDate', 'actualStartDate', 'actualEndDate',
      'consentSigned', 'consentDate', 'approvalDate', 'nextAppointment', 'dentistId']

    for (const key of editable) {
      if (updateData[key] !== undefined) {
        allowedFields[key] = updateData[key]
      }
    }

    const plan = await prisma.treatmentPlan.update({
      where: { id },
      data: allowedFields,
      include: {
        patient: {
          select: { id: true, fullName: true, patientNumber: true }
        },
        dentist: {
          select: { id: true, user: { select: { firstName: true, lastName: true } } }
        }
      }
    })

    return NextResponse.json({ success: true, plan })
  } catch (error) {
    console.error("Error updating treatment plan:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// DELETE /api/treatment-plans - Delete a treatment plan
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerAuth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: "Plan ID is required" }, { status: 400 })
    }

    await prisma.treatmentPlan.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting treatment plan:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

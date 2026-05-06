
import { NextRequest, NextResponse } from "next/server"
import { getServerAuth } from "@/lib/auth"


// GET /api/treatment/plans - Get treatment plans
export async function GET(request: NextRequest) {
  try {
    const session = await getServerAuth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const patientId = searchParams.get('patientId')

    // Mock treatment plans data
    const mockTreatmentPlans = [
      {
        id: 'plan-1',
        patientId: patientId || 'patient-1',
        title: 'Comprehensive Dental Restoration',
        description: 'Complete dental rehabilitation including cleanings, fillings, and cosmetic improvements',
        status: 'in_progress',
        totalCost: 4850.00,
        estimatedDuration: 12,
        createdAt: '2024-09-01T10:00:00Z',
        updatedAt: '2024-09-05T14:30:00Z',
        phases: [
          {
            id: 'phase-1',
            phaseNumber: 1,
            title: 'Initial Assessment & Cleaning',
            description: 'Comprehensive examination, X-rays, and professional cleaning',
            status: 'completed',
            startDate: '2024-09-01T09:00:00Z',
            endDate: '2024-09-01T10:30:00Z',
            estimatedCost: 280.00,
            actualCost: 280.00,
            procedures: [
              {
                id: 'proc-1',
                code: 'D0150',
                description: 'Comprehensive oral evaluation',
                cost: 120.00,
                duration: 45,
                priority: 'normal',
                status: 'completed'
              }
            ]
          }
        ]
      }
    ]

    return NextResponse.json({
      success: true,
      data: {
        treatmentPlans: mockTreatmentPlans
      }
    })

  } catch (error) {
    console.error("Error fetching treatment plans:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// POST /api/treatment/plans - Create treatment plan
export async function POST(request: NextRequest) {
  try {
    const session = await getServerAuth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()

    // Mock plan creation
    const newPlan = {
      id: `plan-${Date.now()}`,
      ...body,
      status: 'draft',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }

    return NextResponse.json({
      success: true,
      data: newPlan
    })

  } catch (error) {
    console.error("Error creating treatment plan:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

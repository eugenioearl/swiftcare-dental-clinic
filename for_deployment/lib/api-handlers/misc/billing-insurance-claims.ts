
import { NextRequest, NextResponse } from "next/server"
import { getServerAuth } from "@/lib/auth"
import { prisma } from "@/lib/db"

// GET /api/billing/insurance/claims - Get insurance claims
export async function GET(request: NextRequest) {
  try {
    const session = await getServerAuth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const appointmentId = searchParams.get('appointmentId')
    const patientId = searchParams.get('patientId')

    // Mock insurance claims data for demonstration
    const mockClaims = [
      {
        id: 'claim-1',
        claimNumber: 'CLM-2024-001',
        patientId: patientId || 'patient-1',
        appointmentId: appointmentId || 'appointment-1',
        provider: 'Delta Dental',
        status: 'approved',
        submittedAt: '2024-09-01T10:00:00Z',
        approvedAmount: 280.00,
        procedures: [
          {
            code: 'D0120',
            description: 'Periodic oral evaluation',
            chargedAmount: 80.00,
            approvedAmount: 80.00,
            quantity: 1
          },
          {
            code: 'D1110', 
            description: 'Adult prophylaxis',
            chargedAmount: 120.00,
            approvedAmount: 100.00,
            quantity: 1
          }
        ]
      }
    ]

    return NextResponse.json({
      success: true,
      data: {
        claims: mockClaims
      }
    })

  } catch (error) {
    console.error("Error fetching insurance claims:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// POST /api/billing/insurance/claims - Create new insurance claim
export async function POST(request: NextRequest) {
  try {
    const session = await getServerAuth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()

    // Mock claim creation
    const newClaim = {
      id: `claim-${Date.now()}`,
      claimNumber: `CLM-${Date.now()}`,
      ...body,
      status: 'draft',
      createdAt: new Date().toISOString()
    }

    return NextResponse.json({
      success: true,
      data: newClaim
    })

  } catch (error) {
    console.error("Error creating insurance claim:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

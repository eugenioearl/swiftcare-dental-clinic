
import { NextRequest, NextResponse } from "next/server"
import { getServerAuth } from "@/lib/auth"
import { prisma } from "@/lib/db"

// GET /api/ai-diagnostics - Get AI diagnostic analyses
export async function GET(request: NextRequest) {
  try {
    const session = await getServerAuth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized - Please sign in" }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const patientId = searchParams.get('patientId')

    let whereClause: any = {}

    // Role-based filtering
    if (session.user.role === 'patient') {
      // Patients can only see their own diagnostics
      const patient = await prisma.patient.findFirst({
        where: { userId: session.user.id }
      })
      if (!patient) {
        return NextResponse.json({ error: "Patient profile not found" }, { status: 404 })
      }
      whereClause.patientId = patient.id
    } else if (session.user.role === 'dentist') {
      // Dentists can see diagnostics for their patients
      if (patientId) {
        whereClause.patientId = patientId
      }
    } else if (session.user.role === 'admin' || session.user.role === 'receptionist') {
      // Admin and staff can see all diagnostics
      if (patientId) {
        whereClause.patientId = patientId
      }
    } else {
      return NextResponse.json({ error: "Forbidden - Insufficient permissions" }, { status: 403 })
    }

    // For demonstration purposes, return mock data
    const mockDiagnostics = [
      {
        id: '1',
        patientId: whereClause.patientId || 'demo',
        analysisType: 'cavity_detection',
        imageUrl: '/images/dental-xray-sample.jpg',
        findings: ['Possible cavity in tooth #14', 'Minor plaque buildup'],
        confidence: 0.85,
        recommendations: ['Schedule filling appointment', 'Improve brushing technique'],
        createdAt: new Date().toISOString(),
        analyzedBy: 'AI System v2.0'
      }
    ]

    return NextResponse.json({
      success: true,
      data: {
        diagnostics: mockDiagnostics
      }
    })

  } catch (error) {
    console.error("Error fetching AI diagnostics:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// POST /api/ai-diagnostics - Create new AI diagnostic analysis
export async function POST(request: NextRequest) {
  try {
    const session = await getServerAuth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Only dentists and admins can create diagnostics
    if (!['dentist', 'admin'].includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const { patientId, imageUrl, analysisType } = body

    // Mock AI analysis
    const mockResult = {
      id: `diag_${Date.now()}`,
      patientId,
      analysisType,
      imageUrl,
      findings: ['AI analysis pending'],
      confidence: 0.0,
      recommendations: ['Review with dentist'],
      createdAt: new Date().toISOString(),
      analyzedBy: session.user.email
    }

    return NextResponse.json({
      success: true,
      data: mockResult
    }, { status: 201 })

  } catch (error) {
    console.error("Error creating AI diagnostic:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

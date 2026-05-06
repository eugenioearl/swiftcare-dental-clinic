
import { NextRequest, NextResponse } from "next/server"
import { getServerAuth } from "@/lib/auth"

// GET /api/dental-records/[id]
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    // Temporarily disable auth for demonstration
    /*
    const session = await getServerAuth()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    */

    const { id } = params

    // Return a mock dental record
    const mockRecord = {
      id,
      patientId: "patient-id-123",
      recordDate: new Date().toISOString(),
      chiefComplaint: "Tooth pain on upper right side",
      diagnosis: "Dental caries on tooth #3",
      recommendedTreatment: "Composite filling required",
      notes: "Patient reports sensitivity to cold and sweet foods",
      patient: {
        id: "patient-id-123",
        user: {
          firstName: "John",
          lastName: "Doe",
          email: "patient@example.com"
        }
      },
      dentist: {
        user: {
          firstName: "Dr. Sarah",
          lastName: "Smith"
        }
      }
    }

    return NextResponse.json({
      data: {
        dentalRecord: mockRecord
      }
    })
  } catch (error) {
    console.error("Error fetching dental record:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

// PATCH /api/dental-records/[id]
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerAuth()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = params
    const body = await request.json()

    // Return updated mock record
    const updatedRecord = {
      id,
      ...body,
      updatedAt: new Date().toISOString(),
      patient: {
        user: {
          firstName: "John",
          lastName: "Doe"
        }
      }
    }

    return NextResponse.json({
      data: {
        dentalRecord: updatedRecord
      }
    })
  } catch (error) {
    console.error("Error updating dental record:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

// DELETE /api/dental-records/[id]
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  return NextResponse.json({ message: "Record deleted successfully" })
}

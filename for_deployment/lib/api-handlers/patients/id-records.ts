
import { NextRequest, NextResponse } from "next/server"
import { getServerAuth } from "@/lib/auth"
import { prisma } from "@/lib/db"

// GET /api/patients/[id]/records - Get patient medical records
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerAuth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const patientId = params.id

    // Verify access permissions
    if (session.user?.role === 'patient') {
      const patient = await prisma.patient.findFirst({
        where: { userId: session.user?.id }
      })
      if (!patient || patient.id !== patientId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }
    }

    // Fetch patient with records
    const patient = await prisma.patient.findUnique({
      where: { id: patientId },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
            phone: true
          }
        },
        appointments: {
          where: {
            status: 'completed'
          },
          include: {
            dentist: {
              include: {
                user: {
                  select: {
                    firstName: true,
                    lastName: true
                  }
                }
              }
            }
          },
          orderBy: {
            scheduledDatetime: 'desc'
          },
          take: 50
        }
      }
    })

    if (!patient) {
      return NextResponse.json({ error: "Patient not found" }, { status: 404 })
    }

    // Format medical history
    const medicalHistory = {
      allergies: patient.allergies || 'None reported',
      currentMedications: patient.currentMedications || 'None reported',
      medicalConditions: patient.medicalHistory || 'None reported',
      emergencyContact: {
        name: patient.emergencyContactName || 'Not provided',
        phone: patient.emergencyContactPhone || 'Not provided'
      }
    }

    // Format treatment history from completed appointments
    const treatmentHistory = patient.appointments.map((apt: any) => ({
      id: apt.id,
      date: apt.scheduledDatetime,
      type: apt.appointmentType,
      dentist: `Dr. ${apt.dentist?.user?.lastName}, ${apt.dentist?.user?.firstName}`,
      description: apt.reasonForVisit || apt.appointmentType,
      notes: apt.notes || ''
    }))

    return NextResponse.json({
      success: true,
      data: {
        patient: {
          id: patient.id,
          name: `${patient.user?.lastName}, ${patient.user?.firstName}`,
          email: patient.user?.email,
          phone: patient.user?.phone,
          dateOfBirth: patient.dateOfBirth
        },
        medicalHistory,
        treatmentHistory,
        documents: [] // TODO: Implement document management
      }
    })

  } catch (error) {
    console.error("Error fetching patient records:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

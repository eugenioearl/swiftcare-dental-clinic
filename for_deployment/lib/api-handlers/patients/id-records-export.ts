
import { NextRequest, NextResponse } from "next/server"
import { getServerAuth } from "@/lib/auth"
import { prisma } from "@/lib/db"

// GET /api/patients/[id]/records/export - Export patient records as PDF/CSV
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
    const searchParams = request.nextUrl.searchParams
    const format = searchParams.get('format') || 'csv'

    // Verify access permissions
    if (session.user?.role === 'patient') {
      const patient = await prisma.patient.findFirst({
        where: { userId: session.user?.id }
      })
      if (!patient || patient.id !== patientId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }
    }

    // Fetch patient with complete records
    const patient = await prisma.patient.findUnique({
      where: { id: patientId },
      include: {
        user: true,
        appointments: {
          where: { status: 'completed' },
          include: {
            dentist: {
              include: { user: true }
            }
          },
          orderBy: { scheduledDatetime: 'desc' }
        }
      }
    })

    if (!patient) {
      return NextResponse.json({ error: "Patient not found" }, { status: 404 })
    }

    if (format === 'csv') {
      // Generate CSV
      const csvLines = [
        'Date,Type,Dentist,Description,Notes',
        ...patient.appointments.map((apt: any) => 
          `"${new Date(apt.scheduledDatetime).toLocaleDateString()}","${apt.appointmentType}","Dr. ${apt.dentist?.user?.lastName}, ${apt.dentist?.user?.firstName}","${apt.reasonForVisit || ''}","${apt.notes || ''}"`
        )
      ]
      const csvContent = csvLines.join('\n')

      return new NextResponse(csvContent, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="patient-${patientId}-records.csv"`
        }
      })
    }

    // For PDF, return a simple text representation
    // In a real application, you would use a PDF library
    const textContent = `
Patient Medical Records
-----------------------

Patient: ${patient.user?.lastName}, ${patient.user?.firstName}
Email: ${patient.user?.email}
DOB: ${new Date(patient.dateOfBirth).toLocaleDateString()}

Medical History:
- Allergies: ${patient.allergies || 'None'}
- Medications: ${patient.currentMedications || 'None'}
- Conditions: ${patient.medicalHistory || 'None'}

Treatment History:
${patient.appointments.map((apt: any, i: number) => `
${i + 1}. ${new Date(apt.scheduledDatetime).toLocaleDateString()}
   Type: ${apt.appointmentType}
   Dentist: Dr. ${apt.dentist?.user?.lastName}, ${apt.dentist?.user?.firstName}
   Description: ${apt.reasonForVisit || 'N/A'}
   Notes: ${apt.notes || 'N/A'}
`).join('\n')}

Generated: ${new Date().toLocaleString()}
    `.trim()

    return new NextResponse(textContent, {
      headers: {
        'Content-Type': 'text/plain',
        'Content-Disposition': `attachment; filename="patient-${patientId}-records.txt"`
      }
    })

  } catch (error) {
    console.error("Error exporting patient records:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}


import { NextRequest, NextResponse } from "next/server"
import { getServerAuth, canAccessPatientData } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { z } from "zod"

const exportSchema = z.object({
  patientIds: z.array(z.string().uuid()).optional(),
  filters: z.object({
    statusFilter: z.string().optional(),
    genderFilter: z.string().optional(),
    insuranceFilter: z.string().optional(),
    searchTerm: z.string().optional()
  }).optional()
})

// POST /api/patients/export
export async function POST(request: NextRequest) {
  try {
    const session = await getServerAuth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!canAccessPatientData(session.user?.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const { patientIds, filters } = exportSchema.parse(body)

    let whereClause: any = {}

    // If specific patient IDs are provided, use them
    if (patientIds && patientIds.length > 0) {
      whereClause.id = { in: patientIds }
    } else if (filters) {
      // Apply filters for export
      if (filters.statusFilter && filters.statusFilter !== 'all') {
        whereClause.isActive = filters.statusFilter === 'active'
      }

      if (filters.searchTerm) {
        whereClause.OR = [
          { user: { firstName: { contains: filters.searchTerm, mode: 'insensitive' } } },
          { user: { lastName: { contains: filters.searchTerm, mode: 'insensitive' } } },
          { user: { email: { contains: filters.searchTerm, mode: 'insensitive' } } },
          { patientNumber: { contains: filters.searchTerm, mode: 'insensitive' } }
        ]
      }
    }

    // Fetch patients for export
    const patients = await prisma.patient.findMany({
      where: whereClause,
      include: {
        user: {
          select: {
            email: true,
            firstName: true,
            lastName: true,
            phone: true,
            isActive: true,
            createdAt: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    // Create CSV content
    const csvHeaders = [
      'Patient Number',
      'First Name',
      'Last Name',
      'Email',
      'Phone',
      'Date of Birth',
      'Gender',
      'Address',
      'City',
      'State',
      'ZIP Code',
      'Emergency Contact Name',
      'Emergency Contact Phone',
      'Insurance Provider',
      'Insurance Policy Number',
      'Medical History',
      'Allergies',
      'Current Medications',
      'Status',
      'Created Date'
    ]

    const csvRows = patients.map(patient => [
      patient.patientNumber,
      patient.user?.firstName,
      patient.user?.lastName,
      patient.user?.email,
      patient.user?.phone || '',
      patient.dateOfBirth ? new Date(patient.dateOfBirth).toLocaleDateString() : '',
      patient.gender || '',
      patient.address || '',
      patient.city || '',
      patient.state || '',
      patient.zipCode || '',
      patient.emergencyContactName || '',
      patient.emergencyContactPhone || '',
      patient.insuranceProvider || '',
      patient.insurancePolicyNumber || '',
      // Clean text fields for CSV
      (patient.medicalHistory || '').replace(/\r?\n/g, ' ').replace(/"/g, '""'),
      (patient.allergies || '').replace(/\r?\n/g, ' ').replace(/"/g, '""'),
      (patient.currentMedications || '').replace(/\r?\n/g, ' ').replace(/"/g, '""'),
      patient.isActive ? 'Active' : 'Inactive',
      new Date(patient.createdAt).toLocaleDateString()
    ])

    // Format CSV
    const csvContent = [
      csvHeaders.join(','),
      ...csvRows.map(row => 
        row.map(field => 
          typeof field === 'string' && field.includes(',') 
            ? `"${field}"` 
            : field
        ).join(',')
      )
    ].join('\n')

    // Log export activity
    await prisma.auditLog.create({
      data: {
        userId: session.user?.id,
        entityType: 'patient',
        entityId: 'bulk',
        action: 'read',
        newValues: {
          action: 'export',
          count: patients.length,
          filters: filters || null
        }
      }
    })

    // Return CSV as response
    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="patients-export-${new Date().toISOString().split('T')[0]}.csv"`
      }
    })

  } catch (error) {
    console.error("Error in export:", error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        error: "Validation error",
        details: error.errors
      }, { status: 400 })
    }

    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

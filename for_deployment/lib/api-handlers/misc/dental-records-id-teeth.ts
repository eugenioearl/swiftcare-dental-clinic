
import { NextRequest, NextResponse } from "next/server"
import { getServerAuth } from "@/lib/auth"

// Generate patient-specific tooth data using FDI Two-Digit System
const generateMockToothData = (dentalRecordId: string) => {
  // FDI Two-Digit System: 11-18, 21-28, 31-38, 41-48
  const fdiTeeth = [
    // Upper right: 11-18
    '11', '12', '13', '14', '15', '16', '17', '18',
    // Upper left: 21-28
    '21', '22', '23', '24', '25', '26', '27', '28',
    // Lower left: 31-38
    '31', '32', '33', '34', '35', '36', '37', '38',
    // Lower right: 41-48
    '41', '42', '43', '44', '45', '46', '47', '48'
  ]

  const isAliceJohnson = dentalRecordId.includes('P-2024-0001')
  
  if (isAliceJohnson) {
    // Alice Johnson - specific dental conditions using FDI numbering
    const aliceTeethData: Record<string, { status: string; surfaces: string[]; condition: string; priority: number; notes: string }> = {
      '36': { status: 'infected', surfaces: ['occlusal', 'mesial'], condition: 'Acute pulpitis with severe pain', priority: 2, notes: 'Root canal therapy urgently needed' }, // Lower left first molar
      '37': { status: 'cavity', surfaces: ['occlusal'], condition: 'Deep caries approaching pulp', priority: 2, notes: 'Large restoration required' }, // Lower left second molar
      '12': { status: 'filled', surfaces: ['mesial'], condition: 'Composite restoration in good condition', priority: 0, notes: 'Monitor for wear' }, // Upper right lateral incisor
      '21': { status: 'filled', surfaces: ['buccal'], condition: 'Old amalgam filling', priority: 1, notes: 'Consider replacement with composite' }, // Upper left central incisor
      '35': { status: 'cavity', surfaces: ['distal'], condition: 'Small interproximal caries', priority: 1, notes: 'Composite filling recommended' }, // Lower left second premolar
      '13': { status: 'crowned', surfaces: [], condition: 'Porcelain crown in excellent condition', priority: 0, notes: 'Placed 3 years ago, no issues' } // Upper right canine
    }
    
    return fdiTeeth.map(toothNumber => {
      const toothData = aliceTeethData[toothNumber]
      if (toothData) {
        return {
          id: `tooth-${dentalRecordId}-${toothNumber}`,
          dentalRecordId,
          toothNumber,
          toothType: 'permanent',
          status: toothData.status,
          surfaces: toothData.surfaces,
          condition: toothData.condition,
          notes: toothData.notes,
          priority: toothData.priority,
          lastExamDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days ago
          procedures: [],
          annotations: []
        }
      } else {
        return {
          id: `tooth-${dentalRecordId}-${toothNumber}`,
          dentalRecordId,
          toothNumber,
          toothType: 'permanent',
          status: 'healthy',
          surfaces: [],
          condition: 'No issues noted',
          notes: '',
          priority: 0,
          lastExamDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
          procedures: [],
          annotations: []
        }
      }
    })
  }

  // Generic patient data (fallback)
  const statuses = ['healthy', 'cavity', 'filled', 'crowned', 'missing']
  const surfaces = ['mesial', 'distal', 'buccal', 'lingual', 'occlusal']

  return fdiTeeth.map(toothNumber => {
    const status = statuses[Math.floor(Math.random() * statuses.length)]
    const affectedSurfaces = surfaces.filter(() => Math.random() > 0.7) // Random subset

    return {
      id: `tooth-${dentalRecordId}-${toothNumber}`,
      dentalRecordId,
      toothNumber,
      toothType: 'permanent',
      status,
      surfaces: affectedSurfaces,
      condition: status === 'healthy' ? 'No issues noted' : `${status} condition noted`,
      notes: status !== 'healthy' ? `Tooth #${toothNumber} requires attention` : '',
      priority: status === 'cavity' ? 2 : status === 'filled' ? 1 : 0,
      lastExamDate: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString(),
      procedures: [],
      annotations: []
    }
  })
}

// GET /api/dental-records/[id]/teeth
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    // Temporarily disable auth for demonstration
    /*
    const session = await getServerAuth()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    */

    const { id: dentalRecordId } = params

    // Generate mock tooth records
    const mockToothRecords = generateMockToothData(dentalRecordId)

    return NextResponse.json({
      data: {
        toothRecords: mockToothRecords
      }
    })
  } catch (error) {
    console.error("Error fetching tooth records:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

// POST /api/dental-records/[id]/teeth
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerAuth()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id: dentalRecordId } = params
    const body = await request.json()

    // Create mock tooth record
    const mockToothRecord = {
      id: `tooth-${dentalRecordId}-${body.toothNumber}-${Date.now()}`,
      dentalRecordId,
      ...body,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }

    return NextResponse.json({
      data: {
        toothRecord: mockToothRecord
      }
    }, { status: 201 })
  } catch (error) {
    console.error("Error creating tooth record:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

// PUT /api/dental-records/[id]/teeth
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  return NextResponse.json({ message: "Tooth record updated successfully" })
}

// DELETE /api/dental-records/[id]/teeth
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  return NextResponse.json({ message: "Tooth record deleted successfully" })
}


import { NextRequest, NextResponse } from "next/server"
import { getServerAuth } from "@/lib/auth"

// GET /api/inventory/auto-deduction - Get inventory items and auto-deduction rules
export async function GET(request: NextRequest) {
  try {
    const session = await getServerAuth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Mock inventory data
    const mockInventoryItems = [
      {
        id: 'inv-1',
        name: 'Composite Resin - Shade A2',
        category: 'Restorative Materials',
        currentStock: 15,
        minimumStock: 20,
        maximumStock: 100,
        unitCost: 25.99,
        supplier: 'Dental Supply Co.',
        autoReorderEnabled: true,
        reorderQuantity: 50,
        lastUpdated: '2024-09-09T14:30:00Z'
      }
    ]

    const mockAutoDeductions = [
      {
        id: 'deduction-1',
        procedureCode: 'D2140',
        procedureName: 'Amalgam restoration - one surface',
        isActive: true,
        items: [
          {
            inventoryId: 'inv-1',
            inventoryName: 'Composite Resin - Shade A2',
            quantityPerProcedure: 2,
            cost: 51.98
          }
        ]
      }
    ]

    const mockReorderAlerts = [
      {
        id: 'alert-1',
        inventoryId: 'inv-1',
        inventoryName: 'Composite Resin - Shade A2',
        currentStock: 15,
        minimumStock: 20,
        reorderQuantity: 50,
        estimatedCost: 1299.50,
        priority: 'high',
        daysUntilStockout: 8
      }
    ]

    return NextResponse.json({
      success: true,
      data: {
        inventoryItems: mockInventoryItems,
        autoDeductions: mockAutoDeductions,
        reorderAlerts: mockReorderAlerts
      }
    })

  } catch (error) {
    console.error("Error fetching inventory data:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// POST /api/inventory/auto-deduction/process - Process automatic deduction
export async function POST(request: NextRequest) {
  try {
    const session = await getServerAuth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { procedureCode, patientId, dentistId } = body

    // Mock deduction processing
    const deductionResult = {
      procedureCode,
      patientId,
      dentistId,
      itemsDeducted: [
        {
          inventoryId: 'inv-1',
          inventoryName: 'Composite Resin - Shade A2',
          quantityDeducted: 2,
          cost: 51.98,
          newStock: 13
        }
      ],
      totalCost: 51.98,
      processedAt: new Date().toISOString()
    }

    return NextResponse.json({
      success: true,
      data: deductionResult
    })

  } catch (error) {
    console.error("Error processing auto-deduction:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}



import { NextRequest, NextResponse } from "next/server"
import { getServerAuth } from "@/lib/auth"
import { prisma } from "@/lib/db"

// GET /api/inventory/search - Auto-suggest search for inventory items
export async function GET(request: NextRequest) {
  try {
    const session = await getServerAuth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q') || ''
    const category = searchParams.get('category')
    const inStockOnly = searchParams.get('inStock') === 'true'
    const limit = parseInt(searchParams.get('limit') || '10')

    if (query.length < 1) {
      return NextResponse.json({
        success: true,
        data: []
      })
    }

    // Build where clause for search
    let whereClause: any = {
      isActive: true,
      OR: [
        { name: { contains: query, mode: 'insensitive' } },
        { description: { contains: query, mode: 'insensitive' } },
        { barcode: { contains: query, mode: 'insensitive' } },
        { sku: { contains: query, mode: 'insensitive' } }
      ]
    }

    if (category) {
      whereClause.category = category
    }

    if (inStockOnly) {
      whereClause.currentStock = { gt: 0 }
    }

    const items = await prisma.inventoryItem.findMany({
      where: whereClause,
      select: {
        id: true,
        name: true,
        description: true,
        category: true,
        currentStock: true,
        minimumStock: true,
        unit: true,
        costPerUnit: true,
        sellingPrice: true,
        status: true,
        location: true,
        barcode: true,
        sku: true,
        supplier: {
          select: {
            id: true,
            name: true
          }
        }
      },
      orderBy: [
        // Prioritize exact matches
        { name: 'asc' }
      ],
      take: limit
    })

    // Add calculated fields for each item
    const enhancedItems = items.map(item => {
      let calculatedStatus = item.status
      
      // Calculate status based on stock levels
      if (item.currentStock <= item.minimumStock && item.currentStock > 0) {
        calculatedStatus = 'low'
      } else if (item.currentStock === 0) {
        calculatedStatus = 'out_of_stock'
      } else if (item.currentStock <= (item.minimumStock * 0.5)) {
        calculatedStatus = 'critical'
      }

      return {
        ...item,
        calculatedStatus,
        totalValue: Number(item.currentStock) * Number(item.costPerUnit),
        isAvailable: item.currentStock > 0,
        displayText: `${item.name} (${item.currentStock} ${item.unit})`
      }
    })

    return NextResponse.json({
      success: true,
      data: enhancedItems
    })

  } catch (error) {
    console.error("Error searching inventory:", error)
    return NextResponse.json({
      error: "Failed to search inventory"
    }, { status: 500 })
  }
}



import { NextRequest, NextResponse } from "next/server"
import { getServerAuth, canManageInventory } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { z } from "zod"

const createInventorySchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  category: z.enum(['restorative', 'preventive', 'surgical', 'anesthetic', 'disposable', 'equipment', 'laboratory', 'orthodontic', 'endodontic', 'periodontic', 'oral_surgery', 'radiology', 'sterilization', 'office_supplies', 'other']),
  barcode: z.string().optional(),
  sku: z.string().optional(),
  currentStock: z.number().int().min(0).default(0),
  minimumStock: z.number().int().min(0).default(0),
  maximumStock: z.number().int().min(0).optional(),
  unit: z.string().min(1).max(20),
  costPerUnit: z.number().min(0),
  sellingPrice: z.number().min(0).optional(),
  supplierId: z.string().uuid().optional(),
  location: z.string().max(100).optional(),
  expiryDate: z.string().transform((str) => new Date(str)).optional(),
  batchNumber: z.string().max(50).optional(),
  reorderPoint: z.number().int().min(0).default(0),
  notes: z.string().optional()
})

// GET /api/inventory - List inventory items
export async function GET(request: NextRequest) {
  try {
    const session = await getServerAuth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!canManageInventory(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const search = searchParams.get('search') || ''
    const category = searchParams.get('category')
    const status = searchParams.get('status')
    const lowStock = searchParams.get('lowStock') === 'true'
    const expired = searchParams.get('expired') === 'true'

    const skip = (page - 1) * limit

    // Build where clause
    let whereClause: any = {
      isActive: true
    }

    if (search) {
      whereClause.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { barcode: { contains: search, mode: 'insensitive' } },
        { sku: { contains: search, mode: 'insensitive' } }
      ]
    }

    if (category) {
      whereClause.category = category
    }

    if (status) {
      whereClause.status = status
    }

    if (lowStock) {
      whereClause.currentStock = { lte: { equals: 'minimumStock' } }
    }

    if (expired) {
      whereClause.expiryDate = { lt: new Date() }
    }

    const [items, total] = await Promise.all([
      prisma.inventoryItem.findMany({
        where: whereClause,
        include: {
          supplier: {
            select: { id: true, name: true }
          },
          transactions: {
            take: 5,
            orderBy: { createdAt: 'desc' },
            select: {
              id: true,
              type: true,
              quantity: true,
              createdAt: true,
              user: { select: { firstName: true, lastName: true } }
            }
          }
        },
        orderBy: { name: 'asc' },
        skip,
        take: limit
      }),
      prisma.inventoryItem.count({ where: whereClause })
    ])

    // Calculate derived status for each item
    const itemsWithStatus = items.map(item => {
      let calculatedStatus = item.status
      
      // Check if low stock
      if (item.currentStock <= item.minimumStock && item.currentStock > 0) {
        calculatedStatus = 'low'
      } else if (item.currentStock === 0) {
        calculatedStatus = 'out_of_stock'
      } else if (item.currentStock <= (item.minimumStock * 0.5)) {
        calculatedStatus = 'critical'
      }

      // Check if expired
      if (item.expiryDate && item.expiryDate < new Date()) {
        calculatedStatus = 'expired'
      }

      return {
        ...item,
        calculatedStatus,
        totalValue: Number(item.currentStock) * Number(item.costPerUnit)
      }
    })

    // Get summary statistics
    const stats = await prisma.inventoryItem.aggregate({
      where: { isActive: true },
      _sum: {
        currentStock: true
      },
      _count: {
        _all: true
      }
    })

    const lowStockCount = await prisma.inventoryItem.count({
      where: {
        isActive: true,
        currentStock: { lte: prisma.inventoryItem.fields.minimumStock }
      }
    })

    const expiredCount = await prisma.inventoryItem.count({
      where: {
        isActive: true,
        expiryDate: { lt: new Date() }
      }
    })

    return NextResponse.json({
      success: true,
      data: {
        items: itemsWithStatus,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        },
        stats: {
          totalItems: stats._count._all,
          totalStock: stats._sum.currentStock || 0,
          lowStockItems: lowStockCount,
          expiredItems: expiredCount
        }
      }
    })

  } catch (error) {
    console.error("Error fetching inventory:", error)
    return NextResponse.json({
      error: "Failed to fetch inventory"
    }, { status: 500 })
  }
}

// POST /api/inventory - Create new inventory item
export async function POST(request: NextRequest) {
  try {
    const session = await getServerAuth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!canManageInventory(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const validatedData = createInventorySchema.parse(body)

    // Check for duplicate barcode or SKU
    if (validatedData.barcode) {
      const existingBarcode = await prisma.inventoryItem.findUnique({
        where: { barcode: validatedData.barcode }
      })
      if (existingBarcode) {
        return NextResponse.json({
          error: "Barcode already exists"
        }, { status: 409 })
      }
    }

    if (validatedData.sku) {
      const existingSku = await prisma.inventoryItem.findUnique({
        where: { sku: validatedData.sku }
      })
      if (existingSku) {
        return NextResponse.json({
          error: "SKU already exists"
        }, { status: 409 })
      }
    }

    // Create the inventory item
    const inventoryItem = await prisma.inventoryItem.create({
      data: validatedData as any,
      include: {
        supplier: {
          select: { id: true, name: true }
        }
      }
    })

    // Create initial stock transaction if currentStock > 0
    if (validatedData.currentStock > 0) {
      await prisma.inventoryTransaction.create({
        data: {
          inventoryItemId: inventoryItem.id,
          type: 'restock',
          quantity: validatedData.currentStock,
          unitCost: validatedData.costPerUnit,
          totalCost: validatedData.currentStock * validatedData.costPerUnit,
          reason: 'Initial stock entry',
          performedBy: session.user.id,
          supplierId: validatedData.supplierId
        }
      })
    }

    // Log inventory creation
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        entityType: 'inventory_item',
        entityId: inventoryItem.id,
        action: 'create',
        newValues: validatedData
      }
    })

    return NextResponse.json({
      success: true,
      data: inventoryItem
    }, { status: 201 })

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        error: "Validation failed",
        details: error.errors
      }, { status: 400 })
    }

    console.error("Error creating inventory item:", error)
    return NextResponse.json({
      error: "Failed to create inventory item"
    }, { status: 500 })
  }
}

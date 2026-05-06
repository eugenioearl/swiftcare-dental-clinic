

import { NextRequest, NextResponse } from "next/server"
import { getServerAuth, canManageInventory } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { z } from "zod"

const updateInventorySchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  category: z.enum(['restorative', 'preventive', 'surgical', 'anesthetic', 'disposable', 'equipment', 'laboratory', 'orthodontic', 'endodontic', 'periodontic', 'oral_surgery', 'radiology', 'sterilization', 'office_supplies', 'other']).optional(),
  barcode: z.string().optional(),
  sku: z.string().optional(),
  minimumStock: z.number().int().min(0).optional(),
  maximumStock: z.number().int().min(0).optional(),
  unit: z.string().min(1).max(20).optional(),
  costPerUnit: z.number().min(0).optional(),
  sellingPrice: z.number().min(0).optional(),
  supplierId: z.string().uuid().optional(),
  location: z.string().max(100).optional(),
  expiryDate: z.string().transform((str) => new Date(str)).optional(),
  batchNumber: z.string().max(50).optional(),
  reorderPoint: z.number().int().min(0).optional(),
  notes: z.string().optional(),
  status: z.enum(['normal', 'low', 'critical', 'out_of_stock', 'discontinued', 'expired']).optional()
}).refine(data => Object.keys(data).length > 0, {
  message: "At least one field must be provided for update"
})

// GET /api/inventory/[id] - Get specific inventory item
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerAuth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!canManageInventory(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { id } = params

    const inventoryItem = await prisma.inventoryItem.findUnique({
      where: { id },
      include: {
        supplier: true,
        transactions: {
          orderBy: { createdAt: 'desc' },
          include: {
            user: { select: { firstName: true, lastName: true } },
            supplier: { select: { name: true } }
          }
        }
      }
    })

    if (!inventoryItem) {
      return NextResponse.json({ error: "Inventory item not found" }, { status: 404 })
    }

    // Calculate derived status
    let calculatedStatus = inventoryItem.status
    
    if (inventoryItem.currentStock <= inventoryItem.minimumStock && inventoryItem.currentStock > 0) {
      calculatedStatus = 'low'
    } else if (inventoryItem.currentStock === 0) {
      calculatedStatus = 'out_of_stock'
    } else if (inventoryItem.currentStock <= (inventoryItem.minimumStock * 0.5)) {
      calculatedStatus = 'critical'
    }

    if (inventoryItem.expiryDate && inventoryItem.expiryDate < new Date()) {
      calculatedStatus = 'expired'
    }

    return NextResponse.json({
      success: true,
      data: {
        ...inventoryItem,
        calculatedStatus,
        totalValue: Number(inventoryItem.currentStock) * Number(inventoryItem.costPerUnit)
      }
    })

  } catch (error) {
    console.error("Error fetching inventory item:", error)
    return NextResponse.json({
      error: "Failed to fetch inventory item"
    }, { status: 500 })
  }
}

// PUT /api/inventory/[id] - Update inventory item
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerAuth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!canManageInventory(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { id } = params
    const body = await request.json()
    const validatedData = updateInventorySchema.parse(body)

    const existingItem = await prisma.inventoryItem.findUnique({
      where: { id }
    })

    if (!existingItem) {
      return NextResponse.json({ error: "Inventory item not found" }, { status: 404 })
    }

    // Check for duplicate barcode or SKU (excluding current item)
    if (validatedData.barcode && validatedData.barcode !== existingItem.barcode) {
      const existingBarcode = await prisma.inventoryItem.findFirst({
        where: { 
          barcode: validatedData.barcode,
          id: { not: id }
        }
      })
      if (existingBarcode) {
        return NextResponse.json({
          error: "Barcode already exists"
        }, { status: 409 })
      }
    }

    if (validatedData.sku && validatedData.sku !== existingItem.sku) {
      const existingSku = await prisma.inventoryItem.findFirst({
        where: { 
          sku: validatedData.sku,
          id: { not: id }
        }
      })
      if (existingSku) {
        return NextResponse.json({
          error: "SKU already exists"
        }, { status: 409 })
      }
    }

    const updatedItem = await prisma.inventoryItem.update({
      where: { id },
      data: validatedData,
      include: {
        supplier: {
          select: { id: true, name: true }
        }
      }
    })

    // Log inventory update
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        entityType: 'inventory_item',
        entityId: id,
        action: 'update',
        oldValues: {
          name: existingItem.name,
          category: existingItem.category,
          currentStock: existingItem.currentStock,
          minimumStock: existingItem.minimumStock,
          costPerUnit: existingItem.costPerUnit.toString(),
          status: existingItem.status
        },
        newValues: validatedData
      }
    })

    return NextResponse.json({
      success: true,
      data: updatedItem
    })

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        error: "Validation failed",
        details: error.errors
      }, { status: 400 })
    }

    console.error("Error updating inventory item:", error)
    return NextResponse.json({
      error: "Failed to update inventory item"
    }, { status: 500 })
  }
}

// DELETE /api/inventory/[id] - Delete inventory item
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerAuth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!canManageInventory(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { id } = params
    const { searchParams } = new URL(request.url)
    const hardDelete = searchParams.get('hard') === 'true'

    const existingItem = await prisma.inventoryItem.findUnique({
      where: { id },
      include: {
        transactions: { take: 1 },
        treatmentUsage: { take: 1 },
        appointmentTreatments: { take: 1 }
      }
    })

    if (!existingItem) {
      return NextResponse.json({ error: "Inventory item not found" }, { status: 404 })
    }

    // Check if item has related records
    const hasTransactions = existingItem.transactions.length > 0
    const hasUsage = existingItem.treatmentUsage.length > 0 || existingItem.appointmentTreatments.length > 0

    if (hasTransactions || hasUsage) {
      if (hardDelete) {
        return NextResponse.json({
          error: "Cannot permanently delete inventory item with transaction history"
        }, { status: 409 })
      }

      // Soft delete - mark as inactive
      await prisma.inventoryItem.update({
        where: { id },
        data: { isActive: false }
      })
    } else {
      // Hard delete if no related records
      await prisma.inventoryItem.delete({
        where: { id }
      })
    }

    // Log inventory deletion
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        entityType: 'inventory_item',
        entityId: id,
        action: 'delete',
        oldValues: {
          name: existingItem.name,
          category: existingItem.category,
          currentStock: existingItem.currentStock,
          isActive: existingItem.isActive
        }
      }
    })

    return NextResponse.json({
      success: true,
      message: hasTransactions || hasUsage ? "Inventory item deactivated" : "Inventory item deleted"
    })

  } catch (error) {
    console.error("Error deleting inventory item:", error)
    return NextResponse.json({
      error: "Failed to delete inventory item"
    }, { status: 500 })
  }
}

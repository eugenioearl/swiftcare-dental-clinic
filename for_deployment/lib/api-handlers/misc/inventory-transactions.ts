

import { NextRequest, NextResponse } from "next/server"
import { getServerAuth, canManageInventory } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { z } from "zod"

const createTransactionSchema = z.object({
  inventoryItemId: z.string().uuid(),
  type: z.enum(['usage', 'restock', 'adjustment', 'transfer', 'waste', 'return']),
  quantity: z.number().int().min(1), // Always positive, direction determined by type
  unitCost: z.number().min(0).optional(),
  reason: z.string().optional(),
  referenceId: z.string().uuid().optional(),
  referenceType: z.string().max(50).optional(),
  batchNumber: z.string().max(50).optional(),
  expiryDate: z.string().transform((str) => new Date(str)).optional(),
  supplierId: z.string().uuid().optional(),
  notes: z.string().optional()
})

// GET /api/inventory/transactions - List inventory transactions
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
    const inventoryItemId = searchParams.get('itemId')
    const type = searchParams.get('type')
    const userId = searchParams.get('userId')
    const dateFrom = searchParams.get('from')
    const dateTo = searchParams.get('to')

    const skip = (page - 1) * limit

    // Build where clause
    let whereClause: any = {}

    if (inventoryItemId) {
      whereClause.inventoryItemId = inventoryItemId
    }

    if (type) {
      whereClause.type = type
    }

    if (userId) {
      whereClause.performedBy = userId
    }

    if (dateFrom || dateTo) {
      whereClause.createdAt = {}
      if (dateFrom) {
        whereClause.createdAt.gte = new Date(dateFrom)
      }
      if (dateTo) {
        whereClause.createdAt.lte = new Date(dateTo)
      }
    }

    const [transactions, total] = await Promise.all([
      prisma.inventoryTransaction.findMany({
        where: whereClause,
        include: {
          inventoryItem: {
            select: {
              id: true,
              name: true,
              unit: true,
              category: true
            }
          },
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              role: true
            }
          },
          supplier: {
            select: {
              id: true,
              name: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit
      }),
      prisma.inventoryTransaction.count({ where: whereClause })
    ])

    // Format transactions with computed quantities
    const formattedTransactions = transactions.map(transaction => {
      // Convert quantity to signed value based on type
      const signedQuantity = ['usage', 'waste', 'transfer'].includes(transaction.type) 
        ? -transaction.quantity 
        : transaction.quantity

      return {
        ...transaction,
        signedQuantity,
        totalCost: transaction.totalCost || (transaction.quantity * (Number(transaction.unitCost) || 0))
      }
    })

    return NextResponse.json({
      success: true,
      data: {
        transactions: formattedTransactions,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      }
    })

  } catch (error) {
    console.error("Error fetching inventory transactions:", error)
    return NextResponse.json({
      error: "Failed to fetch inventory transactions"
    }, { status: 500 })
  }
}

// POST /api/inventory/transactions - Create new inventory transaction
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
    const validatedData = createTransactionSchema.parse(body)

    // Get current inventory item
    const inventoryItem = await prisma.inventoryItem.findUnique({
      where: { id: validatedData.inventoryItemId }
    })

    if (!inventoryItem) {
      return NextResponse.json({
        error: "Inventory item not found"
      }, { status: 404 })
    }

    // Calculate signed quantity based on transaction type
    const signedQuantity = ['usage', 'waste', 'transfer'].includes(validatedData.type) 
      ? -validatedData.quantity 
      : validatedData.quantity

    // Check if we have sufficient stock for outgoing transactions
    if (signedQuantity < 0 && inventoryItem.currentStock < validatedData.quantity) {
      return NextResponse.json({
        error: "Insufficient stock for this transaction"
      }, { status: 400 })
    }

    // Calculate costs
    const unitCost = validatedData.unitCost || inventoryItem.costPerUnit
    const totalCost = validatedData.quantity * Number(unitCost)

    // Create transaction and update stock in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create the transaction record
      const transaction = await tx.inventoryTransaction.create({
        data: {
          ...validatedData,
          quantity: signedQuantity, // Store as signed quantity
          unitCost,
          totalCost,
          performedBy: session.user!.id
        } as any,
        include: {
          inventoryItem: {
            select: { name: true, unit: true }
          },
          user: {
            select: { firstName: true, lastName: true }
          }
        }
      })

      // Update inventory stock
      const newStock = inventoryItem.currentStock + signedQuantity
      const updatedItem = await tx.inventoryItem.update({
        where: { id: validatedData.inventoryItemId },
        data: {
          currentStock: newStock,
          lastRestocked: validatedData.type === 'restock' ? new Date() : inventoryItem.lastRestocked
        }
      })

      // Update status based on new stock level
      let newStatus: 'normal' | 'low' | 'critical' | 'out_of_stock' = 'normal'
      if (newStock === 0) {
        newStatus = 'out_of_stock'
      } else if (newStock <= updatedItem.minimumStock) {
        newStatus = 'low'
      } else if (newStock <= (updatedItem.minimumStock * 0.5)) {
        newStatus = 'critical'
      }

      if (newStatus !== updatedItem.status) {
        await tx.inventoryItem.update({
          where: { id: validatedData.inventoryItemId },
          data: { status: newStatus }
        })
      }

      return transaction
    })

    // Log inventory transaction
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        entityType: 'inventory_transaction',
        entityId: result.id,
        action: 'create',
        newValues: {
          type: validatedData.type,
          quantity: validatedData.quantity,
          inventoryItemName: inventoryItem.name
        }
      }
    })

    return NextResponse.json({
      success: true,
      data: result
    }, { status: 201 })

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        error: "Validation failed",
        details: error.errors
      }, { status: 400 })
    }

    console.error("Error creating inventory transaction:", error)
    return NextResponse.json({
      error: "Failed to create inventory transaction"
    }, { status: 500 })
  }
}

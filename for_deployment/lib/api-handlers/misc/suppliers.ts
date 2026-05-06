

import { NextRequest, NextResponse } from "next/server"
import { getServerAuth, canManageInventory } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { z } from "zod"

const createSupplierSchema = z.object({
  name: z.string().min(1).max(200),
  contactPerson: z.string().max(100).optional(),
  email: z.string().email().optional(),
  phone: z.string().max(20).optional(),
  address: z.string().optional(),
  website: z.string().url().optional(),
  notes: z.string().optional()
})

const updateSupplierSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  contactPerson: z.string().max(100).optional(),
  email: z.string().email().optional(),
  phone: z.string().max(20).optional(),
  address: z.string().optional(),
  website: z.string().url().optional(),
  notes: z.string().optional(),
  isActive: z.boolean().optional()
}).refine(data => Object.keys(data).length > 0, {
  message: "At least one field must be provided for update"
})

// GET /api/suppliers - List suppliers
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
    const activeOnly = searchParams.get('active') !== 'false'

    const skip = (page - 1) * limit

    let whereClause: any = {}

    if (activeOnly) {
      whereClause.isActive = true
    }

    if (search) {
      whereClause.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { contactPerson: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } }
      ]
    }

    const [suppliers, total] = await Promise.all([
      prisma.supplier.findMany({
        where: whereClause,
        include: {
          inventoryItems: {
            where: { isActive: true },
            select: {
              id: true,
              name: true,
              currentStock: true,
              costPerUnit: true
            }
          },
          _count: {
            select: {
              inventoryItems: { where: { isActive: true } },
              transactions: true
            }
          }
        },
        orderBy: { name: 'asc' },
        skip,
        take: limit
      }),
      prisma.supplier.count({ where: whereClause })
    ])

    // Calculate summary stats for each supplier
    const suppliersWithStats = suppliers.map(supplier => {
      const totalItems = supplier._count.inventoryItems
      const totalTransactions = supplier._count.transactions
      const totalValue = supplier.inventoryItems.reduce((sum, item) => 
        sum + (Number(item.currentStock) * Number(item.costPerUnit)), 0
      )

      return {
        ...supplier,
        stats: {
          totalItems,
          totalTransactions,
          totalValue
        }
      }
    })

    return NextResponse.json({
      success: true,
      data: {
        suppliers: suppliersWithStats,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      }
    })

  } catch (error) {
    console.error("Error fetching suppliers:", error)
    return NextResponse.json({
      error: "Failed to fetch suppliers"
    }, { status: 500 })
  }
}

// POST /api/suppliers - Create new supplier
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
    const validatedData = createSupplierSchema.parse(body)

    // Check for duplicate name
    const existingSupplier = await prisma.supplier.findFirst({
      where: { name: validatedData.name }
    })

    if (existingSupplier) {
      return NextResponse.json({
        error: "Supplier with this name already exists"
      }, { status: 409 })
    }

    const supplier = await prisma.supplier.create({
      data: validatedData as any
    })

    // Log supplier creation
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        entityType: 'supplier',
        entityId: supplier.id,
        action: 'create',
        newValues: validatedData
      }
    })

    return NextResponse.json({
      success: true,
      data: supplier
    }, { status: 201 })

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        error: "Validation failed",
        details: error.errors
      }, { status: 400 })
    }

    console.error("Error creating supplier:", error)
    return NextResponse.json({
      error: "Failed to create supplier"
    }, { status: 500 })
  }
}



import { NextRequest, NextResponse } from "next/server"
import { getServerAuth, canManageSettings } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { z } from "zod"

const updateSettingSchema = z.object({
  settingValue: z.string().optional(),
  description: z.string().optional(),
  isPublic: z.boolean().optional(),
  isEncrypted: z.boolean().optional(),
  validationRules: z.any().optional()
}).refine(data => Object.keys(data).length > 0, {
  message: "At least one field must be provided for update"
})

// GET /api/settings/[id] - Get specific setting
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerAuth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = params

    let whereClause: any = { id }

    // Non-admin users can only see public settings
    if (!canManageSettings(session.user.role)) {
      whereClause.isPublic = true
    }

    const setting = await prisma.systemSetting.findFirst({
      where: whereClause
    })

    if (!setting) {
      return NextResponse.json({ error: "Setting not found" }, { status: 404 })
    }

    // Parse value based on dataType
    let parsedValue: any = setting.settingValue
    try {
      switch (setting.dataType) {
        case 'integer':
          parsedValue = parseInt(setting.settingValue)
          break
        case 'decimal':
          parsedValue = parseFloat(setting.settingValue)
          break
        case 'boolean':
          parsedValue = setting.settingValue === 'true'
          break
        case 'json':
          parsedValue = JSON.parse(setting.settingValue)
          break
        case 'date':
          parsedValue = new Date(setting.settingValue)
          break
        default:
          parsedValue = setting.settingValue
      }
    } catch (error) {
      console.warn(`Failed to parse setting ${setting.settingKey}:`, error)
      parsedValue = setting.settingValue
    }

    return NextResponse.json({
      success: true,
      data: {
        id: setting.id,
        settingKey: setting.settingKey,
        settingValue: setting.settingValue,
        description: setting.description,
        dataType: setting.dataType,
        isPublic: setting.isPublic,
        isEncrypted: setting.isEncrypted,
        validationRules: setting.validationRules,
        createdAt: setting.createdAt,
        updatedAt: setting.updatedAt,
        parsedValue
      }
    })

  } catch (error) {
    console.error("Error fetching setting:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// PUT /api/settings/[id] - Update specific setting
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerAuth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!canManageSettings(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { id } = params
    const body = await request.json()
    const validatedData = updateSettingSchema.parse(body)

    // Check if setting exists
    const existingSetting = await prisma.systemSetting.findUnique({
      where: { id }
    })

    if (!existingSetting) {
      return NextResponse.json({ error: "Setting not found" }, { status: 404 })
    }

    // Validate new value based on dataType if value is being updated
    if (validatedData.settingValue !== undefined) {
      try {
        switch (existingSetting.dataType) {
          case 'integer':
            if (isNaN(parseInt(validatedData.settingValue))) {
              throw new Error("Invalid integer value")
            }
            break
          case 'decimal':
            if (isNaN(parseFloat(validatedData.settingValue))) {
              throw new Error("Invalid decimal value")
            }
            break
          case 'boolean':
            if (!['true', 'false'].includes(validatedData.settingValue.toLowerCase())) {
              throw new Error("Boolean value must be 'true' or 'false'")
            }
            validatedData.settingValue = validatedData.settingValue.toLowerCase()
            break
          case 'json':
            JSON.parse(validatedData.settingValue) // Validate JSON
            break
          case 'date':
            if (isNaN(Date.parse(validatedData.settingValue))) {
              throw new Error("Invalid date value")
            }
            break
        }
      } catch (error: any) {
        return NextResponse.json({
          error: `Invalid value for data type ${existingSetting.dataType}: ${error.message}`
        }, { status: 400 })
      }
    }

    const updatedSetting = await prisma.systemSetting.update({
      where: { id },
      data: validatedData
    })

    // Log setting update
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        entityType: 'system_setting',
        entityId: id,
        action: 'update',
        oldValues: {
          settingValue: existingSetting.settingValue,
          description: existingSetting.description,
          isPublic: existingSetting.isPublic
        },
        newValues: validatedData
      }
    })

    return NextResponse.json({
      success: true,
      data: updatedSetting
    })

  } catch (error) {
    console.error("Error updating setting:", error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        error: "Validation error",
        details: error.errors
      }, { status: 400 })
    }

    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// DELETE /api/settings/[id] - Delete specific setting
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerAuth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!canManageSettings(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { id } = params

    // Check if setting exists
    const existingSetting = await prisma.systemSetting.findUnique({
      where: { id }
    })

    if (!existingSetting) {
      return NextResponse.json({ error: "Setting not found" }, { status: 404 })
    }

    await prisma.systemSetting.delete({
      where: { id }
    })

    // Log setting deletion
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        entityType: 'system_setting',
        entityId: id,
        action: 'delete',
        oldValues: {
          settingKey: existingSetting.settingKey,
          settingValue: existingSetting.settingValue
        }
      }
    })

    return NextResponse.json({
      success: true,
      message: "Setting deleted successfully"
    })

  } catch (error) {
    console.error("Error deleting setting:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}


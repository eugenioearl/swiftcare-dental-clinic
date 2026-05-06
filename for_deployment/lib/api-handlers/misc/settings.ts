

import { NextRequest, NextResponse } from "next/server"
import { getServerAuth, canManageSettings } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { z } from "zod"

const createSettingSchema = z.object({
  settingKey: z.string().min(1).max(100),
  settingValue: z.string(),
  dataType: z.enum(['string', 'integer', 'decimal', 'boolean', 'json', 'date', 'time']).default('string'),
  description: z.string().optional(),
  isPublic: z.boolean().default(false),
  isEncrypted: z.boolean().default(false),
  validationRules: z.any().optional()
})

const updateSettingSchema = z.object({
  settingValue: z.string(),
  description: z.string().optional(),
  isPublic: z.boolean().optional(),
  isEncrypted: z.boolean().optional(),
  validationRules: z.any().optional()
})

// GET /api/settings - List settings
export async function GET(request: NextRequest) {
  try {
    const session = await getServerAuth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const isPublic = searchParams.get('isPublic')
    const includeAll = searchParams.get('includeAll') === 'true'

    let whereClause: any = {}

    // Non-admin users can only see public settings
    if (!canManageSettings(session.user.role) && !includeAll) {
      whereClause.isPublic = true
    }

    if (isPublic !== null) {
      whereClause.isPublic = isPublic === 'true'
    }

    const settings = await prisma.systemSetting.findMany({
      where: whereClause,
      orderBy: [
        { settingKey: 'asc' }
      ]
    })

    // Parse values based on dataType for easier consumption
    const parsedSettings = settings.map(setting => {
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

      return {
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

    return NextResponse.json({
      success: true,
      data: {
        settings: parsedSettings,
        rawSettings: settings
      }
    })

  } catch (error) {
    console.error("Error fetching settings:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// POST /api/settings - Create new setting
export async function POST(request: NextRequest) {
  try {
    const session = await getServerAuth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!canManageSettings(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const validatedData = createSettingSchema.parse(body)

    // Check if setting key already exists
    const existingSetting = await prisma.systemSetting.findUnique({
      where: { settingKey: validatedData.settingKey }
    })

    if (existingSetting) {
      return NextResponse.json({
        error: "Setting with this key already exists"
      }, { status: 409 })
    }

    // Validate value based on dataType
    try {
      switch (validatedData.dataType) {
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
        error: `Invalid value for data type ${validatedData.dataType}: ${error.message}`
      }, { status: 400 })
    }

    const setting = await prisma.systemSetting.create({
      data: validatedData as any
    })

    // Log setting creation
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        entityType: 'system_setting',
        entityId: setting.id,
        action: 'create',
        newValues: {
          settingKey: setting.settingKey,
          settingValue: setting.settingValue,
          dataType: setting.dataType
        }
      }
    })

    return NextResponse.json({
      success: true,
      data: setting
    }, { status: 201 })

  } catch (error) {
    console.error("Error creating setting:", error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        error: "Validation error",
        details: error.errors
      }, { status: 400 })
    }

    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}


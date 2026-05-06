import { NextRequest, NextResponse } from 'next/server'
import { getServerAuth, canManageSettings } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { DEFAULT_CONSENT_TEMPLATE } from '@/lib/api-handlers/patients/id-consents'

const SETTING_KEY = 'consent_default_template'

// GET /api/consent-template — returns the current default consent template body.
export async function GET(_request: NextRequest) {
  try {
    const session = await getServerAuth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const setting = await prisma.systemSetting.findUnique({
      where: { settingKey: SETTING_KEY }
    })

    const value = setting?.settingValue && setting.settingValue.trim().length > 0
      ? setting.settingValue
      : DEFAULT_CONSENT_TEMPLATE

    return NextResponse.json({
      template: value,
      isDefault: !setting,
      updatedAt: setting?.updatedAt || null,
      variables: [
        'patientName', 'date', 'packageTitle', 'procedures',
        'totalAmount', 'coveredAmount', 'patientPayable', 'balanceDue',
        'financialSummary'
      ]
    })
  } catch (err) {
    console.error('Error loading consent template:', err)
    return NextResponse.json({ error: 'Failed to load consent template' }, { status: 500 })
  }
}

// PUT /api/consent-template — updates (or creates) the default consent template.
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerAuth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (!canManageSettings(session.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json().catch(() => ({}))
    const template = typeof body?.template === 'string' ? body.template : ''

    if (!template.trim()) {
      return NextResponse.json({ error: 'Template content is required' }, { status: 400 })
    }

    const setting = await prisma.systemSetting.upsert({
      where: { settingKey: SETTING_KEY },
      update: { settingValue: template },
      create: {
        settingKey: SETTING_KEY,
        settingValue: template,
        dataType: 'string',
        description: 'Default body content for generated patient consent forms. Supports {{variable}} interpolation.',
        isPublic: false,
      }
    })

    try {
      await prisma.auditLog.create({
        data: {
          userId: session.user.id,
          entityType: 'system_setting',
          entityId: setting.id,
          action: 'update',
          newValues: { settingKey: SETTING_KEY, length: template.length } as any,
        }
      })
    } catch { /* non-fatal */ }

    return NextResponse.json({ template: setting.settingValue, updatedAt: setting.updatedAt })
  } catch (err) {
    console.error('Error updating consent template:', err)
    return NextResponse.json({ error: 'Failed to update consent template' }, { status: 500 })
  }
}

// POST /api/consent-template/reset — reverts to built-in default by deleting the setting.
export async function POST(_request: NextRequest) {
  try {
    const session = await getServerAuth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (!canManageSettings(session.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await prisma.systemSetting.deleteMany({ where: { settingKey: SETTING_KEY } })
    return NextResponse.json({ template: DEFAULT_CONSENT_TEMPLATE, isDefault: true })
  } catch (err) {
    console.error('Error resetting consent template:', err)
    return NextResponse.json({ error: 'Failed to reset consent template' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { getServerAuth, isAdminRole } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getDefaultClinicHours } from '@/lib/clinic-hours'

// GET /api/clinic-hours/defaults - Get default clinic hours
export async function GET() {
  try {
    const defaults = await getDefaultClinicHours()
    return NextResponse.json({ success: true, data: defaults })
  } catch (error) {
    console.error('Error fetching default clinic hours:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/clinic-hours/defaults - Update default clinic hours
export async function POST(request: NextRequest) {
  try {
    const session = await getServerAuth()
    if (!session?.user || !isAdminRole(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { openTime, closeTime } = await request.json()

    if (!openTime || !closeTime) {
      return NextResponse.json({ error: 'Both openTime and closeTime are required' }, { status: 400 })
    }

    if (openTime >= closeTime) {
      return NextResponse.json({ error: 'Opening time must be before closing time' }, { status: 400 })
    }

    // Upsert both settings
    await Promise.all([
      prisma.systemSetting.upsert({
        where: { settingKey: 'default_clinic_open_time' },
        update: { settingValue: openTime },
        create: {
          settingKey: 'default_clinic_open_time',
          settingValue: openTime,
          dataType: 'time',
          description: 'Default daily clinic opening time (HH:mm)',
          isPublic: true
        }
      }),
      prisma.systemSetting.upsert({
        where: { settingKey: 'default_clinic_close_time' },
        update: { settingValue: closeTime },
        create: {
          settingKey: 'default_clinic_close_time',
          settingValue: closeTime,
          dataType: 'time',
          description: 'Default daily clinic closing time (HH:mm)',
          isPublic: true
        }
      })
    ])

    return NextResponse.json({ success: true, data: { openTime, closeTime } })
  } catch (error) {
    console.error('Error saving default clinic hours:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

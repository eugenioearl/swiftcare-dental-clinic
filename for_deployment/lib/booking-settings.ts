import { prisma } from '@/lib/db'
import { getClinicDayOfWeek } from '@/lib/clinic-hours'

export interface BookingSettings {
  /** When false, only 1 appointment per timeslot is allowed. */
  doubleBookingEnabled: boolean
  /** Max concurrent appointments per timeslot (only applies when enabled). */
  maxPerSlot: number
  /** Where the resolved settings came from (for debugging / UI hints). */
  source: 'date_override' | 'weekly' | 'global'
  /** Optional reason text for date overrides. */
  reason?: string | null
}

export interface DoubleBookingDayConfig {
  enabled: boolean
  maxPerSlot: number
}

/** Per day-of-week (0=Sun..6=Sat) double-booking limits. */
export type WeeklyDoubleBookingConfig = Record<number, DoubleBookingDayConfig>

const DEFAULT_GLOBAL: { doubleBookingEnabled: boolean; maxPerSlot: number } = {
  doubleBookingEnabled: true,
  maxPerSlot: 3,
}

const WEEKLY_SETTING_KEY = 'double_booking_weekly_defaults'

/**
 * Read the global default double-booking settings from SystemSetting.
 * Returns safe defaults if not configured.
 */
export async function getGlobalDoubleBookingSettings(): Promise<{
  doubleBookingEnabled: boolean
  maxPerSlot: number
}> {
  try {
    const rows = await prisma.systemSetting.findMany({
      where: {
        settingKey: {
          in: ['double_booking_enabled', 'double_booking_max_per_slot'],
        },
      },
    })

    const map = new Map(rows.map((r) => [r.settingKey, r.settingValue]))

    const rawEnabled = map.get('double_booking_enabled')
    const rawMax = map.get('double_booking_max_per_slot')

    const doubleBookingEnabled =
      rawEnabled === undefined ? DEFAULT_GLOBAL.doubleBookingEnabled : rawEnabled === 'true'

    let maxPerSlot = DEFAULT_GLOBAL.maxPerSlot
    if (rawMax !== undefined) {
      const parsed = parseInt(rawMax, 10)
      if (!isNaN(parsed) && parsed >= 1) maxPerSlot = parsed
    }

    return { doubleBookingEnabled, maxPerSlot }
  } catch (err) {
    console.error('Failed to read global double-booking settings:', err)
    return DEFAULT_GLOBAL
  }
}

/**
 * Build a weekly config where every weekday inherits the same baseline.
 */
function buildDefaultWeek(baseline: { doubleBookingEnabled: boolean; maxPerSlot: number }): WeeklyDoubleBookingConfig {
  const week: WeeklyDoubleBookingConfig = {} as any
  for (let i = 0; i < 7; i++) {
    week[i] = { enabled: baseline.doubleBookingEnabled, maxPerSlot: baseline.maxPerSlot }
  }
  return week
}

/**
 * Read the per-weekday double-booking config from SystemSetting (JSON blob).
 * Falls back to a uniform week derived from the global default.
 */
export async function getWeeklyDoubleBookingConfig(): Promise<WeeklyDoubleBookingConfig> {
  const baseline = await getGlobalDoubleBookingSettings()
  try {
    const setting = await prisma.systemSetting.findUnique({
      where: { settingKey: WEEKLY_SETTING_KEY },
    })
    if (setting?.settingValue) {
      try {
        const parsed = JSON.parse(setting.settingValue)
        const week = buildDefaultWeek(baseline)
        for (let i = 0; i < 7; i++) {
          const entry = parsed[i] ?? parsed[String(i)]
          if (entry && typeof entry === 'object') {
            const max = parseInt(String(entry.maxPerSlot ?? entry.max_per_slot), 10)
            week[i] = {
              enabled: entry.enabled === undefined ? baseline.doubleBookingEnabled : !!entry.enabled,
              maxPerSlot: !isNaN(max) && max >= 1 ? max : baseline.maxPerSlot,
            }
          }
        }
        return week
      } catch {
        // Fall through to baseline
      }
    }
    return buildDefaultWeek(baseline)
  } catch (err) {
    console.error('Failed to read weekly double-booking config:', err)
    return buildDefaultWeek(baseline)
  }
}

/**
 * Persist the per-weekday double-booking config (admin only).
 */
export async function saveWeeklyDoubleBookingConfig(week: WeeklyDoubleBookingConfig): Promise<void> {
  const baseline = await getGlobalDoubleBookingSettings()
  const normalized: WeeklyDoubleBookingConfig = {} as any
  for (let i = 0; i < 7; i++) {
    const entry = week[i] ?? (week as any)[String(i)]
    if (entry) {
      const max = parseInt(String(entry.maxPerSlot), 10)
      normalized[i] = {
        enabled: !!entry.enabled,
        maxPerSlot: !isNaN(max) && max >= 1 ? max : baseline.maxPerSlot,
      }
    } else {
      normalized[i] = { enabled: baseline.doubleBookingEnabled, maxPerSlot: baseline.maxPerSlot }
    }
  }
  await prisma.systemSetting.upsert({
    where: { settingKey: WEEKLY_SETTING_KEY },
    update: { settingValue: JSON.stringify(normalized) },
    create: {
      settingKey: WEEKLY_SETTING_KEY,
      settingValue: JSON.stringify(normalized),
      dataType: 'json',
      description: 'Per day-of-week double-booking limits (keys 0-6 = Sunday..Saturday)',
      isPublic: true,
    },
  })
}

/**
 * Reads the admin-configurable double-booking settings.
 *
 * Resolution order (when `date` is provided):
 *   1. DoubleBookingOverride for that exact date
 *   2. Weekly day-of-week config
 *   3. Global default (legacy single value)
 *
 * When no date is provided, returns the global default (backward compatible).
 */
export async function getBookingSettings(date?: Date | string | null): Promise<BookingSettings> {
  try {
    // No date given: legacy global behaviour.
    if (!date) {
      const global = await getGlobalDoubleBookingSettings()
      let maxPerSlot = global.maxPerSlot
      if (!global.doubleBookingEnabled) maxPerSlot = 1
      return {
        doubleBookingEnabled: global.doubleBookingEnabled,
        maxPerSlot,
        source: 'global',
      }
    }

    const target = typeof date === 'string' ? new Date(date) : date

    // 1) Date-specific override.
    // Build a Date representing UTC midnight on the calendar date of `target`
    // (using local components, so the override matches the local clinic date).
    // This avoids the timezone drift caused by `setHours(0,0,0,0)` on dates parsed from
    // ISO strings (which JS interprets as UTC).
    const dateOnly = new Date(Date.UTC(target.getFullYear(), target.getMonth(), target.getDate()))
    let override = null as null | { enabled: boolean; maxPerSlot: number; reason: string | null }
    try {
      const row = await prisma.doubleBookingOverride.findFirst({
        where: { date: dateOnly },
      })
      if (row) {
        override = {
          enabled: row.enabled,
          maxPerSlot: row.maxPerSlot,
          reason: row.reason ?? null,
        }
      }
    } catch (err) {
      // Table may not exist on first deploy; fall through silently
      console.warn('DoubleBookingOverride lookup failed (will fall back):', err)
    }

    if (override) {
      const enabled = override.enabled
      const maxPerSlot = enabled ? Math.max(1, override.maxPerSlot) : 1
      return {
        doubleBookingEnabled: enabled,
        maxPerSlot,
        source: 'date_override',
        reason: override.reason,
      }
    }

    // 2) Weekly day-of-week config
    try {
      const week = await getWeeklyDoubleBookingConfig()
      const dow = getClinicDayOfWeek(target)
      const dayCfg = week[dow]
      if (dayCfg) {
        const enabled = dayCfg.enabled
        const maxPerSlot = enabled ? Math.max(1, dayCfg.maxPerSlot) : 1
        return {
          doubleBookingEnabled: enabled,
          maxPerSlot,
          source: 'weekly',
        }
      }
    } catch (err) {
      console.warn('Weekly double-booking lookup failed:', err)
    }

    // 3) Global default (legacy fallback)
    const global = await getGlobalDoubleBookingSettings()
    let maxPerSlot = global.maxPerSlot
    if (!global.doubleBookingEnabled) maxPerSlot = 1
    return {
      doubleBookingEnabled: global.doubleBookingEnabled,
      maxPerSlot,
      source: 'global',
    }
  } catch (err) {
    console.error('Failed to read booking settings, using defaults:', err)
    return {
      doubleBookingEnabled: DEFAULT_GLOBAL.doubleBookingEnabled,
      maxPerSlot: DEFAULT_GLOBAL.maxPerSlot,
      source: 'global',
    }
  }
}

/** Effective max bookings per timeslot, applying the enabled toggle. */
export function effectiveMaxPerSlot(settings: BookingSettings): number {
  return settings.doubleBookingEnabled ? Math.max(1, settings.maxPerSlot) : 1
}

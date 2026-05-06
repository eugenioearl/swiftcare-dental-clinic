import { prisma } from '@/lib/db'

export interface ClinicHoursForDate {
  openTime: string   // "HH:mm"
  closeTime: string  // "HH:mm"
  isClosed: boolean
  reason?: string | null
  isDefault: boolean // true if using default (day-of-week OR global) hours (no date-specific override)
  source: 'date_override' | 'weekly' | 'global_default' | 'fallback'
}

export interface DefaultClinicHours {
  openTime: string
  closeTime: string
}

export interface WeekdayClinicHours {
  openTime: string
  closeTime: string
  isClosed: boolean
}

// Day-of-week maps to JS Date.getDay(): 0 = Sunday, 1 = Monday, ..., 6 = Saturday
export type WeeklyClinicHours = Record<number, WeekdayClinicHours>

// Hardcoded fallback if no DB setting exists
const FALLBACK_OPEN = '09:00'
const FALLBACK_CLOSE = '18:00'

const CLINIC_TZ = 'Asia/Manila'

/**
 * Get the start and end of "today" in the clinic's Manila timezone.
 * Returns UTC Date objects representing midnight and 23:59:59 in Manila.
 */
export function getClinicTodayRange(): { startOfDay: Date; endOfDay: Date } {
  const now = new Date()
  const manilaDateStr = now.toLocaleDateString('en-CA', { timeZone: CLINIC_TZ }) // YYYY-MM-DD
  return {
    startOfDay: new Date(`${manilaDateStr}T00:00:00.000+08:00`),
    endOfDay: new Date(`${manilaDateStr}T23:59:59.999+08:00`),
  }
}

/**
 * Get the Manila date string (YYYY-MM-DD) for "today".
 */
export function getClinicTodayStr(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: CLINIC_TZ })
}

export { CLINIC_TZ }

// Setting key for the JSON blob holding per-day-of-week defaults
const WEEKLY_SETTING_KEY = 'default_clinic_hours_week'

/**
 * Compute the day-of-week (0-6, Sunday=0) for a given date **in clinic timezone**.
 */
export function getClinicDayOfWeek(date: Date): number {
  // Intl doesn't expose numeric day directly, so map from short weekday name
  const name = new Intl.DateTimeFormat('en-US', {
    timeZone: CLINIC_TZ,
    weekday: 'short',
  }).format(date)
  const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
  return map[name] ?? 0
}

/**
 * Build the default weekly schedule (used when nothing has been configured yet).
 * Sunday defaults to closed; weekdays/Saturday open 9AM-6PM.
 */
function buildDefaultWeek(openTime = FALLBACK_OPEN, closeTime = FALLBACK_CLOSE): WeeklyClinicHours {
  const week: WeeklyClinicHours = {} as any
  for (let i = 0; i < 7; i++) {
    week[i] = {
      openTime,
      closeTime,
      isClosed: i === 0, // Sunday closed by default
    }
  }
  return week
}

/**
 * Get the (legacy) global default clinic hours from SystemSetting.
 * Falls back to 9AM-6PM if not configured.
 * Kept for backward compatibility and as a fallback source for weekly defaults.
 */
export async function getDefaultClinicHours(): Promise<DefaultClinicHours> {
  try {
    const [openSetting, closeSetting] = await Promise.all([
      prisma.systemSetting.findUnique({ where: { settingKey: 'default_clinic_open_time' } }),
      prisma.systemSetting.findUnique({ where: { settingKey: 'default_clinic_close_time' } }),
    ])
    return {
      openTime: openSetting?.settingValue || FALLBACK_OPEN,
      closeTime: closeSetting?.settingValue || FALLBACK_CLOSE,
    }
  } catch {
    return { openTime: FALLBACK_OPEN, closeTime: FALLBACK_CLOSE }
  }
}

/**
 * Get the weekly clinic hours configuration (per day-of-week).
 * Falls back to the legacy global default applied to each day if the weekly setting is absent.
 */
export async function getWeeklyClinicHours(): Promise<WeeklyClinicHours> {
  try {
    const setting = await prisma.systemSetting.findUnique({
      where: { settingKey: WEEKLY_SETTING_KEY },
    })
    if (setting?.settingValue) {
      try {
        const parsed = JSON.parse(setting.settingValue)
        // Normalize: ensure we have 0-6 keys and fill missing ones from legacy defaults
        const legacy = await getDefaultClinicHours()
        const week = buildDefaultWeek(legacy.openTime, legacy.closeTime)
        for (let i = 0; i < 7; i++) {
          const entry = parsed[i] ?? parsed[String(i)]
          if (entry && typeof entry === 'object') {
            week[i] = {
              openTime: entry.openTime || legacy.openTime,
              closeTime: entry.closeTime || legacy.closeTime,
              isClosed: !!entry.isClosed,
            }
          }
        }
        return week
      } catch {
        // Fall through to legacy defaults
      }
    }
    // No weekly setting - use legacy single default for every day (Sunday still closed by default)
    const legacy = await getDefaultClinicHours()
    return buildDefaultWeek(legacy.openTime, legacy.closeTime)
  } catch {
    return buildDefaultWeek()
  }
}

/**
 * Save the weekly clinic hours configuration.
 */
export async function saveWeeklyClinicHours(week: WeeklyClinicHours): Promise<void> {
  // Normalize — only keep keys 0-6 with required fields
  const normalized: WeeklyClinicHours = {} as any
  for (let i = 0; i < 7; i++) {
    const entry = week[i] ?? week[String(i) as any]
    if (entry) {
      normalized[i] = {
        openTime: entry.openTime || FALLBACK_OPEN,
        closeTime: entry.closeTime || FALLBACK_CLOSE,
        isClosed: !!entry.isClosed,
      }
    } else {
      normalized[i] = { openTime: FALLBACK_OPEN, closeTime: FALLBACK_CLOSE, isClosed: i === 0 }
    }
  }
  await prisma.systemSetting.upsert({
    where: { settingKey: WEEKLY_SETTING_KEY },
    update: { settingValue: JSON.stringify(normalized) },
    create: {
      settingKey: WEEKLY_SETTING_KEY,
      settingValue: JSON.stringify(normalized),
      dataType: 'json',
      description: 'Per day-of-week default clinic hours (keys 0-6 = Sunday..Saturday)',
      isPublic: true,
    },
  })
}

/**
 * Get clinic hours for a specific date.
 * Resolution order:
 *   1. Date-specific override (clinic_hours table) — highest priority
 *   2. Day-of-week default (weekly schedule in system_settings)
 *   3. Global default (legacy)
 *   4. Hardcoded fallback (9am-6pm)
 */
export async function getClinicHoursForDate(date: Date): Promise<ClinicHoursForDate> {
  // Normalize to date-only (start of day) in clinic timezone
  const dateOnly = new Date(date)
  dateOnly.setHours(0, 0, 0, 0)

  // 1) Date-specific override
  const override = await prisma.clinicHours.findFirst({
    where: { date: dateOnly },
  })
  if (override) {
    return {
      openTime: override.openTime,
      closeTime: override.closeTime,
      isClosed: override.isClosed,
      reason: override.reason,
      isDefault: false,
      source: 'date_override',
    }
  }

  // 2) Day-of-week default
  try {
    const dow = getClinicDayOfWeek(date)
    const week = await getWeeklyClinicHours()
    const dayCfg = week[dow]
    if (dayCfg) {
      return {
        openTime: dayCfg.openTime,
        closeTime: dayCfg.closeTime,
        isClosed: dayCfg.isClosed,
        reason: dayCfg.isClosed ? 'Closed on this day of the week' : null,
        isDefault: true,
        source: 'weekly',
      }
    }
  } catch {
    // Fall through
  }

  // 3) Legacy global default
  const defaults = await getDefaultClinicHours()
  return {
    openTime: defaults.openTime,
    closeTime: defaults.closeTime,
    isClosed: false,
    reason: null,
    isDefault: true,
    source: 'global_default',
  }
}

/**
 * Parse "HH:mm" to { hours, minutes }
 */
export function parseTime(time: string): { hours: number; minutes: number } {
  const [hours, minutes] = time.split(':').map(Number)
  return { hours, minutes }
}

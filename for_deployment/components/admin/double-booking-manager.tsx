'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import {
  Users, Save, Loader2, ChevronLeft, ChevronRight, RotateCcw, X, AlertTriangle,
  Calendar as CalendarIcon, CheckSquare,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { useConfirm } from '@/components/providers/confirm-provider'

interface DayConfig {
  enabled: boolean
  maxPerSlot: number
}

type WeeklyConfig = Record<number, DayConfig>

interface OverrideRow {
  id: string
  date: string
  /** Server-provided YYYY-MM-DD string used for unambiguous client matching. */
  dateString?: string
  enabled: boolean
  maxPerSlot: number
  reason: string | null
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function buildDefaultWeek(maxPerSlot = 3, enabled = true): WeeklyConfig {
  const w: WeeklyConfig = {} as any
  for (let i = 0; i < 7; i++) w[i] = { enabled, maxPerSlot }
  return w
}

/** Format a YYYY-MM-DD string from year/month/day numbers (no timezone math). */
function toDateStr(year: number, month0: number, day: number): string {
  return `${year}-${String(month0 + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

/** Get the day-of-week for a YYYY-MM-DD string (interpreted as local calendar date). */
function dowFromDateStr(s: string): number {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d).getDay()
}

/** Parse YYYY-MM-DD as a local Date for display (e.g. weekday label). */
function localDateFromStr(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** Robust extraction of the YYYY-MM-DD key from an OverrideRow regardless of server tz. */
function overrideDateKey(o: OverrideRow): string {
  if (o.dateString) return o.dateString
  // Fall back: parse the ISO-ish string and use UTC components (server stores at UTC midnight).
  if (typeof o.date === 'string' && /^\d{4}-\d{2}-\d{2}/.test(o.date)) {
    return o.date.slice(0, 10)
  }
  const d = new Date(o.date)
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

interface Props {
  globalEnabled: boolean
  globalMaxPerSlot: number
}

/**
 * Mirrors the ClinicHoursManager UX:
 *   - Weekly defaults card (7 weekday rows, edit / save mode)
 *   - Date-specific overrides card (monthly calendar with click-to-edit)
 *   - Edit panel for the selected date(s) — supports multi-date selection
 *   - Upcoming overrides summary
 *
 * Resolution at booking time follows the order:
 *   date override → weekly default → global default (props)
 */
export function DoubleBookingManager({ globalEnabled, globalMaxPerSlot }: Props) {
  const { toast } = useToast()
  const { confirm } = useConfirm()

  // Weekly state
  const initialWeek = useMemo(() => buildDefaultWeek(globalMaxPerSlot, globalEnabled), [globalMaxPerSlot, globalEnabled])
  const [weekly, setWeekly] = useState<WeeklyConfig>(initialWeek)
  const [weeklyForm, setWeeklyForm] = useState<WeeklyConfig>(initialWeek)
  const [editingWeekly, setEditingWeekly] = useState(false)
  const [savingWeekly, setSavingWeekly] = useState(false)
  const [loadingWeekly, setLoadingWeekly] = useState(false)

  // Calendar state
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date()
    return { year: now.getFullYear(), month: now.getMonth() }
  })
  const [overrides, setOverrides] = useState<OverrideRow[]>([])
  const [loadingOverrides, setLoadingOverrides] = useState(false)

  // Multi-select mode
  const [multiSelectMode, setMultiSelectMode] = useState(false)
  // Selected dates (YYYY-MM-DD strings).
  // - In single mode: at most 1 date.
  // - In multi mode: arbitrary number across months.
  const [selectedDates, setSelectedDates] = useState<string[]>([])
  const [editorOpen, setEditorOpen] = useState(false)

  // Edit panel state
  const [editForm, setEditForm] = useState<{ enabled: boolean; maxPerSlot: string; reason: string }>({
    enabled: true,
    maxPerSlot: '3',
    reason: '',
  })
  const [savingOverride, setSavingOverride] = useState(false)

  // Fetch weekly config
  const fetchWeekly = useCallback(async () => {
    setLoadingWeekly(true)
    try {
      const res = await fetch('/api/double-booking/weekly')
      if (res.ok) {
        const data = await res.json()
        if (data?.data) {
          const week: WeeklyConfig = {} as any
          for (let i = 0; i < 7; i++) {
            const entry = data.data[i] ?? data.data[String(i)]
            week[i] = entry
              ? {
                  enabled: entry.enabled === undefined ? globalEnabled : !!entry.enabled,
                  maxPerSlot: parseInt(String(entry.maxPerSlot), 10) || globalMaxPerSlot,
                }
              : { enabled: globalEnabled, maxPerSlot: globalMaxPerSlot }
          }
          setWeekly(week)
          setWeeklyForm(week)
        }
      }
    } catch (err) {
      console.error('Error loading weekly double-booking config:', err)
    } finally {
      setLoadingWeekly(false)
    }
  }, [globalEnabled, globalMaxPerSlot])

  // Fetch overrides for the visible month
  const fetchOverrides = useCallback(async () => {
    setLoadingOverrides(true)
    try {
      const from = toDateStr(currentMonth.year, currentMonth.month, 1)
      const lastDay = new Date(currentMonth.year, currentMonth.month + 1, 0).getDate()
      const to = toDateStr(currentMonth.year, currentMonth.month, lastDay)
      const res = await fetch(`/api/double-booking/overrides?from=${from}&to=${to}`)
      if (res.ok) {
        const data = await res.json()
        setOverrides(data.data || [])
      }
    } catch (err) {
      console.error('Error loading overrides:', err)
    } finally {
      setLoadingOverrides(false)
    }
  }, [currentMonth])

  useEffect(() => {
    fetchWeekly()
  }, [fetchWeekly])

  useEffect(() => {
    fetchOverrides()
  }, [fetchOverrides])

  // When the global baseline changes (parent saved a new global default),
  // refresh the weekly config so any newly-inherited values are reflected.
  useEffect(() => {
    fetchWeekly()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [globalEnabled, globalMaxPerSlot])

  const updateWeeklyDay = (day: number, patch: Partial<DayConfig>) => {
    setWeeklyForm(prev => ({ ...prev, [day]: { ...prev[day], ...patch } }))
  }

  const handleSaveWeekly = async () => {
    // Validate every day
    for (let i = 0; i < 7; i++) {
      const d = weeklyForm[i]
      if (d.enabled && (!Number.isFinite(d.maxPerSlot) || d.maxPerSlot < 1)) {
        toast({
          title: 'Invalid limit',
          description: `${DAY_NAMES[i]}: maximum bookings must be at least 1.`,
          variant: 'destructive',
        })
        return
      }
      if (d.enabled && d.maxPerSlot > 50) {
        toast({
          title: 'Invalid limit',
          description: `${DAY_NAMES[i]}: maximum bookings cannot exceed 50.`,
          variant: 'destructive',
        })
        return
      }
    }
    setSavingWeekly(true)
    try {
      const res = await fetch('/api/double-booking/weekly', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ week: weeklyForm }),
      })
      if (res.ok) {
        setWeekly({ ...weeklyForm })
        setEditingWeekly(false)
        toast({ title: 'Saved', description: 'Weekly double-booking limits updated.' })
      } else {
        const errData = await res.json().catch(() => ({}))
        toast({
          title: 'Error',
          description: errData?.error || 'Failed to save weekly limits.',
          variant: 'destructive',
        })
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to save weekly limits.', variant: 'destructive' })
    } finally {
      setSavingWeekly(false)
    }
  }

  // Calendar helpers
  const monthName = new Date(currentMonth.year, currentMonth.month).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  })
  const daysInMonth = new Date(currentMonth.year, currentMonth.month + 1, 0).getDate()
  const firstDayOfWeek = new Date(currentMonth.year, currentMonth.month, 1).getDay()

  const prevMonth = () => {
    setCurrentMonth(prev => {
      const m = prev.month - 1
      return m < 0 ? { year: prev.year - 1, month: 11 } : { year: prev.year, month: m }
    })
  }
  const nextMonth = () => {
    setCurrentMonth(prev => {
      const m = prev.month + 1
      return m > 11 ? { year: prev.year + 1, month: 0 } : { year: prev.year, month: m }
    })
  }

  /** Map { dateStr -> override } for fast lookup. */
  const overridesByDate = useMemo(() => {
    const map: Record<string, OverrideRow> = {}
    for (const o of overrides) {
      map[overrideDateKey(o)] = o
    }
    return map
  }, [overrides])

  const getOverrideForDateStr = (dateStr: string): OverrideRow | undefined =>
    overridesByDate[dateStr]

  const getWeeklyDefaultForDate = (dateStr: string): DayConfig => {
    const dow = dowFromDateStr(dateStr)
    return weekly[dow] ?? { enabled: globalEnabled, maxPerSlot: globalMaxPerSlot }
  }

  /** Handle a click on a calendar day. Behaviour depends on `multiSelectMode`. */
  const handleDayClick = (day: number) => {
    const dateStr = toDateStr(currentMonth.year, currentMonth.month, day)
    if (multiSelectMode) {
      // Toggle selection
      setSelectedDates(prev => {
        const has = prev.includes(dateStr)
        return has ? prev.filter(d => d !== dateStr) : [...prev, dateStr]
      })
      return
    }
    // Single mode: open editor for this date.
    openEditorFor([dateStr])
  }

  /** Open the editor pre-filled for the given date(s). */
  const openEditorFor = (dates: string[]) => {
    if (dates.length === 0) return
    setSelectedDates(dates)
    setEditorOpen(true)

    // Determine the prefill values:
    // - If all selected dates share an existing override with the same enabled & max, use it.
    // - If only ONE date, fall back to weekly default for that date.
    // - Otherwise, fall back to the first date's weekly default (still reasonable).
    const overridesForSelection = dates
      .map(d => getOverrideForDateStr(d))
      .filter(Boolean) as OverrideRow[]
    const allSameOverride =
      overridesForSelection.length === dates.length &&
      overridesForSelection.every(
        (o, _, arr) => o.enabled === arr[0].enabled && o.maxPerSlot === arr[0].maxPerSlot
      )
    if (allSameOverride && overridesForSelection.length > 0) {
      const ref = overridesForSelection[0]
      setEditForm({
        enabled: ref.enabled,
        maxPerSlot: String(ref.maxPerSlot),
        // Reasons may differ across dates — only prefill if all match
        reason: overridesForSelection.every(o => (o.reason || '') === (ref.reason || ''))
          ? ref.reason || ''
          : '',
      })
      return
    }
    const dayDefault = getWeeklyDefaultForDate(dates[0])
    setEditForm({
      enabled: dayDefault.enabled,
      maxPerSlot: String(dayDefault.maxPerSlot),
      reason: '',
    })
  }

  const closeEditor = () => {
    setEditorOpen(false)
    if (!multiSelectMode) {
      setSelectedDates([])
    }
  }

  const handleSaveOverride = async () => {
    if (selectedDates.length === 0) return
    const max = parseInt(editForm.maxPerSlot, 10)
    if (editForm.enabled && (isNaN(max) || max < 1)) {
      toast({
        title: 'Invalid limit',
        description: 'Maximum bookings must be at least 1 when enabled.',
        variant: 'destructive',
      })
      return
    }
    if (editForm.enabled && max > 50) {
      toast({
        title: 'Invalid limit',
        description: 'Maximum bookings cannot exceed 50.',
        variant: 'destructive',
      })
      return
    }
    setSavingOverride(true)
    try {
      const res = await fetch('/api/double-booking/overrides', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dates: selectedDates,
          enabled: editForm.enabled,
          maxPerSlot: editForm.enabled ? max : 1,
          reason: editForm.reason || null,
        }),
      })
      if (res.ok) {
        const n = selectedDates.length
        toast({
          title: 'Saved',
          description:
            n === 1
              ? `Override saved for ${localDateFromStr(selectedDates[0]).toLocaleDateString('en-US', {
                  weekday: 'long', month: 'long', day: 'numeric',
                })}.`
              : `Override saved for ${n} dates.`,
        })
        setEditorOpen(false)
        setSelectedDates([])
        // Need to refresh ALL months that contain the saved dates, but at minimum the visible month.
        await fetchOverrides()
      } else {
        const errData = await res.json().catch(() => ({}))
        toast({
          title: 'Error',
          description: errData?.error || 'Failed to save override.',
          variant: 'destructive',
        })
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to save override.', variant: 'destructive' })
    } finally {
      setSavingOverride(false)
    }
  }

  const handleResetOverride = async () => {
    if (selectedDates.length === 0) return
    const datesWithOverride = selectedDates.filter(d => !!getOverrideForDateStr(d))
    if (datesWithOverride.length === 0) {
      toast({
        title: 'Nothing to reset',
        description: 'No custom overrides exist for the selected date(s).',
      })
      return
    }
    const ok = await confirm({
      title:
        datesWithOverride.length === 1
          ? 'Reset to weekly default?'
          : `Reset ${datesWithOverride.length} dates to weekly default?`,
      description:
        datesWithOverride.length === 1
          ? 'The custom double-booking limit for this date will be removed and the weekly default will apply.'
          : 'Custom limits for the selected dates will be removed; weekly defaults will apply.',
      confirmLabel: 'Reset',
      variant: 'warning',
    })
    if (!ok) return
    setSavingOverride(true)
    try {
      const csv = datesWithOverride.join(',')
      const res = await fetch(`/api/double-booking/overrides?dates=${encodeURIComponent(csv)}`, {
        method: 'DELETE',
      })
      if (res.ok) {
        toast({
          title: 'Reset',
          description:
            datesWithOverride.length === 1
              ? 'Reverted to weekly default.'
              : `Reverted ${datesWithOverride.length} dates to weekly default.`,
        })
        setEditorOpen(false)
        setSelectedDates([])
        await fetchOverrides()
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to reset.', variant: 'destructive' })
    } finally {
      setSavingOverride(false)
    }
  }

  const clearSelection = () => {
    setSelectedDates([])
    setEditorOpen(false)
  }

  const toggleMultiSelect = () => {
    setMultiSelectMode(prev => {
      const next = !prev
      // When turning ON, clear any single-date selection so the user starts fresh.
      // When turning OFF, also clear.
      setSelectedDates([])
      setEditorOpen(false)
      return next
    })
  }

  // Today helpers
  const today = new Date()
  const todayStr = toDateStr(today.getFullYear(), today.getMonth(), today.getDate())

  const renderWeeklyBadge = (dow: number) => {
    const d = weekly[dow]
    if (!d) return null
    if (!d.enabled) return <span className="text-[9px] text-red-600 font-medium leading-tight">Off</span>
    return <span className="text-[9px] text-muted-foreground leading-tight">Max {d.maxPerSlot}</span>
  }

  // Sort selected dates chronologically for the editor header
  const sortedSelected = useMemo(() => [...selectedDates].sort(), [selectedDates])
  const editorTitle = useMemo(() => {
    if (sortedSelected.length === 0) return ''
    if (sortedSelected.length === 1) {
      return localDateFromStr(sortedSelected[0]).toLocaleDateString('en-US', {
        weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
      })
    }
    return `${sortedSelected.length} dates selected`
  }, [sortedSelected])

  return (
    <div className="space-y-6">
      {/* Weekly Defaults Card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center text-base">
            <Users className="w-5 h-5 mr-2" />
            Weekly Double-Booking Limits
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Set the default maximum bookings per time slot for each day of the week. These apply
            to all dates unless overridden in the calendar below. Disable a day to hard-cap it at 1
            booking per slot.
          </p>
        </CardHeader>
        <CardContent>
          {loadingWeekly ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : editingWeekly ? (
            <div className="space-y-3">
              <div className="grid grid-cols-[100px_1fr_120px] gap-2 items-center text-xs font-semibold text-muted-foreground px-1 pb-1 border-b">
                <div>Day</div>
                <div>Max bookings per slot</div>
                <div className="text-center">Allow double-booking</div>
              </div>
              {Array.from({ length: 7 }).map((_, i) => {
                const d = weeklyForm[i]
                return (
                  <div
                    key={i}
                    className="grid grid-cols-[100px_1fr_120px] gap-2 items-center"
                  >
                    <div className="font-medium text-sm">{DAY_NAMES[i]}</div>
                    <Input
                      type="number"
                      min={1}
                      max={50}
                      value={d.enabled ? d.maxPerSlot : 1}
                      disabled={!d.enabled}
                      onChange={(e) => {
                        const val = parseInt(e.target.value.replace(/[^0-9]/g, ''), 10)
                        updateWeeklyDay(i, { maxPerSlot: isNaN(val) ? 1 : Math.max(1, Math.min(50, val)) })
                      }}
                      className="max-w-[120px]"
                    />
                    <div className="flex justify-center">
                      <Switch
                        checked={d.enabled}
                        onCheckedChange={(checked) => updateWeeklyDay(i, { enabled: checked })}
                      />
                    </div>
                  </div>
                )
              })}
              <div className="flex items-center gap-2 pt-2">
                <Button onClick={handleSaveWeekly} disabled={savingWeekly}>
                  {savingWeekly ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                  Save Weekly Limits
                </Button>
                <Button variant="outline" onClick={() => { setEditingWeekly(false); setWeeklyForm(weekly) }}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid gap-2">
                {Array.from({ length: 7 }).map((_, i) => {
                  const d = weekly[i]
                  return (
                    <div
                      key={i}
                      className={`flex items-center justify-between px-3 py-2 rounded-lg border ${!d?.enabled ? 'bg-red-50 border-red-200' : 'bg-muted/30'}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`flex items-center justify-center w-8 h-8 rounded-md ${!d?.enabled ? 'bg-red-100' : 'bg-primary/10'}`}>
                          <span className={`text-xs font-semibold ${!d?.enabled ? 'text-red-600' : 'text-primary'}`}>{DAY_SHORT[i]}</span>
                        </div>
                        <span className="font-medium text-sm">{DAY_NAMES[i]}</span>
                      </div>
                      <div className="text-sm">
                        {!d?.enabled ? (
                          <Badge variant="destructive" className="text-xs">Disabled (1 / slot)</Badge>
                        ) : (
                          <span className="font-medium">Up to {d.maxPerSlot} per slot</span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
              <div className="flex justify-end pt-2">
                <Button variant="outline" size="sm" onClick={() => { setWeeklyForm(weekly); setEditingWeekly(true) }}>
                  Edit Weekly Limits
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Calendar Override Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between flex-wrap gap-2">
            <span className="flex items-center">
              <Users className="w-5 h-5 mr-2" />
              Date-Specific Overrides
            </span>
            <Button
              variant={multiSelectMode ? 'default' : 'outline'}
              size="sm"
              onClick={toggleMultiSelect}
              className="text-xs"
            >
              <CheckSquare className="w-4 h-4 mr-1" />
              {multiSelectMode ? 'Multi-select: ON' : 'Select multiple dates'}
            </Button>
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            {multiSelectMode
              ? 'Click any dates below to add/remove them from your selection. Then click "Configure Selected" to apply the same override to all of them.'
              : 'Click any date below to set a custom double-booking limit (or disable double-booking) for that specific day. Toggle "Select multiple dates" to override several dates at once.'}
          </p>
        </CardHeader>
        <CardContent>
          {/* Month navigation */}
          <div className="flex items-center justify-between mb-4">
            <Button variant="outline" size="sm" onClick={prevMonth}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <h3 className="text-lg font-semibold">{monthName}</h3>
            <Button variant="outline" size="sm" onClick={nextMonth}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7 gap-0.5 sm:gap-1">
            {DAY_SHORT.map(d => (
              <div key={d} className="text-center text-[10px] sm:text-xs font-semibold text-muted-foreground py-1.5 sm:py-2">{d}</div>
            ))}
            {Array.from({ length: firstDayOfWeek }).map((_, i) => (
              <div key={`empty-${i}`} />
            ))}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1
              const dateStr = toDateStr(currentMonth.year, currentMonth.month, day)
              const override = getOverrideForDateStr(dateStr)
              const isToday = dateStr === todayStr
              const isPast = dateStr < todayStr
              const isSelected = selectedDates.includes(dateStr)
              const dow = dowFromDateStr(dateStr)
              const dayDefault = weekly[dow]
              const defaultDisabled = !override && dayDefault && !dayDefault.enabled

              return (
                <button
                  key={day}
                  onClick={() => handleDayClick(day)}
                  className={`
                    relative p-1 sm:p-2 rounded-lg text-sm transition-all min-h-[48px] sm:min-h-[64px] flex flex-col items-center justify-start gap-0.5 border overflow-hidden
                    ${isSelected ? 'ring-2 ring-primary border-primary bg-primary/10' : 'border-transparent hover:bg-muted/50'}
                    ${isPast && !isSelected ? 'opacity-50' : ''}
                    ${isToday && !isSelected ? 'border-primary/30 bg-primary/5' : ''}
                    ${!isSelected && override && !override.enabled ? 'bg-red-50' : !isSelected && override ? 'bg-amber-50' : !isSelected && defaultDisabled ? 'bg-red-50/40' : ''}
                  `}
                >
                  <span className={`text-xs sm:text-sm font-medium ${isToday ? 'text-primary' : ''}`}>{day}</span>
                  {override ? (
                    !override.enabled ? (
                      <>
                        <span className="hidden sm:inline-block">
                          <Badge variant="destructive" className="text-[9px] px-1 py-0 leading-tight">Off</Badge>
                        </span>
                        <span className="sm:hidden text-[8px] text-red-600 font-semibold leading-tight">Off</span>
                      </>
                    ) : (
                      <>
                        <span className="hidden sm:inline-block text-[9px] text-amber-700 font-medium leading-tight text-center">
                          Max {override.maxPerSlot}
                        </span>
                        <span className="sm:hidden text-[8px] text-amber-700 font-semibold leading-tight">
                          {override.maxPerSlot}
                        </span>
                      </>
                    )
                  ) : (
                    renderWeeklyBadge(dow)
                  )}
                </button>
              )
            })}
          </div>

          {/* Legend */}
          <div className="flex flex-wrap items-center gap-4 mt-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-white border" /> Weekly default</div>
            <div className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-amber-50 border border-amber-200" /> Custom limit</div>
            <div className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-red-50 border border-red-200" /> Disabled</div>
            <div className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-primary/10 border-2 border-primary" /> Selected</div>
          </div>
          {loadingOverrides && (
            <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground">
              <Loader2 className="w-3 h-3 animate-spin" /> Loading overrides…
            </div>
          )}

          {/* Multi-select action bar */}
          {multiSelectMode && (
            <div className="mt-4 rounded-lg border border-primary/30 bg-primary/5 p-3 flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm flex items-center gap-2">
                <CalendarIcon className="w-4 h-4 text-primary" />
                <span className="font-medium">
                  {selectedDates.length === 0
                    ? 'No dates selected yet'
                    : selectedDates.length === 1
                    ? '1 date selected'
                    : `${selectedDates.length} dates selected`}
                </span>
                {sortedSelected.length > 0 && sortedSelected.length <= 6 && (
                  <span className="text-xs text-muted-foreground">
                    ({sortedSelected.map(d =>
                      localDateFromStr(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                    ).join(', ')})
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={() => openEditorFor(selectedDates)}
                  disabled={selectedDates.length === 0}
                >
                  Configure Selected
                </Button>
                {selectedDates.length > 0 && (
                  <Button size="sm" variant="outline" onClick={clearSelection}>
                    Clear
                  </Button>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit panel */}
      {editorOpen && selectedDates.length > 0 && (
        <Card className="border-primary/20">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-base">{editorTitle}</CardTitle>
              <Button variant="ghost" size="sm" onClick={closeEditor}>
                <X className="w-4 h-4" />
              </Button>
            </div>
            {selectedDates.length > 1 && (
              <div className="text-xs text-muted-foreground flex flex-wrap gap-1 mt-1">
                {sortedSelected.map(d => (
                  <Badge key={d} variant="outline" className="text-[10px] py-0 px-1.5">
                    {localDateFromStr(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </Badge>
                ))}
              </div>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-sm">
                  Allow double-booking on {selectedDates.length === 1 ? 'this date' : 'these dates'}
                </p>
                <p className="text-xs text-muted-foreground">
                  When off, only 1 appointment can be booked per time slot.
                </p>
              </div>
              <Switch
                checked={editForm.enabled}
                onCheckedChange={(checked) => setEditForm(f => ({ ...f, enabled: checked }))}
              />
            </div>

            <div className={editForm.enabled ? '' : 'opacity-50 pointer-events-none'}>
              <label className="block text-sm font-medium mb-1">Maximum appointments per time slot</label>
              <Input
                type="number"
                min={1}
                max={50}
                value={editForm.maxPerSlot}
                onChange={(e) => {
                  const val = e.target.value.replace(/[^0-9]/g, '')
                  setEditForm(f => ({ ...f, maxPerSlot: val }))
                }}
                className="max-w-[180px]"
                disabled={!editForm.enabled}
              />
              <p className="text-xs text-gray-500 mt-2">
                For example, set <strong>5</strong> to allow up to 5 patients in the same time slot.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Reason (optional)</label>
              <Input
                placeholder="e.g. Holiday, special event, surgery day"
                value={editForm.reason}
                onChange={(e) => setEditForm(f => ({ ...f, reason: e.target.value }))}
              />
              {selectedDates.length > 1 && (
                <p className="text-[11px] text-muted-foreground mt-1">The same reason will be applied to all selected dates.</p>
              )}
            </div>

            <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 text-sm text-blue-900">
              <p className="font-medium mb-1">
                Effective on {selectedDates.length === 1 ? 'this date' : `these ${selectedDates.length} dates`}
              </p>
              <p>
                {editForm.enabled
                  ? `Up to ${Math.max(1, parseInt(editForm.maxPerSlot || '1', 10) || 1)} appointment(s) per time slot.`
                  : 'Double-booking is OFF — only 1 appointment per time slot.'}
              </p>
            </div>

            <div className="flex items-center gap-2 pt-2 flex-wrap">
              <Button onClick={handleSaveOverride} disabled={savingOverride} className="flex-1 min-w-[200px]">
                {savingOverride ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                {selectedDates.length === 1
                  ? 'Save Override'
                  : `Save Override for ${selectedDates.length} Dates`}
              </Button>
              {selectedDates.some(d => !!getOverrideForDateStr(d)) && (
                <Button variant="outline" onClick={handleResetOverride} disabled={savingOverride}>
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Reset to Weekly Default
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Upcoming overrides summary */}
      {overrides.filter(o => overrideDateKey(o) >= todayStr).length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center">
              <AlertTriangle className="w-4 h-4 mr-2 text-amber-500" />
              Upcoming Date-Specific Limits
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {overrides
                .filter(o => overrideDateKey(o) >= todayStr)
                .sort((a, b) => overrideDateKey(a).localeCompare(overrideDateKey(b)))
                .map(o => {
                  const key = overrideDateKey(o)
                  return (
                    <div key={o.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/50 text-sm">
                      <div>
                        <span className="font-medium">
                          {localDateFromStr(key).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                        </span>
                        {o.reason && <span className="text-muted-foreground ml-2">— {o.reason}</span>}
                      </div>
                      {!o.enabled ? (
                        <Badge variant="destructive" className="text-xs">Disabled</Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs">Max {o.maxPerSlot} per slot</Badge>
                      )}
                    </div>
                  )
                })
              }
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

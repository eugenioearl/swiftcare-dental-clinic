
'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from '@/components/auth/custom-session-provider'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Settings, Save, Bell, Shield, Building2, Loader2, CheckCircle, AlertCircle, Clock, X, ChevronLeft, ChevronRight, RotateCcw, AlertTriangle, Image as ImageIcon, Megaphone } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { useConfirm } from '@/components/providers/confirm-provider'
import { Badge } from '@/components/ui/badge'
import { DoubleBookingManager } from '@/components/admin/double-booking-manager'
import {
  BrandingTab,
  AnnouncementsTab,
  ClinicInfoTab,
  type Announcement,
  type SystemSettingMap,
} from '@/components/admin/control-center-tabs'
// ─── Clinic Hours Manager Component ───

interface ClinicHoursOverride {
  id: string
  date: string
  openTime: string
  closeTime: string
  isClosed: boolean
  reason: string | null
}

interface WeekdayHours {
  openTime: string
  closeTime: string
  isClosed: boolean
}

type WeeklyHours = Record<number, WeekdayHours>

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function buildDefaultWeek(): WeeklyHours {
  const w: WeeklyHours = {} as any
  for (let i = 0; i < 7; i++) {
    w[i] = { openTime: '09:00', closeTime: '18:00', isClosed: i === 0 }
  }
  return w
}

function formatTime12h(time: string) {
  if (!time) return ''
  const [h, m] = time.split(':').map(Number)
  if (Number.isNaN(h) || Number.isNaN(m)) return time
  const ampm = h >= 12 ? 'PM' : 'AM'
  const hour12 = h % 12 || 12
  return `${hour12}:${String(m).padStart(2, '0')} ${ampm}`
}

function ClinicHoursManager() {
  const { toast } = useToast()
  const { confirm } = useConfirm()
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date()
    return { year: now.getFullYear(), month: now.getMonth() }
  })
  const [overrides, setOverrides] = useState<ClinicHoursOverride[]>([])
  const [loading, setLoading] = useState(false)
  const [editingDate, setEditingDate] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({
    openTime: '09:00',
    closeTime: '18:00',
    isClosed: false,
    reason: ''
  })
  const [saving, setSaving] = useState(false)

  // Weekly (per-day-of-week) hours state
  const [weeklyHours, setWeeklyHours] = useState<WeeklyHours>(buildDefaultWeek())
  const [weeklyForm, setWeeklyForm] = useState<WeeklyHours>(buildDefaultWeek())
  const [editingWeekly, setEditingWeekly] = useState(false)
  const [savingWeekly, setSavingWeekly] = useState(false)

  // Fetch weekly hours
  const fetchWeekly = useCallback(async () => {
    try {
      const res = await fetch('/api/clinic-hours/weekly')
      if (res.ok) {
        const data = await res.json()
        if (data.data) {
          // Ensure 0-6 keys are present
          const week: WeeklyHours = {} as any
          for (let i = 0; i < 7; i++) {
            const entry = data.data[i] ?? data.data[String(i)]
            week[i] = entry
              ? {
                  openTime: entry.openTime || '09:00',
                  closeTime: entry.closeTime || '18:00',
                  isClosed: !!entry.isClosed,
                }
              : { openTime: '09:00', closeTime: '18:00', isClosed: i === 0 }
          }
          setWeeklyHours(week)
          setWeeklyForm(week)
        }
      }
    } catch (err) {
      console.error('Error loading weekly clinic hours:', err)
    }
  }, [])

  const fetchOverrides = useCallback(async () => {
    setLoading(true)
    try {
      const from = new Date(currentMonth.year, currentMonth.month, 1).toISOString().split('T')[0]
      const to = new Date(currentMonth.year, currentMonth.month + 1, 0).toISOString().split('T')[0]
      const res = await fetch(`/api/clinic-hours?from=${from}&to=${to}`)
      if (res.ok) {
        const data = await res.json()
        setOverrides(data.data || [])
      }
    } catch (err) {
      console.error('Error loading clinic hours:', err)
    } finally {
      setLoading(false)
    }
  }, [currentMonth])

  useEffect(() => {
    fetchWeekly()
    fetchOverrides()
  }, [fetchWeekly, fetchOverrides])

  const handleSaveWeekly = async () => {
    // Validate
    for (let i = 0; i < 7; i++) {
      const d = weeklyForm[i]
      if (!d.isClosed && d.openTime >= d.closeTime) {
        toast({
          title: 'Invalid Hours',
          description: `${DAY_NAMES[i]}: opening time must be before closing time.`,
          variant: 'destructive',
        })
        return
      }
    }
    setSavingWeekly(true)
    try {
      const res = await fetch('/api/clinic-hours/weekly', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ week: weeklyForm }),
      })
      if (res.ok) {
        setWeeklyHours({ ...weeklyForm })
        setEditingWeekly(false)
        toast({ title: 'Saved', description: 'Weekly clinic hours updated successfully.' })
      } else {
        const errData = await res.json()
        toast({ title: 'Error', description: errData.error || 'Failed to save', variant: 'destructive' })
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to save weekly hours', variant: 'destructive' })
    } finally {
      setSavingWeekly(false)
    }
  }

  const updateWeeklyDay = (day: number, patch: Partial<WeekdayHours>) => {
    setWeeklyForm(prev => ({ ...prev, [day]: { ...prev[day], ...patch } }))
  }

  const monthName = new Date(currentMonth.year, currentMonth.month).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

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

  const getOverrideForDay = (day: number): ClinicHoursOverride | undefined => {
    const dateStr = `${currentMonth.year}-${String(currentMonth.month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    return overrides.find(o => {
      const oDate = new Date(o.date)
      const oStr = `${oDate.getFullYear()}-${String(oDate.getMonth() + 1).padStart(2, '0')}-${String(oDate.getDate()).padStart(2, '0')}`
      return oStr === dateStr
    })
  }

  const getDefaultForDate = (dateStr: string): WeekdayHours => {
    const d = new Date(dateStr + 'T00:00:00')
    const dow = d.getDay()
    return weeklyHours[dow] ?? { openTime: '09:00', closeTime: '18:00', isClosed: false }
  }

  const handleDayClick = (day: number) => {
    const dateStr = `${currentMonth.year}-${String(currentMonth.month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    const override = getOverrideForDay(day)
    const dayDefault = getDefaultForDate(dateStr)
    setEditingDate(dateStr)
    if (override) {
      setEditForm({
        openTime: override.isClosed ? dayDefault.openTime : override.openTime,
        closeTime: override.isClosed ? dayDefault.closeTime : override.closeTime,
        isClosed: override.isClosed,
        reason: override.reason || ''
      })
    } else {
      setEditForm({ openTime: dayDefault.openTime, closeTime: dayDefault.closeTime, isClosed: dayDefault.isClosed, reason: '' })
    }
  }

  const handleSaveHours = async () => {
    if (!editingDate) return
    setSaving(true)
    try {
      const res = await fetch('/api/clinic-hours', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: editingDate,
          openTime: editForm.openTime,
          closeTime: editForm.closeTime,
          isClosed: editForm.isClosed,
          reason: editForm.reason || null
        })
      })
      if (res.ok) {
        toast({ title: 'Saved', description: `Clinic hours updated for ${new Date(editingDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}` })
        setEditingDate(null)
        fetchOverrides()
      } else {
        const errData = await res.json()
        toast({ title: 'Error', description: errData.error || 'Failed to save', variant: 'destructive' })
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to save clinic hours', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const handleResetToDefault = async () => {
    if (!editingDate) return
    const ok = await confirm({
      title: 'Reset to default hours?',
      description: 'The custom hours for this date will be removed and the weekly default will apply.',
      confirmLabel: 'Reset',
      variant: 'warning',
    })
    if (!ok) return
    setSaving(true)
    try {
      const res = await fetch(`/api/clinic-hours?date=${editingDate}`, { method: 'DELETE' })
      if (res.ok) {
        const dayDefault = getDefaultForDate(editingDate)
        const label = dayDefault.isClosed
          ? 'Closed'
          : `${formatTime12h(dayDefault.openTime)} – ${formatTime12h(dayDefault.closeTime)}`
        toast({ title: 'Reset', description: `Clinic hours reset to weekly default (${label})` })
        setEditingDate(null)
        fetchOverrides()
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to reset', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const today = new Date()
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

  const renderWeeklyBadge = (dow: number) => {
    const d = weeklyHours[dow]
    if (!d) return null
    if (d.isClosed) return <span className="text-[9px] text-red-600 font-medium leading-tight">Closed</span>
    return (
      <span className="text-[9px] text-muted-foreground leading-tight">
        {parseInt(d.openTime)}-{parseInt(d.closeTime)}
      </span>
    )
  }

  return (
    <div className="space-y-6">
      {/* Weekly (Per Day-of-Week) Hours Card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center text-base">
            <Clock className="w-5 h-5 mr-2" />
            Weekly Clinic Hours
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Set default operating hours for each day of the week. These apply to all dates unless overridden in the calendar below.
          </p>
        </CardHeader>
        <CardContent>
          {editingWeekly ? (
            <div className="space-y-3">
              <div className="grid grid-cols-[100px_1fr_1fr_100px] gap-2 items-center text-xs font-semibold text-muted-foreground px-1 pb-1 border-b">
                <div>Day</div>
                <div>Opening</div>
                <div>Closing</div>
                <div className="text-center">Closed</div>
              </div>
              {Array.from({ length: 7 }).map((_, i) => {
                const d = weeklyForm[i]
                return (
                  <div
                    key={i}
                    className="grid grid-cols-[100px_1fr_1fr_100px] gap-2 items-center"
                  >
                    <div className="font-medium text-sm">{DAY_NAMES[i]}</div>
                    <Input
                      type="time"
                      value={d.openTime}
                      disabled={d.isClosed}
                      onChange={(e) => updateWeeklyDay(i, { openTime: e.target.value })}
                    />
                    <Input
                      type="time"
                      value={d.closeTime}
                      disabled={d.isClosed}
                      onChange={(e) => updateWeeklyDay(i, { closeTime: e.target.value })}
                    />
                    <div className="flex justify-center">
                      <Switch
                        checked={d.isClosed}
                        onCheckedChange={(checked) => updateWeeklyDay(i, { isClosed: checked })}
                      />
                    </div>
                  </div>
                )
              })}
              <div className="flex items-center gap-2 pt-2">
                <Button onClick={handleSaveWeekly} disabled={savingWeekly}>
                  {savingWeekly ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                  Save Weekly Hours
                </Button>
                <Button variant="outline" onClick={() => { setEditingWeekly(false); setWeeklyForm(weeklyHours) }}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid gap-2">
                {Array.from({ length: 7 }).map((_, i) => {
                  const d = weeklyHours[i]
                  return (
                    <div
                      key={i}
                      className={`flex items-center justify-between px-3 py-2 rounded-lg border ${d?.isClosed ? 'bg-red-50 border-red-200' : 'bg-muted/30'}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`flex items-center justify-center w-8 h-8 rounded-md ${d?.isClosed ? 'bg-red-100' : 'bg-primary/10'}`}>
                          <span className={`text-xs font-semibold ${d?.isClosed ? 'text-red-600' : 'text-primary'}`}>{DAY_SHORT[i]}</span>
                        </div>
                        <span className="font-medium text-sm">{DAY_NAMES[i]}</span>
                      </div>
                      <div className="text-sm">
                        {d?.isClosed ? (
                          <Badge variant="destructive" className="text-xs">Closed</Badge>
                        ) : (
                          <span className="font-medium">{formatTime12h(d?.openTime || '09:00')} – {formatTime12h(d?.closeTime || '18:00')}</span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
              <div className="flex justify-end pt-2">
                <Button variant="outline" size="sm" onClick={() => { setWeeklyForm(weeklyHours); setEditingWeekly(true) }}>
                  Edit Weekly Hours
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Calendar Override Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Clock className="w-5 h-5 mr-2" />
            Date-Specific Overrides
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Click any date below to set custom hours or mark the clinic as closed for that specific day. Overrides take precedence over the weekly defaults above.
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
              const dateStr = `${currentMonth.year}-${String(currentMonth.month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
              const override = getOverrideForDay(day)
              const isToday = dateStr === todayStr
              const isPast = new Date(dateStr) < new Date(todayStr)
              const isSelected = editingDate === dateStr
              const dow = new Date(dateStr + 'T00:00:00').getDay()
              const dayDefault = weeklyHours[dow]
              const defaultClosed = !override && dayDefault?.isClosed

              return (
                <button
                  key={day}
                  onClick={() => handleDayClick(day)}
                  className={`
                    relative p-1 sm:p-2 rounded-lg text-sm transition-all min-h-[48px] sm:min-h-[64px] flex flex-col items-center justify-start gap-0.5 border overflow-hidden
                    ${isSelected ? 'ring-2 ring-primary border-primary bg-primary/5' : 'border-transparent hover:bg-muted/50'}
                    ${isPast ? 'opacity-50' : ''}
                    ${isToday ? 'border-primary/30 bg-primary/5' : ''}
                    ${override?.isClosed ? 'bg-red-50' : override ? 'bg-amber-50' : defaultClosed ? 'bg-red-50/40' : ''}
                  `}
                >
                  <span className={`text-xs sm:text-sm font-medium ${isToday ? 'text-primary' : ''}`}>{day}</span>
                  {override ? (
                    override.isClosed ? (
                      <>
                        <span className="hidden sm:inline-block">
                          <Badge variant="destructive" className="text-[9px] px-1 py-0 leading-tight">Closed</Badge>
                        </span>
                        <span className="sm:hidden text-[8px] text-red-600 font-semibold leading-tight">Closed</span>
                      </>
                    ) : (
                      <>
                        <span className="hidden sm:inline-block text-[9px] text-amber-700 font-medium leading-tight text-center">
                          {formatTime12h(override.openTime).replace(' ', '')}-{formatTime12h(override.closeTime).replace(' ', '')}
                        </span>
                        <span className="sm:hidden text-[8px] text-amber-700 font-semibold leading-tight">
                          {parseInt(override.openTime)}-{parseInt(override.closeTime)}
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
            <div className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-amber-50 border border-amber-200" /> Custom hours</div>
            <div className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-red-50 border border-red-200" /> Closed</div>
          </div>
        </CardContent>
      </Card>

      {/* Edit panel */}
      {editingDate && (
        <Card className="border-primary/20">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">
                {new Date(editingDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setEditingDate(null)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-sm">Close clinic for this day</p>
                <p className="text-xs text-muted-foreground">Mark as closed (emergency, holiday, etc.)</p>
              </div>
              <Switch
                checked={editForm.isClosed}
                onCheckedChange={(checked) => setEditForm(f => ({ ...f, isClosed: checked }))}
              />
            </div>

            {editForm.isClosed ? (
              <div>
                <label className="block text-sm font-medium mb-1">Reason (optional)</label>
                <Input
                  placeholder="e.g. Emergency closure, Holiday"
                  value={editForm.reason}
                  onChange={(e) => setEditForm(f => ({ ...f, reason: e.target.value }))}
                />
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Opening Time</label>
                  <Input
                    type="time"
                    value={editForm.openTime}
                    onChange={(e) => setEditForm(f => ({ ...f, openTime: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Closing Time</label>
                  <Input
                    type="time"
                    value={editForm.closeTime}
                    onChange={(e) => setEditForm(f => ({ ...f, closeTime: e.target.value }))}
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium mb-1">Reason (optional)</label>
                  <Input
                    placeholder="e.g. Shortened hours, Special event"
                    value={editForm.reason}
                    onChange={(e) => setEditForm(f => ({ ...f, reason: e.target.value }))}
                  />
                </div>
              </div>
            )}

            <div className="flex items-center gap-2 pt-2">
              <Button onClick={handleSaveHours} disabled={saving} className="flex-1">
                {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                Save Hours
              </Button>
              {getOverrideForDay(parseInt(editingDate.split('-')[2])) && (
                <Button variant="outline" onClick={handleResetToDefault} disabled={saving}>
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Reset to Weekly Default
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Upcoming overrides summary */}
      {overrides.filter(o => new Date(o.date) >= new Date(todayStr)).length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center">
              <AlertTriangle className="w-4 h-4 mr-2 text-amber-500" />
              Upcoming Schedule Changes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {overrides
                .filter(o => new Date(o.date) >= new Date(todayStr))
                .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                .map(o => (
                  <div key={o.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/50 text-sm">
                    <div>
                      <span className="font-medium">
                        {new Date(o.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                      </span>
                      {o.reason && <span className="text-muted-foreground ml-2">— {o.reason}</span>}
                    </div>
                    {o.isClosed ? (
                      <Badge variant="destructive" className="text-xs">Closed</Badge>
                    ) : (
                      <Badge variant="secondary" className="text-xs">{formatTime12h(o.openTime)} – {formatTime12h(o.closeTime)}</Badge>
                    )}
                  </div>
                ))
              }
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// ─── Main Settings Page ───

interface SettingsState {
  clinicName: string
  clinicPhone: string
  clinicEmail: string
  clinicAddress: string
  appointmentDuration: string
  businessHoursStart: string
  businessHoursEnd: string
  emailNotifications: boolean
  smsNotifications: boolean
  appointmentReminders: boolean
  taxRate: string
  doubleBookingEnabled: boolean
  doubleBookingMaxPerSlot: string
}

const DEFAULT_SETTINGS: SettingsState = {
  clinicName: 'SwiftCare Dental Clinic',
  clinicPhone: '+63 2 1234 5678',
  clinicEmail: 'info@swiftcaredental.com',
  clinicAddress: '123 Dental Plaza, Manila, Philippines',
  appointmentDuration: '30',
  businessHoursStart: '09:00',
  businessHoursEnd: '18:00',
  emailNotifications: true,
  smsNotifications: true,
  appointmentReminders: true,
  taxRate: '12.00',
  doubleBookingEnabled: true,
  doubleBookingMaxPerSlot: '3',
}

export default function AdminSettingsPage() {
  const { data: session } = useSession() || {}
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [initialLoad, setInitialLoad] = useState(true)
  const [settings, setSettings] = useState<SettingsState>(DEFAULT_SETTINGS)
  const [savedSettings, setSavedSettings] = useState<SettingsState>(DEFAULT_SETTINGS)
  const [hasChanges, setHasChanges] = useState(false)
  const { toast } = useToast()

  // Control Center data (announcements + raw system settings map for branding/clinic-info tabs)
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [systemSettingMap, setSystemSettingMap] = useState<SystemSettingMap>({})

  const loadControlCenterData = useCallback(async () => {
    try {
      const [annRes, settRes] = await Promise.all([
        fetch('/api/admin/announcements'),
        fetch('/api/settings?includeAll=true'),
      ])
      const annData = await annRes.json().catch(() => ({}))
      const settData = await settRes.json().catch(() => ({}))

      if (annData?.success) setAnnouncements(annData.data || [])

      if (settData?.success) {
        const map: SystemSettingMap = {}
        for (const s of settData.data?.settings || []) {
          map[s.settingKey] = s.settingValue
        }
        setSystemSettingMap(map)
      }
    } catch (err) {
      console.error('Failed to load control center data:', err)
    }
  }, [])

  // Load settings on mount
  useEffect(() => {
    loadSettings()
    loadControlCenterData()
  }, [])

  // Track changes
  useEffect(() => {
    const changed = JSON.stringify(settings) !== JSON.stringify(savedSettings)
    setHasChanges(changed)
  }, [settings, savedSettings])

  const loadSettings = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/settings')
      if (res.ok) {
        const data = await res.json()
        if (data.success && data.data?.settings) {
          const loadedSettings = { ...DEFAULT_SETTINGS }
          
          // Map API settings to state
          data.data.settings.forEach((setting: any) => {
            switch (setting.settingKey) {
              case 'clinic_name':
                loadedSettings.clinicName = setting.settingValue
                break
              case 'clinic_phone':
                loadedSettings.clinicPhone = setting.settingValue
                break
              case 'clinic_email':
                loadedSettings.clinicEmail = setting.settingValue
                break
              case 'clinic_address':
                loadedSettings.clinicAddress = setting.settingValue
                break
              case 'appointment_duration':
                loadedSettings.appointmentDuration = setting.settingValue
                break
              case 'business_hours_start':
                loadedSettings.businessHoursStart = setting.settingValue
                break
              case 'business_hours_end':
                loadedSettings.businessHoursEnd = setting.settingValue
                break
              case 'email_notifications':
                loadedSettings.emailNotifications = setting.settingValue === 'true'
                break
              case 'sms_notifications':
                loadedSettings.smsNotifications = setting.settingValue === 'true'
                break
              case 'appointment_reminders':
                loadedSettings.appointmentReminders = setting.settingValue === 'true'
                break
              case 'tax_rate':
                loadedSettings.taxRate = setting.settingValue
                break
              case 'double_booking_enabled':
                loadedSettings.doubleBookingEnabled = setting.settingValue === 'true'
                break
              case 'double_booking_max_per_slot':
                loadedSettings.doubleBookingMaxPerSlot = setting.settingValue
                break
            }
          })
          
          setSettings(loadedSettings)
          setSavedSettings(loadedSettings)
        }
      }
    } catch (error) {
      console.error('Error loading settings:', error)
      toast({
        title: "Warning",
        description: "Could not load saved settings. Using defaults.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
      setInitialLoad(false)
    }
  }

  const saveSetting = async (key: string, value: string, dataType: string = 'string') => {
    // Try to update existing, otherwise create
    const res = await fetch('/api/settings')
    const data = await res.json()
    const existing = data.data?.settings?.find((s: any) => s.settingKey === key)
    
    if (existing) {
      // Update existing
      await fetch(`/api/settings/${existing.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settingValue: value })
      })
    } else {
      // Create new
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          settingKey: key,
          settingValue: value,
          dataType,
          isPublic: true,
          description: `System setting: ${key}`
        })
      })
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      // Save settings that this page controls (booking, notifications, security)
      // Clinic info, branding, announcements have their own save buttons in their tabs
      await Promise.all([
        saveSetting('appointment_duration', settings.appointmentDuration, 'integer'),
        saveSetting('email_notifications', settings.emailNotifications.toString(), 'boolean'),
        saveSetting('sms_notifications', settings.smsNotifications.toString(), 'boolean'),
        saveSetting('appointment_reminders', settings.appointmentReminders.toString(), 'boolean'),
        saveSetting('double_booking_enabled', settings.doubleBookingEnabled.toString(), 'boolean'),
        saveSetting('double_booking_max_per_slot', settings.doubleBookingMaxPerSlot, 'integer'),
      ])
      
      setSavedSettings({ ...settings })
      setHasChanges(false)
      
      toast({
        title: "Settings Saved",
        description: "All settings have been saved successfully.",
      })
    } catch (error) {
      console.error('Error saving settings:', error)
      toast({
        title: "Error",
        description: "Failed to save settings. Please try again.",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  if (initialLoad && loading) {
    return (
      <DashboardLayout title="System Settings">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout title="System Settings">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">System Settings</h1>
            <p className="text-gray-600">Configure clinic settings and preferences</p>
          </div>
          <div className="flex items-center gap-3">
            {hasChanges && (
              <span className="text-sm text-amber-600 flex items-center">
                <AlertCircle className="w-4 h-4 mr-1" />
                Unsaved changes
              </span>
            )}
            <Button onClick={handleSave} disabled={saving || !hasChanges}>
              {saving ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</>
              ) : (
                <><Save className="w-4 h-4 mr-2" /> Save Changes</>
              )}
            </Button>
          </div>
        </div>

        <Tabs defaultValue="clinic-info" className="space-y-6">
          <TabsList className="bg-white border flex-wrap h-auto p-1 gap-1 w-full grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7">
            <TabsTrigger value="clinic-info" className="flex items-center justify-center gap-1.5 text-xs sm:text-sm whitespace-nowrap">
              <Building2 className="w-4 h-4" />
              <span className="sm:hidden">Info</span>
              <span className="hidden sm:inline">Clinic Info</span>
            </TabsTrigger>
            <TabsTrigger value="clinic-hours" className="flex items-center justify-center gap-1.5 text-xs sm:text-sm whitespace-nowrap">
              <Clock className="w-4 h-4" />
              <span className="sm:hidden">Hours</span>
              <span className="hidden sm:inline">Clinic Hours</span>
            </TabsTrigger>
            <TabsTrigger value="booking" className="flex items-center justify-center gap-1.5 text-xs sm:text-sm whitespace-nowrap">
              <Settings className="w-4 h-4" />
              Booking
            </TabsTrigger>
            <TabsTrigger value="branding" className="flex items-center justify-center gap-1.5 text-xs sm:text-sm whitespace-nowrap">
              <ImageIcon className="w-4 h-4" />
              Branding
            </TabsTrigger>
            <TabsTrigger value="announcements" className="flex items-center justify-center gap-1.5 text-xs sm:text-sm whitespace-nowrap">
              <Megaphone className="w-4 h-4" />
              <span className="sm:hidden">Announce</span>
              <span className="hidden sm:inline">Announcements</span>
            </TabsTrigger>
            <TabsTrigger value="notifications" className="flex items-center justify-center gap-1.5 text-xs sm:text-sm whitespace-nowrap">
              <Bell className="w-4 h-4" />
              <span className="sm:hidden">Notif</span>
              <span className="hidden sm:inline">Notifications</span>
            </TabsTrigger>
            <TabsTrigger value="security" className="flex items-center justify-center gap-1.5 text-xs sm:text-sm whitespace-nowrap">
              <Shield className="w-4 h-4" />
              Security
            </TabsTrigger>
          </TabsList>

          <TabsContent value="clinic-info">
            <ClinicInfoTab settings={systemSettingMap} onSettingsChange={() => { loadSettings(); loadControlCenterData() }} />
          </TabsContent>

          <TabsContent value="clinic-hours">
            <ClinicHoursManager />
          </TabsContent>

          <TabsContent value="branding">
            <BrandingTab settings={systemSettingMap} onSettingsChange={loadControlCenterData} />
          </TabsContent>

          <TabsContent value="announcements">
            <AnnouncementsTab announcements={announcements} onRefresh={loadControlCenterData} />
          </TabsContent>

          <TabsContent value="booking">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Clock className="w-5 h-5 mr-2" />
                    Default Double Booking
                  </CardTitle>
                  <p className="text-sm text-gray-600 mt-1">
                    Set the clinic-wide default for double booking. Use the cards below to customize
                    limits per weekday or for specific dates.
                  </p>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Allow double booking by default</p>
                      <p className="text-sm text-gray-600">
                        When disabled, only one appointment may be booked per time slot
                        (unless overridden per weekday or per date below).
                      </p>
                    </div>
                    <Switch
                      checked={settings.doubleBookingEnabled}
                      onCheckedChange={(checked) =>
                        setSettings({ ...settings, doubleBookingEnabled: checked })
                      }
                    />
                  </div>

                  <div className={settings.doubleBookingEnabled ? '' : 'opacity-50 pointer-events-none'}>
                    <label className="block text-sm font-medium mb-2">
                      Default maximum appointments per time slot
                    </label>
                    <Input
                      type="number"
                      min={1}
                      max={50}
                      value={settings.doubleBookingMaxPerSlot}
                      onChange={(e) => {
                        const val = e.target.value.replace(/[^0-9]/g, '')
                        setSettings({ ...settings, doubleBookingMaxPerSlot: val })
                      }}
                      className="max-w-[180px]"
                      disabled={!settings.doubleBookingEnabled}
                    />
                    <p className="text-xs text-gray-500 mt-2">
                      Example: set to <strong>3</strong> to allow up to 3 concurrent bookings per slot.
                      This is the fallback when no weekday/date override applies. Don&apos;t forget to click&nbsp;
                      <strong>Save Changes</strong> at the top.
                    </p>
                  </div>

                  <div className="rounded-lg bg-blue-50 border border-blue-200 p-4 text-sm text-blue-900">
                    <p className="font-medium mb-1">Default effective cap</p>
                    <p>
                      {settings.doubleBookingEnabled
                        ? `Up to ${Math.max(1, parseInt(settings.doubleBookingMaxPerSlot || '1', 10) || 1)} appointment(s) per time slot when no override is in place.`
                        : 'Double booking is OFF — only 1 appointment per time slot when no override is in place.'}
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Per-weekday & per-date overrides — same UX as Clinic Hours */}
              <DoubleBookingManager
                globalEnabled={savedSettings.doubleBookingEnabled}
                globalMaxPerSlot={Math.max(1, parseInt(savedSettings.doubleBookingMaxPerSlot || '1', 10) || 1)}
              />
            </div>
          </TabsContent>

          <TabsContent value="notifications">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Bell className="w-5 h-5 mr-2" />
                  Notification Settings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Email Notifications</p>
                    <p className="text-sm text-gray-600">Send notifications via email</p>
                  </div>
                  <Switch
                    checked={settings.emailNotifications}
                    onCheckedChange={(checked) => setSettings({...settings, emailNotifications: checked})}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">SMS Notifications</p>
                    <p className="text-sm text-gray-600">Send notifications via text message</p>
                  </div>
                  <Switch
                    checked={settings.smsNotifications}
                    onCheckedChange={(checked) => setSettings({...settings, smsNotifications: checked})}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Appointment Reminders</p>
                    <p className="text-sm text-gray-600">Automatically send appointment reminders</p>
                  </div>
                  <Switch
                    checked={settings.appointmentReminders}
                    onCheckedChange={(checked) => setSettings({...settings, appointmentReminders: checked})}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="security">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Shield className="w-5 h-5 mr-2" />
                  Security Settings
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="font-medium mb-2">Password Policy</p>
                    <ul className="text-sm text-gray-600 space-y-1">
                      <li>• Minimum 8 characters</li>
                      <li>• Must contain uppercase and lowercase letters</li>
                      <li>• Must contain at least one number</li>
                      <li>• Must contain at least one special character</li>
                    </ul>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="font-medium mb-2">Two-Factor Authentication</p>
                    <p className="text-sm text-gray-600 mb-2">Add an extra layer of security to user accounts</p>
                    <Button variant="outline" disabled>
                      Configure 2FA (Coming Soon)
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  )
}
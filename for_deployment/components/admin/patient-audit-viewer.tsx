'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  History,
  Loader2,
  Filter,
  RefreshCw,
  ArrowRight,
  User as UserIcon,
  Calendar,
  ChevronDown,
  ChevronUp,
  X as XIcon,
} from 'lucide-react'
import { format, parseISO, formatDistanceToNow } from 'date-fns'

interface AuditEntry {
  id: string
  logId: string
  fieldKey: string | null
  fieldLabel: string | null
  oldValue: any
  newValue: any
  action: string
  category: string | null
  description: string | null
  createdAt: string
  userName: string
  userRole: string | null
}

interface Props {
  patientId: string
  refreshKey?: number
}

const CATEGORY_COLORS: Record<string, string> = {
  CLINICAL: 'bg-red-50 text-red-700 border-red-200',
  OPERATIONAL: 'bg-blue-50 text-blue-700 border-blue-200',
  ADMINISTRATIVE: 'bg-purple-50 text-purple-700 border-purple-200',
}

const ACTION_COLORS: Record<string, string> = {
  create: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  update: 'bg-amber-50 text-amber-700 border-amber-200',
  delete: 'bg-rose-50 text-rose-700 border-rose-200',
}

function formatValue(v: any): string {
  if (v === null || v === undefined || v === '') return '—'
  if (typeof v === 'boolean') return v ? 'Yes' : 'No'
  if (typeof v === 'object') {
    try {
      return JSON.stringify(v, null, 2)
    } catch {
      return String(v)
    }
  }
  const s = String(v)
  // Try ISO date detection
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) {
    try {
      return format(parseISO(s), 'MMM d, yyyy h:mm a')
    } catch {
      return s
    }
  }
  return s
}

export default function PatientAuditViewer({ patientId, refreshKey }: Props) {
  const [entries, setEntries] = useState<AuditEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [distinctFields, setDistinctFields] = useState<string[]>([])
  const [expanded, setExpanded] = useState(false)
  const [expandedEntries, setExpandedEntries] = useState<Record<string, boolean>>({})
  const [total, setTotal] = useState(0)

  // Filters
  const [fieldFilter, setFieldFilter] = useState<string>('all')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [actionFilter, setActionFilter] = useState<string>('all')
  const [fromDate, setFromDate] = useState<string>('')
  const [toDate, setToDate] = useState<string>('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (fieldFilter && fieldFilter !== 'all') params.set('field', fieldFilter)
      if (categoryFilter && categoryFilter !== 'all') params.set('category', categoryFilter)
      if (actionFilter && actionFilter !== 'all') params.set('action', actionFilter)
      if (fromDate) params.set('from', new Date(fromDate).toISOString())
      if (toDate) params.set('to', new Date(toDate + 'T23:59:59').toISOString())
      params.set('limit', '200')

      const res = await fetch(`/api/patients/${patientId}/audit-log?${params.toString()}`)
      if (!res.ok) throw new Error('Failed to load audit log')
      const json = await res.json()
      setEntries(json.entries || [])
      setTotal(json.pagination?.total || 0)
      if (json.meta?.distinctFields && (fieldFilter === 'all' || distinctFields.length === 0)) {
        // Keep the broader list when no field filter is active
        if (fieldFilter === 'all') setDistinctFields(json.meta.distinctFields)
      }
    } catch (err) {
      console.error('audit-log load error', err)
      setEntries([])
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId, fieldFilter, categoryFilter, actionFilter, fromDate, toDate])

  useEffect(() => {
    if (expanded) load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded, load, refreshKey])

  const resetFilters = () => {
    setFieldFilter('all')
    setCategoryFilter('all')
    setActionFilter('all')
    setFromDate('')
    setToDate('')
  }

  const grouped = useMemo(() => {
    // Group entries by logId so changes made in the same save appear together
    const map = new Map<string, AuditEntry[]>()
    for (const e of entries) {
      if (!map.has(e.logId)) map.set(e.logId, [])
      map.get(e.logId)!.push(e)
    }
    return Array.from(map.entries()).map(([logId, items]) => ({
      logId,
      items,
      first: items[0],
    }))
  }, [entries])

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            <History className="w-4 h-4 text-purple-600" />
            Field-Level Audit Trail
            {total > 0 && (
              <Badge variant="outline" className="text-xs ml-1">
                {total} log{total !== 1 ? 's' : ''}
              </Badge>
            )}
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setExpanded(e => !e)}
          >
            {expanded ? (
              <>
                <ChevronUp className="w-4 h-4 mr-1" /> Hide
              </>
            ) : (
              <>
                <ChevronDown className="w-4 h-4 mr-1" /> Show History
              </>
            )}
          </Button>
        </div>
        <p className="text-xs text-gray-500 mt-1">
          Every change to this patient's record is tracked with before/after values, timestamp, and the user who made the change.
        </p>
      </CardHeader>

      {expanded && (
        <CardContent className="space-y-3">
          {/* Filters */}
          <div className="bg-gray-50 border rounded-lg p-3 space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-gray-700">
              <Filter className="w-3.5 h-3.5" /> Filters
              <Button
                variant="ghost"
                size="sm"
                onClick={resetFilters}
                className="ml-auto h-6 px-2 text-xs"
              >
                <XIcon className="w-3 h-3 mr-1" /> Clear
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={load}
                className="h-6 px-2 text-xs"
                disabled={loading}
              >
                <RefreshCw className={`w-3 h-3 mr-1 ${loading ? 'animate-spin' : ''}`} /> Refresh
              </Button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              <div>
                <Label className="text-[10px]">Field</Label>
                <Select value={fieldFilter} onValueChange={setFieldFilter}>
                  <SelectTrigger className="h-8 text-xs bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All fields</SelectItem>
                    {distinctFields.map(f => (
                      <SelectItem key={f} value={f}>
                        {f}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[10px]">Category</Label>
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="h-8 text-xs bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="CLINICAL">Clinical</SelectItem>
                    <SelectItem value="OPERATIONAL">Operational</SelectItem>
                    <SelectItem value="ADMINISTRATIVE">Administrative</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[10px]">Action</Label>
                <Select value={actionFilter} onValueChange={setActionFilter}>
                  <SelectTrigger className="h-8 text-xs bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="create">Create</SelectItem>
                    <SelectItem value="update">Update</SelectItem>
                    <SelectItem value="delete">Delete</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[10px]">From</Label>
                <Input
                  type="date"
                  value={fromDate}
                  onChange={e => setFromDate(e.target.value)}
                  className="h-8 text-xs bg-white"
                />
              </div>
              <div>
                <Label className="text-[10px]">To</Label>
                <Input
                  type="date"
                  value={toDate}
                  onChange={e => setToDate(e.target.value)}
                  className="h-8 text-xs bg-white"
                />
              </div>
            </div>
          </div>

          {/* Entries */}
          {loading ? (
            <div className="flex items-center justify-center py-8 text-gray-500">
              <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading audit history…
            </div>
          ) : grouped.length === 0 ? (
            <div className="text-center py-8 text-sm text-gray-500">
              No audit entries match the current filters.
            </div>
          ) : (
            <ScrollArea className="max-h-[600px] pr-2">
              <div className="space-y-3">
                {grouped.map(({ logId, items, first }) => {
                  const hasFieldChanges = items.some(i => i.fieldKey)
                  const isExpanded = expandedEntries[logId] !== false // default open
                  return (
                    <div key={logId} className="border rounded-lg bg-white overflow-hidden">
                      <div className="bg-gray-50 border-b px-3 py-2 flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge
                            className={`text-[10px] border ${ACTION_COLORS[first.action] || ''}`}
                            variant="outline"
                          >
                            {first.action}
                          </Badge>
                          {first.category && (
                            <Badge
                              className={`text-[10px] border ${
                                CATEGORY_COLORS[first.category] || ''
                              }`}
                              variant="outline"
                            >
                              {first.category}
                            </Badge>
                          )}
                          <span className="text-xs text-gray-700 font-medium">
                            {first.description || 'Patient record update'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-gray-500">
                          <span className="flex items-center gap-1">
                            <UserIcon className="w-3 h-3" /> {first.userName}
                            {first.userRole && (
                              <span className="text-gray-400">({first.userRole})</span>
                            )}
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {format(parseISO(first.createdAt), 'MMM d, yyyy h:mm a')}
                          </span>
                          <span className="text-gray-400">
                            ({formatDistanceToNow(parseISO(first.createdAt), { addSuffix: true })})
                          </span>
                          {hasFieldChanges && (
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedEntries(s => ({ ...s, [logId]: !isExpanded }))
                              }
                              className="p-0.5 hover:bg-gray-200 rounded"
                            >
                              {isExpanded ? (
                                <ChevronUp className="w-3.5 h-3.5" />
                              ) : (
                                <ChevronDown className="w-3.5 h-3.5" />
                              )}
                            </button>
                          )}
                        </div>
                      </div>

                      {hasFieldChanges && isExpanded && (
                        <div className="divide-y">
                          {items
                            .filter(i => i.fieldKey)
                            .map(item => (
                              <div
                                key={item.id}
                                className="px-3 py-2 grid grid-cols-1 md:grid-cols-[180px_1fr_24px_1fr] gap-2 text-xs"
                              >
                                <div className="font-semibold text-gray-800">
                                  {item.fieldLabel}
                                  <div className="text-[10px] text-gray-400 font-normal font-mono">
                                    {item.fieldKey}
                                  </div>
                                </div>
                                <div className="bg-rose-50 border border-rose-100 rounded px-2 py-1.5 text-rose-800 whitespace-pre-wrap break-words">
                                  <div className="text-[10px] text-rose-600 font-semibold mb-0.5">BEFORE</div>
                                  <div className="font-mono text-xs">{formatValue(item.oldValue)}</div>
                                </div>
                                <div className="hidden md:flex items-center justify-center text-gray-400">
                                  <ArrowRight className="w-4 h-4" />
                                </div>
                                <div className="bg-emerald-50 border border-emerald-100 rounded px-2 py-1.5 text-emerald-800 whitespace-pre-wrap break-words">
                                  <div className="text-[10px] text-emerald-600 font-semibold mb-0.5">AFTER</div>
                                  <div className="font-mono text-xs">{formatValue(item.newValue)}</div>
                                </div>
                              </div>
                            ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      )}
    </Card>
  )
}

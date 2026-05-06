
'use client'

import { formatDisplayName } from '@/lib/utils'
import { useState, useEffect } from 'react'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ChevronLeft, ChevronRight, ClipboardList, Shield, Stethoscope, Briefcase } from 'lucide-react'

interface AuditLog {
  id: string
  action: string
  category: string | null
  description: string | null
  entityType: string
  entityId: string
  createdAt: string
  user: {
    firstName: string
    lastName: string
    email: string
    role: string
  } | null
}

export default function AuditLogPage() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [categoryFilter, setCategoryFilter] = useState('all')

  const fetchLogs = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: page.toString(), limit: '30' })
      if (categoryFilter !== 'all') params.set('category', categoryFilter)
      
      const res = await fetch(`/api/admin/audit-log?${params}`, { credentials: 'include' })
      const data = await res.json()
      if (res.ok) {
        setLogs(data.logs || [])
        setTotalPages(data.pagination?.pages || 1)
      }
    } catch (error) {
      console.error('Failed to fetch audit logs:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchLogs() }, [page, categoryFilter])

  const getCategoryBadge = (category: string | null) => {
    switch (category) {
      case 'CLINICAL':
        return <Badge className="bg-blue-100 text-blue-700"><Stethoscope className="w-3 h-3 mr-1" />Clinical</Badge>
      case 'OPERATIONAL':
        return <Badge className="bg-emerald-100 text-emerald-700"><Briefcase className="w-3 h-3 mr-1" />Operational</Badge>
      case 'ADMINISTRATIVE':
        return <Badge className="bg-orange-100 text-orange-700"><Shield className="w-3 h-3 mr-1" />Administrative</Badge>
      default:
        return <Badge className="bg-gray-100 text-gray-600">Uncategorized</Badge>
    }
  }

  const getActionBadge = (action: string) => {
    const colors: Record<string, string> = {
      create: 'bg-green-100 text-green-700',
      update: 'bg-blue-100 text-blue-700',
      delete: 'bg-red-100 text-red-700',
      login: 'bg-purple-100 text-purple-700',
      logout: 'bg-gray-100 text-gray-700',
      password_change: 'bg-yellow-100 text-yellow-700',
      permission_change: 'bg-orange-100 text-orange-700',
    }
    return <Badge className={colors[action] || 'bg-gray-100 text-gray-600'}>{action.replace('_', ' ')}</Badge>
  }

  return (
    <DashboardLayout title="Audit Log">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-primary flex-shrink-0" />
            <p className="text-sm sm:text-base text-muted-foreground">Track all system actions tagged by category</p>
          </div>
          <Select value={categoryFilter} onValueChange={v => { setCategoryFilter(v); setPage(1) }}>
            <SelectTrigger className="w-full sm:w-[180px]"><SelectValue placeholder="Filter category" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              <SelectItem value="CLINICAL">Clinical</SelectItem>
              <SelectItem value="OPERATIONAL">Operational</SelectItem>
              <SelectItem value="ADMINISTRATIVE">Administrative</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-8 text-center text-muted-foreground">Loading audit logs...</div>
            ) : logs.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">No audit logs found</div>
            ) : (
              <>
                {/* Desktop: Table view */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Timestamp</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">User</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Action</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Category</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Description</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Entity</th>
                      </tr>
                    </thead>
                    <tbody>
                      {logs.map(log => (
                        <tr key={log.id} className="border-b hover:bg-muted/30">
                          <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">
                            {new Date(log.createdAt).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td className="px-4 py-3">
                            {log.user ? (
                              <div>
                                <p className="text-sm font-medium">{formatDisplayName(log.user.firstName, log.user.lastName)}</p>
                                <p className="text-xs text-muted-foreground">{log.user.role}</p>
                              </div>
                            ) : (
                              <span className="text-sm text-muted-foreground">System</span>
                            )}
                          </td>
                          <td className="px-4 py-3">{getActionBadge(log.action)}</td>
                          <td className="px-4 py-3">{getCategoryBadge(log.category)}</td>
                          <td className="px-4 py-3 text-sm max-w-[300px] truncate">{log.description || '-'}</td>
                          <td className="px-4 py-3 text-sm text-muted-foreground">{log.entityType}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile: Card view */}
                <div className="md:hidden divide-y">
                  {logs.map(log => (
                    <div key={log.id} className="p-4 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          {log.user ? (
                            <>
                              <p className="text-sm font-medium break-words">{formatDisplayName(log.user.firstName, log.user.lastName)}</p>
                              <p className="text-xs text-muted-foreground">{log.user.role}</p>
                            </>
                          ) : (
                            <p className="text-sm text-muted-foreground">System</p>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground whitespace-nowrap flex-shrink-0">
                          {new Date(log.createdAt).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {getActionBadge(log.action)}
                        {getCategoryBadge(log.category)}
                      </div>
                      {log.description && (
                        <p className="text-sm break-words text-foreground">{log.description}</p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        <span className="font-medium">Entity:</span> {log.entityType}
                      </p>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex justify-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="flex items-center text-sm text-muted-foreground">Page {page} of {totalPages}</span>
            <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}

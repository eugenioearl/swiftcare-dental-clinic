'use client'

import { useState, useEffect } from 'react'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Package, DollarSign, Shield, Users, Calendar, TrendingUp,
  AlertCircle, Loader2, ArrowUpRight, CreditCard, Banknote,
  CheckCircle, Clock, FileText, Activity, PieChart, Upload,
  Stethoscope, UserCheck, BarChart3
} from 'lucide-react'
import { format, parseISO } from 'date-fns'

interface InsightsData {
  packages: {
    total: number
    byStatus: Record<string, number>
    totalRevenue: number
    totalBalance: number
    totalCoverage: number
  }
  payments: {
    total: number
    totalAmount: number
    byMethod: Record<string, { count: number; total: number }>
    recent: { id: string; amount: number; method: string; date: string; status: string }[]
  }
  revenueTrends: { month: string; revenue: number; payments: number }[]
  procedureBreakdown: { name: string; count: number; total: number }[]
  dentistBreakdown: { name: string; procedures: number }[]
  consents: {
    total: number
    byStatus: Record<string, number>
  }
  overview: {
    activePatients: number
    todaysAppointments: number
  }
  actionItems: { type: string; title: string; detail: string; priority: string }[]
  patientInsights: { id: string; name: string; total: number; visits: number }[]
  migration: {
    total: number
    byStatus: Record<string, number>
    byClassification: Record<string, number>
  }
}

const pkgStatusColors: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  active: 'bg-blue-100 text-blue-700',
  in_progress: 'bg-[#2D9DA8]/10 text-[#2D9DA8]',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
}

const priorityColors: Record<string, string> = {
  high: 'bg-red-100 text-red-700 border-red-200',
  medium: 'bg-orange-100 text-orange-700 border-orange-200',
  low: 'bg-yellow-100 text-yellow-700 border-yellow-200',
}

export default function InsightsPage() {
  const [data, setData] = useState<InsightsData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/admin/insights')
      .then(r => r.json())
      .then(d => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Insights Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">Overview of packages, payments, and consent workflows</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-[#2D9DA8]" />
          </div>
        ) : !data ? (
          <Card><CardContent className="py-10 text-center text-gray-500">Failed to load insights</CardContent></Card>
        ) : (
          <>
            {/* KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="border-l-4 border-l-[#2D9DA8]">
                <CardContent className="pt-4 pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-gray-500 uppercase font-medium">Total Revenue</p>
                      <p className="text-2xl font-bold text-gray-900">₱{data.payments.totalAmount.toLocaleString()}</p>
                    </div>
                    <div className="w-10 h-10 rounded-full bg-[#2D9DA8]/10 flex items-center justify-center">
                      <DollarSign className="w-5 h-5 text-[#2D9DA8]" />
                    </div>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">{data.payments.total} payments recorded</p>
                </CardContent>
              </Card>

              <Card className="border-l-4 border-l-orange-400">
                <CardContent className="pt-4 pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-gray-500 uppercase font-medium">Outstanding</p>
                      <p className="text-2xl font-bold text-orange-600">₱{data.packages.totalBalance.toLocaleString()}</p>
                    </div>
                    <div className="w-10 h-10 rounded-full bg-orange-50 flex items-center justify-center">
                      <AlertCircle className="w-5 h-5 text-orange-500" />
                    </div>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">Across all active packages</p>
                </CardContent>
              </Card>

              <Card className="border-l-4 border-l-[#22B573]">
                <CardContent className="pt-4 pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-gray-500 uppercase font-medium">Packages</p>
                      <p className="text-2xl font-bold text-gray-900">{data.packages.total}</p>
                    </div>
                    <div className="w-10 h-10 rounded-full bg-[#22B573]/10 flex items-center justify-center">
                      <Package className="w-5 h-5 text-[#22B573]" />
                    </div>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    {data.packages.byStatus['active'] || 0} active, {data.packages.byStatus['completed'] || 0} completed
                  </p>
                </CardContent>
              </Card>

              <Card className="border-l-4 border-l-purple-400">
                <CardContent className="pt-4 pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-gray-500 uppercase font-medium">Patients</p>
                      <p className="text-2xl font-bold text-gray-900">{data.overview.activePatients}</p>
                    </div>
                    <div className="w-10 h-10 rounded-full bg-purple-50 flex items-center justify-center">
                      <Users className="w-5 h-5 text-purple-500" />
                    </div>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">{data.overview.todaysAppointments} appointments today</p>
                </CardContent>
              </Card>
            </div>

            {/* Tabbed Sections */}
            <Tabs defaultValue="overview" className="space-y-4">
              <TabsList className="bg-white border w-full sm:w-auto h-auto grid grid-cols-3 sm:grid-cols-5 sm:flex">
                <TabsTrigger value="overview" className="text-xs sm:text-sm whitespace-nowrap">Overview</TabsTrigger>
                <TabsTrigger value="revenue" className="text-xs sm:text-sm whitespace-nowrap">Revenue</TabsTrigger>
                <TabsTrigger value="packages" className="text-xs sm:text-sm whitespace-nowrap">Packages</TabsTrigger>
                <TabsTrigger value="patients" className="text-xs sm:text-sm whitespace-nowrap">Patients</TabsTrigger>
                <TabsTrigger value="migration" className="text-xs sm:text-sm whitespace-nowrap">Migration</TabsTrigger>
              </TabsList>

              {/* OVERVIEW TAB */}
              <TabsContent value="overview" className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Action Needed */}
                  <Card className="lg:col-span-1">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-orange-500" />
                        Action Needed
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {data.actionItems.length === 0 ? (
                        <div className="text-center py-6">
                          <CheckCircle className="w-8 h-8 text-green-400 mx-auto mb-2" />
                          <p className="text-sm text-gray-500">All clear!</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {data.actionItems.map((item, idx) => (
                            <div key={idx} className={`border rounded-lg p-2.5 ${priorityColors[item.priority] || 'bg-gray-50'}`}>
                              <div className="flex items-start gap-2">
                                {item.type === 'payment' ? <DollarSign className="w-4 h-4 mt-0.5 flex-shrink-0" /> : <Shield className="w-4 h-4 mt-0.5 flex-shrink-0" />}
                                <div>
                                  <p className="text-sm font-medium">{item.title}</p>
                                  <p className="text-xs opacity-70">{item.detail}</p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Consent Stats */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Shield className="w-4 h-4 text-purple-500" />
                        Consent Overview
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-center mb-4">
                        <p className="text-3xl font-bold text-gray-900">{data.consents.total}</p>
                        <p className="text-xs text-gray-500">Total Consents</p>
                      </div>
                      <div className="space-y-2">
                        {Object.entries(data.consents.byStatus).map(([status, count]) => (
                          <div key={status} className="flex items-center justify-between">
                            <span className="text-sm capitalize text-gray-600">{status}</span>
                            <div className="flex items-center gap-2">
                              <div className="w-20 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                <div className="h-full bg-purple-400 rounded-full" style={{ width: `${data.consents.total ? (count / data.consents.total) * 100 : 0}%` }} />
                              </div>
                              <span className="text-sm font-medium w-6 text-right">{count}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Payment Methods */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center gap-2">
                        <CreditCard className="w-4 h-4 text-[#2D9DA8]" />
                        Payment Methods
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {Object.keys(data.payments.byMethod).length === 0 ? (
                        <p className="text-sm text-gray-400 text-center py-4">No payments yet</p>
                      ) : (
                        <div className="space-y-3">
                          {Object.entries(data.payments.byMethod).map(([method, info]) => (
                            <div key={method} className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Banknote className="w-4 h-4 text-gray-400" />
                                <span className="text-sm capitalize">{method.replace('_', ' ')}</span>
                              </div>
                              <div className="text-right">
                                <p className="text-sm font-medium">₱{info.total.toLocaleString()}</p>
                                <p className="text-xs text-gray-400">{info.count} payments</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* Recent Payments */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Clock className="w-4 h-4 text-gray-500" />
                      Recent Payments
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {data.payments.recent.length === 0 ? (
                      <p className="text-sm text-gray-400 text-center py-4">No payments recorded yet</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b text-left">
                              <th className="pb-2 text-xs text-gray-500 font-medium">Date</th>
                              <th className="pb-2 text-xs text-gray-500 font-medium">Amount</th>
                              <th className="pb-2 text-xs text-gray-500 font-medium">Method</th>
                              <th className="pb-2 text-xs text-gray-500 font-medium">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y">
                            {data.payments.recent.map(p => (
                              <tr key={p.id} className="hover:bg-gray-50">
                                <td className="py-2 text-gray-700">{format(parseISO(p.date), 'MMM d, yyyy')}</td>
                                <td className="py-2 font-medium">₱{p.amount.toLocaleString()}</td>
                                <td className="py-2 capitalize text-gray-600">{(p.method || 'unknown').replace('_', ' ')}</td>
                                <td className="py-2">
                                  <Badge variant={p.status === 'completed' ? 'default' : 'secondary'} className="text-xs">{p.status}</Badge>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* REVENUE TAB */}
              <TabsContent value="revenue" className="space-y-6">
                {/* Revenue Trend Chart (CSS bar chart) */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-[#2D9DA8]" />
                      Monthly Revenue Trend
                    </CardTitle>
                    <CardDescription className="text-xs">Last 12 months</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {(() => {
                      const maxRev = Math.max(...data.revenueTrends.map(t => t.revenue), 1)
                      return (
                        <div className="flex items-end gap-1.5 h-48">
                          {data.revenueTrends.map((t, i) => (
                            <div key={i} className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
                              <span className="text-[10px] text-gray-500 font-medium">
                                {t.revenue > 0 ? `₱${(t.revenue / 1000).toFixed(0)}k` : ''}
                              </span>
                              <div
                                className="w-full bg-gradient-to-t from-[#2D9DA8] to-[#2D9DA8]/60 rounded-t-sm transition-all duration-500 min-h-[2px]"
                                style={{ height: `${Math.max((t.revenue / maxRev) * 100, 2)}%` }}
                                title={`${t.month}: ₱${t.revenue.toLocaleString()} (${t.payments} payments)`}
                              />
                              <span className="text-[9px] text-gray-400 -rotate-45 origin-top-left w-8 truncate">{t.month}</span>
                            </div>
                          ))}
                        </div>
                      )
                    })()}
                  </CardContent>
                </Card>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Per Procedure */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Stethoscope className="w-4 h-4 text-[#22B573]" />
                        Revenue by Procedure
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {data.procedureBreakdown.length === 0 ? (
                        <p className="text-sm text-gray-400 text-center py-4">No procedure data yet</p>
                      ) : (
                        <div className="space-y-3">
                          {data.procedureBreakdown.map((proc, i) => {
                            const maxTotal = data.procedureBreakdown[0]?.total || 1
                            return (
                              <div key={i}>
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-sm text-gray-700 truncate max-w-[60%]">{proc.name}</span>
                                  <div className="text-right">
                                    <span className="text-sm font-medium">₱{proc.total.toLocaleString()}</span>
                                    <span className="text-xs text-gray-400 ml-1">({proc.count}x)</span>
                                  </div>
                                </div>
                                <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                  <div className="h-full bg-[#22B573] rounded-full" style={{ width: `${(proc.total / maxTotal) * 100}%` }} />
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Per Dentist */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center gap-2">
                        <UserCheck className="w-4 h-4 text-[#2D9DA8]" />
                        Procedures by Dentist
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {data.dentistBreakdown.length === 0 ? (
                        <p className="text-sm text-gray-400 text-center py-4">No dentist data yet</p>
                      ) : (
                        <div className="space-y-3">
                          {data.dentistBreakdown.map((d, i) => {
                            const maxProc = data.dentistBreakdown[0]?.procedures || 1
                            return (
                              <div key={i}>
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-sm text-gray-700">{d.name}</span>
                                  <span className="text-sm font-medium">{d.procedures} procedures</span>
                                </div>
                                <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                  <div className="h-full bg-[#2D9DA8] rounded-full" style={{ width: `${(d.procedures / maxProc) * 100}%` }} />
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              {/* PACKAGES TAB */}
              <TabsContent value="packages" className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Package className="w-4 h-4 text-[#22B573]" />
                        Package Status Breakdown
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {Object.keys(data.packages.byStatus).length === 0 ? (
                        <p className="text-sm text-gray-400 text-center py-4">No packages yet</p>
                      ) : (
                        <div className="space-y-3">
                          {Object.entries(data.packages.byStatus).map(([status, count]) => (
                            <div key={status} className="flex items-center justify-between">
                              <Badge className={`text-xs ${pkgStatusColors[status] || 'bg-gray-100 text-gray-700'}`}>
                                {status.replace('_', ' ')}
                              </Badge>
                              <div className="flex items-center gap-2">
                                <div className="w-32 h-2 bg-gray-100 rounded-full overflow-hidden">
                                  <div className="h-full bg-[#2D9DA8] rounded-full" style={{ width: `${data.packages.total ? (count / data.packages.total) * 100 : 0}%` }} />
                                </div>
                                <span className="text-sm font-medium w-8 text-right">{count}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center gap-2">
                        <DollarSign className="w-4 h-4 text-[#2D9DA8]" />
                        Financial Summary
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div className="flex justify-between items-center p-3 bg-[#2D9DA8]/5 rounded-lg">
                          <span className="text-sm text-gray-600">Total Collected</span>
                          <span className="text-lg font-bold text-[#2D9DA8]">₱{data.packages.totalRevenue.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between items-center p-3 bg-orange-50 rounded-lg">
                          <span className="text-sm text-gray-600">Outstanding Balance</span>
                          <span className="text-lg font-bold text-orange-600">₱{data.packages.totalBalance.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between items-center p-3 bg-[#22B573]/5 rounded-lg">
                          <span className="text-sm text-gray-600">Coverage Applied</span>
                          <span className="text-lg font-bold text-[#22B573]">₱{data.packages.totalCoverage.toLocaleString()}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              {/* PATIENTS TAB */}
              <TabsContent value="patients" className="space-y-6">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Users className="w-4 h-4 text-[#2D9DA8]" />
                      Top Patients by Spend
                    </CardTitle>
                    <CardDescription className="text-xs">Patients with the highest total payments</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {data.patientInsights.length === 0 ? (
                      <p className="text-sm text-gray-400 text-center py-6">No patient payment data yet</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b text-left">
                              <th className="pb-2 text-xs text-gray-500 font-medium">#</th>
                              <th className="pb-2 text-xs text-gray-500 font-medium">Patient</th>
                              <th className="pb-2 text-xs text-gray-500 font-medium text-right">Total Spent</th>
                              <th className="pb-2 text-xs text-gray-500 font-medium text-right">Visits</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y">
                            {data.patientInsights.map((p, i) => (
                              <tr key={p.id} className="hover:bg-gray-50">
                                <td className="py-2.5 text-gray-400 font-medium">{i + 1}</td>
                                <td className="py-2.5">
                                  <span className="font-medium text-gray-800">{p.name}</span>
                                </td>
                                <td className="py-2.5 text-right font-medium text-[#2D9DA8]">₱{p.total.toLocaleString()}</td>
                                <td className="py-2.5 text-right text-gray-600">{p.visits}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* MIGRATION TAB */}
              <TabsContent value="migration" className="space-y-6">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <Card className="border-l-4 border-l-[#2D9DA8]">
                    <CardContent className="pt-4 pb-3">
                      <p className="text-xs text-gray-500 uppercase font-medium">Total Uploads</p>
                      <p className="text-2xl font-bold">{data.migration.total}</p>
                    </CardContent>
                  </Card>
                  <Card className="border-l-4 border-l-yellow-400">
                    <CardContent className="pt-4 pb-3">
                      <p className="text-xs text-gray-500 uppercase font-medium">Needs Review</p>
                      <p className="text-2xl font-bold text-yellow-600">{data.migration.byStatus['scanned'] || 0}</p>
                    </CardContent>
                  </Card>
                  <Card className="border-l-4 border-l-blue-400">
                    <CardContent className="pt-4 pb-3">
                      <p className="text-xs text-gray-500 uppercase font-medium">Reviewed</p>
                      <p className="text-2xl font-bold text-blue-600">{data.migration.byStatus['reviewed'] || 0}</p>
                    </CardContent>
                  </Card>
                  <Card className="border-l-4 border-l-[#22B573]">
                    <CardContent className="pt-4 pb-3">
                      <p className="text-xs text-gray-500 uppercase font-medium">Migrated</p>
                      <p className="text-2xl font-bold text-[#22B573]">{data.migration.byStatus['migrated'] || 0}</p>
                    </CardContent>
                  </Card>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* By Status */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center gap-2">
                        <BarChart3 className="w-4 h-4 text-[#2D9DA8]" />
                        Migration Status
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {Object.keys(data.migration.byStatus).length === 0 ? (
                        <p className="text-sm text-gray-400 text-center py-4">No uploads yet</p>
                      ) : (
                        <div className="space-y-3">
                          {Object.entries(data.migration.byStatus).map(([status, count]) => {
                            const colors: Record<string, string> = { uploaded: 'bg-gray-400', scanned: 'bg-yellow-400', reviewed: 'bg-blue-400', migrated: 'bg-[#22B573]' }
                            return (
                              <div key={status}>
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-sm capitalize text-gray-600">{status}</span>
                                  <span className="text-sm font-medium">{count}</span>
                                </div>
                                <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                                  <div className={`h-full rounded-full ${colors[status] || 'bg-gray-400'}`} style={{ width: `${data.migration.total ? (count / data.migration.total) * 100 : 0}%` }} />
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* By Classification */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center gap-2">
                        <FileText className="w-4 h-4 text-[#22B573]" />
                        Document Classification
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {Object.keys(data.migration.byClassification).length === 0 ? (
                        <p className="text-sm text-gray-400 text-center py-4">No classified documents</p>
                      ) : (
                        <div className="space-y-2">
                          {Object.entries(data.migration.byClassification).sort((a, b) => b[1] - a[1]).map(([cls, count]) => {
                            const clsColors: Record<string, string> = {
                              consent: 'bg-purple-100 text-purple-700', chart: 'bg-blue-100 text-blue-700',
                              notes: 'bg-green-100 text-green-700', package: 'bg-teal-100 text-teal-700',
                              payment: 'bg-orange-100 text-orange-700', prescription: 'bg-pink-100 text-pink-700',
                              xray: 'bg-indigo-100 text-indigo-700', referral: 'bg-cyan-100 text-cyan-700',
                              other: 'bg-gray-100 text-gray-700', unclassified: 'bg-gray-100 text-gray-500'
                            }
                            return (
                              <div key={cls} className="flex items-center justify-between">
                                <Badge className={`text-xs capitalize ${clsColors[cls] || 'bg-gray-100 text-gray-700'}`}>{cls}</Badge>
                                <span className="text-sm font-medium">{count}</span>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>
    </DashboardLayout>
  )
}

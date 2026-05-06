'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { 
  BarChart3, 
  TrendingUp, 
  TrendingDown, 
  Users, 
  Calendar,
  Activity,
  Target,
  FileText,
  Download,
  Filter,
  RefreshCw,
  AlertCircle
} from 'lucide-react'
import { PesoIcon, PesoSign } from '@/components/ui/peso-icon'
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts'

interface AnalyticsDashboardProps {
  timeRange: string
  onTimeRangeChange: (range: string) => void
}

const COLORS = ['#2D9DA8', '#22B573', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d']

export default function AnalyticsDashboard({ timeRange, onTimeRangeChange }: AnalyticsDashboardProps) {
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [kpiData, setKpiData] = useState<any>(null)
  const [revenueData, setRevenueData] = useState<any[]>([])
  const [paymentDistribution, setPaymentDistribution] = useState<any[]>([])
  const [financialSummary, setFinancialSummary] = useState<any>(null)
  const [patientFlowData, setPatientFlowData] = useState<any[]>([])
  const [demographics, setDemographics] = useState<any>(null)
  const [retentionMetrics, setRetentionMetrics] = useState<any>(null)
  const [patientSummary, setPatientSummary] = useState<any>(null)
  const [procedureData, setProcedureData] = useState<any[]>([])
  const [procedureSummary, setProcedureSummary] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  const fetchAllData = useCallback(async () => {
    try {
      setError(null)
      const [kpiRes, revenueRes, patientsRes, proceduresRes] = await Promise.all([
        fetch(`/api/analytics/kpis?timeRange=${timeRange}`),
        fetch(`/api/analytics/revenue?timeRange=${timeRange}`),
        fetch(`/api/analytics/patients?timeRange=${timeRange}`),
        fetch(`/api/analytics/procedures?timeRange=${timeRange}`)
      ])

      if (kpiRes.ok) {
        const d = await kpiRes.json()
        setKpiData(d.data?.kpis || null)
      }

      if (revenueRes.ok) {
        const d = await revenueRes.json()
        setRevenueData(d.data?.revenueData || [])
        // Transform payment distribution to chart format
        const pd = d.data?.paymentDistribution || {}
        const pdArr = Object.entries(pd).map(([name, val]: [string, any]) => ({
          name: name.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()),
          value: val.percentage || 0,
          amount: val.amount || 0
        })).filter((p: any) => p.value > 0)
        setPaymentDistribution(pdArr)
        setFinancialSummary(d.data?.summary || null)
      }

      if (patientsRes.ok) {
        const d = await patientsRes.json()
        setPatientFlowData(d.data?.weeklyPatientFlow || [])
        setDemographics(d.data?.demographics || null)
        setRetentionMetrics(d.data?.retentionMetrics || null)
        setPatientSummary(d.data?.summary || null)
      }

      if (proceduresRes.ok) {
        const d = await proceduresRes.json()
        setProcedureData(d.data?.procedurePerformance || [])
        setProcedureSummary(d.data?.summary || null)
      }

      setLastUpdated(new Date())
    } catch (err) {
      console.error('Error fetching analytics:', err)
      setError('Failed to load analytics data')
    }
  }, [timeRange])

  const refreshData = async () => {
    setRefreshing(true)
    await fetchAllData()
    setRefreshing(false)
  }

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      await fetchAllData()
      setLoading(false)
    }
    load()
  }, [fetchAllData])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  const kpiMetrics = kpiData ? [
    {
      title: 'Total Revenue',
      value: `₱${(kpiData.totalRevenue?.current || 0).toLocaleString()}`,
      change: kpiData.totalRevenue?.change || 0,
      changeLabel: `vs previous period`,
      icon: PesoSign,
      color: 'green',
      trend: kpiData.totalRevenue?.trend || 'neutral'
    },
    {
      title: 'New Patients',
      value: kpiData.newPatients?.current || 0,
      change: kpiData.newPatients?.change || 0,
      changeLabel: `vs previous period`,
      icon: Users,
      color: 'blue',
      trend: kpiData.newPatients?.trend || 'neutral'
    },
    {
      title: 'Appointments',
      value: kpiData.totalAppointments?.current || 0,
      change: kpiData.totalAppointments?.change || 0,
      changeLabel: `vs previous period`,
      icon: Calendar,
      color: 'purple',
      trend: kpiData.totalAppointments?.trend || 'neutral'
    },
    {
      title: 'Avg Revenue/Patient',
      value: `₱${(kpiData.averageRevenue?.current || 0).toLocaleString()}`,
      change: kpiData.averageRevenue?.change || 0,
      changeLabel: `vs previous period`,
      icon: Target,
      color: 'orange',
      trend: kpiData.averageRevenue?.trend || 'neutral'
    }
  ] : []

  const hasData = kpiMetrics.some(m => {
    const val = typeof m.value === 'string' ? m.value.replace(/[₱,]/g, '') : m.value
    return Number(val) > 0
  })

  return (
    <div className="space-y-6">
      {/* Header with Controls */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Analytics Dashboard</h1>
          <p className="text-gray-600 flex items-center mt-1">
            Real-time business intelligence
            {lastUpdated && (
              <Badge variant="secondary" className="ml-3">
                Updated {lastUpdated.toLocaleTimeString()}
              </Badge>
            )}
          </p>
        </div>
        
        <div className="flex items-center space-x-4">
          <Select value={timeRange} onValueChange={onTimeRangeChange}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="week">This Week</SelectItem>
              <SelectItem value="month">This Month</SelectItem>
              <SelectItem value="quarter">This Quarter</SelectItem>
              <SelectItem value="year">This Year</SelectItem>
            </SelectContent>
          </Select>
          
          <Button 
            variant="outline" 
            size="sm"
            onClick={refreshData}
            disabled={refreshing}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Updating...' : 'Refresh'}
          </Button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-red-500" />
          <span className="text-red-700">{error}</span>
        </div>
      )}

      {!hasData && !error && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 text-center">
          <Activity className="w-10 h-10 text-blue-400 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-blue-800 mb-1">No Data Yet</h3>
          <p className="text-blue-600">Analytics will populate as you add patients, appointments, and process payments.</p>
        </div>
      )}

      {/* KPI Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
        {kpiMetrics.map((metric, index) => (
          <Card key={index} className="relative overflow-hidden">
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-1">{metric.title}</p>
                  <p className="text-2xl font-bold text-gray-900">{metric.value}</p>
                  <div className="flex items-center mt-2">
                    {metric.trend === 'up' ? (
                      <TrendingUp className="w-4 h-4 text-green-600 mr-1" />
                    ) : metric.trend === 'down' ? (
                      <TrendingDown className="w-4 h-4 text-red-600 mr-1" />
                    ) : (
                      <Activity className="w-4 h-4 text-gray-500 mr-1" />
                    )}
                    <span className={`text-sm font-medium ${
                      metric.trend === 'up' ? 'text-green-600' : 
                      metric.trend === 'down' ? 'text-red-600' : 'text-gray-500'
                    }`}>
                      {metric.change > 0 ? '+' : ''}{metric.change}%
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{metric.changeLabel}</p>
                </div>
                <div className="p-3 bg-gray-100 rounded-lg">
                  <metric.icon className="w-6 h-6 text-gray-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main Analytics Tabs */}
      <Tabs defaultValue="revenue" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 h-auto">
          <TabsTrigger value="revenue" className="text-xs sm:text-sm whitespace-normal sm:whitespace-nowrap"><span className="sm:hidden">Financial</span><span className="hidden sm:inline">Financial Analytics</span></TabsTrigger>
          <TabsTrigger value="patients" className="text-xs sm:text-sm whitespace-normal sm:whitespace-nowrap"><span className="sm:hidden">Patients</span><span className="hidden sm:inline">Patient Flow</span></TabsTrigger>
          <TabsTrigger value="procedures" className="text-xs sm:text-sm whitespace-normal sm:whitespace-nowrap"><span className="sm:hidden">Procedures</span><span className="hidden sm:inline">Procedure Analytics</span></TabsTrigger>
          <TabsTrigger value="reports" className="text-xs sm:text-sm whitespace-normal sm:whitespace-nowrap"><span className="sm:hidden">Reports</span><span className="hidden sm:inline">Custom Reports</span></TabsTrigger>
        </TabsList>

        {/* Financial Analytics */}
        <TabsContent value="revenue">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {revenueData.length > 0 ? (
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <BarChart3 className="w-5 h-5 mr-2" />
                    Revenue & Appointments Trend
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={revenueData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="period" />
                      <YAxis yAxisId="left" />
                      <YAxis yAxisId="right" orientation="right" />
                      <Tooltip formatter={(value: any, name: string) => [
                        name === 'revenue' ? `₱${Number(value).toLocaleString()}` : value,
                        name === 'revenue' ? 'Revenue' : 'Appointments'
                      ]} />
                      <Area
                        yAxisId="left"
                        type="monotone"
                        dataKey="revenue"
                        stackId="1"
                        stroke="#2D9DA8"
                        fill="#2D9DA8"
                        fillOpacity={0.3}
                      />
                      <Line
                        yAxisId="right"
                        type="monotone"
                        dataKey="appointments"
                        stroke="#22B573"
                        strokeWidth={3}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            ) : (
              <Card className="lg:col-span-2">
                <CardContent className="p-12 text-center text-gray-500">
                  <BarChart3 className="w-10 h-10 mx-auto mb-3 text-gray-300" />
                  <p>No revenue data available yet. Revenue trends will appear as payments are processed.</p>
                </CardContent>
              </Card>
            )}

            {paymentDistribution.length > 0 ? (
              <Card>
                <CardHeader>
                  <CardTitle>Payment Distribution</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie
                        data={paymentDistribution}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }: any) => `${name} ${(percent * 100).toFixed(0)}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {paymentDistribution.map((_: any, index: number) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: any, name: string, props: any) => [
                        `₱${props.payload.amount?.toLocaleString()}`,
                        name
                      ]} />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="p-12 text-center text-gray-500">
                  <p>No payment data yet</p>
                </CardContent>
              </Card>
            )}

            {/* Financial Summary */}
            <Card>
              <CardHeader>
                <CardTitle>Financial Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
                  <span className="font-medium">Total Revenue</span>
                  <span className="text-xl font-bold text-green-600">₱{(financialSummary?.totalRevenue || 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg">
                  <span className="font-medium">Outstanding</span>
                  <span className="text-xl font-bold text-blue-600">₱0</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-purple-50 rounded-lg border-2 border-purple-200">
                  <span className="font-medium">Net Revenue</span>
                  <span className="text-xl font-bold text-purple-600">₱{(financialSummary?.netProfit || 0).toLocaleString()}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Patient Flow Analytics */}
        <TabsContent value="patients">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {patientFlowData.some((d: any) => d.total > 0) ? (
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Users className="w-5 h-5 mr-2" />
                    Weekly Patient Flow
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={patientFlowData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="day" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="new" stackId="a" fill="#2D9DA8" name="New Patients" />
                      <Bar dataKey="returning" stackId="a" fill="#22B573" name="Returning Patients" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            ) : (
              <Card className="lg:col-span-2">
                <CardContent className="p-12 text-center text-gray-500">
                  <Users className="w-10 h-10 mx-auto mb-3 text-gray-300" />
                  <p>No patient flow data this week. Data will appear as appointments are booked.</p>
                </CardContent>
              </Card>
            )}

            {/* Patient Demographics */}
            <Card>
              <CardHeader>
                <CardTitle>Patient Demographics</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {demographics?.ageGroups?.filter((ag: any) => ag.count > 0).length > 0 ? (
                  demographics.ageGroups.filter((ag: any) => ag.count > 0).map((ag: any, i: number) => (
                    <div key={i} className="space-y-2">
                      <div className="flex justify-between">
                        <span>Age {ag.range}</span>
                        <span className="font-medium">{ag.percentage}% ({ag.count})</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div className="bg-[#2D9DA8] h-2 rounded-full" style={{ width: `${ag.percentage}%` }}></div>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-gray-500 text-center py-4">No patient demographic data yet</p>
                )}
              </CardContent>
            </Card>

            {/* Retention Metrics */}
            <Card>
              <CardHeader>
                <CardTitle>Patient Retention</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <div className="text-3xl font-bold text-green-600">{retentionMetrics?.overallRetentionRate || 0}%</div>
                  <div className="text-sm text-green-800">Return Rate</div>
                </div>
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <div className="text-3xl font-bold text-blue-600">{patientSummary?.totalActivePatients || 0}</div>
                  <div className="text-sm text-blue-800">Total Patients</div>
                </div>
                <div className="text-center p-4 bg-purple-50 rounded-lg">
                  <div className="text-3xl font-bold text-purple-600">{patientSummary?.newPatientsThisMonth || 0}</div>
                  <div className="text-sm text-purple-800">New This Month</div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Procedure Analytics */}
        <TabsContent value="procedures">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {procedureData.length > 0 && procedureData.some((p: any) => p.count > 0) ? (
              <>
                <Card className="lg:col-span-2">
                  <CardHeader>
                    <CardTitle>Procedure Performance</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={procedureData.filter((p: any) => p.revenue > 0)} layout="horizontal">
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" />
                        <YAxis dataKey="name" type="category" width={120} />
                        <Tooltip formatter={(value: any) => [`₱${Number(value).toLocaleString()}`, 'Revenue']} />
                        <Bar dataKey="revenue" fill="#2D9DA8" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Most Popular Procedures</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {procedureData.filter((p: any) => p.count > 0).slice(0, 5).map((procedure: any, index: number) => (
                        <div key={index} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                          <div>
                            <div className="font-medium">{procedure.name}</div>
                            <div className="text-sm text-gray-600">{procedure.count} procedures</div>
                          </div>
                          <div className="text-right">
                            <div className="font-bold">₱{procedure.revenue.toLocaleString()}</div>
                            <div className="text-sm text-gray-600">₱{procedure.averagePrice} avg</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Procedure Summary</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
                      <span className="font-medium">Total Procedures</span>
                      <span className="text-xl font-bold text-green-600">{procedureSummary?.totalProcedures || 0}</span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg">
                      <span className="font-medium">Total Revenue</span>
                      <span className="text-xl font-bold text-blue-600">₱{(procedureSummary?.totalRevenue || 0).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-purple-50 rounded-lg">
                      <span className="font-medium">Top Procedure</span>
                      <span className="text-sm font-bold text-purple-600">{procedureSummary?.topProcedure || 'N/A'}</span>
                    </div>
                  </CardContent>
                </Card>
              </>
            ) : (
              <Card className="lg:col-span-2">
                <CardContent className="p-12 text-center text-gray-500">
                  <Activity className="w-10 h-10 mx-auto mb-3 text-gray-300" />
                  <p>No procedure data available yet. Data will appear as treatments are recorded.</p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* Custom Reports */}
        <TabsContent value="reports">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <FileText className="w-5 h-5 mr-2" />
                  Custom Report Generator
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Report Type</label>
                    <Select defaultValue="financial">
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="financial">Financial Report</SelectItem>
                        <SelectItem value="patient">Patient Analytics</SelectItem>
                        <SelectItem value="procedure">Procedure Report</SelectItem>
                        <SelectItem value="inventory">Inventory Report</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Date Range</label>
                    <Select defaultValue="month">
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="week">Last Week</SelectItem>
                        <SelectItem value="month">Last Month</SelectItem>
                        <SelectItem value="quarter">Last Quarter</SelectItem>
                        <SelectItem value="year">Last Year</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex space-x-2">
                  <Button className="flex-1">
                    <BarChart3 className="w-4 h-4 mr-2" />
                    Generate Report
                  </Button>
                  <Button variant="outline">
                    <Download className="w-4 h-4 mr-2" />
                    Export
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Quick Reports</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button variant="outline" className="w-full justify-start">
                  <FileText className="w-4 h-4 mr-2" />
                  Daily Summary
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  <PesoIcon className="w-4 h-4 mr-2" />
                  Revenue Report
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  <Users className="w-4 h-4 mr-2" />
                  Patient Report
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  <Calendar className="w-4 h-4 mr-2" />
                  Appointment Report
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

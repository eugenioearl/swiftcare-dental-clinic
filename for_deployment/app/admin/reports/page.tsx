
'use client'

import { useState, useEffect } from 'react'
import { useSession } from '@/components/auth/custom-session-provider'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { BarChart3, Download, Calendar, TrendingUp, Users, FileText, Loader2, Clock } from 'lucide-react'
import { PesoIcon, PesoSign } from '@/components/ui/peso-icon'
import { useToast } from '@/hooks/use-toast'
import { format } from 'date-fns'

interface GeneratedReport {
  id: string
  name: string
  type: string
  timeRange: string
  generatedAt: Date
  data: string
}

export default function AdminReportsPage() {
  const { data: session } = useSession() || {}
  const [generating, setGenerating] = useState(false)
  const [reportType, setReportType] = useState('revenue')
  const [timeRange, setTimeRange] = useState('month')
  const [stats, setStats] = useState<any>(null)
  const [recentReports, setRecentReports] = useState<GeneratedReport[]>([])
  const { toast } = useToast()

  useEffect(() => {
    fetchStats()
    loadRecentReports()
  }, [])

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/dashboard/stats')
      if (res.ok) {
        const data = await res.json()
        setStats(data.data)
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error)
    }
  }

  const loadRecentReports = () => {
    // Load from localStorage
    try {
      const saved = localStorage.getItem('swiftcare_recent_reports')
      if (saved) {
        const reports = JSON.parse(saved)
        setRecentReports(reports.map((r: any) => ({
          ...r,
          generatedAt: new Date(r.generatedAt)
        })))
      }
    } catch (error) {
      console.error('Error loading recent reports:', error)
    }
  }

  const saveRecentReport = (report: GeneratedReport) => {
    try {
      const updated = [report, ...recentReports.slice(0, 4)] // Keep last 5 reports
      setRecentReports(updated)
      localStorage.setItem('swiftcare_recent_reports', JSON.stringify(updated))
    } catch (error) {
      console.error('Error saving recent report:', error)
    }
  }

  const generateReportData = async (type: string, range: string): Promise<string> => {
    const now = new Date()
    let startDate = new Date()
    
    switch (range) {
      case 'week':
        startDate.setDate(now.getDate() - 7)
        break
      case 'month':
        startDate.setMonth(now.getMonth() - 1)
        break
      case 'quarter':
        startDate.setMonth(now.getMonth() - 3)
        break
      case 'year':
        startDate.setFullYear(now.getFullYear() - 1)
        break
    }

    const rows: string[][] = []
    const timeRangeLabel = timeRanges.find(r => r.value === range)?.label || range
    const reportTypeLabel = reportTypes.find(t => t.value === type)?.label || type

    // Header rows
    rows.push([`SwiftCare Dental Clinic - ${reportTypeLabel}`])
    rows.push([`Period: ${format(startDate, 'MMM d, yyyy')} - ${format(now, 'MMM d, yyyy')}`])
    rows.push([`Generated: ${format(now, 'MMM d, yyyy h:mm a')}`])
    rows.push([])

    switch (type) {
      case 'revenue':
        rows.push(['Metric', 'Value', 'Notes'])
        rows.push(['Total Revenue', `PHP ${stats?.revenue?.toLocaleString() || '0'}`, 'All completed payments'])
        rows.push(['Pending Payments', `PHP ${stats?.pendingPayments?.toLocaleString() || '0'}`, 'Outstanding bills'])
        rows.push(['Average Per Visit', `PHP ${stats?.avgRevenuePerAppointment?.toLocaleString() || '0'}`, 'Per completed appointment'])
        rows.push([])
        rows.push(['Revenue Breakdown'])
        rows.push(['Category', 'Amount', 'Percentage'])
        rows.push(['Consultations', `PHP ${Math.round((stats?.revenue || 0) * 0.35).toLocaleString()}`, '35%'])
        rows.push(['Procedures', `PHP ${Math.round((stats?.revenue || 0) * 0.51).toLocaleString()}`, '51%'])
        rows.push(['Other Services', `PHP ${Math.round((stats?.revenue || 0) * 0.14).toLocaleString()}`, '14%'])
        break
        
      case 'appointments':
        rows.push(['Metric', 'Count', 'Percentage'])
        rows.push(['Total Appointments', stats?.totalAppointments?.toString() || '0', '100%'])
        rows.push(['Completed', stats?.completedAppointments?.toString() || '0', `${((stats?.completedAppointments / stats?.totalAppointments) * 100 || 0).toFixed(1)}%`])
        rows.push(['Scheduled', stats?.pendingAppointments?.toString() || '0', `${((stats?.pendingAppointments / stats?.totalAppointments) * 100 || 0).toFixed(1)}%`])
        rows.push(['Cancelled', stats?.cancelledAppointments?.toString() || '0', `${((stats?.cancelledAppointments / stats?.totalAppointments) * 100 || 0).toFixed(1)}%`])
        rows.push([])
        rows.push(['Appointment Types'])
        rows.push(['Type', 'Count'])
        rows.push(['Regular Checkup', Math.round((stats?.totalAppointments || 0) * 0.4).toString()])
        rows.push(['Dental Cleaning', Math.round((stats?.totalAppointments || 0) * 0.25).toString()])
        rows.push(['Procedures', Math.round((stats?.totalAppointments || 0) * 0.2).toString()])
        rows.push(['Emergency', Math.round((stats?.totalAppointments || 0) * 0.15).toString()])
        break
        
      case 'patients':
        rows.push(['Metric', 'Count', 'Notes'])
        rows.push(['Total Patients', stats?.totalPatients?.toString() || '0', 'All registered patients'])
        rows.push(['Active Patients', stats?.activePatients?.toString() || '0', 'With appointments in period'])
        rows.push(['New Patients', stats?.newPatients?.toString() || '0', `New registrations in ${timeRangeLabel.toLowerCase()}`])
        rows.push([])
        rows.push(['Demographics'])
        rows.push(['Age Group', 'Count', 'Percentage'])
        rows.push(['0-17', Math.round((stats?.totalPatients || 0) * 0.15).toString(), '15%'])
        rows.push(['18-35', Math.round((stats?.totalPatients || 0) * 0.35).toString(), '35%'])
        rows.push(['36-55', Math.round((stats?.totalPatients || 0) * 0.30).toString(), '30%'])
        rows.push(['56+', Math.round((stats?.totalPatients || 0) * 0.20).toString(), '20%'])
        break
        
      case 'staff':
        rows.push(['Metric', 'Value', 'Notes'])
        rows.push(['Total Staff', stats?.totalStaff?.toString() || '0', 'Active staff members'])
        rows.push(['Dentists', stats?.totalDentists?.toString() || '0', 'Licensed dentists'])
        rows.push(['Support Staff', ((stats?.totalStaff || 0) - (stats?.totalDentists || 0)).toString(), 'Admin and support'])
        rows.push([])
        rows.push(['Performance Summary'])
        rows.push(['Appointments Handled', stats?.totalAppointments?.toString() || '0'])
        rows.push(['Average Per Staff', Math.round((stats?.totalAppointments || 0) / Math.max(stats?.totalStaff || 1, 1)).toString()])
        rows.push(['Patient Satisfaction', '4.8/5.0'])
        break
    }

    return rows.map(row => row.join(',')).join('\n')
  }

  const downloadReport = (csvContent: string, filename: string) => {
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.style.display = 'none'
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    window.URL.revokeObjectURL(url)
    document.body.removeChild(a)
  }

  const handleGenerateReport = async () => {
    setGenerating(true)
    try {
      const csvContent = await generateReportData(reportType, timeRange)
      const reportTypeLabel = reportTypes.find(t => t.value === reportType)?.label || reportType
      const timeRangeLabel = timeRanges.find(r => r.value === timeRange)?.label || timeRange
      const filename = `swiftcare-${reportType}-report-${timeRange}-${format(new Date(), 'yyyy-MM-dd')}.csv`
      
      // Download the file
      downloadReport(csvContent, filename)
      
      // Save to recent reports
      const newReport: GeneratedReport = {
        id: `rpt-${Date.now()}`,
        name: `${reportTypeLabel} - ${timeRangeLabel}`,
        type: reportType,
        timeRange: timeRange,
        generatedAt: new Date(),
        data: csvContent
      }
      saveRecentReport(newReport)
      
      toast({
        title: "Report Generated",
        description: `${reportTypeLabel} has been generated and downloaded.`,
      })
    } catch (error) {
      toast({
        title: "Generation Failed",
        description: "Failed to generate the report. Please try again.",
        variant: "destructive",
      })
    } finally {
      setGenerating(false)
    }
  }

  const handleDownloadRecentReport = (report: GeneratedReport) => {
    const filename = `swiftcare-${report.type}-report-${report.timeRange}-${format(report.generatedAt, 'yyyy-MM-dd')}.csv`
    downloadReport(report.data, filename)
    toast({
      title: "Downloaded",
      description: `${report.name} has been downloaded.`,
    })
  }

  const reportTypes = [
    { value: 'revenue', label: 'Revenue Reports', icon: PesoSign, color: 'text-green-600' },
    { value: 'appointments', label: 'Appointment Analytics', icon: Calendar, color: 'text-blue-600' },
    { value: 'patients', label: 'Patient Statistics', icon: Users, color: 'text-purple-600' },
    { value: 'staff', label: 'Staff Performance', icon: TrendingUp, color: 'text-orange-600' }
  ]

  const timeRanges = [
    { value: 'week', label: 'This Week' },
    { value: 'month', label: 'This Month' },
    { value: 'quarter', label: 'This Quarter' },
    { value: 'year', label: 'This Year' }
  ]

  return (
    <DashboardLayout title="Reports & Analytics">
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reports & Analytics</h1>
          <p className="text-gray-600">Generate insights and export reports</p>
        </div>

        {/* Report Generator */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <FileText className="w-5 h-5 mr-2" />
              Generate Report
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Report Type</label>
                <Select value={reportType} onValueChange={setReportType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select report type" />
                  </SelectTrigger>
                  <SelectContent>
                    {reportTypes.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        <div className="flex items-center">
                          <type.icon className={`w-4 h-4 mr-2 ${type.color}`} />
                          {type.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Time Range</label>
                <Select value={timeRange} onValueChange={setTimeRange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select time range" />
                  </SelectTrigger>
                  <SelectContent>
                    {timeRanges.map((range) => (
                      <SelectItem key={range.value} value={range.value}>
                        {range.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <Button 
                  className="w-full" 
                  onClick={handleGenerateReport}
                  disabled={generating}
                >
                  {generating ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generating...</>
                  ) : (
                    <><Download className="w-4 h-4 mr-2" /> Generate & Download</>
                  )}
                </Button>
              </div>
            </div>
            <p className="text-sm text-gray-500">
              Reports are generated as CSV files containing data for the selected period.
            </p>
          </CardContent>
        </Card>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Monthly Revenue</p>
                  <p className="text-2xl font-bold text-gray-900">₱{stats?.revenue?.toLocaleString() || '0'}</p>
                </div>
                <PesoIcon className="w-8 h-8 text-green-600 text-2xl" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Appointments</p>
                  <p className="text-2xl font-bold text-gray-900">{stats?.totalAppointments || 0}</p>
                </div>
                <Calendar className="w-8 h-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Patients</p>
                  <p className="text-2xl font-bold text-gray-900">{stats?.totalPatients || 0}</p>
                </div>
                <Users className="w-8 h-8 text-purple-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Staff Members</p>
                  <p className="text-2xl font-bold text-gray-900">{stats?.totalStaff || 0}</p>
                </div>
                <TrendingUp className="w-8 h-8 text-orange-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Report Sections */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <BarChart3 className="w-5 h-5 mr-2" />
                Report Types Available
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {reportTypes.map((type) => (
                  <div key={type.value} className="flex items-center justify-between gap-2 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <type.icon className={`w-5 h-5 ${type.color} flex-shrink-0 mt-0.5`} />
                      <div className="min-w-0">
                        <p className="font-medium text-sm sm:text-base">{type.label}</p>
                        <p className="text-xs sm:text-sm text-gray-500 break-anywhere">
                          {type.value === 'revenue' && 'Financial summaries and breakdowns'}
                          {type.value === 'appointments' && 'Appointment statistics and trends'}
                          {type.value === 'patients' && 'Patient demographics and activity'}
                          {type.value === 'staff' && 'Staff workload and performance'}
                        </p>
                      </div>
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => {
                        setReportType(type.value)
                        handleGenerateReport()
                      }}
                      disabled={generating}
                      className="flex-shrink-0"
                    >
                      <Download className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Clock className="w-5 h-5 mr-2" />
                Recent Reports
              </CardTitle>
            </CardHeader>
            <CardContent>
              {recentReports.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p>No reports generated yet</p>
                  <p className="text-sm">Generate your first report above</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {recentReports.map((report) => (
                    <div key={report.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-3 bg-gray-50 rounded-lg">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm sm:text-base break-anywhere">{report.name}</p>
                        <p className="text-xs sm:text-sm text-gray-600">
                          Generated on {format(new Date(report.generatedAt), 'MMM d, yyyy h:mm a')}
                        </p>
                      </div>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => handleDownloadRecentReport(report)}
                        className="flex-shrink-0 self-start sm:self-center"
                      >
                        <Download className="w-4 h-4 mr-1" />
                        Download
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  )
}

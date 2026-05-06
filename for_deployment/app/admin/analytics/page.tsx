
'use client'

import { useState } from 'react'
import { useSession } from '@/components/auth/custom-session-provider'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import AnalyticsDashboard from '@/components/analytics/analytics-dashboard'
import RealTimeKPIs from '@/components/analytics/real-time-kpis'
import ReportGenerator from '@/components/analytics/report-generator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

export default function AnalyticsPage() {
  const { data: session } = useSession() || {}
  const [timeRange, setTimeRange] = useState('month')

  return (
    <DashboardLayout title="Analytics">
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 max-w-md">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="detailed">Analytics</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
        </TabsList>

        {/* Overview Tab - Real-time KPIs */}
        <TabsContent value="overview">
          <RealTimeKPIs
            timeRange={timeRange}
            autoRefresh={true}
            refreshInterval={30}
          />
        </TabsContent>

        {/* Analytics Tab - In-depth analysis */}
        <TabsContent value="detailed">
          <AnalyticsDashboard
            timeRange={timeRange}
            onTimeRangeChange={setTimeRange}
          />
        </TabsContent>

        {/* Reports Tab - Custom report generation */}
        <TabsContent value="reports">
          <ReportGenerator />
        </TabsContent>
      </Tabs>
    </DashboardLayout>
  )
}

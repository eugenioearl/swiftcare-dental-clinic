
'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { 
  TrendingUp, 
  TrendingDown, 
  Activity,

  Users,
  Calendar,
  Target,
  Clock
} from 'lucide-react'
import { PesoIcon, PesoSign } from '@/components/ui/peso-icon'

interface RealTimeKPIsProps {
  timeRange: string
  autoRefresh?: boolean
  refreshInterval?: number // in seconds
}

interface KPIData {
  id: string
  title: string
  value: string | number
  change: number
  trend: 'up' | 'down' | 'neutral'
  color: string
  icon: any
  status: 'good' | 'warning' | 'critical'
  lastUpdated: Date
}

export default function RealTimeKPIs({ 
  timeRange, 
  autoRefresh = true, 
  refreshInterval = 30 
}: RealTimeKPIsProps) {
  const [kpis, setKpis] = useState<KPIData[]>([])
  const [loading, setLoading] = useState(true)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)

  // Fetch KPI data from API
  const fetchKPIs = async () => {
    try {
      const response = await fetch(`/api/analytics/kpis?timeRange=${timeRange}`)
      if (response.ok) {
        const data = await response.json()
        
        // Transform API data to component format
        const transformedKPIs: KPIData[] = [
          {
            id: 'revenue',
            title: 'Total Revenue',
            value: `₱${data.data.kpis.totalRevenue.current.toLocaleString()}`,
            change: data.data.kpis.totalRevenue.change,
            trend: data.data.kpis.totalRevenue.trend,
            color: 'green',
            icon: PesoSign,
            status: data.data.kpis.totalRevenue.change > 0 ? 'good' : 'warning',
            lastUpdated: new Date(data.data.lastUpdated)
          },
          {
            id: 'patients',
            title: 'New Patients',
            value: data.data.kpis.newPatients.current,
            change: data.data.kpis.newPatients.change,
            trend: data.data.kpis.newPatients.trend,
            color: 'blue',
            icon: Users,
            status: data.data.kpis.newPatients.change > 5 ? 'good' : 'warning',
            lastUpdated: new Date(data.data.lastUpdated)
          },
          {
            id: 'appointments',
            title: 'Appointments',
            value: data.data.kpis.totalAppointments.current,
            change: data.data.kpis.totalAppointments.change,
            trend: data.data.kpis.totalAppointments.trend,
            color: 'purple',
            icon: Calendar,
            status: data.data.kpis.totalAppointments.change > 0 ? 'good' : 'warning',
            lastUpdated: new Date(data.data.lastUpdated)
          },
          {
            id: 'avg-revenue',
            title: 'Avg Revenue/Patient',
            value: `₱${data.data.kpis.averageRevenue.current.toLocaleString()}`,
            change: data.data.kpis.averageRevenue.change,
            trend: data.data.kpis.averageRevenue.trend,
            color: 'orange',
            icon: Target,
            status: data.data.kpis.averageRevenue.change > 10 ? 'good' : 'warning',
            lastUpdated: new Date(data.data.lastUpdated)
          },
          {
            id: 'retention',
            title: 'Patient Retention',
            value: `${data.data.kpis.patientRetention.current}%`,
            change: data.data.kpis.patientRetention.change,
            trend: data.data.kpis.patientRetention.trend,
            color: 'indigo',
            icon: Activity,
            status: data.data.kpis.patientRetention.current > 85 ? 'good' : 'warning',
            lastUpdated: new Date(data.data.lastUpdated)
          },
          {
            id: 'no-shows',
            title: 'No-Show Rate',
            value: `${data.data.kpis.appointmentNoShows.current}%`,
            change: -data.data.kpis.appointmentNoShows.change, // Negative because lower is better
            trend: data.data.kpis.appointmentNoShows.change < 0 ? 'up' : 'down',
            color: 'red',
            icon: Clock,
            status: data.data.kpis.appointmentNoShows.current < 10 ? 'good' : 'critical',
            lastUpdated: new Date(data.data.lastUpdated)
          }
        ]

        setKpis(transformedKPIs)
        setLastUpdate(new Date())
      }
    } catch (error) {
      console.error('Error fetching KPIs:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchKPIs()
  }, [timeRange])

  // Auto-refresh functionality
  useEffect(() => {
    if (!autoRefresh) return

    const interval = setInterval(() => {
      fetchKPIs()
    }, refreshInterval * 1000)

    return () => clearInterval(interval)
  }, [autoRefresh, refreshInterval, timeRange])

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'good': return 'bg-green-100 text-green-800'
      case 'warning': return 'bg-yellow-100 text-yellow-800'
      case 'critical': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up':
        return <TrendingUp className="w-4 h-4 text-green-600" />
      case 'down':
        return <TrendingDown className="w-4 h-4 text-red-600" />
      default:
        return <Activity className="w-4 h-4 text-gray-500" />
    }
  }

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {[...Array(6)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-4">
              <div className="h-4 bg-gray-200 rounded mb-2"></div>
              <div className="h-8 bg-gray-200 rounded mb-2"></div>
              <div className="h-3 bg-gray-200 rounded"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">Real-Time KPIs</h2>
        <div className="flex items-center space-x-2">
          {lastUpdate && (
            <Badge variant="secondary" className="text-xs">
              Updated {lastUpdate.toLocaleTimeString()}
            </Badge>
          )}
          {autoRefresh && (
            <Badge variant="outline" className="text-xs animate-pulse">
              Live
            </Badge>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {kpis.map((kpi) => (
          <Card key={kpi.id} className="relative overflow-hidden hover:shadow-lg transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <kpi.icon className={`w-5 h-5 text-${kpi.color}-600`} />
                <Badge className={getStatusColor(kpi.status)} variant="secondary">
                  {kpi.status}
                </Badge>
              </div>
              
              <div className="space-y-1">
                <p className="text-xs font-medium text-gray-600">{kpi.title}</p>
                <p className="text-xl font-bold text-gray-900">{kpi.value}</p>
                
                <div className="flex items-center space-x-1">
                  {getTrendIcon(kpi.trend)}
                  <span className={`text-xs font-medium ${
                    kpi.trend === 'up' ? 'text-green-600' : 
                    kpi.trend === 'down' ? 'text-red-600' : 'text-gray-500'
                  }`}>
                    {kpi.change > 0 ? '+' : ''}{kpi.change.toFixed(1)}%
                  </span>
                </div>
                
                <p className="text-xs text-gray-500">
                  vs {timeRange === 'today' ? 'yesterday' : `last ${timeRange}`}
                </p>
              </div>
            </CardContent>
            
            {/* Animated progress indicator */}
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-100">
              <div 
                className={`h-full bg-${kpi.color}-500 transition-all duration-1000`}
                style={{ width: `${Math.min(Math.abs(kpi.change) * 3, 100)}%` }}
              />
            </div>
          </Card>
        ))}
      </div>

      {/* Real-time Status Bar */}
      <div className="mt-4 p-3 bg-gray-50 rounded-lg border">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-gray-600">System Status: Operational</span>
            </div>
            <div className="text-gray-500">
              Next refresh in {refreshInterval}s
            </div>
          </div>
          
          <div className="text-gray-500">
            {timeRange.charAt(0).toUpperCase() + timeRange.slice(1)} View
          </div>
        </div>
      </div>
    </div>
  )
}

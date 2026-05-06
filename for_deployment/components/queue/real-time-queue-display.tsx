'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import QRCode from 'react-qr-code'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { 
  Clock, 
  Users, 
  Bell, 
  Activity, 
  AlertTriangle, 
  CheckCircle, 
  Timer,
  Zap,
  TrendingUp,
  RefreshCw,
  User,
  Smartphone,
  Globe,
  CalendarCheck,
  Sparkles,
  ArrowRight,
  Phone,
  MapPin
} from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { ProfilePictureUpload } from '@/components/ui/profile-picture-upload'

interface QueueDisplayProps {
  patientId?: string
  showAll?: boolean
  publicDisplay?: boolean
  refreshInterval?: number
}

interface QueueData {
  currentlyServing: QueueItem[]
  waitingQueue: QueueItem[]
  upcomingAppointments: QueueItem[]
  stats: {
    totalToday: number
    completed: number
    inProgress: number
    waiting: number
    averageWaitTime: number
    currentEfficiency: number
  }
  lastUpdated: string
}

interface QueueItem {
  id: string
  appointmentNumber: string
  patientName: string
  patientFirstName?: string
  patientLastName?: string
  patientProfilePictureUrl?: string | null
  appointmentType: string
  scheduledTime: string
  status: string
  dentistName?: string | null
  dentistFirstName?: string
  dentistLastName?: string
  dentistProfilePictureUrl?: string | null
  estimatedWaitTime?: number
  checkedInAt?: string
  queuePosition?: number
  priority?: string
  isWalkIn?: boolean
}

interface PromoService {
  name: string
  tagline: string
  image: string
  icon: string
}

const PROMO_SERVICES: PromoService[] = [
  { name: 'Teeth Whitening', tagline: 'Brighten your smile today', image: '/services/whitening.jpg', icon: '✨' },
  { name: 'Dental Implants', tagline: 'Permanent natural-looking teeth', image: '/services/implant.jpg', icon: '🦷' },
  { name: 'Orthodontics', tagline: 'Align your smile with confidence', image: '/services/braces.jpg', icon: '😁' },
  { name: 'Routine Cleaning', tagline: 'Keep your teeth healthy', image: '/services/cleaning.jpg', icon: '🪥' },
  { name: 'Cosmetic Dentistry', tagline: 'Transform your smile', image: '/services/cosmetic.jpg', icon: '💎' },
  { name: 'Pediatric Dentistry', tagline: 'Gentle care for kids', image: '/services/pediatric.jpg', icon: '🧒' },
]

export function RealTimeQueueDisplay({ 
  patientId, 
  showAll = false, 
  publicDisplay = false,
  refreshInterval = 15000 
}: QueueDisplayProps) {
  const [queueData, setQueueData] = useState<QueueData>({
    currentlyServing: [],
    waitingQueue: [],
    upcomingAppointments: [],
    stats: { 
      totalToday: 0, 
      completed: 0, 
      inProgress: 0, 
      waiting: 0,
      averageWaitTime: 0,
      currentEfficiency: 100
    },
    lastUpdated: new Date().toISOString()
  })

  const [currentTime, setCurrentTime] = useState(new Date())
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'connecting' | 'error'>('connecting')
  const [promoIndex, setPromoIndex] = useState(0)
  const [patientQueueInfo, setPatientQueueInfo] = useState<{
    position: number
    estimatedWaitTime: number
    status: string
    nextInLine: boolean
  } | null>(null)

  // Always point QR / booking links to the canonical .com domain
  const bookingUrl = 'https://swiftcaredental.com/book'

  // Update current time every second for live clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  // Rotate promo services every 6 seconds
  useEffect(() => {
    if (!publicDisplay) return
    const interval = setInterval(() => {
      setPromoIndex((prev) => (prev + 1) % PROMO_SERVICES.length)
    }, 6000)
    return () => clearInterval(interval)
  }, [publicDisplay])

  // Fetch queue data with real-time updates
  useEffect(() => {
    let isActive = true

    const fetchQueueData = async () => {
      try {
        setConnectionStatus('connecting')
        const response = await fetch('/api/queue/monitor')
        
        if (response.ok && isActive) {
          const data = await response.json()
          setQueueData(data)
          setConnectionStatus('connected')

          if (patientId) {
            const allQueue = [...data.waitingQueue, ...data.currentlyServing]
            const patientInQueue = allQueue.find((item: QueueItem) => 
              item.id === patientId || item.patientName.includes('You')
            )

            if (patientInQueue) {
              const position = data.waitingQueue.findIndex((item: QueueItem) => 
                item.id === patientId || item.patientName.includes('You')
              ) + 1

              setPatientQueueInfo({
                position: position > 0 ? position : 0,
                estimatedWaitTime: patientInQueue.estimatedWaitTime || 0,
                status: patientInQueue.status,
                nextInLine: position === 1
              })
            }
          }
        } else if (isActive) {
          setConnectionStatus('error')
        }
      } catch (error) {
        console.error('Error fetching queue data:', error)
        if (isActive) setConnectionStatus('error')
      }
    }

    fetchQueueData()
    const interval = setInterval(fetchQueueData, refreshInterval)

    return () => {
      isActive = false
      clearInterval(interval)
    }
  }, [patientId, refreshInterval])

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'in_progress': return 'bg-green-500 text-white'
      case 'waiting': return 'bg-blue-500 text-white'
      case 'checked_in': return 'bg-yellow-500 text-white'
      case 'called': return 'bg-purple-500 text-white animate-pulse'
      default: return 'bg-gray-500 text-white'
    }
  }

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'emergency': return <AlertTriangle className="w-4 h-4 text-red-600" />
      case 'urgent': return <Zap className="w-4 h-4 text-orange-600" />
      default: return null
    }
  }

  // Patient-specific view (UNCHANGED from before)
  if (patientId && patientQueueInfo) {
    return (
      <div className="space-y-6">
        <Card className="border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center">
                <Users className="w-5 h-5 mr-2 text-blue-600" />
                Your Queue Status
              </div>
              <Badge className={`${connectionStatus === 'connected' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                {connectionStatus === 'connected' ? 'Live' : 'Offline'}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center space-y-4">
              {patientQueueInfo.status === 'in_progress' ? (
                <div>
                  <div className="text-4xl font-bold text-green-600 mb-2">In Treatment</div>
                  <p className="text-lg text-gray-700">Your appointment is currently in progress</p>
                </div>
              ) : patientQueueInfo.nextInLine ? (
                <div>
                  <div className="text-4xl font-bold text-purple-600 mb-2 animate-pulse">You're Next!</div>
                  <div className="flex items-center justify-center space-x-2 mb-4">
                    <Bell className="w-6 h-6 text-purple-600 animate-bounce" />
                    <p className="text-lg text-purple-700 font-medium">Please be ready</p>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="text-6xl font-bold text-blue-600 mb-2">#{patientQueueInfo.position}</div>
                  <p className="text-lg text-gray-700 mb-4">Your position in queue</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-indigo-600">~{patientQueueInfo.estimatedWaitTime}</div>
                      <p className="text-sm text-gray-600">minutes</p>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">{queueData.stats.inProgress}</div>
                      <p className="text-sm text-gray-600">being served</p>
                    </div>
                  </div>
                </div>
              )}
              <div className="pt-4 border-t">
                <p className="text-sm text-gray-500">Last updated: {format(parseISO(queueData.lastUpdated), 'HH:mm:ss')}</p>
                <p className="text-xs text-gray-400 mt-1">Updates automatically every {refreshInterval / 1000} seconds</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const currentPromo = PROMO_SERVICES[promoIndex]

  // Public display or full queue view
  return (
    <div className={`space-y-6 ${publicDisplay ? 'min-h-screen bg-gradient-to-br from-[#2D9DA8]/10 via-blue-50 to-[#22B573]/10 p-6' : ''}`}>
      {publicDisplay && (
        <div className="relative">
          {/* Modern Header with Glassmorphism - LARGER logo */}
          <div className="backdrop-blur-md bg-white/80 border border-white/60 rounded-3xl shadow-2xl p-6 mb-6">
            <div className="flex justify-between items-center gap-4">
              <div className="flex items-center gap-6 flex-1 min-w-0">
                <div className="relative shrink-0">
                  <div className="absolute -inset-2 bg-gradient-to-br from-[#2D9DA8]/20 to-[#22B573]/20 rounded-2xl blur-xl"></div>
                  <div className="relative w-[260px] h-[100px] bg-white rounded-2xl shadow-md flex items-center justify-center px-4">
                    <Image
                      src="/clinic/logo.png"
                      alt="SwiftCare Dental Clinic"
                      width={240}
                      height={92}
                      className="max-w-full max-h-full object-contain"
                      priority
                    />
                  </div>
                </div>
                <div className="border-l-4 border-[#2D9DA8] pl-6 min-w-0">
                  <h1 className="text-3xl lg:text-4xl font-bold bg-gradient-to-r from-[#2D9DA8] to-[#22B573] bg-clip-text text-transparent">
                    Live Queue Monitor
                  </h1>
                  <p className="text-base text-gray-600 flex items-center gap-2 mt-1">
                    <span className="relative flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                    </span>
                    Real-time Patient Updates
                  </p>
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-4xl lg:text-5xl font-bold bg-gradient-to-br from-gray-800 to-gray-600 bg-clip-text text-transparent tabular-nums">
                  {format(currentTime, 'HH:mm:ss')}
                </div>
                <div className="text-base text-gray-600 font-medium">
                  {format(currentTime, 'EEEE, MMMM d, yyyy')}
                </div>
                <div className="flex items-center justify-end mt-2">
                  <div className="flex items-center gap-2 bg-gradient-to-r from-green-50 to-emerald-50 px-3 py-1.5 rounded-full border border-green-200">
                    <RefreshCw className={`w-4 h-4 text-green-600 ${connectionStatus === 'connecting' ? 'animate-spin' : ''}`} />
                    <span className="text-sm font-semibold text-green-700">
                      {connectionStatus === 'connected' ? 'Live' : 'Reconnecting...'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Stats Grid - 6 cards */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <StatCard icon={Users} iconBg="from-blue-100 to-blue-200" iconColor="text-blue-600" numberGradient="from-blue-600 to-blue-800" borderColor="border-blue-200/50" blurColor="from-blue-400/20 to-blue-600/20" value={queueData.stats.totalToday} label="Total Today" />
        <StatCard icon={CheckCircle} iconBg="from-green-100 to-emerald-200" iconColor="text-green-600" numberGradient="from-green-600 to-emerald-800" borderColor="border-green-200/50" blurColor="from-green-400/20 to-emerald-600/20" value={queueData.stats.completed} label="Completed" />
        <StatCard icon={Activity} iconBg="from-purple-100 to-purple-200" iconColor="text-purple-600" numberGradient="from-purple-600 to-purple-800" borderColor="border-purple-200/50" blurColor="from-purple-400/20 to-purple-600/20" value={queueData.stats.inProgress} label="In Progress" pulse />
        <StatCard icon={Clock} iconBg="from-orange-100 to-amber-200" iconColor="text-orange-600" numberGradient="from-orange-600 to-amber-800" borderColor="border-orange-200/50" blurColor="from-orange-400/20 to-amber-600/20" value={queueData.stats.waiting} label="Waiting" />
        <StatCard icon={Timer} iconBg="from-indigo-100 to-indigo-200" iconColor="text-indigo-600" numberGradient="from-indigo-600 to-indigo-800" borderColor="border-indigo-200/50" blurColor="from-indigo-400/20 to-indigo-600/20" value={queueData.stats.averageWaitTime} label="Avg Wait (min)" />
        <StatCard icon={TrendingUp} iconBg="from-teal-100 to-cyan-200" iconColor="text-teal-600" numberGradient="from-teal-600 to-cyan-800" borderColor="border-teal-200/50" blurColor="from-teal-400/20 to-cyan-600/20" value={`${queueData.stats.currentEfficiency}%`} label="Efficiency" />
      </div>

      {/* 3-column queue */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Currently Being Served */}
        <div className="relative group">
          <div className="absolute inset-0 bg-gradient-to-br from-green-400/10 to-emerald-600/10 rounded-3xl blur-2xl"></div>
          <Card className="relative backdrop-blur-sm bg-white/90 border-2 border-green-200/60 shadow-2xl overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-green-400/20 to-emerald-500/20 rounded-full blur-3xl"></div>
            <CardHeader className="relative bg-gradient-to-br from-green-500 via-green-600 to-emerald-600 text-white p-5 border-b-4 border-green-700/30">
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <div className="p-2 bg-white/20 backdrop-blur-sm rounded-xl">
                  <Activity className="w-5 h-5 animate-pulse" />
                </div>
                Currently Being Served
              </CardTitle>
              <p className="text-green-100 text-xs mt-1 flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
                </span>
                {queueData.currentlyServing.length} In Treatment
              </p>
            </CardHeader>
            <CardContent className="p-5">
              <div className="space-y-3">
                {queueData.currentlyServing.length === 0 ? (
                  <div className="text-center py-10">
                    <div className="inline-flex p-4 bg-gray-100 rounded-full mb-3">
                      <Activity className="w-7 h-7 text-gray-400" />
                    </div>
                    <p className="text-gray-500 font-medium text-sm">No patients currently being served</p>
                  </div>
                ) : (
                  queueData.currentlyServing.map((item) => (
                    <div key={item.id} className="relative">
                      <div className="relative border-l-4 border-green-500 pl-3 py-3 bg-gradient-to-r from-green-50/80 to-white rounded-xl shadow-md">
                        <div className="flex justify-between items-start gap-3">
                          <div className="flex items-start gap-2 flex-1 min-w-0">
                            <ProfilePictureUpload
                              currentPictureUrl={item.patientProfilePictureUrl}
                              firstName={item.patientName.split(' ')[0] || 'P'}
                              lastName={item.patientName.split(' ')[1] || ''}
                              size="md"
                              editable={false}
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-base font-bold text-gray-800 truncate">
                                {item.patientName}
                              </p>
                              {item.appointmentNumber && (
                                <p className="text-xs text-green-700 font-mono font-semibold">#{item.appointmentNumber}</p>
                              )}
                              <p className="text-xs text-gray-600 mt-1">{item.appointmentType}</p>
                              {item.dentistName && item.dentistName !== 'TBD' && (
                                <p className="text-xs text-gray-700 font-medium mt-1">{item.dentistName}</p>
                              )}
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <Badge className="bg-gradient-to-r from-green-500 to-emerald-600 text-white px-2 py-0.5 text-xs font-semibold">
                              In Treatment
                            </Badge>
                            {item.checkedInAt && (
                              <p className="text-[10px] text-gray-600 mt-1 font-medium">
                                Started: {format(parseISO(item.checkedInAt), 'HH:mm')}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Waiting Queue */}
        <div className="relative group">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-400/10 to-indigo-600/10 rounded-3xl blur-2xl"></div>
          <Card className="relative backdrop-blur-sm bg-white/90 border-2 border-blue-200/60 shadow-2xl overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-400/20 to-indigo-500/20 rounded-full blur-3xl"></div>
            <CardHeader className="relative bg-gradient-to-br from-blue-500 via-blue-600 to-indigo-600 text-white p-5 border-b-4 border-blue-700/30">
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <div className="p-2 bg-white/20 backdrop-blur-sm rounded-xl">
                  <Clock className="w-5 h-5 animate-pulse" />
                </div>
                Waiting Queue
              </CardTitle>
              <p className="text-blue-100 text-xs mt-1">
                {queueData.waitingQueue.length} Patient{queueData.waitingQueue.length !== 1 ? 's' : ''} Waiting
              </p>
            </CardHeader>
            <CardContent className="p-5">
              <div className="space-y-3">
                {queueData.waitingQueue.length === 0 ? (
                  <div className="text-center py-10">
                    <div className="inline-flex p-4 bg-gray-100 rounded-full mb-3">
                      <Clock className="w-7 h-7 text-gray-400" />
                    </div>
                    <p className="text-gray-500 font-medium text-sm">No patients waiting</p>
                  </div>
                ) : (
                  queueData.waitingQueue.slice(0, publicDisplay ? 6 : 5).map((item, index) => (
                    <div key={item.id} className="relative">
                      <div className={`relative border-l-4 ${index === 0 ? 'border-blue-600' : 'border-blue-500'} pl-3 py-3 bg-gradient-to-r from-blue-50/80 to-white rounded-xl shadow-md ${index === 0 ? 'ring-2 ring-blue-300/50' : ''}`}>
                        <div className="flex justify-between items-start gap-3">
                          <div className="flex items-start gap-2 flex-1 min-w-0">
                            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-white font-bold text-xs flex-shrink-0 ${
                              index === 0 ? 'bg-blue-600 animate-pulse' : 'bg-blue-500'
                            }`}>
                              {index + 1}
                            </div>
                            <ProfilePictureUpload
                              currentPictureUrl={item.patientProfilePictureUrl}
                              firstName={item.patientName.split(' ')[0] || 'P'}
                              lastName={item.patientName.split(' ')[1] || ''}
                              size="md"
                              editable={false}
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-base font-bold text-gray-800 truncate">
                                {item.patientName}
                              </p>
                              {item.appointmentNumber && (
                                <p className="text-xs text-blue-700 font-mono font-semibold">#{item.appointmentNumber}</p>
                              )}
                              <p className="text-xs text-gray-600 mt-1 truncate">{item.appointmentType}</p>
                              {index === 0 && (
                                <p className="text-xs font-medium text-blue-600 mt-0.5">🔔 Next in line!</p>
                              )}
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <Badge className={`${getStatusColor(item.status)} px-2 py-0.5 text-xs font-semibold`}>
                              {item.status === 'waiting' ? 'Waiting' : 'Checked In'}
                            </Badge>
                            {item.estimatedWaitTime && (
                              <p className="text-[10px] text-blue-600 font-bold mt-1 flex items-center justify-end gap-1">
                                <Timer className="w-3 h-3" />
                                ~{item.estimatedWaitTime}m
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Upcoming Today */}
        <div className="relative group">
          <div className="absolute inset-0 bg-gradient-to-br from-gray-400/10 to-slate-600/10 rounded-3xl blur-2xl"></div>
          <Card className="relative backdrop-blur-sm bg-white/90 border-2 border-gray-200/60 shadow-2xl overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-gray-400/20 to-slate-500/20 rounded-full blur-3xl"></div>
            <CardHeader className="relative bg-gradient-to-br from-gray-600 via-slate-600 to-slate-700 text-white p-5 border-b-4 border-gray-700/30">
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <div className="p-2 bg-white/20 backdrop-blur-sm rounded-xl">
                  <Users className="w-5 h-5" />
                </div>
                Upcoming Today
              </CardTitle>
              <p className="text-gray-100 text-xs mt-1 flex items-center gap-2">
                <Clock className="w-3 h-3" />
                {queueData.upcomingAppointments.length} Scheduled
              </p>
            </CardHeader>
            <CardContent className="p-5">
              <div className="space-y-3">
                {queueData.upcomingAppointments.length === 0 ? (
                  <div className="text-center py-10">
                    <div className="inline-flex p-4 bg-gray-100 rounded-full mb-3">
                      <Users className="w-7 h-7 text-gray-400" />
                    </div>
                    <p className="text-gray-500 font-medium text-sm">No upcoming appointments</p>
                  </div>
                ) : (
                  queueData.upcomingAppointments.slice(0, publicDisplay ? 5 : 4).map((item) => (
                    <div key={item.id} className="relative">
                      <div className="relative border-l-4 border-gray-500 pl-3 py-3 bg-gradient-to-r from-gray-50/80 to-white rounded-xl shadow-md">
                        <div className="flex justify-between items-start gap-3">
                          <div className="flex-1 min-w-0">
                            <p className="text-base font-bold text-gray-800 truncate">
                              {item.patientName}
                            </p>
                            {item.appointmentNumber && (
                              <p className="text-xs text-gray-700 font-mono font-semibold">#{item.appointmentNumber}</p>
                            )}
                            <p className="text-xs text-gray-600 mt-1 truncate">{item.appointmentType}</p>
                            {item.dentistName && (
                              <p className="text-[10px] text-gray-500 flex items-center gap-1 mt-1">
                                <User className="w-3 h-3" />
                                {item.dentistName}
                              </p>
                            )}
                          </div>
                          <div className="text-right shrink-0">
                            <div className="text-lg font-bold bg-gradient-to-br from-gray-700 to-gray-900 bg-clip-text text-transparent tabular-nums">
                              {format(parseISO(item.scheduledTime), 'HH:mm')}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* NEW: Promo/Ads + QR + Tutorial Section (publicDisplay only) */}
      {publicDisplay && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Promo/Service Ad */}
          <div className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-br from-[#2D9DA8]/30 to-[#22B573]/30 rounded-3xl blur-lg"></div>
            <Card className="relative overflow-hidden bg-gradient-to-br from-[#2D9DA8] to-[#22B573] text-white border-0 shadow-2xl h-full">
              <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full blur-3xl"></div>
              <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
              <CardContent className="relative p-6">
                <div className="flex items-center gap-2 mb-4">
                  <div className="p-2 bg-white/20 backdrop-blur-sm rounded-xl">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold">Featured Service</h3>
                    <p className="text-xs text-white/80">Now at SwiftCare</p>
                  </div>
                </div>
                <div className="space-y-3" key={currentPromo.name}>
                  <div className="text-6xl text-center py-2">{currentPromo.icon}</div>
                  <div className="text-center">
                    <h4 className="text-2xl font-bold mb-1">{currentPromo.name}</h4>
                    <p className="text-white/90 text-sm">{currentPromo.tagline}</p>
                  </div>
                  <div className="bg-white/15 backdrop-blur-sm rounded-xl p-3 text-center">
                    <p className="text-xs font-semibold text-white/90">Ask our staff to learn more!</p>
                  </div>
                  {/* Dots */}
                  <div className="flex justify-center gap-1.5 pt-1">
                    {PROMO_SERVICES.map((_, idx) => (
                      <div
                        key={idx}
                        className={`h-1.5 rounded-full transition-all ${
                          idx === promoIndex ? 'w-6 bg-white' : 'w-1.5 bg-white/40'
                        }`}
                      />
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* QR Code to Book */}
          <div className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-br from-purple-500/30 to-pink-500/30 rounded-3xl blur-lg"></div>
            <Card className="relative backdrop-blur-sm bg-white/95 border-2 border-purple-200/60 shadow-2xl h-full">
              <CardContent className="p-6 text-center">
                <div className="flex items-center justify-center gap-2 mb-3">
                  <div className="p-2 bg-gradient-to-br from-purple-100 to-pink-100 rounded-xl">
                    <Smartphone className="w-5 h-5 text-purple-600" />
                  </div>
                  <div className="text-left">
                    <h3 className="text-lg font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                      Book Online
                    </h3>
                    <p className="text-xs text-gray-500">Scan with your phone</p>
                  </div>
                </div>
                <div className="bg-white p-3 rounded-2xl shadow-inner border-2 border-gray-100 mx-auto inline-block">
                  <QRCode
                    value={bookingUrl}
                    size={170}
                    bgColor="#ffffff"
                    fgColor="#2D9DA8"
                    level="M"
                  />
                </div>
                <div className="mt-4 space-y-1">
                  <p className="text-sm font-semibold text-gray-700">No queue next time!</p>
                  <div className="inline-flex items-center gap-1.5 bg-gradient-to-r from-purple-50 to-pink-50 px-3 py-1.5 rounded-full border border-purple-200">
                    <Globe className="w-3.5 h-3.5 text-purple-600" />
                    <p className="text-xs font-mono font-bold text-purple-700">swiftcaredental.com</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Booking Tutorial */}
          <div className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-br from-amber-400/30 to-orange-500/30 rounded-3xl blur-lg"></div>
            <Card className="relative backdrop-blur-sm bg-white/95 border-2 border-amber-200/60 shadow-2xl h-full">
              <CardContent className="p-6">
                <div className="flex items-center gap-2 mb-4">
                  <div className="p-2 bg-gradient-to-br from-amber-100 to-orange-100 rounded-xl">
                    <CalendarCheck className="w-5 h-5 text-orange-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold bg-gradient-to-r from-amber-600 to-orange-600 bg-clip-text text-transparent">
                      How to Book
                    </h3>
                    <p className="text-xs text-gray-500">Easy 4-step guide</p>
                  </div>
                </div>
                <div className="space-y-2.5">
                  <TutorialStep num={1} title="Visit our website" desc="swiftcaredental.com or scan QR" />
                  <TutorialStep num={2} title="Choose a service" desc="Select from our list" />
                  <TutorialStep num={3} title="Pick date & time" desc="See available slots live" />
                  <TutorialStep num={4} title="Confirm & enjoy!" desc="Check-in on arrival only" />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Footer info bar */}
      {publicDisplay && (
        <div className="relative mt-6">
          <div className="backdrop-blur-md bg-white/80 border border-white/60 rounded-2xl shadow-xl p-5">
            <div className="flex flex-wrap items-center justify-center gap-4 text-gray-700">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-blue-600" />
                <p className="text-sm font-semibold">Please wait for your name to be called</p>
              </div>
              <span className="text-gray-400">•</span>
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-orange-600" />
                <p className="text-sm font-semibold">For emergencies, inform the reception desk</p>
              </div>
              <span className="text-gray-400">•</span>
              <div className="flex items-center gap-2 bg-gradient-to-r from-blue-50 to-indigo-50 px-3 py-1 rounded-full border border-blue-200">
                <RefreshCw className={`w-3.5 h-3.5 text-blue-600 ${connectionStatus === 'connecting' ? 'animate-spin' : ''}`} />
                <span className="text-xs font-medium">Auto-updates every {refreshInterval / 1000}s</span>
              </div>
              <span className="text-gray-400">•</span>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-gray-500" />
                <span className="text-xs font-medium">Last updated: {format(parseISO(queueData.lastUpdated), 'HH:mm:ss')}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ---------- Helper Components ---------- */

interface StatCardProps {
  icon: React.ComponentType<{ className?: string }>
  iconBg: string
  iconColor: string
  numberGradient: string
  borderColor: string
  blurColor: string
  value: number | string
  label: string
  pulse?: boolean
}

function StatCard({ icon: Icon, iconBg, iconColor, numberGradient, borderColor, blurColor, value, label, pulse }: StatCardProps) {
  return (
    <div className="group relative">
      <div className={`absolute inset-0 bg-gradient-to-br ${blurColor} rounded-2xl blur-xl group-hover:blur-2xl transition-all duration-300 ${pulse ? 'animate-pulse' : ''}`}></div>
      <Card className={`relative backdrop-blur-sm bg-white/80 border-2 ${borderColor} shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-1`}>
        <CardContent className="p-5 text-center">
          <div className={`mb-2 inline-flex p-2.5 bg-gradient-to-br ${iconBg} rounded-2xl`}>
            <Icon className={`w-5 h-5 ${iconColor} ${pulse ? 'animate-pulse' : ''}`} />
          </div>
          <div className={`text-2xl font-bold bg-gradient-to-br ${numberGradient} bg-clip-text text-transparent tabular-nums`}>
            {value}
          </div>
          <div className="text-[10px] font-semibold text-gray-600 mt-1 uppercase tracking-wide">
            {label}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function TutorialStep({ num, title, desc }: { num: number; title: string; desc: string }) {
  return (
    <div className="flex items-start gap-3 p-2.5 bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl border border-amber-200/50">
      <div className="shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-amber-500 to-orange-500 text-white font-bold text-sm flex items-center justify-center shadow-md">
        {num}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-gray-800 leading-tight">{title}</p>
        <p className="text-xs text-gray-600 leading-snug">{desc}</p>
      </div>
      {num < 4 && <ArrowRight className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-2" />}
    </div>
  )
}


'use client'

import { formatDisplayName } from '@/lib/utils'
import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Clock, Users, AlertCircle, CheckCircle, User, Bell, RefreshCw, QrCode } from 'lucide-react'
import Image from 'next/image'

interface QueueItem {
  id: string
  appointmentNumber: string
  position: number
  patient: { 
    firstName: string
    lastName: string
    patientNumber: string
  }
  appointmentType: string
  estimatedWaitTime: number
  status: 'waiting' | 'called' | 'in_progress' | 'completed'
  priority: 'normal' | 'urgent' | 'emergency'
  checkedInAt: string
  scheduledDatetime: string
}

interface QueueDisplayProps {
  patientId?: string
  showAll?: boolean
  autoRefresh?: boolean
  showQRCode?: boolean
}

export default function QueueDisplay({ 
  patientId, 
  showAll = false, 
  autoRefresh = true,
  showQRCode = true
}: QueueDisplayProps) {
  const [queueData, setQueueData] = useState<QueueItem[]>([])
  const [currentPatientStatus, setCurrentPatientStatus] = useState<QueueItem | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date())
  const [loading, setLoading] = useState(true)
  const [qrCode, setQrCode] = useState<string | null>(null)

  // Fetch real queue data
  const fetchQueueData = async () => {
    try {
      const response = await fetch('/api/queue/monitor')
      if (response.ok) {
        const data = await response.json()
        setQueueData(data.data?.queue || [])
        
        // Find current patient status if patientId is provided
        if (patientId && data.data?.queue) {
          const currentPatient = data.data.queue.find((item: QueueItem) => 
            item.patient && item.id === patientId
          )
          setCurrentPatientStatus(currentPatient || null)
        }
      }
    } catch (error) {
      console.error('Error fetching queue data:', error)
    } finally {
      setLoading(false)
    }
  }

  // Generate QR code for check-in
  const generateQRCode = async () => {
    if (!showQRCode) return
    
    try {
      const qrData = {
        checkInUrl: `${window.location.origin}/patient/check-in?qr=true`,
        clinicId: 'swiftcare-dental',
        timestamp: new Date().toISOString()
      }
      
      // This would typically call an API to generate the QR code
      // For now, we'll create a simple QR code URL
      const qrString = JSON.stringify(qrData)
      const qrCodeUrl = `data:image/svg+xml;base64,${btoa(`
        <svg width="200" height="200" xmlns="http://www.w3.org/2000/svg">
          <rect width="200" height="200" fill="white"/>
          <text x="100" y="100" text-anchor="middle" font-size="12" fill="black">QR Code</text>
          <text x="100" y="120" text-anchor="middle" font-size="8" fill="gray">Scan to Check In</text>
        </svg>
      `)}`
      setQrCode(qrCodeUrl)
    } catch (error) {
      console.error('Error generating QR code:', error)
    }
  }

  useEffect(() => {
    fetchQueueData()
    generateQRCode()
    
    if (autoRefresh) {
      const interval = setInterval(() => {
        fetchQueueData()
        setLastUpdated(new Date())
      }, 30000) // Refresh every 30 seconds
      
      return () => clearInterval(interval)
    }
  }, [patientId, autoRefresh, showQRCode])

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'emergency': return 'bg-red-500 text-white'
      case 'urgent': return 'bg-orange-500 text-white'
      default: return 'bg-blue-500 text-white'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'in_progress': return 'bg-green-500 text-white'
      case 'called': return 'bg-yellow-500 text-white'
      case 'completed': return 'bg-gray-500 text-white'
      default: return 'bg-blue-500 text-white'
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* QR Code Section */}
      {showQRCode && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <QrCode className="w-5 h-5 mr-2" />
              Quick Check-In
            </CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            {qrCode && (
              <div className="flex flex-col items-center space-y-4">
                <Image 
                  src={qrCode} 
                  alt="Check-in QR Code" 
                  width={150} 
                  height={150}
                  className="border rounded-lg"
                />
                <p className="text-sm text-gray-600">
                  Scan this QR code to check in for your appointment
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Current Patient Status */}
      {currentPatientStatus && (
        <Card className="border-primary">
          <CardHeader>
            <CardTitle className="text-primary">Your Current Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span>Position in Queue:</span>
                <Badge variant="outline" className="text-lg">
                  #{currentPatientStatus.position}
                </Badge>
              </div>
              <div className="flex justify-between items-center">
                <span>Estimated Wait Time:</span>
                <Badge className={getStatusColor(currentPatientStatus.status)}>
                  {currentPatientStatus.estimatedWaitTime} minutes
                </Badge>
              </div>
              <div className="flex justify-between items-center">
                <span>Status:</span>
                <Badge className={getStatusColor(currentPatientStatus.status)}>
                  {currentPatientStatus.status.replace('_', ' ').toUpperCase()}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Queue List */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="flex items-center">
              <Users className="w-5 h-5 mr-2" />
              Current Queue ({queueData.length})
            </CardTitle>
            <div className="flex items-center space-x-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={fetchQueueData}
                disabled={loading}
              >
                <RefreshCw className="w-4 h-4" />
              </Button>
              <span className="text-xs text-gray-500">
                Last updated: {lastUpdated.toLocaleTimeString()}
              </span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {queueData.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No patients in queue currently</p>
            </div>
          ) : (
            <div className="space-y-3">
              {queueData.map((item) => (
                <div
                  key={item.id}
                  className={`p-4 border rounded-lg ${
                    item.id === patientId ? 'border-primary bg-primary/5' : ''
                  }`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <div className="flex items-center space-x-2">
                        <Badge variant="outline">#{item.position}</Badge>
                        <span className="font-medium">
                          {formatDisplayName(item.patient.firstName, item.patient.lastName)}
                        </span>
                        <Badge className={getPriorityColor(item.priority)} variant="secondary">
                          {item.priority.toUpperCase()}
                        </Badge>
                      </div>
                      <div className="text-sm text-gray-600 mt-1">
                        {item.appointmentNumber} • {item.appointmentType}
                      </div>
                    </div>
                    <Badge className={getStatusColor(item.status)}>
                      {item.status.replace('_', ' ').toUpperCase()}
                    </Badge>
                  </div>
                  
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-600">
                      Estimated wait: {item.estimatedWaitTime} min
                    </span>
                    <span className="text-gray-600">
                      Checked in: {new Date(item.checkedInAt).toLocaleTimeString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

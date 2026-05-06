
'use client'

import { formatDisplayName, formatDentistName, formatPatientName } from '@/lib/utils'
import { useState, useEffect, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/use-toast'
import { 
  QrCode, 
  CheckCircle, 
  XCircle,
  Loader2,
  Camera,
  Clock,
  User,
  Calendar
} from 'lucide-react'
import { format, parseISO } from 'date-fns'

interface CheckedInAppointment {
  id: string
  appointmentNumber: string
  scheduledDatetime: string
  appointmentType: string
  patient: {
    fullName?: string | null
    user?: {
      firstName: string
      lastName: string
    }
  }
  dentist?: {
    user?: {
      firstName: string
      lastName: string
    } | null
  }
  queuePosition?: number
  estimatedWaitTime?: number
}

export default function CheckInMonitorPage() {
  const { toast } = useToast()
  const [qrCode, setQrCode] = useState('')
  const [scanning, setScanning] = useState(false)
  const [recentCheckIns, setRecentCheckIns] = useState<CheckedInAppointment[]>([])
  const [showSuccess, setShowSuccess] = useState(false)
  const [lastCheckedIn, setLastCheckedIn] = useState<CheckedInAppointment | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    // Auto-focus the input for scanner
    if (inputRef.current) {
      inputRef.current.focus()
    }
    
    // Fetch recent check-ins
    fetchRecentCheckIns()
    
    // Refresh every 30 seconds
    const interval = setInterval(() => {
      fetchRecentCheckIns()
    }, 30000)

    return () => clearInterval(interval)
  }, [])

  const fetchRecentCheckIns = async () => {
    try {
      const response = await fetch('/api/appointments/recent-checkins')
      if (response.ok) {
        const data = await response.json()
        setRecentCheckIns(data.data?.appointments || [])
      }
    } catch (error) {
      console.error('Error fetching recent check-ins:', error)
    }
  }

  const handleScan = async () => {
    if (!qrCode.trim()) return

    setScanning(true)
    try {
      const response = await fetch('/api/appointments/verify-checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: qrCode.trim() })
      })

      const data = await response.json()

      if (response.ok && data.success) {
        // Success
        setLastCheckedIn(data.data.appointment)
        setShowSuccess(true)
        
        toast({
          title: "Check-in successful!",
          description: `${formatDisplayName(data.data.appointment?.patient?.user?.firstName, data.data.appointment?.patient?.user?.lastName)} has been checked in.`,
        })

        // Refresh recent check-ins
        fetchRecentCheckIns()

        // Clear success message after 5 seconds
        setTimeout(() => {
          setShowSuccess(false)
          setLastCheckedIn(null)
        }, 5000)

      } else {
        toast({
          title: "Check-in failed",
          description: data.error || "Invalid or expired QR code",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error('Error during check-in:', error)
      toast({
        title: "Error",
        description: "Failed to process check-in",
        variant: "destructive",
      })
    } finally {
      setScanning(false)
      setQrCode('')
      
      // Refocus input
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus()
        }
      }, 100)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleScan()
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 p-4">
      <div className="max-w-6xl mx-auto py-8 space-y-6">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            SwiftCare Dental Clinic
          </h1>
          <p className="text-xl text-gray-600">Patient Check-In Station</p>
        </div>

        {/* Scanner Section */}
        <Card className="border-4 border-primary shadow-xl">
          <CardHeader className="text-center bg-primary/5">
            <CardTitle className="text-3xl flex items-center justify-center">
              <QrCode className="w-10 h-10 mr-3" />
              Scan Your QR Code
            </CardTitle>
          </CardHeader>
          <CardContent className="p-8">
            {showSuccess && lastCheckedIn ? (
              <div className="space-y-6 text-center">
                <CheckCircle className="w-24 h-24 text-green-500 mx-auto animate-pulse" />
                
                <div>
                  <h2 className="text-3xl font-bold text-green-700 mb-2">
                    Welcome, {lastCheckedIn?.patient?.user?.firstName}!
                  </h2>
                  <p className="text-xl text-gray-600">
                    You have been checked in successfully
                  </p>
                </div>

                {lastCheckedIn.queuePosition && (
                  <div className="bg-blue-50 p-6 rounded-lg border-2 border-blue-200">
                    <div className="text-5xl font-bold text-blue-600 mb-2">
                      #{lastCheckedIn.queuePosition}
                    </div>
                    <p className="text-lg text-gray-700 mb-1">Your Queue Position</p>
                    {lastCheckedIn.estimatedWaitTime && (
                      <p className="text-xl font-semibold text-indigo-600">
                        Estimated wait: ~{lastCheckedIn.estimatedWaitTime} minutes
                      </p>
                    )}
                  </div>
                )}

                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-gray-700">
                    Please take a seat in the waiting area. You will be called when it's your turn.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex items-center justify-center">
                  <Camera className="w-32 h-32 text-primary/30" />
                </div>

                <div className="space-y-4">
                  <div className="flex items-center space-x-3">
                    <Input
                      ref={inputRef}
                      type="text"
                      placeholder="Scan or enter QR code..."
                      value={qrCode}
                      onChange={(e) => setQrCode(e.target.value)}
                      onKeyPress={handleKeyPress}
                      className="text-2xl p-6 text-center"
                      disabled={scanning}
                    />
                  </div>

                  <Button
                    onClick={handleScan}
                    disabled={!qrCode.trim() || scanning}
                    size="lg"
                    className="w-full text-xl py-6"
                  >
                    {scanning ? (
                      <>
                        <Loader2 className="w-6 h-6 mr-2 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <QrCode className="w-6 h-6 mr-2" />
                        Scan QR Code
                      </>
                    )}
                  </Button>
                </div>

                <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
                  <h4 className="font-semibold text-blue-900 mb-2">Instructions:</h4>
                  <ol className="text-blue-800 space-y-1 list-decimal list-inside">
                    <li>Open your check-in QR code on your phone</li>
                    <li>Hold the QR code up to the scanner</li>
                    <li>Wait for the confirmation message</li>
                  </ol>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Check-ins */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <CheckCircle className="w-5 h-5 mr-2 text-green-600" />
              Recent Check-Ins
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentCheckIns.length === 0 ? (
              <p className="text-center text-gray-500 py-4">
                No recent check-ins
              </p>
            ) : (
              <div className="space-y-3">
                {recentCheckIns.slice(0, 5).map((appointment) => (
                  <div
                    key={appointment.id}
                    className="flex items-center justify-between p-4 bg-green-50 border border-green-200 rounded-lg"
                  >
                    <div className="flex items-center space-x-4">
                      <CheckCircle className="w-6 h-6 text-green-600" />
                      <div>
                        <p className="font-semibold text-gray-900">
                          {formatPatientName(appointment.patient.fullName, appointment.patient.user?.firstName, appointment.patient.user?.lastName, 'Unknown')}
                        </p>
                        <p className="text-sm text-gray-600">
                          {format(parseISO(appointment.scheduledDatetime), 'h:mm a')}
                          {appointment.dentist && (
                            <> • {formatDentistName(appointment?.dentist?.user?.firstName, appointment?.dentist?.user?.lastName)}</>
                          )}
                        </p>
                      </div>
                    </div>
                    <Badge className="bg-green-600 text-white">
                      Checked In
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

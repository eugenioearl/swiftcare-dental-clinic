

'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { X, AlertCircle } from 'lucide-react'
import { format, parseISO, differenceInHours } from 'date-fns'

interface AppointmentCancellationProps {
  appointment: {
    id: string
    appointmentNumber: string
    scheduledDatetime: string
    appointmentType: string
    reasonForVisit?: string
  }
  onCancelled?: () => void
}

export function AppointmentCancellation({ appointment, onCancelled }: AppointmentCancellationProps) {
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [cancellationData, setCancellationData] = useState({
    reason: '',
    customReason: '',
    feedback: ''
  })

  const cancellationReasons = [
    'Schedule conflict',
    'Medical emergency',
    'Found another provider',
    'Financial reasons',
    'Treatment no longer needed',
    'Personal reasons',
    'Other'
  ]

  // Check if appointment can be cancelled (24-hour rule)
  const appointmentTime = parseISO(appointment.scheduledDatetime)
  const currentTime = new Date()
  const hoursUntilAppointment = differenceInHours(appointmentTime, currentTime)
  const canCancel = hoursUntilAppointment >= 24

  const handleCancel = async () => {
    if (!cancellationData.reason) {
      toast({
        title: "Error",
        description: "Please select a cancellation reason",
        variant: "destructive"
      })
      return
    }

    if (cancellationData.reason === 'Other' && !cancellationData.customReason) {
      toast({
        title: "Error", 
        description: "Please provide a custom reason",
        variant: "destructive"
      })
      return
    }

    setLoading(true)

    try {
      const finalReason = cancellationData.reason === 'Other' 
        ? cancellationData.customReason 
        : cancellationData.reason

      const response = await fetch(`/api/appointments/${appointment.id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          cancellationReason: finalReason,
          patientFeedback: cancellationData.feedback
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to cancel appointment')
      }

      toast({
        title: "Appointment Cancelled",
        description: "Your appointment has been cancelled successfully.",
      })

      setOpen(false)
      setCancellationData({ reason: '', customReason: '', feedback: '' })
      onCancelled?.()

    } catch (error) {
      console.error('Cancellation error:', error)
      toast({
        title: "Cancellation Failed",
        description: error instanceof Error ? error.message : "An unexpected error occurred",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  if (!canCancel) {
    return (
      <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
        <div className="flex items-start space-x-2">
          <AlertCircle className="w-5 h-5 text-orange-500 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-orange-800">
              Cannot Cancel
            </p>
            <p className="text-xs text-orange-700">
              Appointments can only be cancelled with at least 24 hours notice. 
              Please contact the clinic directly at (555) 123-4567 for assistance.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="text-red-600 hover:bg-red-50">
          <X className="w-4 h-4 mr-1" />
          Cancel Appointment
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Cancel Appointment</DialogTitle>
          <DialogDescription>
            You are about to cancel appointment <strong>{appointment.appointmentNumber}</strong> 
            scheduled for {format(appointmentTime, 'MMMM d, yyyy at h:mm a')}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="reason">Cancellation Reason *</Label>
            <Select
              value={cancellationData.reason}
              onValueChange={(value) => setCancellationData({ ...cancellationData, reason: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a reason for cancellation" />
              </SelectTrigger>
              <SelectContent>
                {cancellationReasons.map((reason) => (
                  <SelectItem key={reason} value={reason}>
                    {reason}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {cancellationData.reason === 'Other' && (
            <div className="space-y-2">
              <Label htmlFor="customReason">Please specify *</Label>
              <Input
                id="customReason"
                placeholder="Enter your reason..."
                value={cancellationData.customReason}
                onChange={(e) => setCancellationData({ ...cancellationData, customReason: e.target.value })}
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="feedback">Additional Comments (Optional)</Label>
            <Textarea
              id="feedback"
              placeholder="Any feedback about your experience or suggestions for improvement..."
              value={cancellationData.feedback}
              onChange={(e) => setCancellationData({ ...cancellationData, feedback: e.target.value })}
              className="min-h-[80px]"
            />
          </div>

          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-xs text-amber-800">
              <strong>Cancellation Policy:</strong> Appointments cancelled with less than 24 hours notice 
              may be subject to a cancellation fee. No-shows may be charged the full appointment fee.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button 
            variant="outline" 
            onClick={() => setOpen(false)}
            disabled={loading}
          >
            Keep Appointment
          </Button>
          <Button 
            variant="destructive" 
            onClick={handleCancel}
            disabled={loading}
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Cancelling...
              </>
            ) : (
              'Confirm Cancellation'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

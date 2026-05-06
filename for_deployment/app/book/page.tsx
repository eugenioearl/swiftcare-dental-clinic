'use client'

import { useState, useEffect, useCallback } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Calendar, Clock, User, Phone, Mail, MessageSquare, ChevronRight, ChevronLeft, CheckCircle, Loader2, MapPin, Home, ArrowLeft, Heart, AlertTriangle, Facebook, Cake, MapPinned, UserCheck, UserPlus, Hash, Shield, HelpCircle } from 'lucide-react'

interface Service {
  id: string
  name: string
  displayName?: string
  tagalog?: string | null
  category?: string | null
  description: string
  duration: number
  priceDisplay?: string | null
  estimatedPrice?: number | null
}

interface TimeSlot {
  time: string
  display: string
  available: boolean
  booked?: number
  capacity?: number
  full?: boolean
}

interface VerifiedPatient {
  id: string
  patientNumber: string
  fullName: string
  lastName?: string | null
}

type BookingFlow = 'choose' | 'new' | 'existing'
type Step = 1 | 2 | 3 | 4

const MEDICAL_CONDITIONS = [
  'Anemia', 'Arthritis', 'Asthma', 'Blood Disorder', 'Cancer',
  'Diabetes', 'Epilepsy', 'Heart Disease', 'Hepatitis',
  'High Blood Pressure', 'HIV/AIDS', 'Kidney Disease', 'Liver Disease',
  'Respiratory Problems', 'Seizures', 'Stroke', 'Thyroid Problems', 'Tuberculosis',
]

const DENTAL_PROBLEMS = [
  'Bad Breath', 'Bleeding Gums', 'Grinding Teeth', 'Loose Teeth',
  'Sensitive Teeth', 'Jaw Pain/Clicking', 'Mouth Sores', 'Gum Disease',
  'Tooth Pain', 'Broken/Chipped Tooth',
]

export default function BookingPage() {
  // Flow control
  const [bookingFlow, setBookingFlow] = useState<BookingFlow>('choose')
  const [step, setStep] = useState<Step>(1)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [appointmentNumber, setAppointmentNumber] = useState('')
  const [successPatientName, setSuccessPatientName] = useState('')
  const [error, setError] = useState('')
  const [services, setServices] = useState<Service[]>([])
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([])
  const [slotsMessage, setSlotsMessage] = useState<string>('')
  const [loadingSlots, setLoadingSlots] = useState(false)

  // Existing patient verification
  const [verifyPatientNumber, setVerifyPatientNumber] = useState('')
  const [verifyLastName, setVerifyLastName] = useState('')
  const [verifyError, setVerifyError] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [verifiedPatient, setVerifiedPatient] = useState<VerifiedPatient | null>(null)

  // Step 1: Personal Info (new patient flow)
  const [firstName, setFirstName] = useState('')
  const [middleName, setMiddleName] = useState('')
  const [lastName, setLastName] = useState('')
  const [mobileNumber, setMobileNumber] = useState('')
  const [email, setEmail] = useState('')
  const [facebookName, setFacebookName] = useState('')
  const [dateOfBirth, setDateOfBirth] = useState('')
  const [address, setAddress] = useState('')

  // Step 2: Health Info
  const [selectedConditions, setSelectedConditions] = useState<string[]>([])
  const [selectedDentalProblems, setSelectedDentalProblems] = useState<string[]>([])
  const [allergies, setAllergies] = useState('')
  const [currentMedications, setCurrentMedications] = useState('')
  const [dentalAnxiety, setDentalAnxiety] = useState<'none' | 'mild' | 'moderate' | 'severe'>('none')
  const [isPregnant, setIsPregnant] = useState(false)
  const [lastDentalVisit, setLastDentalVisit] = useState('')

  // Step 3: Appointment Details
  const [bookingType, setBookingType] = useState<'scheduled' | 'walk_in'>('scheduled')
  const [preferredDate, setPreferredDate] = useState('')
  const [preferredTime, setPreferredTime] = useState('')
  const [selectedService, setSelectedService] = useState('')
  const [isOther, setIsOther] = useState(false)
  const [customService, setCustomService] = useState('')
  const [isEmergency, setIsEmergency] = useState(false)
  const [notes, setNotes] = useState('')

  // Source/campaign
  const [source, setSource] = useState('direct')
  const [campaign, setCampaign] = useState('')

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    setSource(params.get('source') || 'direct')
    setCampaign(params.get('campaign') || '')
  }, [])

  useEffect(() => {
    fetch('/api/book/services')
      .then(r => r.json())
      .then(d => { if (d.success) setServices(d.data) })
      .catch(() => {})
  }, [])

  const loadSlots = useCallback(async (date: string) => {
    if (!date) return
    setLoadingSlots(true)
    setPreferredTime('')
    setSlotsMessage('')
    try {
      const r = await fetch(`/api/book/slots?date=${date}`)
      const d = await r.json()
      if (d.success) {
        setTimeSlots(d.data || [])
        setSlotsMessage(d.message || '')
      } else {
        setTimeSlots([])
      }
    } catch {
      setTimeSlots([])
    }
    setLoadingSlots(false)
  }, [])

  useEffect(() => { if (preferredDate) loadSlots(preferredDate) }, [preferredDate, loadSlots])

  // ─── Existing patient verification ───
  const handleVerifyPatient = async () => {
    setVerifyError('')
    if (!verifyPatientNumber.trim() || !verifyLastName.trim()) {
      setVerifyError('Please enter both your Patient Number and Last Name.')
      return
    }
    setVerifying(true)
    try {
      const res = await fetch('/api/book/verify-patient', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientNumber: verifyPatientNumber.trim(),
          lastName: verifyLastName.trim(),
        }),
      })
      const data = await res.json()
      if (data.success) {
        setVerifiedPatient(data.data)
        setStep(1) // Step 1 for existing = appointment details directly
      } else {
        setVerifyError(data.error || 'Patient number and last name do not match our records')
      }
    } catch {
      setVerifyError('Network error. Please try again.')
    }
    setVerifying(false)
  }

  // Validation
  const isStep1Valid =
    firstName.trim().length >= 1 &&
    lastName.trim().length >= 1 &&
    mobileNumber.replace(/[^0-9]/g, '').length >= 10 &&
    dateOfBirth.trim().length > 0 &&
    address.trim().length >= 1
  const isExistingApptValid = preferredDate && (bookingType === 'walk_in' || preferredTime) && (selectedService || (isOther && customService.trim()))
  const isStep3Valid = preferredDate && (bookingType === 'walk_in' || preferredTime) && (selectedService || (isOther && customService.trim()))

  const getMinDate = () => {
    // Use Asia/Manila date so the min-date matches the clinic's local calendar
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Manila',
      year: 'numeric', month: '2-digit', day: '2-digit',
    }).formatToParts(new Date())
    const obj: Record<string, string> = {}
    for (const p of parts) if (p.type !== 'literal') obj[p.type] = p.value
    return `${obj.year}-${obj.month}-${obj.day}`
  }

  const toggleCondition = (c: string) => setSelectedConditions(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c])
  const toggleDentalProblem = (p: string) => setSelectedDentalProblems(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p])

  const handleSubmit = async () => {
    setIsSubmitting(true)
    setError('')
    try {
      const serviceName = isOther ? undefined : services.find(s => s.id === selectedService)?.name
      const isExisting = bookingFlow === 'existing' && verifiedPatient

      const payload: any = {
        preferredDate,
        preferredTime: bookingType === 'walk_in' ? undefined : preferredTime,
        appointmentType: bookingType,
        serviceId: isOther ? undefined : selectedService,
        serviceName,
        customService: isOther ? customService.trim() : undefined,
        isEmergency,
        notes: notes.trim() || undefined,
        source: isExisting ? 'existing_patient_booking' : source,
        campaign,
      }

      if (isExisting) {
        payload.bookingFlow = 'existing'
        payload.existingPatientId = verifiedPatient.id
      } else {
        payload.bookingFlow = 'new'
        payload.firstName = firstName.trim()
        payload.middleName = middleName.trim() || undefined
        payload.lastName = lastName.trim()
        payload.mobileNumber = mobileNumber.trim()
        payload.email = email.trim() || undefined
        payload.facebookName = facebookName.trim() || undefined
        payload.dateOfBirth = dateOfBirth || undefined
        payload.address = address.trim() || undefined
        payload.medicalConditions = selectedConditions.length > 0 ? selectedConditions : undefined
        payload.dentalProblems = selectedDentalProblems.length > 0 ? selectedDentalProblems : undefined
        payload.allergies = allergies.trim() || undefined
        payload.currentMedications = currentMedications.trim() || undefined
        payload.dentalAnxiety = dentalAnxiety !== 'none' ? dentalAnxiety : undefined
        payload.isPregnant = isPregnant || undefined
        payload.lastDentalVisit = lastDentalVisit || undefined
      }

      const r = await fetch('/api/book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const d = await r.json()
      if (d.success) {
        setAppointmentNumber(d.data.appointmentNumber)
        const composedName = [firstName.trim(), middleName.trim(), lastName.trim()].filter(Boolean).join(' ')
        setSuccessPatientName(d.data.patientName || composedName || verifiedPatient?.fullName || 'Patient')
        setIsSuccess(true)
      } else {
        setError(d.error || 'Something went wrong')
      }
    } catch {
      setError('Network error. Please try again.')
    }
    setIsSubmitting(false)
  }

  // Success screen
  if (isSuccess) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-teal-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center">
          <div className="bg-white rounded-3xl shadow-xl p-8 border border-blue-100">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="w-10 h-10 text-green-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-800 mb-2">Appointment Request Sent!</h1>
            <p className="text-gray-600 mb-6">Thank you, <strong>{successPatientName || [firstName, lastName].filter(Boolean).join(' ')}</strong>. We&apos;ve received your appointment request.</p>
            {isEmergency && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4">
                <p className="text-red-700 text-sm font-medium flex items-center gap-1.5 justify-center">
                  <AlertTriangle className="w-4 h-4" /> Marked as Emergency — prioritized in queue
                </p>
              </div>
            )}
            <div className="bg-blue-50 rounded-2xl p-5 mb-6 text-left space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-500 text-sm">Reference #</span>
                <span className="font-bold text-blue-600">{appointmentNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 text-sm">Date</span>
                <span className="font-semibold text-gray-700">{new Date(preferredDate + 'T00:00:00').toLocaleDateString('en-PH', { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' })}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 text-sm">Time</span>
                <span className="font-semibold text-gray-700">{bookingType === 'walk_in' ? 'Walk-in (Queue-based)' : (timeSlots.find(s => s.time === preferredTime)?.display || preferredTime)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 text-sm">Service</span>
                <span className="font-semibold text-gray-700">{isOther ? customService : services.find(s => s.id === selectedService)?.name}</span>
              </div>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
              <p className="text-amber-800 text-sm"><strong>What&apos;s next?</strong> Our staff will review your request and confirm your appointment via SMS{email ? ' or email' : ''}. Please wait for our confirmation.</p>
            </div>
            <Link href="/" className="inline-flex items-center gap-2 bg-[#2D9DA8] text-white px-6 py-3 rounded-xl font-medium hover:bg-[#258a93] transition-colors mb-4">
              <Home className="w-4 h-4" /> Back to Home
            </Link>
            <div className="flex items-center gap-2 justify-center text-gray-500 text-sm">
              <MapPin className="w-4 h-4" />
              <span>2nd Floor, Sicangco Building, Mac Arthur Hi-way, San Rafael, Tarlac</span>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-teal-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-blue-100 sticky top-0 z-50">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-1 text-gray-500 hover:text-[#2D9DA8] transition-colors p-1.5 rounded-lg hover:bg-gray-100">
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <Link href="/" className="relative w-32 h-10 block">
              <Image src="/clinic/logo.png" alt="SwiftCare Dental" fill className="object-contain" />
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/" className="text-sm text-gray-500 hover:text-[#2D9DA8] font-medium flex items-center gap-1 transition-colors">
              <Home className="w-3.5 h-3.5" /> Home
            </Link>
            <a href="tel:028123-4567" className="text-sm text-blue-600 font-medium flex items-center gap-1">
              <Phone className="w-3.5 h-3.5" /> Call Us
            </a>
          </div>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 py-6">

        {/* ════════ FLOW CHOOSER ════════ */}
        {bookingFlow === 'choose' && (
          <div className="animate-in fade-in">
            <div className="text-center mb-8">
              <h1 className="text-2xl font-bold text-gray-800 mb-2">Book an Appointment</h1>
              <p className="text-gray-500 text-sm">How would you like to proceed?</p>
            </div>

            <div className="space-y-4">
              {/* Existing Patient */}
              <button onClick={() => setBookingFlow('existing')}
                className="w-full p-5 rounded-2xl border-2 border-[#2D9DA8]/30 bg-gradient-to-br from-[#2D9DA8]/5 to-teal-50 hover:border-[#2D9DA8] hover:shadow-lg hover:shadow-teal-100 transition-all text-left group active:scale-[0.98]">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-[#2D9DA8]/10 flex items-center justify-center flex-shrink-0 group-hover:bg-[#2D9DA8]/20 transition-colors">
                    <UserCheck className="w-6 h-6 text-[#2D9DA8]" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-base font-bold text-gray-800 mb-0.5">I&apos;m an Existing Patient</h3>
                    <p className="text-sm text-gray-500 leading-snug">Quick booking — just enter your Patient Number &amp; Last Name. No need to fill out forms again!</p>
                    <div className="flex items-center gap-1.5 mt-2 text-[#2D9DA8] text-xs font-semibold">
                      <Clock className="w-3.5 h-3.5" /> Book in under 15 seconds
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-[#2D9DA8] transition-colors mt-1" />
                </div>
              </button>

              {/* New Patient */}
              <button onClick={() => { setBookingFlow('new'); setStep(1) }}
                className="w-full p-5 rounded-2xl border-2 border-blue-200/50 bg-gradient-to-br from-blue-50/50 to-white hover:border-blue-400 hover:shadow-lg hover:shadow-blue-100 transition-all text-left group active:scale-[0.98]">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-blue-100/60 flex items-center justify-center flex-shrink-0 group-hover:bg-blue-100 transition-colors">
                    <UserPlus className="w-6 h-6 text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-base font-bold text-gray-800 mb-0.5">I&apos;m a New Patient</h3>
                    <p className="text-sm text-gray-500 leading-snug">First time visiting SwiftCare? We&apos;ll need a few details to set up your profile.</p>
                    <div className="flex items-center gap-1.5 mt-2 text-blue-600 text-xs font-semibold">
                      <Heart className="w-3.5 h-3.5" /> Welcome — takes about 2 minutes
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-blue-600 transition-colors mt-1" />
                </div>
              </button>
            </div>
          </div>
        )}

        {/* ════════ EXISTING PATIENT VERIFICATION ════════ */}
        {bookingFlow === 'existing' && !verifiedPatient && (
          <div className="animate-in fade-in">
            <button onClick={() => { setBookingFlow('choose'); setVerifyError(''); setVerifyPatientNumber(''); setVerifyLastName('') }}
              className="flex items-center gap-1 text-sm text-gray-500 hover:text-[#2D9DA8] mb-4 transition-colors">
              <ArrowLeft className="w-4 h-4" /> Back
            </button>

            <div className="text-center mb-6">
              <div className="w-16 h-16 rounded-2xl bg-[#2D9DA8]/10 flex items-center justify-center mx-auto mb-4">
                <Shield className="w-8 h-8 text-[#2D9DA8]" />
              </div>
              <h1 className="text-2xl font-bold text-gray-800 mb-1">Verify Your Identity</h1>
              <p className="text-gray-500 text-sm">Enter your Patient Number and Last Name to verify your record.</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  <Hash className="w-4 h-4 inline mr-1.5 text-[#2D9DA8]" />Patient Number <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={verifyPatientNumber}
                  onChange={e => setVerifyPatientNumber(e.target.value.toUpperCase())}
                  placeholder="e.g. P-2025-0001"
                  className="w-full px-4 py-3.5 rounded-xl border border-gray-200 focus:border-[#2D9DA8] focus:ring-2 focus:ring-[#2D9DA8]/20 outline-none text-base transition-all font-mono tracking-wide"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  <User className="w-4 h-4 inline mr-1.5 text-[#2D9DA8]" />Last Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={verifyLastName}
                  onChange={e => setVerifyLastName(e.target.value)}
                  placeholder="e.g. Dela Cruz"
                  autoComplete="family-name"
                  className="w-full px-4 py-3.5 rounded-xl border border-gray-200 focus:border-[#2D9DA8] focus:ring-2 focus:ring-[#2D9DA8]/20 outline-none text-base transition-all"
                />
                <p className="text-xs text-gray-400 mt-1">Not case-sensitive — enter it as you remember.</p>
              </div>

              {verifyError && (
                <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>{verifyError}</span>
                </div>
              )}

              <button
                onClick={handleVerifyPatient}
                disabled={verifying || !verifyPatientNumber.trim() || !verifyLastName.trim()}
                className="w-full py-3.5 bg-gradient-to-r from-[#2D9DA8] to-teal-500 text-white rounded-xl font-semibold text-base flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed hover:shadow-lg hover:shadow-teal-200 transition-all active:scale-[0.98]"
              >
                {verifying ? (
                  <><Loader2 className="w-5 h-5 animate-spin" /> Verifying...</>
                ) : (
                  <><Shield className="w-5 h-5" /> Verify &amp; Continue</>
                )}
              </button>
            </div>

            {/* Fallback options */}
            <div className="mt-8 pt-6 border-t border-gray-100">
              <div className="flex items-start gap-2 mb-3">
                <HelpCircle className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-gray-500">Don&apos;t know your Patient Number?</p>
              </div>
              <div className="space-y-2 pl-6">
                <a href="https://www.facebook.com/swiftcaredentalclinic" target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 font-medium">
                  <Facebook className="w-4 h-4" /> Message us on Facebook
                </a>
                <a href="tel:028123-4567"
                  className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 font-medium">
                  <Phone className="w-4 h-4" /> Call the clinic
                </a>
                <button onClick={() => { setBookingFlow('new'); setStep(1) }}
                  className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 font-medium">
                  <UserPlus className="w-4 h-4" /> Book as new patient instead
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ════════ EXISTING PATIENT — VERIFIED → APPOINTMENT FORM ════════ */}
        {bookingFlow === 'existing' && verifiedPatient && !isSuccess && (
          <div className="animate-in fade-in">
            <button onClick={() => { setVerifiedPatient(null); setVerifyError('') }}
              className="flex items-center gap-1 text-sm text-gray-500 hover:text-[#2D9DA8] mb-4 transition-colors">
              <ArrowLeft className="w-4 h-4" /> Back to verification
            </button>

            {/* Verified patient banner */}
            <div className="bg-gradient-to-r from-[#2D9DA8]/10 to-teal-50 border border-[#2D9DA8]/20 rounded-2xl p-4 mb-6 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#2D9DA8] flex items-center justify-center flex-shrink-0">
                <UserCheck className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-gray-800 truncate">{verifiedPatient.fullName}</p>
                <p className="text-xs text-gray-500">{verifiedPatient.patientNumber}</p>
              </div>
              <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
            </div>

            <h1 className="text-2xl font-bold text-gray-800 mb-1">Choose Your Appointment</h1>
            <p className="text-gray-500 text-sm mb-6">Select your service, date, and time — that&apos;s it!</p>

            <div className="space-y-4">
              {/* Booking Type Toggle */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Booking Type</label>
                <div className="grid grid-cols-2 gap-3">
                  <button type="button" onClick={() => { setBookingType('scheduled'); setPreferredTime('') }}
                    className={`p-3 rounded-xl border-2 text-center transition-all ${
                      bookingType === 'scheduled'
                        ? 'border-[#2D9DA8] bg-[#2D9DA8]/5 text-[#2D9DA8]'
                        : 'border-gray-200 bg-white text-gray-600 hover:border-[#2D9DA8]/30'
                    }`}>
                    <Calendar className="w-5 h-5 mx-auto mb-1" />
                    <span className="text-sm font-semibold block">Scheduled</span>
                    <span className="text-xs text-gray-500">Pick a date &amp; time</span>
                  </button>
                  <button type="button" onClick={() => { setBookingType('walk_in'); setPreferredTime('') }}
                    className={`p-3 rounded-xl border-2 text-center transition-all ${
                      bookingType === 'walk_in'
                        ? 'border-teal-500 bg-teal-50 text-teal-700'
                        : 'border-gray-200 bg-white text-gray-600 hover:border-teal-200'
                    }`}>
                    <User className="w-5 h-5 mx-auto mb-1" />
                    <span className="text-sm font-semibold block">Walk-in</span>
                    <span className="text-xs text-gray-500">Visit without time slot</span>
                  </button>
                </div>
              </div>

              {/* Emergency */}
              <label className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                isEmergency ? 'border-red-400 bg-red-50' : 'border-gray-200 bg-white hover:border-red-200'
              }`}>
                <input type="checkbox" checked={isEmergency} onChange={e => setIsEmergency(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-red-600 focus:ring-red-500" />
                <div>
                  <span className="text-sm font-semibold text-red-600 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4" /> This is an Emergency
                  </span>
                  <p className="text-xs text-gray-500">Severe pain, swelling, or trauma — prioritized.</p>
                </div>
              </label>

              {/* Service */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Service <span className="text-red-400">*</span></label>
                <select
                  value={isOther ? '__other__' : selectedService}
                  onChange={e => {
                    if (e.target.value === '__other__') { setIsOther(true); setSelectedService('') }
                    else { setIsOther(false); setSelectedService(e.target.value); setCustomService('') }
                  }}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-[#2D9DA8] focus:ring-2 focus:ring-[#2D9DA8]/20 outline-none text-base bg-white transition-all">
                  <option value="">Select a service...</option>
                  {services.map(s => {
                    const label = s.displayName || s.name
                    const tag = s.tagalog ? ` (${s.tagalog})` : ''
                    const price = s.priceDisplay ? ` — ${s.priceDisplay}` : ''
                    return <option key={s.id} value={s.id}>{label}{tag}{price}</option>
                  })}
                  <option value="__other__">Others (specify below)</option>
                </select>
                {isOther && (
                  <input type="text" value={customService} onChange={e => setCustomService(e.target.value)} placeholder="Describe the service..."
                    className="w-full mt-2 px-4 py-3 rounded-xl border border-gray-200 focus:border-[#2D9DA8] focus:ring-2 focus:ring-[#2D9DA8]/20 outline-none text-base transition-all" />
                )}
              </div>

              {/* Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  <Calendar className="w-4 h-4 inline mr-1.5 text-[#2D9DA8]" />Preferred Date <span className="text-red-400">*</span>
                </label>
                <input type="date" value={preferredDate} onChange={e => setPreferredDate(e.target.value)} min={getMinDate()}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-[#2D9DA8] focus:ring-2 focus:ring-[#2D9DA8]/20 outline-none text-base transition-all" />
              </div>

              {/* Time Slots */}
              {bookingType === 'scheduled' && preferredDate && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Clock className="w-4 h-4 inline mr-1.5 text-[#2D9DA8]" />Preferred Time <span className="text-red-400">*</span>
                  </label>
                  {loadingSlots ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="w-5 h-5 animate-spin text-[#2D9DA8]" />
                      <span className="ml-2 text-sm text-gray-500">Loading available times...</span>
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-2">
                      {timeSlots.map(slot => {
                        const isDisabled = !slot.available
                        const isSelected = preferredTime === slot.time
                        return (
                          <button
                            key={slot.time}
                            onClick={() => !isDisabled && setPreferredTime(slot.time)}
                            disabled={isDisabled}
                            title={isDisabled ? (slot.full ? `Fully booked (${slot.booked}/${slot.capacity})` : 'Unavailable') : undefined}
                            className={`py-2.5 px-3 rounded-xl text-sm font-medium transition-all border ${
                              isDisabled
                                ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed line-through'
                                : isSelected
                                  ? 'bg-[#2D9DA8] text-white border-[#2D9DA8] shadow-md shadow-teal-200'
                                  : 'bg-white text-gray-700 border-gray-200 hover:border-[#2D9DA8]/50 hover:bg-teal-50'
                            }`}
                          >
                            {slot.display}
                          </button>
                        )
                      })}
                      {timeSlots.length === 0 && (
                        <div className="col-span-3 text-center py-4">
                          <p className="text-gray-500 text-sm font-medium">{slotsMessage || 'No available slots for this date.'}</p>
                          <p className="text-gray-400 text-xs mt-1">Please select another date.</p>
                        </div>
                      )}
                      {timeSlots.length > 0 && timeSlots.every(s => !s.available) && (
                        <div className="col-span-3 text-center py-2">
                          <p className="text-gray-500 text-xs">All time slots are fully booked for this date.</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {bookingType === 'walk_in' && preferredDate && (
                <div className="bg-teal-50 border border-teal-200 rounded-xl p-4">
                  <p className="text-teal-700 text-sm font-medium flex items-center gap-2">
                    <Clock className="w-4 h-4" /> No time slot needed for walk-ins
                  </p>
                  <p className="text-teal-600 text-xs mt-1">Visit the clinic on your selected date. You&apos;ll be served based on queue priority.</p>
                </div>
              )}

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  <MessageSquare className="w-4 h-4 inline mr-1.5 text-[#2D9DA8]" />Notes <span className="text-gray-400 text-xs">(optional)</span>
                </label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Any concerns or special requests..."
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-[#2D9DA8] focus:ring-2 focus:ring-[#2D9DA8]/20 outline-none text-base transition-all resize-none" />
              </div>
            </div>

            {error && (
              <div className="mt-4 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">{error}</div>
            )}

            <button onClick={handleSubmit} disabled={isSubmitting || !isExistingApptValid}
              className="w-full mt-8 py-3.5 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl font-bold text-base flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed hover:shadow-lg hover:shadow-green-200 transition-all active:scale-[0.98]">
              {isSubmitting ? (
                <><Loader2 className="w-5 h-5 animate-spin" /> Submitting...</>
              ) : (
                <><CheckCircle className="w-5 h-5" /> Book Appointment</>
              )}
            </button>
          </div>
        )}

        {/* ════════ NEW PATIENT FLOW ════════ */}
        {bookingFlow === 'new' && !isSuccess && (
          <>
        {/* Progress indicator */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {[1, 2, 3, 4].map(s => (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                s < step ? 'bg-green-500 text-white' :
                s === step ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' :
                'bg-gray-200 text-gray-400'
              }`}>
                {s < step ? '\u2713' : s}
              </div>
              {s < 4 && <div className={`w-6 h-0.5 ${s < step ? 'bg-green-400' : 'bg-gray-200'}`} />}
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs text-gray-400 uppercase tracking-wider">
            Step {step} of 4
          </span>
        </div>

        {/* ─── Step 1: Personal Info ─── */}
        {step === 1 && (
          <div className="animate-in fade-in">
            <h1 className="text-2xl font-bold text-gray-800 mb-1">Your Information</h1>
            <p className="text-gray-500 text-sm mb-6">Tell us about yourself so we can assist you better.</p>

            <div className="space-y-4">
              {/* First Name + Middle Name */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    <User className="w-4 h-4 inline mr-1.5 text-blue-500" />First Name <span className="text-red-400">*</span>
                  </label>
                  <input type="text" value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="Juan" autoComplete="given-name"
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none text-base transition-all" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Middle Name <span className="text-gray-400 text-xs">(optional)</span>
                  </label>
                  <input type="text" value={middleName} onChange={e => setMiddleName(e.target.value)} placeholder="Santos" autoComplete="additional-name"
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none text-base transition-all" />
                </div>
              </div>

              {/* Last Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  <User className="w-4 h-4 inline mr-1.5 text-blue-500" />Last Name <span className="text-red-400">*</span>
                </label>
                <input type="text" value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Dela Cruz" autoComplete="family-name"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none text-base transition-all" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  <Phone className="w-4 h-4 inline mr-1.5 text-blue-500" />Mobile Number <span className="text-red-400">*</span>
                </label>
                <input type="tel" value={mobileNumber} onChange={e => setMobileNumber(e.target.value)} placeholder="0917 123 4567" autoComplete="tel"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none text-base transition-all" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    <Mail className="w-4 h-4 inline mr-1.5 text-blue-500" />Email <span className="text-gray-400 text-xs">(optional)</span>
                  </label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="your@email.com" autoComplete="email"
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none text-base transition-all" />
                  <p className="text-xs text-gray-400 mt-1">For appointment confirmations</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    <Facebook className="w-4 h-4 inline mr-1.5 text-blue-500" />Facebook <span className="text-gray-400 text-xs">(optional)</span>
                  </label>
                  <input type="text" value={facebookName} onChange={e => setFacebookName(e.target.value)} placeholder="Facebook name"
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none text-base transition-all" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  <Cake className="w-4 h-4 inline mr-1.5 text-blue-500" />Date of Birth <span className="text-red-400">*</span>
                </label>
                <input type="date" value={dateOfBirth} onChange={e => setDateOfBirth(e.target.value)}
                  max={new Date().toISOString().split('T')[0]} autoComplete="bday"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none text-base transition-all" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  <MapPinned className="w-4 h-4 inline mr-1.5 text-blue-500" />Address <span className="text-red-400">*</span>
                </label>
                <input type="text" value={address} onChange={e => setAddress(e.target.value)} placeholder="Barangay, City, Province" autoComplete="street-address"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none text-base transition-all" />
              </div>
            </div>

            <div className="flex gap-3 mt-8">
              <button onClick={() => { setBookingFlow('choose'); setStep(1); }}
                className="px-5 py-3.5 bg-gray-100 text-gray-600 rounded-xl font-medium flex items-center gap-1 hover:bg-gray-200 transition-all active:scale-[0.98]">
                <ChevronLeft className="w-5 h-5" /> Back
              </button>
              <button onClick={() => setStep(2)} disabled={!isStep1Valid}
                className="flex-1 py-3.5 bg-gradient-to-r from-blue-600 to-teal-500 text-white rounded-xl font-semibold text-base flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed hover:shadow-lg hover:shadow-blue-200 transition-all active:scale-[0.98]">
                Continue <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        {/* ─── Step 2: Health Info ─── */}
        {step === 2 && (
          <div className="animate-in fade-in">
            <h1 className="text-2xl font-bold text-gray-800 mb-1">Health Information</h1>
            <p className="text-gray-500 text-sm mb-6">Help us understand your health background for a safer visit. <span className="text-gray-400">(All optional)</span></p>

            <div className="space-y-5">
              {/* Medical Conditions */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Heart className="w-4 h-4 inline mr-1.5 text-red-400" />Medical Conditions
                </label>
                <p className="text-xs text-gray-400 mb-2">Select any conditions that apply to you.</p>
                <div className="flex flex-wrap gap-2">
                  {MEDICAL_CONDITIONS.map(c => (
                    <button key={c} onClick={() => toggleCondition(c)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                        selectedConditions.includes(c)
                          ? 'bg-red-50 border-red-300 text-red-700'
                          : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                      }`}>
                      {selectedConditions.includes(c) && '\u2713 '}{c}
                    </button>
                  ))}
                </div>
              </div>

              {/* Dental Problems */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Current Dental Problems</label>
                <p className="text-xs text-gray-400 mb-2">Select any dental concerns you currently have.</p>
                <div className="flex flex-wrap gap-2">
                  {DENTAL_PROBLEMS.map(p => (
                    <button key={p} onClick={() => toggleDentalProblem(p)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                        selectedDentalProblems.includes(p)
                          ? 'bg-blue-50 border-blue-300 text-blue-700'
                          : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                      }`}>
                      {selectedDentalProblems.includes(p) && '\u2713 '}{p}
                    </button>
                  ))}
                </div>
              </div>

              {/* Allergies & Medications */}
              <div className="grid grid-cols-1 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Allergies</label>
                  <input type="text" value={allergies} onChange={e => setAllergies(e.target.value)} placeholder="e.g., Penicillin, Latex, Local Anesthesia..."
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none text-sm transition-all" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Current Medications</label>
                  <input type="text" value={currentMedications} onChange={e => setCurrentMedications(e.target.value)} placeholder="e.g., Metformin, Aspirin..."
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none text-sm transition-all" />
                </div>
              </div>

              {/* Dental Anxiety & Pregnancy */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Dental Anxiety Level</label>
                  <select value={dentalAnxiety} onChange={e => setDentalAnxiety(e.target.value as any)}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none text-sm bg-white transition-all">
                    <option value="none">None</option>
                    <option value="mild">Mild</option>
                    <option value="moderate">Moderate</option>
                    <option value="severe">Severe</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Last Dental Visit</label>
                  <select value={lastDentalVisit} onChange={e => setLastDentalVisit(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none text-sm bg-white transition-all">
                    <option value="">Select...</option>
                    <option value="less_than_6_months">Less than 6 months ago</option>
                    <option value="6_to_12_months">6–12 months ago</option>
                    <option value="1_to_2_years">1–2 years ago</option>
                    <option value="more_than_2_years">More than 2 years ago</option>
                    <option value="never">Never been to a dentist</option>
                  </select>
                </div>
              </div>

              {/* Pregnancy */}
              <label className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 bg-white cursor-pointer hover:border-blue-200 transition-colors">
                <input type="checkbox" checked={isPregnant} onChange={e => setIsPregnant(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                <div>
                  <span className="text-sm font-medium text-gray-700">Currently pregnant or nursing</span>
                  <p className="text-xs text-gray-400">This helps us adjust treatment accordingly</p>
                </div>
              </label>
            </div>

            <div className="flex gap-3 mt-8">
              <button onClick={() => setStep(1)}
                className="px-6 py-3.5 bg-gray-100 text-gray-600 rounded-xl font-medium flex items-center gap-1 hover:bg-gray-200 transition-all active:scale-[0.98]">
                <ChevronLeft className="w-5 h-5" /> Back
              </button>
              <button onClick={() => setStep(3)}
                className="flex-1 py-3.5 bg-gradient-to-r from-blue-600 to-teal-500 text-white rounded-xl font-semibold text-base flex items-center justify-center gap-2 hover:shadow-lg hover:shadow-blue-200 transition-all active:scale-[0.98]">
                Continue <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        {/* ─── Step 3: Appointment Details ─── */}
        {step === 3 && (
          <div className="animate-in fade-in">
            <h1 className="text-2xl font-bold text-gray-800 mb-1">Appointment Details</h1>
            <p className="text-gray-500 text-sm mb-6">Choose your preferred service, date, and time.</p>

            <div className="space-y-4">
              {/* Booking Type Toggle */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Booking Type</label>
                <div className="grid grid-cols-2 gap-3">
                  <button type="button" onClick={() => { setBookingType('scheduled'); setPreferredTime('') }}
                    className={`p-3 rounded-xl border-2 text-center transition-all ${
                      bookingType === 'scheduled'
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-200 bg-white text-gray-600 hover:border-blue-200'
                    }`}>
                    <Calendar className="w-5 h-5 mx-auto mb-1" />
                    <span className="text-sm font-semibold block">Scheduled</span>
                    <span className="text-xs text-gray-500">Pick a date &amp; time</span>
                  </button>
                  <button type="button" onClick={() => { setBookingType('walk_in'); setPreferredTime('') }}
                    className={`p-3 rounded-xl border-2 text-center transition-all ${
                      bookingType === 'walk_in'
                        ? 'border-teal-500 bg-teal-50 text-teal-700'
                        : 'border-gray-200 bg-white text-gray-600 hover:border-teal-200'
                    }`}>
                    <User className="w-5 h-5 mx-auto mb-1" />
                    <span className="text-sm font-semibold block">Walk-in</span>
                    <span className="text-xs text-gray-500">Visit without time slot</span>
                  </button>
                </div>
              </div>

              {/* Emergency Tag */}
              <label className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                isEmergency ? 'border-red-400 bg-red-50' : 'border-gray-200 bg-white hover:border-red-200'
              }`}>
                <input type="checkbox" checked={isEmergency} onChange={e => setIsEmergency(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-red-600 focus:ring-red-500" />
                <div>
                  <span className="text-sm font-semibold text-red-600 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4" /> This is an Emergency
                  </span>
                  <p className="text-xs text-gray-500">Emergency appointments are prioritized. Severe pain, swelling, or trauma.</p>
                </div>
              </label>

              {/* Service Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Service <span className="text-red-400">*</span></label>
                <select
                  value={isOther ? '__other__' : selectedService}
                  onChange={e => {
                    if (e.target.value === '__other__') {
                      setIsOther(true)
                      setSelectedService('')
                    } else {
                      setIsOther(false)
                      setSelectedService(e.target.value)
                      setCustomService('')
                    }
                  }}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none text-base bg-white transition-all">
                  <option value="">Select a service...</option>
                  {services.map(s => {
                    const label = s.displayName || s.name
                    const tag = s.tagalog ? ` (${s.tagalog})` : ''
                    const price = s.priceDisplay ? ` — ${s.priceDisplay}` : ''
                    return (
                      <option key={s.id} value={s.id}>{label}{tag}{price}</option>
                    )
                  })}
                  <option value="__other__">Others (specify below)</option>
                </select>
                {selectedService && !isOther && (() => {
                  const svc = services.find(s => s.id === selectedService)
                  if (!svc) return null
                  return (
                    <div className="mt-2 p-3 rounded-lg bg-gradient-to-br from-[#2D9DA8]/5 to-[#22B573]/5 border border-[#2D9DA8]/10 text-xs">
                      {svc.description && <p className="text-gray-600 mb-1.5">{svc.description}</p>}
                      <div className="flex flex-wrap gap-x-4 gap-y-1">
                        {svc.duration ? <span className="text-gray-500"><Clock className="w-3 h-3 inline mr-1" />{svc.duration} min</span> : null}
                        {svc.priceDisplay ? <span className="text-[#2D9DA8] font-semibold">{svc.priceDisplay}</span> : null}
                      </div>
                      <p className="text-[10px] text-gray-400 italic mt-1.5">Estimated only — final fee confirmed after consultation.</p>
                    </div>
                  )
                })()}
              </div>

              {isOther && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Please specify <span className="text-red-400">*</span></label>
                  <input type="text" value={customService} onChange={e => setCustomService(e.target.value)} placeholder="Describe the service you need..."
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none text-base transition-all" />
                </div>
              )}

              {/* Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  <Calendar className="w-4 h-4 inline mr-1.5 text-blue-500" />Preferred Date <span className="text-red-400">*</span>
                </label>
                <input type="date" value={preferredDate} onChange={e => setPreferredDate(e.target.value)} min={getMinDate()}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none text-base transition-all" />
              </div>

              {/* Time Slots - only for scheduled appointments */}
              {bookingType === 'scheduled' && preferredDate && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Clock className="w-4 h-4 inline mr-1.5 text-blue-500" />Preferred Time <span className="text-red-400">*</span>
                  </label>
                  {loadingSlots ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
                      <span className="ml-2 text-sm text-gray-500">Loading available times...</span>
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-2">
                      {timeSlots.map(slot => {
                        const isDisabled = !slot.available
                        const isSelected = preferredTime === slot.time
                        return (
                          <button
                            key={slot.time}
                            onClick={() => !isDisabled && setPreferredTime(slot.time)}
                            disabled={isDisabled}
                            title={isDisabled ? (slot.full ? `Fully booked (${slot.booked}/${slot.capacity})` : 'Unavailable') : undefined}
                            className={`py-2.5 px-3 rounded-xl text-sm font-medium transition-all border ${
                              isDisabled
                                ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed line-through'
                                : isSelected
                                  ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-200'
                                  : 'bg-white text-gray-700 border-gray-200 hover:border-blue-300 hover:bg-blue-50'
                            }`}
                          >
                            {slot.display}
                          </button>
                        )
                      })}
                      {timeSlots.length === 0 && (
                        <div className="col-span-3 text-center py-4">
                          <p className="text-gray-500 text-sm font-medium">
                            {slotsMessage || 'No available slots for this date.'}
                          </p>
                          <p className="text-gray-400 text-xs mt-1">Please select another date.</p>
                        </div>
                      )}
                      {timeSlots.length > 0 && timeSlots.every(s => !s.available) && (
                        <div className="col-span-3 text-center py-2">
                          <p className="text-gray-500 text-xs">All time slots are fully booked for this date.</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Walk-in info message */}
              {bookingType === 'walk_in' && preferredDate && (
                <div className="bg-teal-50 border border-teal-200 rounded-xl p-4">
                  <p className="text-teal-700 text-sm font-medium flex items-center gap-2">
                    <Clock className="w-4 h-4" /> No time slot needed for walk-ins
                  </p>
                  <p className="text-teal-600 text-xs mt-1">Just visit the clinic on your selected date. Our dentist will attend to you based on queue priority.</p>
                </div>
              )}

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  <MessageSquare className="w-4 h-4 inline mr-1.5 text-blue-500" />Notes / Remarks <span className="text-gray-400 text-xs">(optional)</span>
                </label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} placeholder="Any additional information or concerns..."
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none text-base transition-all resize-none" />
              </div>
            </div>

            <div className="flex gap-3 mt-8">
              <button onClick={() => setStep(2)}
                className="px-6 py-3.5 bg-gray-100 text-gray-600 rounded-xl font-medium flex items-center gap-1 hover:bg-gray-200 transition-all active:scale-[0.98]">
                <ChevronLeft className="w-5 h-5" /> Back
              </button>
              <button onClick={() => setStep(4)} disabled={!isStep3Valid}
                className="flex-1 py-3.5 bg-gradient-to-r from-blue-600 to-teal-500 text-white rounded-xl font-semibold text-base flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed hover:shadow-lg hover:shadow-blue-200 transition-all active:scale-[0.98]">
                Review <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        {/* ─── Step 4: Review & Submit ─── */}
        {step === 4 && (
          <div className="animate-in fade-in">
            <h1 className="text-2xl font-bold text-gray-800 mb-1">Review & Submit</h1>
            <p className="text-gray-500 text-sm mb-6">Please review your information before submitting.</p>

            <div className="bg-white rounded-2xl border border-blue-100 shadow-sm overflow-hidden">
              <div className="bg-gradient-to-r from-blue-600 to-teal-500 px-5 py-3">
                <h2 className="text-white font-semibold">Appointment Summary</h2>
              </div>
              <div className="p-5 space-y-3">
                {isEmergency && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-2 mb-1">
                    <span className="text-red-700 text-sm font-semibold flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4" /> Emergency Appointment
                    </span>
                  </div>
                )}
                <div className="flex justify-between items-center">
                  <span className="text-gray-500 text-sm flex items-center gap-2"><User className="w-4 h-4" /> Name</span>
                  <span className="font-semibold text-gray-800">{[firstName, middleName, lastName].filter(Boolean).join(' ') || verifiedPatient?.fullName}</span>
                </div>
                <div className="border-t border-gray-100" />
                <div className="flex justify-between items-center">
                  <span className="text-gray-500 text-sm flex items-center gap-2"><Phone className="w-4 h-4" /> Mobile</span>
                  <span className="font-semibold text-gray-800">{mobileNumber}</span>
                </div>
                {email && (<><div className="border-t border-gray-100" /><div className="flex justify-between items-center">
                  <span className="text-gray-500 text-sm flex items-center gap-2"><Mail className="w-4 h-4" /> Email</span>
                  <span className="font-semibold text-gray-800 text-sm">{email}</span>
                </div></>)}
                {facebookName && (<><div className="border-t border-gray-100" /><div className="flex justify-between items-center">
                  <span className="text-gray-500 text-sm flex items-center gap-2"><Facebook className="w-4 h-4" /> Facebook</span>
                  <span className="font-semibold text-gray-800 text-sm">{facebookName}</span>
                </div></>)}
                {dateOfBirth && (<><div className="border-t border-gray-100" /><div className="flex justify-between items-center">
                  <span className="text-gray-500 text-sm">Birthday</span>
                  <span className="font-semibold text-gray-800">{new Date(dateOfBirth + 'T00:00:00').toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
                </div></>)}
                {address && (<><div className="border-t border-gray-100" /><div className="flex justify-between items-center">
                  <span className="text-gray-500 text-sm">Address</span>
                  <span className="font-semibold text-gray-800 text-sm text-right max-w-[200px]">{address}</span>
                </div></>)}

                <div className="border-t border-gray-100" />
                <div className="flex justify-between items-center">
                  <span className="text-gray-500 text-sm">Service</span>
                  <span className="font-semibold text-gray-800">{isOther ? customService : services.find(s => s.id === selectedService)?.name}</span>
                </div>
                <div className="border-t border-gray-100" />
                <div className="flex justify-between items-center">
                  <span className="text-gray-500 text-sm flex items-center gap-2"><Calendar className="w-4 h-4" /> Date</span>
                  <span className="font-semibold text-gray-800">{new Date(preferredDate + 'T00:00:00').toLocaleDateString('en-PH', { weekday: 'short', month: 'long', day: 'numeric' })}</span>
                </div>
                <div className="border-t border-gray-100" />
                <div className="flex justify-between items-center">
                  <span className="text-gray-500 text-sm flex items-center gap-2"><Clock className="w-4 h-4" /> Time</span>
                  <span className="font-semibold text-gray-800">
                    {bookingType === 'walk_in' ? (
                      <span className="text-teal-600">Walk-in (Queue-based)</span>
                    ) : (
                      timeSlots.find(s => s.time === preferredTime)?.display || preferredTime
                    )}
                  </span>
                </div>
                {bookingType === 'walk_in' && (
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500 text-sm">Type</span>
                    <span className="font-semibold text-teal-600">Walk-in</span>
                  </div>
                )}

                {/* Health summary */}
                {(selectedConditions.length > 0 || selectedDentalProblems.length > 0 || allergies) && (
                  <>
                    <div className="border-t border-gray-100" />
                    <div>
                      <span className="text-gray-500 text-sm font-medium">Health Info</span>
                      <div className="mt-1.5 space-y-1">
                        {selectedConditions.length > 0 && <p className="text-xs text-gray-600"><span className="font-medium">Conditions:</span> {selectedConditions.join(', ')}</p>}
                        {selectedDentalProblems.length > 0 && <p className="text-xs text-gray-600"><span className="font-medium">Dental:</span> {selectedDentalProblems.join(', ')}</p>}
                        {allergies && <p className="text-xs text-gray-600"><span className="font-medium">Allergies:</span> {allergies}</p>}
                        {currentMedications && <p className="text-xs text-gray-600"><span className="font-medium">Medications:</span> {currentMedications}</p>}
                        {dentalAnxiety !== 'none' && <p className="text-xs text-gray-600"><span className="font-medium">Anxiety:</span> {dentalAnxiety}</p>}
                        {isPregnant && <p className="text-xs text-red-600 font-medium">Pregnant / Nursing</p>}
                      </div>
                    </div>
                  </>
                )}

                {notes && (<><div className="border-t border-gray-100" /><div>
                  <span className="text-gray-500 text-sm">Notes</span>
                  <p className="text-gray-700 text-sm mt-1">{notes}</p>
                </div></>)}
              </div>
            </div>

            {error && (
              <div className="mt-4 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">{error}</div>
            )}

            <div className="flex gap-3 mt-8">
              <button onClick={() => setStep(3)} disabled={isSubmitting}
                className="px-6 py-3.5 bg-gray-100 text-gray-600 rounded-xl font-medium flex items-center gap-1 hover:bg-gray-200 transition-all active:scale-[0.98]">
                <ChevronLeft className="w-5 h-5" /> Back
              </button>
              <button onClick={handleSubmit} disabled={isSubmitting}
                className="flex-1 py-3.5 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl font-bold text-base flex items-center justify-center gap-2 disabled:opacity-60 hover:shadow-lg hover:shadow-green-200 transition-all active:scale-[0.98]">
                {isSubmitting ? (
                  <><Loader2 className="w-5 h-5 animate-spin" /> Submitting...</>
                ) : (
                  <><CheckCircle className="w-5 h-5" /> Submit Request</>
                )}
              </button>
            </div>
          </div>
        )}
        </> )}

        {/* Footer */}
        <div className="text-center mt-10 pb-8">
          <div className="flex items-center justify-center gap-1.5 text-gray-400 text-xs mb-2">
            <MapPin className="w-3.5 h-3.5" />
            2nd Floor, Sicangco Building, Mac Arthur Hi-way, San Rafael, Tarlac
          </div>
          <p className="text-gray-400 text-xs">&copy; {new Date().getFullYear()} SwiftCare Dental Clinic</p>
        </div>
      </div>
    </div>
  )
}

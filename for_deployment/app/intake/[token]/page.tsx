'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import {
  User, Phone, Mail, Calendar, MapPin, Heart, Pill, AlertTriangle,
  Stethoscope, Shield, CheckCircle, Loader2, Home, ChevronRight, ChevronLeft
} from 'lucide-react'

type Step = 1 | 2 | 3 | 4

interface IntakeData {
  id: string
  appointmentType: string | null
  status: string
  prefill: { fullName: string | null; mobileNumber: string | null; emailAddress: string | null } | null
}

export default function IntakePage() {
  const params = useParams()
  const token = params.token as string
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [intake, setIntake] = useState<IntakeData | null>(null)
  const [step, setStep] = useState<Step>(1)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  // Form fields
  const [fullName, setFullName] = useState('')
  const [mobileNumber, setMobileNumber] = useState('')
  const [emailAddress, setEmailAddress] = useState('')
  const [dateOfBirth, setDateOfBirth] = useState('')
  const [gender, setGender] = useState('')
  const [address, setAddress] = useState('')
  const [medicalHistory, setMedicalHistory] = useState('')
  const [allergies, setAllergies] = useState('')
  const [currentMedications, setCurrentMedications] = useState('')
  const [bloodPressure, setBloodPressure] = useState('')
  const [pregnancyStatus, setPregnancyStatus] = useState('')
  const [chiefComplaint, setChiefComplaint] = useState('')
  const [dentalAnxieties, setDentalAnxieties] = useState('')
  const [lastDentalVisit, setLastDentalVisit] = useState('')
  const [previousDentist, setPreviousDentist] = useState('')
  const [emergencyName, setEmergencyName] = useState('')
  const [emergencyPhone, setEmergencyPhone] = useState('')
  const [emergencyRelation, setEmergencyRelation] = useState('')

  useEffect(() => {
    fetch(`/api/intake/${token}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) {
          setError(d.submitted ? 'This form has already been submitted. Thank you!' : d.error)
        } else {
          setIntake(d.submission)
          if (d.submission.prefill) {
            setFullName(d.submission.prefill.fullName || '')
            setMobileNumber(d.submission.prefill.mobileNumber || '')
            setEmailAddress(d.submission.prefill.emailAddress || '')
          }
        }
      })
      .catch(() => setError('Failed to load form'))
      .finally(() => setLoading(false))
  }, [token])

  const handleSubmit = async () => {
    setSubmitting(true)
    try {
      const res = await fetch(`/api/intake/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName, mobileNumber, emailAddress, dateOfBirth, gender, address,
          medicalHistory, allergies, currentMedications, bloodPressure, pregnancyStatus,
          chiefComplaint, dentalAnxieties, lastDentalVisit, previousDentist,
          emergencyName, emergencyPhone, emergencyRelation
        })
      })
      const data = await res.json()
      if (data.success) setSubmitted(true)
      else setError(data.error || 'Submission failed')
    } catch {
      setError('Network error')
    }
    setSubmitting(false)
  }

  const steps = [
    { num: 1, label: 'Personal', icon: User },
    { num: 2, label: 'Medical', icon: Heart },
    { num: 3, label: 'Dental', icon: Stethoscope },
    { num: 4, label: 'Emergency', icon: Shield }
  ]

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-teal-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#2D9DA8]" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-teal-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
          <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-800 mb-2">{error.includes('already') ? 'Already Submitted' : 'Link Error'}</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <Link href="/" className="text-[#2D9DA8] font-medium hover:underline">Back to SwiftCare</Link>
        </div>
      </div>
    )
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-teal-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">Thank You!</h2>
          <p className="text-gray-600 mb-6">Your intake form has been submitted successfully. Our staff will review it before your visit.</p>
          <Link href="/" className="inline-flex items-center gap-2 bg-[#2D9DA8] text-white px-6 py-3 rounded-xl font-medium hover:bg-[#258a93]">
            <Home className="w-4 h-4" /> Back to Home
          </Link>
        </div>
      </div>
    )
  }

  const isStep1Valid = fullName.trim().length >= 2 && mobileNumber.replace(/[^0-9]/g, '').length >= 10

  const inputClass = "w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[#2D9DA8]/30 focus:border-[#2D9DA8] outline-none transition-colors bg-white"
  const labelClass = "block text-sm font-medium text-gray-700 mb-1"

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-teal-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center gap-3">
          <div className="relative w-10 h-10">
            <Image src="/clinic/logo.png" alt="SwiftCare" fill className="object-contain" />
          </div>
          <div>
            <h1 className="font-bold text-gray-800">Patient Intake Form</h1>
            <p className="text-xs text-gray-500">
              {intake?.appointmentType ? `For: ${intake.appointmentType}` : 'SwiftCare Dental Clinic'}
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6">
        {/* Step Indicator */}
        <div className="flex items-center justify-between mb-6">
          {steps.map((s, idx) => {
            const Icon = s.icon
            const isActive = step === s.num
            const isDone = step > s.num
            return (
              <div key={s.num} className="flex items-center flex-1">
                <div className="flex flex-col items-center">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                    isDone ? 'bg-[#22B573] text-white' : isActive ? 'bg-[#2D9DA8] text-white ring-2 ring-[#2D9DA8]/30' : 'bg-gray-200 text-gray-400'
                  }`}>
                    {isDone ? <CheckCircle className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                  </div>
                  <span className={`text-[10px] mt-1 font-medium ${isActive ? 'text-[#2D9DA8]' : isDone ? 'text-[#22B573]' : 'text-gray-400'}`}>{s.label}</span>
                </div>
                {idx < steps.length - 1 && (
                  <div className={`flex-1 h-0.5 mx-2 mt-[-12px] ${isDone ? 'bg-[#22B573]' : 'bg-gray-200'}`} />
                )}
              </div>
            )
          })}
        </div>

        <div className="bg-white rounded-2xl shadow-sm border p-6">
          {/* Step 1: Personal Info */}
          {step === 1 && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-gray-800">Personal Information</h2>
              <p className="text-sm text-gray-500">Please provide your basic contact details.</p>
              <div>
                <label className={labelClass}>Full Name *</label>
                <input className={inputClass} value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Juan Dela Cruz" />
              </div>
              <div>
                <label className={labelClass}>Mobile Number *</label>
                <input className={inputClass} value={mobileNumber} onChange={e => setMobileNumber(e.target.value)} placeholder="09XX XXX XXXX" />
              </div>
              <div>
                <label className={labelClass}>Email Address</label>
                <input className={inputClass} type="email" value={emailAddress} onChange={e => setEmailAddress(e.target.value)} placeholder="your@email.com" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Date of Birth</label>
                  <input className={inputClass} type="date" value={dateOfBirth} onChange={e => setDateOfBirth(e.target.value)} />
                </div>
                <div>
                  <label className={labelClass}>Gender</label>
                  <select className={inputClass} value={gender} onChange={e => setGender(e.target.value)}>
                    <option value="">Select</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>
              <div>
                <label className={labelClass}>Address</label>
                <input className={inputClass} value={address} onChange={e => setAddress(e.target.value)} placeholder="Street, City, Province" />
              </div>
            </div>
          )}

          {/* Step 2: Medical History */}
          {step === 2 && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-gray-800">Medical History</h2>
              <p className="text-sm text-gray-500">This helps us provide safe and appropriate treatment.</p>
              <div>
                <label className={labelClass}>Medical Conditions</label>
                <textarea className={inputClass} rows={3} value={medicalHistory} onChange={e => setMedicalHistory(e.target.value)} placeholder="e.g., Diabetes, Hypertension, Heart Disease, Asthma..." />
              </div>
              <div>
                <label className={labelClass}>Allergies</label>
                <textarea className={inputClass} rows={2} value={allergies} onChange={e => setAllergies(e.target.value)} placeholder="e.g., Penicillin, Latex, Anesthesia..." />
              </div>
              <div>
                <label className={labelClass}>Current Medications</label>
                <textarea className={inputClass} rows={2} value={currentMedications} onChange={e => setCurrentMedications(e.target.value)} placeholder="List any medications you are currently taking" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Blood Pressure</label>
                  <input className={inputClass} value={bloodPressure} onChange={e => setBloodPressure(e.target.value)} placeholder="e.g., 120/80" />
                </div>
                <div>
                  <label className={labelClass}>Pregnancy Status</label>
                  <select className={inputClass} value={pregnancyStatus} onChange={e => setPregnancyStatus(e.target.value)}>
                    <option value="">N/A</option>
                    <option value="not_pregnant">Not Pregnant</option>
                    <option value="pregnant">Pregnant</option>
                    <option value="possibly">Possibly</option>
                    <option value="nursing">Nursing</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Dental Info */}
          {step === 3 && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-gray-800">Dental Information</h2>
              <p className="text-sm text-gray-500">Help us understand your dental needs.</p>
              <div>
                <label className={labelClass}>Chief Complaint / Reason for Visit *</label>
                <textarea className={inputClass} rows={3} value={chiefComplaint} onChange={e => setChiefComplaint(e.target.value)} placeholder="Describe your main concern or reason for this visit..." />
              </div>
              <div>
                <label className={labelClass}>Dental Anxieties or Concerns</label>
                <textarea className={inputClass} rows={2} value={dentalAnxieties} onChange={e => setDentalAnxieties(e.target.value)} placeholder="e.g., Fear of needles, gag reflex, previous bad experience..." />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Last Dental Visit</label>
                  <select className={inputClass} value={lastDentalVisit} onChange={e => setLastDentalVisit(e.target.value)}>
                    <option value="">Select</option>
                    <option value="less_6_months">Less than 6 months</option>
                    <option value="6_12_months">6-12 months</option>
                    <option value="1_2_years">1-2 years</option>
                    <option value="more_2_years">More than 2 years</option>
                    <option value="never">First time</option>
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Previous Dentist</label>
                  <input className={inputClass} value={previousDentist} onChange={e => setPreviousDentist(e.target.value)} placeholder="Name of previous dentist" />
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Emergency Contact */}
          {step === 4 && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-gray-800">Emergency Contact</h2>
              <p className="text-sm text-gray-500">In case we need to reach someone during your visit.</p>
              <div>
                <label className={labelClass}>Contact Name</label>
                <input className={inputClass} value={emergencyName} onChange={e => setEmergencyName(e.target.value)} placeholder="Full name of emergency contact" />
              </div>
              <div>
                <label className={labelClass}>Contact Phone</label>
                <input className={inputClass} value={emergencyPhone} onChange={e => setEmergencyPhone(e.target.value)} placeholder="09XX XXX XXXX" />
              </div>
              <div>
                <label className={labelClass}>Relationship</label>
                <select className={inputClass} value={emergencyRelation} onChange={e => setEmergencyRelation(e.target.value)}>
                  <option value="">Select</option>
                  <option value="spouse">Spouse</option>
                  <option value="parent">Parent</option>
                  <option value="sibling">Sibling</option>
                  <option value="child">Child</option>
                  <option value="friend">Friend</option>
                  <option value="other">Other</option>
                </select>
              </div>

              {/* Review Summary */}
              <div className="mt-6 bg-gray-50 rounded-xl p-4">
                <h3 className="font-semibold text-sm text-gray-700 mb-2">Review Summary</h3>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between"><span className="text-gray-500">Name</span><span className="font-medium">{fullName || '—'}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Mobile</span><span className="font-medium">{mobileNumber || '—'}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Allergies</span><span className="font-medium text-red-600">{allergies || 'None'}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Chief Complaint</span><span className="font-medium truncate max-w-[200px]">{chiefComplaint || '—'}</span></div>
                </div>
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between mt-6 pt-4 border-t">
            {step > 1 ? (
              <button
                onClick={() => setStep((step - 1) as Step)}
                className="flex items-center gap-1 text-gray-600 font-medium text-sm hover:text-gray-800"
              >
                <ChevronLeft className="w-4 h-4" /> Back
              </button>
            ) : <div />}

            {step < 4 ? (
              <button
                onClick={() => setStep((step + 1) as Step)}
                disabled={step === 1 && !isStep1Valid}
                className={`flex items-center gap-1 px-6 py-2.5 rounded-xl font-medium text-sm transition-colors ${
                  step === 1 && !isStep1Valid
                    ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    : 'bg-[#2D9DA8] text-white hover:bg-[#258a93]'
                }`}
              >
                Next <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={submitting || !isStep1Valid}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-medium text-sm bg-[#22B573] text-white hover:bg-[#1da066] disabled:opacity-50"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                Submit Intake Form
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

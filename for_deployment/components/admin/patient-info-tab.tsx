'use client'

import { useState, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { useSession } from '@/components/auth/custom-session-provider'
import {
  Edit, Save, Loader2, Phone, Mail, MapPin, Shield, CheckCircle, Clock, UserCheck, ChevronRight
} from 'lucide-react'
import { format, parseISO, formatDistanceToNow } from 'date-fns'
import MissingDataCard from '@/components/patient/missing-data-card'
import SocialMediaSection from './social-media-section'

interface PatientInfoTabProps {
  patient: any
  patientId: string
  procedures: any[]
  visits: any[]
  uploads: any[]
  onRefresh: () => void
}

const PROFILE_FIELDS = [
  'fullName', 'dateOfBirth', 'gender', 'mobileNumber', 'emailDirect',
  'address', 'city', 'state', 'zipCode', 'nationality', 'occupation',
  'emergencyContactName', 'emergencyContactPhone', 'emergencyContactRelationship',
  'insuranceProvider', 'insurancePolicyNumber'
]

export default function PatientInfoTab({ patient, patientId, procedures, visits, uploads, onRefresh }: PatientInfoTabProps) {
  const { toast } = useToast()
  const { data: session } = useSession() || {}
  const [editingProfile, setEditingProfile] = useState(false)
  const [savingProfile, setSavingProfile] = useState(false)
  const [profileForm, setProfileForm] = useState<any>({})

  const completeness = useMemo(() => {
    const filled = PROFILE_FIELDS.filter(f => {
      const val = (patient as any)?.[f]
      return val && val.toString().trim() !== ''
    }).length
    return Math.round((filled / PROFILE_FIELDS.length) * 100)
  }, [patient])

  const openEditProfile = () => {
    setProfileForm({
      fullName: patient.fullName || '',
      middleName: patient.middleName || '',
      preferredName: patient.preferredName || '',
      dateOfBirth: patient.dateOfBirth ? patient.dateOfBirth.slice(0, 10) : '',
      gender: patient.gender || 'none',
      mobileNumber: patient.mobileNumber || '',
      emailDirect: patient.emailDirect || '',
      address: patient.address || '',
      city: patient.city || '',
      state: patient.state || '',
      province: patient.province || '',
      zipCode: patient.zipCode || '',
      nationality: patient.nationality || '',
      civilStatus: patient.civilStatus || 'none',
      religion: patient.religion || '',
      occupation: patient.occupation || '',
      preferredLanguage: patient.preferredLanguage || 'English',
      communicationPreference: patient.communicationPreference || 'none',
      emergencyContactName: patient.emergencyContactName || '',
      emergencyContactPhone: patient.emergencyContactPhone || '',
      emergencyContactRelationship: patient.emergencyContactRelationship || '',
      insuranceProvider: patient.insuranceProvider || '',
      insurancePolicyNumber: patient.insurancePolicyNumber || '',
      insuranceGroupNumber: patient.insuranceGroupNumber || '',
      validIdType: patient.validIdType || '',
      validIdNumber: patient.validIdNumber || '',
    })
    setEditingProfile(true)
  }

  const handleSaveProfile = async () => {
    setSavingProfile(true)
    try {
      const payload: any = { ...profileForm, _updateSection: 'profile' }
      if (payload.gender === 'none') payload.gender = null
      if (payload.civilStatus === 'none') payload.civilStatus = null
      if (payload.communicationPreference === 'none') payload.communicationPreference = null
      if (payload.dateOfBirth === '') payload.dateOfBirth = null
      else if (payload.dateOfBirth) payload.dateOfBirth = new Date(payload.dateOfBirth).toISOString()

      const res = await fetch(`/api/patients/${patientId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (data.success) {
        toast({ title: 'Profile updated successfully' })
        setEditingProfile(false)
        onRefresh()
      } else {
        toast({ title: 'Error', description: data.error, variant: 'destructive' })
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to save profile', variant: 'destructive' })
    }
    setSavingProfile(false)
  }

  const getAge = (dob: string | null) => {
    if (!dob) return null
    const birth = new Date(dob)
    const diff = Date.now() - birth.getTime()
    return Math.floor(diff / 31557600000)
  }

  const age = getAge(patient.dateOfBirth)

  // Molarsoft-style row component
  const InfoRow = ({ label, value, className = '' }: { label: string; value: string | null | undefined; className?: string }) => (
    <div className={`flex items-start py-2.5 border-b border-gray-100 last:border-0 ${className}`}>
      <span className="text-xs font-medium text-gray-500 w-36 shrink-0 pt-0.5">{label}</span>
      <span className="text-sm text-gray-900 flex-1">{value || <span className="text-gray-300 italic">Not provided</span>}</span>
    </div>
  )

  return (
    <div className="space-y-5">
      <MissingDataCard patient={patient as any} onRefresh={onRefresh} />

      {/* Header Bar — Molarsoft style */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-base font-semibold text-gray-800">Patient Information</h2>
          {/* Completeness indicator */}
          <div className="flex items-center gap-1.5 bg-gray-50 px-2.5 py-1 rounded-full">
            <div className="relative w-5 h-5">
              <svg viewBox="0 0 36 36" className="w-5 h-5 -rotate-90">
                <circle cx="18" cy="18" r="15.9" fill="none" stroke="#e5e7eb" strokeWidth="3" />
                <circle cx="18" cy="18" r="15.9" fill="none" stroke={completeness >= 80 ? '#22c55e' : completeness >= 50 ? '#f59e0b' : '#ef4444'}
                  strokeWidth="3" strokeDasharray={`${completeness}, 100`} strokeLinecap="round" />
              </svg>
            </div>
            <span className="text-[10px] font-medium text-gray-500">{completeness}%</span>
          </div>
          {patient.lastUpdatedByName && (
            <span className="text-[10px] text-gray-400 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              Updated by {patient.lastUpdatedByName}
              {patient.updatedAt && ` \u2022 ${formatDistanceToNow(parseISO(patient.updatedAt), { addSuffix: true })}`}
            </span>
          )}
        </div>
        <Button size="sm" variant="outline" className="text-xs gap-1.5" onClick={openEditProfile}>
          <Edit className="w-3 h-3" /> Edit
        </Button>
      </div>

      {/* Main Content — Molarsoft-style flat sections */}
      <div className="bg-white rounded-lg border shadow-sm">
        {/* Personal Information */}
        <div className="px-5 pt-4 pb-1">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Personal</h3>
        </div>
        <div className="px-5 pb-3">
          <InfoRow label="Full Name" value={patient.fullName} />
          {patient.preferredName && <InfoRow label="Preferred Name" value={patient.preferredName} />}
          <InfoRow label="Date of Birth" value={patient.dateOfBirth ? `${format(parseISO(patient.dateOfBirth), 'MMMM d, yyyy')}${age !== null ? ` (${age} years old)` : ''}` : null} />
          <InfoRow label="Gender" value={patient.gender ? patient.gender.charAt(0).toUpperCase() + patient.gender.slice(1) : null} />
          <InfoRow label="Civil Status" value={patient.civilStatus ? patient.civilStatus.charAt(0).toUpperCase() + patient.civilStatus.slice(1) : null} />
          <InfoRow label="Nationality" value={patient.nationality} />
          <InfoRow label="Religion" value={patient.religion} />
          <InfoRow label="Occupation" value={patient.occupation} />
          <InfoRow label="Language" value={patient.preferredLanguage || 'English'} />
          <InfoRow label="Patient Since" value={format(parseISO(patient.createdAt), 'MMMM d, yyyy')} />
        </div>

        {/* Contact */}
        <div className="border-t">
          <div className="px-5 pt-4 pb-1">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Contact</h3>
          </div>
          <div className="px-5 pb-3">
            <div className="flex items-start py-2.5 border-b border-gray-100">
              <span className="text-xs font-medium text-gray-500 w-36 shrink-0 pt-0.5">Phone</span>
              <span className="text-sm text-gray-900 flex items-center gap-1.5">
                <Phone className="w-3 h-3 text-gray-400" />
                {patient.mobileNumber || patient.user?.phone || <span className="text-gray-300 italic">Not provided</span>}
              </span>
            </div>
            <div className="flex items-start py-2.5 border-b border-gray-100">
              <span className="text-xs font-medium text-gray-500 w-36 shrink-0 pt-0.5">Email</span>
              <span className="text-sm text-gray-900 flex items-center gap-1.5">
                <Mail className="w-3 h-3 text-gray-400" />
                {patient.emailDirect || patient.user?.email || <span className="text-gray-300 italic">Not provided</span>}
              </span>
            </div>
            <InfoRow label="Address" value={[patient.address, patient.city, patient.province, patient.state, patient.zipCode].filter(Boolean).join(', ') || null} />
            <InfoRow label="Communication" value={patient.communicationPreference ? patient.communicationPreference.charAt(0).toUpperCase() + patient.communicationPreference.slice(1) : null} />
          </div>
        </div>

        {/* Emergency Contact */}
        <div className="border-t">
          <div className="px-5 pt-4 pb-1">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
              <UserCheck className="w-3 h-3" /> Emergency Contact
            </h3>
          </div>
          <div className="px-5 pb-3">
            <InfoRow label="Name" value={patient.emergencyContactName} />
            <InfoRow label="Phone" value={patient.emergencyContactPhone} />
            <InfoRow label="Relationship" value={patient.emergencyContactRelationship} />
          </div>
        </div>

        {/* Insurance & ID */}
        <div className="border-t">
          <div className="px-5 pt-4 pb-1">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
              <Shield className="w-3 h-3" /> Insurance & ID
            </h3>
          </div>
          <div className="px-5 pb-3">
            <InfoRow label="Provider" value={patient.insuranceProvider} />
            <InfoRow label="Policy Number" value={patient.insurancePolicyNumber} />
            {patient.insuranceGroupNumber && <InfoRow label="Group Number" value={patient.insuranceGroupNumber} />}
            <InfoRow label="Valid ID" value={patient.validIdType ? `${patient.validIdType}: ${patient.validIdNumber || 'N/A'}` : null} />
          </div>
        </div>

        {/* Social Media */}
        <div className="border-t">
          <div className="px-5 py-4">
            <SocialMediaSection patient={patient} patientId={patientId} onRefresh={onRefresh} />
          </div>
        </div>

        {/* Activity Summary */}
        <div className="border-t">
          <div className="px-5 py-4">
            <div className="flex items-center gap-6">
              <div className="text-center">
                <p className="text-lg font-bold text-[#5B5FC7]">{patient.appointments?.length || 0}</p>
                <p className="text-[10px] text-gray-400">Appointments</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-[#5B5FC7]">{procedures.length}</p>
                <p className="text-[10px] text-gray-400">Procedures</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-[#5B5FC7]">{visits.length}</p>
                <p className="text-[10px] text-gray-400">Visits</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-[#5B5FC7]">{uploads.length}</p>
                <p className="text-[10px] text-gray-400">Documents</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Signature */}
      {patient.patientSignature && (
        <div className="bg-white rounded-lg border shadow-sm px-5 py-3 flex items-center gap-4">
          <div>
            <p className="text-sm font-medium text-green-700 flex items-center gap-1.5"><CheckCircle className="w-4 h-4" /> Signature on File</p>
            {patient.patientSignedAt && <p className="text-[10px] text-gray-400">Captured {format(parseISO(patient.patientSignedAt), 'MMM d, yyyy h:mm a')}</p>}
          </div>
          <img src={patient.patientSignature} alt="Patient signature" className="h-10 max-w-[180px] object-contain border rounded bg-gray-50 px-2" />
        </div>
      )}

      {/* Edit Profile Dialog — kept as-is for full editing */}
      <Dialog open={editingProfile} onOpenChange={setEditingProfile}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Patient Profile</DialogTitle>
            <DialogDescription>Update patient demographic and contact information.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2"><Label className="text-xs">Full Name</Label><Input value={profileForm.fullName} onChange={e => setProfileForm({ ...profileForm, fullName: e.target.value })} placeholder="Last Name, First Name" /></div>
            <div><Label className="text-xs">Middle Name</Label><Input value={profileForm.middleName} onChange={e => setProfileForm({ ...profileForm, middleName: e.target.value })} /></div>
            <div><Label className="text-xs">Preferred Name</Label><Input value={profileForm.preferredName} onChange={e => setProfileForm({ ...profileForm, preferredName: e.target.value })} /></div>
            <div><Label className="text-xs">Date of Birth</Label><Input type="date" value={profileForm.dateOfBirth} onChange={e => setProfileForm({ ...profileForm, dateOfBirth: e.target.value })} /></div>
            <div><Label className="text-xs">Gender</Label>
              <Select value={profileForm.gender || 'none'} onValueChange={v => setProfileForm({ ...profileForm, gender: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Not specified</SelectItem>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs">Civil Status</Label>
              <Select value={profileForm.civilStatus || 'none'} onValueChange={v => setProfileForm({ ...profileForm, civilStatus: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Not specified</SelectItem>
                  <SelectItem value="single">Single</SelectItem>
                  <SelectItem value="married">Married</SelectItem>
                  <SelectItem value="widowed">Widowed</SelectItem>
                  <SelectItem value="separated">Separated</SelectItem>
                  <SelectItem value="divorced">Divorced</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs">Nationality</Label><Input value={profileForm.nationality} onChange={e => setProfileForm({ ...profileForm, nationality: e.target.value })} /></div>
            <div><Label className="text-xs">Religion</Label><Input value={profileForm.religion} onChange={e => setProfileForm({ ...profileForm, religion: e.target.value })} /></div>
            <div><Label className="text-xs">Occupation</Label><Input value={profileForm.occupation} onChange={e => setProfileForm({ ...profileForm, occupation: e.target.value })} /></div>
            <div><Label className="text-xs">Language</Label><Input value={profileForm.preferredLanguage} onChange={e => setProfileForm({ ...profileForm, preferredLanguage: e.target.value })} /></div>
            <div className="sm:col-span-2 border-t pt-3 mt-1" />
            <div><Label className="text-xs">Mobile Number</Label><Input value={profileForm.mobileNumber} onChange={e => setProfileForm({ ...profileForm, mobileNumber: e.target.value })} /></div>
            <div><Label className="text-xs">Email</Label><Input type="email" value={profileForm.emailDirect} onChange={e => setProfileForm({ ...profileForm, emailDirect: e.target.value })} /></div>
            <div><Label className="text-xs">Communication Preference</Label>
              <Select value={profileForm.communicationPreference || 'none'} onValueChange={v => setProfileForm({ ...profileForm, communicationPreference: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Not specified</SelectItem>
                  <SelectItem value="sms">SMS</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="phone">Phone Call</SelectItem>
                  <SelectItem value="whatsapp">WhatsApp</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2 border-t pt-3 mt-1" />
            <div className="sm:col-span-2"><Label className="text-xs">Address</Label><Input value={profileForm.address} onChange={e => setProfileForm({ ...profileForm, address: e.target.value })} /></div>
            <div><Label className="text-xs">City</Label><Input value={profileForm.city} onChange={e => setProfileForm({ ...profileForm, city: e.target.value })} /></div>
            <div><Label className="text-xs">Province</Label><Input value={profileForm.province} onChange={e => setProfileForm({ ...profileForm, province: e.target.value })} /></div>
            <div><Label className="text-xs">State / Region</Label><Input value={profileForm.state} onChange={e => setProfileForm({ ...profileForm, state: e.target.value })} /></div>
            <div><Label className="text-xs">Zip Code</Label><Input value={profileForm.zipCode} onChange={e => setProfileForm({ ...profileForm, zipCode: e.target.value })} /></div>
            <div className="sm:col-span-2 border-t pt-3 mt-1" />
            <div><Label className="text-xs">Emergency Contact Name</Label><Input value={profileForm.emergencyContactName} onChange={e => setProfileForm({ ...profileForm, emergencyContactName: e.target.value })} /></div>
            <div><Label className="text-xs">Emergency Contact Phone</Label><Input value={profileForm.emergencyContactPhone} onChange={e => setProfileForm({ ...profileForm, emergencyContactPhone: e.target.value })} /></div>
            <div><Label className="text-xs">Relationship</Label><Input value={profileForm.emergencyContactRelationship} onChange={e => setProfileForm({ ...profileForm, emergencyContactRelationship: e.target.value })} /></div>
            <div className="sm:col-span-2 border-t pt-3 mt-1" />
            <div><Label className="text-xs">Insurance Provider</Label><Input value={profileForm.insuranceProvider} onChange={e => setProfileForm({ ...profileForm, insuranceProvider: e.target.value })} /></div>
            <div><Label className="text-xs">Policy Number</Label><Input value={profileForm.insurancePolicyNumber} onChange={e => setProfileForm({ ...profileForm, insurancePolicyNumber: e.target.value })} /></div>
            <div><Label className="text-xs">Group Number</Label><Input value={profileForm.insuranceGroupNumber} onChange={e => setProfileForm({ ...profileForm, insuranceGroupNumber: e.target.value })} /></div>
            <div className="sm:col-span-2 border-t pt-3 mt-1" />
            <div><Label className="text-xs">Valid ID Type</Label><Input value={profileForm.validIdType} onChange={e => setProfileForm({ ...profileForm, validIdType: e.target.value })} placeholder="e.g. PhilHealth, SSS" /></div>
            <div><Label className="text-xs">Valid ID Number</Label><Input value={profileForm.validIdNumber} onChange={e => setProfileForm({ ...profileForm, validIdNumber: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingProfile(false)}>Cancel</Button>
            <Button onClick={handleSaveProfile} disabled={savingProfile} className="bg-[#5B5FC7] hover:bg-[#4B4FB7]">
              {savingProfile ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />} Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

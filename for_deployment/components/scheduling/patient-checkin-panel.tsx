'use client'

import { formatPatientName, formatDentistName, copyToClipboard as safeCopyToClipboard } from '@/lib/utils'
import { useState, useEffect, useCallback } from 'react'
import { useSession } from '@/components/auth/custom-session-provider'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import QRCode from 'react-qr-code'
import {
  UserCheck, Search, Clock, User, Calendar, Copy, Check, FileText, Plus, Loader2,
  CheckCircle, AlertCircle, ExternalLink, ShieldAlert, RefreshCw, QrCode, Trash2
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from '@/components/ui/dialog'

interface FormTemplate {
  id: string
  title: string
  description: string
  category: string
  fields: any[]
  requiredAlways?: boolean
  requiredForAppointmentTypes?: string[] | null
}

interface AppointmentForm {
  id: string
  title: string
  status: string
  isSigned?: boolean
  patientSignature?: string | null
  patientSignedAt?: string | null
}

interface AppointmentForCheckIn {
  id: string
  scheduledDatetime: string
  appointmentType: string
  status: string
  reasonForVisit: string
  patient: {
    fullName?: string | null
    emailDirect?: string | null
    mobileNumber?: string | null
    id: string
    user?: {
      firstName: string
      lastName: string
      email: string
      phone?: string
    }
  }
  dentist?: {
    user?: {
      firstName: string
      lastName: string
    } | null
  } | null
}

interface FormsStatus {
  forms: AppointmentForm[]
  signingUrl: string | null
  signedCount: number
  totalCount: number
  allSigned: boolean
}

export function PatientCheckInPanel() {
  const { data: session } = useSession() || {}
  const { toast } = useToast()

  const [searchTerm, setSearchTerm] = useState('')
  const [todayAppointments, setTodayAppointments] = useState<AppointmentForCheckIn[]>([])
  const [filteredAppointments, setFilteredAppointments] = useState<AppointmentForCheckIn[]>([])
  const [loading, setLoading] = useState(true)

  const [formTemplates, setFormTemplates] = useState<FormTemplate[]>([])
  const [formsStatusMap, setFormsStatusMap] = useState<Record<string, FormsStatus>>({})
  const [loadingStatusId, setLoadingStatusId] = useState<string | null>(null)
  const [autoLoading, setAutoLoading] = useState<string | null>(null)

  const [copied, setCopied] = useState<string | null>(null)

  const [addFormDialogAppointment, setAddFormDialogAppointment] = useState<AppointmentForCheckIn | null>(null)
  const [selectedExtraIds, setSelectedExtraIds] = useState<string[]>([])
  const [savingExtras, setSavingExtras] = useState(false)

  const [overrideAppointment, setOverrideAppointment] = useState<AppointmentForCheckIn | null>(null)

  const [qrAppointment, setQrAppointment] = useState<AppointmentForCheckIn | null>(null)
  const [qrUrl, setQrUrl] = useState<string>('')

  const canOverride = session?.user && ['admin', 'super_admin'].includes(session.user.role)

  useEffect(() => {
    fetch('/api/checkin-forms?templates=true')
      .then((r) => r.json())
      .then((data) => setFormTemplates(data.templates || []))
      .catch((err) => console.error('Error fetching templates:', err))
  }, [])

  const fetchAppointments = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/appointments?date=today&status=confirmed,scheduled,waiting,pending,checked_in')
      if (response.ok) {
        const data = await response.json()
        const appointments = data.data?.appointments || []
        setTodayAppointments(appointments)
        setFilteredAppointments(appointments)
      }
    } catch (error) {
      console.error('Error fetching appointments:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (session?.user && ['receptionist', 'staff', 'admin', 'super_admin', 'manager', 'dentist'].includes(session.user.role)) {
      fetchAppointments()
    }
  }, [session, fetchAppointments])

  const loadFormsStatus = useCallback(async (appointmentId: string) => {
    try {
      const res = await fetch(`/api/checkin-forms?appointmentId=${appointmentId}`)
      if (!res.ok) return
      const data = await res.json()
      setFormsStatusMap((prev) => ({
        ...prev,
        [appointmentId]: {
          forms: data.forms || [],
          signingUrl: data.signingUrl || null,
          signedCount: data.signedCount || 0,
          totalCount: data.totalCount || 0,
          allSigned: !!data.allSigned,
        },
      }))
    } catch (err) {
      console.error('Error loading forms status:', err)
    }
  }, [])

  useEffect(() => {
    if (loading) return
    const toLoad = todayAppointments.filter((a) => a.status !== 'completed' && !formsStatusMap[a.id])
    toLoad.forEach((a) => {
      loadFormsStatus(a.id)
    })
  }, [loading, todayAppointments, formsStatusMap, loadFormsStatus])

  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredAppointments(todayAppointments)
    } else {
      const filtered = todayAppointments.filter((a) => {
        const name = formatPatientName(a.patient.fullName, a.patient.user?.firstName, a.patient.user?.lastName, '').toLowerCase()
        const email = (a.patient.user?.email || a.patient.emailDirect || '').toLowerCase()
        const phone = (a.patient.user?.phone || a.patient.mobileNumber || '').toLowerCase()
        const search = searchTerm.toLowerCase()
        return name.includes(search) || email.includes(search) || phone.includes(search)
      })
      setFilteredAppointments(filtered)
    }
  }, [searchTerm, todayAppointments])

  const handleAutoAssignForms = async (appointment: AppointmentForCheckIn) => {
    setAutoLoading(appointment.id)
    try {
      const res = await fetch('/api/checkin-forms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appointmentId: appointment.id, auto: true }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to assign forms')
      if (data.message) {
        toast({ title: 'Forms already signed', description: data.message })
      } else {
        toast({ title: 'Forms ready', description: `${data.formsCount} form(s) prepared. Share the link with the patient.` })
      }
      await loadFormsStatus(appointment.id)
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to prepare forms', variant: 'destructive' })
    } finally {
      setAutoLoading(null)
    }
  }

  const handleCopyLink = async (id: string, url: string) => {
    await safeCopyToClipboard(url)
    setCopied(id)
    setTimeout(() => setCopied(null), 2000)
    toast({ title: 'Link copied', description: 'Share this with the patient' })
  }

  const handleRefreshStatus = async (id: string) => {
    setLoadingStatusId(id)
    await loadFormsStatus(id)
    setLoadingStatusId(null)
  }

  const openAddExtraFormDialog = (appointment: AppointmentForCheckIn) => {
    setAddFormDialogAppointment(appointment)
    setSelectedExtraIds([])
  }

  const submitExtraForms = async () => {
    if (!addFormDialogAppointment) return
    if (selectedExtraIds.length === 0) {
      toast({ title: 'Select forms', description: 'Pick at least one form to add.', variant: 'destructive' })
      return
    }
    setSavingExtras(true)
    try {
      const existingForms = formsStatusMap[addFormDialogAppointment.id]?.forms || []
      const existingKeys = existingForms
        .filter((f) => !f.patientSignature)
        .map((f) => {
          const t = formTemplates.find((tm) => tm.title === f.title)
          return t?.id
        })
        .filter(Boolean) as string[]

      const uniqueTemplateIds = Array.from(new Set([...existingKeys, ...selectedExtraIds]))

      const res = await fetch('/api/checkin-forms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appointmentId: addFormDialogAppointment.id, templateIds: uniqueTemplateIds }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Failed to add forms')
      }
      toast({ title: 'Added', description: 'Forms added successfully' })
      setAddFormDialogAppointment(null)
      setSelectedExtraIds([])
      await loadFormsStatus(addFormDialogAppointment.id)
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to add forms', variant: 'destructive' })
    } finally {
      setSavingExtras(false)
    }
  }

  const handleDeleteForm = async (appointmentId: string, formId: string, formTitle: string) => {
    try {
      const res = await fetch(`/api/checkin-forms?formId=${formId}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to delete form')
      }
      toast({ title: 'Form removed', description: `"${formTitle}" has been removed.` })
      await loadFormsStatus(appointmentId)
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to delete form', variant: 'destructive' })
    }
  }

  const handleCheckIn = async (appointmentId: string, patientName: string) => {
    try {
      const response = await fetch(`/api/appointments/${appointmentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'checked_in' }),
      })
      if (response.ok) {
        toast({ title: 'Patient Checked In', description: `${patientName} has been successfully checked in.` })
        setTodayAppointments((apts) => apts.map((a) => (a.id === appointmentId ? { ...a, status: 'checked_in' } : a)))
      } else {
        throw new Error('Failed to check in patient')
      }
    } catch (error) {
      console.error('Error checking in patient:', error)
      toast({ title: 'Check-in Failed', description: 'There was an error checking in the patient.', variant: 'destructive' })
    }
  }

  const getPatientName = (a: AppointmentForCheckIn) =>
    formatPatientName(a.patient.fullName, a.patient.user?.firstName, a.patient.user?.lastName)

  const formatTime = (dt: string) => new Date(dt).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' })

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { bg: string; text: string }> = {
      confirmed: { bg: 'bg-blue-100', text: 'text-blue-800' },
      scheduled: { bg: 'bg-gray-100', text: 'text-gray-800' },
      waiting: { bg: 'bg-amber-100', text: 'text-amber-800' },
      pending: { bg: 'bg-amber-100', text: 'text-amber-800' },
      checked_in: { bg: 'bg-green-100', text: 'text-green-800' },
      completed: { bg: 'bg-purple-100', text: 'text-purple-800' },
    }
    const v = variants[status] || { bg: 'bg-gray-100', text: 'text-gray-800' }
    return <Badge className={`${v.bg} ${v.text} border-0 capitalize`}>{status.replace(/_/g, ' ')}</Badge>
  }

  return (
    <div className="space-y-6">
      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by patient name, email, or phone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button variant="outline" onClick={fetchAppointments} className="gap-2">
              <RefreshCw className="w-4 h-4" /> Refresh
            </Button>
          </div>
          <div className="mt-4 text-sm text-muted-foreground flex items-center gap-4 flex-wrap">
            <span>Today: <strong>{todayAppointments.length}</strong></span>
            <span>Checked-in: <strong>{todayAppointments.filter((a) => a.status === 'checked_in').length}</strong></span>
            <span>Pending forms: <strong>{Object.values(formsStatusMap).filter((f) => !f.allSigned && f.totalCount > 0).length}</strong></span>
          </div>
        </CardContent>
      </Card>

      {/* Appointments */}
      {loading ? (
        <Card>
          <CardContent className="py-16 flex justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
      ) : filteredAppointments.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            <Calendar className="w-12 h-12 mx-auto mb-3 opacity-50" />
            No appointments for today.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredAppointments.map((appointment) => {
            const name = getPatientName(appointment)
            const isCheckedIn = appointment.status === 'checked_in'
            const status = formsStatusMap[appointment.id]
            const hasForms = status && status.totalCount > 0
            const allSigned = status?.allSigned

            return (
              <Card key={appointment.id} className={isCheckedIn ? 'bg-green-50/40 border-green-200' : ''}>
                <CardContent className="pt-5">
                  <div className="flex flex-col lg:flex-row gap-4 lg:items-start lg:justify-between">
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <User className="w-5 h-5 text-primary" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-semibold text-lg truncate">{name}</h3>
                          {getStatusBadge(appointment.status)}
                        </div>
                        <div className="text-sm text-muted-foreground mt-1 flex flex-wrap gap-x-4 gap-y-1">
                          <span className="inline-flex items-center gap-1">
                            <Clock className="w-3 h-3" /> {formatTime(appointment.scheduledDatetime)}
                          </span>
                          {appointment.appointmentType && (
                            <span className="capitalize">{appointment.appointmentType.replace(/_/g, ' ')}</span>
                          )}
                          {appointment.dentist?.user && (
                            <span>
                              {formatDentistName(appointment.dentist.user.firstName, appointment.dentist.user.lastName)}
                            </span>
                          )}
                          {(appointment.patient.user?.phone || appointment.patient.mobileNumber) && (
                            <span>{appointment.patient.user?.phone || appointment.patient.mobileNumber}</span>
                          )}
                        </div>
                        {appointment.reasonForVisit && (
                          <p className="text-sm mt-2 line-clamp-2 text-muted-foreground">
                            <span className="font-medium text-foreground">Reason: </span>
                            {appointment.reasonForVisit}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="lg:w-96 shrink-0 space-y-3">
                        <div className="border rounded-lg p-3 bg-background">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2 text-sm font-medium">
                              <FileText className="w-4 h-4 text-primary" />
                              <span>Forms</span>
                              {hasForms && (
                                <Badge variant="outline" className="text-xs">
                                  {status.signedCount} / {status.totalCount} signed
                                </Badge>
                              )}
                            </div>
                            <Button size="sm" variant="ghost" onClick={() => handleRefreshStatus(appointment.id)} disabled={loadingStatusId === appointment.id}>
                              {loadingStatusId === appointment.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                            </Button>
                          </div>

                          {!hasForms ? (
                            <div className="text-center py-3 space-y-2">
                              <p className="text-sm text-muted-foreground">No forms assigned yet</p>
                              <Button size="sm" onClick={() => handleAutoAssignForms(appointment)} disabled={autoLoading === appointment.id} className="w-full gap-2">
                                {autoLoading === appointment.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                                Prepare Required Forms
                              </Button>
                              <Button size="sm" variant="ghost" className="w-full text-xs" onClick={() => openAddExtraFormDialog(appointment)}>
                                <Plus className="w-3 h-3 mr-1" /> Choose Forms Manually
                              </Button>
                            </div>
                          ) : (
                            <div className="space-y-2">
                              <ul className="text-xs space-y-1">
                                {status.forms.map((f) => (
                                  <li key={f.id} className="flex items-center gap-2 group">
                                    {f.patientSignature ? (
                                      <CheckCircle className="w-3 h-3 text-green-600 shrink-0" />
                                    ) : (
                                      <AlertCircle className="w-3 h-3 text-amber-600 shrink-0" />
                                    )}
                                    <span className="truncate flex-1">{f.title}</span>
                                    {!f.patientSignature && (
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteForm(appointment.id, f.id, f.title)}
                                        className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-red-600 p-0.5 rounded"
                                        title="Remove this form"
                                      >
                                        <Trash2 className="w-3 h-3" />
                                      </button>
                                    )}
                                  </li>
                                ))}
                              </ul>

                              <div className="pt-2 border-t space-y-2">
                                {status.signingUrl && !allSigned && (
                                  <div className="grid grid-cols-3 gap-1">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="gap-1 text-xs"
                                      onClick={() => handleCopyLink(appointment.id, status.signingUrl!)}
                                    >
                                      {copied === appointment.id ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                                      <span className="truncate">{copied === appointment.id ? 'Copied' : 'Copy'}</span>
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="gap-1 text-xs"
                                      onClick={() => {
                                        setQrAppointment(appointment)
                                        setQrUrl(status.signingUrl!)
                                      }}
                                    >
                                      <QrCode className="w-3 h-3" />
                                      <span className="truncate">QR</span>
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="gap-1 text-xs"
                                      onClick={() => window.open(status.signingUrl!, '_blank')}
                                    >
                                      <ExternalLink className="w-3 h-3" />
                                      <span className="truncate">Open</span>
                                    </Button>
                                  </div>
                                )}
                                <Button size="sm" variant="ghost" className="w-full text-xs" onClick={() => openAddExtraFormDialog(appointment)}>
                                  <Plus className="w-3 h-3 mr-1" /> Add / Manage Forms
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>

                        {!isCheckedIn && (
                          <div>
                            {!hasForms ? (
                              <Button className="w-full gap-2" onClick={() => handleCheckIn(appointment.id, name)}>
                                <UserCheck className="w-4 h-4" /> Check In
                              </Button>
                            ) : allSigned ? (
                              <Button className="w-full gap-2" onClick={() => handleCheckIn(appointment.id, name)}>
                                <UserCheck className="w-4 h-4" /> Check In
                              </Button>
                            ) : (
                              <>
                                <Button className="w-full gap-2" disabled>
                                  <ShieldAlert className="w-4 h-4" /> Waiting for {status.totalCount - status.signedCount} form(s)
                                </Button>
                                {canOverride && (
                                  <Button variant="outline" size="sm" className="w-full mt-2 text-amber-700 hover:text-amber-800" onClick={() => setOverrideAppointment(appointment)}>
                                    Admin Override
                                  </Button>
                                )}
                              </>
                            )}
                          </div>
                        )}
                      </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Add extra form dialog */}
      <Dialog open={!!addFormDialogAppointment} onOpenChange={(o) => !o && setAddFormDialogAppointment(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Extra Forms</DialogTitle>
            <DialogDescription>
              Pick additional forms the patient should complete. Existing unsigned forms will be kept.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 max-h-[50vh] overflow-y-auto">
            {formTemplates.map((t) => {
              const checked = selectedExtraIds.includes(t.id)
              return (
                <label key={t.id} className="flex items-start gap-3 p-3 border rounded cursor-pointer hover:bg-muted/50">
                  <Checkbox
                    checked={checked}
                    onCheckedChange={(v) => {
                      setSelectedExtraIds((prev) => (v ? [...prev, t.id] : prev.filter((id) => id !== t.id)))
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm">{t.title}</div>
                    {t.description && <div className="text-xs text-muted-foreground mt-0.5">{t.description}</div>}
                    <Badge variant="outline" className="mt-1 text-xs">{t.category}</Badge>
                  </div>
                </label>
              )
            })}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddFormDialogAppointment(null)} disabled={savingExtras}>Cancel</Button>
            <Button onClick={submitExtraForms} disabled={savingExtras}>
              {savingExtras && <Loader2 className="w-3 h-3 animate-spin mr-2" />}
              Add Forms
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Override confirmation */}
      <Dialog open={!!overrideAppointment} onOpenChange={(o) => !o && setOverrideAppointment(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-700">
              <ShieldAlert className="w-5 h-5" /> Override Form Requirement?
            </DialogTitle>
            <DialogDescription>
              This patient has unsigned forms. Admin override allows immediate check-in without waiting for patient signatures. Use only when necessary (e.g. paper forms already collected). This is logged.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOverrideAppointment(null)}>Cancel</Button>
            <Button variant="default" className="bg-amber-600 hover:bg-amber-700 text-white" onClick={() => {
              if (overrideAppointment) {
                handleCheckIn(overrideAppointment.id, getPatientName(overrideAppointment))
                setOverrideAppointment(null)
              }
            }}>
              Override & Check In
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* QR Code Dialog */}
      <Dialog open={!!qrAppointment} onOpenChange={(o) => { if (!o) { setQrAppointment(null); setQrUrl('') } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <QrCode className="w-5 h-5 text-primary" /> Scan to Sign Forms
            </DialogTitle>
            <DialogDescription>
              {qrAppointment && (
                <>Let <strong>{getPatientName(qrAppointment)}</strong> scan this code with their phone to open the consent forms.</>
              )}
            </DialogDescription>
          </DialogHeader>
          {qrUrl && (
            <div className="flex flex-col items-center gap-4 py-2">
              <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                <QRCode value={qrUrl} size={220} bgColor="#ffffff" fgColor="#0f172a" level="M" />
              </div>
              <div className="w-full space-y-2">
                <p className="text-xs text-muted-foreground text-center break-all px-2">{qrUrl}</p>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 gap-1"
                    onClick={() => qrAppointment && handleCopyLink(qrAppointment.id, qrUrl)}
                  >
                    {qrAppointment && copied === qrAppointment.id ? (
                      <><Check className="w-3 h-3" /> Copied</>
                    ) : (
                      <><Copy className="w-3 h-3" /> Copy Link</>
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 gap-1"
                    onClick={() => window.open(qrUrl, '_blank')}
                  >
                    <ExternalLink className="w-3 h-3" /> Open
                  </Button>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setQrAppointment(null); setQrUrl('') }}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

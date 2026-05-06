'use client'

import { formatPatientName, formatDentistName } from '@/lib/utils'
import { useState, useEffect } from 'react'
import { useSession } from '@/components/auth/custom-session-provider'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import {
  Plus, Edit, Trash2, Search, Filter, Loader2, FileText,
  CheckCircle, Clock, AlertTriangle, X, Save, Users, Calendar
} from 'lucide-react'
import { format } from 'date-fns'
import { useConfirm } from '@/components/providers/confirm-provider'

interface TreatmentPlan {
  id: string
  title: string
  description: string | null
  status: string
  priority: string | null
  phases: any
  estimatedCost: number | null
  approvedCost: number | null
  actualCost: number | null
  diagnosis: string | null
  clinicalNotes: string | null
  completionPercentage: number
  createdAt: string
  updatedAt: string
  patient: { id: string; fullName: string | null; patientNumber: string } | null
  dentist: { id: string; user: { firstName: string; lastName: string } | null } | null
}

const statusColors: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  pending_approval: 'bg-yellow-100 text-yellow-700',
  approved: 'bg-blue-100 text-blue-700',
  in_progress: 'bg-[#2D9DA8]/10 text-[#2D9DA8]',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
  on_hold: 'bg-orange-100 text-orange-700',
}

const statusLabels: Record<string, string> = {
  draft: 'Draft',
  pending_approval: 'Pending Approval',
  approved: 'Approved',
  in_progress: 'In Progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
  on_hold: 'On Hold',
}

const priorityColors: Record<string, string> = {
  low: 'bg-gray-100 text-gray-600',
  medium: 'bg-blue-100 text-blue-700',
  high: 'bg-orange-100 text-orange-700',
  emergency: 'bg-red-100 text-red-700',
}

export default function AdminTreatmentPage() {
  const { data: session } = useSession() || {}
  const { confirm } = useConfirm()
  const [plans, setPlans] = useState<TreatmentPlan[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [selectedPlan, setSelectedPlan] = useState<TreatmentPlan | null>(null)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [patients, setPatients] = useState<{ id: string; fullName: string | null; patientNumber: string }[]>([])
  const [dentists, setDentists] = useState<{ id: string; user: { firstName: string; lastName: string } }[]>([])
  const [createForm, setCreateForm] = useState({
    patientId: '',
    dentistId: '',
    title: '',
    description: '',
    priority: 'medium',
    diagnosis: '',
    clinicalNotes: '',
    estimatedCost: ''
  })
  const [editForm, setEditForm] = useState({
    title: '',
    description: '',
    status: 'draft',
    priority: 'medium',
    diagnosis: '',
    clinicalNotes: '',
    estimatedCost: '',
    completionPercentage: 0
  })

  const fetchPlans = async () => {
    try {
      const params = new URLSearchParams()
      if (statusFilter !== 'all') params.set('status', statusFilter)
      const res = await fetch(`/api/treatment-plans?${params}`)
      if (res.ok) {
        const data = await res.json()
        setPlans(data.plans || [])
      }
    } catch (err) {
      console.error('Error fetching treatment plans:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPlans()
  }, [statusFilter])

  // Fetch patients and dentists for create form
  const fetchPatientsAndDentists = async () => {
    try {
      const [pRes, dRes] = await Promise.all([
        fetch('/api/patients?limit=100'),
        fetch('/api/dentists')
      ])
      if (pRes.ok) {
        const pData = await pRes.json()
        setPatients((pData.data?.patients || []).map((p: any) => ({
          id: p.id,
          fullName: formatPatientName(p.fullName, p.user?.firstName, p.user?.lastName, 'Unknown'),
          patientNumber: p.patientNumber
        })))
      }
      if (dRes.ok) {
        const dData = await dRes.json()
        setDentists(dData.data?.dentists || [])
      }
    } catch (err) {
      console.error('Error fetching patients/dentists:', err)
    }
  }

  const handleCreatePlan = async () => {
    if (!createForm.patientId || !createForm.title) return
    setSaving(true)
    try {
      const res = await fetch('/api/treatment-plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId: createForm.patientId,
          ...(createForm.dentistId ? { dentistId: createForm.dentistId } : {}),
          title: createForm.title,
          description: createForm.description,
          priority: createForm.priority,
          diagnosis: createForm.diagnosis,
          clinicalNotes: createForm.clinicalNotes,
          estimatedCost: createForm.estimatedCost ? parseFloat(createForm.estimatedCost) : null,
          phases: []
        })
      })
      if (res.ok) {
        setShowCreateForm(false)
        setCreateForm({ patientId: '', dentistId: '', title: '', description: '', priority: 'medium', diagnosis: '', clinicalNotes: '', estimatedCost: '' })
        await fetchPlans()
      } else {
        const err = await res.json()
        alert(err.error || 'Failed to create treatment plan')
      }
    } catch (err) {
      console.error('Error creating plan:', err)
      alert('Failed to create treatment plan')
    } finally {
      setSaving(false)
    }
  }

  const startEdit = (plan: TreatmentPlan) => {
    setSelectedPlan(plan)
    setEditForm({
      title: plan.title || '',
      description: plan.description || '',
      status: plan.status || 'draft',
      priority: plan.priority || 'medium',
      diagnosis: plan.diagnosis || '',
      clinicalNotes: plan.clinicalNotes || '',
      estimatedCost: plan.estimatedCost?.toString() || '',
      completionPercentage: plan.completionPercentage || 0
    })
    setEditing(true)
  }

  const savePlan = async () => {
    if (!selectedPlan) return
    setSaving(true)
    try {
      const res = await fetch('/api/treatment-plans', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedPlan.id,
          title: editForm.title,
          description: editForm.description,
          status: editForm.status,
          priority: editForm.priority,
          diagnosis: editForm.diagnosis,
          clinicalNotes: editForm.clinicalNotes,
          estimatedCost: editForm.estimatedCost ? parseFloat(editForm.estimatedCost) : null,
          completionPercentage: editForm.completionPercentage
        })
      })
      if (res.ok) {
        setEditing(false)
        setSelectedPlan(null)
        await fetchPlans()
      } else {
        const err = await res.json()
        alert(err.error || 'Failed to update plan')
      }
    } catch (err) {
      console.error('Error saving plan:', err)
      alert('Failed to save treatment plan')
    } finally {
      setSaving(false)
    }
  }

  const deletePlan = async (id: string) => {
    const ok = await confirm({
      title: 'Delete this treatment plan?',
      description: 'This treatment plan will be permanently removed. This action cannot be undone.',
      confirmLabel: 'Delete Plan',
      variant: 'destructive',
    })
    if (!ok) return
    try {
      const res = await fetch(`/api/treatment-plans?id=${id}`, { method: 'DELETE' })
      if (res.ok) {
        if (selectedPlan?.id === id) {
          setSelectedPlan(null)
          setEditing(false)
        }
        await fetchPlans()
      }
    } catch (err) {
      console.error('Error deleting plan:', err)
    }
  }

  const filteredPlans = plans.filter(plan => {
    if (!search) return true
    const s = search.toLowerCase()
    return (
      plan.title.toLowerCase().includes(s) ||
      plan.patient?.fullName?.toLowerCase().includes(s) ||
      plan.patient?.patientNumber?.toLowerCase().includes(s) ||
      plan.diagnosis?.toLowerCase().includes(s)
    )
  })

  // Only dentist, admin, super_admin can access treatment plans
  if (session?.user && !['dentist', 'admin', 'super_admin'].includes(session.user.role)) {
    return (
      <DashboardLayout title="Treatment Plans">
        <div className="text-center py-16">
          <p className="text-gray-600 text-lg">Access denied. Only dentists and administrators can manage treatment plans.</p>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout title="Treatment Plans">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Treatment Plans</h1>
            <p className="text-gray-600">Manage patient treatment plans and track progress</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search by patient name, number, or diagnosis..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="pending_approval">Pending Approval</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="on_hold">On Hold</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={() => { setShowCreateForm(true); fetchPatientsAndDentists() }} className="bg-[#2D9DA8] hover:bg-[#258a94]">
            <Plus className="w-4 h-4 mr-2" />
            New Plan
          </Button>
        </div>

        {/* Create Treatment Plan Form */}
        {showCreateForm && (
          <Card className="border-[#2D9DA8]/30 bg-[#2D9DA8]/5">
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle className="text-lg">Create New Treatment Plan</CardTitle>
                <Button variant="ghost" size="sm" onClick={() => setShowCreateForm(false)}><X className="w-4 h-4" /></Button>
              </div>
              <CardDescription>Dentist is optional — leave blank for generic plans</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Patient *</Label>
                  <Select value={createForm.patientId} onValueChange={(v) => setCreateForm({...createForm, patientId: v})}>
                    <SelectTrigger><SelectValue placeholder="Select patient" /></SelectTrigger>
                    <SelectContent>
                      {patients.map(p => (
                        <SelectItem key={p.id} value={p.id}>{p.fullName || 'Unknown'} ({p.patientNumber})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Dentist (Optional)</Label>
                  <Select value={createForm.dentistId || '__none__'} onValueChange={(v) => setCreateForm({...createForm, dentistId: v === '__none__' ? '' : v})}>
                    <SelectTrigger><SelectValue placeholder="Select dentist (optional)" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">None (Generic Plan)</SelectItem>
                      {dentists.map(d => (
                        <SelectItem key={d.id} value={d.id}>{formatDentistName(d.user?.firstName, d.user?.lastName)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="md:col-span-2">
                  <Label>Plan Title *</Label>
                  <Input value={createForm.title} onChange={(e) => setCreateForm({...createForm, title: e.target.value})} placeholder="e.g. Full Mouth Rehabilitation" />
                </div>
                <div className="md:col-span-2">
                  <Label>Description</Label>
                  <Textarea value={createForm.description} onChange={(e) => setCreateForm({...createForm, description: e.target.value})} placeholder="Treatment plan details..." rows={2} />
                </div>
                <div>
                  <Label>Priority</Label>
                  <Select value={createForm.priority} onValueChange={(v) => setCreateForm({...createForm, priority: v})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="emergency">Emergency</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Estimated Cost (₱)</Label>
                  <Input type="number" value={createForm.estimatedCost} onChange={(e) => setCreateForm({...createForm, estimatedCost: e.target.value})} placeholder="0.00" />
                </div>
                <div className="md:col-span-2">
                  <Label>Diagnosis</Label>
                  <Input value={createForm.diagnosis} onChange={(e) => setCreateForm({...createForm, diagnosis: e.target.value})} placeholder="e.g. Multiple caries, gum disease" />
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-4">
                <Button variant="outline" onClick={() => setShowCreateForm(false)}>Cancel</Button>
                <Button onClick={handleCreatePlan} disabled={saving || !createForm.patientId || !createForm.title} className="bg-[#2D9DA8] hover:bg-[#258a94]">
                  {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
                  Create Plan
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-[#2D9DA8]" />
          </div>
        ) : filteredPlans.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <FileText className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <h3 className="text-lg font-semibold text-gray-700 mb-2">No Treatment Plans Found</h3>
              <p className="text-gray-500 mb-4">
                {plans.length === 0
                  ? 'Treatment plans will appear here once created for patients. You can create treatment plans from a patient\'s profile page.'
                  : 'No plans match your search criteria.'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Plan List */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
                {filteredPlans.length} Treatment Plan{filteredPlans.length !== 1 ? 's' : ''}
              </h3>
              {filteredPlans.map(plan => (
                <Card
                  key={plan.id}
                  className={`cursor-pointer transition-all hover:shadow-md ${
                    selectedPlan?.id === plan.id ? 'ring-2 ring-[#2D9DA8] shadow-md' : ''
                  }`}
                  onClick={() => { setSelectedPlan(plan); setEditing(false) }}
                >
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-semibold text-gray-900 line-clamp-1">{plan.title}</h4>
                      <Badge className={statusColors[plan.status] || 'bg-gray-100 text-gray-700'}>
                        {statusLabels[plan.status] || plan.status}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-600 mb-2">
                      <span className="flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        {plan.patient?.fullName || 'Unknown Patient'}
                      </span>
                      {plan.priority && (
                        <Badge variant="outline" className={priorityColors[plan.priority] || ''}>
                          {plan.priority}
                        </Badge>
                      )}
                    </div>
                    {plan.completionPercentage > 0 && (
                      <div className="mt-2">
                        <div className="flex justify-between text-xs text-gray-500 mb-1">
                          <span>Progress</span>
                          <span>{plan.completionPercentage}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-1.5">
                          <div
                            className="bg-[#22B573] h-1.5 rounded-full transition-all"
                            style={{ width: `${plan.completionPercentage}%` }}
                          />
                        </div>
                      </div>
                    )}
                    <div className="text-xs text-gray-400 mt-2">
                      Updated {format(new Date(plan.updatedAt), 'MMM d, yyyy')}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Plan Detail / Edit */}
            <div>
              {selectedPlan ? (
                <Card className="sticky top-4">
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-lg">
                          {editing ? 'Edit Treatment Plan' : selectedPlan.title}
                        </CardTitle>
                        <CardDescription>
                          {selectedPlan.patient
                            ? `${selectedPlan.patient.fullName || 'Unknown'} (${selectedPlan.patient.patientNumber})`
                            : 'Unknown Patient'}
                        </CardDescription>
                      </div>
                      <div className="flex gap-2">
                        {!editing ? (
                          <>
                            <Button size="sm" variant="outline" onClick={() => startEdit(selectedPlan)}>
                              <Edit className="w-4 h-4 mr-1" /> Edit
                            </Button>
                            <Button size="sm" variant="outline" className="text-red-600 hover:text-red-700" onClick={() => deletePlan(selectedPlan.id)}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button size="sm" onClick={savePlan} disabled={saving}>
                              {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
                              Save
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => setEditing(false)}>
                              <X className="w-4 h-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {editing ? (
                      /* Edit Form */
                      <>
                        <div>
                          <Label>Title</Label>
                          <Input
                            value={editForm.title}
                            onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                          />
                        </div>
                        <div>
                          <Label>Description</Label>
                          <Textarea
                            value={editForm.description}
                            onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                            rows={2}
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label>Status</Label>
                            <Select value={editForm.status} onValueChange={(v) => setEditForm({ ...editForm, status: v })}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {Object.entries(statusLabels).map(([k, v]) => (
                                  <SelectItem key={k} value={k}>{v}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label>Priority</Label>
                            <Select value={editForm.priority} onValueChange={(v) => setEditForm({ ...editForm, priority: v })}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="low">Low</SelectItem>
                                <SelectItem value="medium">Medium</SelectItem>
                                <SelectItem value="high">High</SelectItem>
                                <SelectItem value="emergency">Emergency</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div>
                          <Label>Estimated Cost (₱)</Label>
                          <Input
                            type="number"
                            value={editForm.estimatedCost}
                            onChange={(e) => setEditForm({ ...editForm, estimatedCost: e.target.value })}
                          />
                        </div>
                        <div>
                          <Label>Completion %</Label>
                          <Input
                            type="number"
                            min={0}
                            max={100}
                            value={editForm.completionPercentage}
                            onChange={(e) => setEditForm({ ...editForm, completionPercentage: parseInt(e.target.value) || 0 })}
                          />
                        </div>
                        <div>
                          <Label>Diagnosis</Label>
                          <Textarea
                            value={editForm.diagnosis}
                            onChange={(e) => setEditForm({ ...editForm, diagnosis: e.target.value })}
                            rows={2}
                          />
                        </div>
                        <div>
                          <Label>Clinical Notes</Label>
                          <Textarea
                            value={editForm.clinicalNotes}
                            onChange={(e) => setEditForm({ ...editForm, clinicalNotes: e.target.value })}
                            rows={3}
                          />
                        </div>
                      </>
                    ) : (
                      /* View Mode */
                      <>
                        <div className="flex gap-2 flex-wrap">
                          <Badge className={statusColors[selectedPlan.status] || ''}>
                            {statusLabels[selectedPlan.status] || selectedPlan.status}
                          </Badge>
                          {selectedPlan.priority && (
                            <Badge variant="outline" className={priorityColors[selectedPlan.priority] || ''}>
                              {selectedPlan.priority}
                            </Badge>
                          )}
                        </div>

                        {selectedPlan.description && (
                          <div>
                            <Label className="text-gray-500 text-xs">Description</Label>
                            <p className="text-sm">{selectedPlan.description}</p>
                          </div>
                        )}

                        {selectedPlan.diagnosis && (
                          <div>
                            <Label className="text-gray-500 text-xs">Diagnosis</Label>
                            <p className="text-sm">{selectedPlan.diagnosis}</p>
                          </div>
                        )}

                        <div className="grid grid-cols-2 gap-4">
                          {selectedPlan.estimatedCost != null && (
                            <div className="p-3 bg-blue-50 rounded-lg">
                              <div className="text-xs text-blue-600 font-medium">Estimated Cost</div>
                              <div className="text-lg font-bold text-blue-800">₱{Number(selectedPlan.estimatedCost).toLocaleString()}</div>
                            </div>
                          )}
                          <div className="p-3 bg-green-50 rounded-lg">
                            <div className="text-xs text-green-600 font-medium">Completion</div>
                            <div className="text-lg font-bold text-green-800">{selectedPlan.completionPercentage}%</div>
                          </div>
                        </div>

                        {selectedPlan.completionPercentage > 0 && (
                          <div>
                            <div className="w-full bg-gray-200 rounded-full h-2">
                              <div
                                className="bg-[#22B573] h-2 rounded-full transition-all"
                                style={{ width: `${selectedPlan.completionPercentage}%` }}
                              />
                            </div>
                          </div>
                        )}

                        {selectedPlan.clinicalNotes && (
                          <div>
                            <Label className="text-gray-500 text-xs">Clinical Notes</Label>
                            <p className="text-sm whitespace-pre-wrap">{selectedPlan.clinicalNotes}</p>
                          </div>
                        )}

                        <div className="border-t pt-4 space-y-2 text-xs text-gray-500">
                          <div className="flex justify-between">
                            <span>Dentist</span>
                            <span>{selectedPlan.dentist?.user ? formatDentistName(selectedPlan.dentist.user.firstName, selectedPlan.dentist.user.lastName) : 'Unassigned'}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Created</span>
                            <span>{format(new Date(selectedPlan.createdAt), 'MMM d, yyyy')}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Last Updated</span>
                            <span>{format(new Date(selectedPlan.updatedAt), 'MMM d, yyyy')}</span>
                          </div>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="p-12 text-center text-gray-500">
                    <FileText className="w-10 h-10 mx-auto mb-3 text-gray-300" />
                    <p>Select a treatment plan to view details</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}

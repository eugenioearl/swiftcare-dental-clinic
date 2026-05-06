
'use client'

import { formatDisplayName, formatPatientName } from '@/lib/utils'
import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Plus, Search, Edit2, Download, FileText, Heart, Signature, Shield, CreditCard, Eye, Users, Calendar, Activity } from 'lucide-react'
import { toast } from 'react-hot-toast'

interface PatientForm {
  id: string
  documentType: string
  title: string
  status: string
  content?: string
  cloudStoragePath?: string
  fileName?: string
  fileSize?: number
  mimeType?: string
  createdAt: string
  patient: {
    id: string
    patientNumber: string
    fullName?: string | null
    emailDirect?: string | null
    user?: {
      firstName: string
      lastName: string
      email: string
    } | null
  }
  createdByUser: {
    firstName: string
    lastName: string
    role: string
  }
  appointment?: {
    appointmentNumber: string
    scheduledDatetime: string
    appointmentType: string
  }
}

type RequirementStage = 'check_in' | 'before_procedure' | 'before_payment' | 'discharge'

interface FormTemplate {
  id: string
  title: string
  description: string
  category: string
  isRequired: boolean
  isActive: boolean
  icon?: React.ComponentType<{ className?: string }>
  estimatedTime: string
  linkedServices: string[]
  content?: string
  fields?: FormField[]
  // Rule fields (DB-backed)
  requiredForAppointmentTypes?: string[]
  requiredForTreatmentCategories?: string[]
  requirementStages?: RequirementStage[]
  requiredAlways?: boolean
  minorOnly?: boolean
  adultOnly?: boolean
  requiresGuardian?: boolean
  status?: string
  version?: number
  isSystem?: boolean
}

interface FormField {
  id: string
  type: 'text' | 'textarea' | 'select' | 'checkbox' | 'radio' | 'date' | 'signature' | 'number' | 'email' | 'tel' | 'medical_checklist'
  label: string
  required: boolean
  options?: string[]
  placeholder?: string
  helpText?: string
  patientField?: string
  checklistItems?: string[]
}

const APPOINTMENT_TYPES: { value: string; label: string }[] = [
  { value: 'consultation', label: 'Consultation' },
  { value: 'cleaning', label: 'Cleaning' },
  { value: 'procedure', label: 'Procedure' },
  { value: 'surgery', label: 'Surgery' },
  { value: 'x_ray', label: 'X-Ray' },
  { value: 'follow_up', label: 'Follow-up' },
  { value: 'walk_in', label: 'Walk-in' },
  { value: 'other', label: 'Other' },
]

const TREATMENT_CATEGORIES: string[] = [
  'Diagnostic', 'Preventive', 'Restorative', 'Endodontic', 'Oral Surgery',
  'Orthodontic', 'Prosthodontic', 'Cosmetic', 'Pediatric', 'Periodontic',
]

const REQUIREMENT_STAGES: { value: RequirementStage; label: string }[] = [
  { value: 'check_in', label: 'Check-in' },
  { value: 'before_procedure', label: 'Before Procedure' },
  { value: 'before_payment', label: 'Before Payment' },
  { value: 'discharge', label: 'Discharge' },
]

export default function FormManagement() {
  const [forms, setForms] = useState<PatientForm[]>([])
  const [templates, setTemplates] = useState<FormTemplate[]>([])
  const [services, setServices] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedStatus, setSelectedStatus] = useState('all')
  const [selectedTemplate, setSelectedTemplate] = useState('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [isEditFormOpen, setIsEditFormOpen] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<FormTemplate | null>(null)
  const [formFields, setFormFields] = useState<FormField[]>([])
  const [linkedServices, setLinkedServices] = useState<string[]>([])

  // Rule state
  const [ruleAppointmentTypes, setRuleAppointmentTypes] = useState<string[]>([])
  const [ruleTreatmentCategories, setRuleTreatmentCategories] = useState<string[]>([])
  const [ruleStages, setRuleStages] = useState<RequirementStage[]>([])
  const [ruleRequiredAlways, setRuleRequiredAlways] = useState(false)
  const [ruleMinorOnly, setRuleMinorOnly] = useState(false)
  const [ruleAdultOnly, setRuleAdultOnly] = useState(false)
  const [ruleRequiresGuardian, setRuleRequiresGuardian] = useState(false)

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: 'intake',
    isRequired: false,
    isActive: true,
    estimatedTime: '5-10 minutes'
  })

  // Icon mapping by category — used only for visual continuity in the UI
  const CATEGORY_ICONS: Record<string, any> = {
    intake: FileText,
    medical: Heart,
    consent: Signature,
    financial: CreditCard,
    data_completion: FileText,
  }

  const fetchForms = async () => {
    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '20',
        ...(searchTerm && { search: searchTerm }),
        ...(selectedStatus !== 'all' && { status: selectedStatus }),
        ...(selectedTemplate !== 'all' && { documentType: selectedTemplate })
      })

      const response = await fetch(`/api/forms?${params}`)
      const data = await response.json()
      
      if (data.success) {
        setForms(data.data.forms)
        setTotalPages(data.data.pagination?.pages || 1)
      } else {
        toast.error('Failed to load forms')
      }
    } catch (error) {
      toast.error('Error loading forms')
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchServices = async () => {
    try {
      const response = await fetch('/api/treatments')
      const data = await response.json()
      
      if (data.success) {
        setServices(data.data.treatments || [])
      }
    } catch (error) {
      console.error('Error fetching services:', error)
    }
  }

  const fetchTemplates = async () => {
    try {
      // DB-backed canonical endpoint - returns full templates with rules
      const response = await fetch('/api/form-templates?activeOnly=false')
      if (!response.ok) throw new Error('Failed to fetch')
      const data = await response.json()

      const dbTemplates: FormTemplate[] = (data.templates || []).map((t: any) => {
        return {
          id: t.id,
          title: t.title,
          description: t.description || '',
          category: t.category,
          isRequired: !!(t.requiredAlways || t.isRequired),
          isActive: t.isActive ?? (t.status === 'active'),
          icon: CATEGORY_ICONS[t.category] || FileText,
          estimatedTime: t.estimatedTime || '5-10 minutes',
          linkedServices: Array.isArray(t.requiredForServiceIds) ? t.requiredForServiceIds : [],
          fields: Array.isArray(t.fields) ? t.fields : [],
          requiredForAppointmentTypes: Array.isArray(t.requiredForAppointmentTypes) ? t.requiredForAppointmentTypes : [],
          requiredForTreatmentCategories: Array.isArray(t.requiredForTreatmentCategories) ? t.requiredForTreatmentCategories : [],
          requirementStages: Array.isArray(t.requirementStages) ? t.requirementStages : [],
          requiredAlways: !!t.requiredAlways,
          minorOnly: !!t.minorOnly,
          adultOnly: !!t.adultOnly,
          requiresGuardian: !!t.requiresGuardian,
          status: t.status,
          version: t.version,
          isSystem: !!t.isSystem,
        }
      })

      setTemplates(dbTemplates)
    } catch (error) {
      console.error('Error fetching form templates:', error)
      setTemplates([])
    }
  }

  const handleEditTemplate = (template: FormTemplate) => {
    setEditingTemplate(template)
    setFormData({
      title: template.title,
      description: template.description,
      category: template.category,
      isRequired: template.isRequired,
      isActive: template.isActive,
      estimatedTime: template.estimatedTime
    })
    setFormFields(template.fields || [])
    setLinkedServices(template.linkedServices || [])
    // Hydrate rule state
    setRuleAppointmentTypes(template.requiredForAppointmentTypes || [])
    setRuleTreatmentCategories(template.requiredForTreatmentCategories || [])
    setRuleStages(template.requirementStages || [])
    setRuleRequiredAlways(!!template.requiredAlways)
    setRuleMinorOnly(!!template.minorOnly)
    setRuleAdultOnly(!!template.adultOnly)
    setRuleRequiresGuardian(!!template.requiresGuardian)
    setIsEditFormOpen(true)
  }

  const handleSaveTemplate = async () => {
    if (!editingTemplate?.id) {
      toast.error('No template selected')
      return
    }
    try {
      // Detect a real DB id (cuid-like) vs static legacy id
      const isDbId = /^c[a-z0-9]{20,}$/.test(editingTemplate.id)

      if (!isDbId) {
        toast.error('This template is not yet stored in the database. Please re-seed templates to enable full editing.')
        return
      }

      const body = {
        title: formData.title,
        description: formData.description || null,
        category: formData.category,
        fields: formFields,
        requiredForServiceIds: linkedServices,
        requiredForAppointmentTypes: ruleAppointmentTypes,
        requiredForTreatmentCategories: ruleTreatmentCategories,
        requirementStages: ruleStages,
        requiredAlways: ruleRequiredAlways,
        minorOnly: ruleMinorOnly,
        adultOnly: ruleAdultOnly,
        requiresGuardian: ruleRequiresGuardian,
        isActive: formData.isActive,
        status: formData.isActive ? 'active' : 'inactive',
      }

      const response = await fetch(`/api/form-templates/${editingTemplate.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })

      const data = await response.json()

      if (response.ok && data.template) {
        toast.success('Form template updated successfully')
        setIsEditFormOpen(false)
        resetEditForm()
        // Refetch from DB so list reflects authoritative state
        await fetchTemplates()
      } else {
        const msg = data?.error || 'Failed to update form template'
        const details = data?.details ? ` (${JSON.stringify(data.details)})` : ''
        toast.error(`${msg}${details}`)
      }
    } catch (error) {
      toast.error('Failed to update form template')
      console.error('Error:', error)
    }
  }

  const resetEditForm = () => {
    setEditingTemplate(null)
    setFormData({
      title: '',
      description: '',
      category: 'intake',
      isRequired: false,
      isActive: true,
      estimatedTime: '5-10 minutes'
    })
    setFormFields([])
    setLinkedServices([])
    setRuleAppointmentTypes([])
    setRuleTreatmentCategories([])
    setRuleStages([])
    setRuleRequiredAlways(false)
    setRuleMinorOnly(false)
    setRuleAdultOnly(false)
    setRuleRequiresGuardian(false)
  }

  const addFormField = () => {
    const newField: FormField = {
      id: `field_${Date.now()}`,
      type: 'text',
      label: 'New Field',
      required: false
    }
    setFormFields([...formFields, newField])
  }

  const updateFormField = (index: number, updates: Partial<FormField>) => {
    const updatedFields = formFields.map((field, i) => 
      i === index ? { ...field, ...updates } : field
    )
    setFormFields(updatedFields)
  }

  const removeFormField = (index: number) => {
    setFormFields(formFields.filter((_, i) => i !== index))
  }

  const handleServiceLinkToggle = (serviceId: string) => {
    setLinkedServices(prev => 
      prev.includes(serviceId) 
        ? prev.filter(id => id !== serviceId)
        : [...prev, serviceId]
    )
  }

  useEffect(() => {
    fetchForms()
    fetchServices()
    fetchTemplates()
  }, [currentPage, searchTerm, selectedStatus, selectedTemplate])

  const handleDownload = async (formId: string, title: string) => {
    try {
      const response = await fetch(`/api/forms/${formId}/download`)
      if (response.ok) {
        const data = await response.json()
        window.open(data.data.downloadUrl, '_blank')
        toast.success('Download started')
      } else {
        throw new Error('Download failed')
      }
    } catch (error) {
      toast.error('Failed to download form')
      console.error('Error:', error)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800'
      case 'submitted': return 'bg-blue-100 text-blue-800'
      case 'draft': return 'bg-yellow-100 text-yellow-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getCategoryIcon = (category: string) => {
    const IconComponent = CATEGORY_ICONS[category] || FileText
    return <IconComponent className="w-4 h-4" />
  }

  const filteredForms = forms.filter(form => {
    const matchesSearch = form.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (form?.patient?.user?.firstName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (form?.patient?.user?.lastName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (form?.patient?.user?.email || form?.patient?.emailDirect || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (form?.patient?.fullName || '').toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = selectedStatus === 'all' || form.status === selectedStatus
    const matchesTemplate = selectedTemplate === 'all' || form.documentType === selectedTemplate
    return matchesSearch && matchesStatus && matchesTemplate
  })

  const statusOptions = [
    { value: 'all', label: 'All Status' },
    { value: 'completed', label: 'Completed' },
    { value: 'submitted', label: 'Submitted' },
    { value: 'draft', label: 'Draft' }
  ]

  const stats = {
    totalForms: forms.length,
    completedForms: forms.filter(f => f.status === 'completed').length,
    draftForms: forms.filter(f => f.status === 'draft').length,
    submittedForms: forms.filter(f => f.status === 'submitted').length
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Form Management</h1>
          <p className="text-muted-foreground">Manage patient forms, templates, and submissions</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <FileText className="h-8 w-8 text-blue-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Total Forms</p>
                <p className="text-2xl font-bold">{stats.totalForms}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Activity className="h-8 w-8 text-green-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Completed</p>
                <p className="text-2xl font-bold">{stats.completedForms}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Calendar className="h-8 w-8 text-yellow-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Drafts</p>
                <p className="text-2xl font-bold">{stats.draftForms}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Users className="h-8 w-8 text-purple-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Submitted</p>
                <p className="text-2xl font-bold">{stats.submittedForms}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="submissions" className="space-y-4">
        <TabsList>
          <TabsTrigger value="submissions">Form Submissions ({forms.length})</TabsTrigger>
          <TabsTrigger value="templates">Form Templates ({templates.length})</TabsTrigger>
        </TabsList>

        {/* Form Submissions Tab */}
        <TabsContent value="submissions" className="space-y-4">
          {/* Filters */}
          <Card>
            <CardHeader>
              <CardTitle>Filter Submissions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search patients, forms..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-8"
                    />
                  </div>
                </div>
                <div className="w-full md:w-48">
                  <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {statusOptions.map((status) => (
                        <SelectItem key={status.value} value={status.value}>
                          {status.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-full md:w-48">
                  <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Templates</SelectItem>
                      {templates.map((template) => (
                        <SelectItem key={template.id} value={template.id}>
                          {template.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Forms List */}
          <div className="grid grid-cols-1 gap-4">
            {filteredForms.map((form) => (
              <Card key={form.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <div className="p-2 bg-blue-100 rounded-lg">
                          {getCategoryIcon(form.documentType.split('-')[0])}
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold">{form.title}</h3>
                          <p className="text-sm text-muted-foreground">
                            {formatPatientName(form.patient.fullName, form.patient.user?.firstName, form.patient.user?.lastName, 'Unknown')} • {form.patient?.user?.email || form.patient?.emailDirect || 'N/A'}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-4 mb-2">
                        <Badge className={getStatusColor(form.status)}>
                          {form.status.toUpperCase()}
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          Submitted: {new Date(form.createdAt).toLocaleDateString()}
                        </span>
                        {form.appointment && (
                          <span className="text-sm text-blue-600">
                            Appointment: {form.appointment.appointmentType}
                          </span>
                        )}
                      </div>

                      <div className="text-sm text-muted-foreground">
                        Type: {form.documentType.replace('-', ' ').toUpperCase()} • 
                        Created by: {formatDisplayName(form.createdByUser.firstName, form.createdByUser.lastName)} ({form.createdByUser.role})
                      </div>
                    </div>

                    <div className="flex space-x-2">
                      <Button variant="outline" size="sm">
                        <Eye className="w-4 h-4 mr-2" />
                        View
                      </Button>
                      {form.cloudStoragePath && (
                        <Button 
                          size="sm"
                          onClick={() => handleDownload(form.id, form.title)}
                        >
                          <Download className="w-4 h-4 mr-2" />
                          Download
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center space-x-2">
              <Button
                variant="outline"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(currentPage - 1)}
              >
                Previous
              </Button>
              <span className="flex items-center px-4">
                Page {currentPage} of {totalPages}
              </span>
              <Button
                variant="outline"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(currentPage + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </TabsContent>

        {/* Form Templates Tab */}
        <TabsContent value="templates" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Available Form Templates</CardTitle>
              <CardDescription>
                Manage the forms that patients can fill out during their visit or beforehand
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {templates.map((template) => {
                  const IconComponent = template.icon || FileText
                  return (
                    <Card key={template.id} className="hover:shadow-md transition-shadow">
                      <CardContent className="p-6">
                        <div className="flex items-start space-x-3 mb-4">
                          <div className="p-2 bg-blue-100 rounded-lg">
                            <IconComponent className="w-6 h-6 text-blue-600" />
                          </div>
                          <div className="flex-1">
                            <h3 className="font-semibold text-gray-900">{template.title}</h3>
                            <p className="text-sm text-muted-foreground mt-1">
                              {template.estimatedTime}
                            </p>
                          </div>
                          <div className="flex flex-col items-end space-y-1">
                            {template.isRequired && (
                              <Badge variant="outline" className="text-xs">
                                Required
                              </Badge>
                            )}
                            <Badge variant={template.isActive ? "default" : "secondary"} className="text-xs">
                              {template.isActive ? "Active" : "Inactive"}
                            </Badge>
                          </div>
                        </div>
                        
                        <p className="text-sm text-muted-foreground mb-4">
                          {template.description}
                        </p>

                        {template.linkedServices && template.linkedServices.length > 0 && (
                          <div className="mb-4">
                            <p className="text-xs font-medium text-gray-700 mb-2">Linked to Services:</p>
                            <div className="flex flex-wrap gap-1">
                              {template.linkedServices.slice(0, 3).map((serviceId) => {
                                const service = services.find(s => s.id === serviceId)
                                return service ? (
                                  <Badge key={serviceId} variant="outline" className="text-xs">
                                    {service.name}
                                  </Badge>
                                ) : null
                              })}
                              {template.linkedServices.length > 3 && (
                                <Badge variant="outline" className="text-xs">
                                  +{template.linkedServices.length - 3} more
                                </Badge>
                              )}
                            </div>
                          </div>
                        )}

                        <div className="flex justify-between items-center">
                          <span className="text-xs text-muted-foreground capitalize">
                            {template.category} • {template.fields?.length || 0} fields
                          </span>
                          
                          <div className="flex space-x-2">
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => handleEditTemplate(template)}
                            >
                              <Edit2 className="w-4 h-4 mr-2" />
                              Edit
                            </Button>
                            <Button variant="outline" size="sm">
                              <Eye className="w-4 h-4 mr-2" />
                              Preview
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit Form Dialog */}
      <Dialog open={isEditFormOpen} onOpenChange={setIsEditFormOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Form Template: {editingTemplate?.title}</DialogTitle>
            <DialogDescription>
              Customize form fields and link to specific services
            </DialogDescription>
          </DialogHeader>
          
          <Tabs defaultValue="basic" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="basic">Basic Info</TabsTrigger>
              <TabsTrigger value="fields">Form Fields</TabsTrigger>
              <TabsTrigger value="services">Linked Services</TabsTrigger>
              <TabsTrigger value="rules">Rules</TabsTrigger>
            </TabsList>
            
            {/* Basic Info Tab */}
            <TabsContent value="basic" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Title</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <Select value={formData.category} onValueChange={(value) => setFormData({ ...formData, category: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="intake">Intake</SelectItem>
                      <SelectItem value="medical">Medical</SelectItem>
                      <SelectItem value="consent">Consent</SelectItem>
                      <SelectItem value="financial">Financial</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2 space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="estimatedTime">Estimated Time</Label>
                  <Input
                    id="estimatedTime"
                    value={formData.estimatedTime}
                    onChange={(e) => setFormData({ ...formData, estimatedTime: e.target.value })}
                    placeholder="5-10 minutes"
                  />
                </div>
                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="isRequired"
                      checked={formData.isRequired}
                      onChange={(e) => setFormData({ ...formData, isRequired: e.target.checked })}
                      className="rounded border-gray-300"
                    />
                    <Label htmlFor="isRequired">Required Form</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="isActive"
                      checked={formData.isActive}
                      onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                      className="rounded border-gray-300"
                    />
                    <Label htmlFor="isActive">Active</Label>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Form Fields Tab */}
            <TabsContent value="fields" className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">Form Fields</h3>
                <Button onClick={addFormField} variant="outline" size="sm">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Field
                </Button>
              </div>
              
              <div className="space-y-3">
                {formFields.map((field, index) => (
                  <Card key={field.id} className="p-4">
                    <div className="grid grid-cols-4 gap-3 items-center">
                      <div className="space-y-1">
                        <Label className="text-xs">Field Type</Label>
                        <Select 
                          value={field.type} 
                          onValueChange={(value: any) => updateFormField(index, { type: value })}
                        >
                          <SelectTrigger className="h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="text">Text</SelectItem>
                            <SelectItem value="textarea">Textarea</SelectItem>
                            <SelectItem value="number">Number</SelectItem>
                            <SelectItem value="email">Email</SelectItem>
                            <SelectItem value="tel">Phone</SelectItem>
                            <SelectItem value="select">Select (Dropdown)</SelectItem>
                            <SelectItem value="checkbox">Checkbox</SelectItem>
                            <SelectItem value="radio">Radio</SelectItem>
                            <SelectItem value="date">Date</SelectItem>
                            <SelectItem value="signature">Signature</SelectItem>
                            <SelectItem value="medical_checklist">Medical Checklist (Yes/No per item)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div className="space-y-1">
                        <Label className="text-xs">Label</Label>
                        <Input
                          value={field.label}
                          onChange={(e) => updateFormField(index, { label: e.target.value })}
                          className="h-8"
                        />
                      </div>
                      
                      <div className="space-y-1">
                        <Label className="text-xs">Placeholder</Label>
                        <Input
                          value={field.placeholder || ''}
                          onChange={(e) => updateFormField(index, { placeholder: e.target.value })}
                          className="h-8"
                        />
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-1">
                          <input
                            type="checkbox"
                            id={`required-${index}`}
                            checked={field.required}
                            onChange={(e) => updateFormField(index, { required: e.target.checked })}
                            className="rounded border-gray-300"
                          />
                          <Label htmlFor={`required-${index}`} className="text-xs">Required</Label>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeFormField(index)}
                          className="text-red-600 hover:text-red-700 h-8 w-8 p-0"
                        >
                          ×
                        </Button>
                      </div>
                    </div>
                    
                    {(field.type === 'select' || field.type === 'radio') && (
                      <div className="mt-3">
                        <Label className="text-xs">Options (comma separated)</Label>
                        <Input
                          value={field.options?.join(', ') || ''}
                          onChange={(e) => updateFormField(index, { 
                            options: e.target.value.split(',').map(opt => opt.trim()).filter(Boolean)
                          })}
                          placeholder="Option 1, Option 2, Option 3"
                          className="h-8 mt-1"
                        />
                      </div>
                    )}

                    {field.type === 'medical_checklist' && (
                      <div className="mt-3 space-y-2 border-t pt-3">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs font-semibold">Checklist Items (each is a Yes/No question)</Label>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => updateFormField(index, {
                              checklistItems: [...(field.checklistItems || []), '']
                            })}
                            className="h-7 text-xs"
                          >
                            <Plus className="w-3 h-3 mr-1" />
                            Add Item
                          </Button>
                        </div>
                        {(field.checklistItems || []).length === 0 && (
                          <p className="text-xs text-muted-foreground">
                            No items yet. Click "Add Item" to add the first one (e.g. "Antibiotics", "Latex").
                          </p>
                        )}
                        <div className="space-y-1.5">
                          {(field.checklistItems || []).map((item, ci) => (
                            <div key={ci} className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground w-6 text-right">{ci + 1}.</span>
                              <Input
                                value={item}
                                onChange={(e) => {
                                  const items = [...(field.checklistItems || [])]
                                  items[ci] = e.target.value
                                  updateFormField(index, { checklistItems: items })
                                }}
                                placeholder="e.g. Antibiotics, Latex, Sulfa drugs"
                                className="h-8 flex-1"
                              />
                              <div className="flex items-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 w-7 p-0"
                                  disabled={ci === 0}
                                  onClick={() => {
                                    const items = [...(field.checklistItems || [])]
                                    if (ci > 0) {
                                      ;[items[ci - 1], items[ci]] = [items[ci], items[ci - 1]]
                                      updateFormField(index, { checklistItems: items })
                                    }
                                  }}
                                  title="Move up"
                                >
                                  ↑
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 w-7 p-0"
                                  disabled={ci === (field.checklistItems || []).length - 1}
                                  onClick={() => {
                                    const items = [...(field.checklistItems || [])]
                                    if (ci < items.length - 1) {
                                      ;[items[ci + 1], items[ci]] = [items[ci], items[ci + 1]]
                                      updateFormField(index, { checklistItems: items })
                                    }
                                  }}
                                  title="Move down"
                                >
                                  ↓
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 w-7 p-0 text-red-600 hover:text-red-700"
                                  onClick={() => {
                                    const items = [...(field.checklistItems || [])]
                                    items.splice(ci, 1)
                                    updateFormField(index, { checklistItems: items })
                                  }}
                                  title="Remove"
                                >
                                  ×
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                        <div className="mt-2">
                          <Label className="text-xs">Patient Field Mapping (optional)</Label>
                          <Input
                            value={field.patientField || ''}
                            onChange={(e) => updateFormField(index, { patientField: e.target.value })}
                            placeholder="e.g. allergies, medicalConditions, currentMedications"
                            className="h-8 mt-1"
                          />
                          <p className="text-[11px] text-muted-foreground mt-1">
                            When patients answer "Yes", the items are saved to this field on the Patient record.
                          </p>
                        </div>
                      </div>
                    )}

                    <div className="mt-3">
                      <Label className="text-xs">Help Text (optional)</Label>
                      <Input
                        value={field.helpText || ''}
                        onChange={(e) => updateFormField(index, { helpText: e.target.value })}
                        placeholder="Shown below the field as a hint"
                        className="h-8 mt-1"
                      />
                    </div>
                  </Card>
                ))}
              </div>
            </TabsContent>

            {/* Linked Services Tab */}
            <TabsContent value="services" className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold mb-2">Link to Services</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Select which services require this form to be completed before appointment
                </p>
              </div>
              
              <div className="grid grid-cols-2 gap-3 max-h-64 overflow-y-auto">
                {services.map((service) => (
                  <div key={service.id} className="flex items-center space-x-2 p-2 border rounded">
                    <input
                      type="checkbox"
                      id={`service-${service.id}`}
                      checked={linkedServices.includes(service.id)}
                      onChange={() => handleServiceLinkToggle(service.id)}
                      className="rounded border-gray-300"
                    />
                    <Label htmlFor={`service-${service.id}`} className="flex-1">
                      <div>
                        <div className="font-medium text-sm">{service.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {service.treatmentCode} • {service.category}
                        </div>
                      </div>
                    </Label>
                  </div>
                ))}
              </div>
              
              {linkedServices.length > 0 && (
                <div className="mt-4 p-3 bg-blue-50 rounded">
                  <p className="text-sm font-medium text-blue-900">Linked Services:</p>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {linkedServices.map((serviceId) => {
                      const service = services.find(s => s.id === serviceId)
                      return service ? (
                        <Badge key={serviceId} variant="secondary" className="text-xs">
                          {service.name}
                        </Badge>
                      ) : null
                    })}
                  </div>
                </div>
              )}
            </TabsContent>

            {/* Rules Tab */}
            <TabsContent value="rules" className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold">Form Requirement Rules</h3>
                <p className="text-sm text-muted-foreground">
                  Define when this form is required, who must complete it, and at what stage.
                </p>
              </div>

              {/* Required Always */}
              <div className="rounded border p-3 bg-amber-50/40">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={ruleRequiredAlways}
                    onChange={(e) => setRuleRequiredAlways(e.target.checked)}
                    className="mt-1 rounded border-gray-300"
                  />
                  <div>
                    <span className="text-sm font-medium">Required for ALL appointments</span>
                    <p className="text-xs text-muted-foreground">
                      When enabled, this form is mandatory regardless of appointment type, treatment, or service.
                    </p>
                  </div>
                </label>
              </div>

              {/* Appointment Types */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Required for Appointment Types</Label>
                <p className="text-xs text-muted-foreground">
                  Form is required when an appointment matches any of the selected types.
                </p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {APPOINTMENT_TYPES.map((t) => {
                    const checked = ruleAppointmentTypes.includes(t.value)
                    return (
                      <label
                        key={t.value}
                        className={`flex items-center gap-2 p-2 border rounded cursor-pointer text-sm transition-colors ${
                          checked ? 'bg-primary/5 border-primary/40' : 'hover:bg-muted/40'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setRuleAppointmentTypes([...ruleAppointmentTypes, t.value])
                            } else {
                              setRuleAppointmentTypes(ruleAppointmentTypes.filter(x => x !== t.value))
                            }
                          }}
                          className="rounded border-gray-300"
                        />
                        <span>{t.label}</span>
                      </label>
                    )
                  })}
                </div>
              </div>

              {/* Treatment Categories */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Required for Treatment Categories</Label>
                <p className="text-xs text-muted-foreground">
                  Form is required when any treatment in the appointment falls within these categories.
                </p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {TREATMENT_CATEGORIES.map((c) => {
                    const checked = ruleTreatmentCategories.includes(c)
                    return (
                      <label
                        key={c}
                        className={`flex items-center gap-2 p-2 border rounded cursor-pointer text-sm transition-colors ${
                          checked ? 'bg-primary/5 border-primary/40' : 'hover:bg-muted/40'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setRuleTreatmentCategories([...ruleTreatmentCategories, c])
                            } else {
                              setRuleTreatmentCategories(ruleTreatmentCategories.filter(x => x !== c))
                            }
                          }}
                          className="rounded border-gray-300"
                        />
                        <span>{c}</span>
                      </label>
                    )
                  })}
                </div>
              </div>

              {/* Requirement Stages */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Requirement Stages</Label>
                <p className="text-xs text-muted-foreground">
                  At which appointment stages must this form be completed before the patient can proceed?
                </p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {REQUIREMENT_STAGES.map((s) => {
                    const checked = ruleStages.includes(s.value)
                    return (
                      <label
                        key={s.value}
                        className={`flex items-center gap-2 p-2 border rounded cursor-pointer text-sm transition-colors ${
                          checked ? 'bg-primary/5 border-primary/40' : 'hover:bg-muted/40'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setRuleStages([...ruleStages, s.value])
                            } else {
                              setRuleStages(ruleStages.filter(x => x !== s.value))
                            }
                          }}
                          className="rounded border-gray-300"
                        />
                        <span>{s.label}</span>
                      </label>
                    )
                  })}
                </div>
              </div>

              {/* Age Rules */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Age Rules</Label>
                <p className="text-xs text-muted-foreground">
                  Restrict this form based on the patient's age. "Minor only" applies to patients under 18.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  <label
                    className={`flex items-center gap-2 p-2 border rounded cursor-pointer text-sm transition-colors ${
                      ruleMinorOnly ? 'bg-primary/5 border-primary/40' : 'hover:bg-muted/40'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={ruleMinorOnly}
                      onChange={(e) => {
                        setRuleMinorOnly(e.target.checked)
                        if (e.target.checked) setRuleAdultOnly(false)
                      }}
                      className="rounded border-gray-300"
                    />
                    <span>Minor only (under 18)</span>
                  </label>
                  <label
                    className={`flex items-center gap-2 p-2 border rounded cursor-pointer text-sm transition-colors ${
                      ruleAdultOnly ? 'bg-primary/5 border-primary/40' : 'hover:bg-muted/40'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={ruleAdultOnly}
                      onChange={(e) => {
                        setRuleAdultOnly(e.target.checked)
                        if (e.target.checked) setRuleMinorOnly(false)
                      }}
                      className="rounded border-gray-300"
                    />
                    <span>Adult only (18+)</span>
                  </label>
                  <label
                    className={`flex items-center gap-2 p-2 border rounded cursor-pointer text-sm transition-colors ${
                      ruleRequiresGuardian ? 'bg-primary/5 border-primary/40' : 'hover:bg-muted/40'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={ruleRequiresGuardian}
                      onChange={(e) => setRuleRequiresGuardian(e.target.checked)}
                      className="rounded border-gray-300"
                    />
                    <span>Requires guardian signature</span>
                  </label>
                </div>
              </div>

              {/* Summary */}
              <div className="rounded border bg-muted/30 p-3 text-xs space-y-1">
                <div className="font-semibold text-sm">Rule Summary</div>
                {ruleRequiredAlways ? (
                  <div>• Required for ALL appointments</div>
                ) : (
                  <>
                    <div>• Appointment types: {ruleAppointmentTypes.length > 0 ? ruleAppointmentTypes.join(', ') : <span className="text-muted-foreground">none</span>}</div>
                    <div>• Treatment categories: {ruleTreatmentCategories.length > 0 ? ruleTreatmentCategories.join(', ') : <span className="text-muted-foreground">none</span>}</div>
                    <div>• Linked services: {linkedServices.length} selected</div>
                  </>
                )}
                <div>• Stages: {ruleStages.length > 0 ? ruleStages.join(', ') : <span className="text-muted-foreground">none</span>}</div>
                <div>• Age: {ruleMinorOnly ? 'Minors only' : ruleAdultOnly ? 'Adults only' : 'Any age'}{ruleRequiresGuardian ? ' (guardian signature required)' : ''}</div>
              </div>
            </TabsContent>
          </Tabs>
          
          <div className="flex justify-end space-x-2 pt-4 border-t">
            <Button variant="outline" onClick={() => setIsEditFormOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveTemplate}>
              Save Changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

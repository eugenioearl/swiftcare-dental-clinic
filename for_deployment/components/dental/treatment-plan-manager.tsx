
'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { useToast } from '@/hooks/use-toast'
import { formatCurrency } from '@/lib/utils'
import {
  Plus,
  Edit,
  Trash2,
  Calendar,
  Clock,

  CheckCircle2,
  AlertCircle,
  PlayCircle,
  PauseCircle,
  Target,
  FileText,
  Users,
  Zap,
  Activity,
  TrendingUp,
  Shield
} from 'lucide-react'
import { PesoIcon, PesoSign } from '@/components/ui/peso-icon'

interface TreatmentPlan {
  id: string
  planNumber: string
  title: string
  description?: string
  status: string
  priority: string
  estimatedCost: number
  estimatedDuration: number
  insuranceEstimate: number
  patientPortion: number
  startDate?: string
  targetEndDate?: string
  actualEndDate?: string
  approvedAt?: string
  notes?: string
  alternatives?: any
  risks: string[]
  prerequisites: string[]
  phases: TreatmentPhase[]
}

interface TreatmentPhase {
  id: string
  phaseNumber: number
  title: string
  description?: string
  phase: string
  estimatedCost: number
  estimatedDuration: number
  plannedStartDate?: string
  plannedEndDate?: string
  actualStartDate?: string
  actualEndDate?: string
  status: string
  prerequisites: string[]
  notes?: string
  completionPercent: number
  phaseItems: TreatmentPhaseItem[]
}

interface TreatmentPhaseItem {
  id: string
  sequence: number
  toothNumber?: string
  surfaces: string[]
  estimatedCost: number
  estimatedDuration: number
  status: string
  notes?: string
  treatment: {
    id: string
    name: string
    treatmentCode: string
  }
}

interface TreatmentPlanManagerProps {
  patientId: string
  dentalRecordId: string
  editable?: boolean
  onPlanSelect?: (plan: TreatmentPlan) => void
}

export function TreatmentPlanManager({
  patientId,
  dentalRecordId,
  editable = true,
  onPlanSelect
}: TreatmentPlanManagerProps) {
  const { toast } = useToast()
  
  // State
  const [treatmentPlans, setTreatmentPlans] = useState<TreatmentPlan[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedPlan, setSelectedPlan] = useState<TreatmentPlan | null>(null)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showPhaseDialog, setShowPhaseDialog] = useState(false)
  const [editingPhase, setEditingPhase] = useState<TreatmentPhase | null>(null)
  const [treatments, setTreatments] = useState<any[]>([])

  // Form state
  const [planForm, setPlanForm] = useState({
    title: '',
    description: '',
    priority: 'intermediate',
    notes: '',
    phases: [] as any[]
  })

  const [phaseForm, setPhaseForm] = useState({
    title: '',
    description: '',
    phase: 'intermediate',
    plannedStartDate: '',
    plannedEndDate: '',
    prerequisites: [] as string[],
    notes: '',
    phaseItems: [] as any[]
  })

  // Load data
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        
        // Use mock treatment plans directly for demonstration
        const isAliceJohnson = patientId === 'P-2024-0001'
        
        let mockTreatmentPlans: TreatmentPlan[] = []
        
        if (isAliceJohnson) {
          // Alice Johnson - specific treatment plans
          mockTreatmentPlans = [
            {
              id: `plan-${patientId}-1`,
              planNumber: `TP-${Date.now()}-001`,
              title: "Emergency Treatment & Comprehensive Restoration",
              description: "Urgent treatment for acute pulpitis and comprehensive restoration of multiple carious lesions",
              status: "approved",
              priority: "emergency",
              estimatedCost: 45000,
              estimatedDuration: 720,
              insuranceEstimate: 25000,
              patientPortion: 20000,
              startDate: new Date().toISOString(),
              targetEndDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
              approvedAt: new Date().toISOString(),
              notes: "Patient has acute pulpitis tooth #19 requiring immediate attention. Multiple caries present requiring comprehensive treatment.",
              risks: [
                "Risk of abscess formation if treatment delayed",
                "Potential complications due to patient's asthma",
                "Risk of pulp exposure during cavity preparation"
              ],
              prerequisites: [
                "Antibiotic premedication due to asthma",
                "Pain management protocol",
                "Patient consent for all procedures"
              ],
              phases: [
                {
                  id: `phase-1-${patientId}`,
                  phaseNumber: 1,
                  title: "Emergency Root Canal Therapy",
                  description: "Immediate treatment for acute pulpitis tooth #19",
                  phase: "emergency",
                  estimatedCost: 18000,
                  estimatedDuration: 180,
                  plannedStartDate: new Date().toISOString(),
                  plannedEndDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
                  status: "in_progress",
                  prerequisites: ["Antibiotic premedication", "Local anesthetic"],
                  notes: "Priority treatment to relieve acute pain",
                  completionPercent: 30,
                  phaseItems: [
                    {
                      id: "item-1-1",
                      sequence: 1,
                      toothNumber: "19",
                      surfaces: ["occlusal", "mesial"],
                      estimatedCost: 15000,
                      estimatedDuration: 120,
                      status: "in_progress",
                      notes: "Root canal therapy with temporary filling",
                      treatment: {
                        id: "t1",
                        name: "Root Canal Therapy",
                        treatmentCode: "D3310"
                      }
                    },
                    {
                      id: "item-1-2",
                      sequence: 2,
                      toothNumber: "19",
                      surfaces: [],
                      estimatedCost: 3000,
                      estimatedDuration: 60,
                      status: "planned",
                      notes: "Permanent crown to restore tooth",
                      treatment: {
                        id: "t2",
                        name: "Porcelain Crown",
                        treatmentCode: "D2740"
                      }
                    }
                  ]
                }
              ]
            }
          ]
        } else {
          // Generic treatment plans
          mockTreatmentPlans = [
            {
              id: `plan-${patientId}-1`,
              planNumber: `TP-${Date.now()}-001`,
              title: "Routine Preventive Care",
              description: "Standard preventive care and maintenance",
              status: "active",
              priority: "maintenance",
              estimatedCost: 5000,
              estimatedDuration: 120,
              insuranceEstimate: 4000,
              patientPortion: 1000,
              startDate: new Date().toISOString(),
              targetEndDate: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString(),
              notes: "Regular preventive care to maintain oral health",
              risks: ["Minimal risks associated with routine care"],
              prerequisites: ["Current oral health assessment"],
              phases: [
                {
                  id: `phase-prev-${patientId}`,
                  phaseNumber: 1,
                  title: "Preventive Care Package",
                  description: "Comprehensive preventive dental care",
                  phase: "maintenance",
                  estimatedCost: 5000,
                  estimatedDuration: 120,
                  plannedStartDate: new Date().toISOString(),
                  plannedEndDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
                  status: "in_progress",
                  prerequisites: [],
                  notes: "Standard preventive care protocol",
                  completionPercent: 50,
                  phaseItems: [
                    {
                      id: "item-prev-1",
                      sequence: 1,
                      surfaces: [],
                      estimatedCost: 3000,
                      estimatedDuration: 60,
                      status: "completed",
                      notes: "Professional dental cleaning completed",
                      treatment: {
                        id: "t7",
                        name: "Prophylaxis - Adult",
                        treatmentCode: "D1110"
                      }
                    }
                  ]
                }
              ]
            }
          ]
        }
        
        setTreatmentPlans(mockTreatmentPlans)
        
        // Mock available treatments
        setTreatments([
          { id: "t1", name: "Root Canal Therapy", treatmentCode: "D3310" },
          { id: "t2", name: "Porcelain Crown", treatmentCode: "D2740" },
          { id: "t3", name: "Composite Filling", treatmentCode: "D2391" },
          { id: "t4", name: "Prophylaxis", treatmentCode: "D1110" }
        ])
        
      } catch (error) {
        console.error('Error fetching treatment plan data:', error)
        toast({
          title: "Error",
          description: "Failed to load treatment plans",
          variant: "destructive"
        })
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [patientId, toast])

  // Get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'bg-gray-100 text-gray-800'
      case 'proposed': return 'bg-blue-100 text-blue-800'
      case 'approved': return 'bg-green-100 text-green-800'
      case 'active': return 'bg-purple-100 text-purple-800'
      case 'completed': return 'bg-green-100 text-green-800'
      case 'cancelled': return 'bg-red-100 text-red-800'
      case 'on_hold': return 'bg-yellow-100 text-yellow-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  // Get priority color
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'emergency': return 'text-red-600'
      case 'immediate': return 'text-orange-600'
      case 'intermediate': return 'text-blue-600'
      case 'maintenance': return 'text-green-600'
      case 'elective': return 'text-purple-600'
      default: return 'text-gray-600'
    }
  }

  // Get priority icon
  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'emergency': return <Zap className="w-4 h-4 text-red-500" />
      case 'immediate': return <AlertCircle className="w-4 h-4 text-orange-500" />
      case 'intermediate': return <Activity className="w-4 h-4 text-blue-500" />
      case 'maintenance': return <Shield className="w-4 h-4 text-green-500" />
      case 'elective': return <Target className="w-4 h-4 text-purple-500" />
      default: return <Activity className="w-4 h-4 text-gray-500" />
    }
  }

  // Calculate plan progress
  const calculatePlanProgress = (plan: TreatmentPlan) => {
    if (!plan.phases.length) return 0
    const totalPhases = plan.phases.length
    const completedPhases = plan.phases.filter(p => p.status === 'completed').length
    return Math.round((completedPhases / totalPhases) * 100)
  }

  // Handle plan selection
  const handlePlanSelect = (plan: TreatmentPlan) => {
    setSelectedPlan(plan)
    onPlanSelect?.(plan)
  }

  // Handle create treatment plan
  const handleCreatePlan = async () => {
    try {
      const response = await fetch('/api/treatment-plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...planForm,
          patientId,
          dentalRecordId
        })
      })

      if (response.ok) {
        const data = await response.json()
        setTreatmentPlans(prev => [data.data.treatmentPlan, ...prev])
        setShowCreateDialog(false)
        setPlanForm({
          title: '',
          description: '',
          priority: 'intermediate',
          notes: '',
          phases: []
        })
        toast({
          title: "Success",
          description: "Treatment plan created successfully"
        })
      }
    } catch (error) {
      console.error('Error creating treatment plan:', error)
      toast({
        title: "Error",
        description: "Failed to create treatment plan",
        variant: "destructive"
      })
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">Treatment Plans</h3>
          <p className="text-sm text-gray-600">Comprehensive treatment planning and tracking</p>
        </div>
        {editable && (
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                New Treatment Plan
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Create Treatment Plan</DialogTitle>
                <DialogDescription>
                  Design a comprehensive treatment plan for the patient
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="title">Plan Title</Label>
                  <Input
                    id="title"
                    value={planForm.title}
                    onChange={(e) => setPlanForm(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="Enter treatment plan title..."
                  />
                </div>
                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={planForm.description}
                    onChange={(e) => setPlanForm(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Describe the treatment objectives and approach..."
                    rows={3}
                  />
                </div>
                <div>
                  <Label htmlFor="priority">Priority</Label>
                  <Select value={planForm.priority} onValueChange={(value) => setPlanForm(prev => ({ ...prev, priority: value }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="emergency">Emergency</SelectItem>
                      <SelectItem value="immediate">Immediate</SelectItem>
                      <SelectItem value="intermediate">Intermediate</SelectItem>
                      <SelectItem value="maintenance">Maintenance</SelectItem>
                      <SelectItem value="elective">Elective</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="notes">Clinical Notes</Label>
                  <Textarea
                    id="notes"
                    value={planForm.notes}
                    onChange={(e) => setPlanForm(prev => ({ ...prev, notes: e.target.value }))}
                    placeholder="Additional notes, considerations, or special instructions..."
                    rows={2}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreatePlan}>
                  Create Plan
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Treatment Plans Grid */}
      <div className="grid gap-6">
        {treatmentPlans.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center h-64">
              <FileText className="w-12 h-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Treatment Plans</h3>
              <p className="text-gray-600 text-center mb-4">
                Create a treatment plan to organize and track comprehensive care
              </p>
              {editable && (
                <Button onClick={() => setShowCreateDialog(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Create First Plan
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          treatmentPlans.map((plan) => (
            <Card key={plan.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => handlePlanSelect(plan)}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <CardTitle className="flex items-center space-x-2">
                      {getPriorityIcon(plan.priority)}
                      <span>{plan.title}</span>
                    </CardTitle>
                    <CardDescription className="mt-1">
                      Plan #{plan.planNumber} • {plan.phases.length} phase{plan.phases.length !== 1 ? 's' : ''}
                    </CardDescription>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge className={getStatusColor(plan.status)}>
                      {plan.status.replace('_', ' ').toUpperCase()}
                    </Badge>
                    <Badge variant="outline" className={getPriorityColor(plan.priority)}>
                      {plan.priority.toUpperCase()}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent>
                <div className="space-y-4">
                  {/* Description */}
                  {plan.description && (
                    <p className="text-gray-600 text-sm">{plan.description}</p>
                  )}

                  {/* Progress */}
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium">Progress</span>
                      <span className="text-sm text-gray-600">{calculatePlanProgress(plan)}%</span>
                    </div>
                    <Progress value={calculatePlanProgress(plan)} className="h-2" />
                  </div>

                  {/* Key Metrics */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center">
                      <div className="flex items-center justify-center mb-1">
                        <PesoIcon className="w-4 h-4 text-green-600" />
                      </div>
                      <p className="text-lg font-bold text-green-600">{formatCurrency(plan.estimatedCost, 'PHP')}</p>
                      <p className="text-xs text-gray-600">Total Cost</p>
                    </div>
                    <div className="text-center">
                      <div className="flex items-center justify-center mb-1">
                        <Clock className="w-4 h-4 text-blue-600" />
                      </div>
                      <p className="text-lg font-bold text-blue-600">{Math.round(plan.estimatedDuration / 60)}h</p>
                      <p className="text-xs text-gray-600">Duration</p>
                    </div>
                    <div className="text-center">
                      <div className="flex items-center justify-center mb-1">
                        <Shield className="w-4 h-4 text-purple-600" />
                      </div>
                      <p className="text-lg font-bold text-purple-600">{formatCurrency(plan.insuranceEstimate, 'PHP')}</p>
                      <p className="text-xs text-gray-600">Insurance</p>
                    </div>
                    <div className="text-center">
                      <div className="flex items-center justify-center mb-1">
                        <Users className="w-4 h-4 text-orange-600" />
                      </div>
                      <p className="text-lg font-bold text-orange-600">{formatCurrency(plan.patientPortion, 'PHP')}</p>
                      <p className="text-xs text-gray-600">Patient Pay</p>
                    </div>
                  </div>

                  {/* Phases Preview */}
                  <div>
                    <h4 className="font-medium text-sm mb-2">Treatment Phases</h4>
                    <div className="space-y-2">
                      {plan.phases.slice(0, 3).map((phase) => (
                        <div key={phase.id} className="flex items-center justify-between p-2 bg-gray-50 rounded text-sm">
                          <div className="flex items-center space-x-2">
                            <div className={`w-2 h-2 rounded-full ${phase.status === 'completed' ? 'bg-green-500' : phase.status === 'in_progress' ? 'bg-blue-500' : 'bg-gray-300'}`}></div>
                            <span>Phase {phase.phaseNumber}: {phase.title}</span>
                          </div>
                          <span className="text-gray-600">{phase.completionPercent}%</span>
                        </div>
                      ))}
                      {plan.phases.length > 3 && (
                        <p className="text-xs text-gray-500 text-center">+{plan.phases.length - 3} more phases</p>
                      )}
                    </div>
                  </div>

                  {/* Risks & Prerequisites */}
                  {(plan.risks.length > 0 || plan.prerequisites.length > 0) && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      {plan.risks.length > 0 && (
                        <div>
                          <p className="font-medium text-red-700 mb-1">Risks</p>
                          <ul className="text-gray-600 list-disc list-inside text-xs">
                            {plan.risks.slice(0, 2).map((risk, index) => (
                              <li key={index}>{risk}</li>
                            ))}
                            {plan.risks.length > 2 && <li>+{plan.risks.length - 2} more...</li>}
                          </ul>
                        </div>
                      )}
                      
                      {plan.prerequisites.length > 0 && (
                        <div>
                          <p className="font-medium text-orange-700 mb-1">Prerequisites</p>
                          <ul className="text-gray-600 list-disc list-inside text-xs">
                            {plan.prerequisites.slice(0, 2).map((prereq, index) => (
                              <li key={index}>{prereq}</li>
                            ))}
                            {plan.prerequisites.length > 2 && <li>+{plan.prerequisites.length - 2} more...</li>}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Timeline */}
                  {(plan.startDate || plan.targetEndDate) && (
                    <div className="flex items-center space-x-4 text-sm text-gray-600">
                      {plan.startDate && (
                        <div className="flex items-center space-x-1">
                          <Calendar className="w-4 h-4" />
                          <span>Start: {new Date(plan.startDate).toLocaleDateString()}</span>
                        </div>
                      )}
                      {plan.targetEndDate && (
                        <div className="flex items-center space-x-1">
                          <Target className="w-4 h-4" />
                          <span>Target: {new Date(plan.targetEndDate).toLocaleDateString()}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Selected Plan Details */}
      {selectedPlan && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <TrendingUp className="w-5 h-5" />
              <span>Plan Details: {selectedPlan.title}</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="overview" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="phases">Phases</TabsTrigger>
                <TabsTrigger value="timeline">Timeline</TabsTrigger>
                <TabsTrigger value="financial">Financial</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-medium mb-2">Description</h4>
                    <p className="text-gray-600">{selectedPlan.description || 'No description provided'}</p>
                  </div>
                  <div>
                    <h4 className="font-medium mb-2">Clinical Notes</h4>
                    <p className="text-gray-600">{selectedPlan.notes || 'No notes provided'}</p>
                  </div>
                </div>
                
                {selectedPlan.alternatives && (
                  <div>
                    <h4 className="font-medium mb-2">Alternative Treatment Options</h4>
                    <div className="bg-blue-50 p-4 rounded-lg">
                      <pre className="text-sm text-gray-700">{JSON.stringify(selectedPlan.alternatives, null, 2)}</pre>
                    </div>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="phases" className="space-y-4">
                <div className="space-y-4">
                  {selectedPlan.phases.map((phase) => (
                    <Card key={phase.id}>
                      <CardHeader>
                        <div className="flex justify-between items-start">
                          <CardTitle className="text-lg">Phase {phase.phaseNumber}: {phase.title}</CardTitle>
                          <div className="flex items-center space-x-2">
                            <Badge className={getStatusColor(phase.status)}>
                              {phase.status.replace('_', ' ').toUpperCase()}
                            </Badge>
                            <span className="text-sm text-gray-600">{phase.completionPercent}%</span>
                          </div>
                        </div>
                        {phase.description && (
                          <CardDescription>{phase.description}</CardDescription>
                        )}
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          <Progress value={phase.completionPercent} className="h-2" />
                          
                          {/* Phase Items */}
                          <div>
                            <h5 className="font-medium mb-2">Treatments ({phase.phaseItems.length})</h5>
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Sequence</TableHead>
                                  <TableHead>Treatment</TableHead>
                                  <TableHead>Tooth</TableHead>
                                  <TableHead>Cost</TableHead>
                                  <TableHead>Duration</TableHead>
                                  <TableHead>Status</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {phase.phaseItems.map((item) => (
                                  <TableRow key={item.id}>
                                    <TableCell>{item.sequence}</TableCell>
                                    <TableCell>
                                      <div>
                                        <p className="font-medium">{item.treatment.name}</p>
                                        <p className="text-xs text-gray-600">{item.treatment.treatmentCode}</p>
                                      </div>
                                    </TableCell>
                                    <TableCell>
                                      {item.toothNumber ? (
                                        <div>
                                          <span>#{item.toothNumber}</span>
                                          {item.surfaces.length > 0 && (
                                            <p className="text-xs text-gray-600">
                                              Surfaces: {item.surfaces.join(', ')}
                                            </p>
                                          )}
                                        </div>
                                      ) : (
                                        <span className="text-gray-400">General</span>
                                      )}
                                    </TableCell>
                                    <TableCell>{formatCurrency(item.estimatedCost, 'PHP')}</TableCell>
                                    <TableCell>{item.estimatedDuration}min</TableCell>
                                    <TableCell>
                                      <Badge className={getStatusColor(item.status)}>
                                        {item.status.replace('_', ' ').toUpperCase()}
                                      </Badge>
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>

                          {/* Phase Timeline */}
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <p className="font-medium text-gray-700">Planned Timeline</p>
                              <div className="space-y-1">
                                {phase.plannedStartDate && (
                                  <p className="text-gray-600">Start: {new Date(phase.plannedStartDate).toLocaleDateString()}</p>
                                )}
                                {phase.plannedEndDate && (
                                  <p className="text-gray-600">End: {new Date(phase.plannedEndDate).toLocaleDateString()}</p>
                                )}
                              </div>
                            </div>
                            <div>
                              <p className="font-medium text-gray-700">Actual Timeline</p>
                              <div className="space-y-1">
                                {phase.actualStartDate && (
                                  <p className="text-green-600">Started: {new Date(phase.actualStartDate).toLocaleDateString()}</p>
                                )}
                                {phase.actualEndDate && (
                                  <p className="text-green-600">Completed: {new Date(phase.actualEndDate).toLocaleDateString()}</p>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="timeline" className="space-y-4">
                <div className="relative">
                  {/* Timeline visualization would go here */}
                  <p className="text-gray-600">Timeline visualization coming soon...</p>
                </div>
              </TabsContent>

              <TabsContent value="financial" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <Card>
                    <CardContent className="p-6 text-center">
                      <PesoIcon className="w-8 h-8 text-green-600 mx-auto mb-2" />
                      <p className="text-2xl font-bold text-green-600">{formatCurrency(selectedPlan.estimatedCost, 'PHP')}</p>
                      <p className="text-sm text-gray-600">Total Estimated Cost</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-6 text-center">
                      <Shield className="w-8 h-8 text-purple-600 mx-auto mb-2" />
                      <p className="text-2xl font-bold text-purple-600">{formatCurrency(selectedPlan.insuranceEstimate, 'PHP')}</p>
                      <p className="text-sm text-gray-600">Insurance Coverage</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-6 text-center">
                      <Users className="w-8 h-8 text-orange-600 mx-auto mb-2" />
                      <p className="text-2xl font-bold text-orange-600">{formatCurrency(selectedPlan.patientPortion, 'PHP')}</p>
                      <p className="text-sm text-gray-600">Patient Responsibility</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Cost Breakdown by Phase */}
                <Card>
                  <CardHeader>
                    <CardTitle>Cost Breakdown by Phase</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Phase</TableHead>
                          <TableHead>Estimated Cost</TableHead>
                          <TableHead>Duration</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedPlan.phases.map((phase) => (
                          <TableRow key={phase.id}>
                            <TableCell>
                              Phase {phase.phaseNumber}: {phase.title}
                            </TableCell>
                            <TableCell>{formatCurrency(phase.estimatedCost, 'PHP')}</TableCell>
                            <TableCell>{Math.round(phase.estimatedDuration / 60)}h {phase.estimatedDuration % 60}min</TableCell>
                            <TableCell>
                              <Badge className={getStatusColor(phase.status)}>
                                {phase.status.replace('_', ' ').toUpperCase()}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}
    </div>
  )
}


'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { 
  Calendar, 

  CheckCircle, 
  Clock, 
  AlertTriangle,
  Plus,
  Edit,
  Trash2,
  FileText,
  Shield
} from 'lucide-react'
import { PesoIcon, PesoSign } from '@/components/ui/peso-icon'

interface TreatmentPlan {
  id: string
  patientId: string
  title: string
  description: string
  status: 'draft' | 'proposed' | 'approved' | 'in_progress' | 'completed' | 'cancelled'
  phases: TreatmentPhase[]
  totalCost: number
  estimatedDuration: number // in weeks
  createdAt: string
  updatedAt: string
}

interface TreatmentPhase {
  id: string
  phaseNumber: number
  title: string
  description: string
  procedures: PhaseProcedure[]
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled'
  startDate?: string
  endDate?: string
  estimatedCost: number
  actualCost?: number
  insuranceCoverage?: InsuranceCoverage
}

interface PhaseProcedure {
  id: string
  code: string
  name: string
  description: string
  detailedDescription?: string
  tooth?: string
  surface?: string
  cost: number
  duration: number // in minutes
  priority: 'urgent' | 'high' | 'normal' | 'low'
  status: 'planned' | 'scheduled' | 'completed' | 'cancelled'
  notes?: string
  requiresAnesthesia?: boolean
  followUpRequired?: boolean
  alternativeTreatments?: string[]
}

interface InsuranceCoverage {
  provider: string
  coveragePercentage: number
  deductible: number
  maximumBenefit: number
  preAuthRequired: boolean
  preAuthStatus?: 'pending' | 'approved' | 'denied'
  preAuthNumber?: string
}

interface TreatmentPlanningProps {
  patientId: string
  onPlanCreate?: (plan: TreatmentPlan) => void
  onPlanUpdate?: (plan: TreatmentPlan) => void
}

export default function TreatmentPlanning({ patientId, onPlanCreate, onPlanUpdate }: TreatmentPlanningProps) {
  const [treatmentPlans, setTreatmentPlans] = useState<TreatmentPlan[]>([])
  const [selectedPlan, setSelectedPlan] = useState<string>('')
  const [editing, setEditing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [expandedProcedures, setExpandedProcedures] = useState<Set<string>>(new Set())

  // Form state for new/edit plan
  const [planForm, setPlanForm] = useState({
    title: '',
    description: '',
    phases: [] as any[]
  })

  // Mock treatment plan data
  const mockTreatmentPlans: TreatmentPlan[] = [
    {
      id: 'plan-1',
      patientId,
      title: 'Comprehensive Dental Restoration',
      description: 'Complete dental rehabilitation including cleanings, fillings, and cosmetic improvements',
      status: 'in_progress',
      totalCost: 4850.00,
      estimatedDuration: 12,
      createdAt: '2024-09-01T10:00:00Z',
      updatedAt: '2024-09-05T14:30:00Z',
      phases: [
        {
          id: 'phase-1',
          phaseNumber: 1,
          title: 'Initial Assessment & Cleaning',
          description: 'Comprehensive examination, X-rays, and professional cleaning',
          status: 'completed',
          startDate: '2024-09-01T09:00:00Z',
          endDate: '2024-09-01T10:30:00Z',
          estimatedCost: 280.00,
          actualCost: 280.00,
          procedures: [
            {
              id: 'proc-1',
              code: 'D0150',
              name: 'Comprehensive Oral Evaluation',
              description: 'Complete diagnostic examination including medical/dental history review',
              detailedDescription: 'This comprehensive evaluation includes a thorough examination of your mouth, teeth, gums, and surrounding structures. We will review your medical and dental history, perform a clinical examination, take necessary X-rays, and discuss any concerns or symptoms you may have. This allows us to create a personalized treatment plan tailored to your specific needs.',
              cost: 120.00,
              duration: 45,
              priority: 'normal',
              status: 'completed',
              requiresAnesthesia: false,
              followUpRequired: false,
              alternativeTreatments: ['Limited oral evaluation (D0140)', 'Periodic oral evaluation (D0120)']
            },
            {
              id: 'proc-2',
              code: 'D1110',
              name: 'Adult Prophylaxis (Dental Cleaning)',
              description: 'Professional removal of plaque, calculus, and stains from teeth',
              detailedDescription: 'A professional dental cleaning that involves the removal of plaque, tartar (calculus), and surface stains from above and slightly below the gum line. This procedure includes scaling and polishing of all tooth surfaces, followed by a fluoride treatment to help strengthen tooth enamel and prevent decay. Regular prophylaxis helps maintain oral health and prevents gum disease.',
              cost: 160.00,
              duration: 60,
              priority: 'normal',
              status: 'completed',
              requiresAnesthesia: false,
              followUpRequired: false,
              alternativeTreatments: ['Deep cleaning (scaling and root planing)', 'Periodontal maintenance']
            }
          ],
          insuranceCoverage: {
            provider: 'Delta Dental',
            coveragePercentage: 80,
            deductible: 50,
            maximumBenefit: 1000,
            preAuthRequired: false
          }
        },
        {
          id: 'phase-2',
          phaseNumber: 2,
          title: 'Restorative Work',
          description: 'Fillings and crowns for damaged teeth',
          status: 'in_progress',
          startDate: '2024-09-15T14:00:00Z',
          estimatedCost: 2400.00,
          procedures: [
            {
              id: 'proc-3',
              code: 'D2140',
              name: 'Amalgam Restoration - One Surface',
              description: 'Silver filling to restore damaged tooth structure',
              detailedDescription: 'An amalgam (silver) filling is used to restore a tooth that has been damaged by decay. The decayed portion of the tooth is removed, and the cavity is cleaned and shaped to prepare it for the filling. The amalgam material is then placed and shaped to restore the tooth\'s function and appearance. Amalgam fillings are durable, long-lasting, and cost-effective.',
              tooth: '#18',
              surface: 'O',
              cost: 180.00,
              duration: 45,
              priority: 'high',
              status: 'completed',
              requiresAnesthesia: true,
              followUpRequired: false,
              alternativeTreatments: ['Composite filling (tooth-colored)', 'Inlay/onlay restoration']
            },
            {
              id: 'proc-4',
              code: 'D2750',
              name: 'Crown - Porcelain Fused to Metal',
              description: 'Full coverage crown restoration with porcelain exterior',
              detailedDescription: 'A crown is a tooth-shaped cap that completely covers a damaged or weakened tooth. This porcelain-fused-to-metal crown combines the strength of metal with the natural appearance of porcelain. The procedure involves removing some tooth structure, taking impressions, and placing a temporary crown while the permanent one is made. The final crown is cemented in place, restoring the tooth\'s strength, function, and appearance.',
              tooth: '#14',
              cost: 1200.00,
              duration: 120,
              priority: 'normal',
              status: 'scheduled',
              notes: 'Patient prefers porcelain crown',
              requiresAnesthesia: true,
              followUpRequired: true,
              alternativeTreatments: ['All-porcelain crown', 'Gold crown', 'Large filling with buildup']
            }
          ],
          insuranceCoverage: {
            provider: 'Delta Dental',
            coveragePercentage: 50,
            deductible: 0,
            maximumBenefit: 1000,
            preAuthRequired: true,
            preAuthStatus: 'approved',
            preAuthNumber: 'PA-2024-12345'
          }
        },
        {
          id: 'phase-3',
          phaseNumber: 3,
          title: 'Cosmetic Enhancement',
          description: 'Teeth whitening and cosmetic bonding',
          status: 'pending',
          estimatedCost: 1200.00,
          procedures: [
            {
              id: 'proc-5',
              code: 'D9972',
              name: 'Professional Teeth Whitening - Per Arch',
              description: 'Professional bleaching treatment to lighten tooth color',
              detailedDescription: 'Professional teeth whitening is a cosmetic procedure that uses a stronger bleaching agent than over-the-counter products to remove stains and discoloration from teeth. The process involves applying a whitening gel to your teeth and may use a special light to enhance the bleaching process. Treatment can lighten teeth by several shades, giving you a brighter, more confident smile. Results typically last 1-3 years with proper care.',
              cost: 400.00,
              duration: 90,
              priority: 'low',
              status: 'planned',
              requiresAnesthesia: false,
              followUpRequired: false,
              alternativeTreatments: ['At-home whitening trays', 'Over-the-counter whitening products', 'Whitening toothpaste']
            },
            {
              id: 'proc-6',
              code: 'D2330',
              name: 'Composite Resin Filling - One Surface',
              description: 'Tooth-colored filling material for natural appearance',
              detailedDescription: 'A composite resin filling is a tooth-colored restoration used to repair teeth affected by decay, cracks, fractures, or other damage. The composite material is carefully matched to your natural tooth color for an aesthetically pleasing result. The decayed or damaged portion of the tooth is removed, the area is cleaned and prepared, and the composite is applied in layers and hardened with a special light. This creates a strong bond with the tooth structure.',
              tooth: '#8',
              surface: 'F',
              cost: 200.00,
              duration: 60,
              priority: 'low',
              status: 'planned',
              requiresAnesthesia: true,
              followUpRequired: false,
              alternativeTreatments: ['Amalgam filling', 'Porcelain inlay', 'Glass ionomer filling']
            }
          ]
        }
      ]
    }
  ]

  useEffect(() => {
    // Simulate loading treatment plans
    setTimeout(() => {
      setTreatmentPlans(mockTreatmentPlans)
      if (mockTreatmentPlans.length > 0) {
        setSelectedPlan(mockTreatmentPlans[0].id)
      }
      setLoading(false)
    }, 1000)
  }, [patientId])

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800'
      case 'in_progress': return 'bg-blue-100 text-blue-800'
      case 'approved': return 'bg-purple-100 text-purple-800'
      case 'pending': return 'bg-yellow-100 text-yellow-800'
      case 'cancelled': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-100 text-red-800'
      case 'high': return 'bg-orange-100 text-orange-800'
      case 'normal': return 'bg-blue-100 text-blue-800'
      case 'low': return 'bg-gray-100 text-gray-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const calculatePhaseProgress = (phase: TreatmentPhase) => {
    const completedProcedures = phase.procedures.filter(p => p.status === 'completed').length
    return (completedProcedures / phase.procedures.length) * 100
  }

  const selectedPlanData = treatmentPlans.find(plan => plan.id === selectedPlan)

  const toggleProcedureDetails = (procedureId: string) => {
    setExpandedProcedures(prev => {
      const newSet = new Set(prev)
      if (newSet.has(procedureId)) {
        newSet.delete(procedureId)
      } else {
        newSet.add(procedureId)
      }
      return newSet
    })
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
          <h2 className="text-2xl font-bold">Treatment Planning</h2>
          <p className="text-gray-600">Multi-phase treatment plans with progress tracking</p>
        </div>
        <Button onClick={() => setEditing(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Create Plan
        </Button>
      </div>

      {/* Treatment Plan Selector */}
      {treatmentPlans.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-4">
              <Label htmlFor="planSelect">Select Treatment Plan:</Label>
              <Select value={selectedPlan} onValueChange={setSelectedPlan}>
                <SelectTrigger className="w-96">
                  <SelectValue placeholder="Choose a treatment plan" />
                </SelectTrigger>
                <SelectContent>
                  {treatmentPlans.map(plan => (
                    <SelectItem key={plan.id} value={plan.id}>
                      <div className="flex items-center space-x-2">
                        <span>{plan.title}</span>
                        <Badge className={getStatusColor(plan.status)} variant="secondary">
                          {plan.status.replace('_', ' ')}
                        </Badge>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Treatment Plan Details */}
      {selectedPlanData && (
        <div className="space-y-6">
          {/* Plan Overview */}
          <Card>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="flex items-center space-x-2">
                    <FileText className="w-5 h-5" />
                    <span>{selectedPlanData.title}</span>
                  </CardTitle>
                  <p className="text-gray-600 mt-1">{selectedPlanData.description}</p>
                </div>
                <div className="flex items-center space-x-2">
                  <Badge className={getStatusColor(selectedPlanData.status)}>
                    {selectedPlanData.status.replace('_', ' ')}
                  </Badge>
                  <Button variant="outline" size="sm">
                    <Edit className="w-4 h-4 mr-1" />
                    Edit
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <PesoIcon className="w-8 h-8 text-green-600 mx-auto mb-2" />
                  <div className="text-2xl font-bold text-green-600">
                    ₱{selectedPlanData.totalCost.toFixed(2)}
                  </div>
                  <div className="text-sm text-green-800">Total Cost</div>
                </div>
                
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <Calendar className="w-8 h-8 text-blue-600 mx-auto mb-2" />
                  <div className="text-2xl font-bold text-blue-600">
                    {selectedPlanData.estimatedDuration}
                  </div>
                  <div className="text-sm text-blue-800">Weeks</div>
                </div>
                
                <div className="text-center p-4 bg-purple-50 rounded-lg">
                  <FileText className="w-8 h-8 text-purple-600 mx-auto mb-2" />
                  <div className="text-2xl font-bold text-purple-600">
                    {selectedPlanData.phases.length}
                  </div>
                  <div className="text-sm text-purple-800">Phases</div>
                </div>
                
                <div className="text-center p-4 bg-orange-50 rounded-lg">
                  <CheckCircle className="w-8 h-8 text-orange-600 mx-auto mb-2" />
                  <div className="text-2xl font-bold text-orange-600">
                    {selectedPlanData.phases.filter(p => p.status === 'completed').length}
                  </div>
                  <div className="text-sm text-orange-800">Completed</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Treatment Phases */}
          <div className="space-y-4">
            {selectedPlanData.phases.map((phase, index) => (
              <Card key={phase.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="flex items-center space-x-2">
                        <span className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm font-bold">
                          {phase.phaseNumber}
                        </span>
                        <span>{phase.title}</span>
                      </CardTitle>
                      <p className="text-gray-600 mt-1">{phase.description}</p>
                    </div>
                    <Badge className={getStatusColor(phase.status)}>
                      {phase.status.replace('_', ' ')}
                    </Badge>
                  </div>
                </CardHeader>
                
                <CardContent className="space-y-4">
                  {/* Phase Progress */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Phase Progress</span>
                      <span>{Math.round(calculatePhaseProgress(phase))}%</span>
                    </div>
                    <Progress value={calculatePhaseProgress(phase)} className="h-2" />
                  </div>

                  {/* Phase Details */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="font-medium">Estimated Cost: </span>
                      <span>₱{phase.estimatedCost.toFixed(2)}</span>
                    </div>
                    {phase.actualCost && (
                      <div>
                        <span className="font-medium">Actual Cost: </span>
                        <span>₱{phase.actualCost.toFixed(2)}</span>
                      </div>
                    )}
                    {phase.startDate && (
                      <div>
                        <span className="font-medium">Start Date: </span>
                        <span>{new Date(phase.startDate).toLocaleDateString()}</span>
                      </div>
                    )}
                    {phase.endDate && (
                      <div>
                        <span className="font-medium">End Date: </span>
                        <span>{new Date(phase.endDate).toLocaleDateString()}</span>
                      </div>
                    )}
                  </div>

                  {/* Insurance Coverage */}
                  {phase.insuranceCoverage && (
                    <div className="p-3 bg-blue-50 rounded-lg">
                      <div className="flex items-center space-x-2 mb-2">
                        <Shield className="w-4 h-4 text-blue-600" />
                        <span className="font-medium text-blue-900">Insurance Coverage</span>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                        <div>
                          <span className="text-blue-800">Provider: </span>
                          <span>{phase.insuranceCoverage.provider}</span>
                        </div>
                        <div>
                          <span className="text-blue-800">Coverage: </span>
                          <span>{phase.insuranceCoverage.coveragePercentage}%</span>
                        </div>
                        <div>
                          <span className="text-blue-800">Deductible: </span>
                          <span>₱{phase.insuranceCoverage.deductible}</span>
                        </div>
                        {phase.insuranceCoverage.preAuthRequired && (
                          <div>
                            <span className="text-blue-800">Pre-Auth: </span>
                            <Badge variant="outline" className={
                              phase.insuranceCoverage.preAuthStatus === 'approved' ? 'text-green-600' :
                              phase.insuranceCoverage.preAuthStatus === 'denied' ? 'text-red-600' :
                              'text-yellow-600'
                            }>
                              {phase.insuranceCoverage.preAuthStatus || 'Pending'}
                            </Badge>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Procedures */}
                  <div className="space-y-2">
                    <h4 className="font-medium">Procedures</h4>
                    <div className="space-y-2">
                      {phase.procedures.map(procedure => {
                        const isExpanded = expandedProcedures.has(procedure.id)
                        return (
                          <div key={procedure.id} className="border border-gray-200 bg-white rounded-lg overflow-hidden">
                            <div className="flex justify-between items-center p-3 cursor-pointer hover:bg-gray-50" onClick={() => toggleProcedureDetails(procedure.id)}>
                              <div className="flex-1">
                                <div className="flex items-center space-x-2">
                                  <span className="font-medium">{procedure.code}</span>
                                  <Badge className={getPriorityColor(procedure.priority)} variant="secondary">
                                    {procedure.priority}
                                  </Badge>
                                  <Badge className={getStatusColor(procedure.status)} variant="secondary">
                                    {procedure.status}
                                  </Badge>
                                </div>
                                <p className="text-sm font-medium text-gray-900">{procedure.name}</p>
                                <p className="text-sm text-gray-600">{procedure.description}</p>
                                {procedure.tooth && (
                                  <p className="text-xs text-gray-500">
                                    Tooth: {procedure.tooth}{procedure.surface ? ` (${procedure.surface})` : ''}
                                  </p>
                                )}
                                {procedure.notes && (
                                  <p className="text-xs text-blue-600 mt-1">Note: {procedure.notes}</p>
                                )}
                              </div>
                              <div className="text-right">
                                <div className="font-medium">₱{procedure.cost.toFixed(2)}</div>
                                <div className="text-sm text-gray-600">{procedure.duration} min</div>
                                <div className="text-xs text-gray-500 mt-1">
                                  {isExpanded ? '▲ Less' : '▼ More'}
                                </div>
                              </div>
                            </div>
                            
                            {isExpanded && (
                              <div className="border-t bg-blue-50 p-4 space-y-3">
                                {/* Detailed Description */}
                                <div>
                                  <h5 className="text-sm font-medium text-blue-900 mb-1">Detailed Description</h5>
                                  <p className="text-sm text-blue-800">{procedure.detailedDescription}</p>
                                </div>
                                
                                {/* Additional Information */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <div>
                                    <h5 className="text-sm font-medium text-blue-900 mb-1">Treatment Details</h5>
                                    <div className="space-y-1 text-sm text-blue-800">
                                      <div className="flex items-center space-x-2">
                                        <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                                        <span>Duration: {procedure.duration} minutes</span>
                                      </div>
                                      <div className="flex items-center space-x-2">
                                        <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                                        <span>Anesthesia: {procedure.requiresAnesthesia ? 'Required' : 'Not required'}</span>
                                      </div>
                                      <div className="flex items-center space-x-2">
                                        <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                                        <span>Follow-up: {procedure.followUpRequired ? 'Required' : 'Not required'}</span>
                                      </div>
                                      <div className="flex items-center space-x-2">
                                        <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                                        <span>Priority: {procedure.priority.charAt(0).toUpperCase() + procedure.priority.slice(1)}</span>
                                      </div>
                                    </div>
                                  </div>
                                  
                                  {procedure.alternativeTreatments && procedure.alternativeTreatments.length > 0 && (
                                    <div>
                                      <h5 className="text-sm font-medium text-blue-900 mb-1">Alternative Treatments</h5>
                                      <div className="space-y-1">
                                        {procedure.alternativeTreatments.map((alt, index) => (
                                          <div key={index} className="flex items-center space-x-2 text-sm text-blue-800">
                                            <span className="w-2 h-2 bg-orange-400 rounded-full"></span>
                                            <span>{alt}</span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                                
                                {/* Action Buttons */}
                                <div className="flex space-x-2 pt-2 border-t border-blue-200">
                                  {procedure.status === 'planned' && (
                                    <Button size="sm" variant="outline">
                                      <Calendar className="w-3 h-3 mr-1" />
                                      Schedule
                                    </Button>
                                  )}
                                  <Button size="sm" variant="outline">
                                    <Edit className="w-3 h-3 mr-1" />
                                    Edit
                                  </Button>
                                  <Button size="sm" variant="outline">
                                    <FileText className="w-3 h-3 mr-1" />
                                    Details
                                  </Button>
                                </div>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  {/* Phase Actions */}
                  <div className="flex space-x-2 pt-4 border-t">
                    {phase.status === 'pending' && (
                      <Button size="sm">
                        <Calendar className="w-4 h-4 mr-1" />
                        Schedule Phase
                      </Button>
                    )}
                    {phase.insuranceCoverage?.preAuthRequired && !phase.insuranceCoverage.preAuthNumber && (
                      <Button variant="outline" size="sm">
                        <Shield className="w-4 h-4 mr-1" />
                        Request Pre-Auth
                      </Button>
                    )}
                    <Button variant="outline" size="sm">
                      <Edit className="w-4 h-4 mr-1" />
                      Edit Phase
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Cost Estimation Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Cost Estimation Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-3">
                  <h4 className="font-medium">Treatment Costs</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Subtotal:</span>
                      <span>₱{selectedPlanData.totalCost.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Insurance Coverage (Est.):</span>
                      <span className="text-green-600">-$1,400.00</span>
                    </div>
                    <div className="flex justify-between font-medium border-t pt-2">
                      <span>Patient Responsibility:</span>
                      <span>₱{(selectedPlanData.totalCost - 1400).toFixed(2)}</span>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-3">
                  <h4 className="font-medium">Payment Options</h4>
                  <div className="space-y-2 text-sm">
                    <Button variant="outline" className="w-full justify-start">
                      Pay in Full (5% discount)
                    </Button>
                    <Button variant="outline" className="w-full justify-start">
                      3-Month Plan ($1,150/month)
                    </Button>
                    <Button variant="outline" className="w-full justify-start">
                      6-Month Plan ($575/month)
                    </Button>
                    <Button variant="outline" className="w-full justify-start">
                      12-Month Plan ($290/month)
                    </Button>
                  </div>
                </div>
                
                <div className="space-y-3">
                  <h4 className="font-medium">Next Steps</h4>
                  <div className="space-y-2">
                    <Button className="w-full" size="sm">
                      <CheckCircle className="w-4 h-4 mr-1" />
                      Approve Plan
                    </Button>
                    <Button variant="outline" className="w-full" size="sm">
                      <Calendar className="w-4 h-4 mr-1" />
                      Schedule Next Phase
                    </Button>
                    <Button variant="outline" className="w-full" size="sm">
                      <FileText className="w-4 h-4 mr-1" />
                      Print Treatment Plan
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Empty State */}
      {treatmentPlans.length === 0 && (
        <Card>
          <CardContent className="text-center py-16">
            <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Treatment Plans</h3>
            <p className="text-gray-600 mb-4">Create a comprehensive treatment plan for this patient.</p>
            <Button onClick={() => setEditing(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Create Treatment Plan
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

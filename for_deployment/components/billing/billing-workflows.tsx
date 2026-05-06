
'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { 
  Play, 
  Pause, 
  CheckCircle, 
  Clock, 
  AlertTriangle,
  FileText,
  Send,

  Calendar,
  Settings
} from 'lucide-react'
import { PesoIcon, PesoSign } from '@/components/ui/peso-icon'

interface BillingWorkflow {
  id: string
  name: string
  description: string
  status: 'active' | 'paused' | 'completed' | 'failed'
  trigger: string
  steps: WorkflowStep[]
  lastRun?: string
  nextRun?: string
  executionCount: number
}

interface WorkflowStep {
  id: string
  name: string
  description: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped'
  duration?: number
  result?: any
}

export default function BillingWorkflows() {
  const [workflows, setWorkflows] = useState<BillingWorkflow[]>([])
  const [loading, setLoading] = useState(true)
  const [executing, setExecuting] = useState<string | null>(null)

  // Mock workflow data
  const mockWorkflows: BillingWorkflow[] = [
    {
      id: 'workflow-1',
      name: 'Automatic Invoice Generation',
      description: 'Automatically generate invoices 24 hours after appointment completion',
      status: 'active',
      trigger: 'appointment_completed',
      executionCount: 147,
      lastRun: '2024-09-09T06:00:00Z',
      nextRun: '2024-09-10T06:00:00Z',
      steps: [
        {
          id: 'step-1',
          name: 'Validate Appointment',
          description: 'Verify appointment is completed and has treatments',
          status: 'completed'
        },
        {
          id: 'step-2', 
          name: 'Calculate Charges',
          description: 'Calculate total charges based on treatments',
          status: 'completed'
        },
        {
          id: 'step-3',
          name: 'Generate Invoice',
          description: 'Create invoice record in database',
          status: 'completed'
        },
        {
          id: 'step-4',
          name: 'Send Notification',
          description: 'Notify patient and staff about new invoice',
          status: 'completed'
        }
      ]
    },
    {
      id: 'workflow-2',
      name: 'Payment Reminder Sequence',
      description: 'Send payment reminders at 7, 14, and 30 days overdue',
      status: 'active',
      trigger: 'invoice_overdue',
      executionCount: 89,
      lastRun: '2024-09-08T12:00:00Z',
      nextRun: '2024-09-09T12:00:00Z',
      steps: [
        {
          id: 'step-1',
          name: 'Check Overdue Invoices',
          description: 'Find invoices past due date',
          status: 'completed'
        },
        {
          id: 'step-2',
          name: 'Determine Reminder Level',
          description: 'Calculate days overdue and reminder level',
          status: 'completed'
        },
        {
          id: 'step-3',
          name: 'Send Reminder',
          description: 'Send email/SMS reminder to patient',
          status: 'running'
        },
        {
          id: 'step-4',
          name: 'Update Status',
          description: 'Mark reminder as sent',
          status: 'pending'
        }
      ]
    },
    {
      id: 'workflow-3',
      name: 'Insurance Claim Processing',
      description: 'Automatically submit and track insurance claims',
      status: 'active',
      trigger: 'invoice_with_insurance',
      executionCount: 234,
      lastRun: '2024-09-09T08:30:00Z',
      nextRun: '2024-09-09T20:30:00Z',
      steps: [
        {
          id: 'step-1',
          name: 'Validate Insurance Info',
          description: 'Check patient insurance details',
          status: 'completed'
        },
        {
          id: 'step-2',
          name: 'Prepare Claim',
          description: 'Generate claim with procedure codes',
          status: 'completed'
        },
        {
          id: 'step-3',
          name: 'Submit to Clearinghouse',
          description: 'Send claim electronically',
          status: 'completed'
        },
        {
          id: 'step-4',
          name: 'Track Status',
          description: 'Monitor claim processing status',
          status: 'completed'
        }
      ]
    },
    {
      id: 'workflow-4',
      name: 'Payment Plan Setup',
      description: 'Automatically create payment plans for large invoices',
      status: 'active',
      trigger: 'large_invoice_created',
      executionCount: 23,
      lastRun: '2024-09-07T15:45:00Z',
      nextRun: '2024-09-10T10:00:00Z',
      steps: [
        {
          id: 'step-1',
          name: 'Check Invoice Amount',
          description: 'Verify invoice exceeds payment plan threshold',
          status: 'completed'
        },
        {
          id: 'step-2',
          name: 'Calculate Plan Options',
          description: 'Generate 3, 6, and 12 month payment plans',
          status: 'completed'
        },
        {
          id: 'step-3',
          name: 'Send Plan Options',
          description: 'Email payment plan options to patient',
          status: 'failed',
          result: { error: 'Email delivery failed' }
        },
        {
          id: 'step-4',
          name: 'Setup Chosen Plan',
          description: 'Create payment schedule when patient responds',
          status: 'skipped'
        }
      ]
    }
  ]

  useEffect(() => {
    // Simulate loading workflows
    setTimeout(() => {
      setWorkflows(mockWorkflows)
      setLoading(false)
    }, 1000)
  }, [])

  const executeWorkflow = async (workflowId: string) => {
    setExecuting(workflowId)
    
    // Simulate workflow execution
    const workflow = workflows.find(w => w.id === workflowId)
    if (!workflow) return

    // Update workflow steps to show progress
    for (let i = 0; i < workflow.steps.length; i++) {
      await new Promise(resolve => setTimeout(resolve, 800))
      
      setWorkflows(prev => prev.map(w => 
        w.id === workflowId ? {
          ...w,
          steps: w.steps.map((step, index) => 
            index === i ? { ...step, status: 'running' as const } :
            index < i ? { ...step, status: 'completed' as const } : step
          )
        } : w
      ))
    }
    
    // Mark workflow as completed
    setWorkflows(prev => prev.map(w => 
      w.id === workflowId ? {
        ...w,
        steps: w.steps.map(step => ({ ...step, status: 'completed' as const })),
        lastRun: new Date().toISOString(),
        executionCount: w.executionCount + 1
      } : w
    ))

    setExecuting(null)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800'
      case 'paused': return 'bg-yellow-100 text-yellow-800'
      case 'completed': return 'bg-blue-100 text-blue-800'
      case 'failed': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getStepStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-green-600'
      case 'running': return 'text-blue-600'
      case 'failed': return 'text-red-600'
      case 'skipped': return 'text-yellow-600'
      default: return 'text-gray-500'
    }
  }

  const getStepIcon = (status: string) => {
    switch (status) {
      case 'completed': return CheckCircle
      case 'running': return Clock
      case 'failed': return AlertTriangle
      default: return Clock
    }
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
          <h2 className="text-2xl font-bold">Automated Billing Workflows</h2>
          <p className="text-gray-600">Streamline billing processes with automation</p>
        </div>
        <Button variant="outline">
          <Settings className="w-4 h-4 mr-2" />
          Configure
        </Button>
      </div>

      {/* Workflow Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {workflows.filter(w => w.status === 'active').length}
              </div>
              <div className="text-sm text-gray-600">Active Workflows</div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {workflows.reduce((sum, w) => sum + w.executionCount, 0)}
              </div>
              <div className="text-sm text-gray-600">Total Executions</div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">98.5%</div>
              <div className="text-sm text-gray-600">Success Rate</div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">2.4hrs</div>
              <div className="text-sm text-gray-600">Time Saved Daily</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Workflows List */}
      <div className="space-y-4">
        {workflows.map((workflow) => (
          <Card key={workflow.id} className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-4">
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="flex items-center space-x-2">
                    <FileText className="w-5 h-5" />
                    <span>{workflow.name}</span>
                  </CardTitle>
                  <p className="text-sm text-gray-600 mt-1">{workflow.description}</p>
                </div>
                <div className="flex items-center space-x-2">
                  <Badge className={getStatusColor(workflow.status)}>
                    {workflow.status.charAt(0).toUpperCase() + workflow.status.slice(1)}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            
            <CardContent className="space-y-4">
              {/* Workflow Metrics */}
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="font-medium">Trigger: </span>
                  <span className="text-gray-600">{workflow.trigger.replace('_', ' ')}</span>
                </div>
                <div>
                  <span className="font-medium">Executions: </span>
                  <span className="text-gray-600">{workflow.executionCount}</span>
                </div>
                <div>
                  <span className="font-medium">Last Run: </span>
                  <span className="text-gray-600">
                    {workflow.lastRun ? new Date(workflow.lastRun).toLocaleDateString() : 'Never'}
                  </span>
                </div>
              </div>

              {/* Workflow Steps */}
              <div className="space-y-3">
                <h4 className="font-medium">Workflow Steps</h4>
                <div className="space-y-2">
                  {workflow.steps.map((step, index) => {
                    const StepIcon = getStepIcon(step.status)
                    return (
                      <div key={step.id} className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-white">
                          {step.status === 'running' ? (
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                          ) : (
                            <StepIcon className={`w-4 h-4 ${getStepStatusColor(step.status)}`} />
                          )}
                        </div>
                        <div className="flex-1">
                          <div className="flex justify-between items-start">
                            <div>
                              <h5 className="font-medium text-sm">{step.name}</h5>
                              <p className="text-xs text-gray-600">{step.description}</p>
                            </div>
                            <Badge variant="outline" className={getStepStatusColor(step.status)}>
                              {step.status}
                            </Badge>
                          </div>
                          {step.result?.error && (
                            <p className="text-xs text-red-600 mt-1">Error: {step.result.error}</p>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Next Scheduled Run */}
              {workflow.nextRun && (
                <div className="p-3 bg-blue-50 rounded-lg">
                  <div className="flex items-center space-x-2">
                    <Calendar className="w-4 h-4 text-blue-600" />
                    <span className="text-sm font-medium text-blue-900">Next Run:</span>
                    <span className="text-sm text-blue-800">
                      {new Date(workflow.nextRun).toLocaleString()}
                    </span>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex space-x-2 pt-4 border-t">
                <Button
                  onClick={() => executeWorkflow(workflow.id)}
                  disabled={executing === workflow.id || workflow.status === 'paused'}
                  size="sm"
                >
                  {executing === workflow.id ? (
                    <>
                      <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-2"></div>
                      Running...
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 mr-1" />
                      Run Now
                    </>
                  )}
                </Button>
                
                <Button variant="outline" size="sm">
                  <Pause className="w-4 h-4 mr-1" />
                  {workflow.status === 'paused' ? 'Resume' : 'Pause'}
                </Button>
                
                <Button variant="outline" size="sm">
                  <Settings className="w-4 h-4 mr-1" />
                  Configure
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Workflow Templates */}
      <Card>
        <CardHeader>
          <CardTitle>Available Workflow Templates</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="p-4 border rounded-lg hover:bg-gray-50 cursor-pointer">
              <div className="flex items-center space-x-3 mb-2">
                <PesoIcon className="w-8 h-8 text-green-600" />
                <h4 className="font-medium">Late Fee Calculator</h4>
              </div>
              <p className="text-sm text-gray-600">Automatically add late fees to overdue accounts</p>
            </div>
            
            <div className="p-4 border rounded-lg hover:bg-gray-50 cursor-pointer">
              <div className="flex items-center space-x-3 mb-2">
                <Send className="w-8 h-8 text-blue-600" />
                <div>
                  <h4 className="font-medium">Statement Generator</h4>
                </div>
              </div>
              <p className="text-sm text-gray-600">Generate and send monthly patient statements</p>
            </div>
            
            <div className="p-4 border rounded-lg hover:bg-gray-50 cursor-pointer">
              <div className="flex items-center space-x-3 mb-2">
                <FileText className="w-8 h-8 text-purple-600" />
                <div>
                  <h4 className="font-medium">Credit Check</h4>
                </div>
              </div>
              <p className="text-sm text-gray-600">Verify patient credit for payment plans</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

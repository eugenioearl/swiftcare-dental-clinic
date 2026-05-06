
'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { 
  Shield, 
  FileText, 
  CheckCircle, 
  Clock, 
  AlertTriangle,
  Send,
  Download,
  RefreshCw
} from 'lucide-react'

interface InsuranceClaim {
  id: string
  claimNumber: string
  patientId: string
  appointmentId: string
  provider: string
  status: 'draft' | 'submitted' | 'pending' | 'approved' | 'denied' | 'paid'
  submittedAt?: string
  approvedAmount?: number
  deniedReason?: string
  procedures: ClaimProcedure[]
}

interface ClaimProcedure {
  code: string
  description: string
  chargedAmount: number
  approvedAmount?: number
  quantity: number
}

interface InsuranceClaimAutomationProps {
  billingId: string
  patientId: string
  appointmentId: string
}

export default function InsuranceClaimAutomation({
  billingId,
  patientId,
  appointmentId
}: InsuranceClaimAutomationProps) {
  const [claims, setClaims] = useState<InsuranceClaim[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [selectedClaim, setSelectedClaim] = useState<string>('')

  // Mock insurance claim data
  useEffect(() => {
    const fetchClaims = async () => {
      try {
        const response = await fetch(`/api/billing/insurance/claims?appointmentId=${appointmentId}`)
        if (response.ok) {
          const data = await response.json()
          setClaims(data.data.claims || [])
        }
      } catch (error) {
        console.error('Error fetching claims:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchClaims()
  }, [appointmentId])

  const submitClaim = async (claimId: string) => {
    setSubmitting(true)
    try {
      const response = await fetch(`/api/billing/insurance/claims/${claimId}/submit`, {
        method: 'POST'
      })

      if (response.ok) {
        // Update claim status
        setClaims(prev => prev.map(claim => 
          claim.id === claimId 
            ? { ...claim, status: 'submitted', submittedAt: new Date().toISOString() }
            : claim
        ))
      }
    } catch (error) {
      console.error('Error submitting claim:', error)
    } finally {
      setSubmitting(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'bg-green-100 text-green-800'
      case 'paid': return 'bg-blue-100 text-blue-800'
      case 'denied': return 'bg-red-100 text-red-800'
      case 'pending': return 'bg-yellow-100 text-yellow-800'
      case 'submitted': return 'bg-purple-100 text-purple-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
      case 'paid':
        return CheckCircle
      case 'denied':
        return AlertTriangle
      case 'pending':
      case 'submitted':
        return Clock
      default:
        return FileText
    }
  }

  // Mock claim data for demonstration
  const mockClaims: InsuranceClaim[] = [
    {
      id: 'claim-1',
      claimNumber: 'CLM-2024-001',
      patientId,
      appointmentId,
      provider: 'Delta Dental',
      status: 'approved',
      submittedAt: '2024-09-01T10:00:00Z',
      approvedAmount: 280.00,
      procedures: [
        {
          code: 'D0120',
          description: 'Periodic oral evaluation',
          chargedAmount: 80.00,
          approvedAmount: 80.00,
          quantity: 1
        },
        {
          code: 'D1110',
          description: 'Adult prophylaxis',
          chargedAmount: 120.00,
          approvedAmount: 100.00,
          quantity: 1
        },
        {
          code: 'D2140',
          description: 'Amalgam restoration - one surface',
          chargedAmount: 150.00,
          approvedAmount: 100.00,
          quantity: 1
        }
      ]
    },
    {
      id: 'claim-2',
      claimNumber: 'CLM-2024-002',
      patientId,
      appointmentId,
      provider: 'Blue Cross Blue Shield',
      status: 'pending',
      submittedAt: '2024-09-05T14:30:00Z',
      procedures: [
        {
          code: 'D0220',
          description: 'Intraoral periapical first radiographic image',
          chargedAmount: 45.00,
          quantity: 2
        }
      ]
    }
  ]

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
          <h2 className="text-2xl font-bold">Insurance Claims</h2>
          <p className="text-gray-600">Automated claim processing and management</p>
        </div>
        <Button variant="outline">
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh Status
        </Button>
      </div>

      {/* Claims Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">2</div>
              <div className="text-sm text-gray-600">Total Claims</div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600">1</div>
              <div className="text-sm text-gray-600">Pending</div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">1</div>
              <div className="text-sm text-gray-600">Approved</div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">₱280</div>
              <div className="text-sm text-gray-600">Total Approved</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Claims List */}
      <div className="space-y-4">
        {mockClaims.map((claim) => {
          const StatusIcon = getStatusIcon(claim.status)
          return (
            <Card key={claim.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-4">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="flex items-center space-x-2">
                      <Shield className="w-5 h-5" />
                      <span>Claim #{claim.claimNumber}</span>
                    </CardTitle>
                    <p className="text-sm text-gray-600 mt-1">
                      Provider: {claim.provider}
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge className={getStatusColor(claim.status)}>
                      <StatusIcon className="w-3 h-3 mr-1" />
                      {claim.status.charAt(0).toUpperCase() + claim.status.slice(1)}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent className="space-y-4">
                {/* Claim Progress */}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Claim Progress</span>
                    <span>
                      {claim.status === 'approved' || claim.status === 'paid' ? '100%' : 
                       claim.status === 'pending' ? '75%' :
                       claim.status === 'submitted' ? '50%' : '25%'}
                    </span>
                  </div>
                  <Progress 
                    value={
                      claim.status === 'approved' || claim.status === 'paid' ? 100 : 
                      claim.status === 'pending' ? 75 :
                      claim.status === 'submitted' ? 50 : 25
                    } 
                    className="h-2" 
                  />
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>Draft</span>
                    <span>Submitted</span>
                    <span>Pending</span>
                    <span>Approved</span>
                  </div>
                </div>

                {/* Procedures */}
                <div>
                  <h4 className="font-medium mb-2">Procedures</h4>
                  <div className="space-y-2">
                    {claim.procedures.map((procedure, index) => (
                      <div key={index} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                        <div>
                          <span className="font-medium">{procedure.code}</span>
                          <p className="text-sm text-gray-600">{procedure.description}</p>
                          <p className="text-xs text-gray-500">Qty: {procedure.quantity}</p>
                        </div>
                        <div className="text-right">
                          <div className="font-medium">₱{procedure.chargedAmount.toFixed(2)}</div>
                          {procedure.approvedAmount && (
                            <div className="text-sm text-green-600">
                              Approved: ₱{procedure.approvedAmount.toFixed(2)}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Claim Details */}
                {claim.submittedAt && (
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium">Submitted: </span>
                      {new Date(claim.submittedAt).toLocaleDateString()}
                    </div>
                    {claim.approvedAmount && (
                      <div>
                        <span className="font-medium">Approved Amount: </span>
                        <span className="text-green-600">₱{claim.approvedAmount.toFixed(2)}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Actions */}
                <div className="flex space-x-2 pt-4 border-t">
                  {claim.status === 'draft' && (
                    <Button 
                      onClick={() => submitClaim(claim.id)}
                      disabled={submitting}
                      size="sm"
                    >
                      {submitting ? (
                        <>
                          <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-2"></div>
                          Submitting...
                        </>
                      ) : (
                        <>
                          <Send className="w-4 h-4 mr-1" />
                          Submit Claim
                        </>
                      )}
                    </Button>
                  )}
                  
                  <Button variant="outline" size="sm">
                    <FileText className="w-4 h-4 mr-1" />
                    View Details
                  </Button>
                  
                  <Button variant="outline" size="sm">
                    <Download className="w-4 h-4 mr-1" />
                    Download
                  </Button>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Automated Features */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Shield className="w-5 h-5 mr-2" />
            Automated Claim Processing
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-green-50 rounded-lg">
              <div className="flex items-center space-x-3">
                <CheckCircle className="w-8 h-8 text-green-600" />
                <div>
                  <h4 className="font-medium text-green-900">Auto-Generation</h4>
                  <p className="text-sm text-green-800">Claims automatically generated from appointments</p>
                </div>
              </div>
            </div>
            
            <div className="p-4 bg-blue-50 rounded-lg">
              <div className="flex items-center space-x-3">
                <Send className="w-8 h-8 text-blue-600" />
                <div>
                  <h4 className="font-medium text-blue-900">Electronic Submission</h4>
                  <p className="text-sm text-blue-800">Direct submission to insurance providers</p>
                </div>
              </div>
            </div>
            
            <div className="p-4 bg-purple-50 rounded-lg">
              <div className="flex items-center space-x-3">
                <RefreshCw className="w-8 h-8 text-purple-600" />
                <div>
                  <h4 className="font-medium text-purple-900">Status Tracking</h4>
                  <p className="text-sm text-purple-800">Real-time claim status updates</p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

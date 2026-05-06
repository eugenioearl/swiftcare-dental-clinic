
'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  Eye, 
  Download, 
  Printer,
  Shield,
  User,
  Calendar,
  Clock,
  FileText,
  Signature,
  Lock,
  Unlock,
  MessageSquare
} from 'lucide-react'
import { toast } from 'react-hot-toast'

interface FormSubmission {
  id: string
  formId: string
  formTitle: string
  patientId: string
  patientName: string
  patientEmail: string
  submittedAt: string
  status: 'submitted' | 'under_review' | 'verified' | 'approved' | 'rejected' | 'requires_revision'
  data: Record<string, any>
  signatures: {
    patient?: {
      signature: string
      timestamp: string
      ipAddress: string
      deviceInfo: string
    }
    witness?: {
      signature: string
      timestamp: string
      userId: string
      name: string
    }
    provider?: {
      signature: string
      timestamp: string
      userId: string
      name: string
      title: string
    }
  }
  verification?: {
    reviewedBy: string
    reviewedAt: string
    verificationNotes: string
    status: 'verified' | 'rejected'
    requiresRevision: boolean
    revisionNotes?: string
  }
  approval?: {
    approvedBy: string
    approvedAt: string
    approvalNotes: string
    finalApproval: boolean
  }
  auditTrail: {
    action: string
    performedBy: string
    performedAt: string
    details: string
    ipAddress?: string
  }[]
  attachments?: {
    id: string
    filename: string
    cloudStoragePath: string
    uploadedBy: string
    uploadedAt: string
  }[]
}

interface FormVerificationSystemProps {
  userRole: 'staff' | 'dentist' | 'manager' | 'admin'
  userId: string
  userName: string
}

export default function FormVerificationSystem({
  userRole,
  userId,
  userName
}: FormVerificationSystemProps) {
  const [submissions, setSubmissions] = useState<FormSubmission[]>([])
  const [selectedSubmission, setSelectedSubmission] = useState<FormSubmission | null>(null)
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false)
  const [verificationNotes, setVerificationNotes] = useState('')
  const [approvalNotes, setApprovalNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState<'all' | 'pending' | 'verified' | 'approved' | 'rejected'>('all')

  // Mock data - in production this would come from API
  useEffect(() => {
    const mockSubmissions: FormSubmission[] = [
      {
        id: 'sub_001',
        formId: 'form_intake',
        formTitle: 'Patient Intake Form',
        patientId: 'pat_001',
        patientName: 'John Smith',
        patientEmail: 'john.smith@email.com',
        submittedAt: '2024-09-09T10:30:00Z',
        status: 'submitted',
        data: {
          firstName: 'John',
          lastName: 'Smith',
          dateOfBirth: '1985-03-15',
          phone: '+1-555-0123',
          email: 'john.smith@email.com',
          address: '123 Main St, Anytown, USA',
          emergencyContact: 'Jane Smith - 555-0124',
          reasonForVisit: 'Regular checkup and cleaning',
          medicalHistory: 'No significant medical history',
          currentMedications: 'None',
          allergies: 'No known allergies'
        },
        signatures: {
          patient: {
            signature: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
            timestamp: '2024-09-09T10:29:45Z',
            ipAddress: '192.168.1.1',
            deviceInfo: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
          }
        },
        auditTrail: [
          {
            action: 'form_submitted',
            performedBy: 'pat_001',
            performedAt: '2024-09-09T10:30:00Z',
            details: 'Patient submitted intake form',
            ipAddress: '192.168.1.1'
          }
        ]
      },
      {
        id: 'sub_002',
        formId: 'form_consent',
        formTitle: 'Treatment Consent Form',
        patientId: 'pat_002',
        patientName: 'Sarah Johnson',
        patientEmail: 'sarah.johnson@email.com',
        submittedAt: '2024-09-08T14:15:00Z',
        status: 'under_review',
        data: {
          patientName: 'Sarah Johnson',
          treatmentDescription: 'Root canal treatment for tooth #18',
          understandsRisks: true,
          alternativeTreatments: 'Tooth extraction, no treatment',
          questionsAnswered: true,
          consentGiven: true
        },
        signatures: {
          patient: {
            signature: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
            timestamp: '2024-09-08T14:14:30Z',
            ipAddress: '192.168.1.2',
            deviceInfo: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)'
          }
        },
        verification: {
          reviewedBy: 'staff_001',
          reviewedAt: '2024-09-08T15:00:00Z',
          verificationNotes: 'Initial review completed, pending provider approval',
          status: 'verified',
          requiresRevision: false
        },
        auditTrail: [
          {
            action: 'form_submitted',
            performedBy: 'pat_002',
            performedAt: '2024-09-08T14:15:00Z',
            details: 'Patient submitted treatment consent form'
          },
          {
            action: 'form_reviewed',
            performedBy: 'staff_001',
            performedAt: '2024-09-08T15:00:00Z',
            details: 'Staff completed initial verification'
          }
        ]
      }
    ]
    
    setSubmissions(mockSubmissions)
  }, [])

  const filteredSubmissions = submissions.filter(submission => {
    if (filter === 'all') return true
    if (filter === 'pending') return ['submitted', 'under_review'].includes(submission.status)
    if (filter === 'verified') return submission.status === 'verified'
    if (filter === 'approved') return submission.status === 'approved'
    if (filter === 'rejected') return submission.status === 'rejected'
    return true
  })

  const handleVerifyForm = async (submissionId: string, status: 'verified' | 'rejected') => {
    if (!verificationNotes.trim() && status === 'rejected') {
      toast.error('Please provide verification notes for rejection')
      return
    }

    setLoading(true)
    
    try {
      // In production, this would be an API call
      const updatedSubmissions = submissions.map(sub => {
        if (sub.id === submissionId) {
          return {
            ...sub,
            status: status === 'verified' ? 'verified' : 'rejected' as any,
            verification: {
              reviewedBy: userId,
              reviewedAt: new Date().toISOString(),
              verificationNotes,
              status,
              requiresRevision: status === 'rejected'
            },
            auditTrail: [
              ...sub.auditTrail,
              {
                action: `form_${status}`,
                performedBy: userId,
                performedAt: new Date().toISOString(),
                details: `Form ${status} by ${userName}: ${verificationNotes}`
              }
            ]
          }
        }
        return sub
      })

      setSubmissions(updatedSubmissions)
      setVerificationNotes('')
      setIsViewDialogOpen(false)
      
      toast.success(`Form ${status} successfully`)
      
    } catch (error) {
      console.error('Error verifying form:', error)
      toast.error('Failed to verify form')
    } finally {
      setLoading(false)
    }
  }

  const handleApproveForm = async (submissionId: string, approved: boolean) => {
    if (!approvalNotes.trim() && !approved) {
      toast.error('Please provide approval notes')
      return
    }

    setLoading(true)
    
    try {
      const updatedSubmissions = submissions.map(sub => {
        if (sub.id === submissionId) {
          return {
            ...sub,
            status: approved ? 'approved' : 'rejected' as any,
            approval: {
              approvedBy: userId,
              approvedAt: new Date().toISOString(),
              approvalNotes,
              finalApproval: approved
            },
            auditTrail: [
              ...sub.auditTrail,
              {
                action: approved ? 'form_approved' : 'form_rejected',
                performedBy: userId,
                performedAt: new Date().toISOString(),
                details: `Form ${approved ? 'approved' : 'rejected'} by ${userName}: ${approvalNotes}`
              }
            ]
          }
        }
        return sub
      })

      setSubmissions(updatedSubmissions)
      setApprovalNotes('')
      setIsViewDialogOpen(false)
      
      toast.success(`Form ${approved ? 'approved' : 'rejected'} successfully`)
      
    } catch (error) {
      console.error('Error approving form:', error)
      toast.error('Failed to process approval')
    } finally {
      setLoading(false)
    }
  }

  const canVerify = ['staff', 'manager', 'admin'].includes(userRole)
  const canApprove = ['dentist', 'manager', 'admin'].includes(userRole)

  const getStatusBadge = (status: FormSubmission['status']) => {
    const statusConfig = {
      submitted: { color: 'bg-blue-100 text-blue-800', icon: FileText },
      under_review: { color: 'bg-yellow-100 text-yellow-800', icon: Eye },
      verified: { color: 'bg-green-100 text-green-800', icon: CheckCircle2 },
      approved: { color: 'bg-emerald-100 text-emerald-800', icon: Shield },
      rejected: { color: 'bg-red-100 text-red-800', icon: XCircle },
      requires_revision: { color: 'bg-orange-100 text-orange-800', icon: AlertTriangle }
    }
    
    const config = statusConfig[status]
    const Icon = config.icon
    
    return (
      <Badge className={`${config.color} border-0`}>
        <Icon className="w-3 h-3 mr-1" />
        {status.replace('_', ' ').toUpperCase()}
      </Badge>
    )
  }

  const downloadFormPDF = (submission: FormSubmission) => {
    // In production, this would generate and download a PDF
    toast.success('PDF download functionality would be implemented here')
  }

  const printForm = (submission: FormSubmission) => {
    // In production, this would format and print the form
    window.print()
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Form Verification System</h1>
          <p className="text-muted-foreground">
            Review, verify, and approve patient form submissions
          </p>
        </div>
        
        <div className="flex items-center space-x-2">
          <Badge variant="outline">
            <User className="w-3 h-3 mr-1" />
            {userName} ({userRole})
          </Badge>
        </div>
      </div>

      {/* Filters */}
      <Tabs value={filter} onValueChange={(value: any) => setFilter(value)}>
        <TabsList>
          <TabsTrigger value="all">All Forms ({submissions.length})</TabsTrigger>
          <TabsTrigger value="pending">
            Pending ({submissions.filter(s => ['submitted', 'under_review'].includes(s.status)).length})
          </TabsTrigger>
          <TabsTrigger value="verified">
            Verified ({submissions.filter(s => s.status === 'verified').length})
          </TabsTrigger>
          <TabsTrigger value="approved">
            Approved ({submissions.filter(s => s.status === 'approved').length})
          </TabsTrigger>
          <TabsTrigger value="rejected">
            Rejected ({submissions.filter(s => s.status === 'rejected').length})
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Submissions List */}
      <div className="space-y-4">
        {filteredSubmissions.map((submission) => (
          <Card key={submission.id} className="hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-2">
                    <h3 className="font-semibold">{submission.formTitle}</h3>
                    {getStatusBadge(submission.status)}
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-muted-foreground">
                    <div>
                      <Label className="text-xs font-medium">Patient</Label>
                      <p>{submission.patientName}</p>
                    </div>
                    
                    <div>
                      <Label className="text-xs font-medium">Submitted</Label>
                      <p className="flex items-center">
                        <Calendar className="w-3 h-3 mr-1" />
                        {new Date(submission.submittedAt).toLocaleDateString()}
                      </p>
                    </div>
                    
                    <div>
                      <Label className="text-xs font-medium">Signatures</Label>
                      <p className="flex items-center">
                        <Signature className="w-3 h-3 mr-1" />
                        {Object.keys(submission.signatures).length} signature(s)
                      </p>
                    </div>
                    
                    {submission.verification && (
                      <div>
                        <Label className="text-xs font-medium">Verified By</Label>
                        <p className="flex items-center">
                          <Shield className="w-3 h-3 mr-1" />
                          Staff
                        </p>
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="flex space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedSubmission(submission)
                      setIsViewDialogOpen(true)
                    }}
                  >
                    <Eye className="w-4 h-4 mr-2" />
                    Review
                  </Button>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => downloadFormPDF(submission)}
                  >
                    <Download className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        
        {filteredSubmissions.length === 0 && (
          <Card>
            <CardContent className="p-8 text-center">
              <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-semibold mb-2">No forms to review</h3>
              <p className="text-muted-foreground">
                There are no form submissions matching your current filter.
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Form Review Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <FileText className="w-5 h-5" />
              <span>Review Form: {selectedSubmission?.formTitle}</span>
              {selectedSubmission && getStatusBadge(selectedSubmission.status)}
            </DialogTitle>
          </DialogHeader>
          
          {selectedSubmission && (
            <div className="space-y-6">
              {/* Form Details */}
              <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded">
                <div>
                  <Label className="font-medium">Patient Information</Label>
                  <div className="mt-1 space-y-1 text-sm">
                    <p><strong>Name:</strong> {selectedSubmission.patientName}</p>
                    <p><strong>Email:</strong> {selectedSubmission.patientEmail}</p>
                    <p><strong>Submitted:</strong> {new Date(selectedSubmission.submittedAt).toLocaleString()}</p>
                  </div>
                </div>
                
                <div>
                  <Label className="font-medium">Form Status</Label>
                  <div className="mt-1 space-y-2">
                    {getStatusBadge(selectedSubmission.status)}
                    {selectedSubmission.signatures.patient && (
                      <div className="flex items-center text-sm text-green-600">
                        <CheckCircle2 className="w-4 h-4 mr-1" />
                        Patient Signature Verified
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Form Data */}
              <div>
                <Label className="font-medium">Form Responses</Label>
                <div className="mt-2 space-y-3">
                  {Object.entries(selectedSubmission.data).map(([key, value]) => (
                    <div key={key} className="border-b pb-2">
                      <Label className="text-sm font-medium capitalize">
                        {key.replace(/([A-Z])/g, ' $1').trim()}
                      </Label>
                      <p className="text-sm mt-1">
                        {typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Signatures */}
              <div>
                <Label className="font-medium">Digital Signatures</Label>
                <div className="mt-2 space-y-2">
                  {Object.entries(selectedSubmission.signatures).map(([type, sig]) => (
                    <div key={type} className="border rounded p-3">
                      <div className="flex items-center justify-between mb-2">
                        <Label className="capitalize font-medium">{type} Signature</Label>
                        <Badge variant="outline">
                          <CheckCircle2 className="w-3 h-3 mr-1" />
                          Verified
                        </Badge>
                      </div>
                      <img 
                        src={sig.signature} 
                        alt={`${type} signature`} 
                        className="border rounded h-16 w-48"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Signed: {new Date(sig.timestamp).toLocaleString()}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Audit Trail */}
              <div>
                <Label className="font-medium">Audit Trail</Label>
                <div className="mt-2 space-y-2">
                  {selectedSubmission.auditTrail.map((entry, index) => (
                    <div key={index} className="flex items-start space-x-2 text-sm">
                      <Clock className="w-4 h-4 text-muted-foreground mt-0.5" />
                      <div>
                        <p className="font-medium">{entry.action.replace('_', ' ')}</p>
                        <p className="text-muted-foreground">{entry.details}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(entry.performedAt).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Verification Section */}
              {canVerify && selectedSubmission.status === 'submitted' && (
                <div className="border-t pt-4">
                  <Label className="font-medium">Staff Verification</Label>
                  <div className="mt-2 space-y-3">
                    <div>
                      <Label htmlFor="verificationNotes">Verification Notes</Label>
                      <Textarea
                        id="verificationNotes"
                        value={verificationNotes}
                        onChange={(e) => setVerificationNotes(e.target.value)}
                        placeholder="Add your verification notes..."
                        rows={3}
                      />
                    </div>
                    
                    <div className="flex space-x-2">
                      <Button
                        onClick={() => handleVerifyForm(selectedSubmission.id, 'verified')}
                        disabled={loading}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        <CheckCircle2 className="w-4 h-4 mr-2" />
                        Verify Form
                      </Button>
                      
                      <Button
                        variant="destructive"
                        onClick={() => handleVerifyForm(selectedSubmission.id, 'rejected')}
                        disabled={loading}
                      >
                        <XCircle className="w-4 h-4 mr-2" />
                        Reject Form
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* Provider Approval Section */}
              {canApprove && selectedSubmission.status === 'verified' && (
                <div className="border-t pt-4">
                  <Label className="font-medium">Provider Approval</Label>
                  <div className="mt-2 space-y-3">
                    <div>
                      <Label htmlFor="approvalNotes">Approval Notes</Label>
                      <Textarea
                        id="approvalNotes"
                        value={approvalNotes}
                        onChange={(e) => setApprovalNotes(e.target.value)}
                        placeholder="Add your approval notes..."
                        rows={3}
                      />
                    </div>
                    
                    <div className="flex space-x-2">
                      <Button
                        onClick={() => handleApproveForm(selectedSubmission.id, true)}
                        disabled={loading}
                        className="bg-emerald-600 hover:bg-emerald-700"
                      >
                        <Shield className="w-4 h-4 mr-2" />
                        Approve Form
                      </Button>
                      
                      <Button
                        variant="destructive"
                        onClick={() => handleApproveForm(selectedSubmission.id, false)}
                        disabled={loading}
                      >
                        <XCircle className="w-4 h-4 mr-2" />
                        Reject Form
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex justify-between pt-4 border-t">
                <div className="flex space-x-2">
                  <Button
                    variant="outline"
                    onClick={() => downloadFormPDF(selectedSubmission)}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Download PDF
                  </Button>
                  
                  <Button
                    variant="outline"
                    onClick={() => printForm(selectedSubmission)}
                  >
                    <Printer className="w-4 h-4 mr-2" />
                    Print
                  </Button>
                </div>
                
                <Button
                  variant="outline"
                  onClick={() => setIsViewDialogOpen(false)}
                >
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

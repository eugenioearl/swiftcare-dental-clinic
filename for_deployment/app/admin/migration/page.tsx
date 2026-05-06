'use client'

import { formatPatientName } from '@/lib/utils'
import { useState, useEffect, useRef } from 'react'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select'
import {
  Upload, FileText, Eye, CheckCircle, Clock, AlertCircle,
  Loader2, Search, Filter, ChevronRight, Download, Trash2,
  FileImage, File, X, UserPlus, Sparkles, ArrowRight, RefreshCw
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface UploadRecord {
  id: string
  patientId: string
  originalName: string
  mimeType: string | null
  fileSize: number | null
  extractionStatus: string
  classification: string | null
  classificationConfidence: number | null
  migrationStatus: string
  savedToRecords: boolean
  reviewNotes: string | null
  createdAt: string
  cloudStoragePath: string
  patient: { id: string; fullName: string; patientNumber: string }
  extractedData: any
  confidenceScores: any
}

interface PatientOption {
  id: string
  fullName: string | null
  patientNumber: string
  user?: { firstName: string; lastName: string; email: string } | null
}

const classColors: Record<string, string> = {
  consent: 'bg-purple-100 text-purple-700',
  chart: 'bg-blue-100 text-blue-700',
  notes: 'bg-green-100 text-green-700',
  package: 'bg-teal-100 text-teal-700',
  payment: 'bg-orange-100 text-orange-700',
  prescription: 'bg-pink-100 text-pink-700',
  xray: 'bg-indigo-100 text-indigo-700',
  referral: 'bg-cyan-100 text-cyan-700',
  other: 'bg-gray-100 text-gray-700',
  medical_history: 'bg-red-100 text-red-700',
}

const statusColors: Record<string, string> = {
  uploaded: 'bg-gray-100 text-gray-600',
  scanned: 'bg-yellow-100 text-yellow-700',
  reviewed: 'bg-blue-100 text-blue-700',
  migrated: 'bg-green-100 text-green-700',
}

export default function MigrationPage() {
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploads, setUploads] = useState<UploadRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [filterClass, setFilterClass] = useState<string>('all')

  // Review dialog
  const [selectedUpload, setSelectedUpload] = useState<UploadRecord | null>(null)
  const [reviewOpen, setReviewOpen] = useState(false)
  const [reviewNotes, setReviewNotes] = useState('')
  const [newClassification, setNewClassification] = useState('')
  const [saving, setSaving] = useState(false)
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null)
  const [loadingDoc, setLoadingDoc] = useState(false)

  // Upload dialog
  const [uploadOpen, setUploadOpen] = useState(false)
  const [uploadPatientId, setUploadPatientId] = useState('')
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState('')
  const [patients, setPatients] = useState<PatientOption[]>([])
  const [patientSearch, setPatientSearch] = useState('')
  const [loadingPatients, setLoadingPatients] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

  // Apply to patient
  const [applying, setApplying] = useState(false)

  // Delete
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => { fetchUploads() }, [])

  const fetchUploads = async () => {
    try {
      const res = await fetch('/api/admin/migration')
      const data = await res.json()
      if (data.success) setUploads(data.data)
    } catch (err) {
      console.error('Fetch uploads error:', err)
    } finally {
      setLoading(false)
    }
  }

  const searchPatients = async (q: string) => {
    if (q.length < 2) { setPatients([]); return }
    setLoadingPatients(true)
    try {
      const res = await fetch(`/api/patients?search=${encodeURIComponent(q)}&limit=10`)
      const data = await res.json()
      if (data.success) setPatients(data.data)
    } catch { }
    setLoadingPatients(false)
  }

  const handleFileUpload = async () => {
    if (!selectedFile || !uploadPatientId) return
    setUploading(true)
    setUploadProgress('Uploading file...')
    try {
      const formData = new FormData()
      formData.append('file', selectedFile)

      setUploadProgress('Uploading & scanning with AI...')
      const res = await fetch(`/api/patients/${uploadPatientId}/smart-upload`, {
        method: 'POST',
        body: formData,
      })
      const data = await res.json()
      if (data.success) {
        toast({ title: 'Document uploaded & scanned', description: `Classification: ${data.data.classification || 'Processing...'}` })
        setUploadOpen(false)
        setSelectedFile(null)
        setUploadPatientId('')
        setPatientSearch('')
        fetchUploads()
      } else {
        toast({ title: 'Upload failed', description: data.error, variant: 'destructive' })
      }
    } catch (err) {
      toast({ title: 'Upload error', variant: 'destructive' })
    }
    setUploading(false)
    setUploadProgress('')
  }

  const openReview = async (upload: UploadRecord) => {
    setSelectedUpload(upload)
    setReviewNotes(upload.reviewNotes || '')
    setNewClassification(upload.classification || 'other')
    setDownloadUrl(null)
    setReviewOpen(true)

    // Get download URL
    setLoadingDoc(true)
    try {
      const res = await fetch(`/api/patients/${upload.patientId}/smart-upload/${upload.id}`)
      const data = await res.json()
      if (data.success) setDownloadUrl(data.data.downloadUrl)
    } catch { }
    setLoadingDoc(false)
  }

  const handleSaveReview = async () => {
    if (!selectedUpload) return
    setSaving(true)
    try {
      await fetch(`/api/patients/${selectedUpload.patientId}/smart-upload/${selectedUpload.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          classification: newClassification,
          reviewNotes,
          migrationStatus: 'reviewed',
        })
      })
      toast({ title: 'Document reviewed' })
      setReviewOpen(false)
      fetchUploads()
    } catch { toast({ title: 'Save failed', variant: 'destructive' }) }
    setSaving(false)
  }

  const handleApplyToPatient = async () => {
    if (!selectedUpload || !selectedUpload.extractedData) return
    setApplying(true)
    try {
      const res = await fetch(`/api/patients/${selectedUpload.patientId}/smart-upload/${selectedUpload.id}/save-to-records`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          classification: newClassification || selectedUpload.classification,
          extractedData: selectedUpload.extractedData,
        })
      })
      const data = await res.json()
      if (data.success) {
        toast({ title: 'Data applied to patient record!', description: 'Extracted data has been saved to patient records.' })
        setReviewOpen(false)
        fetchUploads()
      } else {
        toast({ title: 'Apply failed', description: data.error, variant: 'destructive' })
      }
    } catch { toast({ title: 'Apply error', variant: 'destructive' }) }
    setApplying(false)
  }

  const handleDelete = async (uploadId: string, patientId: string) => {
    setDeleting(true)
    try {
      const res = await fetch(`/api/patients/${patientId}/smart-upload/${uploadId}`, {
        method: 'DELETE',
      })
      const data = await res.json()
      if (data.success) {
        toast({ title: 'Document deleted' })
        fetchUploads()
      } else {
        toast({ title: 'Delete failed', description: data.error, variant: 'destructive' })
      }
    } catch { toast({ title: 'Delete error', variant: 'destructive' }) }
    setDeleting(false)
    setDeleteConfirm(null)
    setReviewOpen(false)
  }

  const handleDownload = () => {
    if (!downloadUrl || !selectedUpload) return
    const a = document.createElement('a')
    a.href = downloadUrl
    a.download = selectedUpload.originalName
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  const filtered = uploads.filter(u => {
    const matchSearch = search === '' ||
      u.originalName.toLowerCase().includes(search.toLowerCase()) ||
      u.patient?.fullName?.toLowerCase().includes(search.toLowerCase()) ||
      u.patient?.patientNumber?.toLowerCase().includes(search.toLowerCase())
    const matchStatus = filterStatus === 'all' || u.migrationStatus === filterStatus
    const matchClass = filterClass === 'all' || (u.classification || 'unclassified') === filterClass
    return matchSearch && matchStatus && matchClass
  })

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return 'N/A'
    if (bytes < 1024) return `${bytes}B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
  }

  const getFileIcon = (mimeType: string | null) => mimeType?.startsWith('image/') ? FileImage : File

  const stats = {
    total: uploads.length,
    uploaded: uploads.filter(u => u.migrationStatus === 'uploaded').length,
    scanned: uploads.filter(u => u.migrationStatus === 'scanned').length,
    reviewed: uploads.filter(u => u.migrationStatus === 'reviewed').length,
    migrated: uploads.filter(u => u.migrationStatus === 'migrated').length,
  }

  const getPatientDisplayName = (p: PatientOption) => formatPatientName(p.fullName, p.user?.firstName, p.user?.lastName, p.patientNumber)

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Document Migration</h1>
            <p className="text-xs sm:text-sm text-gray-500 mt-1">Upload, scan with AI, review, and migrate patient documents</p>
          </div>
          <Button onClick={() => setUploadOpen(true)} className="bg-[#2D9DA8] hover:bg-[#258a93] text-white w-full sm:w-auto">
            <Upload className="w-4 h-4 mr-2" /> Upload Document
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {[
            { label: 'Total', value: stats.total, color: 'border-l-[#2D9DA8]' },
            { label: 'Uploaded', value: stats.uploaded, color: 'border-l-gray-400' },
            { label: 'AI Scanned', value: stats.scanned, color: 'border-l-yellow-400' },
            { label: 'Reviewed', value: stats.reviewed, color: 'border-l-blue-400' },
            { label: 'Migrated', value: stats.migrated, color: 'border-l-[#22B573]' },
          ].map(s => (
            <Card key={s.label} className={`border-l-4 ${s.color}`}>
              <CardContent className="pt-3 pb-2">
                <p className="text-xs text-gray-500 uppercase">{s.label}</p>
                <p className="text-xl font-bold">{s.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input placeholder="Search by file name or patient..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
              </div>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-[160px]"><Filter className="w-4 h-4 mr-1" /><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="uploaded">Uploaded</SelectItem>
                  <SelectItem value="scanned">AI Scanned</SelectItem>
                  <SelectItem value="reviewed">Reviewed</SelectItem>
                  <SelectItem value="migrated">Migrated</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterClass} onValueChange={setFilterClass}>
                <SelectTrigger className="w-[160px]"><FileText className="w-4 h-4 mr-1" /><SelectValue placeholder="Type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="consent">Consent</SelectItem>
                  <SelectItem value="chart">Chart</SelectItem>
                  <SelectItem value="notes">Notes</SelectItem>
                  <SelectItem value="medical_history">Medical History</SelectItem>
                  <SelectItem value="package">Package</SelectItem>
                  <SelectItem value="payment">Payment</SelectItem>
                  <SelectItem value="prescription">Prescription</SelectItem>
                  <SelectItem value="xray">X-Ray</SelectItem>
                  <SelectItem value="referral">Referral</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Upload List */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-[#2D9DA8]" />
          </div>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Upload className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">No documents found</p>
              <p className="text-xs text-gray-400 mt-1">Click &quot;Upload Document&quot; to scan and migrate patient records</p>
              <Button onClick={() => setUploadOpen(true)} variant="outline" className="mt-4">
                <Upload className="w-4 h-4 mr-2" /> Upload First Document
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {filtered.map(upload => {
              const FileIcon = getFileIcon(upload.mimeType)
              return (
                <Card key={upload.id} className="hover:shadow-md transition-shadow cursor-pointer group" onClick={() => openReview(upload)}>
                  <CardContent className="py-3 px-4">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                        <FileIcon className="w-5 h-5 text-gray-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <p className="text-sm font-medium text-gray-900 truncate">{upload.originalName}</p>
                          {upload.classification && (
                            <Badge className={`text-[10px] capitalize ${classColors[upload.classification] || 'bg-gray-100 text-gray-700'}`}>
                              {upload.classification.replace('_', ' ')}
                            </Badge>
                          )}
                          {upload.extractionStatus === 'completed' && (
                            <Badge className="text-[10px] bg-emerald-50 text-emerald-700">
                              <Sparkles className="w-3 h-3 mr-0.5" /> AI Scanned
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-gray-500">
                          <span className="font-medium">{upload.patient?.fullName || upload.patient?.patientNumber}</span>
                          <span>{formatFileSize(upload.fileSize)}</span>
                          <span>{new Date(upload.createdAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <Badge className={`text-xs ${statusColors[upload.migrationStatus] || 'bg-gray-100 text-gray-600'}`}>
                          {upload.migrationStatus}
                        </Badge>
                        {upload.classificationConfidence != null && upload.classificationConfidence > 0 && (
                          <span className="text-[10px] text-gray-400">{Math.round(upload.classificationConfidence * 100)}%</span>
                        )}
                        <button
                          onClick={(e) => { e.stopPropagation(); setDeleteConfirm(upload.id) }}
                          className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-all"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                        <ChevronRight className="w-4 h-4 text-gray-300" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}

        {/* Upload Dialog */}
        <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Upload className="w-5 h-5 text-[#2D9DA8]" /> Upload & Scan Document
              </DialogTitle>
              <DialogDescription>Upload a patient document to scan with AI and extract data automatically.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              {/* Patient search */}
              <div>
                <Label className="text-sm font-medium">Patient <span className="text-red-400">*</span></Label>
                <Input
                  placeholder="Search patient by name or number..."
                  value={patientSearch}
                  onChange={e => { setPatientSearch(e.target.value); searchPatients(e.target.value) }}
                  className="mt-1"
                />
                {loadingPatients && <p className="text-xs text-gray-400 mt-1">Searching...</p>}
                {patients.length > 0 && !uploadPatientId && (
                  <div className="mt-1 border rounded-lg max-h-32 overflow-y-auto">
                    {patients.map(p => (
                      <button key={p.id} onClick={() => { setUploadPatientId(p.id); setPatientSearch(getPatientDisplayName(p)) ; setPatients([]) }}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 border-b last:border-0">
                        <span className="font-medium">{getPatientDisplayName(p)}</span>
                        <span className="text-gray-400 ml-2">{p.patientNumber}</span>
                      </button>
                    ))}
                  </div>
                )}
                {uploadPatientId && (
                  <div className="mt-1 flex items-center gap-2">
                    <Badge className="bg-[#2D9DA8]/10 text-[#2D9DA8]">Patient selected</Badge>
                    <button onClick={() => { setUploadPatientId(''); setPatientSearch('') }} className="text-xs text-gray-400 hover:text-red-500">Change</button>
                  </div>
                )}
              </div>

              {/* File picker */}
              <div>
                <Label className="text-sm font-medium">Document <span className="text-red-400">*</span></Label>
                <div
                  className="mt-1 border-2 border-dashed border-gray-200 rounded-xl p-6 text-center cursor-pointer hover:border-[#2D9DA8] hover:bg-blue-50/30 transition-all"
                  onClick={() => fileInputRef.current?.click()}
                >
                  {selectedFile ? (
                    <div className="flex items-center justify-center gap-2">
                      <FileText className="w-5 h-5 text-[#2D9DA8]" />
                      <span className="text-sm font-medium text-gray-700">{selectedFile.name}</span>
                      <span className="text-xs text-gray-400">({formatFileSize(selectedFile.size)})</span>
                      <button onClick={e => { e.stopPropagation(); setSelectedFile(null) }} className="ml-2 text-gray-400 hover:text-red-500"><X className="w-4 h-4" /></button>
                    </div>
                  ) : (
                    <>
                      <Upload className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                      <p className="text-sm text-gray-500">Click to select a file</p>
                      <p className="text-xs text-gray-400 mt-1">PDF, images, or text files</p>
                    </>
                  )}
                </div>
                <input ref={fileInputRef} type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.gif,.bmp,.tiff,.txt,.doc,.docx"
                  onChange={e => { if (e.target.files?.[0]) setSelectedFile(e.target.files[0]) }} />
              </div>

              {uploading && (
                <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg">
                  <Loader2 className="w-4 h-4 animate-spin text-[#2D9DA8]" />
                  <span className="text-sm text-[#2D9DA8] font-medium">{uploadProgress}</span>
                </div>
              )}

              <Button onClick={handleFileUpload} disabled={!selectedFile || !uploadPatientId || uploading} className="w-full bg-[#2D9DA8] hover:bg-[#258a93] text-white">
                {uploading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Scanning...</> : <><Sparkles className="w-4 h-4 mr-2" /> Upload & Scan with AI</>}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Review Dialog */}
        <Dialog open={reviewOpen} onOpenChange={setReviewOpen}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Eye className="w-5 h-5 text-[#2D9DA8]" /> Document Review
              </DialogTitle>
              <DialogDescription>{selectedUpload?.originalName} — {selectedUpload?.patient?.fullName}</DialogDescription>
            </DialogHeader>

            {selectedUpload && (
              <div className="space-y-4">
                {/* Status Flow */}
                <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
                  {['uploaded', 'scanned', 'reviewed', 'migrated'].map((step, i) => {
                    const isPast = ['uploaded', 'scanned', 'reviewed', 'migrated'].indexOf(selectedUpload.migrationStatus) >= i
                    const isActive = step === selectedUpload.migrationStatus
                    return (
                      <div key={step} className="flex items-center gap-1 flex-1">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                          isPast ? 'bg-[#2D9DA8] text-white' : 'bg-gray-200 text-gray-500'
                        }`}>{i + 1}</div>
                        <span className={`text-xs capitalize ${isActive ? 'font-semibold text-[#2D9DA8]' : 'text-gray-500'}`}>{step}</span>
                        {i < 3 && <ChevronRight className="w-3 h-3 text-gray-300 ml-auto" />}
                      </div>
                    )
                  })}
                </div>

                {/* Document Preview / Download */}
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={handleDownload} disabled={!downloadUrl || loadingDoc}>
                    {loadingDoc ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Download className="w-4 h-4 mr-1" />}
                    Download Original
                  </Button>
                  {downloadUrl && selectedUpload.mimeType?.startsWith('image/') && (
                    <a href={downloadUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline">View Image</a>
                  )}
                  <div className="ml-auto">
                    <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => setDeleteConfirm(selectedUpload.id)}>
                      <Trash2 className="w-4 h-4 mr-1" /> Delete
                    </Button>
                  </div>
                </div>

                {/* Image preview */}
                {downloadUrl && selectedUpload.mimeType?.startsWith('image/') && (
                  <div className="border rounded-lg overflow-hidden bg-gray-50 max-h-64">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={downloadUrl} alt={selectedUpload.originalName} className="max-w-full max-h-64 mx-auto object-contain" />
                  </div>
                )}

                {/* Classification */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Classification</Label>
                    <Select value={newClassification} onValueChange={setNewClassification}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {['consent', 'chart', 'notes', 'medical_history', 'package', 'payment', 'prescription', 'xray', 'referral', 'other'].map(cls => (
                          <SelectItem key={cls} value={cls}><span className="capitalize">{cls.replace('_', ' ')}</span></SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {selectedUpload.classificationConfidence != null && (
                      <p className="text-xs text-gray-400">
                        AI: <span className="capitalize font-medium">{selectedUpload.classification || 'none'}</span>
                        {' '}({Math.round((selectedUpload.classificationConfidence || 0) * 100)}%)
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Extraction Status</Label>
                    <div className="flex items-center gap-2 mt-1">
                      {selectedUpload.extractionStatus === 'completed' ? (
                        <Badge className="bg-emerald-50 text-emerald-700"><Sparkles className="w-3 h-3 mr-1" /> AI Extraction Complete</Badge>
                      ) : selectedUpload.extractionStatus === 'processing' ? (
                        <Badge className="bg-yellow-50 text-yellow-700"><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Processing...</Badge>
                      ) : selectedUpload.extractionStatus === 'failed' ? (
                        <Badge className="bg-red-50 text-red-700"><AlertCircle className="w-3 h-3 mr-1" /> Extraction Failed</Badge>
                      ) : (
                        <Badge className="bg-gray-100 text-gray-600"><Clock className="w-3 h-3 mr-1" /> Pending</Badge>
                      )}
                    </div>
                  </div>
                </div>

                {/* Extracted Data */}
                {selectedUpload.extractedData && Object.keys(selectedUpload.extractedData).length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-medium flex items-center gap-1.5">
                        <Sparkles className="w-4 h-4 text-amber-500" /> AI-Extracted Data
                      </Label>
                      {!selectedUpload.savedToRecords && (
                        <Button size="sm" onClick={handleApplyToPatient} disabled={applying} className="bg-[#22B573] hover:bg-[#1da066] text-white">
                          {applying ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <UserPlus className="w-4 h-4 mr-1" />}
                          Apply to Patient Record
                        </Button>
                      )}
                      {selectedUpload.savedToRecords && (
                        <Badge className="bg-green-50 text-green-700"><CheckCircle className="w-3 h-3 mr-1" /> Applied</Badge>
                      )}
                    </div>
                    <div className="bg-gradient-to-br from-gray-50 to-blue-50/30 rounded-xl p-4 border max-h-64 overflow-y-auto">
                      <div className="grid grid-cols-1 gap-2">
                        {Object.entries(selectedUpload.extractedData).filter(([, v]) => v != null && v !== '' && v !== undefined).map(([key, val]) => (
                          <div key={key} className="text-xs bg-white/80 rounded-lg px-3 py-2 border border-gray-100">
                            <span className="font-semibold text-gray-600 capitalize">{key.replace(/_/g, ' ')}:</span>
                            <span className="ml-2 text-gray-800">
                              {typeof val === 'object' && val !== null
                                ? Array.isArray(val)
                                  ? (val as any[]).map((v, i) => <span key={i} className="inline-block bg-blue-50 text-blue-700 rounded px-1.5 py-0.5 mr-1 mb-1">{typeof v === 'object' ? JSON.stringify(v) : String(v)}</span>)
                                  : <pre className="mt-1 text-[11px] bg-gray-50 p-2 rounded overflow-x-auto">{JSON.stringify(val, null, 2)}</pre>
                                : String(val)}
                            </span>
                            {selectedUpload.confidenceScores?.[key] != null && (
                              <span className="ml-2 text-[10px] text-gray-400">
                                ({Math.round(selectedUpload.confidenceScores[key] * 100)}% confidence)
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Review Notes */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Review Notes</Label>
                  <Textarea value={reviewNotes} onChange={(e) => setReviewNotes(e.target.value)} placeholder="Add notes about this document..." rows={3} />
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-2">
                  <Button onClick={handleSaveReview} disabled={saving} className="bg-[#2D9DA8] hover:bg-[#2D9DA8]/90 text-white">
                    {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <CheckCircle className="w-4 h-4 mr-1" />}
                    Mark as Reviewed
                  </Button>
                  <Button variant="outline" onClick={() => setReviewOpen(false)}>Close</Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="text-red-600 flex items-center gap-2"><Trash2 className="w-5 h-5" /> Delete Document</DialogTitle>
              <DialogDescription>This action cannot be undone. The document and all extracted data will be permanently deleted.</DialogDescription>
            </DialogHeader>
            <div className="flex gap-2 pt-2">
              <Button variant="destructive" onClick={() => {
                const upload = uploads.find(u => u.id === deleteConfirm)
                if (upload) handleDelete(upload.id, upload.patientId)
              }} disabled={deleting}>
                {deleting ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Trash2 className="w-4 h-4 mr-1" />}
                Delete Permanently
              </Button>
              <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  )
}

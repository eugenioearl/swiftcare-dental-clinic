'use client'

import { useState, useRef } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import {
  Upload, FileText, ImageIcon, Search, Loader2, Eye, Download,
  File, Plus, FolderOpen, X, ExternalLink, Maximize2,
} from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { OcrPanel } from '@/components/ocr/ocr-panel'
import { OcrStatusBadge } from '@/components/ocr/ocr-status-badge'

interface UploadDocsTabProps {
  patientId: string
  uploads: any[]
  fetchUploads: () => void
  onReviewUpload: (upload: any) => void
  /** Forwarded callback when user wants to review OCR-extracted fields. */
  onOcrReviewFields?: (fields: Record<string, any>, ocrText: string, upload: any) => void
}

const FILE_TYPE_ICONS: Record<string, any> = {
  image: ImageIcon,
  pdf: FileText,
  document: FileText,
  default: File,
}

const FILE_TYPE_COLORS: Record<string, string> = {
  image: 'bg-blue-50 text-blue-600 border-blue-200',
  pdf: 'bg-red-50 text-red-600 border-red-200',
  document: 'bg-amber-50 text-amber-600 border-amber-200',
  xray: 'bg-purple-50 text-purple-600 border-purple-200',
  default: 'bg-gray-50 text-gray-600 border-gray-200',
}

function getFileType(upload: any): string {
  const name = (upload.originalName || upload.fileName || '').toLowerCase()
  const mime = (upload.mimeType || '').toLowerCase()
  if (mime.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp|bmp)$/.test(name)) return 'image'
  if (mime === 'application/pdf' || name.endsWith('.pdf')) return 'pdf'
  if (/xray|x-ray|radiograph|peri|pano/i.test(name) || upload.category === 'xray') return 'xray'
  if (/\.(doc|docx|txt|rtf)$/.test(name)) return 'document'
  return 'default'
}

function isImageUpload(upload: any): boolean {
  const name = (upload.originalName || upload.fileName || '').toLowerCase()
  const mime = (upload.mimeType || '').toLowerCase()
  return mime.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp|bmp)$/.test(name)
}

function isPdfUpload(upload: any): boolean {
  const name = (upload.originalName || upload.fileName || '').toLowerCase()
  const mime = (upload.mimeType || '').toLowerCase()
  return mime === 'application/pdf' || name.endsWith('.pdf')
}

export default function UploadDocsTab({ patientId, uploads, fetchUploads, onReviewUpload, onOcrReviewFields }: UploadDocsTabProps) {
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState<string>('all')

  // Preview state
  const [previewUpload, setPreviewUpload] = useState<any | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [imageZoomed, setImageZoomed] = useState(false)

  const openPreview = (upload: any) => {
    setPreviewUpload(upload)
    setImageZoomed(false)
    setPreviewOpen(true)
  }

  const closePreview = () => {
    setPreviewOpen(false)
    setTimeout(() => setPreviewUpload(null), 300)
  }

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch(`/api/patients/${patientId}/smart-upload`, { method: 'POST', body: formData })
      const data = await res.json()
      if (data.success) {
        toast({ title: 'File uploaded', description: data.data?.extractionStatus === 'processing' ? 'AI is extracting data...' : 'Upload complete' })
        fetchUploads()
      } else {
        throw new Error(data.error || 'Upload failed')
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Upload failed', variant: 'destructive' })
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleDownload = (upload: any) => {
    if (!upload?.fileUrl) {
      toast({ title: 'Download unavailable', description: 'File link not ready', variant: 'destructive' })
      return
    }
    const a = document.createElement('a')
    a.href = upload.fileUrl
    a.download = upload.originalName || upload.fileName || 'download'
    a.click()
  }

  const filteredUploads = uploads.filter(u => {
    const name = (u.originalName || u.fileName || '').toLowerCase()
    const matchesSearch = !search || name.includes(search.toLowerCase())
    const matchesType = filterType === 'all' || getFileType(u) === filterType
    return matchesSearch && matchesType
  })

  const typeCounts = uploads.reduce((acc: Record<string, number>, u) => {
    const t = getFileType(u)
    acc[t] = (acc[t] || 0) + 1
    return acc
  }, {})

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <FolderOpen className="w-5 h-5 text-[#2D9DA8]" /> Documents & Files
          </h2>
          <Badge variant="outline">{uploads.length} files</Badge>
        </div>
        <Button
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="bg-[#2D9DA8] hover:bg-[#258a93]"
        >
          {uploading ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Upload className="w-4 h-4 mr-1" />}
          Upload File
        </Button>
        <input ref={fileInputRef} type="file" className="hidden" onChange={handleUpload} accept="image/*,.pdf,.doc,.docx,.txt" />
      </div>

      {/* Search & Filter Bar */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Search files..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 text-sm"
          />
        </div>
        <div className="flex gap-1">
          {[
            { key: 'all', label: 'All' },
            { key: 'image', label: 'Images' },
            { key: 'pdf', label: 'PDFs' },
            { key: 'xray', label: 'X-Rays' },
          ].map(f => (
            <button
              key={f.key}
              onClick={() => setFilterType(f.key)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-all ${
                filterType === f.key
                  ? 'bg-[#2D9DA8] text-white border-[#2D9DA8]'
                  : 'text-gray-500 border-gray-200 hover:bg-gray-50'
              }`}
            >
              {f.label}
              {f.key !== 'all' && typeCounts[f.key] ? ` (${typeCounts[f.key]})` : ''}
            </button>
          ))}
        </div>
      </div>

      {/* Upload Drop Zone (when empty) */}
      {uploads.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <div
              className="border-2 border-dashed border-gray-200 rounded-lg p-8 cursor-pointer hover:border-[#2D9DA8] hover:bg-teal-50/30 transition-all"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="w-10 h-10 mx-auto mb-3 text-gray-300" />
              <p className="text-sm text-gray-500 font-medium">Drop files here or click to upload</p>
              <p className="text-xs text-gray-400 mt-1">Supports images, PDFs, documents, X-rays</p>
            </div>
          </CardContent>
        </Card>
      ) : filteredUploads.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-gray-400">
            <Search className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm">No files match your search</p>
          </CardContent>
        </Card>
      ) : (
        /* File Grid */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {/* Upload Button Card */}
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-gray-200 rounded-lg p-6 flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-[#2D9DA8] hover:bg-teal-50/30 transition-all min-h-[120px]"
          >
            <Plus className="w-6 h-6 text-gray-300" />
            <span className="text-xs text-gray-400">Upload new file</span>
          </div>

          {/* File Cards */}
          {filteredUploads.map(upload => {
            const fileType = getFileType(upload)
            const Icon = FILE_TYPE_ICONS[fileType] || FILE_TYPE_ICONS.default
            const colorClass = FILE_TYPE_COLORS[fileType] || FILE_TYPE_COLORS.default
            const name = upload.originalName || upload.fileName || 'Untitled'
            const isImage = isImageUpload(upload)
            const isPdf = isPdfUpload(upload)
            const canPreview = (isImage || isPdf) && !!upload.fileUrl

            return (
              <Card key={upload.id} className="hover:shadow-md transition-shadow overflow-hidden">
                <CardContent className="p-0">
                  {/* Preview Area */}
                  {isImage && upload.fileUrl ? (
                    <button
                      type="button"
                      onClick={() => openPreview(upload)}
                      className="relative w-full h-32 bg-gray-100 group cursor-zoom-in"
                      aria-label={`Preview ${name}`}
                    >
                      <img
                        src={upload.fileUrl}
                        alt={name}
                        className="w-full h-full object-cover"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                      />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/30 transition-colors">
                        <Maximize2 className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg" />
                      </div>
                    </button>
                  ) : isPdf && upload.fileUrl ? (
                    <button
                      type="button"
                      onClick={() => openPreview(upload)}
                      className={`w-full h-24 flex items-center justify-center ${colorClass.split(' ')[0]} group cursor-pointer hover:brightness-95`}
                      aria-label={`Preview ${name}`}
                    >
                      <FileText className={`w-8 h-8 ${colorClass.split(' ')[1]} group-hover:scale-110 transition-transform`} />
                    </button>
                  ) : (
                    <div className={`w-full h-24 flex items-center justify-center ${colorClass.split(' ')[0]}`}>
                      <Icon className={`w-8 h-8 ${colorClass.split(' ')[1]}`} />
                    </div>
                  )}

                  {/* Info */}
                  <div className="p-3">
                    <p className="text-xs font-medium truncate" title={name}>{name}</p>
                    <div className="flex items-center justify-between mt-1.5">
                      <span className="text-[10px] text-gray-400">
                        {upload.createdAt ? format(parseISO(upload.createdAt), 'MMM d, yyyy') : '—'}
                      </span>
                      <div className="flex items-center gap-1 flex-wrap justify-end">
                        {upload.classification && upload.classification !== 'other' && (
                          <Badge variant="outline" className="text-[9px] px-1 py-0 capitalize">
                            {upload.classification === 'id' ? 'ID' : upload.classification}
                          </Badge>
                        )}
                        {upload.extractionStatus === 'completed' && (
                          <Badge className="bg-green-100 text-green-700 hover:bg-green-100 text-[9px] px-1 py-0">AI ✓</Badge>
                        )}
                        {upload.extractionStatus === 'processing' && (
                          <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 text-[9px] px-1 py-0">Processing...</Badge>
                        )}
                        {upload.ocrStatus && (
                          <OcrStatusBadge status={upload.ocrStatus} confidence={upload.ocrConfidence} size="sm" />
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 mt-2 flex-wrap">
                      {canPreview && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-6 text-[10px] px-2"
                          onClick={() => openPreview(upload)}
                        >
                          <Eye className="w-3 h-3 mr-1" /> Preview
                        </Button>
                      )}
                      {upload.extractedData && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-6 text-[10px] px-2"
                          onClick={() => onReviewUpload(upload)}
                        >
                          <FileText className="w-3 h-3 mr-1" /> Review
                        </Button>
                      )}
                      {upload.fileUrl && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-6 text-[10px] px-2"
                          onClick={() => handleDownload(upload)}
                        >
                          <Download className="w-3 h-3 mr-1" /> Download
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* ==================== PREVIEW DIALOG ==================== */}
      <Dialog open={previewOpen} onOpenChange={(open) => { if (!open) closePreview() }}>
        <DialogContent className="max-w-5xl w-[95vw] max-h-[95vh] p-0 overflow-hidden flex flex-col">
          {previewUpload && (
            <>
              <DialogHeader className="p-4 pb-3 border-b bg-white">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <DialogTitle className="flex items-center gap-2 text-base truncate">
                      {isImageUpload(previewUpload) ? (
                        <ImageIcon className="w-4 h-4 text-blue-600 flex-shrink-0" />
                      ) : (
                        <FileText className="w-4 h-4 text-red-600 flex-shrink-0" />
                      )}
                      <span className="truncate">{previewUpload.originalName || previewUpload.fileName}</span>
                    </DialogTitle>
                    <DialogDescription className="text-xs mt-1 flex items-center gap-2 flex-wrap">
                      <span>{previewUpload.createdAt ? format(parseISO(previewUpload.createdAt), 'MMM d, yyyy h:mm a') : ''}</span>
                      {previewUpload.fileSize && (
                        <>
                          <span>•</span>
                          <span>{(previewUpload.fileSize / 1024).toFixed(1)} KB</span>
                        </>
                      )}
                      {previewUpload.classification && previewUpload.classification !== 'other' && (
                        <>
                          <span>•</span>
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 capitalize">
                            {previewUpload.classification === 'id' ? 'ID' : previewUpload.classification}
                          </Badge>
                        </>
                      )}
                    </DialogDescription>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {previewUpload.fileUrl && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs"
                        onClick={() => window.open(previewUpload.fileUrl, '_blank', 'noopener,noreferrer')}
                        title="Open in new tab"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </Button>
                    )}
                    {previewUpload.fileUrl && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs"
                        onClick={() => handleDownload(previewUpload)}
                        title="Download"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </Button>
                    )}
                    {previewUpload.extractedData && (
                      <Button
                        size="sm"
                        className="h-8 text-xs bg-purple-600 hover:bg-purple-700"
                        onClick={() => {
                          closePreview()
                          setTimeout(() => onReviewUpload(previewUpload), 100)
                        }}
                      >
                        <FileText className="w-3.5 h-3.5 mr-1" /> Review Data
                      </Button>
                    )}
                  </div>
                </div>
              </DialogHeader>

              <div className="flex-1 min-h-0 bg-gray-50 overflow-hidden flex items-center justify-center">
                {isImageUpload(previewUpload) && previewUpload.fileUrl ? (
                  <div
                    className={`w-full h-full overflow-auto flex items-center justify-center p-4 ${imageZoomed ? 'cursor-zoom-out' : 'cursor-zoom-in'}`}
                    onClick={() => setImageZoomed(!imageZoomed)}
                  >
                    <img
                      src={previewUpload.fileUrl}
                      alt={previewUpload.originalName || 'Preview'}
                      className={imageZoomed ? 'max-w-none' : 'max-w-full max-h-[75vh] object-contain'}
                      style={imageZoomed ? { width: 'auto', height: 'auto' } : undefined}
                    />
                  </div>
                ) : isPdfUpload(previewUpload) && previewUpload.fileUrl ? (
                  <iframe
                    src={previewUpload.fileUrl}
                    title={previewUpload.originalName || 'PDF Preview'}
                    className="w-full h-[80vh] bg-white"
                  />
                ) : (
                  <div className="text-center p-8 text-gray-500">
                    <File className="w-12 h-12 mx-auto mb-3 opacity-40" />
                    <p className="text-sm">Preview not available for this file type</p>
                    {previewUpload.fileUrl && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-3"
                        onClick={() => handleDownload(previewUpload)}
                      >
                        <Download className="w-4 h-4 mr-1" /> Download to view
                      </Button>
                    )}
                  </div>
                )}
              </div>

              {isImageUpload(previewUpload) && (
                <div className="px-4 py-2 border-t bg-white text-[11px] text-gray-500 text-center">
                  Click image to {imageZoomed ? 'fit to screen' : 'view at original size'}
                </div>
              )}

              {/* OCR Panel — image-only, lazy-runs, cached server-side */}
              <div className="px-4 py-3 border-t bg-white max-h-[35vh] overflow-y-auto">
                <OcrPanel
                  patientId={patientId}
                  uploadId={previewUpload.id}
                  eligible={isImageUpload(previewUpload)}
                  onReviewFields={(fields, ocrText) => {
                    if (onOcrReviewFields) {
                      closePreview()
                      setTimeout(() => onOcrReviewFields(fields, ocrText, previewUpload), 100)
                    }
                  }}
                />
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

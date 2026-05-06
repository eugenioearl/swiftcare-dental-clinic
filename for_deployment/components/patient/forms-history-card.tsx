'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { FileText, Calendar, Loader2, Eye, Clock, Shield, UserCheck } from 'lucide-react'
import { format, parseISO } from 'date-fns'

interface FormRecord {
  id: string
  title: string
  description: string | null
  consentNumber: string
  status: string
  patientSignedAt: string | null
  formFields: any[]
  formResponses: any
  patientSignature: string | null
  guardianName?: string | null
  guardianRelation?: string | null
  guardianSignature?: string | null
  guardianSignedAt?: string | null
  templateKey?: string | null
  templateVersion?: number | null
  requirementStage?: string | null
  assignmentSource?: string | null
  createdAt: string
}

export default function FormsHistoryCard({ patientId }: { patientId: string }) {
  const [forms, setForms] = useState<FormRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [viewing, setViewing] = useState<FormRecord | null>(null)

  const fetchForms = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (fromDate) params.set('from', fromDate)
      if (toDate) params.set('to', toDate)
      const url = `/api/patients/${patientId}/forms-history${params.toString() ? `?${params.toString()}` : ''}`
      const res = await fetch(url)
      if (!res.ok) throw new Error('Failed')
      const data = await res.json()
      setForms(data.forms || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchForms()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId])

  const clear = () => {
    setFromDate('')
    setToDate('')
    setTimeout(fetchForms, 0)
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="w-4 h-4" /> Forms History
            {forms.length > 0 && <Badge variant="outline">{forms.length}</Badge>}
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap items-end gap-2 mb-4">
          <div>
            <Label className="text-xs">From</Label>
            <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="w-40" />
          </div>
          <div>
            <Label className="text-xs">To</Label>
            <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="w-40" />
          </div>
          <Button size="sm" onClick={fetchForms}>Filter</Button>
          <Button size="sm" variant="ghost" onClick={clear}>Clear</Button>
        </div>

        {loading ? (
          <div className="py-8 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
        ) : forms.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            <FileText className="w-10 h-10 mx-auto mb-2 opacity-30" />
            No forms found{(fromDate || toDate) ? ' in this date range' : ''}.
          </div>
        ) : (
          <div className="space-y-2">
            {forms.map((f) => (
              <div key={f.id} className="border rounded-lg p-3 hover:bg-muted/30 transition-colors">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="font-medium text-sm truncate">{f.title}</div>
                      {f.patientSignature ? (
                        <Badge className="bg-green-100 text-green-800 border-0 text-xs">Signed</Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs">Pending</Badge>
                      )}
                      {f.guardianSignature && (
                        <Badge className="bg-purple-100 text-purple-800 border-0 text-xs inline-flex items-center gap-1">
                          <Shield className="w-2.5 h-2.5" /> Guardian
                        </Badge>
                      )}
                      {f.templateVersion && (
                        <Badge variant="outline" className="text-[10px]">v{f.templateVersion}</Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                      <span>#{f.consentNumber}</span>
                      {f.patientSignedAt && (
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          Signed {format(parseISO(f.patientSignedAt), 'MMM d, yyyy h:mm a')}
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Created {format(parseISO(f.createdAt), 'MMM d, yyyy')}
                      </span>
                      {f.guardianName && (
                        <span className="inline-flex items-center gap-1 text-purple-700 font-medium">
                          <UserCheck className="w-3 h-3" />
                          Guardian: {f.guardianName}
                          {f.guardianRelation ? ` (${f.guardianRelation})` : ''}
                        </span>
                      )}
                    </div>
                  </div>
                  <Button size="sm" variant="ghost" className="gap-1" onClick={() => setViewing(f)}>
                    <Eye className="w-3 h-3" /> View
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{viewing?.title}</DialogTitle>
              <DialogDescription>
                Form #{viewing?.consentNumber}
                {viewing?.patientSignedAt && ` • Signed on ${format(parseISO(viewing.patientSignedAt), 'MMM d, yyyy h:mm a')}`}
              </DialogDescription>
            </DialogHeader>
            {viewing && (
              <div className="space-y-4">
                {(viewing.guardianSignature || viewing.guardianName) && (
                  <div className="rounded-lg border border-purple-200 bg-purple-50 p-3">
                    <div className="text-sm font-medium text-purple-900 inline-flex items-center gap-1.5 mb-1.5">
                      <Shield className="w-4 h-4" /> Guardian Signer
                    </div>
                    <div className="space-y-1 text-xs text-purple-900">
                      {viewing.guardianName && <div><span className="text-purple-700/80">Name:</span> <span className="font-medium">{viewing.guardianName}</span></div>}
                      {viewing.guardianRelation && <div><span className="text-purple-700/80">Relationship to patient:</span> <span className="font-medium">{viewing.guardianRelation}</span></div>}
                      {viewing.guardianSignedAt && <div><span className="text-purple-700/80">Signed on:</span> <span className="font-medium">{format(parseISO(viewing.guardianSignedAt), 'MMM d, yyyy h:mm a')}</span></div>}
                      {viewing.guardianSignature && (
                        <div className="pt-1">
                          <div className="text-[11px] text-purple-700/80 mb-0.5">Signature:</div>
                          <img src={viewing.guardianSignature} alt="guardian signature" className="max-h-20 border rounded bg-white" />
                        </div>
                      )}
                    </div>
                  </div>
                )}
                {(viewing.formFields || []).map((field: any, idx: number) => {
                  const resp = viewing.formResponses?.[field.id]
                  if (field.type === 'signature') {
                    return (
                      <div key={idx} className="space-y-1">
                        <div className="text-sm font-medium">{field.label}</div>
                        {viewing.patientSignature ? (
                          <img src={viewing.patientSignature} alt="signature" className="max-h-24 border rounded bg-white" />
                        ) : (
                          <div className="text-xs text-muted-foreground">Not signed</div>
                        )}
                      </div>
                    )
                  }
                  return (
                    <div key={idx} className="space-y-1">
                      <div className="text-sm font-medium">{field.label}</div>
                      <div className="text-sm bg-muted rounded p-2 min-h-[2rem] whitespace-pre-wrap">
                        {typeof resp === 'boolean' ? (resp ? '✓ Yes' : '✗ No') : typeof resp === 'object' ? JSON.stringify(resp) : resp || <span className="text-muted-foreground italic">No response</span>}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  )
}

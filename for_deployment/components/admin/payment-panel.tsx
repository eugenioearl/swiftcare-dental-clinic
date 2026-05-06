'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import {
  DollarSign, Plus, Loader2, CreditCard, Banknote, CheckCircle,
  Clock, TrendingUp, Receipt, ArrowDownRight, ArrowUpRight
} from 'lucide-react'
import { format, parseISO } from 'date-fns'

interface PaymentData {
  id: string
  paymentNumber: string
  amount: number | string
  paymentType: string
  paymentMethod: string
  status: string
  description: string | null
  notes: string | null
  processedAt: string | null
  createdAt: string
  package?: { id: string; packageNumber: string; title: string } | null
  appointment?: { id: string; appointmentNumber: string } | null
  receivedBy?: { id: string; firstName: string; lastName: string } | null
}

interface PaymentPanelProps {
  patientId: string
  preselectedPackageId?: string | null
  preselectedBalance?: number
  onPaymentRecorded?: () => void
}

const paymentTypeLabels: Record<string, string> = {
  visit_payment: 'Visit Payment',
  package_installment: 'Package Installment',
  deposit: 'Deposit',
  refund: 'Refund'
}

const paymentMethodIcons: Record<string, any> = {
  cash: Banknote,
  credit_card: CreditCard,
  debit_card: CreditCard,
  bank_transfer: ArrowDownRight,
  check: Receipt,
  insurance: CheckCircle,
  financing: TrendingUp
}

export default function PaymentPanel({ patientId, preselectedPackageId, preselectedBalance, onPaymentRecorded }: PaymentPanelProps) {
  const { toast } = useToast()
  const [payments, setPayments] = useState<PaymentData[]>([])
  const [summary, setSummary] = useState({ totalPaid: 0, totalPending: 0 })
  const [loading, setLoading] = useState(true)
  const [showRecord, setShowRecord] = useState(false)
  const [recording, setRecording] = useState(false)
  const [packages, setPackages] = useState<any[]>([])

  const [form, setForm] = useState({
    packageId: '',
    amount: '',
    paymentType: 'visit_payment',
    paymentMethod: 'cash',
    description: '',
    notes: ''
  })

  const fetchPayments = useCallback(async () => {
    try {
      const res = await fetch(`/api/patients/${patientId}/patient-payments`)
      if (!res.ok) throw new Error('Failed')
      const data = await res.json()
      setPayments(data.payments || [])
      setSummary(data.summary || { totalPaid: 0, totalPending: 0 })
    } catch {
      console.error('Failed to load payments')
    } finally {
      setLoading(false)
    }
  }, [patientId])

  const fetchPackages = useCallback(async () => {
    try {
      const res = await fetch(`/api/patients/${patientId}/packages`)
      if (!res.ok) return
      const data = await res.json()
      setPackages((data.packages || []).filter((p: any) => ['active', 'in_progress', 'draft'].includes(p.status)))
    } catch {}
  }, [patientId])

  useEffect(() => {
    fetchPayments()
    fetchPackages()
  }, [fetchPayments, fetchPackages])

  // Open record dialog with preselected package
  useEffect(() => {
    if (preselectedPackageId) {
      setForm(prev => ({
        ...prev,
        packageId: preselectedPackageId,
        paymentType: 'package_installment',
        amount: preselectedBalance ? String(preselectedBalance) : ''
      }))
      setShowRecord(true)
    }
  }, [preselectedPackageId, preselectedBalance])

  const recordPayment = async () => {
    if (!form.amount || Number(form.amount) <= 0) {
      toast({ title: 'Error', description: 'Please enter a valid amount', variant: 'destructive' })
      return
    }
    setRecording(true)
    try {
      const res = await fetch(`/api/patients/${patientId}/patient-payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          packageId: form.packageId || null,
          amount: Number(form.amount),
          paymentType: form.paymentType,
          paymentMethod: form.paymentMethod,
          description: form.description || null,
          notes: form.notes || null
        })
      })
      if (!res.ok) throw new Error('Failed')
      await fetchPayments()
      setShowRecord(false)
      setForm({ packageId: '', amount: '', paymentType: 'visit_payment', paymentMethod: 'cash', description: '', notes: '' })
      onPaymentRecorded?.()
      toast({ title: 'Payment recorded', description: `₱${Number(form.amount).toLocaleString()} payment recorded` })
    } catch {
      toast({ title: 'Error', description: 'Failed to record payment', variant: 'destructive' })
    } finally {
      setRecording(false)
    }
  }

  return (
    <div className="space-y-3">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-gradient-to-br from-green-50 to-green-100/50 border border-green-200 rounded-lg p-3">
          <div className="flex items-center gap-1 text-green-600 mb-1">
            <ArrowDownRight className="w-3 h-3" />
            <span className="text-xs font-medium">Total Received</span>
          </div>
          <div className="font-bold text-lg text-green-700">₱{summary.totalPaid.toLocaleString()}</div>
        </div>
        <div className="bg-gradient-to-br from-orange-50 to-orange-100/50 border border-orange-200 rounded-lg p-3">
          <div className="flex items-center gap-1 text-orange-600 mb-1">
            <Clock className="w-3 h-3" />
            <span className="text-xs font-medium">Pending</span>
          </div>
          <div className="font-bold text-lg text-orange-700">₱{summary.totalPending.toLocaleString()}</div>
        </div>
      </div>

      {/* Record Payment Button */}
      <Button
        onClick={() => setShowRecord(true)}
        className="w-full bg-[#22B573] hover:bg-[#1da066]"
        size="sm"
      >
        <Plus className="w-4 h-4 mr-2" />Record Payment
      </Button>

      {/* Recent Payments */}
      <div>
        <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Recent Payments</h4>
        {loading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="w-5 h-5 animate-spin text-[#2D9DA8]" />
          </div>
        ) : payments.length === 0 ? (
          <div className="text-center py-4 text-gray-400">
            <DollarSign className="w-6 h-6 mx-auto mb-1 opacity-40" />
            <p className="text-xs">No payments recorded yet</p>
          </div>
        ) : (
          <div className="space-y-1.5 max-h-64 overflow-y-auto">
            {payments.slice(0, 10).map(payment => {
              const MethodIcon = paymentMethodIcons[payment.paymentMethod] || DollarSign
              return (
                <div key={payment.id} className="flex items-center justify-between p-2 border rounded-lg bg-white text-sm">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-7 h-7 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                      <MethodIcon className="w-3.5 h-3.5 text-green-600" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium text-xs truncate">
                        {paymentTypeLabels[payment.paymentType] || payment.paymentType}
                      </div>
                      <div className="text-xs text-gray-400">
                        {payment.paymentNumber}
                        {payment.package && <span> • {payment.package.title}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="font-semibold text-green-600">
                      {payment.paymentType === 'refund' ? '-' : '+'}₱{Number(payment.amount).toLocaleString()}
                    </div>
                    <div className="text-xs text-gray-400">
                      {payment.processedAt ? format(parseISO(payment.processedAt), 'MMM d') : format(parseISO(payment.createdAt), 'MMM d')}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Record Payment Dialog */}
      <Dialog open={showRecord} onOpenChange={v => { if (!v) setShowRecord(false) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-[#22B573]" />
              Record Payment
            </DialogTitle>
            <DialogDescription>Record a payment for this patient</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Amount (₱) *</Label>
              <Input
                type="number"
                placeholder="0.00"
                value={form.amount}
                onChange={e => setForm({ ...form, amount: e.target.value })}
                className="text-lg font-semibold"
                min={0}
                step={0.01}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Payment Type</Label>
                <Select value={form.paymentType} onValueChange={v => setForm({ ...form, paymentType: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="visit_payment">Visit Payment</SelectItem>
                    <SelectItem value="package_installment">Package Installment</SelectItem>
                    <SelectItem value="deposit">Deposit</SelectItem>
                    <SelectItem value="refund">Refund</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Method</Label>
                <Select value={form.paymentMethod} onValueChange={v => setForm({ ...form, paymentMethod: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="credit_card">Credit Card</SelectItem>
                    <SelectItem value="debit_card">Debit Card</SelectItem>
                    <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                    <SelectItem value="check">Check</SelectItem>
                    <SelectItem value="insurance">Insurance</SelectItem>
                    <SelectItem value="financing">Financing</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {packages.length > 0 && (
              <div>
                <Label>Link to Package (optional)</Label>
                <Select value={form.packageId || 'none'} onValueChange={v => setForm({ ...form, packageId: v === 'none' ? '' : v })}>
                  <SelectTrigger><SelectValue placeholder="Select a package..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No package</SelectItem>
                    {packages.map(p => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.title} ({p.packageNumber}) - Balance: ₱{Number(p.balanceDue).toLocaleString()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label>Description</Label>
              <Input
                placeholder="Brief description..."
                value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea
                placeholder="Additional notes..."
                value={form.notes}
                onChange={e => setForm({ ...form, notes: e.target.value })}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRecord(false)}>Cancel</Button>
            <Button onClick={recordPayment} disabled={recording} className="bg-[#22B573] hover:bg-[#1da066]">
              {recording && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Record ₱{form.amount ? Number(form.amount).toLocaleString() : '0'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

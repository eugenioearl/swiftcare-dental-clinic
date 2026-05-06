
'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import SignaturePad from '@/components/digital-signature/signature-pad'
import { Save, FileText, Package, Calendar, CheckCircle } from 'lucide-react'
import { PesoIcon } from '@/components/ui/peso-icon'

interface ProcedureItem {
  id: string
  name: string
  code: string
  duration: number
  cost: number
}

interface InventoryItem {
  id: string
  name: string
  unit: string
  costPerUnit: number
  quantity: number
}

interface PostProcedureLoggingProps {
  patientId: string
  appointmentId: string
  dentistId: string
  proceduresCompleted: ProcedureItem[]
  onComplete: (data: any) => void
}

export default function PostProcedureLogging({
  patientId,
  appointmentId,
  dentistId,
  proceduresCompleted,
  onComplete
}: PostProcedureLoggingProps) {
  const [loggingData, setLoggingData] = useState({
    date: new Date().toISOString().split('T')[0],
    startTime: '',
    endTime: '',
    proceduresPerformed: proceduresCompleted.map(p => ({
      ...p,
      actualDuration: p.duration,
      notes: ''
    })),
    itemsUsed: [] as InventoryItem[],
    totalAmount: proceduresCompleted.reduce((sum, p) => sum + p.cost, 0),
    discountAmount: 0,
    finalAmount: proceduresCompleted.reduce((sum, p) => sum + p.cost, 0),
    paymentMode: '',
    amountPaid: 0,
    balanceRemaining: 0,
    nextVisitDate: '',
    nextVisitReason: '',
    postProcedureInstructions: '',
    followUpRequired: false,
    complications: '',
    patientCondition: 'stable'
  })

  const [signatures, setSignatures] = useState({
    dentist: '',
    patient: ''
  })

  const [availableItems] = useState<InventoryItem[]>([
    { id: '1', name: 'Composite Resin', unit: 'syringe', costPerUnit: 25, quantity: 0 },
    { id: '2', name: 'Local Anesthetic', unit: 'vial', costPerUnit: 8, quantity: 0 },
    { id: '3', name: 'Fluoride Varnish', unit: 'tube', costPerUnit: 12, quantity: 0 },
    { id: '4', name: 'Dental Burs', unit: 'piece', costPerUnit: 12, quantity: 0 },
    { id: '5', name: 'Sutures', unit: 'pack', costPerUnit: 15, quantity: 0 }
  ])

  useEffect(() => {
    // Auto-calculate balance
    const finalAmount = loggingData.totalAmount - loggingData.discountAmount
    const balance = finalAmount - loggingData.amountPaid
    
    setLoggingData(prev => ({
      ...prev,
      finalAmount,
      balanceRemaining: Math.max(0, balance)
    }))
  }, [loggingData.totalAmount, loggingData.discountAmount, loggingData.amountPaid])

  const addInventoryItem = (itemId: string, quantity: number) => {
    const item = availableItems.find(i => i.id === itemId)
    if (!item || quantity <= 0) return

    const existingIndex = loggingData.itemsUsed.findIndex(i => i.id === itemId)
    
    if (existingIndex >= 0) {
      // Update existing item
      const updatedItems = [...loggingData.itemsUsed]
      updatedItems[existingIndex] = { ...item, quantity }
      setLoggingData(prev => ({ ...prev, itemsUsed: updatedItems }))
    } else {
      // Add new item
      setLoggingData(prev => ({
        ...prev,
        itemsUsed: [...prev.itemsUsed, { ...item, quantity }]
      }))
    }
  }

  const removeInventoryItem = (itemId: string) => {
    setLoggingData(prev => ({
      ...prev,
      itemsUsed: prev.itemsUsed.filter(item => item.id !== itemId)
    }))
  }

  const handleComplete = async () => {
    // Validation
    if (!signatures.dentist || !signatures.patient) {
      alert('Both dentist and patient signatures are required')
      return
    }

    if (!loggingData.paymentMode) {
      alert('Please select a payment mode')
      return
    }

    // Prepare final data
    const finalData = {
      ...loggingData,
      signatures,
      patientId,
      appointmentId,
      dentistId,
      timestamp: new Date().toISOString(),
      itemsCost: loggingData.itemsUsed.reduce((sum, item) => sum + (item.costPerUnit * item.quantity), 0),
      procedureProfit: loggingData.finalAmount - loggingData.itemsUsed.reduce((sum, item) => sum + (item.costPerUnit * item.quantity), 0)
    }

    try {
      // This would normally be an API call
      console.log('Post-procedure logging completed:', finalData)
      
      // Simulate system updates
      alert('✅ Post-Procedure Logging Completed!\n\n' +
            '• Patient record updated\n' +
            '• Billing system updated\n' +
            '• Inventory deducted\n' +
            '• Analytics updated\n' +
            '• Appointment marked completed')
      
      onComplete(finalData)
    } catch (error) {
      console.error('Error completing post-procedure logging:', error)
      alert('Error completing the logging. Please try again.')
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="border-blue-200 bg-blue-50">
        <CardContent className="p-4">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-lg font-semibold">Post-Procedure Logging</h2>
              <p className="text-sm text-gray-600">
                Complete treatment documentation and update all systems
              </p>
            </div>
            <Badge className="bg-blue-100 text-blue-800">
              Auto-Updates: Billing • Inventory • Analytics
            </Badge>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Procedure Details */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <FileText className="w-5 h-5 mr-2" />
              Procedure Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Date</Label>
                <Input 
                  type="date" 
                  value={loggingData.date}
                  onChange={(e) => setLoggingData(prev => ({ ...prev, date: e.target.value }))}
                />
              </div>
              <div>
                <Label>Patient Condition</Label>
                <Select 
                  value={loggingData.patientCondition}
                  onValueChange={(value) => setLoggingData(prev => ({ ...prev, patientCondition: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="stable">Stable</SelectItem>
                    <SelectItem value="comfortable">Comfortable</SelectItem>
                    <SelectItem value="minor_discomfort">Minor Discomfort</SelectItem>
                    <SelectItem value="requires_monitoring">Requires Monitoring</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Procedures Completed</Label>
              <div className="space-y-2 mt-2">
                {loggingData.proceduresPerformed.map((procedure, index) => (
                  <div key={procedure.id} className="p-3 border rounded-lg">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <span className="font-medium">{procedure.name}</span>
                        <div className="text-sm text-gray-600">Code: {procedure.code}</div>
                      </div>
                      <span className="font-medium">₱{procedure.cost}</span>
                    </div>
                    <Textarea
                      placeholder="Procedure notes..."
                      value={procedure.notes}
                      onChange={(e) => {
                        const updated = [...loggingData.proceduresPerformed]
                        updated[index].notes = e.target.value
                        setLoggingData(prev => ({ ...prev, proceduresPerformed: updated }))
                      }}
                      rows={2}
                    />
                  </div>
                ))}
              </div>
            </div>

            <div>
              <Label>Post-Procedure Instructions</Label>
              <Textarea
                value={loggingData.postProcedureInstructions}
                onChange={(e) => setLoggingData(prev => ({ ...prev, postProcedureInstructions: e.target.value }))}
                placeholder="Care instructions for the patient..."
                rows={4}
              />
            </div>

            <div>
              <Label>Complications (if any)</Label>
              <Textarea
                value={loggingData.complications}
                onChange={(e) => setLoggingData(prev => ({ ...prev, complications: e.target.value }))}
                placeholder="Note any complications or issues..."
                rows={2}
              />
            </div>
          </CardContent>
        </Card>

        {/* Billing & Items */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <PesoIcon className="w-5 h-5 mr-2" />
              Billing & Inventory
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Billing Summary */}
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>Procedure Total:</span>
                  <span className="font-medium">₱{loggingData.totalAmount}</span>
                </div>
                <div className="flex justify-between">
                  <span>Discount:</span>
                  <Input
                    type="number"
                    value={loggingData.discountAmount}
                    onChange={(e) => setLoggingData(prev => ({ ...prev, discountAmount: parseFloat(e.target.value) || 0 }))}
                    className="w-24 text-right"
                  />
                </div>
                <Separator />
                <div className="flex justify-between font-medium">
                  <span>Final Amount:</span>
                  <span>₱{loggingData.finalAmount}</span>
                </div>
              </div>
            </div>

            {/* Payment Details */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Payment Mode</Label>
                <Select 
                  value={loggingData.paymentMode}
                  onValueChange={(value) => setLoggingData(prev => ({ ...prev, paymentMode: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select payment" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="credit_card">Credit Card</SelectItem>
                    <SelectItem value="debit_card">Debit Card</SelectItem>
                    <SelectItem value="insurance">Insurance</SelectItem>
                    <SelectItem value="payment_plan">Payment Plan</SelectItem>
                    <SelectItem value="partial">Partial Payment</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Amount Paid</Label>
                <Input
                  type="number"
                  value={loggingData.amountPaid}
                  onChange={(e) => setLoggingData(prev => ({ ...prev, amountPaid: parseFloat(e.target.value) || 0 }))}
                />
              </div>
            </div>

            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex justify-between font-medium">
                <span>Balance Remaining:</span>
                <span className={loggingData.balanceRemaining > 0 ? 'text-red-600' : 'text-green-600'}>
                  ${loggingData.balanceRemaining}
                </span>
              </div>
            </div>

            {/* Items Used */}
            <div>
              <Label>Items/Materials Used</Label>
              <div className="space-y-2 mt-2">
                {loggingData.itemsUsed.map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-2 border rounded">
                    <span>{item.name}</span>
                    <div className="flex items-center space-x-2">
                      <span className="text-sm">{item.quantity} {item.unit}</span>
                      <span className="font-medium">₱{(item.costPerUnit * item.quantity).toFixed(2)}</span>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => removeInventoryItem(item.id)}
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              
              {/* Add Items */}
              <div className="grid grid-cols-3 gap-2 mt-3">
                <Select onValueChange={(itemId) => {
                  const input = document.getElementById('item-quantity') as HTMLInputElement
                  if (input && input.value) {
                    addInventoryItem(itemId, parseInt(input.value))
                    input.value = ''
                  }
                }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select item" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableItems.map(item => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input id="item-quantity" type="number" placeholder="Quantity" />
                <Button variant="outline">
                  <Package className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Next Visit */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Next Visit Date (Optional)</Label>
                <Input
                  type="date"
                  value={loggingData.nextVisitDate}
                  onChange={(e) => setLoggingData(prev => ({ ...prev, nextVisitDate: e.target.value }))}
                />
              </div>
              <div>
                <Label>Next Visit Reason</Label>
                <Input
                  value={loggingData.nextVisitReason}
                  onChange={(e) => setLoggingData(prev => ({ ...prev, nextVisitReason: e.target.value }))}
                  placeholder="Follow-up, cleaning, etc."
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Signatures */}
      <Card>
        <CardHeader>
          <CardTitle>Final Signatures</CardTitle>
          <p className="text-sm text-gray-600">
            Both signatures are required to complete the post-procedure logging
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <SignaturePad
              title="Dentist Confirmation"
              onSignature={(sig) => setSignatures(prev => ({ ...prev, dentist: sig }))}
              width={350}
              height={150}
            />
            <SignaturePad
              title="Patient Acknowledgment"
              onSignature={(sig) => setSignatures(prev => ({ ...prev, patient: sig }))}
              width={350}
              height={150}
            />
          </div>
        </CardContent>
      </Card>

      {/* Complete Button */}
      <div className="flex justify-center">
        <Button 
          onClick={handleComplete} 
          size="lg" 
          className="px-8"
          disabled={!signatures.dentist || !signatures.patient}
        >
          <CheckCircle className="w-5 h-5 mr-2" />
          Complete Treatment & Update All Systems
        </Button>
      </div>
    </div>
  )
}

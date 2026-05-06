
'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { 
  CreditCard, 

  Shield, 
  CheckCircle, 
  AlertTriangle,
  Calendar,
  User,
  Lock
} from 'lucide-react'
import { PesoIcon, PesoSign } from '@/components/ui/peso-icon'

interface PaymentMethod {
  type: 'credit_card' | 'debit_card' | 'bank_account' | 'insurance' | 'cash' | 'check'
  details: {
    last4?: string
    brand?: string
    expiryMonth?: number
    expiryYear?: number
    holderName?: string
  }
}

interface PaymentProcessorProps {
  billingId: string
  amount: number
  patientId: string
  onPaymentSuccess: (paymentId: string) => void
  onPaymentError: (error: string) => void
}

export default function PaymentProcessor({
  billingId,
  amount,
  patientId,
  onPaymentSuccess,
  onPaymentError
}: PaymentProcessorProps) {
  const [processing, setProcessing] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState<string>('')
  const [paymentData, setPaymentData] = useState({
    cardNumber: '',
    expiryMonth: '',
    expiryYear: '',
    cvv: '',
    holderName: '',
    billingAddress: {
      street: '',
      city: '',
      state: '',
      zipCode: '',
      country: 'US'
    }
  })
  const [insuranceData, setInsuranceData] = useState({
    provider: '',
    policyNumber: '',
    groupNumber: '',
    subscriberId: '',
    relationshipToSubscriber: 'self'
  })

  const processPayment = async () => {
    setProcessing(true)
    try {
      // Simulate payment processing
      const response = await fetch('/api/billing/payments/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          billingId,
          patientId,
          amount,
          paymentMethod,
          paymentData: paymentMethod === 'insurance' ? insuranceData : paymentData
        })
      })

      if (response.ok) {
        const result = await response.json()
        onPaymentSuccess(result.data.paymentId)
      } else {
        const error = await response.json()
        onPaymentError(error.message || 'Payment processing failed')
      }
    } catch (error) {
      onPaymentError('Payment processing failed. Please try again.')
    } finally {
      setProcessing(false)
    }
  }

  const formatCardNumber = (value: string) => {
    // Remove all non-digits
    const digits = value.replace(/\D/g, '')
    // Add spaces every 4 digits
    return digits.replace(/(\d{4})/g, '$1 ').trim()
  }

  const handleCardNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCardNumber(e.target.value)
    if (formatted.length <= 19) { // Max length for formatted card number
      setPaymentData(prev => ({ ...prev, cardNumber: formatted }))
    }
  }

  const getCardBrand = (cardNumber: string) => {
    const number = cardNumber.replace(/\s/g, '')
    if (number.startsWith('4')) return 'visa'
    if (number.startsWith('5') || number.startsWith('2')) return 'mastercard'
    if (number.startsWith('3')) return 'amex'
    return 'unknown'
  }

  return (
    <div className="space-y-6">
      {/* Payment Amount Summary */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">Payment Amount</h3>
              <p className="text-gray-600">Total due for this invoice</p>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold text-green-600">
                ₱{amount.toFixed(2)}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Payment Method Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <CreditCard className="w-5 h-5 mr-2" />
            Payment Method
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Button
              variant={paymentMethod === 'credit_card' ? 'default' : 'outline'}
              className="h-20 flex flex-col items-center justify-center"
              onClick={() => setPaymentMethod('credit_card')}
            >
              <CreditCard className="w-6 h-6 mb-1" />
              Credit Card
            </Button>
            
            <Button
              variant={paymentMethod === 'debit_card' ? 'default' : 'outline'}
              className="h-20 flex flex-col items-center justify-center"
              onClick={() => setPaymentMethod('debit_card')}
            >
              <CreditCard className="w-6 h-6 mb-1" />
              Debit Card
            </Button>
            
            <Button
              variant={paymentMethod === 'insurance' ? 'default' : 'outline'}
              className="h-20 flex flex-col items-center justify-center"
              onClick={() => setPaymentMethod('insurance')}
            >
              <Shield className="w-6 h-6 mb-1" />
              Insurance
            </Button>
            
            <Button
              variant={paymentMethod === 'cash' ? 'default' : 'outline'}
              className="h-20 flex flex-col items-center justify-center"
              onClick={() => setPaymentMethod('cash')}
            >
              <PesoIcon className="w-6 h-6 mb-1" />
              Cash
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Card Payment Form */}
      {(paymentMethod === 'credit_card' || paymentMethod === 'debit_card') && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Lock className="w-5 h-5 mr-2" />
              Card Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Card Number */}
            <div>
              <Label htmlFor="cardNumber">Card Number</Label>
              <div className="relative">
                <Input
                  id="cardNumber"
                  placeholder="1234 5678 9012 3456"
                  value={paymentData.cardNumber}
                  onChange={handleCardNumberChange}
                  maxLength={19}
                />
                {paymentData.cardNumber && (
                  <div className="absolute right-3 top-2.5">
                    <Badge variant="secondary" className="text-xs">
                      {getCardBrand(paymentData.cardNumber).toUpperCase()}
                    </Badge>
                  </div>
                )}
              </div>
            </div>

            {/* Expiry and CVV */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="expiryMonth">Month</Label>
                <Select 
                  value={paymentData.expiryMonth} 
                  onValueChange={(value) => setPaymentData(prev => ({ ...prev, expiryMonth: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="MM" />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 12 }, (_, i) => (
                      <SelectItem key={i + 1} value={String(i + 1).padStart(2, '0')}>
                        {String(i + 1).padStart(2, '0')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label htmlFor="expiryYear">Year</Label>
                <Select 
                  value={paymentData.expiryYear} 
                  onValueChange={(value) => setPaymentData(prev => ({ ...prev, expiryYear: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="YYYY" />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 10 }, (_, i) => (
                      <SelectItem key={i} value={String(new Date().getFullYear() + i)}>
                        {new Date().getFullYear() + i}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label htmlFor="cvv">CVV</Label>
                <Input
                  id="cvv"
                  placeholder="123"
                  value={paymentData.cvv}
                  onChange={(e) => setPaymentData(prev => ({ ...prev, cvv: e.target.value.replace(/\D/g, '') }))}
                  maxLength={4}
                />
              </div>
            </div>

            {/* Cardholder Name */}
            <div>
              <Label htmlFor="holderName">Cardholder Name</Label>
              <Input
                id="holderName"
                placeholder="John Doe"
                value={paymentData.holderName}
                onChange={(e) => setPaymentData(prev => ({ ...prev, holderName: e.target.value }))}
              />
            </div>

            {/* Billing Address */}
            <div className="space-y-3">
              <h4 className="font-medium">Billing Address</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Input
                  placeholder="Street Address"
                  value={paymentData.billingAddress.street}
                  onChange={(e) => setPaymentData(prev => ({ 
                    ...prev, 
                    billingAddress: { ...prev.billingAddress, street: e.target.value } 
                  }))}
                />
                <Input
                  placeholder="City"
                  value={paymentData.billingAddress.city}
                  onChange={(e) => setPaymentData(prev => ({ 
                    ...prev, 
                    billingAddress: { ...prev.billingAddress, city: e.target.value } 
                  }))}
                />
                <Input
                  placeholder="State"
                  value={paymentData.billingAddress.state}
                  onChange={(e) => setPaymentData(prev => ({ 
                    ...prev, 
                    billingAddress: { ...prev.billingAddress, state: e.target.value } 
                  }))}
                />
                <Input
                  placeholder="ZIP Code"
                  value={paymentData.billingAddress.zipCode}
                  onChange={(e) => setPaymentData(prev => ({ 
                    ...prev, 
                    billingAddress: { ...prev.billingAddress, zipCode: e.target.value } 
                  }))}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Insurance Payment Form */}
      {paymentMethod === 'insurance' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Shield className="w-5 h-5 mr-2" />
              Insurance Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="provider">Insurance Provider</Label>
                <Select 
                  value={insuranceData.provider} 
                  onValueChange={(value) => setInsuranceData(prev => ({ ...prev, provider: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select provider" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="aetna">Aetna</SelectItem>
                    <SelectItem value="cigna">Cigna</SelectItem>
                    <SelectItem value="blue_cross">Blue Cross Blue Shield</SelectItem>
                    <SelectItem value="united">United Healthcare</SelectItem>
                    <SelectItem value="humana">Humana</SelectItem>
                    <SelectItem value="delta">Delta Dental</SelectItem>
                    <SelectItem value="philhealth">PhilHealth</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label htmlFor="policyNumber">Policy Number</Label>
                <Input
                  id="policyNumber"
                  placeholder="Policy number"
                  value={insuranceData.policyNumber}
                  onChange={(e) => setInsuranceData(prev => ({ ...prev, policyNumber: e.target.value }))}
                />
              </div>
              
              <div>
                <Label htmlFor="groupNumber">Group Number</Label>
                <Input
                  id="groupNumber"
                  placeholder="Group number"
                  value={insuranceData.groupNumber}
                  onChange={(e) => setInsuranceData(prev => ({ ...prev, groupNumber: e.target.value }))}
                />
              </div>
              
              <div>
                <Label htmlFor="subscriberId">Subscriber ID</Label>
                <Input
                  id="subscriberId"
                  placeholder="Subscriber ID"
                  value={insuranceData.subscriberId}
                  onChange={(e) => setInsuranceData(prev => ({ ...prev, subscriberId: e.target.value }))}
                />
              </div>
            </div>
            
            <div>
              <Label htmlFor="relationship">Relationship to Subscriber</Label>
              <Select 
                value={insuranceData.relationshipToSubscriber} 
                onValueChange={(value) => setInsuranceData(prev => ({ ...prev, relationshipToSubscriber: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="self">Self</SelectItem>
                  <SelectItem value="spouse">Spouse</SelectItem>
                  <SelectItem value="child">Child</SelectItem>
                  <SelectItem value="dependent">Dependent</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Security Notice */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="p-4">
          <div className="flex items-start space-x-3">
            <Shield className="w-5 h-5 text-blue-600 mt-0.5" />
            <div className="text-sm">
              <h4 className="font-medium text-blue-900 mb-1">Secure Payment Processing</h4>
              <p className="text-blue-800">
                Your payment information is encrypted and securely processed. We never store your 
                card details on our servers.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Process Payment Button */}
      <Button 
        onClick={processPayment}
        disabled={!paymentMethod || processing}
        className="w-full h-12 text-lg"
        size="lg"
      >
        {processing ? (
          <>
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
            Processing Payment...
          </>
        ) : (
          <>
            <CheckCircle className="w-5 h-5 mr-2" />
            Process Payment - ₱{amount.toFixed(2)}
          </>
        )}
      </Button>
    </div>
  )
}

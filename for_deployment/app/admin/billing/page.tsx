
'use client'

import { useState } from 'react'
import { useSession } from '@/components/auth/custom-session-provider'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import PaymentProcessor from '@/components/billing/payment-processor'
import InsuranceClaimAutomation from '@/components/billing/insurance-claim-automation'
import BillingWorkflows from '@/components/billing/billing-workflows'

export default function AdminBillingPage() {
  const { data: session } = useSession() || {}
  const [activeTab, setActiveTab] = useState('workflows')

  return (
    <DashboardLayout title="Complete Billing System">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="workflows">Billing Workflows</TabsTrigger>
          <TabsTrigger value="payments">Payment Processing</TabsTrigger>
          <TabsTrigger value="insurance">Insurance Claims</TabsTrigger>
        </TabsList>

        <TabsContent value="workflows">
          <BillingWorkflows />
        </TabsContent>

        <TabsContent value="payments">
          <PaymentProcessor
            billingId="demo-billing-1"
            amount={250.00}
            patientId="demo-patient-1"
            onPaymentSuccess={(paymentId) => {
              console.log('Payment successful:', paymentId)
            }}
            onPaymentError={(error) => {
              console.error('Payment error:', error)
            }}
          />
        </TabsContent>

        <TabsContent value="insurance">
          <InsuranceClaimAutomation
            billingId="demo-billing-1"
            patientId="demo-patient-1"
            appointmentId="demo-appointment-1"
          />
        </TabsContent>
      </Tabs>
    </DashboardLayout>
  )
}

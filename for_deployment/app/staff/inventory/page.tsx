

'use client'

import { useState, useEffect } from 'react'
import { useSession } from '@/components/auth/custom-session-provider'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Package, AlertTriangle, Plus, Minus, Search, Bell, TrendingDown } from 'lucide-react'

interface InventoryItem {
  id: string
  name: string
  category: string
  currentStock: number
  minimumStock: number
  unit: string
  costPerUnit: number
  supplier: string
  lastRestocked: string
  usageRate: number
  status: 'normal' | 'low' | 'critical' | 'out_of_stock'
}

export default function StaffInventoryPage() {
  const { data: session } = useSession() || {}
  const [inventory, setInventory] = useState<InventoryItem[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [showStockUpdate, setShowStockUpdate] = useState<string | null>(null)
  const [stockChange, setStockChange] = useState({ quantity: '', notes: '', type: 'usage' })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Fetch inventory data from API
    async function fetchInventory() {
      try {
        const response = await fetch('/api/inventory')
        if (response.ok) {
          const result = await response.json()
          if (result.success) {
            const formattedInventory = result.data.items.map((item: any) => ({
              id: item.id,
              name: item.name,
              category: item.category,
              currentStock: item.currentStock,
              minimumStock: item.minimumStock,
              unit: item.unit,
              costPerUnit: Number(item.costPerUnit),
              supplier: item.supplier?.name || 'N/A',
              lastRestocked: item.lastRestocked ? new Date(item.lastRestocked).toISOString().split('T')[0] : '2024-01-01',
              usageRate: Number(item.usageRate) || 0,
              status: item.calculatedStatus || item.status
            }))
            setInventory(formattedInventory)
          }
        } else {
          console.error('Failed to fetch inventory')
        }
      } catch (error) {
        console.error('Error fetching inventory:', error)
      } finally {
        setLoading(false)
      }
    }
    
    fetchInventory()
  }, [])

  const filteredInventory = inventory.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.supplier.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesCategory = selectedCategory === 'all' || item.category.toLowerCase() === selectedCategory.toLowerCase()
    
    return matchesSearch && matchesCategory
  })

  const criticalItems = inventory.filter(item => item.status === 'critical' || item.status === 'out_of_stock')
  const lowStockItems = inventory.filter(item => item.status === 'low')

  const handleStockUpdate = async () => {
    if (!showStockUpdate || !stockChange.quantity) return

    try {
      const response = await fetch('/api/inventory/transactions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          inventoryItemId: showStockUpdate,
          type: stockChange.type,
          quantity: parseInt(stockChange.quantity),
          reason: stockChange.notes || `${stockChange.type} logged by staff`
        })
      })

      if (response.ok) {
        // Refresh inventory data
        const inventoryResponse = await fetch('/api/inventory')
        if (inventoryResponse.ok) {
          const result = await inventoryResponse.json()
          if (result.success) {
            const formattedInventory = result.data.items.map((item: any) => ({
              id: item.id,
              name: item.name,
              category: item.category,
              currentStock: item.currentStock,
              minimumStock: item.minimumStock,
              unit: item.unit,
              costPerUnit: Number(item.costPerUnit),
              supplier: item.supplier?.name || 'N/A',
              lastRestocked: item.lastRestocked ? new Date(item.lastRestocked).toISOString().split('T')[0] : '2024-01-01',
              usageRate: Number(item.usageRate) || 0,
              status: item.calculatedStatus || item.status
            }))
            setInventory(formattedInventory)
          }
        }

        // Reset form
        setStockChange({ quantity: '', notes: '', type: 'usage' })
        setShowStockUpdate(null)
      } else {
        console.error('Failed to update stock')
      }
    } catch (error) {
      console.error('Error updating stock:', error)
    }
  }

  const getStatusBadge = (status: string) => {
    const statusColors = {
      'normal': 'bg-green-100 text-green-800',
      'low': 'bg-yellow-100 text-yellow-800',
      'critical': 'bg-red-100 text-red-800',
      'out_of_stock': 'bg-red-100 text-red-800'
    }
    
    return (
      <Badge className={statusColors[status as keyof typeof statusColors] || 'bg-gray-100 text-gray-800'}>
        {status.replace('_', ' ').toUpperCase()}
      </Badge>
    )
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Inventory Management</h1>
          <p className="text-gray-600">Assist with inventory management and stock updates</p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Items</p>
                  <p className="text-2xl font-bold">{inventory.length}</p>
                </div>
                <Package className="h-8 w-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Critical Items</p>
                  <p className="text-2xl font-bold text-red-600">{criticalItems.length}</p>
                </div>
                <AlertTriangle className="h-8 w-8 text-red-600" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Low Stock</p>
                  <p className="text-2xl font-bold text-yellow-600">{lowStockItems.length}</p>
                </div>
                <TrendingDown className="h-8 w-8 text-yellow-600" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Value</p>
                  <p className="text-2xl font-bold">
                    ₱{inventory.reduce((sum, item) => sum + (item.currentStock * item.costPerUnit), 0).toFixed(2)}
                  </p>
                </div>
                <Package className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="inventory" className="space-y-6">
          <TabsList>
            <TabsTrigger value="inventory">Current Inventory</TabsTrigger>
            <TabsTrigger value="alerts">Stock Alerts</TabsTrigger>
            <TabsTrigger value="usage">Usage Log</TabsTrigger>
          </TabsList>

          <TabsContent value="inventory">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Inventory Items</CardTitle>
                  <div className="flex items-center space-x-4">
                    <div className="relative">
                      <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
                      <Input
                        placeholder="Search inventory..."
                        className="pl-8 w-64"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                      />
                    </div>
                    <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                      <SelectTrigger className="w-48">
                        <SelectValue placeholder="All Categories" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Categories</SelectItem>
                        <SelectItem value="restorative">Restorative</SelectItem>
                        <SelectItem value="anesthetic">Anesthetic</SelectItem>
                        <SelectItem value="disposable">Disposable</SelectItem>
                        <SelectItem value="preventive">Preventive</SelectItem>
                        <SelectItem value="surgical">Surgical</SelectItem>
                        <SelectItem value="equipment">Equipment</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {filteredInventory.map((item) => (
                    <div key={item.id} className="border rounded-lg p-3 sm:p-4">
                      <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
                            <div className="min-w-0">
                              <h3 className="font-semibold text-sm sm:text-base break-anywhere">{item.name}</h3>
                              <p className="text-xs sm:text-sm text-gray-600 break-anywhere">Category: {item.category} • Supplier: {item.supplier}</p>
                            </div>
                            <div className="flex-shrink-0">{getStatusBadge(item.status)}</div>
                          </div>
                          
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4 text-xs sm:text-sm">
                            <div>
                              <span className="font-medium">Current Stock:</span>
                              <p>{item.currentStock} {item.unit}</p>
                            </div>
                            <div>
                              <span className="font-medium">Min Stock:</span>
                              <p>{item.minimumStock} {item.unit}</p>
                            </div>
                            <div>
                              <span className="font-medium">Cost per Unit:</span>
                              <p>₱{item.costPerUnit.toFixed(2)}</p>
                            </div>
                            <div>
                              <span className="font-medium">Last Restocked:</span>
                              <p>{item.lastRestocked}</p>
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex sm:ml-4 flex-shrink-0">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setShowStockUpdate(item.id)}
                            className="w-full sm:w-auto"
                          >
                            Update Stock
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="alerts">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <AlertTriangle className="mr-2 h-5 w-5 text-red-600" />
                  Stock Alerts
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600 mb-4">
                  Log inventory usage on behalf of dentists during procedures
                </p>
                <div className="space-y-4">
                  {inventory.filter(item => item.currentStock > 0).map((item) => (
                    <div key={item.id} className="flex items-center justify-between p-3 border rounded">
                      <div>
                        <p className="font-medium">{item.name}</p>
                        <p className="text-sm text-gray-600">
                          {item.currentStock} {item.unit} available
                        </p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Button size="sm" variant="outline">
                          <Minus className="w-4 h-4" />
                        </Button>
                        <span className="text-sm">Log Usage</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="usage">
            <Card>
              <CardHeader>
                <CardTitle>Recent Usage</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">Usage history will be displayed here.</p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Stock Update Modal */}
        {showStockUpdate && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <Card className="w-96">
              <CardHeader>
                <CardTitle>Update Stock</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {(() => {
                  const item = inventory.find(i => i.id === showStockUpdate)
                  if (!item) return null
                  
                  return (
                    <>
                      <div>
                        <Label className="font-medium">{item.name}</Label>
                        <p className="text-sm text-gray-600">
                          Current Stock: {item.currentStock} {item.unit}
                        </p>
                      </div>
                      <div>
                        <Label>Transaction Type</Label>
                        <Select value={stockChange.type} onValueChange={(value) => 
                          setStockChange(prev => ({ ...prev, type: value }))}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="usage">Usage</SelectItem>
                            <SelectItem value="restock">Restock</SelectItem>
                            <SelectItem value="adjustment">Adjustment</SelectItem>
                            <SelectItem value="waste">Waste</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Quantity</Label>
                        <Input
                          type="number"
                          placeholder="Enter quantity"
                          value={stockChange.quantity}
                          onChange={(e) => setStockChange(prev => ({ ...prev, quantity: e.target.value }))}
                        />
                      </div>
                      <div>
                        <Label>Notes</Label>
                        <Input
                          placeholder="Optional notes"
                          value={stockChange.notes}
                          onChange={(e) => setStockChange(prev => ({ ...prev, notes: e.target.value }))}
                        />
                      </div>
                      <div className="flex space-x-2">
                        <Button onClick={handleStockUpdate} className="flex-1">
                          Update Stock
                        </Button>
                        <Button 
                          variant="outline" 
                          onClick={() => setShowStockUpdate(null)}
                          className="flex-1"
                        >
                          Cancel
                        </Button>
                      </div>
                    </>
                  )
                })()}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}

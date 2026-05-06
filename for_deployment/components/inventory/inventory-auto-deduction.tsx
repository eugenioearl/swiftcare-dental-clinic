
'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { 
  Package, 
  Minus, 
  Plus,
  AlertTriangle,
  CheckCircle,
  ShoppingCart,
  BarChart3,
  Activity,
  TrendingDown,
  RefreshCw
} from 'lucide-react'

interface InventoryItem {
  id: string
  name: string
  category: string
  currentStock: number
  minimumStock: number
  maximumStock: number
  unitCost: number
  supplier: string
  autoReorderEnabled: boolean
  reorderQuantity: number
  lastUpdated: string
  usageHistory: UsageRecord[]
}

interface UsageRecord {
  id: string
  date: string
  procedureCode: string
  procedureName: string
  quantityUsed: number
  patientId: string
  dentistId: string
  cost: number
}

interface AutoDeduction {
  id: string
  procedureCode: string
  procedureName: string
  items: DeductionItem[]
  isActive: boolean
}

interface DeductionItem {
  inventoryId: string
  inventoryName: string
  quantityPerProcedure: number
  cost: number
}

interface ReorderAlert {
  id: string
  inventoryId: string
  inventoryName: string
  currentStock: number
  minimumStock: number
  reorderQuantity: number
  estimatedCost: number
  priority: 'low' | 'medium' | 'high' | 'critical'
  daysUntilStockout: number
}

export default function InventoryAutoDeduction() {
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([])
  const [autoDeductions, setAutoDeductions] = useState<AutoDeduction[]>([])
  const [reorderAlerts, setReorderAlerts] = useState<ReorderAlert[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedCategory, setSelectedCategory] = useState<string>('all')

  // Mock inventory data
  const mockInventoryItems: InventoryItem[] = [
    {
      id: 'inv-1',
      name: 'Composite Resin - Shade A2',
      category: 'Restorative Materials',
      currentStock: 15,
      minimumStock: 20,
      maximumStock: 100,
      unitCost: 25.99,
      supplier: 'Dental Supply Co.',
      autoReorderEnabled: true,
      reorderQuantity: 50,
      lastUpdated: '2024-09-09T14:30:00Z',
      usageHistory: [
        {
          id: 'usage-1',
          date: '2024-09-09T10:00:00Z',
          procedureCode: 'D2140',
          procedureName: 'Amalgam restoration - one surface',
          quantityUsed: 2,
          patientId: 'patient-1',
          dentistId: 'dentist-1',
          cost: 51.98
        }
      ]
    },
    {
      id: 'inv-2',
      name: 'Local Anesthetic (2% Lidocaine)',
      category: 'Anesthetics',
      currentStock: 8,
      minimumStock: 15,
      maximumStock: 50,
      unitCost: 12.50,
      supplier: 'Medical Supplies Inc.',
      autoReorderEnabled: true,
      reorderQuantity: 25,
      lastUpdated: '2024-09-09T12:15:00Z',
      usageHistory: []
    },
    {
      id: 'inv-3',
      name: 'Disposable Gloves (Nitrile)',
      category: 'Safety & PPE',
      currentStock: 180,
      minimumStock: 200,
      maximumStock: 1000,
      unitCost: 0.15,
      supplier: 'Safety First Medical',
      autoReorderEnabled: true,
      reorderQuantity: 500,
      lastUpdated: '2024-09-09T09:45:00Z',
      usageHistory: []
    },
    {
      id: 'inv-4',
      name: 'Dental Burs - Round #2',
      category: 'Instruments',
      currentStock: 45,
      minimumStock: 30,
      maximumStock: 200,
      unitCost: 3.25,
      supplier: 'Precision Tools Ltd.',
      autoReorderEnabled: false,
      reorderQuantity: 100,
      lastUpdated: '2024-09-08T16:20:00Z',
      usageHistory: []
    }
  ]

  const mockAutoDeductions: AutoDeduction[] = [
    {
      id: 'deduction-1',
      procedureCode: 'D2140',
      procedureName: 'Amalgam restoration - one surface',
      isActive: true,
      items: [
        {
          inventoryId: 'inv-1',
          inventoryName: 'Composite Resin - Shade A2',
          quantityPerProcedure: 2,
          cost: 51.98
        },
        {
          inventoryId: 'inv-2',
          inventoryName: 'Local Anesthetic (2% Lidocaine)',
          quantityPerProcedure: 1,
          cost: 12.50
        },
        {
          inventoryId: 'inv-3',
          inventoryName: 'Disposable Gloves (Nitrile)',
          quantityPerProcedure: 4,
          cost: 0.60
        }
      ]
    },
    {
      id: 'deduction-2',
      procedureCode: 'D1110',
      procedureName: 'Adult prophylaxis',
      isActive: true,
      items: [
        {
          inventoryId: 'inv-3',
          inventoryName: 'Disposable Gloves (Nitrile)',
          quantityPerProcedure: 2,
          cost: 0.30
        }
      ]
    }
  ]

  const mockReorderAlerts: ReorderAlert[] = [
    {
      id: 'alert-1',
      inventoryId: 'inv-1',
      inventoryName: 'Composite Resin - Shade A2',
      currentStock: 15,
      minimumStock: 20,
      reorderQuantity: 50,
      estimatedCost: 1299.50,
      priority: 'high',
      daysUntilStockout: 8
    },
    {
      id: 'alert-2',
      inventoryId: 'inv-2',
      inventoryName: 'Local Anesthetic (2% Lidocaine)',
      currentStock: 8,
      minimumStock: 15,
      reorderQuantity: 25,
      estimatedCost: 312.50,
      priority: 'critical',
      daysUntilStockout: 3
    },
    {
      id: 'alert-3',
      inventoryId: 'inv-3',
      inventoryName: 'Disposable Gloves (Nitrile)',
      currentStock: 180,
      minimumStock: 200,
      reorderQuantity: 500,
      estimatedCost: 75.00,
      priority: 'medium',
      daysUntilStockout: 12
    }
  ]

  useEffect(() => {
    // Simulate loading data
    setTimeout(() => {
      setInventoryItems(mockInventoryItems)
      setAutoDeductions(mockAutoDeductions)
      setReorderAlerts(mockReorderAlerts)
      setLoading(false)
    }, 1000)
  }, [])

  const processAutoReorder = async (alertId: string) => {
    const alert = reorderAlerts.find(a => a.id === alertId)
    if (!alert) return

    // Simulate reorder process
    await new Promise(resolve => setTimeout(resolve, 2000))

    // Update inventory
    setInventoryItems(prev => prev.map(item => 
      item.id === alert.inventoryId 
        ? { ...item, currentStock: item.currentStock + alert.reorderQuantity }
        : item
    ))

    // Remove alert
    setReorderAlerts(prev => prev.filter(a => a.id !== alertId))
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'bg-red-100 text-red-800'
      case 'high': return 'bg-orange-100 text-orange-800'
      case 'medium': return 'bg-yellow-100 text-yellow-800'
      default: return 'bg-blue-100 text-blue-800'
    }
  }

  const getStockStatus = (item: InventoryItem) => {
    if (item.currentStock <= item.minimumStock * 0.5) return 'critical'
    if (item.currentStock <= item.minimumStock) return 'low'
    if (item.currentStock >= item.maximumStock * 0.9) return 'high'
    return 'normal'
  }

  const getStockStatusColor = (status: string) => {
    switch (status) {
      case 'critical': return 'text-red-600'
      case 'low': return 'text-orange-600'
      case 'high': return 'text-blue-600'
      default: return 'text-green-600'
    }
  }

  const categories = ['all', ...Array.from(new Set(inventoryItems.map(item => item.category)))]
  const filteredItems = selectedCategory === 'all' 
    ? inventoryItems 
    : inventoryItems.filter(item => item.category === selectedCategory)

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
          <h2 className="text-2xl font-bold">Inventory Auto-Deduction System</h2>
          <p className="text-gray-600">Automatic inventory management during procedures</p>
        </div>
        <div className="flex items-center space-x-2">
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {categories.map(category => (
                <SelectItem key={category} value={category}>
                  {category === 'all' ? 'All Categories' : category}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Dashboard Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {inventoryItems.length}
              </div>
              <div className="text-sm text-gray-600">Total Items</div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">
                {reorderAlerts.length}
              </div>
              <div className="text-sm text-gray-600">Reorder Alerts</div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {autoDeductions.filter(d => d.isActive).length}
              </div>
              <div className="text-sm text-gray-600">Active Rules</div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">
                ₱{inventoryItems.reduce((sum, item) => sum + (item.currentStock * item.unitCost), 0).toFixed(2)}
              </div>
              <div className="text-sm text-gray-600">Inventory Value</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Reorder Alerts */}
      {reorderAlerts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center text-red-600">
              <AlertTriangle className="w-5 h-5 mr-2" />
              Reorder Alerts ({reorderAlerts.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {reorderAlerts.map(alert => (
                <div key={alert.id} className="flex items-center justify-between p-4 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-1">
                      <h4 className="font-medium text-red-900">{alert.inventoryName}</h4>
                      <Badge className={getPriorityColor(alert.priority)}>
                        {alert.priority}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-4 gap-4 text-sm text-red-800">
                      <div>Current: {alert.currentStock}</div>
                      <div>Minimum: {alert.minimumStock}</div>
                      <div>Reorder: {alert.reorderQuantity}</div>
                      <div>Cost: ₱{alert.estimatedCost.toFixed(2)}</div>
                    </div>
                    <div className="text-xs text-red-700 mt-1">
                      Estimated {alert.daysUntilStockout} days until stockout
                    </div>
                  </div>
                  <Button 
                    onClick={() => processAutoReorder(alert.id)}
                    className="bg-red-600 hover:bg-red-700"
                  >
                    <ShoppingCart className="w-4 h-4 mr-1" />
                    Auto Reorder
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Current Inventory */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Package className="w-5 h-5 mr-2" />
            Current Inventory
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {filteredItems.map(item => {
              const stockStatus = getStockStatus(item)
              const stockPercentage = (item.currentStock / item.maximumStock) * 100
              
              return (
                <div key={item.id} className="p-4 border rounded-lg hover:bg-gray-50">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <div className="flex items-center space-x-2 mb-1">
                        <h4 className="font-medium">{item.name}</h4>
                        <Badge variant="outline">{item.category}</Badge>
                        {item.autoReorderEnabled && (
                          <Badge className="bg-green-100 text-green-800">
                            <RefreshCw className="w-3 h-3 mr-1" />
                            Auto Reorder
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-gray-600">Supplier: {item.supplier}</p>
                    </div>
                    <div className="text-right">
                      <div className={`text-lg font-bold ${getStockStatusColor(stockStatus)}`}>
                        {item.currentStock}
                      </div>
                      <div className="text-sm text-gray-600">₱{item.unitCost.toFixed(2)} each</div>
                    </div>
                  </div>

                  {/* Stock Level Indicator */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Stock Level</span>
                      <span>{Math.round(stockPercentage)}%</span>
                    </div>
                    <Progress value={stockPercentage} className="h-2" />
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>Min: {item.minimumStock}</span>
                      <span>Current: {item.currentStock}</span>
                      <span>Max: {item.maximumStock}</span>
                    </div>
                  </div>

                  {/* Usage Statistics */}
                  {item.usageHistory.length > 0 && (
                    <div className="mt-3 p-2 bg-blue-50 rounded">
                      <div className="text-sm font-medium text-blue-900">Recent Usage</div>
                      <div className="text-xs text-blue-800">
                        Last used: {new Date(item.usageHistory[0].date).toLocaleDateString()} 
                        ({item.usageHistory[0].quantityUsed} units for {item.usageHistory[0].procedureName})
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Auto-Deduction Rules */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Activity className="w-5 h-5 mr-2" />
            Auto-Deduction Rules
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {autoDeductions.map(rule => (
              <div key={rule.id} className="p-4 border rounded-lg">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <div className="flex items-center space-x-2 mb-1">
                      <h4 className="font-medium">{rule.procedureName}</h4>
                      <Badge variant="outline">{rule.procedureCode}</Badge>
                      <Badge className={rule.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
                        {rule.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                  </div>
                  <Button variant="outline" size="sm">
                    <Settings className="w-4 h-4 mr-1" />
                    Edit Rule
                  </Button>
                </div>

                <div className="space-y-2">
                  <div className="text-sm font-medium">Inventory Deductions:</div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {rule.items.map((item, index) => (
                      <div key={index} className="p-3 bg-gray-50 rounded flex justify-between items-center">
                        <div>
                          <div className="font-medium text-sm">{item.inventoryName}</div>
                          <div className="text-xs text-gray-600">
                            {item.quantityPerProcedure} units @ ₱{(item.cost / item.quantityPerProcedure).toFixed(2)}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold">₱{item.cost.toFixed(2)}</div>
                          <div className="flex items-center text-xs text-red-600">
                            <Minus className="w-3 h-3 mr-1" />
                            {item.quantityPerProcedure}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="text-right text-sm font-medium">
                    Total Cost per Procedure: ₱{rule.items.reduce((sum, item) => sum + item.cost, 0).toFixed(2)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Cost Tracking Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <BarChart3 className="w-5 h-5 mr-2" />
            Cost Tracking Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <TrendingDown className="w-8 h-8 text-blue-600 mx-auto mb-2" />
              <div className="text-2xl font-bold text-blue-600">₱247.85</div>
              <div className="text-sm text-blue-800">Materials Cost Today</div>
            </div>
            
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <Activity className="w-8 h-8 text-green-600 mx-auto mb-2" />
              <div className="text-2xl font-bold text-green-600">₱1,845.20</div>
              <div className="text-sm text-green-800">Materials Cost This Month</div>
            </div>
            
            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <Package className="w-8 h-8 text-purple-600 mx-auto mb-2" />
              <div className="text-2xl font-bold text-purple-600">15.2%</div>
              <div className="text-sm text-purple-800">Materials vs Revenue Ratio</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

const Settings = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
)

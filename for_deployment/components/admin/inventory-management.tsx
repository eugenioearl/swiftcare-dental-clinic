
'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Plus, Search, Edit2, Package, AlertTriangle, TrendingUp, Calendar } from 'lucide-react'
import { PesoIcon } from '@/components/ui/peso-icon'
import { toast } from 'react-hot-toast'

interface InventoryItem {
  id: string
  name: string
  description?: string
  category: string
  barcode?: string
  sku?: string
  currentStock: number | string
  minimumStock: number | string
  maximumStock?: number | string
  unit: string
  costPerUnit: number | string
  sellingPrice?: number | string
  location?: string
  expiryDate?: string
  batchNumber?: string
  reorderPoint: number | string
  status?: string
  calculatedStatus?: string
  totalValue: number | string
  supplier?: {
    id: string
    name: string
  }
  transactions?: Array<{
    id: string
    type: string
    quantity: number
    createdAt: string
    user: {
      firstName: string
      lastName: string
    }
  }>
}

interface InventoryStats {
  totalItems: number
  totalStock: number
  lowStockItems: number
  expiredItems: number
}

export default function InventoryManagement() {
  const [items, setItems] = useState<InventoryItem[]>([])
  const [stats, setStats] = useState<InventoryStats>({
    totalItems: 0,
    totalStock: 0,
    lowStockItems: 0,
    expiredItems: 0
  })
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [selectedStatus, setSelectedStatus] = useState('all')
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: '',
    barcode: '',
    sku: '',
    currentStock: '',
    minimumStock: '',
    maximumStock: '',
    unit: '',
    costPerUnit: '',
    sellingPrice: '',
    location: '',
    expiryDate: '',
    batchNumber: '',
    reorderPoint: '',
    notes: ''
  })

  const categories = [
    'restorative',
    'preventive',
    'surgical',
    'anesthetic',
    'disposable',
    'equipment',
    'laboratory',
    'orthodontic',
    'endodontic',
    'periodontic',
    'oral_surgery',
    'radiology',
    'sterilization',
    'office_supplies',
    'other'
  ]

  const statusOptions = [
    { value: 'all', label: 'All Items' },
    { value: 'active', label: 'Active' },
    { value: 'low', label: 'Low Stock' },
    { value: 'critical', label: 'Critical' },
    { value: 'out_of_stock', label: 'Out of Stock' },
    { value: 'expired', label: 'Expired' }
  ]

  const fetchInventory = async () => {
    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '12',
        ...(searchTerm && { search: searchTerm }),
        ...(selectedCategory !== 'all' && { category: selectedCategory }),
        ...(selectedStatus !== 'all' && { status: selectedStatus })
      })

      const response = await fetch(`/api/inventory?${params}`)
      const data = await response.json()
      
      if (data.success) {
        setItems(data.data.items)
        setStats(data.data.stats)
        setTotalPages(data.data.pagination.pages)
      } else {
        toast.error('Failed to load inventory')
      }
    } catch (error) {
      toast.error('Error loading inventory')
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchInventory()
  }, [currentPage, searchTerm, selectedCategory, selectedStatus])

  const handleCreateItem = async () => {
    try {
      const payload = {
        ...formData,
        currentStock: parseInt(formData.currentStock) || 0,
        minimumStock: parseInt(formData.minimumStock) || 0,
        maximumStock: formData.maximumStock ? parseInt(formData.maximumStock) : undefined,
        costPerUnit: parseFloat(formData.costPerUnit) || 0,
        sellingPrice: formData.sellingPrice ? parseFloat(formData.sellingPrice) : undefined,
        reorderPoint: parseInt(formData.reorderPoint) || 0,
        expiryDate: formData.expiryDate || undefined
      }

      const response = await fetch('/api/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      const data = await response.json()

      if (data.success) {
        toast.success('Inventory item created successfully')
        setIsCreateDialogOpen(false)
        resetForm()
        fetchInventory()
      } else {
        toast.error(data.error || 'Failed to create inventory item')
      }
    } catch (error) {
      toast.error('Error creating inventory item')
      console.error('Error:', error)
    }
  }

  const handleEditItem = async () => {
    if (!editingItem) return

    try {
      const payload = {
        ...formData,
        currentStock: parseInt(formData.currentStock) || 0,
        minimumStock: parseInt(formData.minimumStock) || 0,
        maximumStock: formData.maximumStock ? parseInt(formData.maximumStock) : undefined,
        costPerUnit: parseFloat(formData.costPerUnit) || 0,
        sellingPrice: formData.sellingPrice ? parseFloat(formData.sellingPrice) : undefined,
        reorderPoint: parseInt(formData.reorderPoint) || 0,
        expiryDate: formData.expiryDate || undefined
      }

      const response = await fetch(`/api/inventory/${editingItem.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      const data = await response.json()

      if (data.success) {
        toast.success('Inventory item updated successfully')
        setIsEditDialogOpen(false)
        setEditingItem(null)
        resetForm()
        fetchInventory()
      } else {
        toast.error(data.error || 'Failed to update inventory item')
      }
    } catch (error) {
      toast.error('Error updating inventory item')
      console.error('Error:', error)
    }
  }

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      category: '',
      barcode: '',
      sku: '',
      currentStock: '',
      minimumStock: '',
      maximumStock: '',
      unit: '',
      costPerUnit: '',
      sellingPrice: '',
      location: '',
      expiryDate: '',
      batchNumber: '',
      reorderPoint: '',
      notes: ''
    })
  }

  const openEditDialog = (item: InventoryItem) => {
    setEditingItem(item)
    setFormData({
      name: item.name,
      description: item.description || '',
      category: item.category,
      barcode: item.barcode || '',
      sku: item.sku || '',
      currentStock: Number(item.currentStock || 0).toString(),
      minimumStock: Number(item.minimumStock || 0).toString(),
      maximumStock: item.maximumStock ? Number(item.maximumStock).toString() : '',
      unit: item.unit,
      costPerUnit: Number(item.costPerUnit || 0).toString(),
      sellingPrice: item.sellingPrice ? Number(item.sellingPrice).toString() : '',
      location: item.location || '',
      expiryDate: item.expiryDate ? new Date(item.expiryDate).toISOString().split('T')[0] : '',
      batchNumber: item.batchNumber || '',
      reorderPoint: Number(item.reorderPoint || 0).toString(),
      notes: ''
    })
    setIsEditDialogOpen(true)
  }

  const getStatusBadge = (item: InventoryItem) => {
    const status = item.calculatedStatus || item.status

    switch (status) {
      case 'critical':
        return <Badge variant="destructive">Critical</Badge>
      case 'low':
        return <Badge variant="secondary">Low Stock</Badge>
      case 'out_of_stock':
        return <Badge variant="outline">Out of Stock</Badge>
      case 'expired':
        return <Badge variant="destructive">Expired</Badge>
      default:
        return <Badge variant="default">Active</Badge>
    }
  }

  const totalInventoryValue = items.reduce((sum, item) => sum + Number(item.totalValue || 0), 0)

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
          <h1 className="text-3xl font-bold">Inventory Management</h1>
          <p className="text-muted-foreground">Manage your dental supplies and equipment</p>
        </div>
        
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Add Item
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add New Inventory Item</DialogTitle>
              <DialogDescription>
                Create a new inventory item for your dental supplies
              </DialogDescription>
            </DialogHeader>
            <Tabs defaultValue="basic" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="basic">Basic Info</TabsTrigger>
                <TabsTrigger value="details">Details & Stock</TabsTrigger>
              </TabsList>
              <TabsContent value="basic" className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div className="col-span-2 space-y-2">
                    <Label htmlFor="name">Item Name*</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Composite Resin - A2 Shade"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="category">Category*</Label>
                    <Select value={formData.category} onValueChange={(value) => setFormData({ ...formData, category: value })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((cat) => (
                          <SelectItem key={cat} value={cat}>
                            {cat.replace('_', ' ').toUpperCase()}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="unit">Unit*</Label>
                    <Input
                      id="unit"
                      value={formData.unit}
                      onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                      placeholder="syringe, bottle, box"
                    />
                  </div>
                  <div className="col-span-2 space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Universal composite resin for anterior and posterior restorations"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="barcode">Barcode</Label>
                    <Input
                      id="barcode"
                      value={formData.barcode}
                      onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="sku">SKU</Label>
                    <Input
                      id="sku"
                      value={formData.sku}
                      onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                    />
                  </div>
                </div>
              </TabsContent>
              <TabsContent value="details" className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="currentStock">Current Stock*</Label>
                    <Input
                      id="currentStock"
                      type="number"
                      min="0"
                      value={formData.currentStock}
                      onChange={(e) => setFormData({ ...formData, currentStock: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="minimumStock">Minimum Stock*</Label>
                    <Input
                      id="minimumStock"
                      type="number"
                      min="0"
                      value={formData.minimumStock}
                      onChange={(e) => setFormData({ ...formData, minimumStock: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reorderPoint">Reorder Point</Label>
                    <Input
                      id="reorderPoint"
                      type="number"
                      min="0"
                      value={formData.reorderPoint}
                      onChange={(e) => setFormData({ ...formData, reorderPoint: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="maximumStock">Maximum Stock</Label>
                    <Input
                      id="maximumStock"
                      type="number"
                      min="0"
                      value={formData.maximumStock}
                      onChange={(e) => setFormData({ ...formData, maximumStock: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="costPerUnit">Cost per Unit ($)*</Label>
                    <Input
                      id="costPerUnit"
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.costPerUnit}
                      onChange={(e) => setFormData({ ...formData, costPerUnit: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="sellingPrice">Selling Price ($)</Label>
                    <Input
                      id="sellingPrice"
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.sellingPrice}
                      onChange={(e) => setFormData({ ...formData, sellingPrice: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="location">Location</Label>
                    <Input
                      id="location"
                      value={formData.location}
                      onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                      placeholder="Cabinet A, Shelf 2"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="batchNumber">Batch Number</Label>
                    <Input
                      id="batchNumber"
                      value={formData.batchNumber}
                      onChange={(e) => setFormData({ ...formData, batchNumber: e.target.value })}
                    />
                  </div>
                  <div className="col-span-2 space-y-2">
                    <Label htmlFor="expiryDate">Expiry Date</Label>
                    <Input
                      id="expiryDate"
                      type="date"
                      value={formData.expiryDate}
                      onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
                    />
                  </div>
                </div>
              </TabsContent>
            </Tabs>
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateItem}>
                Create Item
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Package className="h-8 w-8 text-blue-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Total Items</p>
                <p className="text-2xl font-bold">{stats.totalItems}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <TrendingUp className="h-8 w-8 text-green-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Total Stock</p>
                <p className="text-2xl font-bold">{stats.totalStock}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <AlertTriangle className="h-8 w-8 text-yellow-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Low Stock</p>
                <p className="text-2xl font-bold text-yellow-600">{stats.lowStockItems}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Calendar className="h-8 w-8 text-red-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Expired</p>
                <p className="text-2xl font-bold text-red-600">{stats.expiredItems}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <PesoIcon className="h-8 w-8 text-purple-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Total Value</p>
                <p className="text-2xl font-bold">₱{totalInventoryValue.toFixed(2)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filter Inventory</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search inventory..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
            <div className="w-full md:w-48">
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map((category) => (
                    <SelectItem key={category} value={category}>
                      {category.replace('_', ' ').toUpperCase()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-full md:w-48">
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map((status) => (
                    <SelectItem key={status.value} value={status.value}>
                      {status.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Inventory Items */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map((item) => (
          <Card key={item.id} className="hover:shadow-md transition-shadow">
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-lg">{item.name}</CardTitle>
                  <CardDescription>
                    {item.category.replace('_', ' ').toUpperCase()} • {item.unit}
                  </CardDescription>
                </div>
                <div className="flex items-center space-x-2">
                  {getStatusBadge(item)}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openEditDialog(item)}
                  >
                    <Edit2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {item.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {item.description}
                  </p>
                )}

                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-sm text-muted-foreground">Current Stock</p>
                    <p className="text-xl font-bold">
                      {Number(item.currentStock || 0)} {item.unit}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">Value</p>
                    <p className="text-lg font-semibold text-green-600">
                      ₱{Number(item.totalValue || 0).toFixed(2)}
                    </p>
                  </div>
                </div>

                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Min: {Number(item.minimumStock || 0)}</span>
                  <span>Cost: ₱{Number(item.costPerUnit || 0).toFixed(2)}</span>
                </div>

                {item.location && (
                  <p className="text-sm text-muted-foreground">
                    📍 {item.location}
                  </p>
                )}

                {item.supplier && (
                  <p className="text-sm text-muted-foreground">
                    🏢 {item.supplier.name}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center space-x-2">
          <Button
            variant="outline"
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(currentPage - 1)}
          >
            Previous
          </Button>
          <span className="flex items-center px-4">
            Page {currentPage} of {totalPages}
          </span>
          <Button
            variant="outline"
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage(currentPage + 1)}
          >
            Next
          </Button>
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Inventory Item</DialogTitle>
            <DialogDescription>
              Update inventory item details
            </DialogDescription>
          </DialogHeader>
          <Tabs defaultValue="basic" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="basic">Basic Info</TabsTrigger>
              <TabsTrigger value="details">Details & Stock</TabsTrigger>
            </TabsList>
            <TabsContent value="basic" className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div className="col-span-2 space-y-2">
                  <Label htmlFor="editName">Item Name*</Label>
                  <Input
                    id="editName"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="editCategory">Category*</Label>
                  <Select value={formData.category} onValueChange={(value) => setFormData({ ...formData, category: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((cat) => (
                        <SelectItem key={cat} value={cat}>
                          {cat.replace('_', ' ').toUpperCase()}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="editUnit">Unit*</Label>
                  <Input
                    id="editUnit"
                    value={formData.unit}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                  />
                </div>
                <div className="col-span-2 space-y-2">
                  <Label htmlFor="editDescription">Description</Label>
                  <Textarea
                    id="editDescription"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="editBarcode">Barcode</Label>
                  <Input
                    id="editBarcode"
                    value={formData.barcode}
                    onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="editSku">SKU</Label>
                  <Input
                    id="editSku"
                    value={formData.sku}
                    onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                  />
                </div>
              </div>
            </TabsContent>
            <TabsContent value="details" className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div className="space-y-2">
                  <Label htmlFor="editCurrentStock">Current Stock*</Label>
                  <Input
                    id="editCurrentStock"
                    type="number"
                    min="0"
                    value={formData.currentStock}
                    onChange={(e) => setFormData({ ...formData, currentStock: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="editMinimumStock">Minimum Stock*</Label>
                  <Input
                    id="editMinimumStock"
                    type="number"
                    min="0"
                    value={formData.minimumStock}
                    onChange={(e) => setFormData({ ...formData, minimumStock: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="editReorderPoint">Reorder Point</Label>
                  <Input
                    id="editReorderPoint"
                    type="number"
                    min="0"
                    value={formData.reorderPoint}
                    onChange={(e) => setFormData({ ...formData, reorderPoint: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="editMaximumStock">Maximum Stock</Label>
                  <Input
                    id="editMaximumStock"
                    type="number"
                    min="0"
                    value={formData.maximumStock}
                    onChange={(e) => setFormData({ ...formData, maximumStock: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="editCostPerUnit">Cost per Unit ($)*</Label>
                  <Input
                    id="editCostPerUnit"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.costPerUnit}
                    onChange={(e) => setFormData({ ...formData, costPerUnit: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="editSellingPrice">Selling Price ($)</Label>
                  <Input
                    id="editSellingPrice"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.sellingPrice}
                    onChange={(e) => setFormData({ ...formData, sellingPrice: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="editLocation">Location</Label>
                  <Input
                    id="editLocation"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="editBatchNumber">Batch Number</Label>
                  <Input
                    id="editBatchNumber"
                    value={formData.batchNumber}
                    onChange={(e) => setFormData({ ...formData, batchNumber: e.target.value })}
                  />
                </div>
                <div className="col-span-2 space-y-2">
                  <Label htmlFor="editExpiryDate">Expiry Date</Label>
                  <Input
                    id="editExpiryDate"
                    type="date"
                    value={formData.expiryDate}
                    onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
                  />
                </div>
              </div>
            </TabsContent>
          </Tabs>
          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleEditItem}>
              Update Item
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

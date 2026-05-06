
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
import { Plus, Search, Edit2, Trash2, Clock, Stethoscope, Activity } from 'lucide-react'
import { PesoIcon } from '@/components/ui/peso-icon'
import { toast } from 'react-hot-toast'

interface Treatment {
  id: string
  treatmentCode: string
  name: string
  description?: string
  category: string
  baseCost: number | string
  estimatedDurationMinutes: number
  requiresAnesthesia: boolean
  requiresFollowup: boolean
  isSurgical: boolean
  isActive: boolean
}

export default function ServicesManagement() {
  const [treatments, setTreatments] = useState<Treatment[]>([])
  const [groupedTreatments, setGroupedTreatments] = useState<Record<string, Treatment[]>>({})
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [editingTreatment, setEditingTreatment] = useState<Treatment | null>(null)

  const [formData, setFormData] = useState({
    treatmentCode: '',
    name: '',
    description: '',
    category: '',
    baseCost: '',
    estimatedDurationMinutes: '30',
    requiresAnesthesia: false,
    requiresFollowup: false,
    isSurgical: false,
    isActive: true
  })

  const categories = [
    'Preventive',
    'Restorative',
    'Cosmetic',
    'Orthodontics',
    'Surgery',
    'Endodontics',
    'Periodontics',
    'Prosthodontics',
    'Diagnostic',
    'Emergency'
  ]

  const fetchTreatments = async () => {
    try {
      const response = await fetch('/api/treatments')
      const data = await response.json()
      
      if (data.success) {
        setTreatments(data.data.treatments)
        setGroupedTreatments(data.data.groupedTreatments)
      } else {
        toast.error('Failed to load treatments')
      }
    } catch (error) {
      toast.error('Error loading treatments')
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTreatments()
  }, [])

  const handleCreateTreatment = async () => {
    try {
      const response = await fetch('/api/treatments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          baseCost: parseFloat(formData.baseCost),
          estimatedDurationMinutes: parseInt(formData.estimatedDurationMinutes)
        })
      })

      const data = await response.json()

      if (data.success) {
        toast.success('Treatment created successfully')
        setIsCreateDialogOpen(false)
        resetForm()
        fetchTreatments()
      } else {
        toast.error(data.error || 'Failed to create treatment')
      }
    } catch (error) {
      toast.error('Error creating treatment')
      console.error('Error:', error)
    }
  }

  const handleEditTreatment = async () => {
    if (!editingTreatment) return

    try {
      const response = await fetch(`/api/treatments/${editingTreatment.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          baseCost: parseFloat(formData.baseCost),
          estimatedDurationMinutes: parseInt(formData.estimatedDurationMinutes)
        })
      })

      const data = await response.json()

      if (data.success) {
        toast.success('Treatment updated successfully')
        setIsEditDialogOpen(false)
        setEditingTreatment(null)
        resetForm()
        fetchTreatments()
      } else {
        toast.error(data.error || 'Failed to update treatment')
      }
    } catch (error) {
      toast.error('Error updating treatment')
      console.error('Error:', error)
    }
  }

  const resetForm = () => {
    setFormData({
      treatmentCode: '',
      name: '',
      description: '',
      category: '',
      baseCost: '',
      estimatedDurationMinutes: '30',
      requiresAnesthesia: false,
      requiresFollowup: false,
      isSurgical: false,
      isActive: true
    })
  }

  const openEditDialog = (treatment: Treatment) => {
    setEditingTreatment(treatment)
    setFormData({
      treatmentCode: treatment.treatmentCode,
      name: treatment.name,
      description: treatment.description || '',
      category: treatment.category,
      baseCost: Number(treatment.baseCost || 0).toString(),
      estimatedDurationMinutes: treatment.estimatedDurationMinutes.toString(),
      requiresAnesthesia: treatment.requiresAnesthesia,
      requiresFollowup: treatment.requiresFollowup,
      isSurgical: treatment.isSurgical,
      isActive: treatment.isActive
    })
    setIsEditDialogOpen(true)
  }

  const filteredTreatments = treatments.filter(treatment => {
    const matchesSearch = treatment.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         treatment.treatmentCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (treatment.description || '').toLowerCase().includes(searchTerm.toLowerCase())
    const matchesCategory = selectedCategory === 'all' || treatment.category === selectedCategory
    return matchesSearch && matchesCategory
  })

  const totalTreatments = treatments.length
  const activeTreatments = treatments.filter(t => t.isActive).length
  const averageCost = treatments.length > 0 
    ? treatments.reduce((sum, t) => sum + Number(t.baseCost || 0), 0) / treatments.length 
    : 0

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
          <h1 className="text-3xl font-bold">Services & Procedures Management</h1>
          <p className="text-muted-foreground">Manage your dental treatment catalog</p>
        </div>
        
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Add Treatment
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Add New Treatment</DialogTitle>
              <DialogDescription>
                Create a new treatment or service for your catalog
              </DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div className="space-y-2">
                <Label htmlFor="treatmentCode">Treatment Code*</Label>
                <Input
                  id="treatmentCode"
                  value={formData.treatmentCode}
                  onChange={(e) => setFormData({ ...formData, treatmentCode: e.target.value })}
                  placeholder="D0120"
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
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2 space-y-2">
                <Label htmlFor="name">Treatment Name*</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Periodic Oral Evaluation"
                />
              </div>
              <div className="col-span-2 space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Comprehensive oral examination..."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="baseCost">Base Cost ($)*</Label>
                <Input
                  id="baseCost"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.baseCost}
                  onChange={(e) => setFormData({ ...formData, baseCost: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="duration">Duration (minutes)*</Label>
                <Input
                  id="duration"
                  type="number"
                  min="15"
                  max="480"
                  value={formData.estimatedDurationMinutes}
                  onChange={(e) => setFormData({ ...formData, estimatedDurationMinutes: e.target.value })}
                />
              </div>
              <div className="col-span-2 space-y-4">
                <div className="flex items-center space-x-2">
                  <Switch
                    checked={formData.requiresAnesthesia}
                    onCheckedChange={(checked) => setFormData({ ...formData, requiresAnesthesia: checked })}
                  />
                  <Label>Requires Anesthesia</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    checked={formData.requiresFollowup}
                    onCheckedChange={(checked) => setFormData({ ...formData, requiresFollowup: checked })}
                  />
                  <Label>Requires Follow-up</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    checked={formData.isSurgical}
                    onCheckedChange={(checked) => setFormData({ ...formData, isSurgical: checked })}
                  />
                  <Label>Surgical Procedure</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    checked={formData.isActive}
                    onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                  />
                  <Label>Active</Label>
                </div>
              </div>
            </div>
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateTreatment}>
                Create Treatment
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Activity className="h-8 w-8 text-blue-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Total Services</p>
                <p className="text-2xl font-bold">{totalTreatments}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Stethoscope className="h-8 w-8 text-green-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Active Services</p>
                <p className="text-2xl font-bold">{activeTreatments}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <PesoIcon className="h-8 w-8 text-yellow-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Average Cost</p>
                <p className="text-2xl font-bold">₱{averageCost.toFixed(2)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Clock className="h-8 w-8 text-purple-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Categories</p>
                <p className="text-2xl font-bold">{Object.keys(groupedTreatments).length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filter Treatments</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search treatments..."
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
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Treatments List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredTreatments.map((treatment) => (
          <Card key={treatment.id} className="hover:shadow-md transition-shadow">
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-lg">{treatment.name}</CardTitle>
                  <CardDescription>
                    {treatment.treatmentCode} • {treatment.category}
                  </CardDescription>
                </div>
                <div className="flex space-x-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openEditDialog(treatment)}
                  >
                    <Edit2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {treatment.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {treatment.description}
                  </p>
                )}
                
                <div className="flex justify-between items-center">
                  <span className="text-lg font-semibold text-green-600">
                    ₱{Number(treatment.baseCost || 0).toFixed(2)}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {treatment.estimatedDurationMinutes}min
                  </span>
                </div>

                <div className="flex flex-wrap gap-1">
                  {!treatment.isActive && (
                    <Badge variant="secondary">Inactive</Badge>
                  )}
                  {treatment.requiresAnesthesia && (
                    <Badge variant="outline">Anesthesia</Badge>
                  )}
                  {treatment.isSurgical && (
                    <Badge variant="destructive">Surgical</Badge>
                  )}
                  {treatment.requiresFollowup && (
                    <Badge variant="default">Follow-up</Badge>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Treatment</DialogTitle>
            <DialogDescription>
              Update treatment details
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div className="space-y-2">
              <Label htmlFor="editTreatmentCode">Treatment Code*</Label>
              <Input
                id="editTreatmentCode"
                value={formData.treatmentCode}
                onChange={(e) => setFormData({ ...formData, treatmentCode: e.target.value })}
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
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2 space-y-2">
              <Label htmlFor="editName">Treatment Name*</Label>
              <Input
                id="editName"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
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
              <Label htmlFor="editBaseCost">Base Cost ($)*</Label>
              <Input
                id="editBaseCost"
                type="number"
                step="0.01"
                min="0"
                value={formData.baseCost}
                onChange={(e) => setFormData({ ...formData, baseCost: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="editDuration">Duration (minutes)*</Label>
              <Input
                id="editDuration"
                type="number"
                min="15"
                max="480"
                value={formData.estimatedDurationMinutes}
                onChange={(e) => setFormData({ ...formData, estimatedDurationMinutes: e.target.value })}
              />
            </div>
            <div className="col-span-2 space-y-4">
              <div className="flex items-center space-x-2">
                <Switch
                  checked={formData.requiresAnesthesia}
                  onCheckedChange={(checked) => setFormData({ ...formData, requiresAnesthesia: checked })}
                />
                <Label>Requires Anesthesia</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  checked={formData.requiresFollowup}
                  onCheckedChange={(checked) => setFormData({ ...formData, requiresFollowup: checked })}
                />
                <Label>Requires Follow-up</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  checked={formData.isSurgical}
                  onCheckedChange={(checked) => setFormData({ ...formData, isSurgical: checked })}
                />
                <Label>Surgical Procedure</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  checked={formData.isActive}
                  onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                />
                <Label>Active</Label>
              </div>
            </div>
          </div>
          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleEditTreatment}>
              Update Treatment
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

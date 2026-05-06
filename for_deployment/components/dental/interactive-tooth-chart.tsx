
'use client'

import { useState, useCallback, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  Clock,
  Edit,
  Plus,
  Minus,
  Search,
  Filter,
  Calendar,
  FileText,
  Camera,
  Zap,
  Layers
} from 'lucide-react'

interface ToothData {
  id: string
  toothNumber: string
  toothType: 'permanent' | 'primary' | 'supernumerary'
  status: string
  surfaces: string[]
  condition?: string
  notes?: string
  priority: number
  lastExamDate?: string
  nextDueDate?: string
  procedures?: any[]
  annotations?: any[]
}

interface InteractiveToothChartProps {
  dentalRecordId: string
  patientId: string
  editable?: boolean
  compact?: boolean
  onToothSelect?: (tooth: ToothData) => void
  onProcedureAdd?: (toothNumber: string) => void
}

// Adult permanent teeth layout (FDI Two-Digit System)
const ADULT_TEETH_LAYOUT = {
  upper: {
    right: ['18', '17', '16', '15', '14', '13', '12', '11'],
    left: ['21', '22', '23', '24', '25', '26', '27', '28']
  },
  lower: {
    right: ['48', '47', '46', '45', '44', '43', '42', '41'],
    left: ['31', '32', '33', '34', '35', '36', '37', '38']
  }
}

// Primary teeth layout (A-T system)
const PRIMARY_TEETH_LAYOUT = {
  upper: {
    right: ['A', 'B', 'C', 'D', 'E'],
    left: ['F', 'G', 'H', 'I', 'J']
  },
  lower: {
    right: ['T', 'S', 'R', 'Q', 'P'],
    left: ['O', 'N', 'M', 'L', 'K']
  }
}

// Tooth surfaces
const TOOTH_SURFACES = [
  { value: 'mesial', label: 'Mesial (M)' },
  { value: 'distal', label: 'Distal (D)' },
  { value: 'buccal', label: 'Buccal (B)' },
  { value: 'lingual', label: 'Lingual (L)' },
  { value: 'occlusal', label: 'Occlusal (O)' },
  { value: 'incisal', label: 'Incisal (I)' }
]

// Tooth status colors
const getToothStatusColor = (status: string) => {
  switch (status) {
    case 'healthy': return 'bg-green-100 border-green-300 text-green-800'
    case 'decay': return 'bg-red-100 border-red-300 text-red-800'
    case 'filled': return 'bg-blue-100 border-blue-300 text-blue-800'
    case 'crowned': return 'bg-purple-100 border-purple-300 text-purple-800'
    case 'root_canal': return 'bg-orange-100 border-orange-300 text-orange-800'
    case 'extracted': return 'bg-gray-100 border-gray-400 text-gray-600'
    case 'missing': return 'bg-gray-50 border-gray-200 text-gray-400'
    case 'implant': return 'bg-indigo-100 border-indigo-300 text-indigo-800'
    case 'bridge': return 'bg-yellow-100 border-yellow-300 text-yellow-800'
    case 'infected': return 'bg-red-200 border-red-400 text-red-900'
    case 'sensitive': return 'bg-orange-100 border-orange-300 text-orange-700'
    default: return 'bg-gray-50 border-gray-200 text-gray-600'
  }
}

// Priority indicators
const getPriorityIcon = (priority: number) => {
  switch (priority) {
    case 2: return <AlertTriangle className="w-3 h-3 text-red-500" />
    case 1: return <Clock className="w-3 h-3 text-yellow-500" />
    default: return null
  }
}

// Tooth SVG Component
const ToothSVG = ({ 
  toothNumber, 
  status, 
  priority, 
  onClick, 
  isSelected = false,
  compact = false 
}: {
  toothNumber: string
  status: string
  priority: number
  onClick?: () => void
  isSelected?: boolean
  compact?: boolean
}) => {
  const colorClass = getToothStatusColor(status)
  const size = compact ? 'w-8 h-10' : 'w-12 h-14'
  
  return (
    <div 
      className={`relative cursor-pointer transition-all duration-200 hover:scale-110 ${
        isSelected ? 'ring-2 ring-blue-500 ring-offset-1' : ''
      }`}
      onClick={onClick}
    >
      <div className={`${size} ${colorClass} rounded-t-lg border-2 flex flex-col items-center justify-center relative shadow-sm hover:shadow-md`}>
        {/* Tooth number */}
        <span className={`${compact ? 'text-xs' : 'text-sm'} font-bold`}>
          {toothNumber}
        </span>
        
        {/* Priority indicator */}
        {priority > 0 && (
          <div className="absolute -top-1 -right-1">
            {getPriorityIcon(priority)}
          </div>
        )}
        
        {/* Status indicator */}
        {status === 'extracted' && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-full h-0.5 bg-red-500 rotate-45"></div>
            <div className="w-full h-0.5 bg-red-500 -rotate-45 absolute"></div>
          </div>
        )}
      </div>
      
      {/* Tooth root */}
      <div className={`${colorClass} w-6 h-3 mx-auto border-l-2 border-r-2 border-b-2 rounded-b-md`}></div>
    </div>
  )
}

export function InteractiveToothChart({
  dentalRecordId,
  patientId,
  editable = true,
  compact = false,
  onToothSelect,
  onProcedureAdd
}: InteractiveToothChartProps) {
  const { toast } = useToast()
  
  // State
  const [toothData, setToothData] = useState<Record<string, ToothData>>({})
  const [selectedTooth, setSelectedTooth] = useState<string | null>(null)
  const [showToothDialog, setShowToothDialog] = useState(false)
  const [chartType, setChartType] = useState<'adult' | 'primary'>('adult')
  const [viewMode, setViewMode] = useState<'chart' | 'list'>('chart')
  const [loading, setLoading] = useState(true)
  const [editingTooth, setEditingTooth] = useState<ToothData | null>(null)

  // Form state for tooth editing
  const [toothForm, setToothForm] = useState({
    status: 'healthy',
    surfaces: [] as string[],
    condition: '',
    notes: '',
    priority: 0
  })

  // Filters
  const [filters, setFilters] = useState({
    status: 'all',
    priority: 'all',
    search: ''
  })

  // Load tooth records
  useEffect(() => {
    const fetchToothRecords = async () => {
      try {
        setLoading(true)
        
        // Use mock tooth data directly for demonstration - FDI Two-Digit System
        const isAliceJohnson = dentalRecordId.includes('P-2024-0001')
        let mockToothRecords: ToothData[] = []
        
        if (isAliceJohnson) {
          // Alice Johnson - specific dental conditions using FDI numbering
          const aliceTeethData: Record<string, { status: string; surfaces: string[]; condition: string; priority: number; notes: string }> = {
            '36': { status: 'infected', surfaces: ['occlusal', 'mesial'], condition: 'Acute pulpitis with severe pain', priority: 2, notes: 'Root canal therapy urgently needed' }, // Lower left first molar
            '37': { status: 'decay', surfaces: ['occlusal'], condition: 'Deep caries approaching pulp', priority: 2, notes: 'Large restoration required' }, // Lower left second molar
            '12': { status: 'filled', surfaces: ['mesial'], condition: 'Composite restoration in good condition', priority: 0, notes: 'Monitor for wear' }, // Upper right lateral incisor
            '21': { status: 'filled', surfaces: ['buccal'], condition: 'Old amalgam filling', priority: 1, notes: 'Consider replacement with composite' }, // Upper left central incisor
            '35': { status: 'decay', surfaces: ['distal'], condition: 'Small interproximal caries', priority: 1, notes: 'Composite filling recommended' }, // Lower left second premolar
            '13': { status: 'crowned', surfaces: [], condition: 'Porcelain crown in excellent condition', priority: 0, notes: 'Placed 3 years ago, no issues' } // Upper right canine
          }
          
          // FDI Two-Digit System: 11-18, 21-28, 31-38, 41-48
          const fdiTeeth = [
            // Upper right: 11-18
            '11', '12', '13', '14', '15', '16', '17', '18',
            // Upper left: 21-28
            '21', '22', '23', '24', '25', '26', '27', '28',
            // Lower left: 31-38
            '31', '32', '33', '34', '35', '36', '37', '38',
            // Lower right: 41-48
            '41', '42', '43', '44', '45', '46', '47', '48'
          ]
          
          mockToothRecords = fdiTeeth.map(toothNumber => {
            const toothData = aliceTeethData[toothNumber]
            if (toothData) {
              return {
                id: `tooth-${dentalRecordId}-${toothNumber}`,
                toothNumber,
                toothType: 'permanent' as const,
                status: toothData.status,
                surfaces: toothData.surfaces,
                condition: toothData.condition,
                notes: toothData.notes,
                priority: toothData.priority,
                lastExamDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
                procedures: [],
                annotations: []
              }
            } else {
              return {
                id: `tooth-${dentalRecordId}-${toothNumber}`,
                toothNumber,
                toothType: 'permanent' as const,
                status: 'healthy',
                surfaces: [],
                condition: 'No issues noted',
                notes: '',
                priority: 0,
                lastExamDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
                procedures: [],
                annotations: []
              }
            }
          })
        } else {
          // Generic patient data using FDI numbering
          const fdiTeeth = [
            // Upper right: 11-18
            '11', '12', '13', '14', '15', '16', '17', '18',
            // Upper left: 21-28
            '21', '22', '23', '24', '25', '26', '27', '28',
            // Lower left: 31-38
            '31', '32', '33', '34', '35', '36', '37', '38',
            // Lower right: 41-48
            '41', '42', '43', '44', '45', '46', '47', '48'
          ]
          
          mockToothRecords = fdiTeeth.map(toothNumber => ({
            id: `tooth-${dentalRecordId}-${toothNumber}`,
            toothNumber,
            toothType: 'permanent' as const,
            status: 'healthy',
            surfaces: [],
            condition: 'No issues noted',
            notes: '',
            priority: 0,
            lastExamDate: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
            procedures: [],
            annotations: []
          }))
        }

        const toothMap: Record<string, ToothData> = {}
        mockToothRecords.forEach((tooth: any) => {
          toothMap[tooth.toothNumber] = tooth
        })
        setToothData(toothMap)
      } catch (error) {
        console.error('Error fetching tooth records:', error)
        toast({
          title: "Error",
          description: "Failed to load tooth records",
          variant: "destructive"
        })
      } finally {
        setLoading(false)
      }
    }

    fetchToothRecords()
  }, [dentalRecordId, toast])

  // Handle tooth click
  const handleToothClick = useCallback((toothNumber: string) => {
    setSelectedTooth(toothNumber)
    const tooth = toothData[toothNumber]
    if (tooth) {
      setEditingTooth(tooth)
      setToothForm({
        status: tooth.status,
        surfaces: tooth.surfaces,
        condition: tooth.condition || '',
        notes: tooth.notes || '',
        priority: tooth.priority
      })
    } else {
      setEditingTooth(null)
      setToothForm({
        status: 'healthy',
        surfaces: [],
        condition: '',
        notes: '',
        priority: 0
      })
    }
    setShowToothDialog(true)
    onToothSelect?.(tooth)
  }, [toothData, onToothSelect])

  // Save tooth record
  const handleSaveTooth = async () => {
    if (!selectedTooth) return

    try {
      const response = await fetch(`/api/dental-records/${dentalRecordId}/teeth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toothNumber: selectedTooth,
          toothType: chartType === 'adult' ? 'permanent' : 'primary',
          ...toothForm
        })
      })

      if (response.ok) {
        const data = await response.json()
        setToothData(prev => ({
          ...prev,
          [selectedTooth]: data.data.toothRecord
        }))
        setShowToothDialog(false)
        toast({
          title: "Success",
          description: "Tooth record updated successfully"
        })
      }
    } catch (error) {
      console.error('Error saving tooth record:', error)
      toast({
        title: "Error",
        description: "Failed to save tooth record",
        variant: "destructive"
      })
    }
  }

  // Get current layout
  const currentLayout = chartType === 'adult' ? ADULT_TEETH_LAYOUT : PRIMARY_TEETH_LAYOUT

  // Filter teeth
  const getFilteredTeeth = () => {
    const allToothNumbers = [
      ...currentLayout.upper.right,
      ...currentLayout.upper.left,
      ...currentLayout.lower.right,
      ...currentLayout.lower.left
    ]

    return allToothNumbers.filter(toothNumber => {
      const tooth = toothData[toothNumber]
      
      if (filters.status !== 'all' && tooth?.status !== filters.status) {
        return false
      }
      
      if (filters.priority !== 'all') {
        const priorityFilter = parseInt(filters.priority)
        if (tooth?.priority !== priorityFilter) return false
      }
      
      if (filters.search && tooth) {
        const searchLower = filters.search.toLowerCase()
        return (
          tooth.toothNumber.toLowerCase().includes(searchLower) ||
          tooth.condition?.toLowerCase().includes(searchLower) ||
          tooth.notes?.toLowerCase().includes(searchLower)
        )
      }
      
      return true
    })
  }

  const renderToothRow = (teeth: string[], label: string, side: 'left' | 'right') => (
    <div className="flex flex-col items-center space-y-2">
      <Label className="text-xs font-medium text-gray-600">{label}</Label>
      <div className={`flex space-x-1 ${side === 'left' ? 'flex-row-reverse' : ''}`}>
        {teeth.map((toothNumber) => {
          const tooth = toothData[toothNumber]
          return (
            <ToothSVG
              key={toothNumber}
              toothNumber={toothNumber}
              status={tooth?.status || 'healthy'}
              priority={tooth?.priority || 0}
              onClick={() => handleToothClick(toothNumber)}
              isSelected={selectedTooth === toothNumber}
              compact={compact}
            />
          )
        })}
      </div>
    </div>
  )

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <CardTitle className="flex items-center space-x-2">
              <Activity className="w-5 h-5" />
              <span>Interactive Dental Chart</span>
              <div className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                FDI Two-Digit System
              </div>
            </CardTitle>
            
            <div className="flex items-center space-x-2">
              {/* Chart Type Toggle */}
              <Select value={chartType} onValueChange={(value: 'adult' | 'primary') => setChartType(value)}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="adult">Adult</SelectItem>
                  <SelectItem value="primary">Primary</SelectItem>
                </SelectContent>
              </Select>

              {/* View Mode Toggle */}
              <div className="flex rounded-md border">
                <Button
                  variant={viewMode === 'chart' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('chart')}
                  className="rounded-r-none"
                >
                  <Layers className="w-4 h-4" />
                </Button>
                <Button
                  variant={viewMode === 'list' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('list')}
                  className="rounded-l-none"
                >
                  <FileText className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
          <div className="pt-2 text-sm text-gray-600">
            Professional dental notation using FDI World Dental Federation standard (ISO 3950)
          </div>
        </CardHeader>

        <CardContent>
          {/* Filters */}
          <div className="flex flex-wrap gap-3 items-center mb-6 p-4 bg-gray-50 rounded-lg">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search teeth..."
                value={filters.search}
                onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                className="pl-9 w-48"
              />
            </div>

            <Select value={filters.status} onValueChange={(value) => setFilters(prev => ({ ...prev, status: value }))}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="healthy">Healthy</SelectItem>
                <SelectItem value="decay">Decay</SelectItem>
                <SelectItem value="filled">Filled</SelectItem>
                <SelectItem value="crowned">Crowned</SelectItem>
                <SelectItem value="extracted">Extracted</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filters.priority} onValueChange={(value) => setFilters(prev => ({ ...prev, priority: value }))}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priority</SelectItem>
                <SelectItem value="0">Routine</SelectItem>
                <SelectItem value="1">Moderate</SelectItem>
                <SelectItem value="2">Urgent</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {viewMode === 'chart' ? (
            <div className="space-y-8">
              {/* Upper Teeth */}
              <div className="flex justify-center items-center space-x-8">
                {renderToothRow(currentLayout.upper.right, 'RIGHT (Q1)', 'right')}
                <div className="w-px h-16 bg-gray-300"></div>
                {renderToothRow(currentLayout.upper.left, 'LEFT (Q2)', 'left')}
              </div>

              {/* Bite Line */}
              <div className="flex items-center justify-center">
                <div className="flex-1 h-px bg-gradient-to-r from-transparent via-gray-400 to-transparent"></div>
                <span className="px-6 text-sm font-medium text-gray-500 tracking-wider">BITE LINE</span>
                <div className="flex-1 h-px bg-gradient-to-r from-transparent via-gray-400 to-transparent"></div>
              </div>

              {/* Lower Teeth */}
              <div className="flex justify-center items-center space-x-8">
                {renderToothRow(currentLayout.lower.right, 'RIGHT (Q4)', 'right')}
                <div className="w-px h-16 bg-gray-300"></div>
                {renderToothRow(currentLayout.lower.left, 'LEFT (Q3)', 'left')}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <ScrollArea className="h-96">
                {getFilteredTeeth().map((toothNumber) => {
                  const tooth = toothData[toothNumber]
                  return (
                    <div
                      key={toothNumber}
                      className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 cursor-pointer mb-2"
                      onClick={() => handleToothClick(toothNumber)}
                    >
                      <div className="flex items-center space-x-3">
                        <div className={`w-8 h-8 rounded border-2 flex items-center justify-center text-xs font-bold ${getToothStatusColor(tooth?.status || 'healthy')}`}>
                          {toothNumber}
                        </div>
                        <div>
                          <p className="font-medium">Tooth #{toothNumber}</p>
                          <p className="text-sm text-gray-600">{tooth?.condition || 'No specific condition noted'}</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        {tooth?.priority > 0 && getPriorityIcon(tooth.priority)}
                        <Badge variant="outline">{tooth?.status || 'healthy'}</Badge>
                      </div>
                    </div>
                  )
                })}
              </ScrollArea>
            </div>
          )}

          {/* Legend */}
          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <h4 className="font-medium mb-3">Legend</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {[
                { status: 'healthy', label: 'Healthy' },
                { status: 'decay', label: 'Decay' },
                { status: 'filled', label: 'Filled' },
                { status: 'crowned', label: 'Crown' },
                { status: 'root_canal', label: 'Root Canal' },
                { status: 'extracted', label: 'Extracted' },
                { status: 'missing', label: 'Missing' },
                { status: 'implant', label: 'Implant' }
              ].map((item) => (
                <div key={item.status} className="flex items-center space-x-2">
                  <div className={`w-4 h-4 rounded border ${getToothStatusColor(item.status)}`}></div>
                  <span className="text-sm">{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tooth Detail Dialog */}
      <Dialog open={showToothDialog} onOpenChange={setShowToothDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <Activity className="w-5 h-5" />
              <span>Tooth #{selectedTooth} Details</span>
            </DialogTitle>
            <DialogDescription>
              {editingTooth ? 'Update tooth record' : 'Create new tooth record'}
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="basic" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="basic">Basic Info</TabsTrigger>
              <TabsTrigger value="procedures">Procedures</TabsTrigger>
              <TabsTrigger value="notes">Notes & Images</TabsTrigger>
            </TabsList>

            <TabsContent value="basic" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="status">Status</Label>
                  <Select value={toothForm.status} onValueChange={(value) => setToothForm(prev => ({ ...prev, status: value }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="healthy">Healthy</SelectItem>
                      <SelectItem value="decay">Decay</SelectItem>
                      <SelectItem value="filled">Filled</SelectItem>
                      <SelectItem value="crowned">Crowned</SelectItem>
                      <SelectItem value="root_canal">Root Canal</SelectItem>
                      <SelectItem value="extracted">Extracted</SelectItem>
                      <SelectItem value="missing">Missing</SelectItem>
                      <SelectItem value="implant">Implant</SelectItem>
                      <SelectItem value="bridge">Bridge</SelectItem>
                      <SelectItem value="infected">Infected</SelectItem>
                      <SelectItem value="sensitive">Sensitive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="priority">Priority</Label>
                  <Select value={toothForm.priority.toString()} onValueChange={(value) => setToothForm(prev => ({ ...prev, priority: parseInt(value) }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">Routine</SelectItem>
                      <SelectItem value="1">Moderate</SelectItem>
                      <SelectItem value="2">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label>Affected Surfaces</Label>
                <div className="grid grid-cols-3 gap-2 mt-2">
                  {TOOTH_SURFACES.map((surface) => (
                    <label key={surface.value} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={toothForm.surfaces.includes(surface.value)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setToothForm(prev => ({
                              ...prev,
                              surfaces: [...prev.surfaces, surface.value]
                            }))
                          } else {
                            setToothForm(prev => ({
                              ...prev,
                              surfaces: prev.surfaces.filter(s => s !== surface.value)
                            }))
                          }
                        }}
                        className="rounded"
                      />
                      <span className="text-sm">{surface.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <Label htmlFor="condition">Condition</Label>
                <Input
                  id="condition"
                  value={toothForm.condition}
                  onChange={(e) => setToothForm(prev => ({ ...prev, condition: e.target.value }))}
                  placeholder="Describe the current condition..."
                />
              </div>
            </TabsContent>

            <TabsContent value="procedures" className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-medium">Procedure History</h4>
                {editable && (
                  <Button
                    size="sm"
                    onClick={() => onProcedureAdd?.(selectedTooth || '')}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Procedure
                  </Button>
                )}
              </div>
              
              <ScrollArea className="h-32">
                {editingTooth?.procedures?.length ? (
                  editingTooth.procedures.map((procedure: any) => (
                    <div key={procedure.id} className="p-3 border rounded-lg mb-2">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium">{procedure.procedureName}</p>
                          <p className="text-sm text-gray-600">
                            {procedure.datePerformed ? 
                              new Date(procedure.datePerformed).toLocaleDateString() : 
                              'Planned'
                            }
                          </p>
                        </div>
                        <Badge variant={procedure.status === 'completed' ? 'default' : 'secondary'}>
                          {procedure.status}
                        </Badge>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-gray-500 text-center py-4">No procedures recorded</p>
                )}
              </ScrollArea>
            </TabsContent>

            <TabsContent value="notes" className="space-y-4">
              <div>
                <Label htmlFor="notes">Clinical Notes</Label>
                <Textarea
                  id="notes"
                  value={toothForm.notes}
                  onChange={(e) => setToothForm(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Add clinical notes, observations, or treatment recommendations..."
                  rows={4}
                />
              </div>

              <div>
                <Label>Attachments</Label>
                <div className="mt-2 border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                  <Camera className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-600">Click to upload images or X-rays</p>
                  <p className="text-xs text-gray-500 mt-1">Supported formats: JPG, PNG, PDF</p>
                </div>
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowToothDialog(false)}>
              Cancel
            </Button>
            {editable && (
              <Button onClick={handleSaveTooth}>
                Save Changes
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

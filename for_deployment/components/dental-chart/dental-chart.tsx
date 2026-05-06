
'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'

interface ToothData {
  number: number
  status: 'healthy' | 'cavity' | 'filled' | 'crown' | 'implant' | 'extracted' | 'root_canal'
  procedures: string[]
  notes: string
}

interface DentalChartProps {
  patientId: string
  editable?: boolean
  onToothUpdate?: (toothNumber: number, data: Partial<ToothData>) => void
}

export default function DentalChart({ patientId, editable = false, onToothUpdate }: DentalChartProps) {
  const [teeth, setTeeth] = useState<ToothData[]>(
    Array.from({ length: 32 }, (_, i) => ({
      number: i + 1,
      status: 'healthy',
      procedures: [],
      notes: ''
    }))
  )
  const [selectedTooth, setSelectedTooth] = useState<number | null>(null)
  const [treatmentType, setTreatmentType] = useState('')

  const getToothColor = (status: string) => {
    const colors = {
      healthy: 'bg-green-100 border-green-300 text-green-800',
      cavity: 'bg-red-100 border-red-300 text-red-800',
      filled: 'bg-blue-100 border-blue-300 text-blue-800',
      crown: 'bg-yellow-100 border-yellow-300 text-yellow-800',
      implant: 'bg-purple-100 border-purple-300 text-purple-800',
      extracted: 'bg-gray-100 border-gray-300 text-gray-800',
      root_canal: 'bg-orange-100 border-orange-300 text-orange-800'
    }
    return colors[status as keyof typeof colors] || colors.healthy
  }

  const handleToothClick = (toothNumber: number) => {
    if (!editable) return
    setSelectedTooth(toothNumber)
  }

  const updateTooth = (toothNumber: number, updates: Partial<ToothData>) => {
    setTeeth(prev => prev.map(tooth => 
      tooth.number === toothNumber 
        ? { ...tooth, ...updates }
        : tooth
    ))
    onToothUpdate?.(toothNumber, updates)
  }

  const addTreatment = () => {
    if (!selectedTooth || !treatmentType) return
    
    const tooth = teeth.find(t => t.number === selectedTooth)
    if (tooth) {
      const newProcedures = [...tooth.procedures, treatmentType]
      updateTooth(selectedTooth, { 
        procedures: newProcedures,
        status: treatmentType as ToothData['status']
      })
      setTreatmentType('')
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Interactive Dental Chart</CardTitle>
        </CardHeader>
        <CardContent>
          {/* Upper Jaw */}
          <div className="mb-8">
            <h3 className="text-sm font-medium mb-4 text-center">Upper Jaw</h3>
            <div className="chart-scroll-x"><div className="grid grid-cols-8 gap-2 max-w-2xl mx-auto min-w-[440px] py-1">
              {teeth.slice(0, 16).map((tooth) => (
                <div
                  key={tooth.number}
                  className={`
                    relative w-12 h-12 rounded border-2 cursor-pointer flex items-center justify-center text-xs font-medium
                    ${getToothColor(tooth.status)}
                    ${selectedTooth === tooth.number ? 'ring-2 ring-blue-500' : ''}
                    ${editable ? 'hover:opacity-80' : ''}
                  `}
                  onClick={() => handleToothClick(tooth.number)}
                >
                  {tooth.number}
                  {tooth.procedures.length > 0 && (
                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full text-white text-xs flex items-center justify-center">
                      {tooth.procedures.length}
                    </div>
                  )}
                </div>
              ))}
            </div></div>
          </div>

          {/* Lower Jaw */}
          <div>
            <h3 className="text-sm font-medium mb-4 text-center">Lower Jaw</h3>
            <div className="chart-scroll-x"><div className="grid grid-cols-8 gap-2 max-w-2xl mx-auto min-w-[440px] py-1">
              {teeth.slice(16, 32).map((tooth) => (
                <div
                  key={tooth.number}
                  className={`
                    relative w-12 h-12 rounded border-2 cursor-pointer flex items-center justify-center text-xs font-medium
                    ${getToothColor(tooth.status)}
                    ${selectedTooth === tooth.number ? 'ring-2 ring-blue-500' : ''}
                    ${editable ? 'hover:opacity-80' : ''}
                  `}
                  onClick={() => handleToothClick(tooth.number)}
                >
                  {tooth.number}
                  {tooth.procedures.length > 0 && (
                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full text-white text-xs flex items-center justify-center">
                      {tooth.procedures.length}
                    </div>
                  )}
                </div>
              ))}
            </div></div>
          </div>

          {/* Legend */}
          <div className="mt-6 flex flex-wrap gap-4 justify-center">
            {Object.entries({
              healthy: 'Healthy',
              cavity: 'Cavity',
              filled: 'Filled',
              crown: 'Crown',
              implant: 'Implant',
              extracted: 'Extracted',
              root_canal: 'Root Canal'
            }).map(([status, label]) => (
              <div key={status} className="flex items-center space-x-2">
                <div className={`w-4 h-4 rounded border ${getToothColor(status)}`}></div>
                <span className="text-sm">{label}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Treatment Panel */}
      {editable && selectedTooth && (
        <Card>
          <CardHeader>
            <CardTitle>Treatment - Tooth #{selectedTooth}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Treatment Type</label>
              <Select value={treatmentType} onValueChange={setTreatmentType}>
                <SelectTrigger>
                  <SelectValue placeholder="Select treatment" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cavity">Mark Cavity</SelectItem>
                  <SelectItem value="filled">Filling</SelectItem>
                  <SelectItem value="crown">Crown</SelectItem>
                  <SelectItem value="implant">Implant</SelectItem>
                  <SelectItem value="extracted">Extraction</SelectItem>
                  <SelectItem value="root_canal">Root Canal</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Notes</label>
              <Textarea
                placeholder="Treatment notes..."
                value={teeth.find(t => t.number === selectedTooth)?.notes || ''}
                onChange={(e) => updateTooth(selectedTooth, { notes: e.target.value })}
              />
            </div>

            <div className="flex space-x-2">
              <Button onClick={addTreatment} disabled={!treatmentType}>
                Add Treatment
              </Button>
              <Button variant="outline" onClick={() => setSelectedTooth(null)}>
                Close
              </Button>
            </div>

            {/* Current Procedures */}
            <div>
              <h4 className="text-sm font-medium mb-2">Current Procedures:</h4>
              <div className="flex flex-wrap gap-2">
                {teeth.find(t => t.number === selectedTooth)?.procedures.map((procedure, index) => (
                  <Badge key={index} variant="outline">
                    {procedure}
                  </Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
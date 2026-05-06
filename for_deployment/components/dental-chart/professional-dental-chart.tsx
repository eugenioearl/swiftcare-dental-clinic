
'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Loader2, Save, Palette, Eye, Undo2 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

// ─── Types ───────────────────────────────────────────────────────────────
export interface Treatment {
  type: string
  material?: string
  date: string
  dentist: string
  status: 'existing' | 'treatment_plan' | 'in_progress' | 'completed'
  surfaces?: string[]
  customNote?: string
}

export interface ToothData {
  number: number
  surfaces: {
    mesial: Treatment | null
    distal: Treatment | null
    occlusal: Treatment | null
    buccal: Treatment | null
    lingual: Treatment | null
  }
  wholeTooth: Treatment | null
  notes: string[]
  lastModified: string
}

export type DentalChartType = 'primary' | 'mixed' | 'permanent'

export interface ChartData {
  [toothNumber: string]: ToothData
  // NOTE: _meta is an object entry (not ToothData). Consumers must guard on number|string.
}

interface ProfessionalDentalChartProps {
  patientId: string
  editable?: boolean
  initialChartData?: ChartData | null
  /**
   * Save handler.
   * Second argument includes the active chart type at save-time so the server can
   * snapshot it in DentalChartVersion and update the Patient profile.
   */
  onSave?: (chartData: ChartData, meta?: { chartType?: DentalChartType }) => Promise<void>
  compact?: boolean
  dentistName?: string
  /** Initial chart type (patient profile's currentChartType OR age-based suggestion). */
  chartType?: DentalChartType
  /** Fired whenever the dentist changes chart type via the toggle. */
  onChartTypeChange?: (chartType: DentalChartType) => void
  /** Externally controlled selected tooth (synced from parent) */
  externalSelectedTooth?: number | null
  /** Callback when a tooth is clicked inside the chart */
  onToothSelect?: (toothNumber: number | null) => void
}

// ─── Constants ────────────────────────────────────────────────────────────
export const TREATMENT_TYPES: Record<string, { name: string; color: string; symbol: string; category: string }> = {
  // Restorative
  filling_amalgam: { name: 'Amalgam Filling', color: '#666666', symbol: 'AM', category: 'restorative' },
  filling_composite: { name: 'Composite Filling', color: '#87CEEB', symbol: 'CO', category: 'restorative' },
  filling_gold: { name: 'Gold Filling', color: '#FFD700', symbol: 'AU', category: 'restorative' },
  crown_porcelain: { name: 'Porcelain Crown', color: '#B0E0E6', symbol: 'PC', category: 'restorative' },
  crown_gold: { name: 'Gold Crown', color: '#FFD700', symbol: 'GC', category: 'restorative' },
  crown_pfm: { name: 'PFM Crown', color: '#E6E6FA', symbol: 'PF', category: 'restorative' },
  bridge: { name: 'Bridge', color: '#DDA0DD', symbol: 'BR', category: 'restorative' },
  inlay: { name: 'Inlay', color: '#F5DEB3', symbol: 'IN', category: 'restorative' },
  onlay: { name: 'Onlay', color: '#DEB887', symbol: 'ON', category: 'restorative' },
  veneer: { name: 'Veneer', color: '#F0FFF0', symbol: 'VE', category: 'restorative' },
  // Endodontic
  root_canal: { name: 'Root Canal', color: '#FF6347', symbol: 'RC', category: 'endodontic' },
  post_core: { name: 'Post & Core', color: '#CD853F', symbol: 'PC', category: 'endodontic' },
  // Surgical
  extraction: { name: 'Extraction', color: '#DC143C', symbol: 'X', category: 'surgical' },
  implant: { name: 'Implant', color: '#4682B4', symbol: 'IM', category: 'surgical' },
  // Preventive
  sealant: { name: 'Sealant', color: '#98FB98', symbol: 'SE', category: 'preventive' },
  // Conditions
  caries: { name: 'Caries', color: '#8B0000', symbol: 'C', category: 'condition' },
  watch: { name: 'Watch', color: '#FFA500', symbol: 'W', category: 'condition' },
  abscess: { name: 'Abscess', color: '#FF0000', symbol: 'AB', category: 'condition' },
  // Periodontal
  perio_pocket: { name: 'Perio Pocket', color: '#FF1493', symbol: 'PP', category: 'periodontal' },
  recession: { name: 'Recession', color: '#FF69B4', symbol: 'R', category: 'periodontal' },
  mobility: { name: 'Mobility', color: '#DA70D6', symbol: 'M', category: 'periodontal' },
  furcation: { name: 'Furcation', color: '#BA55D3', symbol: 'F', category: 'periodontal' },
  // Other / Custom
  other: { name: 'Other', color: '#607D8B', symbol: 'OT', category: 'other' },
}

const CONDITIONS = Object.entries(TREATMENT_TYPES).map(([id, t]) => ({ id, ...t }))

const TOOTH_ANATOMY: Record<number, { type: string; name: string; position: string }> = {
  18: { type: 'molar', name: '3rd Molar', position: 'upper_right' },
  17: { type: 'molar', name: '2nd Molar', position: 'upper_right' },
  16: { type: 'molar', name: '1st Molar', position: 'upper_right' },
  15: { type: 'premolar', name: '2nd Premolar', position: 'upper_right' },
  14: { type: 'premolar', name: '1st Premolar', position: 'upper_right' },
  13: { type: 'canine', name: 'Canine', position: 'upper_right' },
  12: { type: 'incisor', name: 'Lateral Incisor', position: 'upper_right' },
  11: { type: 'incisor', name: 'Central Incisor', position: 'upper_right' },
  21: { type: 'incisor', name: 'Central Incisor', position: 'upper_left' },
  22: { type: 'incisor', name: 'Lateral Incisor', position: 'upper_left' },
  23: { type: 'canine', name: 'Canine', position: 'upper_left' },
  24: { type: 'premolar', name: '1st Premolar', position: 'upper_left' },
  25: { type: 'premolar', name: '2nd Premolar', position: 'upper_left' },
  26: { type: 'molar', name: '1st Molar', position: 'upper_left' },
  27: { type: 'molar', name: '2nd Molar', position: 'upper_left' },
  28: { type: 'molar', name: '3rd Molar', position: 'upper_left' },
  38: { type: 'molar', name: '3rd Molar', position: 'lower_left' },
  37: { type: 'molar', name: '2nd Molar', position: 'lower_left' },
  36: { type: 'molar', name: '1st Molar', position: 'lower_left' },
  35: { type: 'premolar', name: '2nd Premolar', position: 'lower_left' },
  34: { type: 'premolar', name: '1st Premolar', position: 'lower_left' },
  33: { type: 'canine', name: 'Canine', position: 'lower_left' },
  32: { type: 'incisor', name: 'Lateral Incisor', position: 'lower_left' },
  31: { type: 'incisor', name: 'Central Incisor', position: 'lower_left' },
  41: { type: 'incisor', name: 'Central Incisor', position: 'lower_right' },
  42: { type: 'incisor', name: 'Lateral Incisor', position: 'lower_right' },
  43: { type: 'canine', name: 'Canine', position: 'lower_right' },
  44: { type: 'premolar', name: '1st Premolar', position: 'lower_right' },
  45: { type: 'premolar', name: '2nd Premolar', position: 'lower_right' },
  46: { type: 'molar', name: '1st Molar', position: 'lower_right' },
  47: { type: 'molar', name: '2nd Molar', position: 'lower_right' },
  48: { type: 'molar', name: '3rd Molar', position: 'lower_right' },
}

const PERMANENT_FDI_NUMBERS = [18,17,16,15,14,13,12,11,21,22,23,24,25,26,27,28,31,32,33,34,35,36,37,38,41,42,43,44,45,46,47,48]

// Keep backward compatibility
const FDI_NUMBERS = PERMANENT_FDI_NUMBERS

// Primary (deciduous) dentition – 20 teeth
// Upper Right: 55,54,53,52,51 | Upper Left: 61,62,63,64,65
// Lower Left:  75,74,73,72,71 | Lower Right: 85,84,83,82,81
const PRIMARY_FDI_NUMBERS = [55,54,53,52,51,61,62,63,64,65,75,74,73,72,71,85,84,83,82,81]

const PRIMARY_TOOTH_ANATOMY: Record<number, { type: string; name: string; position: string }> = {
  // Upper Right
  55: { type: 'molar', name: '2nd Primary Molar', position: 'upper_right' },
  54: { type: 'molar', name: '1st Primary Molar', position: 'upper_right' },
  53: { type: 'canine', name: 'Primary Canine', position: 'upper_right' },
  52: { type: 'incisor', name: 'Primary Lateral Incisor', position: 'upper_right' },
  51: { type: 'incisor', name: 'Primary Central Incisor', position: 'upper_right' },
  // Upper Left
  61: { type: 'incisor', name: 'Primary Central Incisor', position: 'upper_left' },
  62: { type: 'incisor', name: 'Primary Lateral Incisor', position: 'upper_left' },
  63: { type: 'canine', name: 'Primary Canine', position: 'upper_left' },
  64: { type: 'molar', name: '1st Primary Molar', position: 'upper_left' },
  65: { type: 'molar', name: '2nd Primary Molar', position: 'upper_left' },
  // Lower Left
  75: { type: 'molar', name: '2nd Primary Molar', position: 'lower_left' },
  74: { type: 'molar', name: '1st Primary Molar', position: 'lower_left' },
  73: { type: 'canine', name: 'Primary Canine', position: 'lower_left' },
  72: { type: 'incisor', name: 'Primary Lateral Incisor', position: 'lower_left' },
  71: { type: 'incisor', name: 'Primary Central Incisor', position: 'lower_left' },
  // Lower Right
  81: { type: 'incisor', name: 'Primary Central Incisor', position: 'lower_right' },
  82: { type: 'incisor', name: 'Primary Lateral Incisor', position: 'lower_right' },
  83: { type: 'canine', name: 'Primary Canine', position: 'lower_right' },
  84: { type: 'molar', name: '1st Primary Molar', position: 'lower_right' },
  85: { type: 'molar', name: '2nd Primary Molar', position: 'lower_right' },
}

// Combined anatomy lookup – used for tooth info display regardless of mode
const COMBINED_TOOTH_ANATOMY: Record<number, { type: string; name: string; position: string }> = {
  ...TOOTH_ANATOMY,
  ...PRIMARY_TOOTH_ANATOMY,
}

/** Teeth numbers arrays per arch quadrant, per chart type */
const PERMANENT_ROWS = {
  upperRight: [18,17,16,15,14,13,12,11],
  upperLeft:  [21,22,23,24,25,26,27,28],
  lowerLeft:  [38,37,36,35,34,33,32,31],
  lowerRight: [41,42,43,44,45,46,47,48],
}
const PRIMARY_ROWS = {
  upperRight: [55,54,53,52,51],
  upperLeft:  [61,62,63,64,65],
  lowerLeft:  [75,74,73,72,71],
  lowerRight: [81,82,83,84,85],
}

/** Return the teeth numbers for the active chart type */
function getTeethForChartType(type: DentalChartType): number[] {
  switch (type) {
    case 'primary':   return PRIMARY_FDI_NUMBERS
    case 'mixed':     return [...PRIMARY_FDI_NUMBERS, ...PERMANENT_FDI_NUMBERS]
    case 'permanent':
    default:          return PERMANENT_FDI_NUMBERS
  }
}

/** Build a blank chart with all teeth (for the active chart type) set to healthy */
export function buildDefaultChartData(chartType: DentalChartType = 'permanent'): ChartData {
  const data: ChartData = {}
  getTeethForChartType(chartType).forEach(n => {
    data[String(n)] = {
      number: n,
      surfaces: { mesial: null, distal: null, occlusal: null, buccal: null, lingual: null },
      wholeTooth: null,
      notes: [],
      lastModified: '',
    }
  })
  return data
}

// ─── Component ────────────────────────────────────────────────────────────
export default function ProfessionalDentalChart({
  patientId,
  editable = false,
  initialChartData,
  onSave,
  compact = false,
  dentistName = 'Dentist',
  chartType: initialChartType = 'permanent',
  onChartTypeChange,
  externalSelectedTooth,
  onToothSelect,
}: ProfessionalDentalChartProps) {
  const { toast } = useToast()
  const [toothData, setToothData] = useState<ChartData>({})
  const [selectedTooth, setSelectedTooth] = useState<number | null>(null)

  // Sync internal selection with external prop
  useEffect(() => {
    if (externalSelectedTooth !== undefined) {
      setSelectedTooth(externalSelectedTooth)
    }
  }, [externalSelectedTooth])
  const [selectedTreatment, setSelectedTreatment] = useState<string>('')
  const [selectedSurface, setSelectedSurface] = useState<string>('')
  const [customNote, setCustomNote] = useState<string>('')
  const [viewMode, setViewMode] = useState<'existing' | 'treatment_plan' | 'both'>('both')
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [currentChartType, setCurrentChartType] = useState<DentalChartType>(initialChartType)

  // Load chart data from props or build default
  useEffect(() => {
    if (initialChartData && Object.keys(initialChartData).length > 0) {
      // Detect whether initial data has primary teeth, permanent teeth, or both
      const keys = Object.keys(initialChartData)
      const hasPrimary = keys.some(k => PRIMARY_FDI_NUMBERS.includes(Number(k)))
      const hasPermanent = keys.some(k => PERMANENT_FDI_NUMBERS.includes(Number(k)))
      let detectedType: DentalChartType = initialChartType
      if (hasPrimary && hasPermanent) detectedType = 'mixed'
      else if (hasPrimary) detectedType = 'primary'
      else if (hasPermanent) detectedType = 'permanent'

      // Ensure all teeth for this type exist (merge with defaults)
      const merged = buildDefaultChartData(detectedType)
      Object.entries(initialChartData).forEach(([key, val]) => {
        if (!val || typeof val !== 'object') return
        if (merged[key]) {
          merged[key] = { ...merged[key], ...(val as ToothData) }
        } else {
          // Tooth from data that isn't in default – include it so we don't lose data
          merged[key] = val as ToothData
        }
      })
      setToothData(merged)
      setCurrentChartType(detectedType)
    } else {
      setToothData(buildDefaultChartData(initialChartType))
      setCurrentChartType(initialChartType)
    }
    setDirty(false)
  }, [initialChartData, initialChartType])

  // Called when user changes the chart type via the toggle
  const handleChartTypeChange = (next: DentalChartType) => {
    if (next === currentChartType) return
    setCurrentChartType(next)
    // Expand existing data to include the new set of teeth (preserve anything already set)
    setToothData(prev => {
      const expanded = buildDefaultChartData(next)
      Object.entries(prev).forEach(([key, val]) => {
        if (!val || typeof val !== 'object') return
        // Keep this tooth's data if it's now part of the active set OR was filled in before
        if (expanded[key]) {
          expanded[key] = { ...expanded[key], ...val }
        }
      })
      return expanded
    })
    setSelectedTooth(null)
    setSelectedSurface('')
    setDirty(true)
    // Notify parent so they can persist the chart-type choice to the patient profile
    onChartTypeChange?.(next)
  }

  const handleToothClick = (toothNumber: number) => {
    const newSelection = selectedTooth === toothNumber ? null : toothNumber
    setSelectedTooth(newSelection ?? toothNumber)
    if (!editable) {
      onToothSelect?.(newSelection ?? toothNumber)
      return
    }
    onToothSelect?.(newSelection ?? toothNumber)
  }

  const handleSurfaceClick = (toothNumber: number, surface: string, event: React.MouseEvent) => {
    event.stopPropagation()
    setSelectedTooth(toothNumber)
    if (editable) setSelectedSurface(surface)
  }

  const applyTreatment = () => {
    if (!selectedTooth || !selectedTreatment) return
    if (selectedTreatment === 'other' && !customNote.trim()) {
      toast({ title: 'Please add a description for the custom treatment', variant: 'destructive' })
      return
    }
    const treatment: Treatment = {
      type: selectedTreatment,
      date: new Date().toISOString().split('T')[0],
      dentist: dentistName,
      status: 'existing',
      ...(selectedTreatment === 'other' && customNote.trim() ? { customNote: customNote.trim() } : {}),
    }
    setToothData(prev => {
      const updated = { ...prev }
      const key = String(selectedTooth)
      const tooth = { ...updated[key] }
      if (selectedSurface && selectedSurface !== 'whole_tooth') {
        tooth.surfaces = { ...tooth.surfaces, [selectedSurface]: treatment }
      } else {
        tooth.wholeTooth = treatment
      }
      // Also add custom note to tooth notes array for easy reference
      if (selectedTreatment === 'other' && customNote.trim()) {
        tooth.notes = [...(tooth.notes || []), `Other: ${customNote.trim()} (${new Date().toISOString().split('T')[0]})`]
      }
      tooth.lastModified = new Date().toISOString()
      updated[key] = tooth
      return updated
    })
    setDirty(true)
    setSelectedTreatment('')
    setSelectedSurface('')
    setCustomNote('')
  }

  const clearTreatment = () => {
    if (!selectedTooth) return
    setToothData(prev => {
      const updated = { ...prev }
      const key = String(selectedTooth)
      const tooth = { ...updated[key] }
      if (selectedSurface && selectedSurface !== 'whole_tooth') {
        tooth.surfaces = { ...tooth.surfaces, [selectedSurface]: null }
      } else {
        tooth.wholeTooth = null
      }
      updated[key] = tooth
      return updated
    })
    setDirty(true)
  }

  const handleSave = async () => {
    if (!onSave) return
    setSaving(true)
    try {
      await onSave(toothData, { chartType: currentChartType })
      setDirty(false)
      toast({ title: 'Dental chart saved successfully' })
    } catch {
      toast({ title: 'Failed to save chart', variant: 'destructive' })
    }
    setSaving(false)
  }

  // ─── Tooth renderer ──────────────────────────────────────
  const shouldShow = (treatment: Treatment | null) => {
    if (!treatment) return false
    if (viewMode === 'existing') return treatment.status === 'existing' || treatment.status === 'completed'
    if (viewMode === 'treatment_plan') return treatment.status === 'treatment_plan' || treatment.status === 'in_progress'
    return true
  }

  const renderTooth = (toothNumber: number) => {
    const tooth = toothData[String(toothNumber)]
    if (!tooth) return null
    const isSelected = selectedTooth === toothNumber
    const wholeTreatment = tooth.wholeTooth
    const isMissing = wholeTreatment?.type === 'extraction'

    const getSurfaceColor = (surfaceKey: string) => {
      let mapped = surfaceKey
      switch (surfaceKey) {
        case 'surface1': mapped = 'mesial'; break
        case 'surface2': mapped = 'buccal'; break
        case 'surface3': mapped = 'distal'; break
        case 'surface4': mapped = 'lingual'; break
        case 'center': mapped = 'occlusal'; break
        default: mapped = surfaceKey; break
      }
      const treatment = tooth.surfaces[mapped as keyof typeof tooth.surfaces]
      // If there's an applied treatment, render its color
      if (treatment && shouldShow(treatment)) {
        return TREATMENT_TYPES[treatment.type]?.color || 'white'
      }
      // Preview: if this is the selected tooth + surface and a treatment is picked
      //  (but not yet applied), show a ghost/preview of the intended treatment color.
      if (editable && isSelected && selectedTreatment && (selectedSurface === mapped || (selectedSurface === 'whole_tooth' && !tooth.wholeTooth))) {
        const previewColor = TREATMENT_TYPES[selectedTreatment]?.color
        if (previewColor) return previewColor
      }
      // Selection indicator: even without a treatment, a selected tooth should
      //  clearly stand out so the clinician sees which tooth they picked.
      if (isSelected) {
        // Highlight the selected surface more strongly than the others
        if (selectedSurface && selectedSurface === mapped) return '#bfdbfe' // blue-200
        return '#e0f2fe' // sky-100 – subtle highlight across all surfaces of the selected tooth
      }
      return 'white'
    }

    const svgSize = compact ? 48 : 60
    const outerR = compact ? 20 : 25
    const innerR = compact ? 8 : 10

    if (isMissing && shouldShow(wholeTreatment)) {
      return (
        <div key={toothNumber} className={`tooth-container cursor-pointer ${isSelected ? 'selected' : ''}`} onClick={() => handleToothClick(toothNumber)} style={{ margin: compact ? '2px' : '4px', opacity: 0.4 }}>
          <svg width={svgSize} height={svgSize} viewBox={`-30 -30 60 60`}>
            <circle cx="0" cy="0" r={outerR} fill="none" stroke="#dc3545" strokeWidth="2" strokeDasharray="4,4" />
            <circle cx="0" cy="0" r={innerR} fill="none" stroke="#dc3545" strokeWidth="2" strokeDasharray="2,2" />
            <text x="0" y="5" textAnchor="middle" fontSize="20" fill="#dc3545" fontWeight="bold">✗</text>
          </svg>
          <div className="text-xs text-center mt-0.5 font-medium">{toothNumber}</div>
        </div>
      )
    }

    return (
      <div key={toothNumber} className={`tooth-container cursor-pointer ${isSelected ? 'selected' : ''}`} onClick={() => handleToothClick(toothNumber)} style={{ margin: compact ? '2px' : '4px' }}>
        <svg width={svgSize} height={svgSize} viewBox="-30 -30 60 60">
          <circle cx="0" cy="0" r={outerR} fill="none" stroke={isSelected ? '#3b82f6' : 'gray'} strokeWidth={isSelected ? '3' : '2'} />
          <circle cx="0" cy="0" r={innerR} fill={getSurfaceColor('center')} stroke={isSelected ? '#3b82f6' : 'gray'} strokeWidth="2" className="cursor-pointer hover:stroke-blue-500 transition-colors" onClick={e => { e.stopPropagation(); handleSurfaceClick(toothNumber, 'occlusal', e) }} />
          <g transform="rotate(45)">
            <path d={`M 0 -${outerR} A ${outerR} ${outerR} 0 0 1 ${outerR} 0 L ${innerR} 0 A ${innerR} ${innerR} 0 0 0 0 -${innerR} Z`} fill={getSurfaceColor('surface1')} stroke={isSelected ? '#3b82f6' : 'gray'} strokeWidth="2" className="cursor-pointer hover:stroke-blue-500 transition-colors" onClick={e => { e.stopPropagation(); handleSurfaceClick(toothNumber, 'mesial', e) }} />
            <path d={`M ${outerR} 0 A ${outerR} ${outerR} 0 0 1 0 ${outerR} L 0 ${innerR} A ${innerR} ${innerR} 0 0 0 ${innerR} 0 Z`} fill={getSurfaceColor('surface2')} stroke={isSelected ? '#3b82f6' : 'gray'} strokeWidth="2" className="cursor-pointer hover:stroke-blue-500 transition-colors" onClick={e => { e.stopPropagation(); handleSurfaceClick(toothNumber, 'buccal', e) }} />
            <path d={`M 0 ${outerR} A ${outerR} ${outerR} 0 0 1 -${outerR} 0 L -${innerR} 0 A ${innerR} ${innerR} 0 0 0 0 ${innerR} Z`} fill={getSurfaceColor('surface3')} stroke={isSelected ? '#3b82f6' : 'gray'} strokeWidth="2" className="cursor-pointer hover:stroke-blue-500 transition-colors" onClick={e => { e.stopPropagation(); handleSurfaceClick(toothNumber, 'distal', e) }} />
            <path d={`M -${outerR} 0 A ${outerR} ${outerR} 0 0 1 0 -${outerR} L 0 -${innerR} A ${innerR} ${innerR} 0 0 0 -${innerR} 0 Z`} fill={getSurfaceColor('surface4')} stroke={isSelected ? '#3b82f6' : 'gray'} strokeWidth="2" className="cursor-pointer hover:stroke-blue-500 transition-colors" onClick={e => { e.stopPropagation(); handleSurfaceClick(toothNumber, 'lingual', e) }} />
          </g>
          <text x="0" y="3" textAnchor="middle" fontSize={compact ? '8' : '10'} fontWeight="bold" fill="#333" className="pointer-events-none select-none">{toothNumber}</text>
          {wholeTreatment?.type === 'root_canal' && shouldShow(wholeTreatment) && <circle cx="0" cy="0" r="6" fill="none" stroke="#7c3aed" strokeWidth="2" />}
          {wholeTreatment?.type?.includes('crown') && shouldShow(wholeTreatment) && <circle cx="0" cy="0" r="20" fill="rgba(241,196,15,0.2)" stroke="#f1c40f" strokeWidth="3" />}
          {wholeTreatment?.type === 'implant' && shouldShow(wholeTreatment) && (<><circle cx="0" cy="0" r="23" fill="none" stroke="#4682B4" strokeWidth="3" /><circle cx="0" cy="0" r="5" fill="#4682B4" /></>)}
        </svg>
        <div className={`text-center mt-0.5 font-medium text-gray-700 ${compact ? 'text-[10px]' : 'text-xs'}`}>{toothNumber}</div>
        {!compact && wholeTreatment && wholeTreatment.type !== 'extraction' && shouldShow(wholeTreatment) && (
          <div className="text-[10px] text-center text-gray-500 truncate max-w-[70px]">
            {wholeTreatment.type === 'other' && wholeTreatment.customNote
              ? wholeTreatment.customNote
              : TREATMENT_TYPES[wholeTreatment.type]?.name}
          </div>
        )}
      </div>
    )
  }

  // ─── Render ──────────────────────────────────────────────
  return (
    <Card className="w-full">
      <CardHeader className={compact ? 'pb-2 pt-3 px-4' : undefined}>
        <CardTitle className={`flex items-center justify-between flex-wrap gap-2 ${compact ? 'text-sm' : ''}`}>
          <div className="flex items-center gap-2">
            <span>{compact ? 'Dental Chart' : 'Professional Dental Chart'}</span>
            <Badge variant="outline" className="text-xs font-normal">FDI</Badge>
            <Badge
              variant="outline"
              className={`text-[10px] font-medium ${
                currentChartType === 'primary'
                  ? 'bg-pink-50 border-pink-300 text-pink-700'
                  : currentChartType === 'mixed'
                  ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
                  : 'bg-emerald-50 border-emerald-300 text-emerald-700'
              }`}
            >
              {currentChartType === 'primary' ? 'Primary (Kids)' : currentChartType === 'mixed' ? 'Mixed' : 'Permanent (Adult)'}
            </Badge>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Chart type toggle: Primary / Mixed / Permanent */}
            <div className="flex items-center gap-1 bg-white border rounded-lg p-0.5">
              {([
                { key: 'primary',   label: 'Primary', desc: 'Kids (20)' },
                { key: 'mixed',     label: 'Mixed',   desc: 'Mixed' },
                { key: 'permanent', label: 'Adult',   desc: 'Adults (32)' },
              ] as Array<{ key: DentalChartType; label: string; desc: string }>).map(opt => (
                <button
                  key={opt.key}
                  type="button"
                  title={opt.desc}
                  onClick={() => handleChartTypeChange(opt.key)}
                  className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
                    currentChartType === opt.key
                      ? opt.key === 'primary'
                        ? 'bg-pink-100 text-pink-700'
                        : opt.key === 'mixed'
                        ? 'bg-indigo-100 text-indigo-700'
                        : 'bg-emerald-100 text-emerald-700'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {editable && dirty && (
              <Button size="sm" onClick={handleSave} disabled={saving} className="bg-green-600 hover:bg-green-700 text-white">
                {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />} Save Chart
              </Button>
            )}
            {!compact && (
              <Select value={viewMode} onValueChange={(v: any) => setViewMode(v)}>
                <SelectTrigger className="w-36 h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="both">Show All</SelectItem>
                  <SelectItem value="existing">Existing Only</SelectItem>
                  <SelectItem value="treatment_plan">Treatment Plan</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>
        </CardTitle>
        {!compact && <p className="text-xs text-gray-500">FDI World Dental Federation notation (ISO 3950) • Click a tooth to inspect • Toggle Primary/Mixed/Adult above</p>}
      </CardHeader>

      <CardContent className={compact ? 'px-3 pb-3 space-y-3' : 'space-y-6'}>
        {/* Toolbar */}
        {editable && (
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-3 rounded-xl border border-blue-200 shadow-sm">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-blue-100 rounded-lg"><Palette className="w-3.5 h-3.5 text-blue-600" /></div>
                <Select value={selectedTreatment} onValueChange={setSelectedTreatment}>
                  <SelectTrigger className="w-48 h-8 text-xs bg-white"><SelectValue placeholder="Select treatment" /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(TREATMENT_TYPES).map(([key, t]) => (
                      <SelectItem key={key} value={key}>
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded border border-gray-300" style={{ backgroundColor: t.color }} />
                          <span className="text-xs">{t.name}</span>
                          <span className="text-[10px] text-gray-400">({t.symbol})</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {selectedTreatment === 'other' && (
                <input
                  type="text"
                  value={customNote}
                  onChange={e => setCustomNote(e.target.value)}
                  placeholder="Describe treatment..."
                  className="h-8 px-3 text-xs border border-gray-300 rounded-md w-48 focus:border-blue-400 focus:ring-1 focus:ring-blue-200 outline-none"
                />
              )}
              <Button size="sm" onClick={applyTreatment} disabled={!selectedTooth || !selectedTreatment || (selectedTreatment === 'other' && !customNote.trim())} className="bg-blue-600 hover:bg-blue-700 text-white h-8 text-xs">
                Apply
              </Button>
              <Button variant="outline" size="sm" onClick={clearTreatment} disabled={!selectedTooth} className="h-8 text-xs">
                Clear
              </Button>
              {selectedTooth && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-white rounded-lg border text-xs">
                  <div className="w-1.5 h-1.5 bg-blue-500 rounded-full" />
                  <span className="font-medium text-gray-700">Tooth #{selectedTooth}{selectedSurface && <span className="text-blue-600"> • {selectedSurface}</span>}</span>
                </div>
              )}
              <div className="flex items-center gap-1.5 ml-auto">
                <span className="text-xs font-medium text-gray-500">View:</span>
                <div className="flex bg-white rounded-lg p-0.5 border">
                  {(['both', 'existing', 'treatment_plan'] as const).map(mode => (
                    <button key={mode} onClick={() => setViewMode(mode)} className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
                      viewMode === mode
                        ? mode === 'both' ? 'bg-blue-100 text-blue-700' : mode === 'existing' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}>{mode === 'both' ? 'All' : mode === 'existing' ? 'Existing' : 'Planned'}</button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Chart */}
        <div className="dental-chart-molarsoft overflow-x-auto">
          {currentChartType === 'permanent' && (
            <>
              {/* Upper Arch */}
              <div className="mb-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center">
                    <div className="text-[10px] font-semibold text-gray-400 tracking-widest mb-2">RIGHT</div>
                    <div className="flex justify-center gap-0 flex-wrap">{PERMANENT_ROWS.upperRight.map(n => renderTooth(n))}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-[10px] font-semibold text-gray-400 tracking-widest mb-2">LEFT</div>
                    <div className="flex justify-center gap-0 flex-wrap">{PERMANENT_ROWS.upperLeft.map(n => renderTooth(n))}</div>
                  </div>
                </div>
              </div>

              {/* Bite line */}
              <div className="flex items-center justify-center my-4">
                <div className="flex-1 h-0.5 bg-gradient-to-r from-gray-200 via-gray-400 to-gray-200 rounded" />
                <span className="px-3 text-[10px] text-gray-400 font-medium tracking-widest">BITE LINE</span>
                <div className="flex-1 h-0.5 bg-gradient-to-r from-gray-200 via-gray-400 to-gray-200 rounded" />
              </div>

              {/* Lower Arch */}
              <div className="mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center">
                    <div className="flex justify-center gap-0 flex-wrap">{PERMANENT_ROWS.lowerLeft.map(n => renderTooth(n))}</div>
                    <div className="text-[10px] font-semibold text-gray-400 tracking-widest mt-2">LEFT</div>
                  </div>
                  <div className="text-center">
                    <div className="flex justify-center gap-0 flex-wrap">{PERMANENT_ROWS.lowerRight.map(n => renderTooth(n))}</div>
                    <div className="text-[10px] font-semibold text-gray-400 tracking-widest mt-2">RIGHT</div>
                  </div>
                </div>
              </div>
            </>
          )}

          {currentChartType === 'primary' && (
            <>
              {/* Upper Arch – Primary (20 teeth) */}
              <div className="mb-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center">
                    <div className="text-[10px] font-semibold text-gray-400 tracking-widest mb-2">RIGHT</div>
                    <div className="flex justify-center gap-0 flex-wrap">{PRIMARY_ROWS.upperRight.map(n => renderTooth(n))}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-[10px] font-semibold text-gray-400 tracking-widest mb-2">LEFT</div>
                    <div className="flex justify-center gap-0 flex-wrap">{PRIMARY_ROWS.upperLeft.map(n => renderTooth(n))}</div>
                  </div>
                </div>
              </div>

              {/* Bite line */}
              <div className="flex items-center justify-center my-4">
                <div className="flex-1 h-0.5 bg-gradient-to-r from-gray-200 via-gray-400 to-gray-200 rounded" />
                <span className="px-3 text-[10px] text-gray-400 font-medium tracking-widest">BITE LINE • PRIMARY</span>
                <div className="flex-1 h-0.5 bg-gradient-to-r from-gray-200 via-gray-400 to-gray-200 rounded" />
              </div>

              {/* Lower Arch – Primary */}
              <div className="mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center">
                    <div className="flex justify-center gap-0 flex-wrap">{PRIMARY_ROWS.lowerLeft.map(n => renderTooth(n))}</div>
                    <div className="text-[10px] font-semibold text-gray-400 tracking-widest mt-2">LEFT</div>
                  </div>
                  <div className="text-center">
                    <div className="flex justify-center gap-0 flex-wrap">{PRIMARY_ROWS.lowerRight.map(n => renderTooth(n))}</div>
                    <div className="text-[10px] font-semibold text-gray-400 tracking-widest mt-2">RIGHT</div>
                  </div>
                </div>
              </div>
            </>
          )}

          {currentChartType === 'mixed' && (
            <>
              {/* Upper Arch – Permanent (outer) + Primary (inner) */}
              <div className="mb-4">
                <div className="text-center mb-2">
                  <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-indigo-50 border border-indigo-200 text-[10px] font-semibold text-indigo-700 tracking-wide">UPPER ARCH</div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center">
                    <div className="text-[10px] font-semibold text-gray-400 tracking-widest mb-2">RIGHT</div>
                    <div className="flex justify-center gap-0 flex-wrap">{PERMANENT_ROWS.upperRight.map(n => renderTooth(n))}</div>
                    <div className="flex justify-center gap-0 flex-wrap mt-1 pl-8 opacity-90">{PRIMARY_ROWS.upperRight.map(n => renderTooth(n))}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-[10px] font-semibold text-gray-400 tracking-widest mb-2">LEFT</div>
                    <div className="flex justify-center gap-0 flex-wrap">{PERMANENT_ROWS.upperLeft.map(n => renderTooth(n))}</div>
                    <div className="flex justify-center gap-0 flex-wrap mt-1 pr-8 opacity-90">{PRIMARY_ROWS.upperLeft.map(n => renderTooth(n))}</div>
                  </div>
                </div>
              </div>

              {/* Bite line */}
              <div className="flex items-center justify-center my-4">
                <div className="flex-1 h-0.5 bg-gradient-to-r from-gray-200 via-gray-400 to-gray-200 rounded" />
                <span className="px-3 text-[10px] text-gray-400 font-medium tracking-widest">BITE LINE • MIXED</span>
                <div className="flex-1 h-0.5 bg-gradient-to-r from-gray-200 via-gray-400 to-gray-200 rounded" />
              </div>

              {/* Lower Arch – Primary (inner) + Permanent (outer) */}
              <div className="mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center">
                    <div className="flex justify-center gap-0 flex-wrap mb-1 pl-8 opacity-90">{PRIMARY_ROWS.lowerLeft.map(n => renderTooth(n))}</div>
                    <div className="flex justify-center gap-0 flex-wrap">{PERMANENT_ROWS.lowerLeft.map(n => renderTooth(n))}</div>
                    <div className="text-[10px] font-semibold text-gray-400 tracking-widest mt-2">LEFT</div>
                  </div>
                  <div className="text-center">
                    <div className="flex justify-center gap-0 flex-wrap mb-1 pr-8 opacity-90">{PRIMARY_ROWS.lowerRight.map(n => renderTooth(n))}</div>
                    <div className="flex justify-center gap-0 flex-wrap">{PERMANENT_ROWS.lowerRight.map(n => renderTooth(n))}</div>
                    <div className="text-[10px] font-semibold text-gray-400 tracking-widest mt-2">RIGHT</div>
                  </div>
                </div>
                <div className="text-center mt-2">
                  <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-indigo-50 border border-indigo-200 text-[10px] font-semibold text-indigo-700 tracking-wide">LOWER ARCH</div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Info Panels */}
        {!compact && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
            {/* Selected Tooth Info */}
            <Card className="shadow-sm">
              <CardHeader className="pb-2"><CardTitle className="text-sm">Tooth Information</CardTitle></CardHeader>
              <CardContent className="pt-0">
                {selectedTooth ? (
                  <div className="space-y-2">
                    <div className="p-2 bg-blue-50 rounded-lg border border-blue-200">
                      <div className="text-sm font-semibold text-blue-900">Tooth #{selectedTooth}</div>
                      <div className="text-xs text-blue-700">{COMBINED_TOOTH_ANATOMY[selectedTooth]?.name} — {COMBINED_TOOTH_ANATOMY[selectedTooth]?.position.replace('_', ' ')}</div>
                    </div>
                    {(() => {
                      const tooth = toothData[String(selectedTooth)]
                      const treatments: Array<{ type: string; location: string; date: string; status: string; dentist: string; customNote?: string }> = []
                      if (tooth?.wholeTooth) {
                        treatments.push({ type: TREATMENT_TYPES[tooth.wholeTooth.type]?.name || tooth.wholeTooth.type, location: 'Whole tooth', date: tooth.wholeTooth.date, status: tooth.wholeTooth.status, dentist: tooth.wholeTooth.dentist, customNote: tooth.wholeTooth.customNote })
                      }
                      Object.entries(tooth?.surfaces || {}).forEach(([s, t]) => {
                        if (t) treatments.push({ type: TREATMENT_TYPES[t.type]?.name || t.type, location: `${s} surface`, date: t.date, status: t.status, dentist: t.dentist, customNote: t.customNote })
                      })
                      return treatments.length > 0 ? (
                        <div className="space-y-1.5">
                          {treatments.map((t, i) => (
                            <div key={i} className={`p-2 rounded text-xs border-l-[3px] ${t.status === 'existing' || t.status === 'completed' ? 'border-l-green-500 bg-green-50' : t.status === 'treatment_plan' ? 'border-l-blue-500 bg-blue-50' : 'border-l-orange-500 bg-orange-50'}`}>
                              <div className="font-medium">{t.type}{t.customNote ? `: ${t.customNote}` : ''}</div>
                              <div className="text-gray-500">{t.location} • {t.date} • {t.dentist}</div>
                            </div>
                          ))}
                          {tooth?.notes && tooth.notes.length > 0 && (
                            <div className="mt-2 p-2 bg-gray-50 rounded border border-gray-200">
                              <div className="text-[10px] font-semibold text-gray-500 mb-1">NOTES</div>
                              {tooth.notes.map((n, i) => <div key={i} className="text-xs text-gray-600">{n}</div>)}
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="text-xs text-gray-400 text-center py-3">No treatments on this tooth</p>
                      )
                    })()}
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 text-center py-6">Click a tooth to view details</p>
                )}
              </CardContent>
            </Card>

            {/* Legend */}
            <Card className="shadow-sm lg:col-span-2">
              <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-1.5"><Palette className="w-3.5 h-3.5 text-purple-600" /> Treatment Legend</CardTitle></CardHeader>
              <CardContent className="pt-0">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {Object.entries(
                    CONDITIONS.reduce((acc, c) => { if (!acc[c.category]) acc[c.category] = []; acc[c.category].push(c); return acc }, {} as Record<string, typeof CONDITIONS>)
                  ).map(([cat, items]) => (
                    <div key={cat}>
                      <h6 className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">{cat}</h6>
                      <div className="space-y-0.5">
                        {items.map(c => (
                          <div key={c.id} className="flex items-center gap-1.5">
                            <div className="w-2.5 h-2.5 rounded border border-gray-300" style={{ backgroundColor: c.color }} />
                            <span className="text-[11px]">{c.symbol} - {c.name}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                <Separator className="my-2" />
                <div className="flex gap-4">
                  {[{ label: 'Existing', color: 'bg-green-500' }, { label: 'Planned', color: 'bg-blue-500' }, { label: 'In Progress', color: 'bg-orange-500' }].map(s => (
                    <div key={s.label} className="flex items-center gap-1.5">
                      <div className={`w-3 h-1 ${s.color} rounded`} />
                      <span className="text-[11px]">{s.label}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </CardContent>

      <style jsx>{`
        .tooth-container { position: relative; transition: all 0.2s ease; padding: 3px; border-radius: 8px; }
        .tooth-container:hover { transform: scale(1.05); background-color: rgba(59,130,246,0.05); box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
        .tooth-container.selected { background-color: rgba(59,130,246,0.1); box-shadow: 0 0 0 2px #3b82f6; transform: scale(1.05); }
        .tooth-container svg { filter: drop-shadow(0 2px 4px rgba(0,0,0,0.1)); transition: filter 0.2s ease; }
        .tooth-container:hover svg { filter: drop-shadow(0 4px 8px rgba(0,0,0,0.15)); }
        .tooth-container.selected svg { filter: drop-shadow(0 4px 12px rgba(59,130,246,0.3)); }
        .dental-chart-molarsoft { background: #fff; padding: 20px; border-radius: 12px; border: 1px solid #e2e8f0; min-height: 280px; box-shadow: 0 2px 4px rgba(0,0,0,0.05); }
        svg path:hover { stroke-width: 2; filter: brightness(1.1); }
      `}</style>
    </Card>
  )
}

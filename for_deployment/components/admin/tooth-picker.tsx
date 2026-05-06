'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Badge } from '@/components/ui/badge'
import { Bone as ToothIcon, X as XIcon } from 'lucide-react'

// FDI (ISO 3950) tooth numbering for adult permanent dentition.
// Upper right 18-11, Upper left 21-28, Lower left 38-31, Lower right 48-41
const UPPER_RIGHT = ['18', '17', '16', '15', '14', '13', '12', '11']
const UPPER_LEFT = ['21', '22', '23', '24', '25', '26', '27', '28']
const LOWER_LEFT = ['31', '32', '33', '34', '35', '36', '37', '38']
const LOWER_RIGHT = ['48', '47', '46', '45', '44', '43', '42', '41']

const PEDIATRIC_UPPER_RIGHT = ['55', '54', '53', '52', '51']
const PEDIATRIC_UPPER_LEFT = ['61', '62', '63', '64', '65']
const PEDIATRIC_LOWER_LEFT = ['71', '72', '73', '74', '75']
const PEDIATRIC_LOWER_RIGHT = ['85', '84', '83', '82', '81']

interface ToothPickerProps {
  selected: string[]
  onChange: (teeth: string[]) => void
  compact?: boolean
}

export function ToothPicker({ selected, onChange, compact = false }: ToothPickerProps) {
  const [open, setOpen] = useState(false)
  const [showPediatric, setShowPediatric] = useState(false)

  const toggle = (n: string) => {
    if (selected.includes(n)) {
      onChange(selected.filter(x => x !== n))
    } else {
      onChange([...selected, n].sort())
    }
  }

  const renderRow = (teeth: string[], side: 'left' | 'right') => (
    <div className={`flex gap-0.5 ${side === 'left' ? 'justify-start' : 'justify-end'}`}>
      {teeth.map(n => {
        const isSelected = selected.includes(n)
        return (
          <button
            key={n}
            type="button"
            onClick={() => toggle(n)}
            className={`w-7 h-9 text-[11px] font-medium rounded transition-all ${
              isSelected
                ? 'bg-[#2D9DA8] text-white shadow-sm'
                : 'bg-gray-50 text-gray-600 hover:bg-gray-100 border border-gray-200'
            }`}
          >
            {n}
          </button>
        )
      })}
    </div>
  )

  const dentition = showPediatric
    ? {
        upperRight: PEDIATRIC_UPPER_RIGHT,
        upperLeft: PEDIATRIC_UPPER_LEFT,
        lowerLeft: PEDIATRIC_LOWER_LEFT,
        lowerRight: PEDIATRIC_LOWER_RIGHT,
      }
    : {
        upperRight: UPPER_RIGHT,
        upperLeft: UPPER_LEFT,
        lowerLeft: LOWER_LEFT,
        lowerRight: LOWER_RIGHT,
      }

  return (
    <div className="space-y-1">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size={compact ? 'sm' : 'default'}
            className={compact ? 'h-8 text-xs justify-start w-full' : 'w-full justify-start'}
          >
            <ToothIcon className="w-3.5 h-3.5 mr-1.5 text-[#2D9DA8]" />
            {selected.length === 0 ? (
              <span className="text-gray-500">Select teeth…</span>
            ) : (
              <span className="truncate">
                {selected.length} tooth{selected.length > 1 ? '' : ''} selected
              </span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[340px] p-3" align="start">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-gray-700">
              {showPediatric ? 'Primary (Pediatric) Teeth' : 'Permanent Teeth'}
            </p>
            <button
              type="button"
              onClick={() => setShowPediatric(!showPediatric)}
              className="text-[10px] text-[#2D9DA8] font-semibold hover:underline"
            >
              {showPediatric ? 'Show Adult' : 'Show Pediatric'}
            </button>
          </div>

          <div className="space-y-2 select-none">
            {/* Upper jaw */}
            <div className="grid grid-cols-2 gap-1 pb-2 border-b">
              {renderRow(dentition.upperRight, 'right')}
              {renderRow(dentition.upperLeft, 'left')}
            </div>
            {/* Lower jaw */}
            <div className="grid grid-cols-2 gap-1 pt-2">
              {renderRow(dentition.lowerRight, 'right')}
              {renderRow(dentition.lowerLeft, 'left')}
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1 flex-wrap">
              <span className="text-[10px] text-gray-500">Selected:</span>
              {selected.length === 0 ? (
                <span className="text-[10px] text-gray-400 italic">none</span>
              ) : (
                selected.map(n => (
                  <Badge key={n} variant="secondary" className="text-[10px] h-5 px-1.5 gap-1">
                    {n}
                    <button
                      type="button"
                      onClick={() => toggle(n)}
                      className="ml-0.5 hover:text-red-600"
                    >
                      <XIcon className="w-2.5 h-2.5" />
                    </button>
                  </Badge>
                ))
              )}
            </div>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => onChange([])}
              disabled={selected.length === 0}
              className="h-6 text-[10px] px-2"
            >
              Clear
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}

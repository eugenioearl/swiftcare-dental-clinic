'use client'

import { useState, useEffect } from 'react'

interface ToothAnatomyViewsProps {
  toothNumber: number | null
  selectedSurfaces?: string[]
  onSurfaceClick?: (surface: string) => void
}

/** Determine tooth type from FDI number */
function getToothType(num: number): 'incisor' | 'canine' | 'premolar' | 'molar' {
  const unit = num % 10
  if (unit <= 2) return 'incisor'
  if (unit === 3) return 'canine'
  if (unit <= 5) return 'premolar'
  return 'molar'
}

/** Determine if upper jaw */
function isUpper(num: number): boolean {
  const quadrant = Math.floor(num / 10)
  return quadrant === 1 || quadrant === 2 || quadrant === 5 || quadrant === 6
}

const SURFACE_COLORS: Record<string, { active: string; hover: string }> = {
  B: { active: '#818cf8', hover: '#c7d2fe' },
  D: { active: '#818cf8', hover: '#c7d2fe' },
  O: { active: '#818cf8', hover: '#c7d2fe' },
  M: { active: '#818cf8', hover: '#c7d2fe' },
  L: { active: '#818cf8', hover: '#c7d2fe' },
  P: { active: '#818cf8', hover: '#c7d2fe' },
}

/** Crown (front/buccal) view SVG */
function CrownView({ toothType, upper, selectedSurfaces, onSurfaceClick, animKey }: {
  toothType: 'incisor' | 'canine' | 'premolar' | 'molar'
  upper: boolean
  selectedSurfaces: string[]
  onSurfaceClick?: (s: string) => void
  animKey: string
}) {
  const isBuccalSelected = selectedSurfaces.includes('B')
  const isMessSelected = selectedSurfaces.includes('M')
  const isDistSelected = selectedSurfaces.includes('D')

  // Crown shapes by tooth type
  const crownPaths: Record<string, string> = {
    incisor: upper
      ? 'M 30 20 Q 30 8 50 5 Q 70 8 70 20 L 70 55 Q 70 58 65 60 L 35 60 Q 30 58 30 55 Z'
      : 'M 32 15 Q 32 12 50 10 Q 68 12 68 15 L 68 55 Q 68 62 50 65 Q 32 62 32 55 Z',
    canine: upper
      ? 'M 32 15 Q 38 5 50 3 Q 62 5 68 15 L 70 55 Q 70 60 50 62 Q 30 60 30 55 Z'
      : 'M 33 12 Q 40 4 50 2 Q 60 4 67 12 L 68 55 Q 68 62 50 65 Q 32 62 32 55 Z',
    premolar: upper
      ? 'M 28 25 Q 28 10 50 5 Q 72 10 72 25 L 72 55 Q 72 60 50 62 Q 28 60 28 55 Z'
      : 'M 30 20 Q 30 8 50 5 Q 70 8 70 20 L 70 55 Q 70 62 50 65 Q 30 62 30 55 Z',
    molar: upper
      ? 'M 22 30 Q 22 12 50 5 Q 78 12 78 30 L 78 55 Q 78 60 50 62 Q 22 60 22 55 Z'
      : 'M 24 25 Q 24 10 50 5 Q 76 10 76 25 L 76 55 Q 76 62 50 65 Q 24 62 24 55 Z',
  }

  // Root shape
  const rootPaths: Record<string, string> = {
    incisor: upper
      ? 'M 38 60 Q 40 85 45 105 Q 48 112 50 115 Q 52 112 55 105 Q 60 85 62 60'
      : 'M 38 60 Q 40 80 45 95 Q 48 102 50 105 Q 52 102 55 95 Q 60 80 62 60',
    canine: upper
      ? 'M 36 60 Q 38 90 44 115 Q 48 125 50 128 Q 52 125 56 115 Q 62 90 64 60'
      : 'M 37 60 Q 39 85 44 110 Q 48 118 50 120 Q 52 118 56 110 Q 61 85 63 60',
    premolar: upper
      ? 'M 35 60 L 38 85 Q 40 95 42 100 L 42 60 M 58 60 L 58 100 Q 60 95 62 85 L 65 60'
      : 'M 36 60 L 38 82 Q 40 92 44 98 L 44 60 M 56 60 L 56 98 Q 60 92 62 82 L 64 60',
    molar: upper
      ? 'M 28 60 L 30 80 Q 32 92 35 100 L 35 60 M 48 60 L 48 95 Q 50 100 52 95 L 52 60 M 65 60 L 65 100 Q 68 92 70 80 L 72 60'
      : 'M 30 60 L 32 78 Q 34 88 37 95 L 37 60 M 50 60 L 50 90 Q 52 95 54 90 L 54 60 M 63 60 L 63 95 Q 66 88 68 78 L 70 60',
  }

  return (
    <svg viewBox="0 0 100 130" className="w-full h-full" style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.08))' }}>
      <defs>
        <linearGradient id={`crown-grad-${animKey}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fef9c3" />
          <stop offset="100%" stopColor="#fde68a" />
        </linearGradient>
        <linearGradient id={`root-grad-${animKey}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fde68a" />
          <stop offset="100%" stopColor="#fbbf24" />
        </linearGradient>
      </defs>

      {/* Root */}
      <g className="animate-fade-in" style={{ animationDelay: '0.1s' }}>
        <path
          d={rootPaths[toothType]}
          fill={`url(#root-grad-${animKey})`}
          stroke="#d97706"
          strokeWidth="0.8"
          opacity="0.8"
        />
      </g>

      {/* Crown - buccal surface clickable */}
      <g
        className="cursor-pointer transition-all duration-200"
        onClick={() => onSurfaceClick?.('B')}
      >
        <path
          d={crownPaths[toothType]}
          fill={isBuccalSelected ? SURFACE_COLORS.B.active : `url(#crown-grad-${animKey})`}
          stroke="#b45309"
          strokeWidth="1"
          className="transition-all duration-200 hover:brightness-95"
        />
        {/* Crown detail lines */}
        {(toothType === 'molar' || toothType === 'premolar') && (
          <>
            <line x1="50" y1="8" x2="50" y2="20" stroke="#d97706" strokeWidth="0.5" opacity="0.4" />
            {toothType === 'molar' && <line x1="38" y1="10" x2="38" y2="22" stroke="#d97706" strokeWidth="0.4" opacity="0.3" />}
            {toothType === 'molar' && <line x1="62" y1="10" x2="62" y2="22" stroke="#d97706" strokeWidth="0.4" opacity="0.3" />}
          </>
        )}
      </g>

      {/* Mesial side indicator */}
      <g className="cursor-pointer" onClick={() => onSurfaceClick?.('M')}>
        <rect
          x="18" y="25" width="8" height="35" rx="2"
          fill={isMessSelected ? SURFACE_COLORS.M.active : 'transparent'}
          stroke={isMessSelected ? SURFACE_COLORS.M.active : '#d1d5db'}
          strokeWidth="0.5"
          strokeDasharray={isMessSelected ? '' : '2 2'}
          opacity="0.6"
          className="transition-all duration-200"
        />
      </g>

      {/* Distal side indicator */}
      <g className="cursor-pointer" onClick={() => onSurfaceClick?.('D')}>
        <rect
          x="74" y="25" width="8" height="35" rx="2"
          fill={isDistSelected ? SURFACE_COLORS.D.active : 'transparent'}
          stroke={isDistSelected ? SURFACE_COLORS.D.active : '#d1d5db'}
          strokeWidth="0.5"
          strokeDasharray={isDistSelected ? '' : '2 2'}
          opacity="0.6"
          className="transition-all duration-200"
        />
      </g>

      <text x="50" y="128" textAnchor="middle" className="fill-gray-400 text-[7px]" fontFamily="sans-serif">Buccal</text>
    </svg>
  )
}

/** Occlusal (top-down) view SVG */
function OcclusalView({ toothType, selectedSurfaces, onSurfaceClick, animKey }: {
  toothType: 'incisor' | 'canine' | 'premolar' | 'molar'
  selectedSurfaces: string[]
  onSurfaceClick?: (s: string) => void
  animKey: string
}) {
  const isOccSelected = selectedSurfaces.includes('O')
  const isBuccalSelected = selectedSurfaces.includes('B')
  const isLingSelected = selectedSurfaces.includes('L') || selectedSurfaces.includes('P')
  const isMessSelected = selectedSurfaces.includes('M')
  const isDistSelected = selectedSurfaces.includes('D')

  // Occlusal view outlines
  const outerPaths: Record<string, string> = {
    incisor: 'M 20 30 Q 20 15 50 12 Q 80 15 80 30 L 80 70 Q 80 85 50 88 Q 20 85 20 70 Z',
    canine: 'M 22 28 Q 22 12 50 8 Q 78 12 78 28 L 78 72 Q 78 88 50 92 Q 22 88 22 72 Z',
    premolar: 'M 18 25 Q 18 10 50 5 Q 82 10 82 25 L 82 75 Q 82 90 50 95 Q 18 90 18 75 Z',
    molar: 'M 12 22 Q 12 8 50 3 Q 88 8 88 22 L 88 78 Q 88 92 50 97 Q 12 92 12 78 Z',
  }

  const innerPaths: Record<string, string> = {
    incisor: 'M 35 42 Q 35 38 50 36 Q 65 38 65 42 L 65 58 Q 65 62 50 64 Q 35 62 35 58 Z',
    canine: 'M 36 40 Q 36 35 50 33 Q 64 35 64 40 L 64 60 Q 64 65 50 67 Q 36 65 36 60 Z',
    premolar: 'M 32 38 Q 32 30 50 27 Q 68 30 68 38 L 68 62 Q 68 70 50 73 Q 32 70 32 62 Z',
    molar: 'M 28 34 Q 28 24 50 20 Q 72 24 72 34 L 72 66 Q 72 76 50 80 Q 28 76 28 66 Z',
  }

  return (
    <svg viewBox="0 0 100 100" className="w-full h-full" style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.08))' }}>
      <defs>
        <radialGradient id={`occ-grad-${animKey}`} cx="50%" cy="40%" r="60%">
          <stop offset="0%" stopColor="#fef9c3" />
          <stop offset="100%" stopColor="#fde68a" />
        </radialGradient>
      </defs>

      {/* Buccal region (top) */}
      <g className="cursor-pointer" onClick={() => onSurfaceClick?.('B')}>
        <path
          d={`M 20 12 Q 50 5 80 12 L 70 35 Q 50 30 30 35 Z`}
          fill={isBuccalSelected ? SURFACE_COLORS.B.active : '#fef3c7'}
          stroke="#b45309" strokeWidth="0.8"
          className="transition-all duration-200 hover:brightness-90"
          opacity="0.85"
        />
      </g>

      {/* Lingual/Palatal region (bottom) */}
      <g className="cursor-pointer" onClick={() => onSurfaceClick?.('L')}>
        <path
          d={`M 20 88 Q 50 95 80 88 L 70 65 Q 50 70 30 65 Z`}
          fill={isLingSelected ? SURFACE_COLORS.L.active : '#fef3c7'}
          stroke="#b45309" strokeWidth="0.8"
          className="transition-all duration-200 hover:brightness-90"
          opacity="0.85"
        />
      </g>

      {/* Mesial region (left) */}
      <g className="cursor-pointer" onClick={() => onSurfaceClick?.('M')}>
        <path
          d={`M 12 20 Q 8 50 12 80 L 30 65 Q 25 50 30 35 Z`}
          fill={isMessSelected ? SURFACE_COLORS.M.active : '#fef3c7'}
          stroke="#b45309" strokeWidth="0.8"
          className="transition-all duration-200 hover:brightness-90"
          opacity="0.85"
        />
      </g>

      {/* Distal region (right) */}
      <g className="cursor-pointer" onClick={() => onSurfaceClick?.('D')}>
        <path
          d={`M 88 20 Q 92 50 88 80 L 70 65 Q 75 50 70 35 Z`}
          fill={isDistSelected ? SURFACE_COLORS.D.active : '#fef3c7'}
          stroke="#b45309" strokeWidth="0.8"
          className="transition-all duration-200 hover:brightness-90"
          opacity="0.85"
        />
      </g>

      {/* Occlusal center */}
      <g className="cursor-pointer" onClick={() => onSurfaceClick?.('O')}>
        <path
          d={innerPaths[toothType]}
          fill={isOccSelected ? SURFACE_COLORS.O.active : `url(#occ-grad-${animKey})`}
          stroke="#b45309" strokeWidth="1"
          className="transition-all duration-200 hover:brightness-90"
        />
        {/* Fissure details for molars/premolars */}
        {(toothType === 'molar' || toothType === 'premolar') && (
          <>
            <line x1="40" y1="42" x2="50" y2="50" stroke="#d97706" strokeWidth="0.5" opacity="0.4" />
            <line x1="50" y1="50" x2="60" y2="42" stroke="#d97706" strokeWidth="0.5" opacity="0.4" />
            <line x1="50" y1="50" x2="50" y2="65" stroke="#d97706" strokeWidth="0.5" opacity="0.4" />
          </>
        )}
      </g>

      {/* Surface labels */}
      <text x="50" y="9" textAnchor="middle" className="fill-gray-400 text-[6px]" fontFamily="sans-serif">B</text>
      <text x="50" y="99" textAnchor="middle" className="fill-gray-400 text-[6px]" fontFamily="sans-serif">L</text>
      <text x="4" y="52" textAnchor="middle" className="fill-gray-400 text-[6px]" fontFamily="sans-serif">M</text>
      <text x="96" y="52" textAnchor="middle" className="fill-gray-400 text-[6px]" fontFamily="sans-serif">D</text>
    </svg>
  )
}

/** Lingual/palatal (back) view SVG */
function LingualView({ toothType, upper, selectedSurfaces, onSurfaceClick, animKey }: {
  toothType: 'incisor' | 'canine' | 'premolar' | 'molar'
  upper: boolean
  selectedSurfaces: string[]
  onSurfaceClick?: (s: string) => void
  animKey: string
}) {
  const isLingSelected = selectedSurfaces.includes('L') || selectedSurfaces.includes('P')

  const crownPaths: Record<string, string> = {
    incisor: 'M 32 20 Q 32 8 50 5 Q 68 8 68 20 L 70 55 Q 70 60 50 62 Q 30 60 30 55 Z',
    canine: 'M 34 18 Q 40 5 50 3 Q 60 5 66 18 L 68 55 Q 68 60 50 62 Q 32 60 32 55 Z',
    premolar: 'M 30 22 Q 30 8 50 5 Q 70 8 70 22 L 72 55 Q 72 60 50 62 Q 28 60 28 55 Z',
    molar: 'M 24 28 Q 24 10 50 5 Q 76 10 76 28 L 78 55 Q 78 60 50 62 Q 22 60 22 55 Z',
  }

  const rootPaths: Record<string, string> = {
    incisor: 'M 38 60 Q 42 90 48 110 Q 50 115 52 110 Q 58 90 62 60',
    canine: 'M 37 60 Q 40 95 47 120 Q 50 125 53 120 Q 60 95 63 60',
    premolar: 'M 35 60 L 38 90 Q 42 100 44 60 M 56 60 Q 58 100 62 90 L 65 60',
    molar: 'M 28 60 L 32 85 Q 35 95 37 60 M 48 60 Q 50 98 52 60 M 63 60 Q 65 95 68 85 L 72 60',
  }

  return (
    <svg viewBox="0 0 100 130" className="w-full h-full" style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.08))' }}>
      <defs>
        <linearGradient id={`ling-grad-${animKey}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fef3c7" />
          <stop offset="100%" stopColor="#fcd34d" />
        </linearGradient>
      </defs>

      {/* Root */}
      <path
        d={rootPaths[toothType]}
        fill="#fde68a"
        stroke="#d97706"
        strokeWidth="0.8"
        opacity="0.7"
      />

      {/* Crown - lingual surface */}
      <g className="cursor-pointer" onClick={() => onSurfaceClick?.(upper ? 'P' : 'L')}>
        <path
          d={crownPaths[toothType]}
          fill={isLingSelected ? SURFACE_COLORS.L.active : `url(#ling-grad-${animKey})`}
          stroke="#b45309"
          strokeWidth="1"
          className="transition-all duration-200 hover:brightness-95"
        />
        {/* Cingulum detail for anterior teeth */}
        {(toothType === 'incisor' || toothType === 'canine') && (
          <ellipse cx="50" cy="45" rx="12" ry="8" fill="none" stroke="#d97706" strokeWidth="0.5" opacity="0.3" />
        )}
      </g>

      <text x="50" y="128" textAnchor="middle" className="fill-gray-400 text-[7px]" fontFamily="sans-serif">{upper ? 'Palatal' : 'Lingual'}</text>
    </svg>
  )
}

/** Main component: 3 tooth anatomy views with animation */
export default function ToothAnatomyViews({ toothNumber, selectedSurfaces = [], onSurfaceClick }: ToothAnatomyViewsProps) {
  const [visible, setVisible] = useState(false)
  const [prevTooth, setPrevTooth] = useState<number | null>(null)

  useEffect(() => {
    if (toothNumber !== prevTooth) {
      setVisible(false)
      const timer = setTimeout(() => {
        setPrevTooth(toothNumber)
        setVisible(true)
      }, 150)
      return () => clearTimeout(timer)
    }
  }, [toothNumber, prevTooth])

  if (!toothNumber) return null

  const toothType = getToothType(toothNumber)
  const upper = isUpper(toothNumber)
  const animKey = `t${toothNumber}`

  return (
    <div
      className={`flex flex-col gap-2 transition-all duration-300 ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
      }`}
    >
      {/* Buccal view */}
      <div className="bg-gray-50 rounded-lg p-2 border border-gray-100 hover:border-indigo-200 transition-colors">
        <div className="w-full aspect-[5/7]">
          <CrownView
            toothType={toothType}
            upper={upper}
            selectedSurfaces={selectedSurfaces}
            onSurfaceClick={onSurfaceClick}
            animKey={animKey}
          />
        </div>
      </div>

      {/* Occlusal view */}
      <div className="bg-gray-50 rounded-lg p-2 border border-gray-100 hover:border-indigo-200 transition-colors">
        <div className="w-full aspect-square">
          <OcclusalView
            toothType={toothType}
            selectedSurfaces={selectedSurfaces}
            onSurfaceClick={onSurfaceClick}
            animKey={animKey}
          />
        </div>
      </div>

      {/* Lingual/Palatal view */}
      <div className="bg-gray-50 rounded-lg p-2 border border-gray-100 hover:border-indigo-200 transition-colors">
        <div className="w-full aspect-[5/7]">
          <LingualView
            toothType={toothType}
            upper={upper}
            selectedSurfaces={selectedSurfaces}
            onSurfaceClick={onSurfaceClick}
            animKey={animKey}
          />
        </div>
      </div>
    </div>
  )
}

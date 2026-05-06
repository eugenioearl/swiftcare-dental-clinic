'use client'

/**
 * OCR Status Badge
 *
 * Tiny visual indicator used in document cards / dialog headers. Pure UI —
 * no API calls.
 */

import { Badge } from '@/components/ui/badge'
import { CheckCircle2, Loader2, AlertTriangle, Ban, ScanText } from 'lucide-react'
import { cn } from '@/lib/utils'

export type OcrBadgeStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'skipped'
  | null
  | undefined

export interface OcrStatusBadgeProps {
  status: OcrBadgeStatus
  confidence?: number | null
  className?: string
  size?: 'sm' | 'md'
}

export function OcrStatusBadge({ status, confidence, className, size = 'sm' }: OcrStatusBadgeProps) {
  if (!status) return null

  const sizeClasses = size === 'sm'
    ? 'text-[9px] px-1 py-0 h-4'
    : 'text-[11px] px-2 py-0.5'
  const iconClass = size === 'sm' ? 'w-2.5 h-2.5 mr-1' : 'w-3 h-3 mr-1'

  switch (status) {
    case 'processing':
      return (
        <Badge
          className={cn('bg-amber-100 text-amber-700 hover:bg-amber-100 border-amber-200', sizeClasses, className)}
          title="OCR in progress"
        >
          <Loader2 className={cn(iconClass, 'animate-spin')} /> OCR…
        </Badge>
      )
    case 'pending':
      return (
        <Badge
          className={cn('bg-gray-100 text-gray-600 hover:bg-gray-100 border-gray-200', sizeClasses, className)}
          title="OCR queued"
        >
          <ScanText className={iconClass} /> OCR
        </Badge>
      )
    case 'completed':
      return (
        <Badge
          className={cn('bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-emerald-200', sizeClasses, className)}
          title={typeof confidence === 'number' ? `OCR completed (${Math.round(confidence)}% confidence)` : 'OCR completed'}
        >
          <CheckCircle2 className={iconClass} /> OCR
          {typeof confidence === 'number' && (
            <span className="ml-1">{Math.round(confidence)}%</span>
          )}
        </Badge>
      )
    case 'failed':
      return (
        <Badge
          className={cn('bg-red-100 text-red-700 hover:bg-red-100 border-red-200', sizeClasses, className)}
          title="OCR failed"
        >
          <AlertTriangle className={iconClass} /> OCR failed
        </Badge>
      )
    case 'skipped':
      return (
        <Badge
          className={cn('bg-slate-100 text-slate-600 hover:bg-slate-100 border-slate-200', sizeClasses, className)}
          title="OCR not supported for this file type"
        >
          <Ban className={iconClass} /> OCR n/a
        </Badge>
      )
    default:
      return null
  }
}

export default OcrStatusBadge

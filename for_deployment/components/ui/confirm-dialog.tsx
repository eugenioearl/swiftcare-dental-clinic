'use client'

import * as React from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { AlertTriangle, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'

type Variant = 'destructive' | 'warning' | 'default'

interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void | Promise<void>
  title?: string
  description?: React.ReactNode
  confirmLabel?: string
  cancelLabel?: string
  variant?: Variant
  loading?: boolean
  /** Optional second-stage type-to-confirm text (e.g., "DELETE") */
  requireText?: string
}

/**
 * ConfirmDialog
 * Reusable confirmation dialog for destructive / important actions.
 * Use it as a controlled component in conjunction with state.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
  title = 'Are you sure?',
  description = 'This action cannot be undone.',
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'destructive',
  loading = false,
  requireText,
}: ConfirmDialogProps) {
  const [busy, setBusy] = React.useState(false)
  const [typed, setTyped] = React.useState('')

  const isBusy = busy || loading

  React.useEffect(() => {
    if (!open) setTyped('')
  }, [open])

  const Icon = variant === 'destructive' ? Trash2 : AlertTriangle
  const colorClasses =
    variant === 'destructive'
      ? 'bg-red-50 text-red-600'
      : variant === 'warning'
      ? 'bg-amber-50 text-amber-600'
      : 'bg-primary/10 text-primary'

  const buttonClasses =
    variant === 'destructive'
      ? 'bg-red-600 hover:bg-red-700 focus:ring-red-500 text-white'
      : variant === 'warning'
      ? 'bg-amber-600 hover:bg-amber-700 focus:ring-amber-500 text-white'
      : ''

  const handleConfirm = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault()
    if (requireText && typed.trim() !== requireText) return
    try {
      setBusy(true)
      await onConfirm()
      onOpenChange(false)
    } finally {
      setBusy(false)
    }
  }

  const confirmDisabled = isBusy || (requireText ? typed.trim() !== requireText : false)

  return (
    <AlertDialog open={open} onOpenChange={(v) => !isBusy && onOpenChange(v)}>
      <AlertDialogContent className="w-[95vw] sm:w-full max-w-md p-4 sm:p-6">
        <AlertDialogHeader>
          <div className="flex items-start gap-3">
            <div
              className={cn(
                'flex h-10 w-10 items-center justify-center rounded-full flex-shrink-0',
                colorClasses
              )}
            >
              <Icon className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0 text-left">
              <AlertDialogTitle className="text-base sm:text-lg">{title}</AlertDialogTitle>
              <AlertDialogDescription className="mt-1.5 text-sm break-words">
                {description}
              </AlertDialogDescription>
            </div>
          </div>
        </AlertDialogHeader>

        {requireText ? (
          <div className="space-y-2">
            <label className="text-xs font-medium text-gray-700">
              Type <span className="font-mono font-semibold">{requireText}</span> to confirm:
            </label>
            <input
              type="text"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              disabled={isBusy}
              className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
              placeholder={requireText}
              autoFocus
            />
          </div>
        ) : null}

        <AlertDialogFooter className="gap-2">
          <AlertDialogCancel disabled={isBusy} className="mt-0">
            {cancelLabel}
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={confirmDisabled}
            onClick={handleConfirm}
            className={cn(buttonClasses)}
          >
            {isBusy ? 'Processing…' : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

export default ConfirmDialog

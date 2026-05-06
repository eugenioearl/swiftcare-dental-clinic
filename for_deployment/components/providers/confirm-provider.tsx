'use client'

import * as React from 'react'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'

type ConfirmOptions = {
  title?: string
  description?: React.ReactNode
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'destructive' | 'warning' | 'default'
  requireText?: string
}

type ConfirmContextValue = {
  confirm: (options?: ConfirmOptions) => Promise<boolean>
}

const ConfirmContext = React.createContext<ConfirmContextValue | null>(null)

interface QueueItem extends ConfirmOptions {
  resolve: (value: boolean) => void
}

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false)
  const [current, setCurrent] = React.useState<QueueItem | null>(null)

  const confirm = React.useCallback((options?: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setCurrent({ ...(options || {}), resolve })
      setOpen(true)
    })
  }, [])

  const handleOpenChange = (next: boolean) => {
    setOpen(next)
    if (!next && current) {
      // Closed without confirming
      current.resolve(false)
      setCurrent(null)
    }
  }

  const handleConfirm = async () => {
    if (current) {
      current.resolve(true)
      setCurrent(null)
    }
  }

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      <ConfirmDialog
        open={open}
        onOpenChange={handleOpenChange}
        onConfirm={handleConfirm}
        title={current?.title}
        description={current?.description}
        confirmLabel={current?.confirmLabel}
        cancelLabel={current?.cancelLabel}
        variant={current?.variant}
        requireText={current?.requireText}
      />
    </ConfirmContext.Provider>
  )
}

export function useConfirm() {
  const ctx = React.useContext(ConfirmContext)
  if (!ctx) {
    // Fallback to native confirm if provider missing (should not happen).
    return {
      confirm: async (options?: ConfirmOptions) => {
        if (typeof window === 'undefined') return false
        const desc = typeof options?.description === 'string' ? options.description : ''
        return window.confirm(`${options?.title || 'Are you sure?'}\n\n${desc}`)
      },
    }
  }
  return ctx
}

export default ConfirmProvider

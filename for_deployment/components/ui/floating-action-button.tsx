
'use client'

import React, { useState } from 'react'
import { useBreakpoint } from '@/hooks/use-device-type'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Plus, X, Calendar, Users, CreditCard, Settings, Stethoscope } from 'lucide-react'

interface FABAction {
  icon: React.ElementType
  label: string
  onClick: () => void
  color?: string
}

interface FloatingActionButtonProps {
  actions?: FABAction[]
  className?: string
  mainIcon?: React.ElementType
  mainAction?: () => void
}

export function FloatingActionButton({ 
  actions = [],
  className,
  mainIcon: MainIcon = Plus,
  mainAction
}: FloatingActionButtonProps) {
  const { shouldShowFAB } = useBreakpoint()
  const [isExpanded, setIsExpanded] = useState(false)

  if (!shouldShowFAB) return null

  const handleMainClick = () => {
    if (actions.length > 0) {
      setIsExpanded(!isExpanded)
    } else if (mainAction) {
      mainAction()
    }
  }

  const defaultActions: FABAction[] = [
    {
      icon: Calendar,
      label: 'New Appointment',
      onClick: () => {
        window.location.href = '/patient/appointments/book'
        setIsExpanded(false)
      }
    },
    {
      icon: Users,
      label: 'Patients',
      onClick: () => {
        window.location.href = '/admin/patients'
        setIsExpanded(false)
      }
    },
    {
      icon: Stethoscope,
      label: 'Treatment',
      onClick: () => {
        window.location.href = '/admin/treatment'
        setIsExpanded(false)
      }
    },
  ]

  const currentActions = actions.length > 0 ? actions : defaultActions

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {/* Action Items */}
      {isExpanded && (
        <div className="mb-4 space-y-3">
          {currentActions.map((action, index) => {
            const Icon = action.icon
            return (
              <div
                key={index}
                className="flex items-center justify-end animate-in slide-in-from-bottom-2 duration-300"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <div className="bg-white text-primary-700 px-3 py-2 rounded-lg shadow-md mr-3 text-sm font-medium whitespace-nowrap">
                  {action.label}
                </div>
                <Button
                  onClick={action.onClick}
                  className={cn(
                    "w-12 h-12 rounded-full shadow-lg transition-all duration-300 hover:scale-110",
                    action.color || "bg-primary-500 hover:bg-primary-600"
                  )}
                >
                  <Icon className="w-5 h-5" />
                </Button>
              </div>
            )
          })}
        </div>
      )}

      {/* Main FAB */}
      <Button
        onClick={handleMainClick}
        className={cn(
          "fab",
          isExpanded && "rotate-45",
          className
        )}
      >
        {isExpanded ? (
          <X className="w-6 h-6" />
        ) : (
          <MainIcon className="w-6 h-6" />
        )}
      </Button>
    </div>
  )
}

interface ExtendedFABProps {
  icon: React.ElementType
  label: string
  onClick: () => void
  className?: string
}

export function ExtendedFAB({ 
  icon: Icon, 
  label, 
  onClick, 
  className 
}: ExtendedFABProps) {
  const { shouldShowFAB } = useBreakpoint()

  if (!shouldShowFAB) return null

  return (
    <Button
      onClick={onClick}
      className={cn(
        "fab fab-extended",
        className
      )}
    >
      <Icon className="w-5 h-5" />
      <span className="font-medium">{label}</span>
    </Button>
  )
}

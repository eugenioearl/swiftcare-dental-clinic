
'use client'

import React, { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

interface DentalIconProps {
  className?: string
  size?: number
  animation?: '3d' | 'rotate' | 'pulse' | 'none'
  pauseOnInteraction?: boolean
}

export function ToothIcon({ 
  className, 
  size = 24, 
  animation = '3d',
  pauseOnInteraction = true 
}: DentalIconProps) {
  const [isPaused, setIsPaused] = useState(false)

  useEffect(() => {
    if (!pauseOnInteraction) return

    const handleFormFocus = () => setIsPaused(true)
    const handleFormBlur = () => setIsPaused(false)

    document.addEventListener('focusin', handleFormFocus)
    document.addEventListener('focusout', handleFormBlur)

    return () => {
      document.removeEventListener('focusin', handleFormFocus)
      document.removeEventListener('focusout', handleFormBlur)
    }
  }, [pauseOnInteraction])

  const animationClass = {
    '3d': 'dental-icon-3d',
    'rotate': 'dental-icon-rotate',
    'pulse': 'dental-icon-pulse',
    'none': ''
  }[animation]

  return (
    <div className={cn(
      'inline-block',
      animationClass,
      isPaused && 'animate-none',
      className
    )}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="fill-current"
      >
        <path
          d="M12 2C10.5 2 9.5 3 9.5 4.5C9.5 5.5 9 6.5 8 7.5C7 8.5 6 9.5 6 11C6 13 7.5 15 9.5 16.5C10.5 17.5 11.5 18.5 11.5 20C11.5 21 12.5 22 13.5 22C14.5 22 15.5 21 15.5 20C15.5 18.5 16.5 17.5 17.5 16.5C19.5 15 21 13 21 11C21 9.5 20 8.5 19 7.5C18 6.5 17.5 5.5 17.5 4.5C17.5 3 16.5 2 15 2C14 2 13 2.5 12 2.5C11 2.5 12 2 12 2Z"
          fill="url(#toothGradient)"
        />
        <defs>
          <linearGradient id="toothGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--color-primary-400)" />
            <stop offset="100%" stopColor="var(--color-secondary-400)" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  )
}

export function BrushIcon({ 
  className, 
  size = 24, 
  animation = '3d',
  pauseOnInteraction = true 
}: DentalIconProps) {
  const [isPaused, setIsPaused] = useState(false)

  useEffect(() => {
    if (!pauseOnInteraction) return

    const handleFormFocus = () => setIsPaused(true)
    const handleFormBlur = () => setIsPaused(false)

    document.addEventListener('focusin', handleFormFocus)
    document.addEventListener('focusout', handleFormBlur)

    return () => {
      document.removeEventListener('focusin', handleFormFocus)
      document.removeEventListener('focusout', handleFormBlur)
    }
  }, [pauseOnInteraction])

  const animationClass = {
    '3d': 'dental-icon-3d',
    'rotate': 'dental-icon-rotate',
    'pulse': 'dental-icon-pulse',
    'none': ''
  }[animation]

  return (
    <div className={cn(
      'inline-block',
      animationClass,
      isPaused && 'animate-none',
      className
    )}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="fill-current"
      >
        <path
          d="M4.22 11.29L11.29 4.22C11.68 3.83 12.32 3.83 12.71 4.22L19.78 11.29C20.17 11.68 20.17 12.32 19.78 12.71L18.36 14.14C17.97 14.53 17.33 14.53 16.94 14.14L12 9.2L7.06 14.14C6.67 14.53 6.03 14.53 5.64 14.14L4.22 12.71C3.83 12.32 3.83 11.68 4.22 11.29Z"
          fill="url(#brushGradient)"
        />
        <rect x="10.5" y="14" width="3" height="8" rx="1.5" fill="url(#handleGradient)" />
        <defs>
          <linearGradient id="brushGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--color-secondary-400)" />
            <stop offset="100%" stopColor="var(--color-primary-400)" />
          </linearGradient>
          <linearGradient id="handleGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--color-neutral-300)" />
            <stop offset="100%" stopColor="var(--color-neutral-400)" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  )
}

export function SmileIcon({ 
  className, 
  size = 24, 
  animation = 'pulse',
  pauseOnInteraction = true 
}: DentalIconProps) {
  const [isPaused, setIsPaused] = useState(false)

  useEffect(() => {
    if (!pauseOnInteraction) return

    const handleFormFocus = () => setIsPaused(true)
    const handleFormBlur = () => setIsPaused(false)

    document.addEventListener('focusin', handleFormFocus)
    document.addEventListener('focusout', handleFormBlur)

    return () => {
      document.removeEventListener('focusin', handleFormFocus)
      document.removeEventListener('focusout', handleFormBlur)
    }
  }, [pauseOnInteraction])

  const animationClass = {
    '3d': 'dental-icon-3d',
    'rotate': 'dental-icon-rotate',
    'pulse': 'dental-icon-pulse',
    'none': ''
  }[animation]

  return (
    <div className={cn(
      'inline-block',
      animationClass,
      isPaused && 'animate-none',
      className
    )}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="fill-current"
      >
        <circle cx="12" cy="12" r="10" fill="url(#smileGradient)" />
        <circle cx="8.5" cy="9" r="1.5" fill="var(--color-primary-700)" />
        <circle cx="15.5" cy="9" r="1.5" fill="var(--color-primary-700)" />
        <path
          d="M7 14C8.5 17 10.5 17.5 12 17.5C13.5 17.5 15.5 17 17 14"
          stroke="var(--color-primary-700)"
          strokeWidth="2"
          strokeLinecap="round"
          fill="none"
        />
        <defs>
          <radialGradient id="smileGradient" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="var(--color-accent-warm)" />
            <stop offset="100%" stopColor="var(--color-primary-400)" />
          </radialGradient>
        </defs>
      </svg>
    </div>
  )
}

interface AnimatedBackgroundProps {
  children: React.ReactNode
  className?: string
  variant?: 'subtle' | 'prominent'
}

export function AnimatedBackground({ 
  children, 
  className, 
  variant = 'subtle' 
}: AnimatedBackgroundProps) {
  return (
    <div className={cn('relative overflow-hidden', className)}>
      {/* Floating dental elements */}
      <div className="absolute inset-0 pointer-events-none">
        {variant === 'prominent' && (
          <>
            <ToothIcon 
              className="absolute top-10 left-10 opacity-10" 
              size={40} 
              animation="3d" 
            />
            <BrushIcon 
              className="absolute top-32 right-20 opacity-10" 
              size={35} 
              animation="rotate" 
            />
            <SmileIcon 
              className="absolute bottom-20 left-32 opacity-10" 
              size={45} 
              animation="pulse" 
            />
            <ToothIcon 
              className="absolute bottom-10 right-10 opacity-10" 
              size={30} 
              animation="3d" 
            />
          </>
        )}
        {variant === 'subtle' && (
          <>
            <ToothIcon 
              className="absolute top-20 right-16 opacity-5" 
              size={25} 
              animation="3d" 
            />
            <SmileIcon 
              className="absolute bottom-32 left-20 opacity-5" 
              size={28} 
              animation="pulse" 
            />
          </>
        )}
      </div>
      <div className="relative z-10">
        {children}
      </div>
    </div>
  )
}

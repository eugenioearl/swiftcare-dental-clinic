
'use client'

import React from 'react'
import { useBreakpoint } from '@/hooks/use-device-type'
import { cn } from '@/lib/utils'

interface ResponsiveLayoutProps {
  children: React.ReactNode
  className?: string
}

export function ResponsiveLayout({ children, className }: ResponsiveLayoutProps) {
  const { shouldUseMobileLayout } = useBreakpoint()

  return (
    <div className={cn(
      'min-h-screen transition-all duration-300',
      shouldUseMobileLayout ? 'mobile-app-style' : 'desktop-layout',
      className
    )}>
      {children}
    </div>
  )
}

interface ResponsiveGridProps {
  children: React.ReactNode
  className?: string
  mobileColumns?: number
  tabletColumns?: number
  desktopColumns?: number
}

export function ResponsiveGrid({ 
  children, 
  className,
  mobileColumns = 1,
  tabletColumns = 2,
  desktopColumns = 3
}: ResponsiveGridProps) {
  const { type } = useBreakpoint()

  const getGridColumns = () => {
    switch (type) {
      case 'mobile':
        return `repeat(${mobileColumns}, 1fr)`
      case 'tablet':
        return `repeat(${tabletColumns}, 1fr)`
      case 'desktop':
        return `repeat(${desktopColumns}, 1fr)`
      default:
        return `repeat(${desktopColumns}, 1fr)`
    }
  }

  return (
    <div 
      className={cn('grid gap-4 transition-all duration-300', className)}
      style={{ gridTemplateColumns: getGridColumns() }}
    >
      {children}
    </div>
  )
}

interface ResponsiveCardProps {
  children: React.ReactNode
  className?: string
  hover?: boolean
  padding?: 'compact' | 'comfortable' | 'spacious'
}

export function ResponsiveCard({ 
  children, 
  className, 
  hover = true,
  padding = 'comfortable'
}: ResponsiveCardProps) {
  const { shouldUseMobileLayout } = useBreakpoint()

  return (
    <div className={cn(
      'card-modern transition-all duration-300',
      shouldUseMobileLayout ? 'mobile-card' : '',
      padding === 'compact' && 'card-compact',
      padding === 'comfortable' && 'card-comfortable',
      padding === 'spacious' && 'card-spacious',
      hover && 'hover:shadow-md hover:border-primary-300',
      className
    )}>
      {children}
    </div>
  )
}

interface ResponsiveTypographyProps {
  variant: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'body' | 'caption'
  children: React.ReactNode
  className?: string
  responsive?: boolean
}

export function ResponsiveTypography({ 
  variant, 
  children, 
  className, 
  responsive = true 
}: ResponsiveTypographyProps) {
  const { isMobile } = useBreakpoint()

  const getClasses = () => {
    const baseClasses = {
      h1: responsive ? 'responsive-text-xl font-bold leading-tight' : 'text-4xl font-bold leading-tight',
      h2: responsive ? 'responsive-text-lg font-semibold leading-tight' : 'text-3xl font-semibold leading-tight',
      h3: responsive ? 'responsive-text-base font-semibold leading-normal' : 'text-2xl font-semibold leading-normal',
      h4: responsive ? 'responsive-text-sm font-medium leading-normal' : 'text-xl font-medium leading-normal',
      h5: responsive ? 'responsive-text-sm font-medium leading-normal' : 'text-lg font-medium leading-normal',
      h6: responsive ? 'responsive-text-xs font-medium leading-normal' : 'text-base font-medium leading-normal',
      body: responsive ? 'responsive-text-sm leading-relaxed' : 'text-base leading-relaxed',
      caption: responsive ? 'responsive-text-xs leading-normal text-muted' : 'text-sm leading-normal text-muted'
    }

    return baseClasses[variant]
  }

  const Component = variant.startsWith('h') ? variant as keyof JSX.IntrinsicElements : 'p'

  return (
    <Component className={cn(
      getClasses(),
      isMobile && 'text-primary-800',
      className
    )}>
      {children}
    </Component>
  )
}

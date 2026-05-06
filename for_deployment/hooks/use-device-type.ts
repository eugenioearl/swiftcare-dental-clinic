
'use client'

import { useState, useEffect } from 'react'

export type DeviceType = 'mobile' | 'tablet' | 'desktop'

export interface DeviceInfo {
  type: DeviceType
  isMobile: boolean
  isTablet: boolean
  isDesktop: boolean
  width: number
  height: number
  isTouchDevice: boolean
}

export function useDeviceType(): DeviceInfo {
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo>({
    type: 'desktop',
    isMobile: false,
    isTablet: false,
    isDesktop: true,
    width: 1024,
    height: 768,
    isTouchDevice: false
  })

  useEffect(() => {
    const updateDeviceInfo = () => {
      const width = window.innerWidth
      const height = window.innerHeight
      const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0

      let type: DeviceType = 'desktop'
      if (width <= 768) {
        type = 'mobile'
      } else if (width <= 1024) {
        type = 'tablet'
      }

      setDeviceInfo({
        type,
        isMobile: type === 'mobile',
        isTablet: type === 'tablet',
        isDesktop: type === 'desktop',
        width,
        height,
        isTouchDevice
      })
    }

    // Initial check
    updateDeviceInfo()

    // Listen for resize events
    window.addEventListener('resize', updateDeviceInfo)

    return () => window.removeEventListener('resize', updateDeviceInfo)
  }, [])

  return deviceInfo
}

export function useBreakpoint() {
  const device = useDeviceType()
  
  return {
    ...device,
    // Utility methods
    isSmallScreen: device.isMobile,
    isMediumScreen: device.isTablet,
    isLargeScreen: device.isDesktop,
    shouldShowSidebar: device.isDesktop,
    shouldShowFAB: device.isMobile || device.isTablet,
    shouldUseMobileLayout: device.isMobile || device.isTablet,
    cardColumns: device.isMobile ? 1 : device.isTablet ? 2 : 3,
    gridGap: device.isMobile ? '12px' : device.isTablet ? '16px' : '24px'
  }
}

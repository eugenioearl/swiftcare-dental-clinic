'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Image from 'next/image'
import { X, ZoomIn, ZoomOut, RotateCcw, Download, Maximize2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ImageLightboxProps {
  src: string | null
  alt?: string
  open: boolean
  onClose: () => void
  downloadable?: boolean
}

/**
 * Full-screen image viewer with zoom in/out (wheel + buttons), pan (drag), and reset.
 * Designed for text-heavy images like clinic posters and schedules.
 */
export function ImageLightbox({ src, alt = 'Image', open, onClose, downloadable = true }: ImageLightboxProps) {
  const [scale, setScale] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [dragging, setDragging] = useState(false)
  const dragStart = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const reset = useCallback(() => {
    setScale(1)
    setOffset({ x: 0, y: 0 })
  }, [])

  // Reset when opened/closed
  useEffect(() => {
    if (open) reset()
  }, [open, reset])

  // Close on Escape, zoom with + / -
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === '+' || e.key === '=') setScale((s) => Math.min(s + 0.25, 5))
      if (e.key === '-' || e.key === '_') setScale((s) => Math.max(s - 0.25, 0.5))
      if (e.key === '0') reset()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose, reset])

  const zoomIn = () => setScale((s) => Math.min(s + 0.25, 5))
  const zoomOut = () => setScale((s) => Math.max(s - 0.25, 0.5))

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? -0.15 : 0.15
    setScale((s) => Math.min(Math.max(s + delta, 0.5), 5))
  }

  const onMouseDown = (e: React.MouseEvent) => {
    if (scale <= 1) return
    setDragging(true)
    dragStart.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y }
  }
  const onMouseMove = (e: React.MouseEvent) => {
    if (!dragging || !dragStart.current) return
    const dx = e.clientX - dragStart.current.x
    const dy = e.clientY - dragStart.current.y
    setOffset({ x: dragStart.current.ox + dx, y: dragStart.current.oy + dy })
  }
  const onMouseUp = () => {
    setDragging(false)
    dragStart.current = null
  }

  // Touch support
  const touchStartRef = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null)
  const lastTouchDistRef = useRef<number | null>(null)

  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1 && scale > 1) {
      touchStartRef.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
        ox: offset.x,
        oy: offset.y,
      }
    } else if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX
      const dy = e.touches[0].clientY - e.touches[1].clientY
      lastTouchDistRef.current = Math.hypot(dx, dy)
    }
  }

  const onTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 1 && touchStartRef.current) {
      const dx = e.touches[0].clientX - touchStartRef.current.x
      const dy = e.touches[0].clientY - touchStartRef.current.y
      setOffset({ x: touchStartRef.current.ox + dx, y: touchStartRef.current.oy + dy })
    } else if (e.touches.length === 2 && lastTouchDistRef.current !== null) {
      const dx = e.touches[0].clientX - e.touches[1].clientX
      const dy = e.touches[0].clientY - e.touches[1].clientY
      const dist = Math.hypot(dx, dy)
      const delta = (dist - lastTouchDistRef.current) / 200
      setScale((s) => Math.min(Math.max(s + delta, 0.5), 5))
      lastTouchDistRef.current = dist
    }
  }
  const onTouchEnd = () => {
    touchStartRef.current = null
    lastTouchDistRef.current = null
  }

  const handleDownload = () => {
    if (!src) return
    const a = document.createElement('a')
    a.href = src
    a.download = alt.replace(/[^a-z0-9]/gi, '_') + '.jpg'
    a.target = '_blank'
    a.rel = 'noopener'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  if (!open || !src) return null

  return (
    <div
      className="fixed inset-0 z-[9999] bg-black/95 flex items-center justify-center overscroll-contain"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      {/* Control bar */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between p-3 bg-gradient-to-b from-black/70 to-transparent">
        <div className="text-white text-sm font-medium truncate max-w-[50vw] opacity-80">{alt}</div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="text-white hover:bg-white/20"
            onClick={zoomOut}
            title="Zoom out (-)"
          >
            <ZoomOut className="w-5 h-5" />
          </Button>
          <span className="text-white text-sm min-w-[3.5rem] text-center font-mono">
            {Math.round(scale * 100)}%
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="text-white hover:bg-white/20"
            onClick={zoomIn}
            title="Zoom in (+)"
          >
            <ZoomIn className="w-5 h-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="text-white hover:bg-white/20"
            onClick={reset}
            title="Reset (0)"
          >
            <RotateCcw className="w-5 h-5" />
          </Button>
          {downloadable && (
            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/20"
              onClick={handleDownload}
              title="Download"
            >
              <Download className="w-5 h-5" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="text-white hover:bg-white/20"
            onClick={onClose}
            title="Close (Esc)"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>
      </div>

      {/* Image stage */}
      <div
        ref={containerRef}
        className="w-full h-full overflow-auto flex items-center justify-center"
        onWheel={onWheel}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        style={{
          cursor: scale > 1 ? (dragging ? 'grabbing' : 'grab') : 'default',
          userSelect: 'none',
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt}
          draggable={false}
          style={{
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
            transformOrigin: 'center center',
            transition: dragging ? 'none' : 'transform 0.15s ease-out',
            maxWidth: '90vw',
            maxHeight: '85vh',
            objectFit: 'contain',
            pointerEvents: 'none',
          }}
        />
      </div>

      {/* Hint */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/60 text-xs hidden sm:block">
        Scroll to zoom · Drag to pan · Esc to close
      </div>
    </div>
  )
}

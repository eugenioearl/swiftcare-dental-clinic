'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import {
  AlertCircle, Info, CheckCircle, AlertTriangle, X, Pin, Maximize2,
} from 'lucide-react'
import { ImageLightbox } from '@/components/ui/image-lightbox'

interface Announcement {
  id: string
  title: string
  subtitle?: string | null
  content: string
  calloutText?: string | null
  imageUrl?: string | null
  type: string
  displayMode?: string | null
  isPinned: boolean
  createdAt: string
}

const TYPE_CONFIG: Record<string, { bg: string; border: string; icon: any; text: string; subText: string }> = {
  info: { bg: 'bg-blue-50', border: 'border-blue-200', icon: Info, text: 'text-blue-800', subText: 'text-blue-700' },
  warning: { bg: 'bg-amber-50', border: 'border-amber-200', icon: AlertTriangle, text: 'text-amber-800', subText: 'text-amber-700' },
  success: { bg: 'bg-emerald-50', border: 'border-emerald-200', icon: CheckCircle, text: 'text-emerald-800', subText: 'text-emerald-700' },
  urgent: { bg: 'bg-red-50', border: 'border-red-200', icon: AlertCircle, text: 'text-red-800', subText: 'text-red-700' },
}

export function AnnouncementBanner({ placement }: { placement: string }) {
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())
  const [lightbox, setLightbox] = useState<{ src: string; alt: string } | null>(null)

  useEffect(() => {
    fetch(`/api/announcements?placement=${placement}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.success && d.data) setAnnouncements(d.data)
      })
      .catch(() => {})
  }, [placement])

  const visible = announcements.filter((a) => !dismissed.has(a.id))
  if (visible.length === 0) return null

  return (
    <>
      <div className="space-y-2 mb-4">
        {visible.map((a) => {
          const cfg = TYPE_CONFIG[a.type] || TYPE_CONFIG.info
          const Icon = cfg.icon
          const hasImage = !!a.imageUrl
          const mode = (a.displayMode || 'standard').toLowerCase()
          const isBanner = hasImage && mode === 'banner'
          const isTextOnly = mode === 'text_only' || !hasImage

          // ═══ Banner Mode: full-width image, then text below ═══
          if (isBanner) {
            return (
              <div
                key={a.id}
                className={`${cfg.bg} ${cfg.border} border rounded-lg overflow-hidden relative shadow-sm`}
              >
                <button
                  type="button"
                  onClick={() => setLightbox({ src: a.imageUrl!, alt: a.title })}
                  className="block w-full relative group focus:outline-none bg-white/40"
                  title="Click to expand"
                  aria-label={`Open ${a.title} image in full view`}
                  style={{ minHeight: '120px' }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={a.imageUrl!}
                    alt={a.title}
                    loading="lazy"
                    className="w-full h-auto object-contain bg-white/40 max-h-[600px] block"
                    onError={(e) => {
                      // Refetch announcement list to get a fresh signed URL if expired
                      const img = e.currentTarget
                      if (!img.dataset.retried) {
                        img.dataset.retried = '1'
                        fetch(`/api/announcements?placement=${placement}`, { cache: 'no-store' })
                          .then((r) => r.json())
                          .then((d) => {
                            if (d.success && d.data) {
                              const fresh = d.data.find((x: Announcement) => x.id === a.id)
                              if (fresh?.imageUrl) {
                                img.src = fresh.imageUrl
                                setAnnouncements(d.data)
                              }
                            }
                          })
                          .catch(() => {})
                      }
                    }}
                  />
                  {/* Click-to-expand overlay hint */}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors pointer-events-none" />
                  <div className="absolute bottom-3 right-3 flex items-center gap-1 px-2 py-1 rounded-md bg-black/60 text-white text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm">
                    <Maximize2 className="w-3 h-3" />
                    <span>Click to enlarge</span>
                  </div>
                  {/* Callout badge (overlay) */}
                  {a.calloutText && (
                    <div className="absolute top-3 right-3">
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold text-white bg-gradient-to-r from-red-500 to-pink-500 shadow-lg uppercase tracking-wide">
                        {a.calloutText}
                      </span>
                    </div>
                  )}
                  {a.isPinned && (
                    <div className="absolute top-3 left-3">
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold bg-white/90 text-gray-800 shadow">
                        <Pin className="w-3 h-3" /> PINNED
                      </span>
                    </div>
                  )}
                </button>
                <div className="p-3 flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Icon className={`w-4 h-4 ${cfg.text}`} />
                      <p className={`font-semibold text-sm ${cfg.text}`}>{a.title}</p>
                    </div>
                    {a.subtitle && (
                      <p className={`text-xs font-medium ${cfg.subText} opacity-90 mt-0.5`}>{a.subtitle}</p>
                    )}
                    {a.content && (
                      <p className={`text-sm ${cfg.text} opacity-80 mt-1 whitespace-pre-line`}>{a.content}</p>
                    )}
                  </div>
                  <button
                    onClick={() => setDismissed((prev) => new Set(prev).add(a.id))}
                    className={`${cfg.text} opacity-50 hover:opacity-100 p-1 flex-shrink-0`}
                    aria-label="Dismiss announcement"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )
          }

          // ═══ Text-only Mode ═══
          if (isTextOnly) {
            return (
              <div
                key={a.id}
                className={`${cfg.bg} ${cfg.border} border rounded-lg overflow-hidden relative`}
              >
                <div className="flex items-start gap-3 p-3">
                  <Icon className={`w-5 h-5 mt-0.5 flex-shrink-0 ${cfg.text}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className={`font-semibold text-sm ${cfg.text}`}>{a.title}</p>
                      {a.calloutText && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold text-white bg-gradient-to-r from-red-500 to-pink-500 uppercase tracking-wide">
                          {a.calloutText}
                        </span>
                      )}
                      {a.isPinned && <Pin className={`w-3 h-3 ${cfg.text} opacity-60`} />}
                    </div>
                    {a.subtitle && <p className={`text-xs font-medium ${cfg.subText} opacity-90 mt-0.5`}>{a.subtitle}</p>}
                    <p className={`text-sm ${cfg.text} opacity-80 mt-0.5 whitespace-pre-line`}>{a.content}</p>
                  </div>
                  <button
                    onClick={() => setDismissed((prev) => new Set(prev).add(a.id))}
                    className={`${cfg.text} opacity-50 hover:opacity-100 p-1 flex-shrink-0`}
                    aria-label="Dismiss announcement"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )
          }

          // ═══ Standard Mode: small thumbnail + text side-by-side ═══
          return (
            <div
              key={a.id}
              className={`${cfg.bg} ${cfg.border} border rounded-lg overflow-hidden relative`}
            >
              <div className="flex items-start gap-3 p-3">
                <button
                  type="button"
                  onClick={() => setLightbox({ src: a.imageUrl!, alt: a.title })}
                  className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-lg overflow-hidden flex-shrink-0 bg-white/40 group focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-teal-500"
                  title="Click to enlarge"
                  aria-label={`Open ${a.title} image in full view`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={a.imageUrl!}
                    alt={a.title}
                    className="absolute inset-0 w-full h-full object-cover"
                    onError={(e) => {
                      const img = e.currentTarget
                      if (!img.dataset.retried) {
                        img.dataset.retried = '1'
                        fetch(`/api/announcements?placement=${placement}`, { cache: 'no-store' })
                          .then((r) => r.json())
                          .then((d) => {
                            if (d.success && d.data) {
                              const fresh = d.data.find((x: Announcement) => x.id === a.id)
                              if (fresh?.imageUrl) {
                                img.src = fresh.imageUrl
                                setAnnouncements(d.data)
                              }
                            }
                          })
                          .catch(() => {})
                      }
                    }}
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                    <Maximize2 className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className={`font-semibold text-sm ${cfg.text}`}>{a.title}</p>
                    {a.calloutText && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold text-white bg-gradient-to-r from-red-500 to-pink-500 uppercase tracking-wide">
                        {a.calloutText}
                      </span>
                    )}
                    {a.isPinned && <Pin className={`w-3 h-3 ${cfg.text} opacity-60`} />}
                  </div>
                  {a.subtitle && <p className={`text-xs font-medium ${cfg.subText} opacity-90 mt-0.5`}>{a.subtitle}</p>}
                  <p className={`text-sm ${cfg.text} opacity-80 mt-0.5 whitespace-pre-line`}>{a.content}</p>
                </div>
                <button
                  onClick={() => setDismissed((prev) => new Set(prev).add(a.id))}
                  className={`${cfg.text} opacity-50 hover:opacity-100 p-1 flex-shrink-0`}
                  aria-label="Dismiss announcement"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )
        })}
      </div>

      <ImageLightbox
        src={lightbox?.src || null}
        alt={lightbox?.alt || ''}
        open={!!lightbox}
        onClose={() => setLightbox(null)}
      />
    </>
  )
}

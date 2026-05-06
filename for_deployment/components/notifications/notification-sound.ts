/**
 * Notification sound player — Microsoft-Teams-style notification chime.
 *
 * Plays MP3 sound files from /public/sounds:
 *   - /sounds/notification.mp3         — soft Teams-like chime for most priorities
 *   - /sounds/notification-urgent.mp3  — urgent alarm tone for emergency/urgent priorities
 *
 * Uses preloaded HTMLAudioElement objects (created lazily after the first user
 * gesture on the page). Browsers that block autoplay simply no-op — we never
 * throw. Mute preference is persisted in localStorage.
 *
 * Audio-unlock behaviour: Browsers such as Chrome, Firefox, Safari block audio
 * playback until the user has interacted with the page. We attach a one-shot
 * capture listener that performs a silent play+pause on both audio files on the
 * first pointer/keyboard gesture. Once unlocked, subsequent plays work without
 * requiring further interaction.
 */

export type SoundPriority =
  | 'low'
  | 'normal'
  | 'important'
  | 'high'
  | 'urgent'
  | 'emergency'

const SOUND_SRC_DEFAULT = '/sounds/notification.mp3'
const SOUND_SRC_URGENT = '/sounds/notification-urgent.mp3'

const MUTE_KEY = 'swiftcare.notifications.muted'
export const MUTE_EVENT = 'swiftcare:notifications:mute-changed'

let defaultAudio: HTMLAudioElement | null = null
let urgentAudio: HTMLAudioElement | null = null
let audioUnlocked = false
let unlockAttached = false
let sharedAudioContext: AudioContext | null = null

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  try {
    if (sharedAudioContext) return sharedAudioContext
    const AC: typeof AudioContext | undefined =
      (window as any).AudioContext || (window as any).webkitAudioContext
    if (!AC) return null
    sharedAudioContext = new AC()
    return sharedAudioContext
  } catch {
    return null
  }
}

/**
 * Web Audio fallback — synthesizes a bell-like chime without needing an MP3.
 * Used when HTMLAudioElement.play() fails (e.g., MP3 decode error, autoplay
 * policy) so the user still hears a notification.
 */
function synthesizeChime(urgency: 'default' | 'urgent'): void {
  const ctx = getAudioContext()
  if (!ctx) return
  try {
    if (ctx.state === 'suspended') {
      // Try to resume — will succeed only on/after user gesture.
      ctx.resume().catch(() => {})
    }
    const now = ctx.currentTime
    const freqs = urgency === 'urgent' ? [880, 1046.5, 880] : [880, 1318.5]
    const gap = urgency === 'urgent' ? 0.2 : 0.2
    const duration = urgency === 'urgent' ? 0.14 : 0.55
    const vol = urgency === 'urgent' ? 0.45 : 0.3

    freqs.forEach((f, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = f
      const startTime = now + i * gap
      gain.gain.setValueAtTime(0, startTime)
      gain.gain.linearRampToValueAtTime(vol, startTime + 0.01)
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(startTime)
      osc.stop(startTime + duration + 0.02)
    })
  } catch {
    // ignore
  }
}

function getAudio(src: string, volume: number): HTMLAudioElement | null {
  if (typeof window === 'undefined') return null
  try {
    const isDefault = src === SOUND_SRC_DEFAULT
    const existing = isDefault ? defaultAudio : urgentAudio
    if (existing) {
      existing.volume = volume
      return existing
    }
    const audio = new Audio(src)
    audio.preload = 'auto'
    audio.volume = volume
    if (isDefault) defaultAudio = audio
    else urgentAudio = audio
    return audio
  } catch {
    return null
  }
}

/**
 * Attaches a one-shot gesture listener that silently primes both audio files
 * on the first user interaction, allowing subsequent playback to succeed even
 * in strict autoplay environments.
 */
function attachUnlockOnce(): void {
  if (typeof window === 'undefined' || unlockAttached || audioUnlocked) return
  unlockAttached = true

  const unlock = () => {
    if (audioUnlocked) return
    audioUnlocked = true

    // Resume AudioContext on gesture (required for synth fallback).
    try {
      const ctx = getAudioContext()
      if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {})
    } catch {
      // ignore
    }

    const a1 = getAudio(SOUND_SRC_DEFAULT, 0)
    const a2 = getAudio(SOUND_SRC_URGENT, 0)
    for (const audio of [a1, a2]) {
      if (!audio) continue
      try {
        audio.muted = true
        const p = audio.play()
        if (p && typeof p.then === 'function') {
          p.then(() => {
            audio.pause()
            audio.currentTime = 0
            audio.muted = false
            audio.volume = audio === defaultAudio ? 0.7 : 0.9
          }).catch(() => {
            audio.muted = false
          })
        }
      } catch {
        // ignore — environment may not support autoplay at all
      }
    }
    // Remove listeners after first fire.
    window.removeEventListener('pointerdown', unlock, true)
    window.removeEventListener('keydown', unlock, true)
    window.removeEventListener('touchstart', unlock, true)
  }

  try {
    window.addEventListener('pointerdown', unlock, true)
    window.addEventListener('keydown', unlock, true)
    window.addEventListener('touchstart', unlock, true)
  } catch {
    // ignore
  }
}

function playSrc(src: string, volume: number, repeat = 1, gapMs = 300): void {
  const audio = getAudio(src, volume)
  const urgency: 'default' | 'urgent' = src === SOUND_SRC_URGENT ? 'urgent' : 'default'

  // If HTMLAudioElement is unavailable, synthesize directly.
  if (!audio) {
    for (let i = 0; i < repeat; i++) {
      window.setTimeout(() => synthesizeChime(urgency), i * (gapMs + 700))
    }
    return
  }

  const playOnce = () => {
    try {
      // Rewind so rapid repeats still fire.
      audio.currentTime = 0
      const playPromise = audio.play()
      if (playPromise && typeof playPromise.catch === 'function') {
        // Fallback: if MP3 playback is blocked/unavailable, use synth.
        playPromise.catch(() => {
          synthesizeChime(urgency)
        })
      }
    } catch {
      // HTMLAudioElement errored — fall back to synth.
      synthesizeChime(urgency)
    }
  }

  playOnce()
  if (repeat > 1) {
    for (let i = 1; i < repeat; i++) {
      window.setTimeout(playOnce, i * (audio.duration ? audio.duration * 1000 + gapMs : gapMs + 500))
    }
  }
}

/**
 * Plays the notification sound matched to the given priority.
 * - emergency: urgent tone, repeated 3x
 * - urgent:    urgent tone, repeated 2x
 * - high/important: urgent tone, single play at lower volume
 * - low/normal: gentle Teams-like chime
 * No-op when the user has muted notifications or the browser blocks autoplay.
 */
export function playNotificationSound(priority: SoundPriority = 'normal'): void {
  if (typeof window === 'undefined') return
  // Respect mute preference stored in localStorage.
  try {
    if (window.localStorage.getItem(MUTE_KEY) === '1') return
  } catch {
    // ignore
  }

  switch (priority) {
    case 'emergency':
      playSrc(SOUND_SRC_URGENT, 1.0, 3, 200)
      break
    case 'urgent':
      playSrc(SOUND_SRC_URGENT, 0.9, 2, 250)
      break
    case 'high':
    case 'important':
      playSrc(SOUND_SRC_URGENT, 0.6, 1)
      break
    case 'low':
    case 'normal':
    default:
      playSrc(SOUND_SRC_DEFAULT, 0.7, 1)
      break
  }
}

/**
 * Plays a short test chime regardless of mute preference — used by the
 * "Test" button in the notification bell so the user can confirm their
 * audio is actually audible. Always respects per-call user gesture, so it
 * works reliably since it's triggered from a click.
 */
export function testNotificationSound(): void {
  if (typeof window === 'undefined') return
  // Bypass mute for explicit user test — this is a direct click handler.
  try {
    const ctx = getAudioContext()
    if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {})
  } catch {}
  playSrc(SOUND_SRC_DEFAULT, 0.85, 1)
}

/**
 * Preloads the sound assets and registers an audio-unlock listener so the
 * very first chime after page load plays reliably even in strict autoplay
 * environments. Call once on app mount.
 */
export function preloadNotificationSounds(): void {
  if (typeof window === 'undefined') return
  try {
    getAudio(SOUND_SRC_DEFAULT, 0.7)
    getAudio(SOUND_SRC_URGENT, 0.9)
    attachUnlockOnce()
  } catch {
    // ignore
  }
}

// ---------- Mute preference helpers ----------

/** Returns true if the user has muted notification sounds. */
export function isMuted(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem(MUTE_KEY) === '1'
  } catch {
    return false
  }
}

/**
 * Sets the user's mute preference and broadcasts a cross-component event so
 * every listening UI (bell dropdown, notifications page, etc.) updates its
 * local state without needing to poll.
 */
export function setMuted(muted: boolean): void {
  if (typeof window === 'undefined') return
  try {
    if (muted) window.localStorage.setItem(MUTE_KEY, '1')
    else window.localStorage.removeItem(MUTE_KEY)
  } catch {
    // ignore
  }
  try {
    window.dispatchEvent(new CustomEvent(MUTE_EVENT, { detail: { muted } }))
  } catch {
    // ignore
  }
}

/**
 * Subscribes to mute-preference changes. Returns an unsubscribe function.
 * Fires on both in-app `setMuted()` calls and cross-tab storage events.
 */
export function subscribeMuteChange(handler: (muted: boolean) => void): () => void {
  if (typeof window === 'undefined') return () => {}
  const onCustom = (e: Event) => {
    const detail = (e as CustomEvent<{ muted: boolean }>).detail
    if (detail) handler(detail.muted)
    else handler(isMuted())
  }
  const onStorage = (e: StorageEvent) => {
    if (e.key === MUTE_KEY) handler(e.newValue === '1')
  }
  window.addEventListener(MUTE_EVENT, onCustom as EventListener)
  window.addEventListener('storage', onStorage)
  return () => {
    window.removeEventListener(MUTE_EVENT, onCustom as EventListener)
    window.removeEventListener('storage', onStorage)
  }
}

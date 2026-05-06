'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { useConfirm } from '@/components/providers/confirm-provider'
import { copyToClipboard } from '@/lib/utils'
import {
  Plus, Save, Loader2, X, Copy, ExternalLink, Trash2,
  Facebook, Instagram, MessageCircle
} from 'lucide-react'

interface SocialProfile {
  platform: string
  username: string
}

const PLATFORMS = [
  { value: 'facebook', label: 'Facebook', prefix: 'www.facebook.com/', icon: Facebook, color: 'text-blue-600 bg-blue-50' },
  { value: 'instagram', label: 'Instagram', prefix: 'www.instagram.com/', icon: Instagram, color: 'text-pink-600 bg-pink-50' },
  { value: 'tiktok', label: 'TikTok', prefix: 'www.tiktok.com/@', icon: MessageCircle, color: 'text-gray-800 bg-gray-100' },
  { value: 'twitter', label: 'X (Twitter)', prefix: 'x.com/', icon: MessageCircle, color: 'text-blue-400 bg-blue-50' },
  { value: 'viber', label: 'Viber', prefix: 'viber://chat?number=', icon: MessageCircle, color: 'text-purple-600 bg-purple-50' },
  { value: 'whatsapp', label: 'WhatsApp', prefix: 'wa.me/', icon: MessageCircle, color: 'text-green-600 bg-green-50' },
]

interface Props {
  patient: any
  patientId: string
  onRefresh: () => void
}

export default function SocialMediaSection({ patient, patientId, onRefresh }: Props) {
  const { toast } = useToast()
  const { confirm } = useConfirm()
  const [saving, setSaving] = useState(false)
  const [newPlatform, setNewPlatform] = useState('facebook')
  const [newUsername, setNewUsername] = useState('')

  const profiles: SocialProfile[] = Array.isArray(patient.socialMedia) ? patient.socialMedia : []

  const getPlatformConfig = (platform: string) => PLATFORMS.find(p => p.value === platform) || PLATFORMS[0]

  const saveProfiles = async (updated: SocialProfile[]) => {
    setSaving(true)
    try {
      const res = await fetch(`/api/patients/${patientId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ socialMedia: updated, _updateSection: 'profile' }),
      })
      const data = await res.json()
      if (data.success) {
        toast({ title: 'Social media updated' })
        onRefresh()
      } else {
        toast({ title: 'Error', description: data.error, variant: 'destructive' })
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to save', variant: 'destructive' })
    }
    setSaving(false)
  }

  const addProfile = () => {
    if (!newUsername.trim()) return
    const updated = [...profiles, { platform: newPlatform, username: newUsername.trim() }]
    setNewUsername('')
    saveProfiles(updated)
  }

  const removeProfile = async (index: number) => {
    const profile = profiles[index]
    const ok = await confirm({
      title: 'Remove social media profile?',
      description: `${getPlatformConfig(profile.platform).label} (${profile.username}) will be removed from this patient.`,
      confirmLabel: 'Remove',
      variant: 'destructive',
    })
    if (!ok) return
    const updated = profiles.filter((_, i) => i !== index)
    saveProfiles(updated)
  }

  const getFullUrl = (profile: SocialProfile) => {
    const cfg = getPlatformConfig(profile.platform)
    if (profile.platform === 'viber') return `viber://chat?number=${profile.username}`
    if (profile.platform === 'whatsapp') return `https://wa.me/${profile.username}`
    return `https://${cfg.prefix}${profile.username}`
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-gray-800">Social Media</h2>
          <p className="text-xs text-gray-400">{patient.fullName || 'Patient'}&apos;s social media profiles.</p>
        </div>
      </div>

      <div className="bg-white rounded-lg border shadow-sm">
        {/* Add new */}
        <div className="px-5 py-3 border-b">
          <p className="text-xs font-medium text-gray-500 mb-2">Add a new social media</p>
          <div className="flex items-center gap-2">
            <Select value={newPlatform} onValueChange={setNewPlatform}>
              <SelectTrigger className="w-36 h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PLATFORMS.map(p => (
                  <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex-1 flex items-center bg-gray-50 border rounded-md overflow-hidden">
              <span className="text-xs text-gray-400 px-2 shrink-0 border-r bg-gray-100 py-2">
                {getPlatformConfig(newPlatform).prefix}
              </span>
              <Input
                value={newUsername}
                onChange={e => setNewUsername(e.target.value)}
                placeholder="username"
                className="border-0 bg-transparent text-sm h-9 focus-visible:ring-0"
                onKeyDown={e => e.key === 'Enter' && addProfile()}
              />
            </div>
            <Button size="sm" onClick={addProfile} disabled={saving || !newUsername.trim()} className="h-9 gap-1 bg-[#5B5FC7] hover:bg-[#4B4FB7]">
              {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
              Add profile
            </Button>
          </div>
        </div>

        {/* List */}
        {profiles.length > 0 && (
          <div className="px-5 py-2">
            <p className="text-xs font-medium text-gray-500 mb-1">Social media accounts ({profiles.length})</p>
            {profiles.map((profile, i) => {
              const cfg = getPlatformConfig(profile.platform)
              const Icon = cfg.icon
              return (
                <div key={i} className="flex items-center gap-3 py-2 border-b border-gray-100 last:border-0 group">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center ${cfg.color}`}>
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-xs text-gray-400">{cfg.prefix}</span>
                  <span className="text-sm font-medium text-gray-800 flex-1">{profile.username}</span>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={async () => { const ok = await copyToClipboard(getFullUrl(profile)); toast({ title: ok ? 'Copied!' : 'Copy failed', variant: ok ? 'default' : 'destructive' }) }}>
                      <Copy className="w-3 h-3 text-gray-400" />
                    </Button>
                    <a href={getFullUrl(profile)} target="_blank" rel="noopener noreferrer">
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0">
                        <ExternalLink className="w-3 h-3 text-gray-400" />
                      </Button>
                    </a>
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => removeProfile(i)} disabled={saving}>
                      <X className="w-3 h-3 text-red-400" />
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {profiles.length > 0 && (
          <div className="px-5 py-2 border-t">
            <Button size="sm" variant="ghost" className="text-xs text-[#5B5FC7] gap-1 h-7 px-2" onClick={() => saveProfiles(profiles)} disabled={saving}>
              {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
              Update socials
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

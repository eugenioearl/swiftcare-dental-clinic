'use client'

import { useState, useRef, useEffect } from 'react'
import Image from 'next/image'
import { Camera, Upload, X, User } from 'lucide-react'
import { Button } from './button'
import { useToast } from '@/hooks/use-toast'
import { useConfirm } from '@/components/providers/confirm-provider'

interface ProfilePictureUploadProps {
  currentPictureUrl?: string | null
  firstName?: string
  lastName?: string
  onUploadSuccess?: (url: string | null) => void
  size?: 'sm' | 'md' | 'lg' | 'xl'
  editable?: boolean
  /** Override the endpoint used for POST/DELETE (defaults to /api/users/profile-picture). */
  uploadEndpoint?: string
}

const sizeClasses = {
  sm: 'w-16 h-16',
  md: 'w-24 h-24',
  lg: 'w-32 h-32',
  xl: 'w-40 h-40'
}

const textSizeClasses = {
  sm: 'text-xl',
  md: 'text-2xl',
  lg: 'text-4xl',
  xl: 'text-5xl'
}

export function ProfilePictureUpload({
  currentPictureUrl,
  firstName = '',
  lastName = '',
  onUploadSuccess,
  size = 'lg',
  editable = true,
  uploadEndpoint = '/api/users/profile-picture'
}: ProfilePictureUploadProps) {
  const [pictureUrl, setPictureUrl] = useState<string | null>(currentPictureUrl || null)
  const [isLoading, setIsLoading] = useState(false)
  const [isHovering, setIsHovering] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()
  const { confirm } = useConfirm()

  useEffect(() => {
    setPictureUrl(currentPictureUrl || null)
  }, [currentPictureUrl])

  const getInitials = () => {
    const firstInitial = firstName?.charAt(0)?.toUpperCase() || ''
    const lastInitial = lastName?.charAt(0)?.toUpperCase() || ''
    return firstInitial + lastInitial || '?'
  }

  const getBackgroundColor = () => {
    // Generate consistent color based on name
    const colors = [
      'bg-gradient-to-br from-blue-500 to-cyan-500',
      'bg-gradient-to-br from-green-500 to-teal-500',
      'bg-gradient-to-br from-purple-500 to-pink-500',
      'bg-gradient-to-br from-orange-500 to-red-500',
      'bg-gradient-to-br from-indigo-500 to-blue-500',
      'bg-gradient-to-br from-teal-500 to-green-500'
    ]
    const index = (firstName?.charCodeAt(0) || 0) % colors.length
    return colors[index]
  }

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg']
    if (!allowedTypes.includes(file.type)) {
      toast({
        title: 'Invalid file type',
        description: 'Please upload a JPG, PNG, or WebP image.',
        variant: 'destructive'
      })
      return
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024
    if (file.size > maxSize) {
      toast({
        title: 'File too large',
        description: 'Maximum file size is 5MB.',
        variant: 'destructive'
      })
      return
    }

    setIsLoading(true)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch(uploadEndpoint, {
        method: 'POST',
        body: formData
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Upload failed')
      }

      setPictureUrl(data.profilePictureUrl)
      onUploadSuccess?.(data.profilePictureUrl)

      toast({
        title: 'Success!',
        description: 'Profile picture updated successfully.'
      })
    } catch (error) {
      console.error('Upload error:', error)
      toast({
        title: 'Upload failed',
        description: error instanceof Error ? error.message : 'Failed to upload picture',
        variant: 'destructive'
      })
    } finally {
      setIsLoading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleRemove = async () => {
    const ok = await confirm({
      title: 'Remove profile picture?',
      description: 'Your profile picture will be removed and replaced with your initials.',
      confirmLabel: 'Remove',
      variant: 'destructive',
    })
    if (!ok) return
    setIsLoading(true)

    try {
      const response = await fetch(uploadEndpoint, {
        method: 'DELETE'
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Delete failed')
      }

      setPictureUrl(null)
      onUploadSuccess?.(null as any)

      toast({
        title: 'Success!',
        description: 'Profile picture removed.'
      })
    } catch (error) {
      console.error('Delete error:', error)
      toast({
        title: 'Delete failed',
        description: error instanceof Error ? error.message : 'Failed to remove picture',
        variant: 'destructive'
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="relative inline-block">
      <div
        className={`${sizeClasses[size]} relative rounded-full overflow-hidden border-4 border-white shadow-lg`}
        onMouseEnter={() => editable && setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
      >
        {pictureUrl ? (
          <Image
            src={pictureUrl}
            alt="Profile picture"
            fill
            className="object-cover"
            priority
          />
        ) : (
          <div className={`w-full h-full ${getBackgroundColor()} flex items-center justify-center text-white font-bold ${textSizeClasses[size]}`}>
            {getInitials()}
          </div>
        )}

        {editable && isHovering && !isLoading && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="text-white hover:bg-white/20"
              onClick={() => fileInputRef.current?.click()}
            >
              <Camera className="w-5 h-5" />
            </Button>
          </div>
        )}

        {isLoading && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
          </div>
        )}
      </div>

      {editable && (
        <>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/jpg"
            onChange={handleFileSelect}
            className="hidden"
          />

          {pictureUrl && (
            <Button
              type="button"
              size="icon"
              variant="destructive"
              className="absolute -top-2 -right-2 rounded-full w-8 h-8"
              onClick={handleRemove}
              disabled={isLoading}
            >
              <X className="w-4 h-4" />
            </Button>
          )}
        </>
      )}
    </div>
  )
}

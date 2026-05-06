

'use client'

import { formatDisplayName } from '@/lib/utils'
import { useState, useEffect } from 'react'
import { useSession } from '@/components/auth/custom-session-provider'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { ProfilePictureUpload } from '@/components/ui/profile-picture-upload'
import { User, Mail, Phone, Shield, Edit2, Save, X } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

export default function AdminProfile() {
  const { data: session } = useSession() || {}
  const { toast } = useToast()
  const [isEditing, setIsEditing] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [profilePictureUrl, setProfilePictureUrl] = useState<string | null>(null)
  
  const [formData, setFormData] = useState({
    firstName: session?.user?.firstName || '',
    lastName: session?.user?.lastName || '',
    email: session?.user?.email || '',
    phone: session?.user?.phone || '',
    bio: 'System Administrator with full access to manage the SwiftCare Dental Management System.'
  })

  // Load profile picture
  useEffect(() => {
    const loadProfilePicture = async () => {
      try {
        const response = await fetch('/api/users/profile-picture')
        if (response.ok) {
          const data = await response.json()
          setProfilePictureUrl(data.profilePictureUrl)
        }
      } catch (error) {
        console.error('Error loading profile picture:', error)
      }
    }

    if (session?.user) {
      loadProfilePicture()
    }
  }, [session])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      toast({
        title: "Profile Updated",
        description: "Your profile information has been successfully updated.",
      })
      
      setIsEditing(false)
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update profile. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleCancel = () => {
    setFormData({
      firstName: session?.user?.firstName || '',
      lastName: session?.user?.lastName || '',
      email: session?.user?.email || '',
      phone: session?.user?.phone || '',
      bio: 'System Administrator with full access to manage the SwiftCare Dental Management System.'
    })
    setIsEditing(false)
  }

  return (
    <DashboardLayout title="Admin Profile">
      <div className="space-y-6">
        {/* Profile Picture Section */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row items-center gap-6">
              <ProfilePictureUpload
                currentPictureUrl={profilePictureUrl}
                firstName={formData.firstName || session?.user?.firstName}
                lastName={formData.lastName || session?.user?.lastName}
                size="xl"
                editable={true}
                onUploadSuccess={(url) => {
                  setProfilePictureUrl(url)
                  toast({
                    title: 'Success!',
                    description: 'Profile picture updated successfully.'
                  })
                }}
              />
              <div className="flex-1 text-center md:text-left">
                <h2 className="text-xl font-bold text-gray-900">
                  {formatDisplayName(formData.firstName || session?.user?.firstName, formData.lastName || session?.user?.lastName)}
                </h2>
                <p className="text-gray-600">{formData.email || session?.user?.email}</p>
                <Badge variant="secondary" className="text-sm mt-2">
                  <Shield className="w-4 h-4 mr-2" />
                  System Administrator
                </Badge>
                <p className="text-sm text-gray-500 mt-2">
                  Click on your profile picture to update it. Max file size: 5MB. Supported formats: JPG, PNG, WebP.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Profile Information</h1>
            <p className="text-muted-foreground">Manage your administrator account information</p>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {/* Profile Card */}
          <div className="md:col-span-2">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center">
                  <User className="w-5 h-5 mr-2" />
                  Profile Information
                </CardTitle>
                {!isEditing ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsEditing(true)}
                  >
                    <Edit2 className="w-4 h-4 mr-2" />
                    Edit Profile
                  </Button>
                ) : (
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCancel}
                      disabled={isLoading}
                    >
                      <X className="w-4 h-4 mr-2" />
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleSubmit}
                      disabled={isLoading}
                    >
                      <Save className="w-4 h-4 mr-2" />
                      {isLoading ? 'Saving...' : 'Save Changes'}
                    </Button>
                  </div>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                {isEditing ? (
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="firstName">First Name</Label>
                        <Input
                          id="firstName"
                          value={formData.firstName}
                          onChange={(e) => setFormData(prev => ({ ...prev, firstName: e.target.value }))}
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="lastName">Last Name</Label>
                        <Input
                          id="lastName"
                          value={formData.lastName}
                          onChange={(e) => setFormData(prev => ({ ...prev, lastName: e.target.value }))}
                          required
                        />
                      </div>
                    </div>
                    
                    <div>
                      <Label htmlFor="email">Email Address</Label>
                      <Input
                        id="email"
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                        required
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="phone">Phone Number</Label>
                      <Input
                        id="phone"
                        value={formData.phone}
                        onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="bio">Bio</Label>
                      <Textarea
                        id="bio"
                        value={formData.bio}
                        onChange={(e) => setFormData(prev => ({ ...prev, bio: e.target.value }))}
                        rows={3}
                      />
                    </div>
                  </form>
                ) : (
                  <div className="space-y-4">
                    <div className="grid gap-3">
                      <div className="flex items-center space-x-3">
                        <Mail className="w-4 h-4 text-muted-foreground" />
                        <span>{formData.email}</span>
                      </div>
                      {formData.phone && (
                        <div className="flex items-center space-x-3">
                          <Phone className="w-4 h-4 text-muted-foreground" />
                          <span>{formData.phone}</span>
                        </div>
                      )}
                    </div>
                    
                    <div>
                      <Label className="text-sm font-medium">Bio</Label>
                      <p className="text-sm text-muted-foreground mt-1">{formData.bio}</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Quick Stats */}
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Account Status</CardTitle>
              </CardHeader>
              <CardContent>
                <Badge variant="default" className="w-full justify-center">
                  Active Administrator
                </Badge>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">System Access</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Full System Access</span>
                  <Badge variant="outline" className="text-xs">Yes</Badge>
                </div>
                <div className="flex justify-between text-sm">
                  <span>User Management</span>
                  <Badge variant="outline" className="text-xs">Yes</Badge>
                </div>
                <div className="flex justify-between text-sm">
                  <span>System Settings</span>
                  <Badge variant="outline" className="text-xs">Yes</Badge>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Reports & Analytics</span>
                  <Badge variant="outline" className="text-xs">Yes</Badge>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}

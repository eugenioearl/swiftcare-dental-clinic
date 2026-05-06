
'use client'

import { formatDisplayName } from '@/lib/utils'
import { useState, useEffect } from 'react'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { Plus, Search, Edit, UserX, UserCheck, ShieldCheck, Users, Stethoscope } from 'lucide-react'

interface UserData {
  id: string
  email: string
  username: string | null
  firstName: string
  lastName: string
  phone: string | null
  role: string
  isActive: boolean
  lastLogin: string | null
  createdAt: string
}

export default function UserManagementPage() {
  const [users, setUsers] = useState<UserData[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [editingUser, setEditingUser] = useState<UserData | null>(null)
  const [formData, setFormData] = useState({
    email: '', username: '', password: '', firstName: '', lastName: '', phone: '', role: 'staff'
  })
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const { toast } = useToast()

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/admin/users', { credentials: 'include' })
      const data = await res.json()
      if (res.ok) setUsers(data.users || [])
    } catch (error) {
      console.error('Failed to fetch users:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchUsers() }, [])

  const resetForm = () => {
    setFormData({ email: '', username: '', password: '', firstName: '', lastName: '', phone: '', role: 'staff' })
    setFormError('')
  }

  const handleCreate = async () => {
    setFormError('')
    setSubmitting(true)
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
        credentials: 'include'
      })
      const data = await res.json()
      if (res.ok && data.success) {
        toast({ title: 'User Created', description: `${formData.lastName}, ${formData.firstName} has been created.` })
        setShowCreateDialog(false)
        resetForm()
        fetchUsers()
      } else {
        setFormError(data.error || 'Failed to create user')
      }
    } catch {
      setFormError('An error occurred')
    } finally {
      setSubmitting(false)
    }
  }

  const handleUpdate = async () => {
    if (!editingUser) return
    setFormError('')
    setSubmitting(true)
    try {
      const payload: any = {
        id: editingUser.id,
        email: formData.email,
        username: formData.username,
        firstName: formData.firstName,
        lastName: formData.lastName,
        phone: formData.phone,
        role: formData.role,
      }
      if (formData.password) payload.password = formData.password

      const res = await fetch('/api/admin/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        credentials: 'include'
      })
      const data = await res.json()
      if (res.ok && data.success) {
        toast({ title: 'User Updated', description: `${formData.lastName}, ${formData.firstName} has been updated.` })
        setEditingUser(null)
        resetForm()
        fetchUsers()
      } else {
        setFormError(data.error || 'Failed to update user')
      }
    } catch {
      setFormError('An error occurred')
    } finally {
      setSubmitting(false)
    }
  }

  const toggleActive = async (user: UserData) => {
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: user.id, isActive: !user.isActive }),
        credentials: 'include'
      })
      const data = await res.json()
      if (res.ok && data.success) {
        toast({
          title: user.isActive ? 'User Deactivated' : 'User Activated',
          description: `${user.lastName}, ${user.firstName} has been ${user.isActive ? 'deactivated' : 'activated'}.`,
        })
        fetchUsers()
      } else {
        toast({ title: 'Error', description: data.error, variant: 'destructive' })
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to update user', variant: 'destructive' })
    }
  }

  const openEdit = (user: UserData) => {
    setEditingUser(user)
    setFormData({
      email: user.email,
      username: user.username || '',
      password: '',
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone || '',
      role: user.role,
    })
    setFormError('')
  }

  const filteredUsers = users.filter(u => {
    const matchSearch = search === '' || 
      `${u.lastName}, ${u.firstName} ${u.email} ${u.username || ''}`.toLowerCase().includes(search.toLowerCase())
    const matchRole = roleFilter === 'all' || u.role === roleFilter
    return matchSearch && matchRole
  })

  const getRoleBadge = (role: string) => {
    const colors: Record<string, string> = {
      super_admin: 'bg-red-100 text-red-700',
      admin: 'bg-orange-100 text-orange-700',
      dentist: 'bg-blue-100 text-blue-700',
      staff: 'bg-emerald-100 text-emerald-700',
      receptionist: 'bg-teal-100 text-teal-700',
    }
    const labels: Record<string, string> = {
      super_admin: 'Super Admin',
      admin: 'Admin',
      dentist: 'Dentist',
      staff: 'Staff',
      receptionist: 'Receptionist',
    }
    return <Badge className={colors[role] || 'bg-gray-100 text-gray-700'}>{labels[role] || role}</Badge>
  }

  const getRoleIcon = (role: string) => {
    if (['admin', 'super_admin'].includes(role)) return <ShieldCheck className="w-4 h-4" />
    if (role === 'dentist') return <Stethoscope className="w-4 h-4" />
    return <Users className="w-4 h-4" />
  }

  const stats = {
    total: users.length,
    active: users.filter(u => u.isActive).length,
    admins: users.filter(u => ['admin', 'super_admin'].includes(u.role)).length,
    dentists: users.filter(u => u.role === 'dentist').length,
    staff: users.filter(u => ['staff', 'receptionist'].includes(u.role)).length,
  }

  const renderFormFields = (isEdit: boolean) => (
    <div className="space-y-4">
      {formError && <Alert variant="destructive"><AlertDescription>{formError}</AlertDescription></Alert>}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>First Name *</Label>
          <Input value={formData.firstName} onChange={e => setFormData({...formData, firstName: e.target.value})} required />
        </div>
        <div className="space-y-2">
          <Label>Last Name *</Label>
          <Input value={formData.lastName} onChange={e => setFormData({...formData, lastName: e.target.value})} required />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Email *</Label>
        <Input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} required />
      </div>
      <div className="space-y-2">
        <Label>Username (optional)</Label>
        <Input value={formData.username} onChange={e => setFormData({...formData, username: e.target.value})} placeholder="For login convenience" />
      </div>
      <div className="space-y-2">
        <Label>{isEdit ? 'New Password (leave blank to keep current)' : 'Password *'}</Label>
        <Input type="password" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} required={!isEdit} minLength={6} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Phone</Label>
          <Input value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
        </div>
        <div className="space-y-2">
          <Label>Role *</Label>
          <Select value={formData.role} onValueChange={v => setFormData({...formData, role: v})}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="dentist">Dentist</SelectItem>
              <SelectItem value="staff">Staff</SelectItem>
              <SelectItem value="receptionist">Receptionist</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
              <SelectItem value="super_admin">Super Admin</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  )

  return (
    <DashboardLayout title="User Management">
      <div className="space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[
            { label: 'Total Users', value: stats.total, color: 'text-gray-700' },
            { label: 'Active', value: stats.active, color: 'text-green-600' },
            { label: 'Admins', value: stats.admins, color: 'text-red-600' },
            { label: 'Dentists', value: stats.dentists, color: 'text-blue-600' },
            { label: 'Staff', value: stats.staff, color: 'text-emerald-600' },
          ].map(stat => (
            <Card key={stat.label}>
              <CardContent className="p-4 text-center">
                <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
                <p className="text-xs text-muted-foreground mt-1">{stat.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Controls */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search users..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
          </div>
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder="Filter by role" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Roles</SelectItem>
              <SelectItem value="super_admin">Super Admin</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
              <SelectItem value="dentist">Dentist</SelectItem>
              <SelectItem value="staff">Staff</SelectItem>
              <SelectItem value="receptionist">Receptionist</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={() => { resetForm(); setShowCreateDialog(true) }} className="bg-[#2D9DA8] hover:bg-[#258A94]">
            <Plus className="w-4 h-4 mr-2" /> Add User
          </Button>
        </div>

        {/* User List */}
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-8 text-center text-muted-foreground">Loading users...</div>
            ) : filteredUsers.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">No users found</div>
            ) : (
              <>
                {/* Desktop / tablet: full table */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">User</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Role</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Status</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Last Login</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredUsers.map(user => (
                        <tr key={user.id} className={`border-b hover:bg-muted/30 ${!user.isActive ? 'opacity-50' : ''}`}>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium text-primary flex-shrink-0">
                                {user.firstName[0]}{user.lastName[0]}
                              </div>
                              <div className="min-w-0">
                                <p className="font-medium text-sm truncate">{formatDisplayName(user.firstName, user.lastName)}</p>
                                <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                                {user.username && <p className="text-xs text-blue-500 truncate">@{user.username}</p>}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              {getRoleIcon(user.role)}
                              {getRoleBadge(user.role)}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <Badge className={user.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>
                              {user.isActive ? 'Active' : 'Inactive'}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">
                            {user.lastLogin ? new Date(user.lastLogin).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Never'}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex justify-end gap-2">
                              <Button variant="ghost" size="sm" onClick={() => openEdit(user)}>
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => toggleActive(user)}
                                className={user.isActive ? 'text-red-500 hover:text-red-700' : 'text-green-500 hover:text-green-700'}
                              >
                                {user.isActive ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile: card list */}
                <div className="md:hidden divide-y">
                  {filteredUsers.map(user => (
                    <div key={user.id} className={`p-4 ${!user.isActive ? 'opacity-50' : ''}`}>
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium text-primary flex-shrink-0">
                          {user.firstName[0]}{user.lastName[0]}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-sm break-words">{formatDisplayName(user.firstName, user.lastName)}</p>
                          <p className="text-xs text-muted-foreground break-all">{user.email}</p>
                          {user.username && <p className="text-xs text-blue-500 break-all">@{user.username}</p>}

                          <div className="flex flex-wrap items-center gap-1.5 mt-2">
                            {getRoleBadge(user.role)}
                            <Badge className={user.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>
                              {user.isActive ? 'Active' : 'Inactive'}
                            </Badge>
                          </div>

                          <div className="flex items-center justify-between mt-3 gap-2">
                            <p className="text-[11px] text-muted-foreground">
                              <span className="text-muted-foreground/70">Last login: </span>
                              {user.lastLogin
                                ? new Date(user.lastLogin).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                                : 'Never'}
                            </p>
                            <div className="flex gap-1 flex-shrink-0">
                              <Button variant="ghost" size="sm" onClick={() => openEdit(user)} className="h-8 px-2">
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => toggleActive(user)}
                                className={`h-8 px-2 ${user.isActive ? 'text-red-500 hover:text-red-700' : 'text-green-500 hover:text-green-700'}`}
                              >
                                {user.isActive ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Create Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={v => { setShowCreateDialog(v); if (!v) resetForm() }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Create New User</DialogTitle>
            <DialogDescription>Add a new staff member, dentist, or admin to the system.</DialogDescription>
          </DialogHeader>
          {renderFormFields(false)}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={submitting} className="bg-[#2D9DA8] hover:bg-[#258A94]">
              {submitting ? 'Creating...' : 'Create User'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editingUser} onOpenChange={v => { if (!v) { setEditingUser(null); resetForm() } }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>Update user details and role assignment.</DialogDescription>
          </DialogHeader>
          {renderFormFields(true)}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => { setEditingUser(null); resetForm() }}>Cancel</Button>
            <Button onClick={handleUpdate} disabled={submitting} className="bg-[#2D9DA8] hover:bg-[#258A94]">
              {submitting ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  )
}

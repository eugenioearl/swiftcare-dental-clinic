import { redirect } from 'next/navigation'

export default function ControlCenterRedirect() {
  redirect('/admin/settings')
}

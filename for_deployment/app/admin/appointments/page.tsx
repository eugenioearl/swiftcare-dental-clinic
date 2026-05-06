import { redirect } from 'next/navigation'

export default function AdminAppointmentsPage() {
  redirect('/admin/scheduling?tab=appointments')
}

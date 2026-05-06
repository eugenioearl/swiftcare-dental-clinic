import { redirect } from 'next/navigation'

export default function StaffAppointmentsPage() {
  redirect('/admin/scheduling?tab=appointments')
}

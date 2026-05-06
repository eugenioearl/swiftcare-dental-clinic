import { redirect } from 'next/navigation'

export default function DentistAppointmentsRedirect() {
  redirect('/admin/scheduling?tab=appointments')
}

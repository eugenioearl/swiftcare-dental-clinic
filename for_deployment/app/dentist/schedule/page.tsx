import { redirect } from 'next/navigation'

export default function DentistScheduleRedirect() {
  redirect('/admin/scheduling?tab=calendar')
}

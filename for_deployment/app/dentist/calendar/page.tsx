import { redirect } from 'next/navigation'

export default function DentistCalendarRedirect() {
  redirect('/admin/scheduling?tab=calendar')
}

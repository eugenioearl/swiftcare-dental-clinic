import { redirect } from 'next/navigation'

export default function DentistQueueRedirect() {
  redirect('/admin/scheduling?tab=queue')
}

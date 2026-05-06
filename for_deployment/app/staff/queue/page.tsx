import { redirect } from 'next/navigation'

export default function StaffQueuePage() {
  redirect('/admin/scheduling?tab=queue')
}

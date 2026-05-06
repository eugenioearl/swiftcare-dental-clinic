import { redirect } from 'next/navigation'

export default function AdminQueuePage() {
  // Queue Monitor (public display) is accessed via /queue-monitor.
  // Staff queue management is part of the unified Scheduling page.
  redirect('/admin/scheduling?tab=queue')
}

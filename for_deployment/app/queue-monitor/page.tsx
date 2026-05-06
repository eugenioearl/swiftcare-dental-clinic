

'use client'

import { RealTimeQueueDisplay } from '@/components/queue/real-time-queue-display'
import { AnnouncementBanner } from '@/components/announcements/announcement-banner'

export default function QueueMonitor() {
  return (
    <div>
      <AnnouncementBanner placement="queue_monitor" />
      <RealTimeQueueDisplay 
        showAll={true} 
        publicDisplay={true}
        refreshInterval={5000}
      />
    </div>
  )
}


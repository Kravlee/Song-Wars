'use client'

import { useNotifications } from '@/lib/notifications'

export default function NotificationCenter() {
  const { notifications } = useNotifications()

  return (
    <div className="fixed top-4 right-4 z-40 space-y-2 pointer-events-none">
      {notifications.map((notif) => (
        <div
          key={notif.id}
          className="bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg p-4 shadow-lg pointer-events-auto animate-slide-up"
        >
          <p className="font-bold text-sm">{notif.title}</p>
          <p className="text-xs text-gray-100 mt-1">{notif.message}</p>
        </div>
      ))}
    </div>
  )
}

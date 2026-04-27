'use client'

import { createContext, useContext, useState, useCallback } from 'react'

export interface Notification {
  id: string
  type: 'battle-ended' | 'rating-finalized' | 'winner-announced'
  title: string
  message: string
  timestamp: Date
  read: boolean
  battleId?: string
}

interface NotificationContextType {
  notifications: Notification[]
  addNotification: (notif: Omit<Notification, 'id' | 'timestamp' | 'read'>) => void
  markAsRead: (id: string) => void
  clearNotifications: () => void
}

const NotificationContext = createContext<NotificationContextType | null>(null)

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([])

  const addNotification = useCallback((notif: Omit<Notification, 'id' | 'timestamp' | 'read'>) => {
    const id = Math.random().toString(36).slice(2)
    const newNotif: Notification = {
      ...notif,
      id,
      timestamp: new Date(),
      read: false,
    }
    setNotifications((prev) => [newNotif, ...prev])

    // Auto-remove after 5 seconds
    setTimeout(() => {
      setNotifications((prev) => prev.filter((n) => n.id !== id))
    }, 5000)
  }, [])

  const markAsRead = useCallback((id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    )
  }, [])

  const clearNotifications = useCallback(() => {
    setNotifications([])
  }, [])

  return (
    <NotificationContext.Provider
      value={{ notifications, addNotification, markAsRead, clearNotifications }}
    >
      {children}
    </NotificationContext.Provider>
  )
}

export function useNotifications() {
  const context = useContext(NotificationContext)
  if (!context) {
    throw new Error('useNotifications must be used within NotificationProvider')
  }
  return context
}

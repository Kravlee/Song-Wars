'use client'

import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { clearAuth, getUser } from '@/lib/auth'

interface NavItem {
  href: string
  label: string
  icon: string
  exact?: boolean
}

const navItems: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: '🏠', exact: true },
  { href: '/battle', label: 'My Battles', icon: '⚔️' },
  { href: '/browse', label: 'Browse Lobbies', icon: '🔍', exact: true },
  { href: '/leaderboard', label: 'Leaderboard', icon: '🏆', exact: true },
  { href: '/profile', label: 'Profile', icon: '👤', exact: true },
]

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const user = getUser()

  const handleLogout = () => {
    clearAuth()
    router.push('/')
  }

  const isActive = (item: NavItem) => {
    if (item.exact) return pathname === item.href
    return pathname.startsWith(item.href)
  }

  return (
    <aside className="w-64 flex-shrink-0 bg-gray-900 border-r border-gray-800 flex flex-col h-screen sticky top-0">
      {/* Logo */}
      <div className="p-6 border-b border-gray-800">
        <Link href="/dashboard" className="flex items-center gap-3 group">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center text-lg shadow-lg shadow-purple-900/40 group-hover:shadow-purple-800/60 transition-shadow">
            🎵
          </div>
          <span className="text-xl font-black gradient-text tracking-tight">
            SONG WARS
          </span>
        </Link>
      </div>

      {/* User info */}
      {user && (
        <div className="px-4 py-4 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-sm font-bold text-white flex-shrink-0">
              {user.username.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white truncate">{user.username}</p>
              <p className="text-xs text-gray-500 truncate">{user.email}</p>
            </div>
          </div>

          {/* Mini stats */}
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="bg-gray-800/60 rounded-lg px-3 py-2 text-center">
              <p className="text-lg font-bold text-purple-400">{user.wins}</p>
              <p className="text-xs text-gray-500">Wins</p>
            </div>
            <div className="bg-gray-800/60 rounded-lg px-3 py-2 text-center">
              <p className="text-lg font-bold text-blue-400">{user.battles}</p>
              <p className="text-xs text-gray-500">Battles</p>
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto">
        <div className="space-y-1">
          {navItems.map((item) => {
            const active = isActive(item)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={[
                  'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200',
                  active
                    ? 'bg-gradient-to-r from-purple-600/20 to-blue-600/10 text-white border border-purple-500/30 shadow-sm'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800',
                ].join(' ')}
              >
                <span className="text-base">{item.icon}</span>
                <span>{item.label}</span>
                {active && (
                  <div className="ml-auto w-1.5 h-1.5 rounded-full bg-purple-400" />
                )}
              </Link>
            )
          })}
        </div>

        {/* Divider */}
        <div className="my-4 border-t border-gray-800" />

        {/* Quick action */}
        <Link
          href="/browse"
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-purple-600 to-blue-600 text-white hover:from-purple-500 hover:to-blue-500 transition-all duration-200 shadow-lg shadow-purple-900/30 mb-2"
        >
          <span>⚔️</span>
          <span>Find a Battle</span>
        </Link>
      </nav>

      {/* Logout */}
      <div className="p-3 border-t border-gray-800">
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-all duration-200 group"
        >
          <span className="text-base group-hover:scale-110 transition-transform">🚪</span>
          <span>Logout</span>
        </button>
        <p className="text-center text-xs text-gray-700 mt-3">Song Wars v0.1</p>
      </div>
    </aside>
  )
}

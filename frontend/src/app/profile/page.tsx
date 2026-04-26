'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { isLoggedIn, getUser, clearAuth } from '@/lib/auth'
import DashboardLayout from '@/components/layout/DashboardLayout'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import { showToast } from '@/components/ui/Toast'

export default function ProfilePage() {
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  const user = getUser()

  useEffect(() => {
    setMounted(true)
    if (!isLoggedIn()) {
      router.replace('/login')
    }
  }, [router])

  if (!mounted || !user) return null

  const winRate = user.battles > 0 ? Math.round((user.wins / user.battles) * 100) : 0

  const handleLogout = () => {
    clearAuth()
    showToast('Logged out successfully.', 'success')
    router.push('/')
  }

  const gradients = [
    'from-purple-500 to-blue-500',
    'from-pink-500 to-purple-500',
    'from-blue-500 to-cyan-500',
    'from-green-500 to-teal-500',
  ]
  let hash = 0
  for (let i = 0; i < user.id.length; i++) hash = user.id.charCodeAt(i) + ((hash << 5) - hash)
  const gradient = gradients[Math.abs(hash) % gradients.length]

  return (
    <DashboardLayout>
      <div className="p-8 max-w-3xl mx-auto">
        {/* Profile Header */}
        <div className="mb-8 animate-fade-in">
          <div className="relative bg-gradient-to-r from-purple-600/20 to-blue-600/20 border border-gray-800 rounded-3xl p-8 overflow-hidden">
            {/* Background orbs */}
            <div className="absolute top-0 right-0 w-40 h-40 orb orb-purple opacity-30" />
            <div className="absolute bottom-0 left-20 w-32 h-32 orb orb-blue opacity-20" />

            <div className="relative z-10 flex items-center gap-6">
              {/* Avatar */}
              <div className={`w-24 h-24 rounded-2xl bg-gradient-to-br ${gradient} flex items-center justify-center text-5xl font-black text-white shadow-xl flex-shrink-0`}>
                {user.username.charAt(0).toUpperCase()}
              </div>

              <div>
                <h1 className="text-3xl font-black text-white">{user.username}</h1>
                <p className="text-gray-400 mt-1">{user.email}</p>
                <div className="flex items-center gap-3 mt-3">
                  <span className="badge badge-voting">Song Wars Artist</span>
                  {user.wins >= 10 && <span className="badge badge-results">Veteran</span>}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-8 animate-slide-up">
          <Card className="text-center">
            <p className="text-4xl font-black text-yellow-400 mb-1">{user.wins}</p>
            <p className="text-gray-400 text-sm">Total Wins</p>
            <p className="text-gray-600 text-xs mt-0.5">🏆</p>
          </Card>
          <Card className="text-center">
            <p className="text-4xl font-black text-purple-400 mb-1">{user.battles}</p>
            <p className="text-gray-400 text-sm">Battles Fought</p>
            <p className="text-gray-600 text-xs mt-0.5">⚔️</p>
          </Card>
          <Card className="text-center">
            <p className={`text-4xl font-black mb-1 ${winRate >= 70 ? 'text-green-400' : winRate >= 50 ? 'text-blue-400' : 'text-gray-400'}`}>
              {winRate}%
            </p>
            <p className="text-gray-400 text-sm">Win Rate</p>
            <p className="text-gray-600 text-xs mt-0.5">📊</p>
          </Card>
        </div>

        {/* Win rate bar */}
        <div className="mb-8 animate-slide-up" style={{ animationDelay: '100ms' }}>
          <Card>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-white">Performance</h3>
              <span className={`text-sm font-bold ${winRate >= 70 ? 'text-green-400' : winRate >= 50 ? 'text-blue-400' : 'text-gray-400'}`}>
                {winRate}% win rate
              </span>
            </div>
            <div className="h-3 bg-gray-800 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-1000 ${
                  winRate >= 70 ? 'bg-gradient-to-r from-green-500 to-emerald-400' :
                  winRate >= 50 ? 'bg-gradient-to-r from-blue-500 to-cyan-400' :
                  'bg-gradient-to-r from-purple-500 to-blue-500'
                }`}
                style={{ width: `${winRate}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-gray-600 mt-2">
              <span>0%</span>
              <span>50%</span>
              <span>100%</span>
            </div>

            {/* Labels */}
            <div className="mt-4 grid grid-cols-3 gap-3 text-center">
              <div className="bg-gray-800/50 rounded-xl p-3">
                <p className="text-green-400 font-bold text-lg">{user.wins}</p>
                <p className="text-gray-500 text-xs">Wins</p>
              </div>
              <div className="bg-gray-800/50 rounded-xl p-3">
                <p className="text-red-400 font-bold text-lg">{Math.max(0, user.battles - user.wins)}</p>
                <p className="text-gray-500 text-xs">Losses</p>
              </div>
              <div className="bg-gray-800/50 rounded-xl p-3">
                <p className="text-gray-300 font-bold text-lg">{user.battles}</p>
                <p className="text-gray-500 text-xs">Total</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Account Info */}
        <div className="mb-8 animate-slide-up" style={{ animationDelay: '150ms' }}>
          <Card>
            <h3 className="font-bold text-white mb-4 flex items-center gap-2">
              <span>👤</span> Account Information
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between py-3 border-b border-gray-800">
                <div>
                  <p className="text-gray-400 text-xs uppercase tracking-widest mb-0.5">Username</p>
                  <p className="text-white font-semibold">{user.username}</p>
                </div>
              </div>
              <div className="flex items-center justify-between py-3 border-b border-gray-800">
                <div>
                  <p className="text-gray-400 text-xs uppercase tracking-widest mb-0.5">Email</p>
                  <p className="text-white font-semibold">{user.email}</p>
                </div>
              </div>
              <div className="flex items-center justify-between py-3">
                <div>
                  <p className="text-gray-400 text-xs uppercase tracking-widest mb-0.5">User ID</p>
                  <p className="text-gray-500 font-mono text-xs">{user.id}</p>
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Actions */}
        <div className="space-y-3 animate-slide-up" style={{ animationDelay: '200ms' }}>
          <Button
            variant="primary"
            fullWidth
            size="lg"
            onClick={() => router.push('/browse')}
          >
            ⚔️ Find a Battle
          </Button>
          <Button
            variant="danger"
            fullWidth
            onClick={handleLogout}
          >
            🚪 Sign Out
          </Button>
        </div>
      </div>
    </DashboardLayout>
  )
}

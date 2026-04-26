'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { isLoggedIn, getUser } from '@/lib/auth'
import { api, UserStats, RecentBattle, AuthUser } from '@/lib/api'
import DashboardLayout from '@/components/layout/DashboardLayout'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import { showToast } from '@/components/ui/Toast'

interface CreateLobbyForm {
  name: string
  isPublic: boolean
  maxPlayers: number
  timerDuration: number
}

const TIMER_OPTIONS = [
  { value: 15, label: '15 min', sub: 'Quick battle' },
  { value: 30, label: '30 min', sub: 'Standard' },
  { value: 45, label: '45 min', sub: 'Extended' },
  { value: 60, label: '1 hour', sub: 'Marathon' },
]

function StatCard({ icon, label, value, sub, color }: { icon: string; label: string; value: string | number; sub?: string; color: string }) {
  return (
    <Card className={`border-${color}-500/20 hover:border-${color}-500/40 transition-all duration-300`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-gray-400 text-sm font-medium">{label}</p>
          <p className={`text-3xl font-black text-${color}-400 mt-1`}>{value}</p>
          {sub && <p className="text-gray-600 text-xs mt-1">{sub}</p>}
        </div>
        <div className={`text-3xl opacity-80`}>{icon}</div>
      </div>
    </Card>
  )
}

function ResultBadge({ isWinner, submitted }: { isWinner: boolean; submitted: boolean }) {
  if (isWinner) return <span className="text-xs font-semibold px-2 py-1 rounded-full bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">WIN 🏆</span>
  if (submitted) return <span className="text-xs font-semibold px-2 py-1 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30">PLAYED</span>
  return <span className="text-xs font-semibold px-2 py-1 rounded-full bg-gray-700 text-gray-400">JOINED</span>
}

export default function DashboardPage() {
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  const [stats, setStats] = useState<UserStats | null>(null)
  const [recentBattles, setRecentBattles] = useState<RecentBattle[]>([])
  const [loadingStats, setLoadingStats] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState<CreateLobbyForm>({
    name: '',
    isPublic: true,
    maxPlayers: 8,
    timerDuration: 30,
  })

  const user = getUser()

  const loadData = useCallback(async () => {
    try {
      const [statsData, battlesData] = await Promise.allSettled([
        api.users.stats(),
        api.users.recent(),
      ])
      if (statsData.status === 'fulfilled') setStats(statsData.value.stats)
      if (battlesData.status === 'fulfilled') setRecentBattles(battlesData.value.battles)
    } catch {
      // Silently fail — use empty state
    } finally {
      setLoadingStats(false)
    }
  }, [])

  useEffect(() => {
    setMounted(true)
    if (!isLoggedIn()) {
      router.replace('/login')
      return
    }
    loadData()
  }, [router, loadData])

  if (!mounted || !user) return null

  const winRate = stats
    ? stats.battles > 0
      ? Math.round((stats.wins / stats.battles) * 100)
      : 0
    : 0

  const handleCreateLobby = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) {
      showToast('Please enter a lobby name.', 'error')
      return
    }

    setCreating(true)
    try {
      const { lobby } = await api.lobbies.create({
        name: form.name.trim(),
        isPublic: form.isPublic,
        maxPlayers: form.maxPlayers,
        timerDuration: form.timerDuration,
      })
      showToast('Lobby created!', 'success')
      setShowCreateModal(false)
      router.push(`/lobby/${lobby.id}`)
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to create lobby.', 'error')
    } finally {
      setCreating(false)
    }
  }

  return (
    <DashboardLayout>
      <div className="p-8 max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8 animate-fade-in">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-black text-white">
                Welcome back,{' '}
                <span className="gradient-text">{user.username}</span> 👋
              </h1>
              <p className="text-gray-400 mt-1">Ready to battle? Let&apos;s get to it.</p>
            </div>
            <div className="hidden sm:flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <span className="text-xs text-gray-400">Online</span>
            </div>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-8 animate-slide-up">
          {loadingStats ? (
            <>
              {[...Array(4)].map((_, i) => (
                <div key={i} className="bg-gray-900 border border-gray-800 rounded-2xl p-5 animate-pulse">
                  <div className="h-3 bg-gray-800 rounded w-16 mb-3" />
                  <div className="h-8 bg-gray-800 rounded w-12" />
                </div>
              ))}
            </>
          ) : (
            <>
              <StatCard
                icon="🏆"
                label="Total Wins"
                value={stats?.wins ?? user.wins ?? 0}
                sub="All time"
                color="yellow"
              />
              <StatCard
                icon="⚔️"
                label="Battles"
                value={stats?.battles ?? user.battles ?? 0}
                sub="All time"
                color="purple"
              />
              <StatCard
                icon="📊"
                label="Win Rate"
                value={`${winRate}%`}
                sub={stats && stats.battles > 0 ? `${stats.wins}/${stats.battles}` : 'No battles yet'}
                color="blue"
              />
              
            </>
          )}
        </div>

        {/* Quick Actions */}
        <div className="mb-8 animate-slide-up" style={{ animationDelay: '100ms' }}>
          <h2 className="text-lg font-bold text-white mb-4">Quick Actions</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button
              onClick={() => setShowCreateModal(true)}
              className="group bg-gradient-to-br from-purple-600/20 to-purple-600/5 border border-purple-500/30 hover:border-purple-500/60 rounded-2xl p-6 text-left transition-all duration-300 hover:shadow-[0_0_30px_rgba(124,58,237,0.2)] hover:scale-[1.01]"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-purple-600/30 flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
                  🎵
                </div>
                <div>
                  <h3 className="font-bold text-white text-lg">Create Lobby</h3>
                  <p className="text-gray-400 text-sm">Start your own music battle</p>
                </div>
                <svg className="w-5 h-5 text-gray-500 ml-auto group-hover:text-purple-400 group-hover:translate-x-1 transition-all" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </button>

            <button
              onClick={() => router.push('/browse')}
              className="group bg-gradient-to-br from-blue-600/20 to-blue-600/5 border border-blue-500/30 hover:border-blue-500/60 rounded-2xl p-6 text-left transition-all duration-300 hover:shadow-[0_0_30px_rgba(59,130,246,0.2)] hover:scale-[1.01]"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-blue-600/30 flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
                  🔍
                </div>
                <div>
                  <h3 className="font-bold text-white text-lg">Browse Lobbies</h3>
                  <p className="text-gray-400 text-sm">Join an existing battle</p>
                </div>
                <svg className="w-5 h-5 text-gray-500 ml-auto group-hover:text-blue-400 group-hover:translate-x-1 transition-all" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </button>
          </div>
        </div>

        {/* Recent Battles */}
        <div className="animate-slide-up" style={{ animationDelay: '200ms' }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-white">Recent Battles</h2>
            <button onClick={() => router.push('/browse')} className="text-purple-400 hover:text-purple-300 text-sm font-medium transition-colors">
              Browse all →
            </button>
          </div>

          <Card padding="none" className="overflow-hidden">
            {loadingStats ? (
              <div className="p-8 text-center">
                <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                <p className="text-gray-500 text-sm">Loading battles...</p>
              </div>
            ) : recentBattles.length === 0 ? (
              <div className="p-12 text-center">
                <div className="text-5xl mb-4">⚔️</div>
                <h3 className="text-white font-semibold mb-2">No battles yet</h3>
                <p className="text-gray-500 text-sm mb-6">Join your first lobby and start competing!</p>
                <Button variant="primary" onClick={() => router.push('/browse')}>
                  Find a Battle
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-800">
                      <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Lobby</th>
                      <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                      <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Players</th>
                      <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Result</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {recentBattles.map((battle) => (
                      <tr key={battle.id} className="hover:bg-gray-800/50 transition-colors">
                        <td className="px-5 py-4">
                          <span className="text-white font-medium text-sm">{battle.name}</span>
                        </td>
                        <td className="px-5 py-4">
                          <span className="text-gray-400 text-sm">
                            {new Date(battle.joinedAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <span className="text-gray-400 text-sm flex items-center gap-1">
                            <span>👥</span> {battle.playerCount}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <ResultBadge isWinner={battle.isWinner} submitted={battle.submitted} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Create Lobby Modal */}
      {showCreateModal && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in"
          onClick={(e) => { if (e.target === e.currentTarget) setShowCreateModal(false) }}
        >
          <div className="bg-gray-900 border border-gray-700 rounded-3xl p-8 w-full max-w-lg shadow-2xl animate-bounce-in">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-black text-white">Create Lobby</h2>
                <p className="text-gray-400 text-sm mt-0.5">Set up your music battle arena</p>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-gray-500 hover:text-white transition-colors p-1"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleCreateLobby} className="space-y-5">
              {/* Lobby Name */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">
                  Lobby Name <span className="text-purple-400">*</span>
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Friday Night Beats"
                  maxLength={50}
                  className="w-full bg-gray-800 border border-gray-700 focus:border-purple-500 focus:ring-1 focus:ring-purple-500/30 rounded-xl px-4 py-2.5 text-white placeholder-gray-500 text-sm outline-none transition-all"
                  required
                />
              </div>

              {/* Visibility */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Visibility</label>
                <div className="flex gap-3">
                  {[
                    { value: true, label: '🌍 Public', sub: 'Anyone can join' },
                    { value: false, label: '🔒 Private', sub: 'Join by code only' },
                  ].map((opt) => (
                    <button
                      key={String(opt.value)}
                      type="button"
                      onClick={() => setForm({ ...form, isPublic: opt.value })}
                      className={[
                        'flex-1 py-3 px-4 rounded-xl border text-left transition-all duration-200',
                        form.isPublic === opt.value
                          ? 'bg-purple-600/20 border-purple-500 text-white'
                          : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600',
                      ].join(' ')}
                    >
                      <div className="font-semibold text-sm">{opt.label}</div>
                      <div className="text-xs text-gray-500 mt-0.5">{opt.sub}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Max Players */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-gray-300">Max Players</label>
                  <span className="text-purple-400 font-bold text-sm">{form.maxPlayers} players</span>
                </div>
                <input
                  type="range"
                  min={4}
                  max={16}
                  step={2}
                  value={form.maxPlayers}
                  onChange={(e) => setForm({ ...form, maxPlayers: parseInt(e.target.value) })}
                  className="w-full audio-progress"
                />
                <div className="flex justify-between text-xs text-gray-600 mt-1">
                  <span>4</span><span>8</span><span>12</span><span>16</span>
                </div>
              </div>

              {/* Timer Duration */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Battle Duration</label>
                <div className="grid grid-cols-4 gap-2">
                  {TIMER_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setForm({ ...form, timerDuration: opt.value })}
                      className={[
                        'py-2.5 rounded-xl border text-center transition-all duration-200',
                        form.timerDuration === opt.value
                          ? 'bg-purple-600/20 border-purple-500 text-purple-300'
                          : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600',
                      ].join(' ')}
                    >
                      <div className="font-bold text-sm">{opt.label}</div>
                      <div className="text-xs text-gray-500 mt-0.5">{opt.sub}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  variant="secondary"
                  fullWidth
                  onClick={() => setShowCreateModal(false)}
                  type="button"
                >
                  Cancel
                </Button>
                <Button type="submit" fullWidth loading={creating}>
                  {creating ? 'Creating...' : 'Create Lobby'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  )
}


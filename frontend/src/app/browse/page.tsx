'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { isLoggedIn } from '@/lib/auth'
import { api, LobbyListItem } from '@/lib/api'
import DashboardLayout from '@/components/layout/DashboardLayout'
import Button from '@/components/ui/Button'
import { showToast } from '@/components/ui/Toast'

type FilterTab = 'all' | 'waiting' | 'battle' | 'voting'

const phaseLabels: Record<string, string> = {
  waiting: 'Waiting',
  battle: 'In Battle',
  preview: 'Preview',
  voting: 'Voting',
  results: 'Results',
}

const phaseClass: Record<string, string> = {
  waiting: 'badge-waiting',
  battle: 'badge-battle',
  preview: 'badge-preview',
  voting: 'badge-voting',
  results: 'badge-results',
}

function PhaseBadge({ phase }: { phase: string }) {
  return (
    <span className={`badge ${phaseClass[phase] || 'badge-preview'}`}>
      {phaseLabels[phase] || phase}
    </span>
  )
}

function LobbyCard({ lobby, onJoin, joining }: { lobby: LobbyListItem; onJoin: (id: string) => void; joining: string | null }) {
  const isFull = lobby.playerCount >= lobby.maxPlayers
  const canJoin = !isFull && lobby.phase === 'waiting'
  const isJoining = joining === lobby.id
  const fillPct = Math.min((lobby.playerCount / lobby.maxPlayers) * 100, 100)

  return (
    <div className="bg-gray-900 border border-gray-800 hover:border-purple-500/30 rounded-2xl p-5 transition-all duration-300 card-hover flex flex-col">
      <div className="flex items-start justify-between mb-3">
        <div className="min-w-0 flex-1 pr-3">
          <h3 className="font-bold text-white text-base truncate">{lobby.name}</h3>
          <p className="text-gray-500 text-xs mt-0.5 font-mono tracking-widest">{lobby.code}</p>
        </div>
        <PhaseBadge phase={lobby.phase} />
      </div>

      <p className="text-gray-500 text-xs mb-3">Host: <span className="text-gray-400">{lobby.hostName}</span></p>

      {/* Players bar */}
      <div className="mb-4">
        <div className="flex items-center justify-between text-xs text-gray-400 mb-1.5">
          <span className="flex items-center gap-1">
            <span>👥</span> {lobby.playerCount} / {lobby.maxPlayers} players
          </span>
          {isFull && <span className="text-red-400 font-medium">Full</span>}
        </div>
        <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${isFull ? 'bg-red-500' : 'bg-gradient-to-r from-purple-500 to-blue-500'}`}
            style={{ width: `${fillPct}%` }}
          />
        </div>
      </div>

      <div className="mt-auto">
        <Button
          variant={canJoin ? 'primary' : 'secondary'}
          fullWidth
          size="sm"
          loading={isJoining}
          disabled={!canJoin || isJoining}
          onClick={() => canJoin && onJoin(lobby.id)}
        >
          {isJoining ? 'Joining...' : isFull ? 'Full' : lobby.phase !== 'waiting' ? 'In Progress' : 'Join Battle'}
        </Button>
      </div>
    </div>
  )
}

export default function BrowsePage() {
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  const [lobbies, setLobbies] = useState<LobbyListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [joining, setJoining] = useState<string | null>(null)
  const [filter, setFilter] = useState<FilterTab>('all')
  const [search, setSearch] = useState('')
  const [codeInput, setCodeInput] = useState('')
  const [joiningByCode, setJoiningByCode] = useState(false)
  const refreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchLobbies = useCallback(async () => {
    try {
      const data = await api.lobbies.list(filter === 'all' ? undefined : filter)
      setLobbies(data.lobbies)
    } catch {
      // Silently fail on refresh
    } finally {
      setLoading(false)
    }
  }, [filter])

  useEffect(() => {
    setMounted(true)
    if (!isLoggedIn()) {
      router.replace('/login')
      return
    }
  }, [router])

  useEffect(() => {
    setLoading(true)
    fetchLobbies()

    // Auto-refresh every 10 seconds
    refreshTimerRef.current = setInterval(fetchLobbies, 10000)
    return () => {
      if (refreshTimerRef.current) clearInterval(refreshTimerRef.current)
    }
  }, [fetchLobbies])

  if (!mounted) return null

  const filteredLobbies = lobbies.filter((l) => {
    const q = search.toLowerCase()
    return !q || l.name.toLowerCase().includes(q) || l.code.toLowerCase().includes(q) || l.hostName.toLowerCase().includes(q)
  })

  const handleJoin = async (lobbyId: string) => {
    setJoining(lobbyId)
    try {
      await api.lobbies.join(lobbyId)
      showToast('Joined lobby!', 'success')
      router.push(`/lobby/${lobbyId}`)
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to join lobby.', 'error')
    } finally {
      setJoining(null)
    }
  }

  const handleJoinByCode = async () => {
    const code = codeInput.trim().toUpperCase()
    if (!code) {
      showToast('Please enter a lobby code.', 'error')
      return
    }
    setJoiningByCode(true)
    try {
      const { lobby } = await api.lobbies.findByCode(code)
      await api.lobbies.join(lobby.id)
      showToast('Joined lobby!', 'success')
      router.push(`/lobby/${lobby.id}`)
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Lobby not found or could not join.', 'error')
    } finally {
      setJoiningByCode(false)
    }
  }

  const filterTabs: { id: FilterTab; label: string; icon: string }[] = [
    { id: 'all', label: 'All Lobbies', icon: '🌐' },
    { id: 'waiting', label: 'Waiting', icon: '⏳' },
    { id: 'battle', label: 'In Battle', icon: '🔥' },
    { id: 'voting', label: 'Voting', icon: '🗳️' },
  ]

  return (
    <DashboardLayout>
      <div className="p-8 max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-6 animate-fade-in">
          <h1 className="text-3xl font-black text-white mb-1">Browse Lobbies</h1>
          <p className="text-gray-400 text-sm">Find your next battle or join by code</p>
        </div>

        {/* Join by Code */}
        <div className="mb-6 animate-slide-up">
          <div className="bg-gradient-to-r from-purple-600/10 to-blue-600/10 border border-purple-500/20 rounded-2xl p-5">
            <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
              <span>🔑</span> Join by Code
            </h3>
            <div className="flex gap-3">
              <input
                type="text"
                value={codeInput}
                onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === 'Enter' && handleJoinByCode()}
                placeholder="Enter lobby code (e.g. AB1234)"
                maxLength={8}
                className="flex-1 bg-gray-800 border border-gray-700 focus:border-purple-500 rounded-xl px-4 py-2.5 text-white placeholder-gray-500 text-sm font-mono tracking-widest uppercase outline-none focus:ring-1 focus:ring-purple-500/30 transition-all"
              />
              <Button
                onClick={handleJoinByCode}
                loading={joiningByCode}
                disabled={!codeInput.trim()}
              >
                Join
              </Button>
            </div>
          </div>
        </div>

        {/* Search + Filters */}
        <div className="mb-5 space-y-3 animate-slide-up" style={{ animationDelay: '50ms' }}>
          {/* Search bar */}
          <div className="relative">
            <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or code..."
              className="w-full bg-gray-900 border border-gray-800 focus:border-purple-500 rounded-xl pl-10 pr-4 py-2.5 text-white placeholder-gray-500 text-sm outline-none focus:ring-1 focus:ring-purple-500/30 transition-all"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            )}
          </div>

          {/* Filter tabs */}
          <div className="flex gap-2 overflow-x-auto pb-1">
            {filterTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setFilter(tab.id)}
                className={[
                  'flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition-all duration-200',
                  filter === tab.id
                    ? 'bg-purple-600 text-white shadow-lg shadow-purple-900/30'
                    : 'bg-gray-900 border border-gray-800 text-gray-400 hover:text-white hover:border-gray-700',
                ].join(' ')}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}

            {/* Refresh button */}
            <button
              onClick={() => { setLoading(true); fetchLobbies() }}
              className="ml-auto flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm text-gray-500 hover:text-white bg-gray-900 border border-gray-800 hover:border-gray-700 transition-all whitespace-nowrap"
            >
              <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh
            </button>
          </div>
        </div>

        {/* Results info */}
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-gray-500">
            {loading ? 'Loading...' : `${filteredLobbies.length} lobby${filteredLobbies.length !== 1 ? 'ies' : ''} found`}
          </p>
          <p className="text-xs text-gray-600">Auto-refreshes every 10s</p>
        </div>

        {/* Lobby Grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-gray-900 border border-gray-800 rounded-2xl p-5 animate-pulse">
                <div className="h-4 bg-gray-800 rounded w-3/4 mb-2" />
                <div className="h-3 bg-gray-800 rounded w-1/4 mb-4" />
                <div className="h-1.5 bg-gray-800 rounded-full mb-4" />
                <div className="flex gap-1 mb-4">
                  {[...Array(4)].map((_, j) => (
                    <div key={j} className="w-6 h-6 rounded-full bg-gray-800" />
                  ))}
                </div>
                <div className="h-8 bg-gray-800 rounded-xl" />
              </div>
            ))}
          </div>
        ) : filteredLobbies.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-6xl mb-4">🔍</div>
            <h3 className="text-white font-semibold text-lg mb-2">No lobbies found</h3>
            <p className="text-gray-500 text-sm mb-6">
              {search ? `No results for "${search}"` : 'No open lobbies right now. Be the first to create one!'}
            </p>
            <Button variant="primary" onClick={() => router.push('/dashboard')}>
              Create a Lobby
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredLobbies.map((lobby) => (
              <LobbyCard
                key={lobby.id}
                lobby={lobby}
                onJoin={handleJoin}
                joining={joining}
              />
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}

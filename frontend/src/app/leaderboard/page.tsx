'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { isLoggedIn, getUser } from '@/lib/auth'
import DashboardLayout from '@/components/layout/DashboardLayout'

interface LeaderboardEntry {
  rank: number
  userId: string
  username: string
  wins: number
  battles: number
  winRate: number
}

// Mock data for display — replace with real API when available
const generateMockLeaderboard = (): LeaderboardEntry[] => [
  { rank: 1, userId: '1', username: 'beatmaster_rex', wins: 42, battles: 50, winRate: 84 },
  { rank: 2, userId: '2', username: 'melodyqueen', wins: 38, battles: 48, winRate: 79 },
  { rank: 3, userId: '3', username: 'soulfire_dj', wins: 35, battles: 45, winRate: 78 },
  { rank: 4, userId: '4', username: 'trapgod99', wins: 31, battles: 42, winRate: 74 },
  { rank: 5, userId: '5', username: 'wavemake_r', wins: 28, battles: 40, winRate: 70 },
  { rank: 6, userId: '6', username: 'bassdropsam', wins: 25, battles: 38, winRate: 66 },
  { rank: 7, userId: '7', username: 'vinylvibe', wins: 22, battles: 35, winRate: 63 },
  { rank: 8, userId: '8', username: 'lofi_legend', wins: 19, battles: 32, winRate: 59 },
  { rank: 9, userId: '9', username: 'hiphopking', wins: 16, battles: 30, winRate: 53 },
  { rank: 10, userId: '10', username: 'jazzcat404', wins: 14, battles: 28, winRate: 50 },
]

const medals: Record<number, { icon: string; color: string; glow: string }> = {
  1: { icon: '🥇', color: 'text-yellow-400', glow: 'shadow-[0_0_20px_rgba(234,179,8,0.3)]' },
  2: { icon: '🥈', color: 'text-gray-300', glow: 'shadow-[0_0_15px_rgba(156,163,175,0.2)]' },
  3: { icon: '🥉', color: 'text-amber-600', glow: 'shadow-[0_0_15px_rgba(180,83,9,0.2)]' },
}

export default function LeaderboardPage() {
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const user = getUser()

  const load = useCallback(async () => {
    try {
      // Try to load from API — fall back to mock data
      setEntries(generateMockLeaderboard())
    } catch {
      setEntries(generateMockLeaderboard())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    setMounted(true)
    if (!isLoggedIn()) {
      router.replace('/login')
      return
    }
    load()
  }, [router, load])

  if (!mounted) return null

  return (
    <DashboardLayout>
      <div className="p-8 max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8 animate-fade-in">
          <h1 className="text-3xl font-black text-white mb-1 flex items-center gap-3">
            <span className="text-4xl">🏆</span>
            <span>Leaderboard</span>
          </h1>
          <p className="text-gray-400 text-sm">The top Song Wars competitors</p>
        </div>

        {/* Top 3 Podium */}
        {!loading && entries.length >= 3 && (
          <div className="mb-8 animate-slide-up">
            <div className="flex items-end justify-center gap-6">
              {/* 2nd */}
              <div className="flex flex-col items-center gap-3 animate-float-delayed">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-gray-400 to-gray-600 flex items-center justify-center text-2xl font-black text-white shadow-lg">
                  {entries[1].username.charAt(0).toUpperCase()}
                </div>
                <div className="text-center">
                  <p className="font-bold text-white text-sm">{entries[1].username}</p>
                  <p className="text-gray-400 text-xs">{entries[1].wins} wins</p>
                </div>
                <div className="h-20 w-24 bg-gradient-to-t from-gray-600/30 to-transparent border-t-2 border-gray-400 rounded-t-xl flex items-start justify-center pt-2">
                  <span className="text-2xl">🥈</span>
                </div>
              </div>

              {/* 1st */}
              <div className="flex flex-col items-center gap-3 -mb-4 animate-float">
                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-yellow-400 to-amber-600 flex items-center justify-center text-3xl font-black text-white shadow-xl shadow-yellow-900/40 animate-pulse-glow">
                  {entries[0].username.charAt(0).toUpperCase()}
                </div>
                <div className="text-center">
                  <p className="font-black text-white text-base">{entries[0].username}</p>
                  <p className="text-yellow-400 text-sm font-semibold">{entries[0].wins} wins</p>
                </div>
                <div className="h-32 w-28 bg-gradient-to-t from-yellow-600/20 to-transparent border-t-4 border-yellow-400 rounded-t-xl flex items-start justify-center pt-2">
                  <span className="text-3xl">🥇</span>
                </div>
              </div>

              {/* 3rd */}
              <div className="flex flex-col items-center gap-3 animate-float-slow">
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-amber-600 to-orange-800 flex items-center justify-center text-xl font-black text-white shadow-lg">
                  {entries[2].username.charAt(0).toUpperCase()}
                </div>
                <div className="text-center">
                  <p className="font-bold text-white text-sm">{entries[2].username}</p>
                  <p className="text-gray-400 text-xs">{entries[2].wins} wins</p>
                </div>
                <div className="h-16 w-20 bg-gradient-to-t from-amber-800/30 to-transparent border-t-2 border-amber-600 rounded-t-xl flex items-start justify-center pt-2">
                  <span className="text-2xl">🥉</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Full table */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden animate-slide-up" style={{ animationDelay: '100ms' }}>
          <div className="px-5 py-3 border-b border-gray-800 flex items-center justify-between">
            <h2 className="font-bold text-white">Full Rankings</h2>
            <span className="text-xs text-gray-500">{entries.length} competitors</span>
          </div>

          {loading ? (
            <div className="p-8 text-center">
              <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-gray-500 text-sm">Loading rankings...</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-800">
              {entries.map((entry) => {
                const medal = medals[entry.rank]
                const isCurrentUser = user?.username === entry.username

                return (
                  <div
                    key={entry.userId}
                    className={[
                      'flex items-center gap-4 px-5 py-4 transition-colors',
                      isCurrentUser ? 'bg-purple-600/10' : 'hover:bg-gray-800/40',
                      entry.rank <= 3 ? medal?.glow || '' : '',
                    ].join(' ')}
                  >
                    {/* Rank */}
                    <div className="w-10 text-center flex-shrink-0">
                      {medal ? (
                        <span className="text-2xl">{medal.icon}</span>
                      ) : (
                        <span className="text-gray-500 font-bold text-sm">#{entry.rank}</span>
                      )}
                    </div>

                    {/* Avatar */}
                    <div className={`w-10 h-10 rounded-full bg-gradient-to-br flex items-center justify-center font-bold text-white flex-shrink-0 ${
                      entry.rank === 1 ? 'from-yellow-400 to-amber-600' :
                      entry.rank === 2 ? 'from-gray-400 to-gray-600' :
                      entry.rank === 3 ? 'from-amber-600 to-orange-800' :
                      'from-purple-500 to-blue-500'
                    }`}>
                      {entry.username.charAt(0).toUpperCase()}
                    </div>

                    {/* Name */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`font-semibold text-sm ${medal ? medal.color : 'text-white'} truncate`}>
                          {entry.username}
                        </span>
                        {isCurrentUser && (
                          <span className="text-xs text-purple-400 font-medium">(You)</span>
                        )}
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="hidden sm:flex items-center gap-6 text-sm text-right">
                      <div>
                        <p className="text-white font-bold">{entry.wins}</p>
                        <p className="text-gray-500 text-xs">Wins</p>
                      </div>
                      <div>
                        <p className="text-gray-300 font-semibold">{entry.battles}</p>
                        <p className="text-gray-500 text-xs">Battles</p>
                      </div>
                      <div>
                        <p className={`font-bold ${entry.winRate >= 70 ? 'text-green-400' : entry.winRate >= 50 ? 'text-yellow-400' : 'text-gray-300'}`}>
                          {entry.winRate}%
                        </p>
                        <p className="text-gray-500 text-xs">Win Rate</p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  )
}

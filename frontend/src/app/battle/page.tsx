'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { isLoggedIn } from '@/lib/auth'
import { api, RecentBattle } from '@/lib/api'
import DashboardLayout from '@/components/layout/DashboardLayout'
import Button from '@/components/ui/Button'

function ResultBadge({ isWinner }: { isWinner: boolean }) {
  if (isWinner) return <span className="badge badge-results text-xs">WIN</span>
  return <span className="badge badge-preview text-xs">PLAYED</span>
}

export default function MyBattlesPage() {
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  const [battles, setBattles] = useState<RecentBattle[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const data = await api.users.recent()
      setBattles(data)
    } catch {
      setBattles([])
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
        <div className="mb-6 animate-fade-in flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-black text-white mb-1 flex items-center gap-3">
              <span className="text-3xl">⚔️</span> My Battles
            </h1>
            <p className="text-gray-400 text-sm">Your battle history</p>
          </div>
          <Button onClick={() => router.push('/browse')}>Find a Battle</Button>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden animate-slide-up">
          {loading ? (
            <div className="p-8 text-center">
              <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-gray-500 text-sm">Loading battles...</p>
            </div>
          ) : battles.length === 0 ? (
            <div className="p-16 text-center">
              <div className="text-6xl mb-4">⚔️</div>
              <h3 className="text-white font-bold text-xl mb-2">No battles yet</h3>
              <p className="text-gray-500 text-sm mb-6">Jump into your first lobby and start competing!</p>
              <Button onClick={() => router.push('/browse')}>Browse Lobbies</Button>
            </div>
          ) : (
            <>
              <div className="px-5 py-3 border-b border-gray-800 flex items-center justify-between">
                <h2 className="font-bold text-white">All Battles</h2>
                <span className="text-xs text-gray-500">{battles.length} battles</span>
              </div>
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
                    {battles.map((battle) => (
                      <tr key={battle.id} className="hover:bg-gray-800/40 transition-colors">
                        <td className="px-5 py-4">
                          <span className="text-white font-semibold text-sm">{battle.name}</span>
                        </td>
                        <td className="px-5 py-4">
                          <span className="text-gray-400 text-sm">
                            {new Date(battle.createdAt).toLocaleDateString([], {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <span className="text-gray-400 text-sm flex items-center gap-1">
                            <span>👥</span> {battle.playerCount}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <ResultBadge isWinner={battle.isWinner} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </DashboardLayout>
  )
}

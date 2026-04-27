'use client'

import { useState } from 'react'
import { api, ResultEntry } from '@/lib/api'
import Button from '@/components/ui/Button'
import { showToast } from '@/components/ui/Toast'

interface VotingInterfaceProps {
  submissions: Array<{ id: string; userId: string; username: string; fileUrl: string; fileName: string }>
  isSpectator: boolean
  currentUserId: string
  onVoteSubmitted?: () => void
}

export default function VotingInterface({
  submissions,
  isSpectator,
  currentUserId,
  onVoteSubmitted,
}: VotingInterfaceProps) {
  const [voted, setVoted] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleVote = async (submissionId: string) => {
    if (voted) return

    setLoading(true)
    try {
      // Vote would be submitted via socket or API
      setVoted(submissionId)
      showToast('Vote submitted!', 'success')
      onVoteSubmitted?.()
    } catch (err) {
      showToast('Failed to submit vote', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="text-center mb-6">
        <h2 className="text-3xl font-black gradient-text">VOTE FOR THE BEST</h2>
        <p className="text-gray-400 text-sm mt-2">
          {isSpectator ? 'Spectators' : 'Players'} voting for the best track
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {submissions.map((sub) => {
          const isOwn = sub.userId === currentUserId
          const isVotedFor = voted === sub.id
          const canVote = !isOwn && !voted

          return (
            <div
              key={sub.id}
              className={[
                'bg-gray-900 border rounded-2xl p-4 transition-all duration-300',
                isVotedFor ? 'border-purple-500 shadow-[0_0_20px_rgba(124,58,237,0.3)]' : 'border-gray-800',
                voted && !isVotedFor ? 'opacity-60' : '',
              ].join(' ')}
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-bold text-purple-300">{sub.username.charAt(0).toUpperCase()}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-white text-sm truncate">{sub.username}</p>
                  {isOwn && <p className="text-xs text-purple-400">(You)</p>}
                </div>
              </div>

              <button
                onClick={() => handleVote(sub.id)}
                disabled={!canVote || loading}
                className={[
                  'w-full py-2.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all',
                  isVotedFor
                    ? 'bg-purple-600/30 border border-purple-500 text-purple-300'
                    : isOwn
                    ? 'bg-gray-800/50 border border-gray-700/50 text-gray-600 cursor-not-allowed'
                    : voted
                    ? 'bg-gray-800/50 border border-gray-700/50 text-gray-500 cursor-not-allowed'
                    : 'bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white shadow-lg shadow-purple-900/30',
                ].join(' ')}
              >
                {isVotedFor ? (
                  <>
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    Voted!
                  </>
                ) : isOwn ? (
                  'Your Track'
                ) : voted ? (
                  'Vote Submitted'
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                    </svg>
                    Vote
                  </>
                )}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { isLoggedIn, getUser } from '@/lib/auth'
import { api, Lobby, LobbyPlayer, ResultEntry } from '@/lib/api'
import { getSocket } from '@/lib/socket'
import AudioPlayer from '@/components/battle/AudioPlayer'
import Timer from '@/components/battle/Timer'
import UploadArea from '@/components/battle/UploadArea'
import Chat, { ChatMessage } from '@/components/lobby/Chat'
import Button from '@/components/ui/Button'
import { showToast } from '@/components/ui/Toast'
import { ToastContainer } from '@/components/ui/Toast'

type BattlePhase = 'loading' | 'battle' | 'preview' | 'voting' | 'results'

// Flat submission shape used throughout the battle page
// ResultEntry from api matches this: { id, userId, username, fileName, fileUrl, voteCount, createdAt }
type BattleSub = ResultEntry

interface BattleState {
  phase: BattlePhase
  lobby: Lobby | null
  players: LobbyPlayer[]
  beatUrl: string | null
  timerEnd: string | null
  submissions: BattleSub[]
  currentPreviewIndex: number
  userVote: string | null
  hasSubmitted: boolean
  uploadProgress: number
  results: BattleSub[]
}

// ===== CONFETTI =====
function Confetti() {
  const colors = ['#7c3aed', '#3b82f6', '#f59e0b', '#10b981', '#ef4444', '#ec4899']
  const pieces = Array.from({ length: 50 }, (_, i) => ({
    id: i,
    color: colors[i % colors.length],
    left: Math.random() * 100,
    delay: Math.random() * 3,
    duration: 2 + Math.random() * 2,
    size: 6 + Math.random() * 8,
  }))

  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {pieces.map((p) => (
        <div
          key={p.id}
          className="confetti-piece"
          style={{
            left: `${p.left}%`,
            backgroundColor: p.color,
            width: `${p.size}px`,
            height: `${p.size}px`,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
          }}
        />
      ))}
    </div>
  )
}

// ===== AVATAR =====
function Avatar({ username, userId, size = 'md' }: { username: string; userId?: string; size?: 'sm' | 'md' | 'lg' | 'xl' }) {
  const gradients = [
    'from-purple-500 to-blue-500',
    'from-pink-500 to-purple-500',
    'from-blue-500 to-cyan-500',
    'from-green-500 to-teal-500',
    'from-orange-500 to-pink-500',
    'from-yellow-500 to-orange-500',
  ]
  let hash = 0
  const id = userId || username
  for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash)
  const gradient = gradients[Math.abs(hash) % gradients.length]

  const sizeClasses = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-16 h-16 text-xl',
    xl: 'w-24 h-24 text-4xl',
  }

  return (
    <div className={`${sizeClasses[size]} rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center font-black text-white flex-shrink-0 shadow-lg`}>
      {username.charAt(0).toUpperCase()}
    </div>
  )
}

// ===== SUBMISSION CARD FOR VOTING =====
function SubmissionCard({
  submission,
  onVote,
  onPlay,
  voted,
  isPlaying,
  isCurrentUser,
  rank,
}: {
  submission: BattleSub
  onVote: (id: string) => void
  onPlay: (sub: BattleSub) => void
  voted: string | null
  isPlaying: boolean
  isCurrentUser: boolean
  rank?: number
}) {
  const hasVoted = !!voted
  const isVotedFor = voted === submission.id
  const canVote = !isCurrentUser && !hasVoted

  const rankMedal: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' }

  return (
    <div
      className={[
        'bg-gray-900 border rounded-2xl p-4 transition-all duration-300',
        isVotedFor ? 'border-purple-500 shadow-[0_0_20px_rgba(124,58,237,0.3)]' : 'border-gray-800',
        isPlaying ? 'border-blue-500/50' : '',
        hasVoted && !isVotedFor ? 'opacity-60' : '',
      ].join(' ')}
    >
      <div className="flex items-center gap-3 mb-3">
        <div className="relative">
          <Avatar username={submission.username} userId={submission.userId} size="md" />
          {isPlaying && (
            <span className="absolute -bottom-1 -right-1 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
              <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
            </span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-bold text-white text-sm truncate">{submission.username}</p>
            {rank && rankMedal[rank] && <span className="text-base">{rankMedal[rank]}</span>}
            {isCurrentUser && <span className="text-xs text-purple-400">(You)</span>}
          </div>
          {submission.voteCount > 0 && (
            <p className="text-xs text-gray-400">{submission.voteCount} vote{submission.voteCount !== 1 ? 's' : ''}</p>
          )}
        </div>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => onPlay(submission)}
          className={[
            'flex-1 py-2 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all',
            isPlaying
              ? 'bg-blue-600/30 border border-blue-500/50 text-blue-300'
              : 'bg-gray-800 border border-gray-700 text-gray-300 hover:border-gray-600 hover:text-white',
          ].join(' ')}
        >
          {isPlaying ? (
            <><svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path fillRule="evenodd" d="M6 5a1 1 0 011 1v12a1 1 0 11-2 0V6a1 1 0 011-1zm6 0a1 1 0 011 1v12a1 1 0 11-2 0V6a1 1 0 011-1z" clipRule="evenodd" /></svg> Playing</>
          ) : (
            <><svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg> Preview</>
          )}
        </button>

        <button
          onClick={() => canVote && onVote(submission.id)}
          disabled={!canVote}
          className={[
            'flex-1 py-2 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all',
            isVotedFor
              ? 'bg-purple-600/30 border border-purple-500 text-purple-300'
              : isCurrentUser
              ? 'bg-gray-800/50 border border-gray-700/50 text-gray-600 cursor-not-allowed'
              : hasVoted
              ? 'bg-gray-800/50 border border-gray-700/50 text-gray-500 cursor-not-allowed'
              : 'bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white shadow-lg shadow-purple-900/30',
          ].join(' ')}
        >
          {isVotedFor ? (
            <><svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg> Voted!</>
          ) : isCurrentUser ? (
            'Own track'
          ) : (
            <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg> Vote</>
          )}
        </button>
      </div>
    </div>
  )
}

// ===== RESULTS PODIUM =====
function ResultsPodium({ results }: { results: BattleSub[] }) {
  const top3 = results.slice(0, 3)
  const podiumOrder = top3.length >= 3
    ? [top3[1], top3[0], top3[2]]
    : top3.length === 2
    ? [top3[1], top3[0]]
    : top3

  const heights = ['h-20', 'h-32', 'h-16']
  const medals = ['🥈', '🥇', '🥉']
  const rankMap: Record<number, string> = {
    0: top3.length >= 3 ? '2nd' : '2nd',
    1: '1st',
    2: '3rd',
  }

  return (
    <div className="flex items-end justify-center gap-4 mb-8">
      {podiumOrder.map((submission, i) => {
        if (!submission) return null
        const isWinner = i === 1

        return (
          <div key={submission.id} className="flex flex-col items-center gap-3">
            <Avatar username={submission.username} userId={submission.userId} size={isWinner ? 'xl' : 'lg'} />

            <div className="text-center">
              <p className={`font-black ${isWinner ? 'text-lg' : 'text-sm'} text-white`}>{submission.username}</p>
              <p className="text-xs text-gray-400">{submission.voteCount} vote{submission.voteCount !== 1 ? 's' : ''}</p>
            </div>

            <div
              className={[
                `${heights[i]} w-20 rounded-t-xl flex items-center justify-center`,
                i === 1 ? 'podium-1st w-24' : i === 0 ? 'podium-2nd' : 'podium-3rd',
              ].join(' ')}
            >
              <div className="text-center">
                <div className="text-2xl">{medals[i]}</div>
                <p className="text-xs text-gray-400 font-semibold">{rankMap[i]}</p>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ===== MAIN BATTLE PAGE =====
export default function BattlePage() {
  const router = useRouter()
  const params = useParams()
  const lobbyId = params.id as string
  const user = getUser()

  const [state, setState] = useState<BattleState>({
    phase: 'loading',
    lobby: null,
    players: [],
    beatUrl: null,
    timerEnd: null,
    submissions: [],
    currentPreviewIndex: 0,
    userVote: null,
    hasSubmitted: false,
    uploadProgress: 0,
    results: [],
  })

  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [previewSub, setPreviewSub] = useState<BattleSub | null>(null)
  const [mounted, setMounted] = useState(false)

  const socketRef = useRef(getSocket())

  const addMessage = useCallback((msg: ChatMessage) => {
    setMessages((prev) => [...prev, msg])
  }, [])

  const addSystemMessage = useCallback((text: string) => {
    addMessage({
      id: Math.random().toString(36).slice(2),
      type: 'system',
      content: text,
      timestamp: new Date().toISOString(),
    })
  }, [addMessage])

  const loadLobby = useCallback(async () => {
    try {
      const { lobby } = await api.lobbies.get(lobbyId)
      // Convert nested Submission to flat BattleSub
      const subs: BattleSub[] = (lobby.submissions || []).map((s) => ({
        id: s.id,
        userId: s.userId,
        username: s.user?.username ?? '',
        fileName: s.fileName,
        fileUrl: s.fileUrl,
        voteCount: s.votes?.length ?? 0,
        createdAt: s.createdAt,
      }))
      const mySubmission = subs.find((s) => s.userId === user?.id)
      setState((prev) => ({
        ...prev,
        phase: (lobby.phase as BattlePhase) || 'battle',
        lobby,
        players: lobby.players,
        beatUrl: lobby.beatUrl,
        timerEnd: lobby.timerEnd,
        submissions: subs,
        hasSubmitted: !!mySubmission,
      }))
    } catch {
      showToast('Failed to load battle.', 'error')
    }
  }, [lobbyId, user?.id])

  useEffect(() => {
    setMounted(true)
    if (!isLoggedIn()) {
      router.replace('/login')
      return
    }
    loadLobby()
  }, [router, loadLobby])

  useEffect(() => {
    if (!mounted || !user) return

    const socket = socketRef.current
    socket.emit('join-lobby', { lobbyId })

    socket.on('lobby-state', (data: { lobby: Lobby }) => {
      const lob = data.lobby
      const subs: BattleSub[] = (lob.submissions || []).map((s) => ({
        id: s.id,
        userId: s.userId,
        username: s.user?.username ?? '',
        fileName: s.fileName,
        fileUrl: s.fileUrl,
        voteCount: s.votes?.length ?? 0,
        createdAt: s.createdAt,
      }))
      setState((prev) => ({
        ...prev,
        phase: (lob.phase as BattlePhase) || prev.phase,
        lobby: lob,
        players: lob.players,
        beatUrl: lob.beatUrl,
        timerEnd: lob.timerEnd,
        submissions: subs,
        hasSubmitted: !!subs.find((s) => s.userId === user?.id),
      }))
    })

    socket.on('game-started', (data: { beatUrl?: string; timerEnd?: string }) => {
      setState((prev) => ({
        ...prev,
        phase: 'battle',
        beatUrl: data.beatUrl || prev.beatUrl,
        timerEnd: data.timerEnd || prev.timerEnd,
      }))
      addSystemMessage('Battle has started! Upload your track!')
    })

    // phase-changed payload varies by phase:
    // battle: { phase, beatUrl, beatName, timerEnd, timerDuration }
    // preview: { phase, submission: BattleSub (flat), index, total }
    // voting: { phase }
    // results: { phase, results: ResultEntry[], winner: ResultEntry }
    socket.on('phase-changed', (data: {
      phase: string
      beatUrl?: string
      timerEnd?: string
      submission?: BattleSub
      index?: number
      total?: number
      results?: BattleSub[]
      winner?: BattleSub
    }) => {
      setState((prev) => ({
        ...prev,
        phase: data.phase as BattlePhase,
        beatUrl: data.beatUrl ?? prev.beatUrl,
        timerEnd: data.timerEnd ?? prev.timerEnd,
        results: data.results ?? prev.results,
        currentPreviewIndex: data.index ?? 0,
      }))

      if (data.phase === 'battle') {
        addSystemMessage('Battle has started! Upload your track before time runs out!')
      } else if (data.phase === 'preview') {
        addSystemMessage('Preview phase! Listen to all submissions.')
        if (data.submission) setPreviewSub(data.submission)
      } else if (data.phase === 'voting') {
        addSystemMessage('Voting phase! Cast your vote for the best track!')
        setPreviewSub(null)
      } else if (data.phase === 'results') {
        addSystemMessage('Results are in!')
      }
    })

    socket.on('preview-playing', (data: { index?: number; submissionIndex?: number; submission: BattleSub }) => {
      setState((prev) => ({ ...prev, currentPreviewIndex: data.index ?? data.submissionIndex ?? prev.currentPreviewIndex }))
      if (data.submission) setPreviewSub(data.submission)
    })

    socket.on('submission-added', (data: { submission: { id: string; userId: string; username: string; fileName: string; createdAt: string } }) => {
      const sub = data.submission
      const newSub: BattleSub = { ...sub, fileUrl: '', voteCount: 0 }
      setState((prev) => {
        const exists = prev.submissions.find((s) => s.id === sub.id)
        const updated = exists ? prev.submissions : [...prev.submissions, newSub]
        addSystemMessage(`${sub.username} submitted their track!`)
        return { ...prev, submissions: updated }
      })
    })

    socket.on('submission-count-updated', (data: { count: number; total: number }) => {
      addSystemMessage(`${data.count}/${data.total} players have submitted their tracks.`)
    })

    socket.on('chat-message', (msg: { userId: string; username: string; message: string; timestamp: string }) => {
      addMessage({
        id: Math.random().toString(36).slice(2),
        type: 'user',
        userId: msg.userId,
        username: msg.username,
        content: msg.message,
        timestamp: msg.timestamp,
      })
    })

    socket.on('lobby-updated', (data: { players: LobbyPlayer[] }) => {
      setState((prev) => ({ ...prev, players: data.players }))
    })

    socket.on('vote-updated', (data: { submissions: BattleSub[] }) => {
      setState((prev) => ({ ...prev, submissions: data.submissions }))
    })

    return () => {
      socket.emit('leave-lobby', { lobbyId })
      socket.off('lobby-state')
      socket.off('game-started')
      socket.off('phase-changed')
      socket.off('preview-playing')
      socket.off('submission-added')
      socket.off('submission-count-updated')
      socket.off('chat-message')
      socket.off('lobby-updated')
      socket.off('vote-updated')
    }
  }, [mounted, user, lobbyId, addMessage, addSystemMessage])

  if (!mounted || !user) return null

  const { phase, lobby, beatUrl, timerEnd, submissions, userVote, hasSubmitted, results } = state

  const handleSubmit = async () => {
    if (!selectedFile) {
      showToast('Please select a file to submit.', 'error')
      return
    }
    setSubmitting(true)
    try {
      const formData = new FormData()
      formData.append('audio', selectedFile)
      await api.battles.submit(lobbyId, formData)
      setState((prev) => ({ ...prev, hasSubmitted: true }))
      showToast('Track submitted!', 'success')
      addSystemMessage('You submitted your track!')
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to submit track.', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const handleVote = async (submissionId: string) => {
    if (userVote) return
    try {
      await api.battles.vote(lobbyId, submissionId)
      setState((prev) => ({ ...prev, userVote: submissionId }))
      showToast('Vote cast!', 'success')
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to vote.', 'error')
    }
  }

  const handleSendMessage = (message: string) => {
    socketRef.current.emit('chat-message', { lobbyId, message })
    addMessage({
      id: Math.random().toString(36).slice(2),
      type: 'user',
      userId: user.id,
      username: user.username,
      content: message,
      timestamp: new Date().toISOString(),
    })
  }

  const isHost = lobby?.hostId === user.id
  const displayResults = results.length > 0 ? results : submissions.sort((a, b) => b.voteCount - a.voteCount)
  const winner = displayResults[0]

  // ===== LOADING =====
  if (phase === 'loading') {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <ToastContainer />
        <div className="text-center">
          <div className="w-12 h-12 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Loading battle...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      <ToastContainer />

      {/* RESULTS confetti */}
      {phase === 'results' && <Confetti />}

      {/* Header */}
      <header className="bg-gray-900 border-b border-gray-800 px-6 py-3 flex-shrink-0">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <span className="text-white font-black text-lg">{lobby?.name || 'Battle'}</span>
              <span className={`badge ${
                phase === 'battle' ? 'badge-battle' :
                phase === 'preview' ? 'badge-preview' :
                phase === 'voting' ? 'badge-voting' :
                phase === 'results' ? 'badge-results' :
                'badge-waiting'
              }`}>
                {phase === 'battle' ? '🔥 BATTLE' :
                 phase === 'preview' ? '🎵 PREVIEW' :
                 phase === 'voting' ? '🗳️ VOTING' :
                 phase === 'results' ? '🏆 RESULTS' : phase.toUpperCase()}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {timerEnd && phase !== 'results' && (
              <Timer timerEnd={timerEnd} compact />
            )}
            <span className="text-gray-500 text-sm">{state.players.length} players</span>
          </div>
        </div>
      </header>

      <div className="flex-1 max-w-7xl mx-auto w-full p-6 flex gap-6 min-h-0">
        {/* Main content */}
        <div className="flex-1 min-w-0 overflow-y-auto space-y-5">

          {/* ===== BATTLE PHASE ===== */}
          {phase === 'battle' && (
            <>
              {/* Timer */}
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 text-center">
                <Timer timerEnd={timerEnd} label="Time Remaining" />
              </div>

              {/* Beat Player */}
              {beatUrl && (
                <div>
                  <h2 className="text-white font-bold mb-3 flex items-center gap-2">
                    <span>🥁</span> The Beat
                  </h2>
                  <AudioPlayer src={beatUrl} title="Battle Beat" username="Host" autoPlay />
                  <div className="mt-2 text-center">
                    <a
                      href={beatUrl}
                      download="battle-beat"
                      className="inline-flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      Download Beat
                    </a>
                  </div>
                </div>
              )}

              {/* Upload section */}
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
                <h2 className="font-bold text-white mb-4 flex items-center gap-2">
                  <span>🎤</span> Submit Your Track
                </h2>

                {hasSubmitted ? (
                  <UploadArea onFileSelect={() => {}} submitted={true} />
                ) : (
                  <>
                    <UploadArea
                      onFileSelect={(f) => setSelectedFile(f)}
                      disabled={submitting}
                    />
                    <div className="mt-3">
                      <Button
                        fullWidth
                        size="lg"
                        onClick={handleSubmit}
                        loading={submitting}
                        disabled={!selectedFile || submitting}
                      >
                        {submitting ? 'Uploading...' : '🚀 Submit Track'}
                      </Button>
                    </div>
                  </>
                )}
              </div>
            </>
          )}

          {/* ===== PREVIEW PHASE ===== */}
          {phase === 'preview' && (
            <>
              <div className="text-center py-4">
                <h2 className="text-3xl font-black gradient-text mb-1">NOW PLAYING</h2>
                <p className="text-gray-400 text-sm">
                  Song {state.currentPreviewIndex + 1} of {submissions.length}
                </p>
              </div>

              {previewSub ? (
                <div className="bg-gray-900 border border-blue-500/30 rounded-2xl p-6">
                  <div className="flex items-center justify-center mb-5">
                    <div className="text-center">
                      <Avatar
                        username={previewSub.username}
                        userId={previewSub.userId}
                        size="xl"
                      />
                      <h3 className="text-2xl font-black text-white mt-3">{previewSub.username}</h3>
                      <p className="text-gray-400 text-sm">Track submission</p>
                    </div>
                  </div>
                  <AudioPlayer
                    src={previewSub.fileUrl}
                    title={`${previewSub.username}'s Track`}
                    username={previewSub.username}
                    autoPlay
                  />
                </div>
              ) : (
                <div className="text-center py-12 bg-gray-900 border border-gray-800 rounded-2xl">
                  <div className="w-12 h-12 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                  <p className="text-gray-400">Waiting for preview to start...</p>
                </div>
              )}

              {/* Progress dots */}
              {submissions.length > 0 && (
                <div className="flex justify-center gap-2">
                  {submissions.map((_, i) => (
                    <div
                      key={i}
                      className={[
                        'w-2 h-2 rounded-full transition-all duration-300',
                        i === state.currentPreviewIndex ? 'bg-purple-400 w-6' : 'bg-gray-700',
                      ].join(' ')}
                    />
                  ))}
                </div>
              )}
            </>
          )}

          {/* ===== VOTING PHASE ===== */}
          {phase === 'voting' && (
            <>
              <div className="text-center py-4">
                <h2 className="text-3xl font-black gradient-text mb-1">CAST YOUR VOTE</h2>
                <p className="text-gray-400 text-sm mb-2">Vote for the best track. You can&apos;t vote for your own.</p>
                {timerEnd && <Timer timerEnd={timerEnd} compact />}
              </div>

              {userVote && (
                <div className="bg-green-500/10 border border-green-500/30 rounded-2xl p-4 flex items-center gap-3">
                  <svg className="w-5 h-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <p className="text-green-400 font-semibold">Vote submitted! Waiting for results...</p>
                </div>
              )}

              {/* Preview player for inline listening */}
              {previewSub && (
                <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
                  <p className="text-xs text-gray-500 mb-3 uppercase tracking-widest">Previewing</p>
                  <AudioPlayer
                    src={previewSub.fileUrl}
                    title={`${previewSub.username}'s Track`}
                    username={previewSub.username}
                    compact
                  />
                </div>
              )}

              {submissions.length === 0 ? (
                <div className="text-center py-12 bg-gray-900 border border-gray-800 rounded-2xl">
                  <div className="text-4xl mb-3">🎵</div>
                  <p className="text-gray-400">No submissions to vote on</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {submissions.map((sub, i) => (
                    <SubmissionCard
                      key={sub.id}
                      submission={sub}
                      onVote={handleVote}
                      onPlay={(s) => setPreviewSub(previewSub?.id === s.id ? null : s)}
                      voted={userVote}
                      isPlaying={previewSub?.id === sub.id}
                      isCurrentUser={sub.userId === user.id}
                      rank={i + 1}
                    />
                  ))}
                </div>
              )}
            </>
          )}

          {/* ===== RESULTS PHASE ===== */}
          {phase === 'results' && (
            <>
              <div className="text-center py-6 animate-bounce-in">
                <h2 className="text-5xl font-black gradient-text-gold mb-2">RESULTS</h2>
                <p className="text-gray-400">The votes are in!</p>
              </div>

              {winner && (
                <div className="bg-gradient-to-r from-yellow-500/10 to-amber-500/10 border border-yellow-500/30 rounded-2xl p-6 text-center animate-slide-up">
                  <p className="text-yellow-400 text-sm font-semibold uppercase tracking-widest mb-2">Winner</p>
                  <Avatar username={winner.username} userId={winner.userId} size="xl" />
                  <h3 className="text-3xl font-black text-white mt-4">{winner.username}</h3>
                  <p className="text-yellow-400 font-semibold">{winner.voteCount} vote{winner.voteCount !== 1 ? 's' : ''}</p>
                  <div className="text-6xl mt-4">🏆</div>
                </div>
              )}

              {displayResults.length >= 2 && (
                <div className="animate-slide-up" style={{ animationDelay: '200ms' }}>
                  <ResultsPodium results={displayResults} />
                </div>
              )}

              {/* Full leaderboard */}
              {displayResults.length > 0 && (
                <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden animate-slide-up" style={{ animationDelay: '300ms' }}>
                  <div className="px-5 py-3 border-b border-gray-800">
                    <h3 className="font-bold text-white">Full Results</h3>
                  </div>
                  <div className="divide-y divide-gray-800">
                    {displayResults.map((sub, i) => {
                      const medals = ['🥇', '🥈', '🥉']
                      const isWinner = i === 0

                      return (
                        <div
                          key={sub.id}
                          className={[
                            'flex items-center gap-4 px-5 py-3.5 transition-colors',
                            isWinner ? 'bg-yellow-500/5' : 'hover:bg-gray-800/50',
                          ].join(' ')}
                        >
                          <span className={`w-8 text-center font-black text-lg ${isWinner ? '' : 'text-gray-500'}`}>
                            {medals[i] || `#${i + 1}`}
                          </span>
                          <Avatar username={sub.username} userId={sub.userId} size="sm" />
                          <div className="flex-1 min-w-0">
                            <p className={`font-semibold text-sm truncate ${isWinner ? 'text-yellow-300' : 'text-white'}`}>
                              {sub.username}
                              {sub.userId === user.id && <span className="text-gray-500 ml-2">(You)</span>}
                            </p>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className={`font-bold ${isWinner ? 'text-yellow-400' : 'text-gray-300'}`}>
                              {sub.voteCount} {sub.voteCount === 1 ? 'vote' : 'votes'}
                            </span>
                            <button
                              onClick={() => setPreviewSub(previewSub?.id === sub.id ? null : sub)}
                              className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white transition-all"
                            >
                              {previewSub?.id === sub.id ? (
                                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                                  <path fillRule="evenodd" d="M6 5a1 1 0 011 1v12a1 1 0 11-2 0V6a1 1 0 011-1zm6 0a1 1 0 011 1v12a1 1 0 11-2 0V6a1 1 0 011-1z" clipRule="evenodd" />
                                </svg>
                              ) : (
                                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                                  <path d="M8 5v14l11-7z" />
                                </svg>
                              )}
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Preview player in results */}
              {previewSub && (
                <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 animate-slide-up">
                  <AudioPlayer
                    src={previewSub.fileUrl}
                    title={`${previewSub.username}'s Track`}
                    username={previewSub.username}
                    autoPlay
                  />
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 pb-6 animate-slide-up" style={{ animationDelay: '400ms' }}>
                {isHost && (
                  <Button
                    variant="primary"
                    fullWidth
                    onClick={() => router.push(`/lobby/${lobbyId}`)}
                  >
                    🔄 Play Again
                  </Button>
                )}
                <Button
                  variant="secondary"
                  fullWidth
                  onClick={() => router.push('/browse')}
                >
                  Browse Lobbies
                </Button>
                <Button
                  variant="ghost"
                  fullWidth
                  onClick={() => router.push('/dashboard')}
                >
                  Dashboard
                </Button>
              </div>
            </>
          )}
        </div>

        {/* Right panel - Chat */}
        <div className="w-72 flex-shrink-0 h-full">
          <Chat
            messages={messages}
            onSend={handleSendMessage}
            currentUserId={user.id}
          />
        </div>
      </div>
    </div>
  )
}
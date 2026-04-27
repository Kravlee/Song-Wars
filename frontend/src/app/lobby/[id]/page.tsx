'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { isLoggedIn, getUser } from '@/lib/auth'
import { api, Lobby, LobbyPlayer, Player, toPlayer, YouTubeVideo } from '@/lib/api'
import { getSocket } from '@/lib/socket'
import PlayerList from '@/components/lobby/PlayerList'
import Chat, { ChatMessage } from '@/components/lobby/Chat'
import UploadArea from '@/components/battle/UploadArea'
import SpectatorMode from '@/components/battle/SpectatorMode'
import BeatDownload from '@/components/battle/BeatDownload'
import Button from '@/components/ui/Button'
import { showToast, ToastContainer } from '@/components/ui/Toast'

const TIMER_OPTIONS = [
  { value: 15, label: '15 min' },
  { value: 30, label: '30 min' },
  { value: 45, label: '45 min' },
  { value: 60, label: '1 hour' },
]

const GENRES = [
  { value: 'trap', label: 'Trap' },
  { value: 'drill', label: 'Drill' },
  { value: 'lo-fi', label: 'Lo-Fi' },
  { value: 'r&b', label: 'R&B' },
  { value: 'pop', label: 'Pop' },
  { value: 'afrobeats', label: 'Afrobeats' },
  { value: 'gospel', label: 'Gospel' },
  { value: 'jazz', label: 'Jazz' },
  { value: 'classical', label: 'Classical' },
]

const phaseLabel: Record<string, string> = {
  waiting: 'Waiting for Players',
  battle: 'Battle in Progress',
  preview: 'Preview Phase',
  voting: 'Voting Phase',
  results: 'Results',
}

const phaseBadgeClass: Record<string, string> = {
  waiting: 'bg-gray-700 text-gray-300',
  battle: 'bg-red-500/20 text-red-400 border border-red-500/30',
  preview: 'bg-blue-500/20 text-blue-400 border border-blue-500/30',
  voting: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30',
  results: 'bg-green-500/20 text-green-400 border border-green-500/30',
}

interface SpectatorSub {
  id: string
  userId: string
  username: string
  fileName: string
  fileUrl: string
  voteCount: number
  createdAt: string
}

export default function LobbyPage() {
  const router = useRouter()
  const params = useParams()
  const lobbyId = params.id as string

  const [mounted, setMounted] = useState(false)
  const [lobby, setLobby] = useState<Lobby | null>(null)
  const [players, setPlayers] = useState<Player[]>([])
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isReady, setIsReady] = useState(false)
  const [loading, setLoading] = useState(true)
  const [isPlayer, setIsPlayer] = useState(false)

  // Start modal state
  const [showStartModal, setShowStartModal] = useState(false)
  const [selectedBeat, setSelectedBeat] = useState<YouTubeVideo | null>(null)
  const [timerDuration, setTimerDuration] = useState(30)
  const [starting, setStarting] = useState(false)
  const [useFileBeat, setUseFileBeat] = useState(false)

  // Genre + beat finder state
  const [selectedGenre, setSelectedGenre] = useState<string>('')
  const [beatResults, setBeatResults] = useState<YouTubeVideo[]>([])
  const [searchingBeat, setSearchingBeat] = useState(false)

  // Spectator voting state
  const [spectatorSubs, setSpectatorSubs] = useState<SpectatorSub[]>([])
  const [spectatorVote, setSpectatorVote] = useState<string | null>(null)
  const [previewPlaying, setPreviewPlaying] = useState<SpectatorSub | null>(null)

  const [copied, setCopied] = useState(false)
  const [togglingReady, setTogglingReady] = useState(false)

  const user = getUser()
  const socketRef = useRef(getSocket())
  const autoOpenedStartModal = useRef(false)

  const lobbyToPlayers = useCallback((lob: Lobby): Player[] => {
    return (lob.players || []).map((lp: LobbyPlayer) => toPlayer(lp, lob.hostId))
  }, [])

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

  const fetchLobby = useCallback(async () => {
    try {
      const { lobby: data } = await api.lobbies.get(lobbyId)
      setLobby(data)
      const flat = lobbyToPlayers(data)
      setPlayers(flat)
      const inPlayers = flat.some((p) => p.id === user?.id)
      setIsPlayer(inPlayers)
      const me = flat.find((p) => p.id === user?.id)
      if (me) setIsReady(me.isReady)
      // Load submissions for spectator voting
      if (data.submissions?.length) {
        setSpectatorSubs(data.submissions.map((s) => ({
          id: s.id,
          userId: s.userId,
          username: s.user?.username ?? '',
          fileName: s.fileName,
          fileUrl: s.fileUrl,
          voteCount: s.votes?.length ?? 0,
          createdAt: s.createdAt,
        })))
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to load lobby.', 'error')
      router.push('/browse')
    } finally {
      setLoading(false)
    }
  }, [lobbyId, user?.id, router, lobbyToPlayers])

  useEffect(() => {
    setMounted(true)
    if (!isLoggedIn()) {
      router.replace('/login')
    }
  }, [router])

  useEffect(() => {
    if (!mounted) return
    fetchLobby()
  }, [mounted, fetchLobby])

  useEffect(() => {
    if (!mounted || !user) return

    const socket = socketRef.current
    socket.emit('join-lobby', { lobbyId })

    socket.on('lobby-state', (data: { lobby: Lobby }) => {
      setLobby(data.lobby)
      const flat = lobbyToPlayers(data.lobby)
      setPlayers(flat)
      const inPlayers = flat.some((p) => p.id === user.id)
      setIsPlayer(inPlayers)
      const me = flat.find((p) => p.id === user.id)
      if (me) setIsReady(me.isReady)
    })

    socket.on('player-joined', (data: { player: { userId: string; username: string }; players: LobbyPlayer[] }) => {
      setMessages((prev) => [...prev, {
        id: Math.random().toString(36).slice(2),
        type: 'system',
        content: `${data.player.username} joined the lobby`,
        timestamp: new Date().toISOString(),
      }])
      if (data.players && lobby) {
        setPlayers(data.players.map((lp) => toPlayer(lp, lobby.hostId)))
      }
    })

    socket.on('player-left', (data: { userId: string; username: string }) => {
      setPlayers((prev) => prev.filter((p) => p.id !== data.userId))
      setMessages((prev) => [...prev, {
        id: Math.random().toString(36).slice(2),
        type: 'system',
        content: `${data.username} left the lobby`,
        timestamp: new Date().toISOString(),
      }])
    })

    socket.on('host-changed', (data: { newHostId: string }) => {
      setLobby((prev) => prev ? { ...prev, hostId: data.newHostId } : prev)
      setPlayers((prev) => prev.map((p) => ({ ...p, isHost: p.id === data.newHostId })))
      setMessages((prev) => [...prev, {
        id: Math.random().toString(36).slice(2),
        type: 'system',
        content: 'Host role transferred.',
        timestamp: new Date().toISOString(),
      }])
    })

    socket.on('lobby-updated', (data: { players: LobbyPlayer[] }) => {
      setLobby((prev) => {
        if (!prev) return prev
        const flat = data.players.map((lp) => toPlayer(lp, prev.hostId))
        setPlayers(flat)
        const me = flat.find((p) => p.id === user.id)
        if (me) setIsReady(me.isReady)
        return prev
      })
    })

    socket.on('chat-message', (msg: { id?: string; userId: string; username: string; message: string; timestamp: string }) => {
      addMessage({
        id: msg.id || Math.random().toString(36).slice(2),
        type: 'user',
        userId: msg.userId,
        username: msg.username,
        content: msg.message,
        timestamp: msg.timestamp,
      })
    })

    socket.on('phase-changed', (data: { phase: string; beatUrl?: string; beatName?: string; timerEnd?: string; submission?: SpectatorSub; index?: number; total?: number; results?: SpectatorSub[]; winner?: SpectatorSub }) => {
      setLobby((prev) => prev ? {
        ...prev,
        phase: data.phase as Lobby['phase'],
        beatUrl: data.beatUrl ?? prev.beatUrl,
        timerEnd: data.timerEnd ?? prev.timerEnd,
      } : prev)

      if (data.phase === 'battle') {
        showToast('Battle started!', 'success')
        // Only redirect players — spectators stay here
        setIsPlayer((currentIsPlayer) => {
          if (currentIsPlayer) {
            router.push(`/battle/${lobbyId}`)
          }
          return currentIsPlayer
        })
      } else if (data.phase === 'preview') {
        addSystemMessage('Preview phase started!')
        if (data.submission) setPreviewPlaying(data.submission)
      } else if (data.phase === 'voting') {
        addSystemMessage('Voting phase! Cast your vote for the best track.')
        setPreviewPlaying(null)
        // Refresh submissions for spectator voting
        api.lobbies.get(lobbyId).then(({ lobby: fresh }) => {
          if (fresh.submissions?.length) {
            setSpectatorSubs(fresh.submissions.map((s) => ({
              id: s.id,
              userId: s.userId,
              username: s.user?.username ?? '',
              fileName: s.fileName,
              fileUrl: s.fileUrl,
              voteCount: s.votes?.length ?? 0,
              createdAt: s.createdAt,
            })))
          }
        }).catch(() => {})
      } else if (data.phase === 'results') {
        if (data.results) {
          setSpectatorSubs(data.results)
        }
        addSystemMessage('Results are in!')
      }
    })

    socket.on('submission-added', (data: { submission: { id: string; userId: string; username: string; fileName: string; createdAt: string } }) => {
      const sub = data.submission
      setSpectatorSubs((prev) => {
        if (prev.find((s) => s.id === sub.id)) return prev
        return [...prev, { ...sub, fileUrl: '', voteCount: 0 }]
      })
      addSystemMessage(`${sub.username} submitted their track!`)
    })

    socket.on('lobby-closed', () => {
      showToast('Lobby was closed.', 'error')
      router.push('/browse')
    })

    return () => {
      socket.emit('leave-lobby', { lobbyId })
      socket.off('lobby-state')
      socket.off('player-joined')
      socket.off('player-left')
      socket.off('host-changed')
      socket.off('lobby-updated')
      socket.off('chat-message')
      socket.off('phase-changed')
      socket.off('submission-added')
      socket.off('lobby-closed')
    }
  }, [mounted, user, lobbyId, addMessage, addSystemMessage, router])

  // Auto-open start modal once when all non-host players are ready
  useEffect(() => {
    if (!lobby || lobby.phase !== 'waiting' || !isHost) return
    const nonHostPlayers = players.filter((p) => !p.isHost)
    const allReady = players.length > 1 && nonHostPlayers.length > 0 && nonHostPlayers.every((p) => p.isReady)
    if (allReady && !autoOpenedStartModal.current) {
      autoOpenedStartModal.current = true
      setShowStartModal(true)
    }
    if (!allReady) {
      autoOpenedStartModal.current = false
    }
  }, [players, isHost, lobby])

  if (!mounted || !user) return null

  const isHost = lobby?.hostId === user.id
  const allReady = players.length > 1 && players.filter(p => !p.isHost).every(p => p.isReady)

  const handleCopyCode = async () => {
    if (!lobby?.code) return
    await navigator.clipboard.writeText(lobby.code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleToggleReady = () => {
    setTogglingReady(true)
    try {
      socketRef.current.emit('player-ready', { lobbyId, isReady: !isReady })
      setIsReady(!isReady)
    } finally {
      setTogglingReady(false)
    }
  }

  const handleFindBeat = async () => {
    setSearchingBeat(true)
    setBeatResults([])
    setSelectedBeat(null)
    try {
      if (!selectedGenre || selectedGenre === 'random') {
        const beat = await api.beats.random()
        setSelectedBeat(beat)
        setBeatResults([beat])
      } else {
        const { videos } = await api.beats.search(`${selectedGenre} type beat free`)
        if (videos.length > 0) {
          setBeatResults(videos.slice(0, 5))
          setSelectedBeat(videos[0])
        } else {
          showToast('No beats found for this genre. Try another.', 'error')
        }
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to find beat.', 'error')
    } finally {
      setSearchingBeat(false)
    }
  }

  const handleStartGame = async (e: React.FormEvent) => {
    e.preventDefault()
<<<<<<< HEAD
    if (!selectedBeat) {
      showToast('Please select a beat.', 'error')
=======

    if (useFileBeat && !beatFile) {
      showToast('Please upload a beat file.', 'error')
>>>>>>> e2e00d5 (Update battles, lobbies, socket, and frontend pages)
      return
    }
    if (!useFileBeat && !selectedBeat) {
      showToast('Please find and select a beat first.', 'error')
      return
    }

    setStarting(true)
    try {
      const formData = new FormData()
<<<<<<< HEAD
      formData.append('beatUrl', selectedBeat.url)
      formData.append('beatName', selectedBeat.title)
=======
      if (useFileBeat && beatFile) {
        formData.append('beat', beatFile)
      } else if (selectedBeat) {
        formData.append('beatYoutubeUrl', selectedBeat.url)
        formData.append('beatTitle', selectedBeat.title)
      }
>>>>>>> e2e00d5 (Update battles, lobbies, socket, and frontend pages)
      formData.append('timerDuration', String(timerDuration))
      await api.lobbies.start(lobbyId, formData)
      setShowStartModal(false)
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to start game.', 'error')
    } finally {
      setStarting(false)
    }
  }

  const handleLeaveLobby = async () => {
    try {
      if (isPlayer) await api.lobbies.leave(lobbyId)
    } catch (err) {
      console.error('Error leaving lobby:', err)
    } finally {
      router.push('/browse')
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

  const handleSpectatorVote = async (submissionId: string) => {
    if (spectatorVote) return
    try {
      await api.battles.vote(lobbyId, submissionId)
      setSpectatorVote(submissionId)
      setSpectatorSubs((prev) =>
        prev.map((s) => s.id === submissionId ? { ...s, voteCount: s.voteCount + 1 } : s)
      )
      showToast('Vote cast!', 'success')
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to vote.', 'error')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Loading lobby...</p>
        </div>
      </div>
    )
  }

  if (!lobby) return null

  const phase = lobby.phase

  return (
    <div className="min-h-screen bg-gray-950">
      <ToastContainer />

      {/* Header */}
      <header className="bg-gray-900 border-b border-gray-800 px-6 py-4 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={handleLeaveLobby}
              className="text-gray-500 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-gray-800"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-xl font-black text-white">{lobby.name}</h1>
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${phaseBadgeClass[phase] || phaseBadgeClass.waiting}`}>
                  {phaseLabel[phase] || phase}
                </span>
                {!isPlayer && phase !== 'waiting' && (
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-purple-500/20 text-purple-400 border border-purple-500/30">
                    👁 Spectating
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-gray-500 font-mono tracking-[0.2em]">{lobby.code}</span>
                <button
                  onClick={handleCopyCode}
                  className="text-xs text-purple-400 hover:text-purple-300 transition-colors flex items-center gap-1"
                >
                  {copied ? '✓ Copied!' : 'Copy Code'}
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-400">
              <span className="text-white font-semibold">{players.length}</span>/{lobby.maxPlayers} players
            </span>
          </div>
        </div>
      </header>

      {/* Main layout */}
      <div className="max-w-7xl mx-auto p-6 flex gap-6" style={{ height: 'calc(100vh - 73px)' }}>
        {/* Left panel */}
        <div className="flex-1 min-w-0 flex flex-col gap-5 overflow-y-auto pr-1">
          {/* Players */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-white flex items-center gap-2">
                <span>👥</span>
                <span>Players</span>
                <span className="text-gray-500 font-normal text-sm">({players.length}/{lobby.maxPlayers})</span>
              </h2>
              {allReady && phase === 'waiting' && (
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-green-500/20 text-green-400 border border-green-500/30 animate-pulse">
                  All Ready!
                </span>
              )}
            </div>
            <PlayerList players={players} currentUserId={user.id} />
          </div>

          {/* Controls — only in waiting phase, only for players */}
          {phase === 'waiting' && isPlayer && (
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-4">
              <h2 className="font-bold text-white">Controls</h2>

              {!isHost && (
                <div className="flex items-center justify-between p-4 bg-gray-800/50 rounded-xl">
                  <div>
                    <p className="font-semibold text-white text-sm">Ready Status</p>
                    <p className="text-gray-400 text-xs mt-0.5">
                      {isReady ? "You're ready to battle!" : 'Click when ready to start'}
                    </p>
                  </div>
                  <button
                    onClick={handleToggleReady}
                    disabled={togglingReady}
                    className={[
                      'px-4 py-2 rounded-xl font-semibold text-sm transition-all duration-200 border',
                      isReady
                        ? 'bg-green-500/20 border-green-500/50 text-green-400 hover:bg-red-500/10 hover:border-red-500/40 hover:text-red-400'
                        : 'bg-purple-600/20 border-purple-500/50 text-purple-400 hover:bg-purple-600/30',
                      togglingReady ? 'opacity-50 cursor-not-allowed' : '',
                    ].join(' ')}
                  >
                    {isReady ? '✓ Ready' : 'Mark Ready'}
                  </button>
                </div>
              )}

              {isHost && (
                <div className="p-4 bg-gray-800/50 rounded-xl">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-semibold text-white text-sm">Start the Battle</p>
                      <p className="text-gray-400 text-xs mt-0.5">
                        {players.length < 2
                          ? 'Need at least 2 players to start'
                          : !allReady
                          ? 'Players are still getting ready'
                          : 'All players are ready — let\'s go!'}
                      </p>
                    </div>
                    <Button
                      onClick={() => setShowStartModal(true)}
                      disabled={players.length < 2}
                      variant={allReady ? 'primary' : 'secondary'}
                      size="sm"
                    >
                      {allReady ? '🔥 Start Game' : 'Start Anyway'}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Waiting phase spectator notice */}
          {phase === 'waiting' && !isPlayer && (
            <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-6 text-center">
              <div className="text-4xl mb-3">👁</div>
              <h3 className="text-white font-bold text-lg mb-1">Spectating</h3>
              <p className="text-gray-400 text-sm">The game hasn&apos;t started yet. You can watch when it does — the lobby is full or game is in progress.</p>
            </div>
          )}

          {/* Spectator: Battle in Progress */}
          {phase === 'battle' && !isPlayer && (
            <div className="bg-gradient-to-br from-red-900/20 to-orange-900/20 border border-red-500/30 rounded-2xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="text-4xl">🔥</div>
                <div>
                  <h3 className="text-white font-bold text-xl">Battle In Progress</h3>
                  <p className="text-gray-400 text-sm">Players are recording their tracks</p>
                </div>
              </div>
              {spectatorSubs.length > 0 && (
                <div className="space-y-2">
                  <p className="text-gray-500 text-xs uppercase tracking-wider font-semibold mb-2">Submitted so far</p>
                  {spectatorSubs.map((s) => (
                    <div key={s.id} className="flex items-center gap-3 py-2 px-3 bg-gray-800/50 rounded-xl">
                      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-xs font-black text-white">
                        {s.username.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-gray-300 text-sm font-medium">{s.username}</span>
                      <span className="ml-auto text-green-400 text-xs">✓ Submitted</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Spectator: Preview Phase */}
          {phase === 'preview' && !isPlayer && (
            <div className="bg-gradient-to-br from-blue-900/20 to-purple-900/20 border border-blue-500/30 rounded-2xl p-6 text-center">
              <div className="text-4xl mb-3">🎵</div>
              <h3 className="text-white font-bold text-xl mb-1">Preview Phase</h3>
              {previewPlaying ? (
                <p className="text-blue-400 font-semibold">Now playing: {previewPlaying.username}&apos;s track</p>
              ) : (
                <p className="text-gray-400">Listening to all submissions</p>
              )}
            </div>
          )}

          {/* Spectator: Voting Phase */}
          {phase === 'voting' && !isPlayer && (
            <div className="bg-gray-900 border border-yellow-500/30 rounded-2xl p-5">
              <div className="text-center mb-5">
                <h3 className="text-2xl font-black text-white mb-1">🗳️ Cast Your Vote</h3>
                <p className="text-gray-400 text-sm">You&apos;re spectating — vote for the best track!</p>
              </div>

              {spectatorVote && (
                <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-3 mb-4 flex items-center gap-2">
                  <svg className="w-4 h-4 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <p className="text-green-400 text-sm font-semibold">Vote submitted!</p>
                </div>
              )}

              {spectatorSubs.length === 0 ? (
                <p className="text-center text-gray-500 py-6">No submissions yet</p>
              ) : (
                <div className="space-y-3">
                  {spectatorSubs.map((sub) => {
                    const isVotedFor = spectatorVote === sub.id
                    const hasVoted = !!spectatorVote
                    return (
                      <div
                        key={sub.id}
                        className={[
                          'flex items-center gap-3 p-4 rounded-xl border transition-all',
                          isVotedFor ? 'border-purple-500 bg-purple-500/10' : 'border-gray-800 bg-gray-800/50',
                        ].join(' ')}
                      >
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center font-black text-white text-sm flex-shrink-0">
                          {sub.username.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-white text-sm truncate">{sub.username}</p>
                          {sub.voteCount > 0 && (
                            <p className="text-xs text-gray-500">{sub.voteCount} vote{sub.voteCount !== 1 ? 's' : ''}</p>
                          )}
                        </div>
                        {sub.fileUrl && (
                          <button
                            onClick={() => setPreviewPlaying(previewPlaying?.id === sub.id ? null : sub)}
                            className="p-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white transition-all"
                          >
                            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M8 5v14l11-7z" />
                            </svg>
                          </button>
                        )}
                        <button
                          onClick={() => !hasVoted && handleSpectatorVote(sub.id)}
                          disabled={hasVoted}
                          className={[
                            'px-3 py-1.5 rounded-lg text-xs font-semibold transition-all',
                            isVotedFor
                              ? 'bg-purple-600/30 text-purple-300 border border-purple-500'
                              : hasVoted
                              ? 'bg-gray-700/50 text-gray-600 cursor-not-allowed'
                              : 'bg-gradient-to-r from-purple-600 to-blue-600 text-white hover:from-purple-500 hover:to-blue-500',
                          ].join(' ')}
                        >
                          {isVotedFor ? '✓ Voted' : 'Vote'}
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Mini audio player for preview */}
              {previewPlaying?.fileUrl && (
                <div className="mt-4 p-3 bg-gray-800 rounded-xl">
                  <p className="text-xs text-gray-500 mb-2">Previewing: {previewPlaying.username}</p>
                  <audio src={previewPlaying.fileUrl} controls className="w-full h-8" />
                </div>
              )}
            </div>
          )}

          {/* Spectator: Results */}
          {phase === 'results' && !isPlayer && (
            <div className="bg-gray-900 border border-green-500/30 rounded-2xl p-5">
              <div className="text-center mb-5">
                <h3 className="text-2xl font-black text-white mb-1">🏆 Results</h3>
              </div>
              {spectatorSubs.length > 0 ? (
                <div className="space-y-2">
                  {[...spectatorSubs].sort((a, b) => b.voteCount - a.voteCount).map((sub, i) => {
                    const medals = ['🥇', '🥈', '🥉']
                    return (
                      <div key={sub.id} className={['flex items-center gap-3 p-3 rounded-xl border', i === 0 ? 'border-yellow-500/40 bg-yellow-500/5' : 'border-gray-800'].join(' ')}>
                        <span className="text-xl w-8 text-center">{medals[i] || `#${i + 1}`}</span>
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center font-black text-white text-xs">
                          {sub.username.charAt(0).toUpperCase()}
                        </div>
                        <span className={`font-semibold text-sm flex-1 ${i === 0 ? 'text-yellow-300' : 'text-white'}`}>{sub.username}</span>
                        <span className={`text-sm font-bold ${i === 0 ? 'text-yellow-400' : 'text-gray-400'}`}>{sub.voteCount} votes</span>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <p className="text-center text-gray-500">No results yet</p>
              )}
            </div>
          )}

          {/* Player in-progress redirect banner */}
          {phase !== 'waiting' && isPlayer && (
            <div className="bg-gradient-to-br from-purple-900/30 to-blue-900/30 border border-purple-500/30 rounded-2xl p-8 text-center">
              <div className="text-5xl mb-4">🔥</div>
              <h3 className="text-white font-bold text-xl mb-2">You&apos;re in the battle!</h3>
              <p className="text-gray-400 mb-5">Phase: <span className="text-purple-400 font-semibold">{phaseLabel[phase]}</span></p>
              <Button onClick={() => router.push(`/battle/${lobbyId}`)}>
                Go to Battle →
              </Button>
            </div>
          )}

          {/* Invite section */}
          <div className="bg-gray-900/50 border border-gray-800/50 rounded-2xl p-5">
            <h3 className="font-semibold text-white text-sm mb-3">Invite Friends</h3>
            <div className="flex gap-2">
              <div className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 font-mono text-purple-400 text-sm tracking-[0.2em]">
                {lobby.code}
              </div>
              <button
                onClick={handleCopyCode}
                className="px-4 py-2.5 bg-purple-600/20 border border-purple-500/30 text-purple-400 rounded-xl text-sm font-medium hover:bg-purple-600/30 transition-colors"
              >
                {copied ? '✓ Copied' : 'Copy'}
              </button>
            </div>
            <p className="text-gray-600 text-xs mt-2">Share this code with friends so they can join</p>
          </div>
        </div>

        {/* Right panel — Chat */}
        <div className="w-80 flex-shrink-0 h-full flex flex-col">
          <Chat
            messages={messages}
            onSend={handleSendMessage}
            currentUserId={user.id}
          />
        </div>
      </div>

      {/* Start Game Modal */}
      {showStartModal && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setShowStartModal(false) }}
        >
          <div className="bg-gray-900 border border-gray-700 rounded-3xl p-8 w-full max-w-lg shadow-2xl overflow-y-auto max-h-[90vh]">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-black text-white">Start Battle</h2>
                <p className="text-gray-400 text-sm mt-0.5">Choose a beat and set the timer</p>
              </div>
              <button
                onClick={() => setShowStartModal(false)}
                className="text-gray-500 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-gray-800"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleStartGame} className="space-y-5">
              {/* Beat source toggle */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Beat Source</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setUseFileBeat(false)}
                    className={[
                      'flex-1 py-2.5 rounded-xl border text-center text-sm font-semibold transition-all',
                      !useFileBeat
                        ? 'bg-purple-600/20 border-purple-500 text-purple-300'
                        : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600',
                    ].join(' ')}
                  >
                    🔍 Find on YouTube
                  </button>
                  <button
                    type="button"
                    onClick={() => setUseFileBeat(true)}
                    className={[
                      'flex-1 py-2.5 rounded-xl border text-center text-sm font-semibold transition-all',
                      useFileBeat
                        ? 'bg-purple-600/20 border-purple-500 text-purple-300'
                        : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600',
                    ].join(' ')}
                  >
                    📁 Upload File
                  </button>
                </div>
              </div>

              {/* YouTube Beat Finder */}
              {!useFileBeat && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Genre</label>
                    <div className="flex flex-wrap gap-2 mb-3">
                      <button
                        type="button"
                        onClick={() => setSelectedGenre('random')}
                        className={[
                          'px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all',
                          selectedGenre === 'random'
                            ? 'bg-orange-500/20 border-orange-500 text-orange-300'
                            : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600',
                        ].join(' ')}
                      >
                        🎲 Random
                      </button>
                      {GENRES.map((g) => (
                        <button
                          key={g.value}
                          type="button"
                          onClick={() => setSelectedGenre(g.value)}
                          className={[
                            'px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all',
                            selectedGenre === g.value
                              ? 'bg-purple-600/20 border-purple-500 text-purple-300'
                              : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600',
                          ].join(' ')}
                        >
                          {g.label}
                        </button>
                      ))}
                    </div>

                    <Button
                      type="button"
                      variant="secondary"
                      fullWidth
                      onClick={handleFindBeat}
                      loading={searchingBeat}
                      disabled={!selectedGenre || searchingBeat}
                    >
                      {searchingBeat ? 'Searching...' : '🔍 Find Beat'}
                    </Button>
                  </div>

                  {/* Beat results */}
                  {beatResults.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider">Select a beat</p>
                      {beatResults.map((beat) => (
                        <button
                          key={beat.id}
                          type="button"
                          onClick={() => setSelectedBeat(beat)}
                          className={[
                            'w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all',
                            selectedBeat?.id === beat.id
                              ? 'border-purple-500 bg-purple-500/10'
                              : 'border-gray-700 bg-gray-800/50 hover:border-gray-600',
                          ].join(' ')}
                        >
                          {beat.thumbnail && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={beat.thumbnail} alt="" className="w-12 h-9 object-cover rounded-lg flex-shrink-0" />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-white text-xs font-medium truncate">{beat.title}</p>
                            <p className="text-gray-500 text-xs truncate">{beat.url}</p>
                          </div>
                          {selectedBeat?.id === beat.id && (
                            <svg className="w-4 h-4 text-purple-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                          )}
                        </button>
                      ))}
                    </div>
                  )}

                  {selectedBeat && (
                    <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-3 flex items-center gap-2">
                      <svg className="w-4 h-4 text-green-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      <p className="text-green-400 text-xs font-semibold truncate">Beat selected: {selectedBeat.title}</p>
                    </div>
                  )}
                </div>
              )}

              {/* File upload */}
              {useFileBeat && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Beat File <span className="text-purple-400">*</span>
                  </label>
                  <UploadArea onFileSelect={(f) => setBeatFile(f)} submitted={false} />
                </div>
              )}

              {/* Timer duration */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Battle Duration</label>
                <div className="grid grid-cols-4 gap-2">
                  {TIMER_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setTimerDuration(opt.value)}
                      className={[
                        'py-2.5 rounded-xl border text-center text-sm font-semibold transition-all',
                        timerDuration === opt.value
                          ? 'bg-purple-600/20 border-purple-500 text-purple-300'
                          : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600',
                      ].join(' ')}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <Button variant="secondary" fullWidth type="button" onClick={() => setShowStartModal(false)}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  fullWidth
                  loading={starting}
                  disabled={useFileBeat ? !beatFile : !selectedBeat}
                >
                  🔥 Start Battle
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

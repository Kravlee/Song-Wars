'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { isLoggedIn, getUser } from '@/lib/auth'
import { api, Lobby, LobbyPlayer, Player, toPlayer } from '@/lib/api'
import { getSocket } from '@/lib/socket'
import PlayerList from '@/components/lobby/PlayerList'
import Chat, { ChatMessage } from '@/components/lobby/Chat'
import UploadArea from '@/components/battle/UploadArea'
import SpectatorMode from '@/components/battle/SpectatorMode'
import BeatDownload from '@/components/battle/BeatDownload'
import Button from '@/components/ui/Button'
import { showToast, ToastContainer } from '@/components/ui/Toast'
import { YouTubeVideo } from '@/lib/api'

const TIMER_OPTIONS = [
  { value: 15, label: '15 min' },
  { value: 30, label: '30 min' },
  { value: 45, label: '45 min' },
  { value: 60, label: '1 hour' },
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
  const [showStartModal, setShowStartModal] = useState(false)
  const [selectedBeat, setSelectedBeat] = useState<YouTubeVideo | null>(null)
  const [timerDuration, setTimerDuration] = useState(30)
  const [starting, setStarting] = useState(false)
  const [copied, setCopied] = useState(false)
  const [togglingReady, setTogglingReady] = useState(false)

  const user = getUser()
  const socketRef = useRef(getSocket())

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
      const me = flat.find((p) => p.id === user?.id)
      if (me) setIsReady(me.isReady)
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

    socket.on('phase-changed', (data: { phase: string; beatUrl?: string; beatName?: string; timerEnd?: string }) => {
      setLobby((prev) => prev ? {
        ...prev,
        phase: data.phase as Lobby['phase'],
        beatUrl: data.beatUrl ?? prev.beatUrl,
        timerEnd: data.timerEnd ?? prev.timerEnd,
      } : prev)
      if (data.phase === 'battle') {
        showToast('Battle started! Get ready!', 'success')
        router.push(`/battle/${lobbyId}`)
      }
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
      socket.off('lobby-closed')
    }
  }, [mounted, user, lobbyId, addMessage, addSystemMessage, router])

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

  const handleStartGame = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedBeat) {
      showToast('Please select a beat.', 'error')
      return
    }
    setStarting(true)
    try {
      const formData = new FormData()
      formData.append('beatUrl', selectedBeat.url)
      formData.append('beatName', selectedBeat.title)
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
      await api.lobbies.leave(lobbyId)
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
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${phaseBadgeClass[lobby.phase] || phaseBadgeClass.waiting}`}>
                  {phaseLabel[lobby.phase] || lobby.phase}
                </span>
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
              {allReady && lobby.phase === 'waiting' && (
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-green-500/20 text-green-400 border border-green-500/30 animate-pulse">
                  All Ready!
                </span>
              )}
            </div>
            <PlayerList players={players} currentUserId={user.id} />
          </div>

          {/* Controls — only in waiting phase */}
          {lobby.phase === 'waiting' && (
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

          {/* In-progress redirect banner */}
          {lobby.phase !== 'waiting' && (
            <div className="bg-gradient-to-br from-purple-900/30 to-blue-900/30 border border-purple-500/30 rounded-2xl p-8 text-center">
              <div className="text-5xl mb-4">🔥</div>
              <h3 className="text-white font-bold text-xl mb-2">Battle in Progress</h3>
              <p className="text-gray-400 mb-5">Phase: <span className="text-purple-400 font-semibold">{phaseLabel[lobby.phase]}</span></p>
              <Button onClick={() => router.push(`/battle/${lobbyId}`)}>
                Jump In →
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
          <div className="bg-gray-900 border border-gray-700 rounded-3xl p-8 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-black text-white">Start Battle</h2>
                <p className="text-gray-400 text-sm mt-0.5">Upload a beat for everyone to use</p>
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
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Beat File <span className="text-purple-400">*</span>
                </label>
                <UploadArea onFileSelect={(f) => setBeatFile(f)} submitted={false} />
              </div>

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
                <Button type="submit" fullWidth loading={starting} disabled={!beatFile}>
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

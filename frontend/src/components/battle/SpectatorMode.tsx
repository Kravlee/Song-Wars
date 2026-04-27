'use client'

import { useState } from 'react'
import { YouTubeVideo } from '@/lib/api'
import BeatFinder from './BeatFinder'
import Button from '@/components/ui/Button'

interface SpectatorModeProps {
  lobbyName: string
  players: Array<{ id: string; username: string }>
  isHost: boolean
  currentBeat: YouTubeVideo | null
  onBeatSelected: (beat: YouTubeVideo) => void
  timerDuration: number
  onTimerChange: (duration: number) => void
}

const TIMER_OPTIONS = [
  { value: 15, label: '15 min' },
  { value: 30, label: '30 min' },
  { value: 45, label: '45 min' },
  { value: 60, label: '1 hour' },
]

export default function SpectatorMode({
  lobbyName,
  players,
  isHost,
  currentBeat,
  onBeatSelected,
  timerDuration,
  onTimerChange,
}: SpectatorModeProps) {
  const [showBeatFinder, setShowBeatFinder] = useState(false)

  return (
    <div className="space-y-6">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
        <h2 className="text-xl font-black text-white mb-4">{lobbyName}</h2>
        <p className="text-gray-400 text-sm mb-4">
          {players.length} player{players.length !== 1 ? 's' : ''} waiting to start
        </p>

        {isHost && (
          <div className="space-y-4">
            {!currentBeat ? (
              <Button
                variant="primary"
                fullWidth
                onClick={() => setShowBeatFinder(true)}
              >
                🎵 Find a Beat
              </Button>
            ) : (
              <div className="bg-gray-800/50 rounded-xl p-4 mb-4">
                <p className="text-xs text-gray-400 mb-1">Selected Beat</p>
                <p className="text-white font-semibold truncate">{currentBeat.title}</p>
                <button
                  onClick={() => setShowBeatFinder(true)}
                  className="text-purple-400 text-xs hover:text-purple-300 mt-2"
                >
                  Change Beat
                </button>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Battle Duration</label>
              <div className="grid grid-cols-4 gap-2">
                {TIMER_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => onTimerChange(opt.value)}
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
          </div>
        )}
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
        <h3 className="font-bold text-white mb-3 flex items-center gap-2">
          <span>👥</span> Players ({players.length})
        </h3>
        <div className="space-y-2">
          {players.map((player) => (
            <div
              key={player.id}
              className="flex items-center gap-3 p-3 bg-gray-800/30 rounded-lg"
            >
              <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center">
                <span className="text-xs font-bold text-purple-300">{player.username.charAt(0).toUpperCase()}</span>
              </div>
              <span className="text-white text-sm">{player.username}</span>
            </div>
          ))}
        </div>
      </div>

      {showBeatFinder && (
        <BeatFinder
          onBeatSelected={onBeatSelected}
          onClose={() => setShowBeatFinder(false)}
        />
      )}
    </div>
  )
}

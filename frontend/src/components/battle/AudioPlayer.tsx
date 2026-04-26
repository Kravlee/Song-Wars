'use client'

import { useEffect, useRef, useState, useCallback } from 'react'

interface AudioPlayerProps {
  src: string
  title: string
  username?: string
  autoPlay?: boolean
  compact?: boolean
}

function formatTime(seconds: number): string {
  if (isNaN(seconds) || !isFinite(seconds)) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export default function AudioPlayer({
  src,
  title,
  username,
  autoPlay = false,
  compact = false,
}: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const progressBarRef = useRef<HTMLDivElement>(null)

  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(0.8)
  const [isMuted, setIsMuted] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)
  const [progressPercent, setProgressPercent] = useState(0)

  // Update progress
  const handleTimeUpdate = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    setCurrentTime(audio.currentTime)
    if (audio.duration && !isNaN(audio.duration)) {
      setProgressPercent((audio.currentTime / audio.duration) * 100)
    }
  }, [])

  const handleLoadedMetadata = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    setDuration(audio.duration)
    setIsLoading(false)
    if (autoPlay) {
      audio.play().then(() => setIsPlaying(true)).catch(() => {})
    }
  }, [autoPlay])

  const handleEnded = useCallback(() => {
    setIsPlaying(false)
    setProgressPercent(0)
    if (audioRef.current) audioRef.current.currentTime = 0
  }, [])

  const handleError = useCallback(() => {
    setHasError(true)
    setIsLoading(false)
  }, [])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    audio.addEventListener('timeupdate', handleTimeUpdate)
    audio.addEventListener('loadedmetadata', handleLoadedMetadata)
    audio.addEventListener('ended', handleEnded)
    audio.addEventListener('error', handleError)
    audio.addEventListener('waiting', () => setIsLoading(true))
    audio.addEventListener('playing', () => setIsLoading(false))

    // Set initial volume
    audio.volume = volume

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate)
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata)
      audio.removeEventListener('ended', handleEnded)
      audio.removeEventListener('error', handleError)
    }
  }, [handleTimeUpdate, handleLoadedMetadata, handleEnded, handleError, volume])

  // Reset when src changes
  useEffect(() => {
    setIsPlaying(false)
    setCurrentTime(0)
    setProgressPercent(0)
    setDuration(0)
    setIsLoading(true)
    setHasError(false)
  }, [src])

  const togglePlay = async () => {
    const audio = audioRef.current
    if (!audio) return
    try {
      if (isPlaying) {
        audio.pause()
        setIsPlaying(false)
      } else {
        await audio.play()
        setIsPlaying(true)
      }
    } catch {
      setHasError(true)
    }
  }

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current
    const bar = progressBarRef.current
    if (!audio || !bar || !duration) return

    const rect = bar.getBoundingClientRect()
    const x = e.clientX - rect.left
    const pct = Math.max(0, Math.min(1, x / rect.width))
    audio.currentTime = pct * duration
    setProgressPercent(pct * 100)
  }

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value)
    setVolume(val)
    if (audioRef.current) audioRef.current.volume = val
    setIsMuted(val === 0)
  }

  const toggleMute = () => {
    const audio = audioRef.current
    if (!audio) return
    if (isMuted) {
      audio.volume = volume || 0.8
      setIsMuted(false)
    } else {
      audio.volume = 0
      setIsMuted(true)
    }
  }

  if (hasError) {
    return (
      <div className="bg-gray-800/50 border border-red-500/30 rounded-2xl p-4 flex items-center gap-3">
        <span className="text-2xl">⚠️</span>
        <div>
          <p className="text-red-400 font-medium text-sm">Failed to load audio</p>
          <p className="text-gray-500 text-xs">{title}</p>
        </div>
      </div>
    )
  }

  return (
    <div className={`bg-gray-800/60 border border-gray-700 rounded-2xl ${compact ? 'p-3' : 'p-5'} hover:border-purple-500/30 transition-all duration-300`}>
      <audio ref={audioRef} src={src} preload="metadata" />

      {/* Track info */}
      {!compact && (
        <div className="flex items-center gap-4 mb-5">
          {/* Album art placeholder */}
          <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center flex-shrink-0 shadow-lg shadow-purple-900/30 animate-pulse-glow">
            <svg className="w-7 h-7 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-bold text-white text-base truncate">{title}</h3>
            {username && (
              <p className="text-gray-400 text-sm mt-0.5">by {username}</p>
            )}
            {isLoading && (
              <div className="flex items-center gap-1.5 mt-1">
                <div className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                <span className="text-xs text-gray-500 ml-1">Loading...</span>
              </div>
            )}
          </div>
        </div>
      )}

      {compact && (
        <div className="mb-2">
          <p className="font-semibold text-white text-sm truncate">{title}</p>
          {username && <p className="text-gray-500 text-xs">{username}</p>}
        </div>
      )}

      {/* Progress bar */}
      <div className="mb-3">
        <div
          ref={progressBarRef}
          className="w-full h-2 bg-gray-700 rounded-full cursor-pointer group relative"
          onClick={handleProgressClick}
        >
          <div
            className="h-full bg-gradient-to-r from-purple-500 to-blue-500 rounded-full relative transition-all duration-100"
            style={{ width: `${progressPercent}%` }}
          >
            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-md opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </div>
        <div className="flex justify-between text-xs text-gray-500 mt-1.5">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-4">
        {/* Play/Pause */}
        <button
          onClick={togglePlay}
          disabled={isLoading}
          className={[
            'flex items-center justify-center rounded-full bg-gradient-to-r from-purple-600 to-blue-600',
            'hover:from-purple-500 hover:to-blue-500 active:scale-95 transition-all duration-200',
            'shadow-lg shadow-purple-900/40 hover:shadow-purple-800/60',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            compact ? 'w-9 h-9' : 'w-12 h-12',
          ].join(' ')}
        >
          {isLoading ? (
            <svg className="animate-spin w-4 h-4 text-white" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : isPlaying ? (
            <svg className={`${compact ? 'w-4 h-4' : 'w-5 h-5'} text-white`} fill="currentColor" viewBox="0 0 24 24">
              <path fillRule="evenodd" d="M6 5a1 1 0 011 1v12a1 1 0 11-2 0V6a1 1 0 011-1zm6 0a1 1 0 011 1v12a1 1 0 11-2 0V6a1 1 0 011-1z" clipRule="evenodd" />
            </svg>
          ) : (
            <svg className={`${compact ? 'w-4 h-4' : 'w-5 h-5'} text-white ml-0.5`} fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>

        {/* Volume */}
        {!compact && (
          <div className="flex items-center gap-2 ml-auto">
            <button onClick={toggleMute} className="text-gray-400 hover:text-white transition-colors">
              {isMuted || volume === 0 ? (
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
                </svg>
              ) : volume < 0.5 ? (
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M18.5 12c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM5 9v6h4l5 5V4L9 9H5z" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
                </svg>
              )}
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={isMuted ? 0 : volume}
              onChange={handleVolumeChange}
              className="volume-slider"
            />
          </div>
        )}
      </div>
    </div>
  )
}

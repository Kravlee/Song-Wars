'use client'

import { useEffect, useState } from 'react'

interface TimerProps {
  timerEnd: string | null
  label?: string
  compact?: boolean
}

interface TimeLeft {
  hours: number
  minutes: number
  seconds: number
  total: number
}

function calcTimeLeft(timerEnd: string): TimeLeft {
  const diff = Math.max(0, new Date(timerEnd).getTime() - Date.now())
  const total = Math.floor(diff / 1000)
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = total % 60
  return { hours, minutes, seconds, total }
}

function pad(n: number): string {
  return n.toString().padStart(2, '0')
}

export default function Timer({ timerEnd, label, compact = false }: TimerProps) {
  const [timeLeft, setTimeLeft] = useState<TimeLeft | null>(null)
  const [expired, setExpired] = useState(false)

  useEffect(() => {
    if (!timerEnd) return

    const update = () => {
      const t = calcTimeLeft(timerEnd)
      if (t.total <= 0) {
        setExpired(true)
        setTimeLeft({ hours: 0, minutes: 0, seconds: 0, total: 0 })
      } else {
        setExpired(false)
        setTimeLeft(t)
      }
    }

    update()
    const interval = setInterval(update, 1000)
    return () => clearInterval(interval)
  }, [timerEnd])

  if (!timerEnd) {
    return (
      <div className="flex flex-col items-center gap-2">
        {label && <p className="text-gray-400 text-sm uppercase tracking-widest">{label}</p>}
        <div className={`font-mono font-black text-gray-600 ${compact ? 'text-3xl' : 'text-6xl'}`}>
          --:--
        </div>
      </div>
    )
  }

  if (expired || !timeLeft) {
    return (
      <div className="flex flex-col items-center gap-2">
        {label && <p className="text-gray-400 text-sm uppercase tracking-widest">{label}</p>}
        <div
          className={[
            'font-mono font-black text-red-400 animate-pulse',
            compact ? 'text-2xl' : 'text-5xl',
          ].join(' ')}
        >
          TIME&apos;S UP!
        </div>
      </div>
    )
  }

  const { hours, minutes, seconds, total } = timeLeft

  // Color progression: green -> yellow -> red
  let colorClass = 'text-green-400'
  let glowClass = 'drop-shadow-[0_0_10px_rgba(74,222,128,0.6)]'

  if (total < 60) {
    colorClass = 'text-red-400'
    glowClass = 'drop-shadow-[0_0_10px_rgba(248,113,113,0.8)] animate-pulse'
  } else if (total < 300) {
    colorClass = 'text-yellow-400'
    glowClass = 'drop-shadow-[0_0_10px_rgba(250,204,21,0.6)]'
  }

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        {label && <span className="text-gray-400 text-xs uppercase tracking-widest">{label}:</span>}
        <span className={`font-mono font-bold text-xl ${colorClass}`}>
          {hours > 0
            ? `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
            : `${pad(minutes)}:${pad(seconds)}`}
        </span>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-3">
      {label && (
        <p className="text-gray-400 text-xs font-semibold uppercase tracking-[0.2em]">{label}</p>
      )}

      <div className={`flex items-center gap-1 font-mono font-black ${glowClass}`}>
        {hours > 0 && (
          <>
            <TimeBlock value={hours} label="HR" color={colorClass} large />
            <span className={`text-5xl ${colorClass} opacity-70`}>:</span>
          </>
        )}
        <TimeBlock value={minutes} label="MIN" color={colorClass} large />
        <span className={`text-5xl ${colorClass} opacity-70`}>:</span>
        <TimeBlock value={seconds} label="SEC" color={colorClass} large />
      </div>

      {/* Progress bar */}
      {total < 300 && (
        <div className="w-full max-w-xs">
          <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
            <div
              className={[
                'h-full rounded-full transition-all duration-1000',
                total < 60 ? 'bg-red-500' : 'bg-yellow-500',
              ].join(' ')}
              style={{ width: `${Math.min(100, (total / 300) * 100)}%` }}
            />
          </div>
          <p className={`text-center text-xs mt-1 font-medium ${total < 60 ? 'text-red-400' : 'text-yellow-400'}`}>
            {total < 60 ? 'Almost out of time!' : 'Running low...'}
          </p>
        </div>
      )}
    </div>
  )
}

function TimeBlock({
  value,
  label,
  color,
  large = false,
}: {
  value: number
  label: string
  color: string
  large?: boolean
}) {
  return (
    <div className="flex flex-col items-center">
      <div
        className={[
          'font-mono font-black tabular-nums',
          large ? 'text-6xl' : 'text-4xl',
          color,
        ].join(' ')}
      >
        {pad(value)}
      </div>
      <span className="text-gray-600 text-[10px] font-semibold tracking-widest mt-0.5">
        {label}
      </span>
    </div>
  )
}

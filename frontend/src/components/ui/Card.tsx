'use client'

import React from 'react'

interface CardProps {
  children: React.ReactNode
  className?: string
  glass?: boolean
  glow?: boolean
  glowColor?: 'purple' | 'blue' | 'green' | 'red' | 'gold'
  hover?: boolean
  onClick?: () => void
  padding?: 'none' | 'sm' | 'md' | 'lg'
}

const glowStyles: Record<string, string> = {
  purple: 'shadow-[0_0_30px_rgba(124,58,237,0.25)] border-purple-500/30',
  blue: 'shadow-[0_0_30px_rgba(59,130,246,0.25)] border-blue-500/30',
  green: 'shadow-[0_0_30px_rgba(34,197,94,0.25)] border-green-500/30',
  red: 'shadow-[0_0_30px_rgba(239,68,68,0.25)] border-red-500/30',
  gold: 'shadow-[0_0_30px_rgba(251,191,36,0.25)] border-yellow-500/30',
}

const paddingStyles: Record<string, string> = {
  none: '',
  sm: 'p-3',
  md: 'p-5',
  lg: 'p-7',
}

export default function Card({
  children,
  className = '',
  glass = false,
  glow = false,
  glowColor = 'purple',
  hover = false,
  onClick,
  padding = 'md',
}: CardProps) {
  const baseClasses = glass
    ? 'glass'
    : 'bg-gray-900 border border-gray-800'

  return (
    <div
      onClick={onClick}
      className={[
        baseClasses,
        'rounded-2xl',
        paddingStyles[padding],
        glow ? glowStyles[glowColor] : '',
        hover ? 'card-hover cursor-pointer' : '',
        onClick ? 'cursor-pointer' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </div>
  )
}

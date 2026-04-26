'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { isLoggedIn } from '@/lib/auth'

const stats = [
  { icon: '⚔️', label: 'Battles Fought', value: '1,000+', color: 'from-purple-600/20 to-purple-600/5', border: 'border-purple-500/20' },
  { icon: '🎤', label: 'Artists Competing', value: '500+', color: 'from-blue-600/20 to-blue-600/5', border: 'border-blue-500/20' },
  { icon: '🗳️', label: 'Real-time Votes', value: '50k+', color: 'from-violet-600/20 to-violet-600/5', border: 'border-violet-500/20' },
]

const features = [
  { icon: '🎵', title: 'Upload Your Track', desc: 'Submit your original music and go head to head' },
  { icon: '🔥', title: 'Live Competition', desc: 'Real-time battles with instant community feedback' },
  { icon: '🏆', title: 'Climb the Ranks', desc: 'Win battles and dominate the global leaderboard' },
]

export default function LandingPage() {
  const router = useRouter()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    if (isLoggedIn()) {
      router.replace('/dashboard')
    }
  }, [router])

  if (!mounted) return null

  return (
    <div className="relative min-h-screen bg-gray-950 overflow-hidden flex flex-col">
      {/* Background orbs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="orb orb-purple w-[600px] h-[600px] -top-40 -right-20 opacity-50" />
        <div className="orb orb-blue w-[400px] h-[400px] bottom-20 -left-20 opacity-40" style={{ animationDelay: '2s' }} />
        <div className="orb orb-purple w-[300px] h-[300px] top-1/2 left-1/3 opacity-20" style={{ animationDelay: '4s' }} />

        {/* Grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
            backgroundSize: '60px 60px',
          }}
        />
      </div>

      {/* Nav */}
      <nav className="relative z-10 flex items-center justify-between px-8 py-5 max-w-7xl mx-auto w-full">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center shadow-lg shadow-purple-900/40">
            🎵
          </div>
          <span className="text-lg font-black gradient-text tracking-tight">SONG WARS</span>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="px-4 py-2 text-sm font-semibold text-gray-300 hover:text-white transition-colors"
          >
            Login
          </Link>
          <Link
            href="/register"
            className="px-4 py-2 text-sm font-semibold bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white rounded-xl transition-all duration-200 shadow-lg shadow-purple-900/30"
          >
            Get Started
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 py-20 text-center">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-300 text-xs font-semibold mb-8 animate-fade-in">
          <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
          Live Battles Running Now
        </div>

        {/* Main title */}
        <h1 className="text-7xl md:text-8xl lg:text-9xl font-black tracking-tight mb-6 animate-slide-up" style={{ animationDelay: '100ms' }}>
          <span className="gradient-text">SONG</span>
          <br />
          <span className="gradient-text">WARS</span>
        </h1>

        <p className="text-xl md:text-2xl text-gray-400 mb-4 max-w-lg animate-slide-up font-light" style={{ animationDelay: '200ms' }}>
          Battle for the best song.
        </p>
        <p className="text-base text-gray-500 mb-12 max-w-md animate-slide-up" style={{ animationDelay: '300ms' }}>
          Upload your track, compete in real-time, let the community decide who reigns supreme.
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row items-center gap-4 mb-16 animate-slide-up" style={{ animationDelay: '400ms' }}>
          <Link
            href="/register"
            className="px-10 py-4 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white text-lg font-bold rounded-2xl transition-all duration-300 shadow-xl shadow-purple-900/40 hover:shadow-purple-800/60 hover:scale-[1.03] active:scale-[0.98] glow-purple"
          >
            Start Competing
          </Link>
          <Link
            href="/login"
            className="px-10 py-4 bg-gray-900 hover:bg-gray-800 text-white text-lg font-bold rounded-2xl border border-gray-700 hover:border-gray-600 transition-all duration-300"
          >
            Sign In
          </Link>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl w-full mb-20 animate-slide-up" style={{ animationDelay: '500ms' }}>
          {stats.map((stat, i) => (
            <div
              key={stat.label}
              className={[
                `bg-gradient-to-br ${stat.color} border ${stat.border} rounded-2xl p-5 text-center`,
                'hover:scale-[1.03] transition-all duration-300 cursor-default',
                i === 0 ? 'animate-float' : i === 1 ? 'animate-float-delayed' : 'animate-float-slow',
              ].join(' ')}
            >
              <div className="text-3xl mb-2">{stat.icon}</div>
              <div className="text-2xl font-black text-white">{stat.value}</div>
              <div className="text-xs text-gray-400 mt-1">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Features */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-3xl w-full mb-16 animate-fade-in" style={{ animationDelay: '600ms' }}>
          {features.map((f) => (
            <div key={f.title} className="glass rounded-2xl p-5 text-left hover:border-purple-500/20 transition-colors duration-300">
              <div className="text-2xl mb-3">{f.icon}</div>
              <h3 className="font-bold text-white mb-1.5">{f.title}</h3>
              <p className="text-gray-500 text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>

        {/* Quick links */}
        <div className="flex items-center gap-6 text-sm text-gray-500 animate-fade-in" style={{ animationDelay: '700ms' }}>
          <Link href="/browse" className="hover:text-purple-400 transition-colors flex items-center gap-1.5">
            <span>🔍</span> Browse Lobbies
          </Link>
          <span className="text-gray-700">•</span>
          <Link href="/register" className="hover:text-purple-400 transition-colors flex items-center gap-1.5">
            <span>🎵</span> Create a Lobby
          </Link>
          <span className="text-gray-700">•</span>
          <Link href="/leaderboard" className="hover:text-purple-400 transition-colors flex items-center gap-1.5">
            <span>🏆</span> Leaderboard
          </Link>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 text-center py-6 text-gray-700 text-xs border-t border-gray-900">
        <p>Song Wars © 2026 · Built for artists, by artists</p>
      </footer>
    </div>
  )
}

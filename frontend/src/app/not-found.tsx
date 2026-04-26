'use client'

import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center text-center px-6">
      {/* Background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="orb orb-purple w-80 h-80 top-20 right-20 opacity-30" />
        <div className="orb orb-blue w-60 h-60 bottom-20 left-20 opacity-20" />
      </div>

      <div className="relative z-10 animate-slide-up">
        <div className="text-9xl font-black gradient-text mb-4">404</div>
        <h1 className="text-3xl font-black text-white mb-3">Page Not Found</h1>
        <p className="text-gray-400 mb-8 max-w-sm mx-auto">
          Looks like this page dropped out of the battle. Let&apos;s get you back to the arena.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/dashboard"
            className="px-8 py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-bold rounded-xl transition-all duration-200 shadow-lg shadow-purple-900/30"
          >
            Go to Dashboard
          </Link>
          <Link
            href="/"
            className="px-8 py-3 bg-gray-900 border border-gray-700 hover:border-gray-600 text-white font-bold rounded-xl transition-all duration-200"
          >
            Home
          </Link>
        </div>
      </div>
    </div>
  )
}

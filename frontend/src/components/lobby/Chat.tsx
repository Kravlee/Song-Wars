'use client'

import { useEffect, useRef, useState } from 'react'

export interface ChatMessage {
  id: string
  type: 'user' | 'system'
  username?: string
  userId?: string
  content: string
  timestamp: string
}

interface ChatProps {
  messages: ChatMessage[]
  onSend: (message: string) => void
  disabled?: boolean
  currentUserId?: string
}

const usernameColors = [
  'text-purple-400',
  'text-blue-400',
  'text-pink-400',
  'text-green-400',
  'text-yellow-400',
  'text-cyan-400',
  'text-orange-400',
  'text-red-400',
]

function getUsernameColor(userId?: string): string {
  if (!userId) return 'text-gray-400'
  let hash = 0
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash)
  }
  return usernameColors[Math.abs(hash) % usernameColors.length]
}

function formatTime(timestamp: string): string {
  const date = new Date(timestamp)
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export default function Chat({ messages, onSend, disabled = false, currentUserId }: ChatProps) {
  const [input, setInput] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = () => {
    const trimmed = input.trim()
    if (!trimmed || disabled) return
    onSend(trimmed)
    setInput('')
    inputRef.current?.focus()
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="flex flex-col h-full bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-800 flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-green-400 shadow-[0_0_6px_rgba(74,222,128,0.8)]" />
        <h3 className="font-semibold text-white text-sm">Live Chat</h3>
        <span className="ml-auto text-xs text-gray-500">{messages.length} messages</span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2 min-h-0">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <span className="text-3xl mb-2">💬</span>
            <p className="text-gray-500 text-sm">No messages yet.</p>
            <p className="text-gray-600 text-xs">Say hi to the group!</p>
          </div>
        ) : (
          messages.map((msg) => {
            if (msg.type === 'system') {
              return (
                <div key={msg.id} className="flex justify-center">
                  <span className="text-xs text-gray-600 bg-gray-800/50 px-3 py-1 rounded-full">
                    {msg.content}
                  </span>
                </div>
              )
            }

            const isOwn = msg.userId === currentUserId
            const colorClass = getUsernameColor(msg.userId)

            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'} gap-0.5`}
              >
                {!isOwn && (
                  <span className={`text-xs font-semibold ${colorClass} px-1`}>
                    {msg.username}
                  </span>
                )}
                <div className={[
                  'max-w-[85%] px-3 py-2 rounded-2xl text-sm leading-relaxed',
                  isOwn
                    ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-tr-sm'
                    : 'bg-gray-800 text-gray-200 rounded-tl-sm',
                ].join(' ')}>
                  {msg.content}
                </div>
                <span className="text-xs text-gray-600 px-1">
                  {formatTime(msg.timestamp)}
                </span>
              </div>
            )
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t border-gray-800">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            placeholder={disabled ? 'Chat disabled...' : 'Say something...'}
            maxLength={200}
            className={[
              'flex-1 bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-500',
              'focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/30 transition-all',
              disabled ? 'opacity-50 cursor-not-allowed' : '',
            ].join(' ')}
          />
          <button
            onClick={handleSend}
            disabled={disabled || !input.trim()}
            className={[
              'px-3 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 text-white transition-all duration-200',
              'hover:from-purple-500 hover:to-blue-500 active:scale-95',
              disabled || !input.trim() ? 'opacity-50 cursor-not-allowed' : '',
            ].join(' ')}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
        {input.length > 150 && (
          <p className="text-xs text-yellow-400 mt-1 text-right">{200 - input.length} chars left</p>
        )}
      </div>
    </div>
  )
}

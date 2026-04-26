'use client'

interface Player {
  id: string
  username: string
  isReady: boolean
  isHost: boolean
}

interface PlayerListProps {
  players: Player[]
  currentUserId: string
}

const avatarColors = [
  'from-purple-500 to-blue-500',
  'from-pink-500 to-purple-500',
  'from-blue-500 to-cyan-500',
  'from-green-500 to-teal-500',
  'from-orange-500 to-pink-500',
  'from-yellow-500 to-orange-500',
  'from-red-500 to-pink-500',
  'from-indigo-500 to-purple-500',
]

function getAvatarColor(userId: string): string {
  let hash = 0
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash)
  }
  return avatarColors[Math.abs(hash) % avatarColors.length]
}

export default function PlayerList({ players, currentUserId }: PlayerListProps) {
  if (players.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p className="text-4xl mb-2">👥</p>
        <p className="text-sm">No players yet</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {players.map((player, index) => {
        const isCurrentUser = player.id === currentUserId
        const gradientClass = getAvatarColor(player.id)

        return (
          <div
            key={player.id}
            className={[
              'flex items-center gap-3 px-4 py-3 rounded-xl border transition-all duration-200',
              isCurrentUser
                ? 'bg-purple-600/10 border-purple-500/30'
                : 'bg-gray-800/50 border-gray-700/50 hover:border-gray-600',
            ].join(' ')}
            style={{ animationDelay: `${index * 50}ms` }}
          >
            {/* Avatar */}
            <div className={`relative w-10 h-10 rounded-full bg-gradient-to-br ${gradientClass} flex items-center justify-center flex-shrink-0 font-bold text-white text-sm shadow-md`}>
              {player.username.charAt(0).toUpperCase()}
              {/* Online indicator */}
              <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-400 rounded-full border-2 border-gray-900" />
            </div>

            {/* Username + badges */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`font-semibold text-sm truncate ${isCurrentUser ? 'text-purple-300' : 'text-white'}`}>
                  {player.username}
                </span>

                {isCurrentUser && (
                  <span className="text-xs text-purple-400 font-medium">(You)</span>
                )}

                {player.isHost && (
                  <span className="badge badge-voting text-[10px] px-1.5 py-0.5">
                    HOST
                  </span>
                )}
              </div>
            </div>

            {/* Ready status */}
            <div className="flex items-center gap-2 flex-shrink-0">
              {player.isReady ? (
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-green-400 shadow-[0_0_6px_rgba(74,222,128,0.8)]" />
                  <span className="text-xs text-green-400 font-medium">Ready</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-gray-600" />
                  <span className="text-xs text-gray-500 font-medium">Waiting</span>
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

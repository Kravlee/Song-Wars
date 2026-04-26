import { getToken } from './auth'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

async function request<T = unknown>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken()
  const isFormData = options.body instanceof FormData

  const headers: Record<string, string> = {}

  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  // Don't set Content-Type for FormData — browser sets multipart boundary
  if (!isFormData) {
    headers['Content-Type'] = 'application/json'
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      ...headers,
      ...(options.headers as Record<string, string> || {}),
    },
  })

  let data: unknown
  const contentType = response.headers.get('content-type')
  if (contentType && contentType.includes('application/json')) {
    data = await response.json()
  } else {
    data = await response.text()
  }

  if (!response.ok) {
    const message =
      (typeof data === 'object' && data !== null && 'message' in data
        ? (data as { message: string }).message
        : null) ||
      (typeof data === 'object' && data !== null && 'error' in data
        ? (data as { error: string }).error
        : null) ||
      `Request failed with status ${response.status}`
    throw new ApiError(message as string, response.status)
  }

  return data as T
}

// ===== TYPE DEFINITIONS =====

export interface AuthUser {
  id: string
  username: string
  email: string
  wins: number
  battles: number
}

export interface AuthResponse {
  token: string
  user: AuthUser
}

// Matches backend: LobbyPlayer with nested user relation
export interface LobbyPlayer {
  id: string          // lobby_player record id
  lobbyId: string
  userId: string
  isReady: boolean
  joinedAt: string
  user: {
    id: string
    username: string
  }
}

// Flat player shape used by UI components
export interface Player {
  id: string          // userId
  username: string
  isReady: boolean
  isHost: boolean
}

export function toPlayer(lp: LobbyPlayer, hostId: string): Player {
  return {
    id: lp.userId,
    username: lp.user?.username ?? '',
    isReady: lp.isReady,
    isHost: lp.userId === hostId,
  }
}

export interface SubmissionVote {
  id: string
  voterId: string
}

export interface Submission {
  id: string
  lobbyId: string
  userId: string
  fileName: string
  fileUrl: string
  createdAt: string
  user: {
    id: string
    username: string
  }
  votes: SubmissionVote[]
}

export interface Lobby {
  id: string
  name: string
  code: string
  phase: 'waiting' | 'battle' | 'preview' | 'voting' | 'results'
  maxPlayers: number
  timerDuration: number
  timerEnd: string | null
  beatUrl: string | null
  beatName: string | null
  hostId: string
  host: {
    id: string
    username: string
  }
  players: LobbyPlayer[]
  submissions: Submission[]
  createdAt: string
}

// Lobby list item (public list endpoint — less data)
export interface LobbyListItem {
  id: string
  name: string
  code: string
  isPublic: boolean
  maxPlayers: number
  phase: string
  hostId: string
  hostName: string
  playerCount: number
  timerEnd: string | null
  createdAt: string
}

export interface ResultEntry {
  id: string
  userId: string
  username: string
  fileName: string
  fileUrl: string
  voteCount: number
  createdAt: string
}

export interface BattleResults {
  lobby: { id: string; name: string; phase: string }
  results: ResultEntry[]
  winner: ResultEntry | null
}

export interface UserStats {
  id: string
  username: string
  email: string
  wins: number
  battles: number
  submissions: number
  winRate: number
  createdAt: string
}

export interface RecentBattle {
  id: string
  name: string
  code: string
  phase: string
  hostName: string
  playerCount: number
  joinedAt: string
  submitted: boolean
  submissionFileName: string | null
  voteCount: number
  isWinner: boolean
  winnerUsername: string | null
  createdAt: string
}

// ===== API CLIENT =====

export const api = {
  auth: {
    register: (data: { username: string; email: string; password: string }) =>
      request<AuthResponse>('/auth/register', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    login: (data: { email: string; password: string }) =>
      request<AuthResponse>('/auth/login', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    me: () =>
      request<AuthUser>('/auth/me'),
  },

  lobbies: {
    list: (phase?: string) =>
      request<{ lobbies: LobbyListItem[] }>(`/lobbies${phase ? `?phase=${phase}` : ''}`),
    create: (data: { name: string; isPublic: boolean; maxPlayers: number; timerDuration: number }) =>
      request<{ lobby: Lobby }>('/lobbies', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    get: (id: string) =>
      request<{ lobby: Lobby }>(`/lobbies/${id}`),
    join: (id: string) =>
      request<{ lobby: Lobby }>(`/lobbies/${id}/join`, { method: 'POST' }),
    leave: (id: string) =>
      request<{ message: string }>(`/lobbies/${id}/leave`, { method: 'POST' }),
    start: (id: string, formData: FormData) =>
      request<{ lobby: Lobby }>(`/lobbies/${id}/start`, {
        method: 'POST',
        body: formData,
      }),
    findByCode: (code: string) =>
      request<{ lobby: { id: string; name: string; code: string; phase: string } }>(`/lobbies/code/${code}`),
  },

  battles: {
    submit: (id: string, formData: FormData) =>
      request<{ submission: Submission }>(`/battles/${id}/submit`, {
        method: 'POST',
        body: formData,
      }),
    vote: (id: string, submissionId: string) =>
      request<{ vote: { id: string } }>(`/battles/${id}/vote`, {
        method: 'POST',
        body: JSON.stringify({ submissionId }),
      }),
    results: (id: string) =>
      request<BattleResults>(`/battles/${id}/results`),
  },

  users: {
    stats: () =>
      request<{ stats: UserStats }>('/users/stats'),
    recent: () =>
      request<{ battles: RecentBattle[] }>('/users/recent'),
  },
}

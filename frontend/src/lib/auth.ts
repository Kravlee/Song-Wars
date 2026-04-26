export interface User {
  id: string
  username: string
  email: string
  wins: number
  battles: number
}

export const getToken = (): string | null => {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('sw_token')
}

export const getUser = (): User | null => {
  if (typeof window === 'undefined') return null
  try {
    return JSON.parse(localStorage.getItem('sw_user') || 'null')
  } catch {
    return null
  }
}

export const setAuth = (token: string, user: User): void => {
  localStorage.setItem('sw_token', token)
  localStorage.setItem('sw_user', JSON.stringify(user))
}

export const clearAuth = (): void => {
  localStorage.removeItem('sw_token')
  localStorage.removeItem('sw_user')
}

export const isLoggedIn = (): boolean => !!getToken()

export const updateUser = (updates: Partial<User>): void => {
  const user = getUser()
  if (user) {
    localStorage.setItem('sw_user', JSON.stringify({ ...user, ...updates }))
  }
}

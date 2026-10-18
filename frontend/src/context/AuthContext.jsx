import React, { createContext, useContext, useEffect, useState } from 'react'
import { authApi } from '../api/authApi'
import { userApi } from '../api/userApi'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('accessToken')
    if (!token) {
      setLoading(false)
      return
    }
    // Session restore on app reopen (plan section 4): if the access/refresh token is
    // still valid, the user is taken straight back in without re-entering credentials.
    userApi
      .me()
      .then((res) => setUser(res.data))
      .catch(() => {
        localStorage.clear()
      })
      .finally(() => setLoading(false))
  }, [])

  const login = async (username, password) => {
    const { data } = await authApi.login({ username, password })
    persistSession(data)
  }

  // payload: { email, verificationToken, username, displayName, password }
  const register = async (payload) => {
    const { data } = await authApi.register(payload)
    persistSession(data)
  }

  const persistSession = (data) => {
    localStorage.setItem('accessToken', data.accessToken)
    localStorage.setItem('refreshToken', data.refreshToken)
    setUser({
      userId: data.userId,
      username: data.username,
      displayName: data.displayName,
      role: data.role,
    })
  }

  const logout = async () => {
    try {
      await authApi.logout()
    } catch (e) {
      // ignore network errors on logout - clear local session regardless
    }
    localStorage.clear()
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, setUser, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}

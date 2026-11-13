import React, { createContext, useContext, useEffect, useState } from "react"
import { authApi } from "../api/authApi"
import { userApi } from "../api/userApi"

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem("accessToken")
    if (!token) {
      setLoading(false)
      return
    }
    // Khôi phục phiên khi mở lại ứng dụng: token còn hạn thì vào thẳng, không cần đăng nhập lại.
    // /api/users/me không trả về role nên role được lưu cùng phiên đăng nhập.
    userApi
      .me()
      .then((res) => setUser({ ...res.data, role: localStorage.getItem("userRole") || "USER" }))
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
    localStorage.setItem("accessToken", data.accessToken)
    localStorage.setItem("refreshToken", data.refreshToken)
    localStorage.setItem("userRole", data.role || "USER")
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
      // lỗi mạng khi đăng xuất: vẫn xóa phiên cục bộ
    }
    const theme = localStorage.getItem("messenger-theme")
    localStorage.clear()
    if (theme) localStorage.setItem("messenger-theme", theme)
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

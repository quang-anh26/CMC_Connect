import React from "react"
import { Navigate } from "react-router-dom"
import { useAuth } from "../context/AuthContext"
import { Loading } from "./ui"

export default function ProtectedRoute({ children, adminOnly = false }) {
  const { user, loading } = useAuth()
  if (loading) return <Loading />
  if (!user) return <Navigate to="/login" replace />
  if (adminOnly && user.role !== "ADMIN") return <Navigate to="/" replace />
  return children
}

import React from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import LoadingState from './LoadingState'

export default function ProtectedRoute({ children, adminOnly = false }) {
  const { user, loading } = useAuth()

  if (loading) return <div className="empty-state"><LoadingState compact label="Đang tải..." /></div>
  if (!user) return <Navigate to="/login" replace />
  if (adminOnly && user.role !== 'ADMIN') return <Navigate to="/" replace />

  return children
}

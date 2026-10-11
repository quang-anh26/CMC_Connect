import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { SocketProvider } from './context/SocketContext'
import ProtectedRoute from './components/ProtectedRoute'

import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import MainLayout from './pages/MainLayout'
import EmptyChatPage from './pages/EmptyChatPage'
import ChatWindow from './pages/ChatWindow'
import FriendsPage from './pages/FriendsPage'
import ProfilePage from './pages/ProfilePage'
import FeedPage from './pages/FeedPage'
import EventsPage from './pages/EventsPage'
import AdminDashboardPage from './pages/admin/AdminDashboardPage'
import GroupsPage from './pages/GroupsPage'
import GroupDetailPage from './pages/GroupDetailPage'
import ExplorePage from './pages/ExplorePage'

const VideosPage = React.lazy(() => import('./pages/VideosPage'))
const MarketplacePage = React.lazy(() => import('./pages/MarketplacePage'))
const SavedPage = React.lazy(() => import('./pages/SavedPage'))

export default function App() {
  return (
    <AuthProvider>
      <SocketProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />

            <Route
              path="/admin"
              element={
                <ProtectedRoute adminOnly>
                  <AdminDashboardPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <MainLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<EmptyChatPage />} />
              <Route path="feed" element={<FeedPage />} />
              <Route path="explore" element={<ExplorePage />} />
              <Route path="video" element={<React.Suspense fallback={<main className="video-page"><div className="video-state">Đang mở video...</div></main>}><VideosPage /></React.Suspense>} />
              <Route path="marketplace" element={<React.Suspense fallback={<main className="marketplace-page"><div className="market-state">Đang mở Marketplace...</div></main>}><MarketplacePage /></React.Suspense>} />
              <Route path="marketplace/:listingId" element={<React.Suspense fallback={<main className="marketplace-page"><div className="market-state">Đang mở Marketplace...</div></main>}><MarketplacePage /></React.Suspense>} />
              <Route path="saved" element={<React.Suspense fallback={<main className="saved-page"><div className="saved-state">Đang tải nội dung đã lưu...</div></main>}><SavedPage /></React.Suspense>} />
              <Route path="events" element={<EventsPage />} />
              <Route path="events/:eventId" element={<EventsPage />} />
              <Route path="groups" element={<GroupsPage />} />
              <Route path="groups/:groupId" element={<GroupDetailPage />} />
              <Route path="feed/profile" element={<ProfilePage />} />
              <Route path="feed/profile/:profileUserId" element={<ProfilePage />} />
              <Route path="chat/:conversationId" element={<ChatWindow />} />
              <Route path="friends" element={<FriendsPage />} />
              <Route path="profile" element={<Navigate to="/feed/profile" replace />} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </SocketProvider>
    </AuthProvider>
  )
}

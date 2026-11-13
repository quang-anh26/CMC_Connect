import React from "react"
import { BrowserRouter, Navigate, Route, Routes, useParams } from "react-router-dom"
import { AuthProvider } from "./context/AuthContext"
import { SocketProvider } from "./context/SocketContext"
import ProtectedRoute from "./components/ProtectedRoute"
import Layout from "./components/Layout"
import LoginPage from "./pages/LoginPage"
import RegisterPage from "./pages/RegisterPage"
import ForgotPasswordPage from "./pages/ForgotPasswordPage"
import FeedPage from "./pages/FeedPage"
import MessagesPage from "./pages/MessagesPage"
import ForumPage from "./pages/ForumPage"
import EventsPage from "./pages/EventsPage"
import FriendsPage from "./pages/FriendsPage"
import GroupsPage from "./pages/GroupsPage"
import VideoPage from "./pages/VideoPage"
import SavedPage from "./pages/SavedPage"
import NotificationsPage from "./pages/NotificationsPage"
import ProfilePage from "./pages/ProfilePage"
import AdminPage from "./pages/AdminPage"

const ChatRedirect = () => <Navigate to={`/messages/${useParams().conversationId}`} replace />
const ProfileRedirect = () => <Navigate to={`/profile/${useParams().profileUserId}`} replace />

export default function App() {
  return (
    <AuthProvider>
      <SocketProvider>
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/admin" element={<ProtectedRoute adminOnly><AdminPage /></ProtectedRoute>} />
            <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
              <Route index element={<Navigate to="/feed" replace />} />
              <Route path="feed" element={<FeedPage />} />
              <Route path="messages/:conversationId?" element={<MessagesPage />} />
              <Route path="forum/*" element={<ForumPage />} />
              <Route path="friends" element={<FriendsPage />} />
              <Route path="groups/:groupId?" element={<GroupsPage />} />
              <Route path="video" element={<VideoPage />} />
              <Route path="events/:eventId?" element={<EventsPage />} />
              <Route path="saved" element={<SavedPage />} />
              <Route path="notifications" element={<NotificationsPage />} />
              <Route path="profile" element={<ProfilePage />} />
              <Route path="profile/:profileUserId" element={<ProfilePage />} />
              <Route path="feed/profile" element={<Navigate to="/profile" replace />} />
              <Route path="feed/profile/:profileUserId" element={<ProfileRedirect />} />
              <Route path="chat/:conversationId" element={<ChatRedirect />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </SocketProvider>
    </AuthProvider>
  )
}

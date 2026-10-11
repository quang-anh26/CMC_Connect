import React, { useEffect, useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import Avatar from './Avatar'
import { useAuth } from '../context/AuthContext'
import { friendApi } from '../api/friendApi'
<<<<<<< HEAD
import { groupApi } from '../api/groupApi'
=======
import { conversationApi } from '../api/conversationApi'
>>>>>>> origin/main
import SettingsModal from './SettingsModal'
import {
  MessengerLogo,
  ChatIcon,
  FeedIcon,
  FriendsIcon,
  SearchIcon,
  FeedVideoIcon,
  BellIcon,
  CalendarIcon,
  SettingsIcon,
  ChevronLeft,
  ChevronRight,
  MessageActivityIcon,
} from './Icons'

export default function NavRail() {
  const { user } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [pendingCount, setPendingCount] = useState(0)
<<<<<<< HEAD
  const [groupNotificationCount, setGroupNotificationCount] = useState(0)
=======
<<<<<<< HEAD
  const [messageRequestCount, setMessageRequestCount] = useState(0)
=======
>>>>>>> origin/main
  const [friendNotice, setFriendNotice] = useState('')
>>>>>>> origin/main
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [isCollapsed, setIsCollapsed] = useState(() => {
    return localStorage.getItem('kapatalk-nav-collapsed') === 'true'
  })

  useEffect(() => {
    let previousCount = 0
    let hasLoadedInitialCount = false
    const checkFriendRequests = () => {
      friendApi
        .received()
        .then((res) => {
          const nextCount = res.data ? res.data.length : 0
          if (hasLoadedInitialCount && nextCount > previousCount) {
            setFriendNotice(`Bạn có ${nextCount - previousCount} lời mời kết bạn mới`)
            window.setTimeout(() => setFriendNotice(''), 4000)
          }
          previousCount = nextCount
          hasLoadedInitialCount = true
          setPendingCount(nextCount)
        })
        .catch(() => {})
    }

    checkFriendRequests()
    const intervalId = window.setInterval(checkFriendRequests, 5000)
    return () => window.clearInterval(intervalId)
  }, [])

  useEffect(() => {
<<<<<<< HEAD
    let active = true
    const loadGroupNotifications = () => groupApi.notifications()
      .then(({ data }) => { if (active) setGroupNotificationCount((data || []).filter((item) => !item.read).length) })
      .catch(() => {})
    loadGroupNotifications()
    const intervalId = window.setInterval(loadGroupNotifications, 30000)
    return () => { active = false; window.clearInterval(intervalId) }
  }, [])
=======
    let mounted = true
    const loadCount = () => {
      conversationApi.requests()
        .then((res) => mounted && setMessageRequestCount((res.data || []).length))
        .catch(() => {})
    }
    loadCount()
    const timer = window.setInterval(loadCount, 10000)
    return () => {
      mounted = false
      window.clearInterval(timer)
    }
  }, [location.pathname])
>>>>>>> origin/main

  const displayName = user?.displayName || user?.username || 'Tài khoản'
  const isOnline = user?.isOnline !== false
  const toggleCollapsed = (event) => {
    event.stopPropagation()
    setIsCollapsed((current) => {
      const next = !current
      localStorage.setItem('kapatalk-nav-collapsed', String(next))
      return next
    })
  }

  return (
    <>
      <div className={`nav-rail ${isCollapsed ? 'collapsed' : ''}`}>
        {/* Brand Header */}
        <div className="nav-rail-brand">
          <MessengerLogo size={32} />
          <div className="nav-brand-copy"><span className="brand-title">KapaTalk</span><small>Kết nối · Chia sẻ · Cùng phát triển</small></div>
        </div>

        {/* Navigation Links */}
        <div className="nav-rail-menu">
          <NavLink
            to="/feed"
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            title="Bảng tin"
          >
            <span className="nav-icon">
              <FeedIcon size={20} />
            </span>
            <span className="nav-label">Bảng tin</span>
          </NavLink>

          <NavLink
            to="/"
            className={({ isActive }) =>
<<<<<<< HEAD
              `nav-item nav-chat-link ${isActive && !location.pathname.startsWith('/friends') && !location.pathname.startsWith('/profile') ? 'active' : ''}`
=======
<<<<<<< HEAD
              `nav-item ${isActive && !location.pathname.startsWith('/friends') && !location.pathname.startsWith('/message-requests') && !location.pathname.startsWith('/profile') ? 'active' : ''}`
=======
              `nav-item nav-chat-link ${isActive && !archiveSelected && !location.pathname.startsWith('/friends') && !location.pathname.startsWith('/profile') ? 'active' : ''}`
>>>>>>> origin/main
>>>>>>> origin/main
            }
            title="Trò chuyện"
          >
            <span className="nav-icon">
              <ChatIcon size={20} />
            </span>
            <span className="nav-label">Trò chuyện</span>
          </NavLink>

          <NavLink
            to="/message-requests"
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            title="Tin nhắn chờ"
            onClick={() => setArchiveSelected(false)}
          >
            <span className="nav-icon">
              <MessageActivityIcon size={20} />
            </span>
            <span className="nav-label">Tin nhắn chờ</span>
            {messageRequestCount > 0 && <span className="nav-badge">{messageRequestCount}</span>}
          </NavLink>

          <NavLink
            to="/friends"
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            title="Bạn bè"
          >
            <span className="nav-icon">
              <FriendsIcon size={20} />
            </span>
            <span className="nav-label">Bạn bè</span>
            {pendingCount > 0 && <span className="nav-badge">{pendingCount}</span>}
          </NavLink>

          <NavLink
            to="/events"
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            title="Sự kiện"
          >
            <span className="nav-icon"><CalendarIcon size={20} /></span>
            <span className="nav-label">Sự kiện</span>
          </NavLink>

          <NavLink to="/groups" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} title="Nhóm">
            <span className="nav-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="12" cy="7" r="3.2"/><circle cx="4.8" cy="9" r="2.4"/><circle cx="19.2" cy="9" r="2.4"/><path d="M6.4 18.7v-1.1a5.6 5.6 0 0 1 11.2 0v1.1c0 .8-.6 1.4-1.4 1.4H7.8c-.8 0-1.4-.6-1.4-1.4Z"/><path d="M1.1 17.7v-.8a3.8 3.8 0 0 1 4-3.8c.6 0 1.2.1 1.7.4a7 7 0 0 0-1.8 4.7H2.5c-.8 0-1.4-.2-1.4-.5ZM22.9 17.7v-.8a3.8 3.8 0 0 0-4-3.8c-.6 0-1.2.1-1.7.4a7 7 0 0 1 1.8 4.7h2.5c.8 0 1.4-.2 1.4-.5Z"/></svg></span><span className="nav-label">Nhóm</span>
          </NavLink>
          <NavLink to="/explore" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} title="Khám phá">
            <span className="nav-icon"><SearchIcon size={20} /></span><span className="nav-label">Khám phá</span>
          </NavLink>
          <NavLink to="/video" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} title="Video">
            <span className="nav-icon"><FeedVideoIcon size={20} /></span><span className="nav-label">Video</span>
          </NavLink>
          <NavLink to="/marketplace" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} title="Marketplace">
            <span className="nav-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9h18l-1.5-6h-15L3 9Z"/><path d="M5 9v12h14V9M9 21v-7h6v7"/><path d="M3 9a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0"/></svg></span><span className="nav-label">Marketplace</span>
          </NavLink>
          <NavLink to="/saved" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} title="Đã lưu">
            <span className="nav-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 4.75A1.75 1.75 0 0 1 7.75 3h8.5A1.75 1.75 0 0 1 18 4.75V21l-6-4-6 4V4.75Z"/></svg></span><span className="nav-label">Đã lưu</span>
          </NavLink>
          <NavLink to="/groups" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} title="Thông báo nhóm">
            <span className="nav-icon"><BellIcon size={20} /></span><span className="nav-label">Thông báo</span>
            {groupNotificationCount > 0 && <span className="nav-badge">{groupNotificationCount}</span>}
          </NavLink>

        </div>

        {/* Footer: Real user profile & status - clicking opens Settings modal */}
        <div className="nav-shortcuts">
          <div className="nav-shortcuts-title">Lối tắt của bạn</div>
          <button type="button" className="nav-shortcut" onClick={() => navigate('/groups')} title="Khám phá nhóm">
            <span className="shortcut-avatar shortcut-avatar-1">+</span><span>Khám phá nhóm</span>
          </button>
        </div>
        <div className="nav-rail-footer">
          {/* Status indicator row */}
          <div
            className="online-status-row"
            title="Trạng thái hoạt động"
          >
            <div className="status-indicator-left">
              <span className={`status-dot ${isOnline ? 'online' : 'offline'}`} />
              <span className="status-text">{isOnline ? 'Đang online' : 'Hoạt động'}</span>
            </div>
          </div>

          {/* User Profile Card: Clicking on the user's name opens Settings Modal */}
          <div
            className="user-profile-row"
            onClick={() => setUserMenuOpen((current) => !current)}
            title="Cài đặt tài khoản"
          >
            <Avatar src={user?.avatar} name={displayName} size={36} />
            <span className="user-display-name">{displayName}</span>
            {userMenuOpen && (
              <div className="user-options" onClick={(event) => event.stopPropagation()}>
                <button
                  type="button"
                  className="user-option"
                  onClick={() => {
                    navigate('/feed/profile')
                    setUserMenuOpen(false)
                  }}
                >
                  <Avatar src={user?.avatar} name={displayName} size={20} />
                  <span>Trang cá nhân</span>
                </button>
                <button
                  type="button"
                  className="user-option"
                  onClick={() => {
                    setSettingsOpen(true)
                    setUserMenuOpen(false)
                  }}
                >
                  <SettingsIcon size={18} />
                  <span>Cài đặt</span>
                </button>
              </div>
            )}
          </div>

          <button
            type="button"
            className="nav-collapse-button"
            onClick={toggleCollapsed}
            aria-label={isCollapsed ? 'Mở thanh điều hướng' : 'Thu gọn thanh điều hướng'}
            title={isCollapsed ? 'Mở thanh điều hướng' : 'Thu gọn thanh điều hướng'}
          >
            {isCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
            <span className="nav-label">{isCollapsed ? 'Mở rộng' : 'Thu gọn'}</span>
          </button>
        </div>
      </div>

      {friendNotice && <div className="friend-notice">{friendNotice}</div>}

      {/* Settings Modal Component matching the user's uploaded mockup */}
      <SettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />
    </>
  )
}

import React from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import Avatar from './Avatar'
import { useAuth } from '../context/AuthContext'
import {
  BellIcon,
  BookOpenIcon,
  BookmarkIcon,
  CalendarIcon,
  ChatIcon,
  FeedVideoIcon,
  FriendsIcon,
  GroupIcon,
  HomeIcon,
} from './Icons'

const primaryLinks = [
  { to: '/feed', label: 'Trang chủ', icon: HomeIcon, end: true },
  { to: '/forum', label: 'Diễn đàn học tập', icon: BookOpenIcon },
  { to: '/friends', label: 'Bạn bè', icon: FriendsIcon },
  { to: '/groups', label: 'Nhóm', icon: GroupIcon },
  { to: '/video', label: 'Video', icon: FeedVideoIcon },
  { to: '/events', label: 'Sự kiện', icon: CalendarIcon },
  { to: '/saved', label: 'Đã lưu', icon: BookmarkIcon },
]

function NavigationLink({ to, label, icon: Icon, end = false, active = false }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) => `feed-side-link${isActive || active ? ' active' : ''}`}
      title={label}
    >
      <Icon size={22} />
      <span>{label}</span>
    </NavLink>
  )
}

export default function PrimarySidebar() {
  const { user } = useAuth()
  const location = useLocation()
  const displayName = user?.displayName || user?.username || 'Trang cá nhân'
  const isChatActive = location.pathname.startsWith('/chat/')

  return (
    <nav className="feed-side-menu" aria-label="Điều hướng chính">
      <NavLink to="/feed/profile" className="feed-side-profile" title="Trang cá nhân">
        <Avatar src={user?.avatar} name={displayName} size={40} />
        <span>{displayName}</span>
      </NavLink>

      <div className="feed-side-menu-items">
        <div className="feed-side-menu-group">
          {primaryLinks.map((link) => <NavigationLink key={link.to} {...link} />)}
        </div>
        <div className="feed-side-menu-separator" role="separator" />
        <div className="feed-side-menu-group">
          <NavigationLink to="/messages" label="Trò chuyện" icon={ChatIcon} active={isChatActive} />
          <NavigationLink to="/notifications" label="Thông báo" icon={BellIcon} />
        </div>
      </div>

      <footer className="feed-side-footer">CMC Talk · Kết nối và chia sẻ</footer>
    </nav>
  )
}

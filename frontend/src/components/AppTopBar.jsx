import React, { useEffect, useRef, useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import Avatar from './Avatar'
import {
  BellIcon,
  CalendarIcon,
  ChatIcon,
  FeedVideoIcon,
  FriendsIcon,
  GroupIcon,
  MessengerLogo,
  SearchIcon,
} from './Icons'
import { groupApi } from '../api/groupApi'
import { friendApi } from '../api/friendApi'
import { conversationApi } from '../api/conversationApi'
import { userApi } from '../api/userApi'
import { useAuth } from '../context/AuthContext'
import SettingsModal from './SettingsModal'

function HomeIcon({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m3 10 9-7 9 7" />
      <path d="M5 9v11h14V9M9 20v-6h6v6" />
    </svg>
  )
}

function SavedIcon({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 4.75A1.75 1.75 0 0 1 7.75 3h8.5A1.75 1.75 0 0 1 18 4.75V21l-6-4-6 4V4.75Z" />
    </svg>
  )
}

export default function AppTopBar() {
  const { user, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const searchRef = useRef(null)
  const accountMenuRef = useRef(null)
  const [query, setQuery] = useState('')
  const [searchResults, setSearchResults] = useState({ people: [], groups: [] })
  const [searchOpen, setSearchOpen] = useState(false)
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState('')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [notificationCount, setNotificationCount] = useState(0)
  const [unreadMessageCount, setUnreadMessageCount] = useState(0)
  const [messageRequestCount, setMessageRequestCount] = useState(0)
  const [accountMenuOpen, setAccountMenuOpen] = useState(false)

  useEffect(() => {
    const openSettings = () => setSettingsOpen(true)
    window.addEventListener('cmctalk-open-settings', openSettings)
    return () => window.removeEventListener('cmctalk-open-settings', openSettings)
  }, [])

  useEffect(() => {
    let active = true
    const loadNavigationCounts = async () => {
      const [friends, groups, conversations, requests] = await Promise.allSettled([
        friendApi.received(),
        groupApi.notifications(),
        conversationApi.list(),
        conversationApi.requests(),
      ])
      if (!active) return
      if (friends.status === 'fulfilled' && groups.status === 'fulfilled') {
        const friendCount = (friends.value.data || []).length
        const groupCount = (groups.value.data || []).filter((item) => !item.read).length
        setNotificationCount(friendCount + groupCount)
      }
      if (conversations.status === 'fulfilled') {
        setUnreadMessageCount((conversations.value.data || []).reduce(
          (total, conversation) => total + (Number(conversation.unreadCount) || 0),
          0,
        ))
      }
      if (requests.status === 'fulfilled') {
        setMessageRequestCount((requests.value.data || []).length)
      }
    }

    loadNavigationCounts()
    const intervalId = window.setInterval(loadNavigationCounts, 30000)
    window.addEventListener('focus', loadNavigationCounts)
    window.addEventListener('cmctalk-conversations-updated', loadNavigationCounts)
    return () => {
      active = false
      window.clearInterval(intervalId)
      window.removeEventListener('focus', loadNavigationCounts)
      window.removeEventListener('cmctalk-conversations-updated', loadNavigationCounts)
    }
  }, [])

  useEffect(() => {
    const term = query.trim()
    if (term.length < 2) {
      setSearchResults({ people: [], groups: [] })
      setSearchError('')
      setSearching(false)
      return undefined
    }

    let active = true
    const timeoutId = window.setTimeout(async () => {
      setSearching(true)
      setSearchError('')
      const [peopleResult, groupsResult] = await Promise.allSettled([
        userApi.search(term),
        groupApi.list({ search: term }),
      ])
      if (!active) return

      if (peopleResult.status === 'rejected' && groupsResult.status === 'rejected') {
        setSearchResults({ people: [], groups: [] })
        setSearchError('Không thể tìm kiếm lúc này. Vui lòng thử lại.')
      } else {
        const people = peopleResult.status === 'fulfilled' ? peopleResult.value.data || [] : []
        const groups = groupsResult.status === 'fulfilled' ? groupsResult.value.data || [] : []
        setSearchResults({
          people: people.filter((person) => String(person.userId) !== String(user?.userId)).slice(0, 5),
          groups: groups.slice(0, 5),
        })
        if (peopleResult.status === 'rejected' || groupsResult.status === 'rejected') {
          setSearchError('Một số kết quả tìm kiếm hiện không khả dụng.')
        }
      }
      setSearching(false)
    }, 250)

    return () => {
      active = false
      window.clearTimeout(timeoutId)
    }
  }, [query, user?.userId])

  useEffect(() => {
    const closeSearch = (event) => {
      if (!searchRef.current?.contains(event.target)) setSearchOpen(false)
    }
    document.addEventListener('mousedown', closeSearch)
    return () => document.removeEventListener('mousedown', closeSearch)
  }, [])

  useEffect(() => {
    const closeAccountMenu = (event) => {
      if (!accountMenuRef.current?.contains(event.target)) setAccountMenuOpen(false)
    }
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setAccountMenuOpen(false)
    }
    document.addEventListener('mousedown', closeAccountMenu)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('mousedown', closeAccountMenu)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [])

  const closeSearch = () => {
    setQuery('')
    setSearchOpen(false)
    setSearchError('')
  }

  const selectSearchResult = (path) => {
    closeSearch()
    navigate(path)
  }

  const isMessagesActive = location.pathname.startsWith('/messages') || location.pathname.startsWith('/chat/')
  const profileName = user?.displayName || user?.username || 'Tài khoản'
  const hasSearchResults = searchResults.people.length > 0 || searchResults.groups.length > 0
  const openSettings = () => {
    setAccountMenuOpen(false)
    setSettingsOpen(true)
  }

  return (
    <>
      <header className="app-topbar">
      <div className="app-topbar-left">
        <button className="app-topbar-brand" type="button" aria-label="Bảng tin" onClick={() => navigate('/feed')}>
          <MessengerLogo size={38} />
        </button>
        <div className="app-topbar-search" ref={searchRef}>
          <SearchIcon size={17} />
          <input
            type="search"
            aria-label="Tìm người hoặc nhóm"
            aria-expanded={searchOpen && query.trim().length >= 2}
            placeholder="Tìm người hoặc nhóm..."
            value={query}
            onFocus={() => setSearchOpen(true)}
            onChange={(event) => setQuery(event.target.value)}
          />
          {query && <button type="button" aria-label="Xóa nội dung tìm kiếm" onClick={closeSearch}>×</button>}
          {searchOpen && query.trim().length >= 2 && (
            <div className="app-search-results" role="listbox">
              {searching && <div className="app-search-message">Đang tìm kiếm...</div>}
              {!searching && searchError && <div className="app-search-message app-search-error">{searchError}</div>}
              {!searching && !searchError && !hasSearchResults && <div className="app-search-message">Không tìm thấy người hoặc nhóm phù hợp.</div>}
              {!searching && searchResults.people.length > 0 && (
                <div className="app-search-section">
                  <span>Mọi người</span>
                  {searchResults.people.map((person) => (
                    <button key={person.userId} type="button" role="option" onClick={() => selectSearchResult(`/feed/profile/${person.userId}`)}>
                      <Avatar src={person.avatar} name={person.displayName || person.username} size={36} />
                      <span><strong>{person.displayName || person.username}</strong><small>@{person.username}</small></span>
                    </button>
                  ))}
                </div>
              )}
              {!searching && searchResults.groups.length > 0 && (
                <div className="app-search-section">
                  <span>Nhóm</span>
                  {searchResults.groups.map((group) => (
                    <button key={group.groupId} type="button" role="option" onClick={() => selectSearchResult(`/groups/${group.groupId}`)}>
                      <span className="app-search-group-icon"><GroupIcon size={19} /></span>
                      <span><strong>{group.name}</strong><small>Nhóm</small></span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <nav className="app-topbar-navigation" aria-label="Điều hướng chính">
        <NavLink to="/feed" end className={({ isActive }) => `app-topbar-link ${isActive ? 'active' : ''}`} aria-label="Bảng tin" title="Bảng tin">
          <HomeIcon />
        </NavLink>
        <NavLink to="/video" className={({ isActive }) => `app-topbar-link ${isActive ? 'active' : ''}`} aria-label="Video" title="Video">
          <FeedVideoIcon size={20} />
        </NavLink>
        <NavLink to="/friends" className={({ isActive }) => `app-topbar-link ${isActive ? 'active' : ''}`} aria-label="Bạn bè" title="Bạn bè">
          <FriendsIcon size={20} />
        </NavLink>
        <NavLink to="/groups" className={({ isActive }) => `app-topbar-link ${isActive ? 'active' : ''}`} aria-label="Nhóm" title="Nhóm">
          <GroupIcon size={20} />
        </NavLink>
        <NavLink to="/events" className={({ isActive }) => `app-topbar-link ${isActive ? 'active' : ''}`} aria-label="Sự kiện" title="Sự kiện">
          <CalendarIcon size={20} />
        </NavLink>
        <NavLink to="/saved" className={({ isActive }) => `app-topbar-link ${isActive ? 'active' : ''}`} aria-label="Đã lưu" title="Đã lưu">
          <SavedIcon size={20} />
        </NavLink>
      </nav>

      <div className="app-topbar-actions">
        <NavLink to="/messages" className={`app-topbar-action ${isMessagesActive ? 'active' : ''}`} aria-label={`Trò chuyện${unreadMessageCount + messageRequestCount ? `, ${unreadMessageCount + messageRequestCount} nội dung chưa đọc hoặc đang chờ` : ''}`} title="Trò chuyện">
          <ChatIcon size={20} />
          {unreadMessageCount + messageRequestCount > 0 && <b className="app-topbar-badge">{unreadMessageCount + messageRequestCount > 99 ? '99+' : unreadMessageCount + messageRequestCount}</b>}
        </NavLink>
        <NavLink to="/notifications" className={({ isActive }) => `app-topbar-action ${isActive ? 'active' : ''}`} aria-label={`Thông báo${notificationCount ? `, ${notificationCount} chưa đọc` : ''}`} title="Thông báo">
          <BellIcon size={20} />
          {notificationCount > 0 && <b className="app-topbar-badge">{notificationCount > 99 ? '99+' : notificationCount}</b>}
        </NavLink>
        <div className="app-account-menu-wrap" ref={accountMenuRef}>
          <button
            type="button"
            className={`app-topbar-profile ${accountMenuOpen || location.pathname.startsWith('/feed/profile') ? 'active' : ''}`}
            aria-label="Mở menu tài khoản"
            aria-haspopup="menu"
            aria-expanded={accountMenuOpen}
            title="Tài khoản"
            onClick={() => setAccountMenuOpen((open) => !open)}
          >
            <Avatar src={user?.avatar} name={profileName} size={36} />
            <span className="app-account-menu-caret" aria-hidden="true">⌄</span>
          </button>
          {accountMenuOpen && (
            <div className="app-account-menu" role="menu" aria-label="Menu tài khoản">
              <div className="app-account-menu-identity">
                <Avatar src={user?.avatar} name={profileName} size={48} />
                <div><strong>{profileName}</strong><span>@{user?.username || ''}</span></div>
              </div>
              <button type="button" role="menuitem" onClick={() => { setAccountMenuOpen(false); navigate('/feed/profile') }}>
                <span className="app-account-menu-icon">◉</span>
                Xem trang cá nhân
              </button>
              <button type="button" role="menuitem" onClick={openSettings}>
                <span className="app-account-menu-icon">⚙</span>
                Cài đặt và quyền riêng tư
              </button>
              <div className="app-account-menu-divider" />
              <button type="button" role="menuitem" className="app-account-logout" onClick={() => { setAccountMenuOpen(false); logout() }}>
                <span className="app-account-menu-icon">⇥</span>
                Đăng xuất
              </button>
            </div>
          )}
        </div>
      </div>
      </header>
      <SettingsModal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </>
  )
}

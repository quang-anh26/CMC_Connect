import React, { useCallback, useEffect, useRef, useState } from "react"
import { Outlet, useLocation, useNavigate } from "react-router-dom"
import { Icon } from "./Icon"
import { Avatar, ToastProvider } from "./ui"
import { useAuth } from "../context/AuthContext"
import { conversationApi } from "../api/conversationApi"
import { notificationApi } from "../api/notificationApi"
import { userApi } from "../api/userApi"
import { friendApi } from "../api/friendApi"
import { groupApi } from "../api/groupApi"
import SettingsModal from "./SettingsModal"
import usePresenceHeartbeat from "../utils/usePresenceHeartbeat"
import { saveThemeMode } from "../utils/theme"

const nav = [
  { key: "feed", path: "/feed", label: "Trang chủ", icon: "home" },
  { key: "forum", path: "/forum", label: "Diễn đàn học tập", icon: "forum" },
  { key: "messages", path: "/messages", label: "Trò chuyện", icon: "message" },
  { key: "friends", path: "/friends", label: "Bạn bè", icon: "users" },
  { key: "groups", path: "/groups", label: "Nhóm", icon: "group" },
  { key: "video", path: "/video", label: "Video", icon: "video" },
  { key: "events", path: "/events", label: "Sự kiện", icon: "calendar" },
  { key: "saved", path: "/saved", label: "Đã lưu", icon: "bookmark" },
  { key: "notifications", path: "/notifications", label: "Thông báo", icon: "bell" },
]

function useCounts() {
  const [counts, setCounts] = useState({ messages: 0, notifications: 0 })
  const refresh = useCallback(async () => {
    const [convs, friends, groups, activity] = await Promise.allSettled([
      conversationApi.list(),
      friendApi.received(),
      groupApi.notifications(),
      notificationApi.unreadCount(),
    ])
    const messages = convs.status === "fulfilled" ? (convs.value.data || []).reduce((sum, c) => sum + (Number(c.unreadCount) || 0), 0) : 0
    const f = friends.status === "fulfilled" ? (friends.value.data || []).length : 0
    const g = groups.status === "fulfilled" ? (groups.value.data || []).filter((n) => !n.read).length : 0
    const a = activity.status === "fulfilled" ? Number(activity.value.data?.count || 0) : 0
    setCounts({ messages, notifications: f + g + a })
  }, [])
  useEffect(() => {
    refresh()
    const timer = setInterval(refresh, 20000)
    window.addEventListener("focus", refresh)
    window.addEventListener("cmctalk-conversations-updated", refresh)
    window.addEventListener("cmctalk-notifications-updated", refresh)
    return () => {
      clearInterval(timer)
      window.removeEventListener("focus", refresh)
      window.removeEventListener("cmctalk-conversations-updated", refresh)
      window.removeEventListener("cmctalk-notifications-updated", refresh)
    }
  }, [refresh])
  return counts
}

function GlobalSearch() {
  const navigate = useNavigate()
  const [query, setQuery] = useState("")
  const [results, setResults] = useState({ people: [], groups: [] })
  const [open, setOpen] = useState(false)
  const box = useRef(null)

  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) {
      setResults({ people: [], groups: [] })
      return undefined
    }
    const timer = setTimeout(async () => {
      const [people, groups] = await Promise.allSettled([userApi.search(q), groupApi.list({ search: q })])
      const g = groups.status === "fulfilled" ? (Array.isArray(groups.value.data) ? groups.value.data : groups.value.data?.content || []) : []
      setResults({ people: people.status === "fulfilled" ? (people.value.data || []).slice(0, 5) : [], groups: g.slice(0, 4) })
    }, 250)
    return () => clearTimeout(timer)
  }, [query])

  useEffect(() => {
    const close = (event) => box.current && !box.current.contains(event.target) && setOpen(false)
    document.addEventListener("mousedown", close)
    return () => document.removeEventListener("mousedown", close)
  }, [])

  const go = (path) => {
    setOpen(false)
    setQuery("")
    navigate(path)
  }
  const empty = !results.people.length && !results.groups.length

  return (
    <div className="search-wrap" ref={box}>
      <label className="global-search">
        <Icon name="search" size={19} />
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          placeholder="Tìm người hoặc nhóm..."
          aria-label="Tìm người hoặc nhóm"
        />
        {query && (
          <button type="button" aria-label="Xóa nội dung tìm kiếm" onClick={() => setQuery("")}>
            <Icon name="close" size={15} />
          </button>
        )}
      </label>
      {open && query.trim().length >= 2 && (
        <div className="search-results">
          {empty && <p className="search-empty">Không tìm thấy kết quả phù hợp.</p>}
          {results.people.length > 0 && <p className="search-group-title">Mọi người</p>}
          {results.people.map((u) => (
            <button key={`u${u.userId}`} type="button" onClick={() => go(`/profile/${u.userId}`)}>
              <Avatar name={u.displayName} src={u.avatar} size="sm" />
              <span>
                <strong>{u.displayName}</strong>
                <small>@{u.username}</small>
              </span>
            </button>
          ))}
          {results.groups.length > 0 && <p className="search-group-title">Nhóm</p>}
          {results.groups.map((g) => (
            <button key={`g${g.groupId}`} type="button" onClick={() => go(`/groups/${g.groupId}`)}>
              <Avatar name={g.name} src={g.avatar} size="sm" />
              <span>
                <strong>{g.name}</strong>
                <small>{g.memberCount} thành viên</small>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function Header({ route, me, counts, dark, toggleTheme, openSettings }) {
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const [accountOpen, setAccountOpen] = useState(false)
  const name = me?.displayName || user?.displayName || user?.username || ""
  const go = (path) => {
    setAccountOpen(false)
    navigate(path)
  }
  return (
    <header className="topbar">
      <div className="topbar-inner">
        <button className="brand" onClick={() => navigate("/feed")} aria-label="CMC Talk - Trang chủ">
          <span className="brand-mark">
            <span>C</span>
          </span>
          <span className="brand-name">
            CMC <b>Talk</b>
          </span>
        </button>
        <GlobalSearch />
        <nav className="top-links" aria-label="Điều hướng nhanh">
          <button className={route === "feed" ? "active" : ""} onClick={() => navigate("/feed")}>Bảng tin</button>
          <button className={route === "forum" ? "active" : ""} onClick={() => navigate("/forum")}>Học tập</button>
          <button className={route === "events" ? "active" : ""} onClick={() => navigate("/events")}>Sự kiện</button>
        </nav>
        <div className="top-actions">
          <button className="icon-button" aria-label="Chuyển chế độ màu" onClick={toggleTheme}>
            <Icon name={dark ? "sun" : "moon"} />
          </button>
          <button className="icon-button" aria-label="Tin nhắn" onClick={() => navigate("/messages")}>
            <Icon name="message" />
            {counts.messages > 0 && <span className="dot-count">{counts.messages > 99 ? "99+" : counts.messages}</span>}
          </button>
          <button className="icon-button" aria-label="Thông báo" onClick={() => navigate("/notifications")}>
            <Icon name="bell" />
            {counts.notifications > 0 && <span className="dot-count">{counts.notifications > 99 ? "99+" : counts.notifications}</span>}
          </button>
          <div className="account-wrap">
            <button className="account-button" onClick={() => setAccountOpen(!accountOpen)}>
              <Avatar name={name} src={me?.avatar} size="sm" />
              <span>{name}</span>
              <Icon name="chevron" size={15} />
            </button>
            {accountOpen && (
              <div className="account-menu">
                <button onClick={() => go("/profile")}>
                  <Icon name="users" />
                  Trang cá nhân
                </button>
                <button
                  onClick={() => {
                    setAccountOpen(false)
                    openSettings()
                  }}
                >
                  <Icon name="settings" />
                  Cài đặt
                </button>
                {user?.role === "ADMIN" && (
                  <button onClick={() => go("/admin")}>
                    <Icon name="settings" />
                    Khu vực quản trị
                  </button>
                )}
                <button
                  onClick={async () => {
                    setAccountOpen(false)
                    await logout()
                    navigate("/login", { replace: true })
                  }}
                >
                  <Icon name="logout" />
                  Đăng xuất
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}

function Sidebar({ route, me, counts }) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const name = me?.displayName || user?.displayName || user?.username || ""
  return (
    <aside className="sidebar">
      <div className="student-card" onClick={() => navigate("/profile")}>
        <Avatar name={name} src={me?.avatar} />
        <div>
          <strong>{name}</strong>
          <span>{me?.education || (user?.username ? `@${user.username}` : "Sinh viên CMC")}</span>
        </div>
      </div>
      <nav className="side-nav" aria-label="Điều hướng chính">
        {nav.map((item) => {
          const count = item.key === "messages" ? counts.messages : item.key === "notifications" ? counts.notifications : 0
          return (
            <button key={item.key} className={route === item.key ? "active" : ""} onClick={() => navigate(item.path)}>
              <Icon name={item.icon} />
              <span>{item.label}</span>
              {count > 0 && <em>{count > 99 ? "99+" : count}</em>}
            </button>
          )
        })}
      </nav>
      <div className="sidebar-foot">
        {user?.role === "ADMIN" && (
          <button onClick={() => navigate("/admin")}>
            <Icon name="settings" />
            <span>Khu vực quản trị</span>
          </button>
        )}
        <p>CMC Talk · Cộng đồng sinh viên CMC</p>
      </div>
    </aside>
  )
}

function MobileNav({ route, counts }) {
  const navigate = useNavigate()
  const labels = { feed: "Trang chủ", forum: "Học tập", messages: "Chat" }
  return (
    <nav className="mobile-nav">
      {nav.slice(0, 5).map((item) => (
        <button key={item.key} className={route === item.key ? "active" : ""} onClick={() => navigate(item.path)}>
          <Icon name={item.icon} />
          <span>{labels[item.key] || item.label}</span>
          {item.key === "messages" && counts.messages > 0 && <em>{counts.messages}</em>}
        </button>
      ))}
    </nav>
  )
}

export default function Layout() {
  const location = useLocation()
  const { user } = useAuth()
  const counts = useCounts()
  const [me, setMe] = useState(null)
  const [dark, setDark] = useState(() => document.documentElement.getAttribute("data-theme") === "dark")
  const [settingsOpen, setSettingsOpen] = useState(false)
  usePresenceHeartbeat()

  useEffect(() => {
    userApi.me().then(({ data }) => setMe(data)).catch(() => {})
    const refreshMe = () => userApi.me().then(({ data }) => setMe(data)).catch(() => {})
    window.addEventListener("cmctalk-profile-updated", refreshMe)
    return () => window.removeEventListener("cmctalk-profile-updated", refreshMe)
  }, [user?.userId])

  useEffect(() => {
    const showServerError = (event) => window.alert(event.detail)
    window.addEventListener("cmctalk-server-error", showServerError)
    return () => window.removeEventListener("cmctalk-server-error", showServerError)
  }, [])

  useEffect(() => {
    const sync = () => setDark(document.documentElement.getAttribute("data-theme") === "dark")
    const observer = new MutationObserver(sync)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] })
    return () => observer.disconnect()
  }, [])

  const toggleTheme = () => saveThemeMode(dark ? "light" : "dark")

  const segment = location.pathname.split("/")[1] || "feed"
  const route = segment === "profile" ? "profile" : segment

  return (
    <ToastProvider>
      <div className={dark ? "app dark" : "app"}>
        <Header route={route} me={me} counts={counts} dark={dark} toggleTheme={toggleTheme} openSettings={() => setSettingsOpen(true)} />
        <div className="app-layout">
          <Sidebar route={route} me={me} counts={counts} />
          <div className={`content-area route-${route}`}>
            <Outlet context={{ me }} />
          </div>
        </div>
        <MobileNav route={route} counts={counts} />
        {settingsOpen && <SettingsModal me={me} onClose={() => setSettingsOpen(false)} onSaved={() => window.dispatchEvent(new Event("cmctalk-profile-updated"))} />}
      </div>
    </ToastProvider>
  )
}

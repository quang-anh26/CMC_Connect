import React, { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Icon } from "../components/Icon"
import { Avatar, Button, ErrorBlock, Loading, ToastProvider, useAsync, useToast } from "../components/ui"
import { adminApi } from "../api/adminApi"
import { useAuth } from "../context/AuthContext"
import { getApiErrorMessage } from "../utils/apiError"

function AdminInner() {
  const navigate = useNavigate()
  const toast = useToast()
  const { user } = useAuth()
  const [query, setQuery] = useState("")
  const [debounced, setDebounced] = useState("")
  useEffect(() => { const t = setTimeout(() => setDebounced(query.trim()), 300); return () => clearTimeout(t) }, [query])
  const stats = useAsync(() => adminApi.dashboard().then((r) => r.data), [])
  const users = useAsync(() => adminApi.users(debounced || undefined).then((r) => r.data || []), [debounced])

  const toggle = async (u) => {
    try {
      await (u.status === "LOCKED" ? adminApi.unlock(u.userId) : adminApi.lock(u.userId))
      toast(u.status === "LOCKED" ? "Đã mở khóa tài khoản." : "Đã khóa tài khoản.")
      users.reload(); stats.reload()
    } catch (err) { toast(getApiErrorMessage(err, "Không thể thay đổi trạng thái tài khoản."), "error") }
  }
  const s = stats.data
  return (
    <div className="admin-shell">
      <aside className="admin-nav">
        <div className="brand"><span className="brand-mark"><span>C</span></span><span className="brand-name">CMC <b>Admin</b></span></div>
        <nav>
          <button className="active"><Icon name="home" />Tổng quan</button>
        </nav>
        <button onClick={() => navigate("/feed")}><Icon name="arrow" /><span>Về CMC Talk</span></button>
      </aside>
      <main className="admin-main">
        <header>
          <div><span>Khu vực quản trị</span><h1>Tổng quan vận hành</h1></div>
          <Avatar name={user?.displayName || "QT"} />
        </header>
        {stats.loading && <Loading />}
        {stats.error && <ErrorBlock message={stats.error} onRetry={stats.reload} />}
        {s && (
          <section className="admin-stats">
            {[["Tổng người dùng", s.totalUsers], ["Đang online", s.onlineUsers], ["Tài khoản bị khóa", s.lockedUsers], ["Tin nhắn hôm nay", s.messagesToday]].map(([label, value]) => (
              <div key={label}><span>{label}</span><strong>{value}</strong></div>
            ))}
          </section>
        )}
        <section className="review-table">
          <div className="table-title">
            <div><h2>Quản lý tài khoản</h2><p>{(users.data || []).length} tài khoản</p></div>
            <label><Icon name="search" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Tìm tài khoản" /></label>
          </div>
          <div className="table-head"><span>Tài khoản</span><span>Username</span><span>Trạng thái</span><span>Vai trò</span><span>Thao tác</span></div>
          {users.loading && <Loading />}
          {users.error && <ErrorBlock message={users.error} onRetry={users.reload} />}
          {(users.data || []).map((u) => (
            <div className="table-row" key={u.userId}>
              <span><Avatar name={u.displayName} size="sm" /><strong>{u.displayName}</strong></span>
              <span>@{u.username}{u.online ? " · online" : ""}</span>
              <span><em className={u.status === "LOCKED" ? "locked" : "pending"}>{u.status === "LOCKED" ? "Đã khóa" : "Hoạt động"}</em></span>
              <span>{u.role}</span>
              <span>{u.role !== "ADMIN" && <button onClick={() => toggle(u)}>{u.status === "LOCKED" ? "Mở khóa" : "Khóa tài khoản"}</button>}</span>
            </div>
          ))}
        </section>
      </main>
    </div>
  )
}

export default function AdminPage() {
  return <ToastProvider><AdminInner /></ToastProvider>
}

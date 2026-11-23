import React, { useCallback, useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Icon } from "../components/Icon"
import { Avatar, Button, EmptyState, ErrorBlock, Loading, useToast } from "../components/ui"
import { notificationApi } from "../api/notificationApi"
import { friendApi } from "../api/friendApi"
import { conversationApi } from "../api/conversationApi"
import { getApiErrorMessage } from "../utils/apiError"
import { timeAgo } from "../utils/format"

const iconFor = (item) => {
  if (item.type === "friend") return "users"
  const t = item.notification.type || ""
  if (t === "POST_CREATED" || t === "STORY_CREATED") return "image"
  if (t.startsWith("EVENT_")) return "calendar"
  if (t === "POST_REACTION") return "heart"
  return "bell"
}

// Thông báo dạng "đã tạo sự kiện..." cần có tên người thực hiện ở đầu câu; thông báo hệ thống (nhắc lịch) đã là câu đầy đủ.
const messageText = (n) => {
  const name = n.actorDisplayName || n.actorUsername
  const first = (n.message || "").charAt(0)
  return name && first && first === first.toLowerCase() && first !== first.toUpperCase() ? `${name} ${n.message}` : n.message
}

const CATEGORIES = [["all", "Tất cả"], ["unread", "Chưa đọc"], ["invites", "Lời mời"]]

export default function NotificationsPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const [data, setData] = useState({ friends: [], activities: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [category, setCategory] = useState("all")
  const [busyId, setBusyId] = useState(null)
  const badge = () => window.dispatchEvent(new Event("cmctalk-notifications-updated"))

  const load = useCallback(() => {
    Promise.allSettled([friendApi.received(), notificationApi.list()])
      .then(([friends, activities]) => {
        if (friends.status === "fulfilled" || activities.status === "fulfilled") {
          setData((current) => ({
            friends: friends.status === "fulfilled" ? (friends.value.data || []) : current.friends,
            activities: activities.status === "fulfilled" ? (activities.value.data || []) : current.activities,
          }))
          setError("")
        } else {
          setError(getApiErrorMessage(friends.reason, "Không thể tải thông báo. Vui lòng thử lại."))
        }
      })
      .finally(() => setLoading(false))
  }, [])
  useEffect(() => { load() }, [load])
  useEffect(() => {
    const refresh = () => load()
    const timer = window.setInterval(refresh, 20000)
    window.addEventListener("focus", refresh)
    window.addEventListener("cmctalk-notifications-updated", refresh)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener("focus", refresh)
      window.removeEventListener("cmctalk-notifications-updated", refresh)
    }
  }, [load])

  const items = useMemo(() => [
    ...data.activities.map((n) => ({ id: `a${n.id}`, type: "activity", createdAt: n.createdAt, unread: !n.read, notification: n })),
    ...data.friends.map((r) => ({ id: `f${r.id}`, type: "friend", createdAt: r.createdAt, unread: true, request: r })),
  ].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)), [data])

  const visible = items.filter((i) => {
    if (category === "unread") return i.unread
    if (category === "invites") return i.type === "friend"
    return true
  })
  const unreadCount = items.filter((i) => i.unread).length
  const run = async (id, fn, fallback) => {
    setBusyId(id)
    try { await fn() } catch (e) { toast(getApiErrorMessage(e, fallback), "error") } finally { setBusyId(null) }
  }

  const respondFriend = (r, accept) => run(`f${r.id}`, async () => {
    if (accept) {
      await friendApi.accept(r.id)
      try { await conversationApi.getOrCreatePrivate(r.senderId) } catch { /* không bắt buộc */ }
      window.dispatchEvent(new Event("cmctalk-conversations-updated"))
      toast("Đã chấp nhận lời mời kết bạn.")
    } else await friendApi.reject(r.id)
    setData((d) => ({ ...d, friends: d.friends.filter((x) => x.id !== r.id) }))
    badge()
  }, "Không thể xử lý lời mời kết bạn.")

  const openActivity = (n) => run(`a${n.id}`, async () => {
    if (!n.read) {
      await notificationApi.markRead(n.id)
      setData((d) => ({ ...d, activities: d.activities.map((x) => (x.id === n.id ? { ...x, read: true } : x)) }))
      badge()
    }
    if (n.referenceType === "USER" && n.actorId) navigate(`/profile/${n.actorId}`)
    else if (n.referenceType === "POST") navigate(`/feed?postId=${n.referenceId || ""}`)
    else if (n.referenceType === "STORY") navigate("/feed")
    else if (n.referenceType === "EVENT" && n.referenceId) navigate(`/events/${n.referenceId}`)
    else if (n.actorId) navigate(`/profile/${n.actorId}`)
  }, "Không thể mở thông báo.")

  const removeActivity = (n) => run(`a${n.id}`, async () => {
    await notificationApi.remove(n.id)
    setData((d) => ({ ...d, activities: d.activities.filter((x) => x.id !== n.id) }))
    badge()
  }, "Không thể xóa thông báo.")

  const markAll = () => run("all", async () => {
    await notificationApi.markAllRead()
    load(); badge()
  }, "Không thể đánh dấu đã đọc.")

  return (
    <div className="notifications-page">
      <header className="page-title-row notifications-header">
        <div><h1>Thông báo</h1><p>Lời mời kết bạn, bài viết, lượt thích, sự kiện và tin từ bạn bè.</p></div>
        <Button variant="secondary" disabled={unreadCount === 0 || busyId === "all"} onClick={markAll}>Đánh dấu đã đọc</Button>
      </header>
      <div className="notification-tabs">
        {CATEGORIES.map(([key, label]) => <button key={key} className={category === key ? "active" : ""} onClick={() => setCategory(key)}>{label}</button>)}
      </div>
      <div className="notification-list">
        {loading && <Loading label="Đang tải thông báo..." />}
        {error && <ErrorBlock message={error} onRetry={() => { setLoading(true); load() }} />}
        {!loading && !error && visible.length === 0 && <EmptyState title={category === "unread" ? "Bạn đã xem hết thông báo mới" : "Chưa có thông báo nào"} copy="Thông báo mới sẽ xuất hiện tại đây." icon="bell" />}
        {visible.map((item) => {
              const busy = busyId === item.id
              if (item.type === "friend") {
                const r = item.request
                return (
                  <div className="notif-request unread" key={item.id}>
                    <span className="note-avatar"><button type="button" className="profile-avatar-link" aria-label={`Mở trang cá nhân của ${r.senderDisplayName}`} onClick={() => navigate(`/profile/${r.senderId}`)}><Avatar name={r.senderDisplayName} src={r.senderAvatar} /></button><i><Icon name="users" size={14} /></i></span>
                    <span><button type="button" className="profile-identity-link strong" onClick={() => navigate(`/profile/${r.senderId}`)}>{r.senderDisplayName}</button><p>đã gửi cho bạn lời mời kết bạn · {timeAgo(r.createdAt)}</p></span>
                    <Button disabled={busy} onClick={() => respondFriend(r, true)}>Xác nhận</Button>
                    <Button variant="secondary" disabled={busy} onClick={() => respondFriend(r, false)}>Xóa</Button>
                  </div>
                )
              }
              const n = item.notification
              const actorName = n.actorDisplayName || n.actorUsername
              const activityText = messageText(n)
              const activityDetail = actorName && activityText.startsWith(actorName) ? activityText.slice(actorName.length).trimStart() : activityText
              return (
                <div className={`notification-activity${item.unread ? " unread" : ""}`} key={item.id}>
                  <span className="note-avatar">{n.actorId ? <button type="button" className="profile-avatar-link" aria-label={`Mở trang cá nhân của ${actorName || "người dùng"}`} onClick={() => navigate(`/profile/${n.actorId}`)}><Avatar name={actorName || "Sự kiện"} src={n.actorAvatar} /></button> : <Avatar name={actorName || "Sự kiện"} src={n.actorAvatar} />}<i><Icon name={iconFor(item)} size={14} /></i></span>
                  <span className="notification-activity-content"><strong>{actorName && <>{n.actorId ? <button type="button" className="profile-identity-link strong" onClick={() => navigate(`/profile/${n.actorId}`)}>{actorName}</button> : actorName}{activityDetail ? " " : ""}</>}<button type="button" className="notification-open" disabled={busy} onClick={() => openActivity(n)}>{activityDetail}</button></strong><small>{timeAgo(n.createdAt)}</small></span>
                  {item.unread && <em />}
                  <button type="button" className="notif-del" aria-label="Xóa thông báo" disabled={busy} onClick={() => removeActivity(n)}><Icon name="close" size={16} /></button>
                </div>
              )
        })}
      </div>
    </div>
  )
}

import React, { useCallback, useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Icon } from "../components/Icon"
import { Avatar, Button, EmptyState, ErrorBlock, Loading, useToast } from "../components/ui"
import { notificationApi } from "../api/notificationApi"
import { friendApi } from "../api/friendApi"
import { groupApi } from "../api/groupApi"
import { conversationApi } from "../api/conversationApi"
import { getApiErrorMessage } from "../utils/apiError"
import { dayLabel, timeAgo } from "../utils/format"

const iconFor = (item) => {
  if (item.type === "friend") return "users"
  if (item.type === "group") return "group"
  const t = item.notification.type || ""
  if (t === "MESSAGE") return "comment"
  if (t.startsWith("EVENT_")) return "calendar"
  if (t === "FRIEND_REQUEST_ACCEPTED") return "users"
  if (t === "POST_SHARED") return "share"
  if (t === "POST_REACTION") return "heart"
  return "bell"
}

const isFriendish = (i) => i.type === "friend" || (i.type === "activity" && i.notification.type === "FRIEND_REQUEST_ACCEPTED")
const isMessage = (i) => i.type === "activity" && i.notification.type === "MESSAGE"
const isEvent = (i) => i.type === "activity" && String(i.notification.type).startsWith("EVENT_")
const isActivity = (i) => i.type === "activity" && !isFriendish(i) && !isMessage(i) && !isEvent(i)

const CATEGORIES = [
  ["all", "Tất cả", () => true],
  ["friend", "Kết bạn", isFriendish],
  ["group", "Nhóm", (i) => i.type === "group"],
  ["activity", "Bài viết", isActivity],
  ["message", "Tin nhắn", isMessage],
  ["event", "Sự kiện", isEvent],
]

export default function NotificationsPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const [data, setData] = useState({ friends: [], groups: [], activities: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [category, setCategory] = useState("all")
  const [unreadOnly, setUnreadOnly] = useState(false)
  const [busyId, setBusyId] = useState(null)
  const badge = () => window.dispatchEvent(new Event("cmctalk-notifications-updated"))

  const load = useCallback(() => {
    Promise.all([friendApi.received(), groupApi.notifications(), notificationApi.list()])
      .then(([f, g, a]) => { setData({ friends: f.data || [], groups: g.data || [], activities: a.data || [] }); setError("") })
      .catch((e) => setError(getApiErrorMessage(e, "Không thể tải thông báo. Vui lòng thử lại.")))
      .finally(() => setLoading(false))
  }, [])
  useEffect(() => { load() }, [load])

  const items = useMemo(() => [
    ...data.activities.map((n) => ({ id: `a${n.id}`, type: "activity", createdAt: n.createdAt, unread: !n.read, notification: n })),
    ...data.friends.map((r) => ({ id: `f${r.id}`, type: "friend", createdAt: r.createdAt, unread: true, request: r })),
    ...data.groups.map((n) => ({ id: `g${n.id}`, type: "group", createdAt: n.createdAt, unread: !n.read, notification: n })),
  ].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)), [data])

  const filter = CATEGORIES.find((c) => c[0] === category)[2]
  const visible = items.filter(filter).filter((i) => !unreadOnly || i.unread)
  const unreadCount = items.filter((i) => i.unread).length
  const groupedByDay = useMemo(() => {
    const map = new Map()
    visible.forEach((i) => {
      const label = dayLabel(i.createdAt) || "Trước đó"
      if (!map.has(label)) map.set(label, [])
      map.get(label).push(i)
    })
    return [...map.entries()]
  }, [visible])

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

  const openGroup = (n) => run(`g${n.id}`, async () => {
    if (!n.read) {
      await groupApi.markNotificationRead(n.id)
      setData((d) => ({ ...d, groups: d.groups.map((x) => (x.id === n.id ? { ...x, read: true } : x)) }))
      badge()
    }
    navigate(`/groups/${n.groupId}`)
  }, "Không thể cập nhật thông báo.")

  const respondInvite = (n, approved) => run(`g${n.id}`, async () => {
    await groupApi.respondInvite(n.referenceId, approved)
    setData((d) => ({ ...d, groups: d.groups.filter((x) => x.id !== n.id) }))
    badge()
    toast(approved ? "Đã tham gia nhóm." : "Đã từ chối lời mời.")
  }, "Không thể xử lý lời mời vào nhóm.")

  const openActivity = (n) => run(`a${n.id}`, async () => {
    if (!n.read) {
      await notificationApi.markRead(n.id)
      setData((d) => ({ ...d, activities: d.activities.map((x) => (x.id === n.id ? { ...x, read: true } : x)) }))
      badge()
    }
    if (n.referenceType === "USER" && n.actorId) navigate(`/profile/${n.actorId}`)
    else if (n.referenceType === "POST") navigate(`/feed?postId=${n.referenceId || ""}`)
    else if (n.referenceType === "CONVERSATION" && n.referenceId) navigate(`/messages/${n.referenceId}`)
    else if (n.referenceType === "EVENT" && n.referenceId) navigate(`/events/${n.referenceId}`)
    else if (n.actorId) navigate(`/profile/${n.actorId}`)
  }, "Không thể mở thông báo.")

  const removeActivity = (n) => run(`a${n.id}`, async () => {
    await notificationApi.remove(n.id)
    setData((d) => ({ ...d, activities: d.activities.filter((x) => x.id !== n.id) }))
    badge()
  }, "Không thể xóa thông báo.")

  const markAll = () => run("all", async () => {
    await Promise.all([...data.groups.filter((g) => !g.read).map((g) => groupApi.markNotificationRead(g.id)), notificationApi.markAllRead()])
    load(); badge()
  }, "Không thể đánh dấu đã đọc.")

  return (
    <div className="notifications-page">
      <header className="page-title-row">
        <div><h1>Thông báo</h1><p>Theo dõi các hoạt động mới nhất trên CMC Talk.</p></div>
        <Button variant="secondary" disabled={unreadCount === 0 || busyId === "all"} onClick={markAll}>Đánh dấu tất cả đã đọc</Button>
      </header>
      <div className="notification-tabs">
        {CATEGORIES.map(([key, label, fn]) => {
          const n = items.filter((i) => i.unread && fn(i)).length
          return <button key={key} className={category === key ? "active" : ""} onClick={() => setCategory(key)}>{label}{n > 0 ? ` (${n})` : ""}</button>
        })}
        <button className={`unread-toggle ${unreadOnly ? "active" : ""}`} onClick={() => setUnreadOnly(!unreadOnly)}>Chưa đọc</button>
      </div>
      <div className="notification-list">
        {loading && <Loading label="Đang tải thông báo..." />}
        {error && <ErrorBlock message={error} onRetry={() => { setLoading(true); load() }} />}
        {!loading && !error && visible.length === 0 && <EmptyState title={unreadOnly ? "Bạn đã xem hết thông báo mới" : "Chưa có thông báo nào"} copy="Thông báo mới sẽ xuất hiện tại đây." icon="bell" />}
        {groupedByDay.map(([label, list]) => (
          <div key={label}>
            <h3 className="notif-day">{label}</h3>
            {list.map((item) => {
              const busy = busyId === item.id
              if (item.type === "friend") {
                const r = item.request
                return (
                  <div className="notif-request unread" key={item.id}>
                    <span className="note-avatar"><Avatar name={r.senderDisplayName} src={r.senderAvatar} /><i><Icon name="users" size={14} /></i></span>
                    <span><strong>{r.senderDisplayName}</strong><p>đã gửi cho bạn lời mời kết bạn · {timeAgo(r.createdAt)}</p></span>
                    <Button disabled={busy} onClick={() => respondFriend(r, true)}>Xác nhận</Button>
                    <Button variant="secondary" disabled={busy} onClick={() => respondFriend(r, false)}>Xóa</Button>
                  </div>
                )
              }
              if (item.type === "group") {
                const n = item.notification
                const invite = n.type === "INVITE"
                return (
                  <div className={`notif-request ${item.unread ? "unread" : ""}`} key={item.id}>
                    <span className="note-avatar"><Avatar name={n.groupName} /><i><Icon name="group" size={14} /></i></span>
                    <span style={{ cursor: invite ? "default" : "pointer" }} onClick={() => !invite && openGroup(n)}><strong>{n.groupName}</strong><p>{n.message} · {timeAgo(n.createdAt)}</p></span>
                    {invite ? (
                      <>
                        <Button disabled={busy} onClick={() => respondInvite(n, true)}>Tham gia</Button>
                        <Button variant="secondary" disabled={busy} onClick={() => respondInvite(n, false)}>Từ chối</Button>
                      </>
                    ) : (
                      <Button variant="secondary" disabled={busy} onClick={() => openGroup(n)}>Xem nhóm</Button>
                    )}
                  </div>
                )
              }
              const n = item.notification
              return (
                <button className={item.unread ? "unread" : ""} key={item.id} disabled={busy} onClick={() => openActivity(n)}>
                  <span className="note-avatar"><Avatar name={n.actorDisplayName || n.actorUsername} src={n.actorAvatar} /><i><Icon name={iconFor(item)} size={14} /></i></span>
                  <span><strong>{n.message}</strong><small>{timeAgo(n.createdAt)}</small></span>
                  {item.unread && <em />}
                  <span className="notif-del" role="button" tabIndex={0} aria-label="Xóa thông báo" onClick={(e) => { e.stopPropagation(); removeActivity(n) }}><Icon name="close" size={16} /></span>
                </button>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
